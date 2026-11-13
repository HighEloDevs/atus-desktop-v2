/**
 * Integration test of the updater, run against the real desktop application on each platform.
 *
 * A local server plays the releases: it serves a manifest and a package signed with a throwaway
 * key, which the application is told to trust through `update_test_configure` (test-only, in the
 * `desktop-e2e` build). The test covers checking, the verified background download with progress
 * events, cancelling, a tampered package, signatures that do not name their version, and the
 * rules about when installing is allowed. The package is never installed: under the test build
 * "installing" only records the bytes it received, because the test must not replace the binary
 * it runs. The application keeps running, so the other smoke tests can follow.
 */
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { openSession, until } from "./driver.mjs";
import { createKey, manifest, packageBytes, serve, trustedComment } from "./updater-fixture.mjs";

const SECOND = 1000;
const NEWER = "99.0.0";

const key = createKey();
const other = createKey();
const pkg = packageBytes(400 * 1024);
let server;
let main;

/** Points the application at the test server with the given manifest route. */
async function configure(route, pubkey = key.pubkey) {
  server.routes = { "/latest.json": route, "/package": { body: pkg, chunks: 40, delay: 15 } };
  await main.invoke("update_test_configure", { endpoint: `${server.url}/latest.json`, pubkey });
  await main.run("window.__updateStates.length = 0");
}

/** The manifest route for a package signed as `signedAs`, announcing `version`. */
function offer({ version = NEWER, signedAs = version, signer = key, comment } = {}) {
  const signature = signer.sign(pkg, comment ?? trustedComment(signedAs));
  return {
    json: manifest({
      version,
      notes: "Resumo da versão.",
      signature,
      url: `${server.url}/package`,
    }),
  };
}

/** Waits for the state to reach `kind`. */
function waitFor(kind, timeout = 20 * SECOND) {
  return until(
    async () => {
      const state = await main.invoke("update_status");
      return state.kind === kind ? state : null;
    },
    `The update state never became ${kind}`,
    timeout,
  );
}

/** The states received through the event since the last `configure`. */
const events = () => main.run("return window.__updateStates");

before(async () => {
  server = await serve();
  main = await openSession("main");
  // The state events are the contract with the interface, so the test listens like it will.
  const handler = await main.run(
    "window.__updateStates = []; return window.__TAURI_INTERNALS__.transformCallback((event) => window.__updateStates.push(event.payload))",
  );
  await main.invoke("plugin:event|listen", {
    event: "update-state",
    target: { kind: "Any" },
    handler,
  });
});

after(async () => {
  await main?.close();
  await server?.close();
});

test("starts idle, and nothing is checked until asked", async () => {
  await configure({ status: 204 });
  assert.deepEqual(await main.invoke("update_status"), { kind: "idle" });
  assert.deepEqual(await events(), []);
});

test("reports being up to date when the server has nothing newer", async () => {
  await configure({ status: 204 });
  assert.deepEqual(await main.invoke("update_check"), { kind: "upToDate" });
  assert.deepEqual(await main.invoke("update_status"), { kind: "upToDate" });
  assert.deepEqual(
    (await events()).map((state) => state.kind),
    ["checking", "upToDate"],
  );
  // A version that is not newer than the running one is not an update either.
  await configure(offer({ version: "0.0.1" }));
  assert.deepEqual(await main.invoke("update_check"), { kind: "upToDate" });
});

test("reports a connection error when the server is down or has no manifest", async () => {
  await configure({ status: 204 });
  await main.invoke("update_test_configure", {
    endpoint: "http://127.0.0.1:1/latest.json",
    pubkey: key.pubkey,
  });
  const down = await main.invoke("update_check");
  assert.equal(down.kind, "error");
  assert.equal(down.stage, "check");
  assert.match(down.message, /conexão/);
  await configure({ status: 404 });
  const missing = await main.invoke("update_check");
  assert.equal(missing.kind, "error");
  assert.match(missing.message, /informações da versão/);
  // A failed check can be repeated.
  await configure(offer());
  assert.equal((await main.invoke("update_check")).kind, "available");
});

test("announces a newer version with its notes and refuses to install before downloading", async () => {
  await configure(offer());
  assert.deepEqual(await main.invoke("update_check"), {
    kind: "available",
    version: NEWER,
    notes: "Resumo da versão.",
  });
  await assert.rejects(main.invoke("update_install"), /ainda não foi baixada/);
  await assert.rejects(main.invoke("update_cancel_download"), /Não há download/);
  assert.equal((await main.invoke("update_status")).kind, "available");
});

test("downloads in the background with progress, verifies the signature and installs only on request", async () => {
  await configure(offer());
  await main.invoke("update_check");
  const started = await main.invoke("update_download");
  assert.equal(started.kind, "downloading");
  // A second download or check while one runs is refused.
  await assert.rejects(main.invoke("update_download"), /em andamento/);
  await assert.rejects(main.invoke("update_check"), /em andamento/);
  assert.deepEqual(await waitFor("ready"), { kind: "ready", version: NEWER });
  const all = (await events()).filter((state) => state.kind === "downloading");
  // The first event only announces the start, before the size is known.
  assert.deepEqual(all[0], { kind: "downloading", version: NEWER, downloaded: 0, total: null });
  const progress = all.slice(1);
  assert.ok(progress.length >= 3, `Expected several progress events, got ${progress.length}`);
  assert.ok(
    progress.every((state) => state.total === pkg.length),
    "progress carries the package size",
  );
  const downloaded = progress.map((state) => state.downloaded);
  assert.deepEqual(
    downloaded,
    [...downloaded].sort((a, b) => a - b),
    "progress never goes backwards",
  );
  // A periodic check while the package is ready keeps it, quietly: no `checking` in between and
  // no event at all, so the interface does not flicker. The same holds when the check fails.
  const quiet = (await events()).length;
  assert.deepEqual(await main.invoke("update_check"), { kind: "ready", version: NEWER });
  const original = server.routes["/latest.json"];
  server.routes = { ...server.routes, "/latest.json": { status: 500 } };
  assert.deepEqual(await main.invoke("update_check"), { kind: "ready", version: NEWER });
  server.routes = { ...server.routes, "/latest.json": original };
  assert.equal((await events()).length, quiet, "a quiet check sends no events");
  // Nothing was installed by downloading.
  assert.equal(await main.invoke("update_test_installed"), null);
  // Installing returns at once; the package that reaches the installer is the verified one.
  const installing = await main.invoke("update_install");
  assert.equal(installing.kind, "installing");
  assert.equal(installing.version, NEWER);
  assert.ok(installing.startedAt > 0);
  await until(
    async () => (await main.invoke("update_test_installed")) !== null,
    "The installer never received the package",
  );
  assert.deepEqual(Buffer.from(await main.invoke("update_test_installed")), pkg);
  await assert.rejects(main.invoke("update_install"), /em andamento/);
});

test("cancelling a download goes back to the announced update, which can be downloaded again", async () => {
  await configure(offer());
  await main.invoke("update_check");
  await main.invoke("update_download");
  await until(
    async () => (await main.invoke("update_status")).downloaded > 0,
    "The download never started",
  );
  const cancelled = await main.invoke("update_cancel_download");
  assert.deepEqual(cancelled, {
    kind: "available",
    version: NEWER,
    notes: "Resumo da versão.",
  });
  await main.invoke("update_download");
  assert.deepEqual(await waitFor("ready"), { kind: "ready", version: NEWER });
});

test("rejects a package that does not match its signature, and allows trying again", async () => {
  await configure(offer());
  await main.invoke("update_check");
  const tampered = Buffer.concat([pkg.subarray(0, 100), Buffer.from("tampered")]);
  server.routes = { ...server.routes, "/package": { body: tampered } };
  await main.invoke("update_download");
  const failed = await waitFor("error");
  assert.equal(failed.stage, "download");
  assert.match(failed.message, /assinatura/);
  await assert.rejects(main.invoke("update_install"), /ainda não foi baixada/);
  server.routes = { ...server.routes, "/package": { body: pkg } };
  await main.invoke("update_download");
  assert.deepEqual(await waitFor("ready"), { kind: "ready", version: NEWER });
});

test("rejects a signature from another key", async () => {
  await configure(offer({ signer: other }));
  await main.invoke("update_check");
  await main.invoke("update_download");
  const failed = await waitFor("error");
  assert.equal(failed.stage, "download");
  assert.match(failed.message, /assinatura/);
});

test("rejects a package signed for another version, or for no version", async () => {
  // A tampered manifest could pair a new version number with an older, validly signed package.
  await configure(offer({ version: NEWER, signedAs: "1.0.0" }));
  await main.invoke("update_check");
  await main.invoke("update_download");
  assert.match((await waitFor("error")).message, /assinatura/);
  // Signatures without a version (requireSignedVersion is on in tauri.conf.json).
  await configure(offer({ comment: "timestamp:1\tfile:ATUS.app.tar.gz" }));
  await main.invoke("update_check");
  await main.invoke("update_download");
  assert.match((await waitFor("error")).message, /assinatura/);
});

test("refuses commands that do not fit the state", async () => {
  await configure({ status: 204 });
  await assert.rejects(main.invoke("update_download"), /Não há atualização/);
  await assert.rejects(main.invoke("update_install"), /ainda não foi baixada/);
  await assert.rejects(main.invoke("update_cancel_download"), /Não há download/);
});

test("the web content cannot call the updater plugin directly, only the application commands", async () => {
  // The plugin is registered without a capability: a page that gets hold of the bridge cannot
  // pick its own endpoint or package, nor install anything.
  for (const command of [
    "plugin:updater|check",
    "plugin:updater|download_and_install",
    "plugin:updater|install",
  ]) {
    await assert.rejects(main.invoke(command, {}), /not allowed|permission/i, command);
  }
});
