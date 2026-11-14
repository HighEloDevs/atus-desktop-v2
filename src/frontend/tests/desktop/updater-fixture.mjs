/**
 * Fixtures for the updater integration test: a throwaway minisign key, signatures in the format
 * the Tauri bundler writes, and a local release server.
 *
 * Nothing here talks to GitHub or uses the real updater key. The application under test is
 * pointed at this server and trusts this key through the test-only `update_test_configure`.
 */
import { createHash, generateKeyPairSync, randomBytes, sign } from "node:crypto";
import { createServer } from "node:http";

const KEY_ID = Buffer.from("0f1e2d3c4b5a6978", "hex");

/**
 * Creates a throwaway key.
 * @returns {{pubkey: string, sign: (data: Buffer, comment: string) => string}} The base64 minisign
 *   public key as written in `plugins.updater.pubkey`, and a function that signs a package and
 *   returns the contents of its `.sig` file. `comment` is the trusted comment.
 */
export function createKey() {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const raw = publicKey.export({ format: "der", type: "spki" }).subarray(-32);
  const box = `untrusted comment: minisign public key: test\n${Buffer.concat([Buffer.from("Ed"), KEY_ID, raw]).toString("base64")}\n`;
  return {
    pubkey: Buffer.from(box).toString("base64"),
    sign(data, comment) {
      const signature = sign(null, createHash("blake2b512").update(data).digest(), privateKey);
      const global = sign(null, Buffer.concat([signature, Buffer.from(comment)]), privateKey);
      const text = `untrusted comment: signature from tauri secret key\n${Buffer.concat([Buffer.from("ED"), KEY_ID, signature]).toString("base64")}\ntrusted comment: ${comment}\n${global.toString("base64")}\n`;
      return Buffer.from(text).toString("base64");
    },
  };
}

/** The trusted comment the Tauri bundler writes, naming the version the package was signed for. */
export function trustedComment(version, file = "ATUS.app.tar.gz") {
  return `timestamp:1\tfile:${file}\tversion:${version}`;
}

/** A package of the given size with a recognizable beginning. */
export function packageBytes(size) {
  const head = Buffer.from("ATUS-TEST-PACKAGE:");
  return Buffer.concat([head, randomBytes(size - head.length)]);
}

/**
 * Starts a release server on a free loopback port.
 *
 * `routes` maps a path to what it answers and can be replaced at any time. A route is
 * `{ status, json }`, `{ status, body, chunks, delay }` (the body sent in `chunks` pieces, `delay`
 * milliseconds apart, with its Content-Length) or just `{ status }` (204 by default).
 * @param {Record<string, any>} [routes] Initial routes.
 * @returns {Promise<{url: string, routes: Record<string, any>, close: () => Promise<void>}>}
 */
export async function serve(routes = {}) {
  const state = { routes };
  const server = createServer(async (request, response) => {
    const route = state.routes[new URL(request.url, "http://x").pathname];
    if (!route) {
      response.writeHead(404).end();
    } else if (route.json !== undefined) {
      response.writeHead(route.status ?? 200, { "content-type": "application/json" });
      response.end(JSON.stringify(route.json));
    } else if (route.body !== undefined) {
      response.writeHead(route.status ?? 200, {
        "content-length": route.body.length,
        "content-type": "application/octet-stream",
      });
      const size = Math.ceil(route.body.length / (route.chunks ?? 1));
      for (let start = 0; start < route.body.length; start += size) {
        if (!response.write(route.body.subarray(start, start + size))) {
          await new Promise((resolve) => response.once("drain", resolve));
        }
        if (route.delay) await new Promise((resolve) => setTimeout(resolve, route.delay));
      }
      response.end();
    } else {
      response.writeHead(route.status ?? 204).end();
    }
  });
  await new Promise((resolve, reject) =>
    server.once("error", reject).listen(0, "127.0.0.1", resolve),
  );
  const { port } = server.address();
  return {
    url: `http://127.0.0.1:${port}`,
    get routes() {
      return state.routes;
    },
    set routes(value) {
      state.routes = value;
    },
    close: () =>
      new Promise((resolve) => {
        server.closeAllConnections();
        server.close(resolve);
      }),
  };
}

/** A manifest that offers `version` for every platform the test runners use. */
export function manifest({ version, notes, signature, url, changelog }) {
  const platforms = {};
  for (const os of ["darwin", "linux", "windows"]) {
    for (const arch of ["x86_64", "aarch64"]) platforms[`${os}-${arch}`] = { signature, url };
  }
  return {
    version,
    notes,
    pub_date: "2026-11-13T00:00:00Z",
    platforms,
    ...(changelog === undefined ? {} : { changelog }),
  };
}
