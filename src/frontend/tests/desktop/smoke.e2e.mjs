/** Exercises the real Tauri window through an explicitly enabled local WebDriver. */
import assert from "node:assert/strict";
import { realpath, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

const address = process.env.ATUS_DESKTOP_E2E_URL;
if (!address || !/^http:\/\/127\.0\.0\.1:\d+$/.test(address)) {
  throw new Error("Set ATUS_DESKTOP_E2E_URL to the loopback URL of the test-only driver");
}

async function request(method, path, body) {
  const response = await fetch(`${address}${path}`, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(5000),
  });
  const data = await response.json();
  assert.ok(
    response.ok && !data.value?.error,
    `WebDriver ${method} ${path}: ${JSON.stringify(data)}`,
  );
  return data.value;
}

test("the native application shows the new analysis action", { timeout: 30000 }, async () => {
  const { sessionId } = await request("POST", "/session", { capabilities: { alwaysMatch: {} } });
  assert.ok(sessionId);
  try {
    const deadline = Date.now() + 20000;
    let element;
    while (Date.now() < deadline) {
      const matches = await request("POST", `/session/${sessionId}/elements`, {
        using: "xpath",
        value: '//button[contains(., "Nova análise")]',
      });
      element = matches[0]?.["element-6066-11e4-a52e-4f735466cecf"];
      if (element) break;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    assert.ok(element, "New analysis action was not found");
    const text = await request("GET", `/session/${sessionId}/element/${element}/text`);
    assert.match(text, /Nova análise/);
  } finally {
    await request("DELETE", `/session/${sessionId}`);
  }
});

test(
  "creates, saves and reopens a project in an isolated temporary directory",
  { timeout: 30000 },
  async () => {
    const configuredDir = process.env.ATUS_DESKTOP_E2E_PROJECT_DIR;
    assert.ok(configuredDir, "ATUS_DESKTOP_E2E_PROJECT_DIR is required");
    const dir = await realpath(configuredDir);
    const temp = await realpath(tmpdir());
    assert.ok(
      dir.startsWith(`${temp}${path.sep}`),
      "Project directory must be inside the system temporary directory",
    );
    assert.deepEqual(await readdir(dir), [], "Project directory must start empty");

    const { sessionId } = await request("POST", "/session", { capabilities: { alwaysMatch: {} } });
    const base = `/session/${sessionId}`;
    const execute = (script, args = []) =>
      request("POST", `${base}/execute/sync`, { script, args });
    try {
      // Avoid adding a test project to the user's persisted recent-project list.
      await execute(
        'window.__atusE2eSetItem = Storage.prototype.setItem; Storage.prototype.setItem = function(k, v) { if (k !== "atus.recent-projects.v1") return window.__atusE2eSetItem.call(this, k, v); };',
      );
      const activeDir = await execute(
        'return window.__TAURI_INTERNALS__.invoke("project_test_directory")',
      );
      assert.equal(
        await realpath(activeDir),
        dir,
        "Application must use the specified temporary directory",
      );
      const current = await execute('return window.__TAURI_INTERNALS__.invoke("project_list")');
      assert.deepEqual(current, [], "Application must use the empty test project directory");
      const action = await request("POST", `${base}/element`, {
        using: "xpath",
        value: '//button[contains(., "Nova análise")]',
      });
      await request(
        "POST",
        `${base}/element/${action["element-6066-11e4-a52e-4f735466cecf"]}/click`,
        {},
      );
      const deadline = Date.now() + 15000;
      let files = [];
      while (Date.now() < deadline && files.length === 0) {
        files = (await readdir(dir)).filter((name) => name.endsWith(".atus"));
        if (!files.length) await new Promise((resolve) => setTimeout(resolve, 250));
      }
      assert.equal(files.length, 1, "The application should create one project");
      const filename = path.join(dir, files[0]);
      const result = await execute(
        'return (async (p) => { const invoke = window.__TAURI_INTERNALS__.invoke; const opened = await invoke("project_open", { path: p }); const snapshot = structuredClone(opened.snapshot); snapshot.analyses[0].state = { e2eMarker: "persisted" }; await invoke("project_save", { path: p, previous: opened.snapshot, snapshot }); return await invoke("project_open", { path: p }); })(arguments[0]);',
        [filename],
      );
      assert.equal(result.snapshot.analyses[0].state.e2eMarker, "persisted");
    } finally {
      await execute(
        "if (window.__atusE2eSetItem) Storage.prototype.setItem = window.__atusE2eSetItem;",
      );
      await request("DELETE", base);
    }
  },
);
