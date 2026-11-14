/** Update client: the state contract with the native core and its command and event wrappers. */
import { beforeEach, expect, it, vi } from "vitest";

const bridge = vi.hoisted(() => ({ invoke: vi.fn(), isTauri: vi.fn(), listen: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: bridge.invoke, isTauri: bridge.isTauri }));
vi.mock("@tauri-apps/api/window", () => ({ getCurrentWindow: () => ({ listen: bridge.listen }) }));
import {
  RELEASES_URL,
  UPDATE_STATE_EVENT,
  isUpdateState,
  updateClient,
} from "../../src/features/updates/update-client";

beforeEach(() => vi.clearAllMocks());

const VALID = [
  { kind: "idle" },
  { kind: "checking" },
  { kind: "upToDate" },
  { kind: "unavailable", reason: "developmentBuild" },
  { kind: "unavailable", reason: "unknownInstallation" },
  { kind: "available", version: "0.3.0", notes: "Resumo." },
  { kind: "available", version: "0.3.0", notes: null },
  { kind: "ready", version: "0.3.0", notes: null },
  { kind: "downloading", version: "0.3.0", downloaded: 5, total: 10 },
  { kind: "downloading", version: "0.3.0", downloaded: 5, total: null },
  { kind: "installing", version: "0.3.0", startedAt: 1700000000 },
  { kind: "manual", version: "0.3.0", reason: "readOnlyLocation", url: RELEASES_URL, notes: null },
  { kind: "error", stage: "download", message: "Sem conexão." },
];

it.each(VALID)("accepts the state %j", (state) => {
  expect(isUpdateState(state)).toBe(true);
});

it.each([
  undefined,
  null,
  "idle",
  42,
  {},
  { kind: "other" },
  { kind: "unavailable", reason: "x" },
  { kind: "available", notes: null },
  { kind: "available", version: 3 },
  { kind: "ready", version: "1", notes: 5 },
  { kind: "downloading", version: "1", downloaded: "5", total: null },
  { kind: "downloading", version: "1", downloaded: Number.NaN, total: null },
  { kind: "downloading", version: "1", downloaded: 5, total: "x" },
  { kind: "installing", version: "1" },
  { kind: "manual", version: "1", reason: "x", url: RELEASES_URL },
  { kind: "manual", version: "1", reason: "installFailed" },
  { kind: "error", stage: "x", message: "m" },
  { kind: "error", stage: "check", message: 7 },
])("rejects %j", (value) => {
  expect(isUpdateState(value)).toBe(false);
});

it("exists only inside the desktop app", () => {
  bridge.isTauri.mockReturnValue(true);
  expect(updateClient.isAvailable()).toBe(true);
  bridge.isTauri.mockReturnValue(false);
  expect(updateClient.isAvailable()).toBe(false);
});

it.each([
  ["status", "update_status"],
  ["check", "update_check"],
  ["download", "update_download"],
  ["cancelDownload", "update_cancel_download"],
  ["install", "update_install"],
])("%s invokes %s and returns the state", async (method, command) => {
  bridge.invoke.mockResolvedValue({ kind: "checking" });
  expect(await updateClient[method]()).toEqual({ kind: "checking" });
  expect(bridge.invoke).toHaveBeenCalledWith(command);
});

it("ignores an answer that is not a state, and passes failures on", async () => {
  bridge.invoke.mockResolvedValue(undefined);
  expect(await updateClient.status()).toBeNull();
  bridge.invoke.mockResolvedValue({ kind: "nope" });
  expect(await updateClient.check()).toBeNull();
  bridge.invoke.mockRejectedValue("Há outra etapa em andamento.");
  await expect(updateClient.download()).rejects.toBe("Há outra etapa em andamento.");
});

it("asks the core which version this launch was just updated to, and ignores anything else", async () => {
  bridge.invoke.mockResolvedValue("0.2.9");
  expect(await updateClient.takeInstalled()).toBe("0.2.9");
  expect(bridge.invoke).toHaveBeenCalledWith("update_take_installed");
  for (const answer of [null, undefined, "", "0.2", "latest", 29, {}]) {
    bridge.invoke.mockResolvedValue(answer);
    expect(await updateClient.takeInstalled()).toBeNull();
  }
  bridge.invoke.mockRejectedValue("falhou");
  await expect(updateClient.takeInstalled()).rejects.toBe("falhou");
});

it("listens to the state event and drops payloads that are not states", async () => {
  const unlisten = vi.fn();
  bridge.listen.mockResolvedValue(unlisten);
  const callback = vi.fn();
  expect(await updateClient.onState(callback)).toBe(unlisten);
  expect(bridge.listen).toHaveBeenCalledWith(UPDATE_STATE_EVENT, expect.any(Function));
  const handler = bridge.listen.mock.calls[0][1];
  handler({ payload: { kind: "upToDate" } });
  handler({ payload: { kind: "mystery" } });
  handler({ payload: null });
  expect(callback.mock.calls).toEqual([[{ kind: "upToDate" }]]);
});
