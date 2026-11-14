// @vitest-environment jsdom
/** Update context: the inert default and the install guard hook. */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import {
  INERT_UPDATE,
  UpdateContext,
  useBeforeUpdateInstall,
  useUpdate,
} from "../../src/features/updates/update-context";

let root;
let node;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  node = document.createElement("div");
  document.body.append(node);
  root = createRoot(node);
});
afterEach(async () => {
  await act(async () => root.unmount());
  node.remove();
});

it("is inert without a provider: nothing is offered and every action does nothing", async () => {
  let api;
  function Probe() {
    api = useUpdate();
    return null;
  }
  await act(async () => root.render(createElement(Probe)));
  expect(api).toBe(INERT_UPDATE);
  expect(api.state).toEqual({ kind: "idle" });
  expect(api.bannerVisible).toBe(false);
  expect(api.dialogOpen).toBe(false);
  for (const action of [
    "check",
    "retry",
    "download",
    "cancelDownload",
    "install",
    "openReleases",
  ]) {
    await expect(api[action]()).resolves.toBeUndefined();
  }
  expect(() => {
    api.dismissBanner();
    api.openDialog();
    api.closeDialog();
    api.setInstallGuard(null);
  }).not.toThrow();
});

it("registers the latest guard while mounted and removes it on unmount", async () => {
  const setInstallGuard = vi.fn();
  const first = vi.fn().mockResolvedValue(true);
  const second = vi.fn().mockResolvedValue(false);
  function Probe({ guard }) {
    useBeforeUpdateInstall(guard);
    return null;
  }
  const render = (guard) =>
    act(async () =>
      root.render(
        createElement(
          UpdateContext.Provider,
          { value: { ...INERT_UPDATE, setInstallGuard } },
          createElement(Probe, { guard }),
        ),
      ),
    );
  await render(first);
  expect(setInstallGuard).toHaveBeenCalledTimes(1);
  const registered = setInstallGuard.mock.calls[0][0];
  await expect(registered()).resolves.toBe(true);
  // A new guard is picked up without registering again.
  await render(second);
  expect(setInstallGuard).toHaveBeenCalledTimes(1);
  await expect(registered()).resolves.toBe(false);
  expect(first).toHaveBeenCalledTimes(1);
  await act(async () => root.unmount());
  expect(setInstallGuard).toHaveBeenLastCalledWith(null);
  root = createRoot(node);
});
