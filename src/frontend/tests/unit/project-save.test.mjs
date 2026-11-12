// @vitest-environment jsdom
/** Behavior of serialized saves and protection against losing unsaved work. */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";

const api = vi.hoisted(() => ({
  isTauri: vi.fn(),
  invoke: vi.fn(),
  confirm: vi.fn(),
  close: vi.fn(),
  listen: vi.fn(),
  destroy: vi.fn(),
  chooseDestination: vi.fn(),
  rememberProject: vi.fn(),
  save: vi.fn(),
  saveAs: vi.fn(),
}));
vi.mock("@tauri-apps/api/core", () => ({ isTauri: api.isTauri, invoke: api.invoke }));
vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({
    onCloseRequested: api.close,
    destroy: api.destroy,
    listen: api.listen,
  }),
}));
vi.mock("@tauri-apps/plugin-dialog", () => ({ confirm: api.confirm }));
vi.mock("../../src/features/projects/project-client", () => ({
  chooseDestination: api.chooseDestination,
  rememberProject: api.rememberProject,
  projectClient: { save: api.save, saveAs: api.saveAs },
}));
import { useProjectSave } from "../../src/features/projects/useProjectSave";

const empty = "[]";
const first = JSON.stringify([{ id: "a", datasets: [] }]);
const second = JSON.stringify([{ id: "b", datasets: [] }]);
const project = {
  path: "/original.atus",
  snapshot: { id: "p", name: "Projeto", updated_at: "2020-01-01", analyses: [] },
};
let root;
let node;
let controls;

function Harness({ content }) {
  controls = useProjectSave(project, content);
  return createElement("span", null, `${controls.status}|${controls.error}`);
}

beforeEach(() => {
  vi.clearAllMocks();
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  api.isTauri.mockReturnValue(false);
  api.invoke.mockResolvedValue(undefined);
  api.listen.mockResolvedValue(() => {});
  Object.defineProperty(navigator, "platform", { value: "Linux", configurable: true });
  api.close.mockResolvedValue(() => {});
  api.save.mockResolvedValue(undefined);
  api.confirm.mockResolvedValue(false);
  node = document.createElement("div");
  document.body.appendChild(node);
  root = createRoot(node);
});

afterEach(async () => {
  await act(async () => root.unmount());
  node.remove();
});

async function render(content) {
  await act(async () => root.render(createElement(Harness, { content })));
}

it("saves modified content with the previous snapshot and then reports saved", async () => {
  await render(empty);
  await render(first);
  expect(controls.status).toBe("Alterações pendentes");
  await act(async () => expect(await controls.flush()).toBe(true));
  expect(api.save).toHaveBeenCalledWith(
    "/original.atus",
    project.snapshot,
    expect.objectContaining({ analyses: JSON.parse(first) }),
  );
  expect(controls.status).toBe("Salvo");
  await act(async () => expect(await controls.flush()).toBe(true));
  expect(api.save).toHaveBeenCalledTimes(1);
});

it("saves a copy with an extension and remembers the new path", async () => {
  await render(empty);
  await render(first);
  api.chooseDestination.mockResolvedValue("/copy");
  api.saveAs.mockImplementation(async (path, snapshot) => ({ path, snapshot }));
  await act(async () => controls.saveAs());
  expect(api.saveAs).toHaveBeenCalledWith(
    "/copy.atus",
    expect.objectContaining({ analyses: JSON.parse(first) }),
  );
  expect(api.rememberProject).toHaveBeenCalledWith("/copy.atus");
  expect(controls.project.path).toBe("/copy.atus");
  expect(controls.status).toBe("Salvo");
});

it("does not discard pending changes on save failure unless the user confirms", async () => {
  await render(empty);
  await render(first);
  api.save.mockRejectedValue(new Error("disk full"));
  await act(async () => expect(await controls.canLeave()).toBe(false));
  expect(controls.status).toBe("Falha ao salvar");
  expect(controls.error).toContain("disk full");
  expect(api.confirm).toHaveBeenCalledOnce();
  api.confirm.mockResolvedValueOnce(true);
  await act(async () => expect(await controls.canLeave()).toBe(true));
});

it("flushes changes made while a previous save was in flight", async () => {
  let finish;
  api.save.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  await render(empty);
  await render(first);
  let flushing;
  await act(async () => {
    flushing = controls.flush();
    await Promise.resolve();
  });
  await render(second);
  await act(async () => {
    finish();
    await flushing;
  });
  expect(api.save).toHaveBeenCalledTimes(2);
  expect(api.save.mock.calls[1][2].analyses).toEqual(JSON.parse(second));
  expect(controls.status).toBe("Salvo");
});

it("cancels save as without touching the existing project", async () => {
  await render(empty);
  api.chooseDestination.mockResolvedValue(null);
  await act(async () => controls.saveAs());
  expect(api.saveAs).not.toHaveBeenCalled();
  expect(controls.project.path).toBe("/original.atus");
});

it("autosaves after the debounce and skips superseded changes", async () => {
  vi.useFakeTimers();
  try {
    await render(empty);
    await render(first);
    await act(async () => vi.advanceTimersByTimeAsync(300));
    await render(second);
    await act(async () => vi.advanceTimersByTimeAsync(499));
    expect(api.save).not.toHaveBeenCalled();
    await act(async () => vi.advanceTimersByTimeAsync(1));
    expect(api.save).toHaveBeenCalledTimes(1);
    expect(api.save.mock.calls[0][2].analyses).toEqual(JSON.parse(second));
  } finally {
    vi.useRealTimers();
  }
});

it("prevents leaving while the save-as selector is open", async () => {
  let finish;
  api.chooseDestination.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  await render(empty);
  let saving;
  await act(async () => {
    saving = controls.saveAs();
    await Promise.resolve();
  });
  await act(async () => expect(await controls.canLeave()).toBe(false));
  expect(api.confirm).not.toHaveBeenCalled();
  await act(async () => {
    finish(null);
    await saving;
  });
});

it("keeps changes if the confirmation dialog itself fails", async () => {
  await render(empty);
  await render(first);
  api.save.mockRejectedValue(new Error("disk full"));
  api.confirm.mockRejectedValue(new Error("dialog unavailable"));
  await act(async () => expect(await controls.canLeave()).toBe(false));
  expect(controls.error).toContain("dialog unavailable");
});

it("saves pending changes before allowing the desktop window to close", async () => {
  await render(empty);
  await render(first);
  const closeHandler = api.close.mock.calls[0][0];
  const event = { preventDefault: vi.fn() };
  await act(async () => closeHandler(event));
  expect(event.preventDefault).toHaveBeenCalledOnce();
  expect(api.save).toHaveBeenCalledOnce();
  expect(api.destroy).toHaveBeenCalledOnce();
});

it("connects the macOS menu to save and unregisters it on unmount", async () => {
  Object.defineProperty(navigator, "platform", { value: "MacIntel", configurable: true });
  api.isTauri.mockReturnValue(true);
  await render(empty);
  await render(first);
  expect(api.listen).toHaveBeenCalledWith("project-menu-action", expect.any(Function));
  expect(api.invoke).toHaveBeenCalledWith("project_menu_enabled", { enabled: true });
  const callback = api.listen.mock.calls[0][1];
  await act(async () => callback({ payload: "save" }));
  expect(api.save).toHaveBeenCalledOnce();
  await act(async () => root.unmount());
  expect(api.invoke).toHaveBeenCalledWith("project_menu_enabled", { enabled: false });
  root = createRoot(node);
});

it("reports an error opening the save-as dialog and leaves the project intact", async () => {
  await render(empty);
  api.chooseDestination.mockRejectedValue(new Error("dialog unavailable"));
  await act(async () => controls.saveAs());
  expect(controls.error).toContain("dialog unavailable");
  expect(controls.project.path).toBe("/original.atus");
  expect(api.saveAs).not.toHaveBeenCalled();
});

it("retains the requested .atus extension without duplicating it", async () => {
  await render(empty);
  api.chooseDestination.mockResolvedValue("/backup.ATUS");
  api.saveAs.mockImplementation(async (path, snapshot) => ({ path, snapshot }));
  await act(async () => controls.saveAs());
  expect(api.saveAs).toHaveBeenCalledWith("/backup.ATUS", expect.any(Object));
});
