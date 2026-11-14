// @vitest-environment jsdom
/**
 * Update provider: it follows the native state, checks and downloads in the background, decides
 * when the banner shows and installs only on request, after the project is saved.
 */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";

const notify = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
  loading: vi.fn(),
  dismiss: vi.fn(),
}));
vi.mock("@/lib/notify", () => ({ notify }));
const bridge = vi.hoisted(() => ({ isTauri: vi.fn(), openUrl: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ isTauri: bridge.isTauri }));
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: bridge.openUrl }));
vi.mock("../../src/features/news/embedded-changelog", async () => {
  const { rawChangelog } = await import("../fixtures/changelog-fixture.mjs");
  const { parseChangelog } = await import("../../src/features/news/changelog");
  // The notes of the installed version and the older ones, as the build embeds them.
  return { EMBEDDED_CHANGELOG: parseChangelog(rawChangelog()).slice(1) };
});
import { rawChangelog } from "../fixtures/changelog-fixture.mjs";
import {
  CHECK_EVERY_MS,
  FIRST_CHECK_MS,
  UpdateProvider,
} from "../../src/features/updates/UpdateProvider";
import { BANNER_STORAGE_KEY } from "../../src/features/updates/banner-schedule";
import { useUpdate } from "../../src/features/updates/update-context";
import { RELEASES_URL } from "../../src/features/updates/update-client";

let root;
let node;
let api;

/** A native client whose events the test sends by hand. */
function fakeClient(overrides = {}) {
  const client = {
    isAvailable: vi.fn(() => true),
    status: vi.fn().mockResolvedValue(null),
    check: vi.fn().mockResolvedValue(null),
    download: vi.fn().mockResolvedValue(null),
    cancelDownload: vi.fn().mockResolvedValue(null),
    install: vi.fn().mockResolvedValue(null),
    changelog: vi.fn().mockResolvedValue(null),
    unlisten: vi.fn(),
    send: (state) => client.callback?.(state),
    onState: vi.fn(async (callback) => {
      client.callback = callback;
      return client.unlisten;
    }),
    ...overrides,
  };
  return client;
}

function Probe() {
  api = useUpdate();
  return null;
}

/** Mounts the provider around a probe that exposes the context. */
async function mount(client, props = {}) {
  await act(async () =>
    root.render(
      createElement(UpdateProvider, { client, automatic: false, ...props }, createElement(Probe)),
    ),
  );
}
/** Sends a native state and lets React settle. */
const send = (client, state) => act(async () => client.send(state));

const ready = (version = "0.3.0") => ({ kind: "ready", version, notes: "Resumo." });
const available = (version = "0.3.0") => ({ kind: "available", version, notes: null });

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  localStorage.clear();
  bridge.isTauri.mockReturnValue(true);
  bridge.openUrl.mockResolvedValue(undefined);
  node = document.createElement("div");
  document.body.append(node);
  root = createRoot(node);
});
afterEach(async () => {
  await act(async () => root.unmount());
  node.remove();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

it("starts from the state the core kept, then follows its events, and stops when unmounted", async () => {
  const client = fakeClient({ status: vi.fn().mockResolvedValue(ready()) });
  await mount(client);
  expect(api.state).toEqual(ready());
  await send(client, { kind: "installing", version: "0.3.0", startedAt: 1 });
  expect(api.state.kind).toBe("installing");
  await act(async () => root.unmount());
  expect(client.unlisten).toHaveBeenCalledTimes(1);
  root = createRoot(node);
});

it("unsubscribes at once when the window goes away before the subscription is ready", async () => {
  let resolve;
  const client = fakeClient({ onState: vi.fn(() => new Promise((done) => (resolve = done))) });
  await mount(client);
  await act(async () => root.unmount());
  const late = vi.fn();
  await act(async () => resolve(late));
  expect(late).toHaveBeenCalledTimes(1);
  expect(client.status).not.toHaveBeenCalled();
  root = createRoot(node);
});

it("does nothing outside the desktop app", async () => {
  const client = fakeClient({ isAvailable: vi.fn(() => false) });
  await mount(client, { automatic: true });
  expect(client.onState).not.toHaveBeenCalled();
  expect(client.status).not.toHaveBeenCalled();
  expect(api.state).toEqual({ kind: "idle" });
});

it("keeps working when the core cannot be reached or answers nothing", async () => {
  const errors = vi.spyOn(console, "error").mockImplementation(() => {});
  const failing = fakeClient({
    onState: vi.fn().mockRejectedValue(new Error("no events")),
    status: vi.fn().mockRejectedValue(new Error("no status")),
  });
  await mount(failing);
  expect(api.state).toEqual({ kind: "idle" });
  expect(errors).toHaveBeenCalledTimes(2);
  // An empty answer (not a state) leaves the idle state.
  await act(async () => root.unmount());
  root = createRoot(node);
  await mount(fakeClient());
  expect(api.state).toEqual({ kind: "idle" });
});

it("checks 5 seconds after start and every 6 hours, silently, and stops when unmounted", async () => {
  vi.useFakeTimers();
  const client = fakeClient({ check: vi.fn().mockRejectedValue("Há outra etapa em andamento.") });
  await mount(client, { automatic: true });
  await act(async () => vi.advanceTimersByTimeAsync(FIRST_CHECK_MS - 1));
  expect(client.check).not.toHaveBeenCalled();
  await act(async () => vi.advanceTimersByTimeAsync(1));
  expect(client.check).toHaveBeenCalledTimes(1);
  await act(async () => vi.advanceTimersByTimeAsync(CHECK_EVERY_MS));
  expect(client.check).toHaveBeenCalledTimes(2);
  expect(notify.error).not.toHaveBeenCalled();
  await act(async () => root.unmount());
  await vi.advanceTimersByTimeAsync(CHECK_EVERY_MS * 2);
  expect(client.check).toHaveBeenCalledTimes(2);
  root = createRoot(node);
});

it("waits to be asked when it is not automatic", async () => {
  vi.useFakeTimers();
  const client = fakeClient();
  await mount(client, { automatic: false });
  await act(async () => vi.advanceTimersByTimeAsync(CHECK_EVERY_MS));
  expect(client.check).not.toHaveBeenCalled();
  await send(client, available());
  expect(client.download).not.toHaveBeenCalled();
});

it("downloads an announced update once per version, without reporting failures", async () => {
  const client = fakeClient({ download: vi.fn().mockRejectedValue("falhou") });
  await mount(client, { automatic: true });
  await send(client, available("0.3.0"));
  await send(client, available("0.3.0"));
  expect(client.download).toHaveBeenCalledTimes(1);
  await send(client, available("0.3.1"));
  expect(client.download).toHaveBeenCalledTimes(2);
  expect(notify.error).not.toHaveBeenCalled();
});

it("shows the banner once a day for a downloaded update and again for a newer version", async () => {
  vi.useFakeTimers({ now: new Date(2026, 10, 13, 10, 0) });
  const client = fakeClient();
  await mount(client);
  expect(api.bannerVisible).toBe(false);
  await send(client, ready());
  expect(api.bannerVisible).toBe(true);
  expect(JSON.parse(localStorage.getItem(BANNER_STORAGE_KEY))).toEqual({
    version: "0.3.0",
    day: "2026-11-13",
  });
  // Closing it hides it, but not the update itself.
  await act(async () => api.dismissBanner());
  expect(api.bannerVisible).toBe(false);
  expect(api.state.kind).toBe("ready");
  // The same day, a restart does not show it again.
  await act(async () => root.unmount());
  root = createRoot(node);
  const again = fakeClient();
  await mount(again);
  await send(again, ready());
  expect(api.bannerVisible).toBe(false);
  // A newer version shows it at once.
  await send(again, ready("0.3.1"));
  expect(api.bannerVisible).toBe(true);
  // The next day it shows again.
  await act(async () => root.unmount());
  root = createRoot(node);
  vi.setSystemTime(new Date(2026, 10, 14, 9, 0));
  const tomorrow = fakeClient();
  await mount(tomorrow);
  await send(tomorrow, ready("0.3.1"));
  expect(api.bannerVisible).toBe(true);
});

it("shows the banner for an update that must be installed by hand, and hides it when the update goes away", async () => {
  const client = fakeClient();
  await mount(client);
  await send(client, {
    kind: "manual",
    version: "0.3.0",
    reason: "readOnlyLocation",
    url: RELEASES_URL,
    notes: null,
  });
  expect(api.bannerVisible).toBe(true);
  await send(client, { kind: "upToDate" });
  expect(api.bannerVisible).toBe(false);
});

it("shows the banner when the store of the schedule refuses to answer", async () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("blocked");
  });
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("blocked");
  });
  const client = fakeClient();
  await mount(client);
  await send(client, ready());
  expect(api.bannerVisible).toBe(true);
});

it("opens the confirmation only for a downloaded update and closes it when the update moves on", async () => {
  const client = fakeClient();
  await mount(client);
  await act(async () => api.openDialog());
  expect(api.dialogOpen).toBe(false);
  await send(client, ready());
  // Asking before it was ready must not pop up now.
  expect(api.dialogOpen).toBe(false);
  await act(async () => api.openDialog());
  expect(api.dialogOpen).toBe(true);
  await act(async () => api.closeDialog());
  expect(api.dialogOpen).toBe(false);
  await act(async () => api.openDialog());
  await send(client, { kind: "installing", version: "0.3.0", startedAt: 1 });
  expect(api.dialogOpen).toBe(false);
  await send(client, ready());
  expect(api.dialogOpen).toBe(false);
});

it("saves the project before installing, and installs only a downloaded update", async () => {
  const client = fakeClient();
  await mount(client);
  await act(async () => api.install());
  expect(client.install).not.toHaveBeenCalled();
  await send(client, ready());
  const order = [];
  const guard = vi.fn(async () => {
    order.push("saved");
    return true;
  });
  client.install.mockImplementation(async () => void order.push("installed"));
  await act(async () => api.setInstallGuard(guard));
  await act(async () => api.openDialog());
  await act(async () => api.install());
  expect(order).toEqual(["saved", "installed"]);
  expect(api.dialogOpen).toBe(false);
});

it("installs without a guard when no project is open", async () => {
  const client = fakeClient();
  await mount(client);
  await send(client, ready());
  await act(async () => api.install());
  expect(client.install).toHaveBeenCalledTimes(1);
});

it("does not install when the project cannot be saved", async () => {
  const client = fakeClient();
  await mount(client);
  await send(client, ready());
  await act(async () => api.setInstallGuard(async () => false));
  await act(async () => api.install());
  expect(client.install).not.toHaveBeenCalled();
  expect(notify.error).toHaveBeenCalledWith(
    "Não foi possível salvar o projeto",
    expect.objectContaining({ description: expect.stringContaining("não foi instalada") }),
  );
});

it("ignores a second click while the first installation is starting, and recovers from a failure", async () => {
  const client = fakeClient();
  await mount(client);
  await send(client, ready());
  let release;
  await act(async () => api.setInstallGuard(() => new Promise((done) => (release = done))));
  let first;
  await act(async () => {
    first = api.install();
    api.install();
  });
  await act(async () => {
    release(true);
    await first;
  });
  expect(client.install).toHaveBeenCalledTimes(1);
  // A refusal from the core is reported and does not block the next attempt.
  await act(async () => api.setInstallGuard(async () => true));
  client.install.mockRejectedValueOnce("Falha ao iniciar a instalação.");
  await act(async () => api.install());
  expect(notify.error).toHaveBeenCalledWith(
    "Não foi possível instalar a atualização",
    expect.objectContaining({ description: "Falha ao iniciar a instalação." }),
  );
  await act(async () => api.install());
  expect(client.install).toHaveBeenCalledTimes(3);
});

it("reports a failed or manual installation, but not the failures of background steps", async () => {
  const client = fakeClient();
  await mount(client);
  await send(client, { kind: "error", stage: "download", message: "Sem conexão." });
  expect(notify.error).not.toHaveBeenCalled();
  await send(client, { kind: "installing", version: "0.3.0", startedAt: 1 });
  await send(client, { kind: "error", stage: "install", message: "Disco cheio." });
  expect(notify.error).toHaveBeenCalledWith(
    "Não foi possível instalar a atualização",
    expect.objectContaining({ description: "Disco cheio." }),
  );
  await send(client, { kind: "installing", version: "0.3.0", startedAt: 2 });
  await send(client, {
    kind: "manual",
    version: "0.3.0",
    reason: "permissionDenied",
    url: RELEASES_URL,
    notes: null,
  });
  expect(notify.warning).toHaveBeenCalledWith(
    "Instale a atualização manualmente",
    expect.objectContaining({ description: expect.stringContaining("permissão") }),
  );
});

it("retries the step that failed", async () => {
  const client = fakeClient();
  await mount(client);
  await send(client, { kind: "error", stage: "check", message: "x" });
  await act(async () => api.retry());
  expect(client.check).toHaveBeenCalledTimes(1);
  expect(client.download).not.toHaveBeenCalled();
  await send(client, { kind: "error", stage: "download", message: "x" });
  await act(async () => api.retry());
  expect(client.download).toHaveBeenCalledTimes(1);
});

it("reports what the person asked for when the core refuses, and downloads by hand without repeating", async () => {
  const client = fakeClient({
    check: vi.fn().mockRejectedValue("a"),
    download: vi.fn().mockRejectedValue("b"),
    cancelDownload: vi.fn().mockRejectedValue("c"),
  });
  await mount(client, { automatic: true });
  await act(async () => api.check());
  await act(async () => api.download());
  await act(async () => api.cancelDownload());
  expect(notify.error.mock.calls.map(([title]) => title)).toEqual([
    "Não foi possível procurar atualizações",
    "Não foi possível baixar a atualização",
    "Não foi possível cancelar o download",
  ]);
  // A download started by hand is not started again automatically for the same version.
  const quiet = fakeClient();
  await act(async () => root.unmount());
  root = createRoot(node);
  await mount(quiet, { automatic: true });
  await send(quiet, available());
  expect(quiet.download).toHaveBeenCalledTimes(1);
  await act(async () => api.download());
  expect(quiet.download).toHaveBeenCalledTimes(2);
  await send(quiet, available());
  expect(quiet.download).toHaveBeenCalledTimes(2);
});

it("opens the releases page in the browser, and reports when it cannot", async () => {
  const client = fakeClient();
  await mount(client);
  await act(async () => api.openReleases());
  expect(bridge.openUrl).toHaveBeenCalledWith(RELEASES_URL);
  bridge.openUrl.mockRejectedValueOnce(new Error("denied"));
  await act(async () => api.openReleases());
  expect(notify.error).toHaveBeenCalledWith(
    "Não foi possível abrir o navegador",
    expect.objectContaining({ description: "Tente novamente." }),
  );
  bridge.isTauri.mockReturnValue(false);
  const open = vi.spyOn(window, "open").mockReturnValue(null);
  await act(async () => api.openReleases());
  expect(open).toHaveBeenCalledWith(RELEASES_URL, "_blank", "noopener,noreferrer");
});

it("starts with the notes embedded in the build", async () => {
  await mount(fakeClient());
  expect(api.changelog.map((item) => item.version)).toEqual(["0.2.4", "0.2.3"]);
});

it("adds the notes announced with the update, once per version", async () => {
  const client = fakeClient({ changelog: vi.fn().mockResolvedValue(rawChangelog()) });
  await mount(client);
  await send(client, available("0.3.0"));
  expect(client.changelog).toHaveBeenCalledTimes(1);
  expect(api.changelog.map((item) => item.version)).toEqual(["0.3.0", "0.2.4", "0.2.3"]);
  // The same version going on (downloading, ready) does not ask again.
  await send(client, ready("0.3.0"));
  await send(client, { kind: "downloading", version: "0.3.0", downloaded: 1, total: 2 });
  expect(client.changelog).toHaveBeenCalledTimes(1);
  // A newer update asks again.
  await send(client, ready("0.3.1"));
  expect(client.changelog).toHaveBeenCalledTimes(2);
  // An update to install by hand carries notes too.
  await send(client, {
    kind: "manual",
    version: "0.3.2",
    reason: "installFailed",
    url: RELEASES_URL,
    notes: null,
  });
  expect(client.changelog).toHaveBeenCalledTimes(3);
});

it("ignores announced notes that cannot be trusted, and a request that fails", async () => {
  const client = fakeClient({ changelog: vi.fn().mockResolvedValue({ schema: 9, versions: "x" }) });
  await mount(client);
  await send(client, available("0.3.0"));
  expect(api.changelog.map((item) => item.version)).toEqual(["0.2.4", "0.2.3"]);
  const failing = fakeClient({ changelog: vi.fn().mockRejectedValue("falhou") });
  await act(async () => root.unmount());
  root = createRoot(node);
  await mount(failing);
  await send(failing, available("0.3.0"));
  expect(api.changelog.map((item) => item.version)).toEqual(["0.2.4", "0.2.3"]);
  expect(notify.error).not.toHaveBeenCalled();
});
