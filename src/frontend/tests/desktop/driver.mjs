/**
 * Shared helpers for the desktop integration tests: a small client for the test-only WebDriver
 * that the `desktop-e2e` build embeds, window sessions, polling and native state queries.
 */
import assert from "node:assert/strict";

/** Loopback address of the test-only driver, set by the runner scripts. */
export const address = process.env.ATUS_DESKTOP_E2E_URL;
if (!address || !/^http:\/\/127\.0\.0\.1:\d+$/.test(address)) {
  throw new Error("Set ATUS_DESKTOP_E2E_URL to the loopback URL of the test-only driver");
}

const ELEMENT = "element-6066-11e4-a52e-4f735466cecf";

/**
 * Sends a WebDriver request and returns its `value`.
 * @param {string} method HTTP method.
 * @param {string} path Path below the driver address.
 * @param {unknown} [body] JSON body.
 * @returns {Promise<any>} The `value` field of the response.
 */
export async function request(method, path, body) {
  const response = await fetch(`${address}${path}`, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(path === "/session" && method === "POST" ? 30000 : 10000),
  });
  const data = await response.json();
  assert.ok(
    response.ok && !data.value?.error,
    `WebDriver ${method} ${path}: ${JSON.stringify(data)}`,
  );
  return data.value;
}

/**
 * Polls until `check` returns a truthy value.
 * @param {() => unknown | Promise<unknown>} check Condition; errors count as "not yet".
 * @param {string} message Failure message.
 * @param {number} [timeout] Milliseconds to wait.
 * @returns {Promise<any>} The first truthy result.
 */
export async function until(check, message, timeout = 30000) {
  const deadline = Date.now() + timeout;
  let last;
  while (Date.now() < deadline) {
    try {
      const result = await check();
      if (result) return result;
    } catch (error) {
      last = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`${message}${last ? ` (last error: ${last.message})` : ""}`);
}

/**
 * Opens a WebDriver session attached to the window with the given label. The application also
 * keeps a hidden quick analysis window, so the initial window of a session is not necessarily the
 * one a test wants.
 * @param {string} [label] Window label: `main` or `quick`.
 * @returns {Promise<Window>} The session handle.
 */
export async function openSession(label = "main") {
  const { sessionId } = await request("POST", "/session", { capabilities: { alwaysMatch: {} } });
  assert.ok(sessionId);
  const base = `/session/${sessionId}`;
  const handles = await request("GET", `${base}/window/handles`);
  for (const handle of handles) {
    await request("POST", `${base}/window`, { handle });
    const current = await request("POST", `${base}/execute/sync`, {
      script: "return window.__TAURI_INTERNALS__.metadata.currentWindow.label",
      args: [],
    });
    if (current === label) return new Window(sessionId, base);
  }
  await request("DELETE", base);
  throw new Error(`Window ${label} was not found`);
}

/** A WebDriver session attached to one application window. */
export class Window {
  constructor(sessionId, base) {
    this.sessionId = sessionId;
    this.base = base;
  }

  /** Runs a synchronous script in the page. */
  run(script, args = []) {
    return request("POST", `${this.base}/execute/sync`, { script, args });
  }

  /**
   * Invokes a native command through the Tauri bridge.
   * @param {string} command Command name.
   * @param {Record<string, unknown>} [args] Command arguments.
   * @returns {Promise<any>} The command result; rejects with its error text.
   */
  async invoke(command, args = {}) {
    const result = await request("POST", `${this.base}/execute/async`, {
      script:
        "const done = arguments[arguments.length - 1];" +
        "window.__TAURI_INTERNALS__.invoke(arguments[0], arguments[1])" +
        ".then((ok) => done({ ok: ok ?? null }), (error) => done({ error: String(error) }));",
      args: [command, args],
    });
    if (result.error !== undefined) throw new Error(`${command}: ${result.error}`);
    return result.ok;
  }

  /** Finds elements with an XPath expression. */
  async elements(xpath) {
    const found = await request("POST", `${this.base}/elements`, {
      using: "xpath",
      value: xpath,
    });
    return found.map((item) => item[ELEMENT]);
  }

  /** Waits for the first element matching the XPath expression. */
  async find(xpath, message = `Element ${xpath} was not found`, timeout = 30000) {
    return until(async () => (await this.elements(xpath))[0], message, timeout);
  }

  /** Whether any element matches the XPath expression. */
  async exists(xpath) {
    return (await this.elements(xpath)).length > 0;
  }

  /** Clicks the first element matching the XPath expression, waiting for it to exist. */
  async click(xpath) {
    const id = await this.find(xpath);
    await request("POST", `${this.base}/element/${id}/click`, {});
  }

  /** Clicks the first button whose text contains `text`, waiting for it to exist. */
  async clickButton(text) {
    const id = await this.find(`//button[contains(., "${text}")]`, `Button "${text}" not found`);
    await request("POST", `${this.base}/element/${id}/click`, {});
  }

  /** Replaces the text of the input with the given `aria-label`. */
  async type(label, text) {
    const id = await this.find(`//input[@aria-label="${label}"]`, `Input "${label}" not found`);
    await request("POST", `${this.base}/element/${id}/clear`, {});
    if (text) await request("POST", `${this.base}/element/${id}/value`, { text });
  }

  /** Waits for visible text anywhere in the page. */
  async waitForText(text, timeout = 30000) {
    return this.find(`//*[contains(text(), "${text}")]`, `Text "${text}" not found`, timeout);
  }

  /** Reads `document.body.innerText`. */
  text() {
    return this.run("return document.body.innerText");
  }

  /** Counts the rows of the first table body in the page. */
  rows() {
    return this.run("return document.querySelectorAll('tbody tr').length");
  }

  /** Closes the session. */
  async close() {
    await request("DELETE", this.base).catch(() => {});
  }
}

/**
 * Runs `work` with a session on the window `label` and always closes the session.
 * @template T
 * @param {string} label Window label.
 * @param {(window: Window) => Promise<T>} work Test body.
 * @returns {Promise<T>} What `work` returns.
 */
export async function withWindow(label, work) {
  const window = await openSession(label);
  try {
    return await work(window);
  } finally {
    await window.close();
  }
}

/**
 * Reads the native state of the quick analysis feature (windows, shortcut and tray).
 * @returns {Promise<{quick_exists: boolean, quick_visible: boolean, quick_focused: boolean,
 * main_exists: boolean, main_visible: boolean, shortcut_registered: boolean, tray: boolean}>}
 */
export function nativeState() {
  return withWindow("quick", (quick) => quick.invoke("quick_test_state"));
}

/** Runs a native test command from the always-present quick window. */
export function native(command, args = {}) {
  return withWindow("quick", (quick) => quick.invoke(command, args));
}

/** Whether the test driver still answers, that is, the application process is alive. */
export async function appIsAlive() {
  try {
    const response = await fetch(`${address}/status`, { signal: AbortSignal.timeout(2000) });
    return response.ok;
  } catch {
    return false;
  }
}
