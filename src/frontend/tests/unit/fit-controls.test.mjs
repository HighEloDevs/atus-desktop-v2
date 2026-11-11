// @vitest-environment jsdom
/** Behavioral checks for the simulated fit configuration editor. */
import { afterEach, beforeEach, expect, it } from "vitest";
import { act, createElement, useState } from "react";
import { createRoot } from "react-dom/client";
import { FitControls } from "../../src/features/analysis/fit/FitControls";
import { defaultFitConfig } from "../../src/features/analysis/fit/fit-config";

let root;
let node;
let config;

function Harness({ initial = {} }) {
  const [current, setCurrent] = useState({ ...defaultFitConfig, ...initial });
  config = current;
  return createElement(FitControls, {
    name: "Ensaio",
    config: current,
    onChange: (changes) => setCurrent((previous) => ({ ...previous, ...changes })),
  });
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  node = document.createElement("div");
  document.body.appendChild(node);
  root = createRoot(node);
});

afterEach(async () => {
  await act(async () => root.unmount());
  node.remove();
});

async function render(initial) {
  await act(async () => root.render(createElement(Harness, { initial })));
}

async function setInput(label, value) {
  const input = node.querySelector(`input[aria-label="${label}"]`);
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
  await act(async () => {
    set.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

it("starts with a faint preview and no fit options until an equation is provided", async () => {
  await render();
  expect(
    node.querySelector('[aria-label="Pré-visualização da equação em LaTeX"]').className,
  ).toContain("opacity-40");
  expect(node.textContent).not.toContain("Valores iniciais");
  await setInput("Função de ajuste de Ensaio", "a * x + b");
  expect(config.equation).toBe("a * x + b");
  expect(node.textContent).toContain("Valores iniciais");
  expect(node.textContent).toContain("padrão");
  expect(
    node.querySelector('[aria-label="Pré-visualização da equação em LaTeX"]').className,
  ).not.toContain("opacity-40");
});

it("exposes invalid parameter input accessibly and clears the error when corrected", async () => {
  await render({ equation: "a*x+b" });
  await setInput("Parâmetros de Ensaio", "a=foo");
  const input = node.querySelector('input[aria-label="Parâmetros de Ensaio"]');
  expect(input.getAttribute("aria-invalid")).toBe("true");
  expect(node.querySelector('[role="alert"]').textContent).toContain("Expressão inválida");
  expect(input.getAttribute("aria-describedby")).toBe(node.querySelector('[role="alert"]').id);
  await setInput("Parâmetros de Ensaio", "a=2; b=$1");
  expect(input.getAttribute("aria-invalid")).toBe("false");
  expect(node.querySelector('[role="alert"]')).toBeNull();
  expect(node.textContent).toContain("fixo");
  expect(node.textContent).toContain("livre");
});

it("updates uncertainty switches independently", async () => {
  await render({ equation: "a*x" });
  const switches = [...node.querySelectorAll('[role="switch"]')];
  expect(switches).toHaveLength(2);
  expect(switches[0].getAttribute("aria-checked")).toBe("true");
  await act(async () => switches[0].click());
  expect(config.useSx).toBe(false);
  expect(config.useSy).toBe(true);
  expect(switches[0].textContent).toContain("Ignorada");
  await act(async () => switches[1].click());
  expect(config.useSy).toBe(false);
});

it("reports inverted X limits and removes the message after correction", async () => {
  await render({ equation: "a*x" });
  await setInput("Mínimo de X para Ensaio", "5");
  await setInput("Máximo de X para Ensaio", "2");
  expect(node.querySelector('[role="alert"]').textContent).toContain("intervalo em X");
  await setInput("Máximo de X para Ensaio", "7");
  expect(node.querySelector('[role="alert"]')).toBeNull();
});

it("reports an invalid model and allows clearing it without requesting a fit", async () => {
  await render({ equation: "sin(" });
  expect(node.querySelector('[role="alert"]').textContent).toContain("Função inválida");
  await setInput("Função de ajuste de Ensaio", "");
  expect(node.querySelector('[role="alert"]')).toBeNull();
  expect(node.querySelector('input[aria-label="Parâmetros de Ensaio"]')).toBeNull();
});
