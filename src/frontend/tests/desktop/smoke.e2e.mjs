/** Exercises the real Tauri window through an explicitly enabled local WebDriver. */
import assert from "node:assert/strict";
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
