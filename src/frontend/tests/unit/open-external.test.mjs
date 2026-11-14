// @vitest-environment jsdom
/** Opening addresses: the desktop opener inside the app, a new tab in a browser. */
import { beforeEach, expect, it, vi } from "vitest";

const bridge = vi.hoisted(() => ({ isTauri: vi.fn(), openUrl: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ isTauri: bridge.isTauri }));
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: bridge.openUrl }));
import { openExternal } from "../../src/lib/open-external";

beforeEach(() => vi.clearAllMocks());

it("uses the opener plugin inside the desktop app and passes its refusal on", async () => {
  bridge.isTauri.mockReturnValue(true);
  bridge.openUrl.mockResolvedValue(undefined);
  await openExternal("https://youtu.be/dQw4w9WgXcQ");
  expect(bridge.openUrl).toHaveBeenCalledWith("https://youtu.be/dQw4w9WgXcQ");
  bridge.openUrl.mockRejectedValue(new Error("not allowed"));
  await expect(openExternal("https://example.com/")).rejects.toThrow("not allowed");
});

it("opens a new tab in a browser", async () => {
  bridge.isTauri.mockReturnValue(false);
  const open = vi.spyOn(window, "open").mockReturnValue(null);
  await openExternal("https://atusweb.com.br/");
  expect(open).toHaveBeenCalledWith("https://atusweb.com.br/", "_blank", "noopener,noreferrer");
  expect(bridge.openUrl).not.toHaveBeenCalled();
});
