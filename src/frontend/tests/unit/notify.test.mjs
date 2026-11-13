// @vitest-environment jsdom
/** Global snackbar facade: durations, ids, persistence, timer bar, actions and accessibility roles. */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";

const sonner = vi.hoisted(() => ({
  custom: vi.fn((render, options) => options.id),
  dismiss: vi.fn(),
  Toaster: vi.fn(() => null),
}));
vi.mock("sonner", () => ({ toast: sonner, Toaster: sonner.Toaster }));
import { DEFAULT_DURATION_MS, notify } from "../../src/lib/notify";
import { AppToaster } from "../../src/components/ui/sonner";

let root;
let node;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  node = document.createElement("div");
  document.body.appendChild(node);
  root = createRoot(node);
});
afterEach(async () => {
  await act(async () => root.unmount());
  node.remove();
});

/** Renders the body of the last snackbar raised through the mocked Sonner. */
async function renderLast() {
  const [render] = sonner.custom.mock.lastCall;
  await act(async () => root.render(render("toast-id")));
}

it.each(["success", "info", "warning", "error"])(
  "uses the default lifetime of a %s snackbar",
  (kind) => {
    notify[kind]("Título");
    expect(sonner.custom.mock.lastCall[1].duration).toBe(DEFAULT_DURATION_MS[kind]);
  },
);

it("keeps errors on screen longer than successes", () => {
  expect(DEFAULT_DURATION_MS.error).toBeGreaterThan(DEFAULT_DURATION_MS.success);
});

it("returns the given id so a later call updates the same snackbar", () => {
  expect(notify.loading("Ajustando…", { id: "fit" })).toBe("fit");
  notify.success("Ajuste concluído", { id: "fit" });
  expect(sonner.custom.mock.calls.map(([, options]) => options.id)).toEqual(["fit", "fit"]);
});

it("renders an error with role alert, description, close button and a timer bar", async () => {
  notify.error("Arquivo grande", { description: "O limite é 1 MB." });
  await renderLast();
  const alert = node.querySelector('[role="alert"]');
  expect(alert.textContent).toContain("Arquivo grande");
  expect(alert.textContent).toContain("O limite é 1 MB.");
  const bar = node.querySelector('[data-testid="toast-timer"]');
  expect(bar.getAttribute("aria-hidden")).toBe("true");
  expect(bar.style.getPropertyValue("--toast-duration")).toBe(`${DEFAULT_DURATION_MS.error}ms`);
  expect(bar.textContent).toBe("");
  await act(async () => node.querySelector('button[aria-label="Fechar alerta"]').click());
  expect(sonner.dismiss).toHaveBeenCalledWith("toast-id");
});

it("renders non-error kinds with role status", async () => {
  notify.success("Salvo");
  await renderLast();
  expect(node.querySelector('[role="status"]')).not.toBeNull();
  expect(node.querySelector('[role="alert"]')).toBeNull();
});

it("shows no timer bar for persistent, loading or progress-disabled snackbars", async () => {
  for (const call of [
    () => notify.warning("A", { duration: 0 }),
    () => notify.loading("B"),
    () => notify.info("C", { progress: false }),
  ]) {
    call();
    await renderLast();
    expect(node.querySelector('[data-testid="toast-timer"]')).toBeNull();
  }
  expect(sonner.custom.mock.calls[0][1].duration).toBe(Infinity);
  expect(sonner.custom.mock.calls[1][1].duration).toBe(Infinity);
});

it("runs an action, closes the snackbar and honours noClose", async () => {
  const undo = vi.fn();
  notify.info("Substituído", { actions: [{ label: "Desfazer", onClick: undo }], noClose: true });
  await renderLast();
  expect(node.querySelector('button[aria-label="Fechar alerta"]')).toBeNull();
  await act(async () => [...node.querySelectorAll("button")][0].click());
  expect(undo).toHaveBeenCalled();
  expect(sonner.dismiss).toHaveBeenCalledWith("toast-id");
});

it("applies the tinted variant", async () => {
  notify.warning("Aviso", { variant: "tinted" });
  await renderLast();
  expect(node.querySelector("[data-variant]").dataset.variant).toBe("tinted");
});

it("dismisses one snackbar or all of them", () => {
  notify.dismiss("a");
  notify.dismiss();
  expect(sonner.dismiss.mock.calls).toEqual([["a"], [undefined]]);
});

it("configures Sonner for list, stack and banner modes", async () => {
  const props = async (p) => {
    await act(async () => root.render(createElement(AppToaster, p)));
    return sonner.Toaster.mock.lastCall[0];
  };
  expect(await props({})).toMatchObject({ position: "bottom-right", expand: true });
  expect(await props({ mode: "stack", position: "top-left" })).toMatchObject({
    position: "top-left",
    expand: false,
  });
  expect(await props({ mode: "banner", position: "top-right" })).toMatchObject({
    position: "top-center",
    visibleToasts: 1,
  });
  expect(await props({ mode: "banner", position: "bottom-left" })).toMatchObject({
    position: "bottom-center",
  });
});

it("keeps the timer bar animating under reduced motion", async () => {
  const { readFileSync } = await import("node:fs");
  const css = readFileSync(`${process.cwd()}/src/styles/globals.css`, "utf8");
  const reduced = css.slice(css.lastIndexOf("prefers-reduced-motion"));
  expect(reduced).toContain(".toast-timer");
  expect(reduced).not.toMatch(/animation:\s*none/);
  expect(reduced).toContain("steps(");
});
