/**
 * Verify Tauri updater signatures (minisign, Ed25519) before a release is published.
 *
 * The bundler signs each updater artifact with the private key from the CI secrets and writes a
 * `.sig` file next to it. The app only installs an update whose signature matches the public key
 * embedded in it (`plugins.updater.pubkey` in `tauri.conf.json`). Checking every signature here
 * catches a secret that does not match the committed public key before users receive a release
 * they could never install.
 *
 * Both the public key and the `.sig` files are base64 encodings of minisign text boxes:
 * `untrusted comment: …` followed by a base64 line of `algorithm (2) | key id (8) | key or signature`.
 * Signatures also carry a trusted comment and a global signature over `signature | trusted comment`.
 */
import { createHash, createPublicKey, verify } from 'node:crypto';

const SPKI_ED25519_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');

/**
 * Decode a base64-wrapped minisign public key.
 * @param {string} encoded Value of `plugins.updater.pubkey`.
 * @returns {{keyId: string, key: import('node:crypto').KeyObject}} Key id as minisign displays it (uppercase hex, bytes reversed) and Ed25519 public key.
 * @throws {Error} When the value is not a minisign Ed25519 public key.
 */
export function decodePublicKey(encoded) {
  const lines = boxLines(encoded, 'public key');
  const raw = Buffer.from(lines[1] ?? '', 'base64');
  if (raw.length !== 42 || raw.subarray(0, 2).toString('latin1') !== 'Ed') throw new Error('The updater public key is not a minisign Ed25519 key');
  return { keyId: displayId(raw.subarray(2, 10)), key: createPublicKey({ key: Buffer.concat([SPKI_ED25519_PREFIX, raw.subarray(10)]), format: 'der', type: 'spki' }) };
}

/**
 * Verify one updater signature against the public key.
 * @param {Buffer} data Bytes of the signed artifact.
 * @param {string} signature Contents of its `.sig` file.
 * @param {string} publicKey Value of `plugins.updater.pubkey`.
 * @param {string} [expectedVersion] When given, the signature must also name this version in its
 *   trusted comment (`version:M.m.p`, written by the Tauri bundler). The app enforces the same
 *   with `requireSignedVersion`, so a signature that does not name it can never be installed.
 * @returns {string|null} Null when valid, otherwise the reason it is not.
 */
export function checkSignature(data, signature, publicKey, expectedVersion) {
  let pub;
  try { pub = decodePublicKey(publicKey); } catch (error) { return error.message; }
  let lines;
  try { lines = boxLines(signature, 'signature'); } catch (error) { return error.message; }
  const raw = Buffer.from(lines[1] ?? '', 'base64');
  if (raw.length !== 74) return 'the signature is malformed';
  const algorithm = raw.subarray(0, 2).toString('latin1');
  if (algorithm !== 'ED' && algorithm !== 'Ed') return `unknown signature algorithm ${algorithm}`;
  if (displayId(raw.subarray(2, 10)) !== pub.keyId) return `signed with key ${displayId(raw.subarray(2, 10))}, but the app trusts ${pub.keyId}`;
  const signed = algorithm === 'ED' ? createHash('blake2b512').update(data).digest() : data;
  if (!verify(null, signed, pub.key, raw.subarray(10))) return 'the signature does not match the file';
  const trusted = /^trusted comment: (.*)$/.exec(lines[2] ?? '');
  const global = Buffer.from(lines[3] ?? '', 'base64');
  if (!trusted || global.length !== 64 || !verify(null, Buffer.concat([raw.subarray(10), Buffer.from(trusted[1], 'utf8')]), pub.key, global)) return 'the trusted comment signature is invalid';
  if (expectedVersion === undefined) return null;
  const named = trusted[1].split('\t').find((field) => field.startsWith('version:'))?.slice('version:'.length);
  if (named === undefined) return 'the signature does not name the version it was signed for';
  return named === expectedVersion ? null : `the signature is for version ${named}, not ${expectedVersion}`;
}

/** minisign stores the key id little-endian and prints it as a big-endian number. */
function displayId(bytes) {
  return Buffer.from(bytes).reverse().toString('hex').toUpperCase();
}

function boxLines(encoded, what) {
  const text = Buffer.from(String(encoded).trim(), 'base64').toString('utf8');
  const lines = text.split(/\r?\n/);
  if (!lines[0]?.startsWith('untrusted comment:')) throw new Error(`The updater ${what} is not a base64 minisign box`);
  return lines;
}
