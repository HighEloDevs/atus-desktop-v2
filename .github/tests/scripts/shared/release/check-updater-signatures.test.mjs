import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { checkSignature, decodePublicKey } from '../../../../scripts/shared/release/check-updater-signatures.mjs';

/** Create a minisign key pair encoded the way `tauri signer generate` writes the public key. */
function keyPair(keyId = Buffer.from('0123456789abcdef', 'hex')) {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const raw = publicKey.export({ format: 'der', type: 'spki' }).subarray(-32);
  const box = `untrusted comment: minisign public key: ${keyId.toString('hex').toUpperCase()}\n${Buffer.concat([Buffer.from('Ed'), keyId, raw]).toString('base64')}\n`;
  return { publicKey: Buffer.from(box).toString('base64'), privateKey, keyId };
}

/** Sign data the way the Tauri bundler does (prehashed `ED` by default) and encode the `.sig` file. */
function signature(data, { privateKey, keyId }, { algorithm = 'ED', comment = 'timestamp:1\tfile:app' } = {}) {
  const signed = algorithm === 'ED' ? createHash('blake2b512').update(data).digest() : data;
  const sig = sign(null, signed, privateKey);
  const global = sign(null, Buffer.concat([sig, Buffer.from(comment)]), privateKey);
  const box = `untrusted comment: signature from tauri secret key\n${Buffer.concat([Buffer.from(algorithm), keyId, sig]).toString('base64')}\ntrusted comment: ${comment}\n${global.toString('base64')}\n`;
  return Buffer.from(box).toString('base64');
}

const DATA = Buffer.from('ATUS updater payload');

test('accepts prehashed and legacy signatures from the trusted key', () => {
  const keys = keyPair();
  assert.equal(checkSignature(DATA, signature(DATA, keys), keys.publicKey), null);
  assert.equal(checkSignature(DATA, signature(DATA, keys, { algorithm: 'Ed' }), keys.publicKey), null);
});

test('rejects a changed file, another key, a forged comment and malformed input', () => {
  const keys = keyPair();
  const other = keyPair(Buffer.from('fedcba9876543210', 'hex'));
  const sameIdOtherKey = keyPair(keys.keyId);
  assert.match(checkSignature(Buffer.from('tampered'), signature(DATA, keys), keys.publicKey), /does not match the file/);
  assert.match(checkSignature(DATA, signature(DATA, other), keys.publicKey), /signed with key 1032547698BADCFE, but the app trusts EFCDAB8967452301/);
  assert.match(checkSignature(DATA, signature(DATA, sameIdOtherKey), keys.publicKey), /does not match the file/);
  const forged = Buffer.from(Buffer.from(signature(DATA, keys), 'base64').toString().replace('timestamp:1', 'timestamp:2')).toString('base64');
  assert.match(checkSignature(DATA, forged, keys.publicKey), /trusted comment signature is invalid/);
  assert.match(checkSignature(DATA, 'not a signature', keys.publicKey), /not a base64 minisign box/);
  assert.match(checkSignature(DATA, Buffer.from('untrusted comment: x\nAAAA\n').toString('base64'), keys.publicKey), /malformed/);
  const unknown = Buffer.from(Buffer.from(signature(DATA, keys), 'base64').toString().split('\n').map((line, i) => i === 1 ? Buffer.concat([Buffer.from('XX'), Buffer.from(line, 'base64').subarray(2)]).toString('base64') : line).join('\n')).toString('base64');
  assert.match(checkSignature(DATA, unknown, keys.publicKey), /unknown signature algorithm XX/);
  assert.match(checkSignature(DATA, signature(DATA, keys), 'bad'), /not a base64 minisign box/);
  assert.throws(() => decodePublicKey(Buffer.from('untrusted comment: x\nAAAA\n').toString('base64')), /not a minisign Ed25519 key/);
});

test('decodes the public key committed in tauri.conf.json', () => {
  const { plugins } = JSON.parse(readFileSync('src/desktop/tauri.conf.json', 'utf8'));
  assert.equal(decodePublicKey(plugins.updater.pubkey).keyId, '895E126F456242E6');
});
