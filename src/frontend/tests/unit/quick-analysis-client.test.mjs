// @vitest-environment jsdom
/** Quick analysis commands, project snapshot and quit request handling. */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";

const api = vi.hoisted(() => ({ isTauri: vi.fn(), invoke: vi.fn(), listen: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ isTauri: api.isTauri, invoke: api.invoke }));
vi.mock("@tauri-apps/api/window", () => ({ getCurrentWindow: () => ({ listen: api.listen }) }));
import {
  QUICK_DATASET_NAME,
  quickAnalysisClient,
  quickAnalysisSnapshot,
} from "../../src/features/quick-analysis/quick-analysis-client";
import { QUIT_REQUESTED_EVENT, useQuitRequest } from "../../src/hooks/use-quit-request";

let root;
let node;
let handlers;
let unlisten;

beforeEach(() => {
  vi.clearAllMocks();
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  handlers = {};
  unlisten = vi.fn();
  api.isTauri.mockReturnValue(true);
  api.invoke.mockResolvedValue(undefined);
  api.listen.mockImplementation(async (event, handler) => {
    handlers[event] = handler;
    return unlisten;
  });
  node = document.createElement("div");
  document.body.appendChild(node);
  root = createRoot(node);
});

afterEach(async () => {
  await act(async () => root.unmount());
  node.remove();
});

it("calls the native quick analysis commands", async () => {
  const analysis = { equation: "a*x", points: [{ x: 1, y: 2 }] };
  await quickAnalysisClient.submit(analysis);
  await quickAnalysisClient.dismiss();
  await quickAnalysisClient.take();
  expect(api.invoke.mock.calls).toEqual([
    ["quick_submit", { analysis }],
    ["quick_dismiss"],
    ["take_quick_analysis"],
  ]);
});

it("leaves the dataset without an equation when none was submitted", () => {
  const snapshot = quickAnalysisSnapshot({ equation: "  ", points: [{ x: 1, y: 2 }] });
  expect(snapshot.analyses[0].datasets[0].state).toEqual({});
});

it("builds a new project with one dataset holding the points and the equation", () => {
  const snapshot = quickAnalysisSnapshot({
    equation: "  a*x + b ",
    points: [
      { x: 1, y: 2, sy: 0.1 },
      { x: 2, y: 4, sx: 0.2 },
    ],
  });
  expect(snapshot.analyses).toHaveLength(1);
  const [dataset] = snapshot.analyses[0].datasets;
  expect(dataset.name).toBe(QUICK_DATASET_NAME);
  expect(dataset.state).toEqual({ equation: "a*x + b" });
  expect(dataset.points).toEqual([
    { x: 1, y: 2, sx: null, sy: 0.1 },
    { x: 2, y: 4, sx: 0.2, sy: null },
  ]);
  expect(dataset.id).not.toBe(snapshot.analyses[0].id);
});

function Harness({ enabled, canLeave }) {
  useQuitRequest(enabled, canLeave);
  return null;
}

async function render(props) {
  await act(async () => root.render(createElement(Harness, props)));
}

it("quits after the guard allows it and ignores repeated requests meanwhile", async () => {
  let release;
  const canLeave = vi.fn(() => new Promise((resolve) => (release = resolve)));
  await render({ enabled: true, canLeave });
  expect(api.listen).toHaveBeenCalledWith(QUIT_REQUESTED_EVENT, expect.any(Function));
  const first = handlers[QUIT_REQUESTED_EVENT]();
  await handlers[QUIT_REQUESTED_EVENT]();
  expect(canLeave).toHaveBeenCalledTimes(1);
  release(true);
  await first;
  expect(api.invoke).toHaveBeenCalledWith("app_quit");
});

it("stays open when the guard refuses or the quit command fails", async () => {
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  await render({ enabled: true, canLeave: async () => false });
  await handlers[QUIT_REQUESTED_EVENT]();
  expect(api.invoke).not.toHaveBeenCalled();
  api.invoke.mockRejectedValueOnce(new Error("falhou"));
  await render({ enabled: true, canLeave: async () => true });
  await handlers[QUIT_REQUESTED_EVENT]();
  expect(error).toHaveBeenCalled();
  error.mockRestore();
});

it("does not listen while disabled or outside the desktop app, and stops on unmount", async () => {
  await render({ enabled: false, canLeave: async () => true });
  expect(api.listen).not.toHaveBeenCalled();
  api.isTauri.mockReturnValue(false);
  await render({ enabled: true, canLeave: async () => true });
  expect(api.listen).not.toHaveBeenCalled();
  api.isTauri.mockReturnValue(true);
  await act(async () => root.render(null));
  await render({ enabled: true, canLeave: async () => true });
  const handler = handlers[QUIT_REQUESTED_EVENT];
  await act(async () => root.render(null));
  expect(unlisten).toHaveBeenCalled();
  await handler();
  expect(api.invoke).not.toHaveBeenCalled();
});
