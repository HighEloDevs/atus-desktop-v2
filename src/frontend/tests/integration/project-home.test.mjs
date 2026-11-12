import assert from "node:assert/strict";
import { test } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ProjectQuickActions } from "../../src/features/projects/ProjectQuickActions.tsx";
import { ProjectFilePath } from "../../src/features/projects/ProjectFilePath.tsx";
import { EmptyRecentProjects } from "../../src/features/projects/EmptyRecentProjects.tsx";

test("quick access offers two described actions and only advertises the implemented shortcut", async () => {
  for (const [isMac, shortcut] of [
    [true, "Meta+Alt+N"],
    [false, "Control+Alt+N"],
  ]) {
    const html = renderToStaticMarkup(
      createElement(ProjectQuickActions, { isMac, onCreate() {}, onOpen() {} }),
    );
    assert.match(html, /Acesso rápido/);
    assert.match(html, /Nova análise.*Crie um projeto/);
    assert.match(html, /Abrir projeto.*Selecione um arquivo \.atus/);
    assert.equal((html.match(/<svg\b/g) ?? []).length, 2);
    assert.deepEqual(
      [...html.matchAll(/aria-keyshortcuts="([^"]+)"/g)].map((match) => match[1]),
      [shortcut],
    );
  }
});

test("project path includes the filename and extension in the visible text", async () => {
  for (const path of [
    "/Users/test/Experimentos/Queda livre.atus",
    "C:\\Projetos\\Queda livre.atus",
  ]) {
    const html = renderToStaticMarkup(createElement(ProjectFilePath, { path }));
    assert.ok(html.includes(`>${path}</span>`), html);
  }
});

test("the empty state explains how projects appear without adding duplicate actions", async () => {
  const html = renderToStaticMarkup(createElement(EmptyRecentProjects));
  assert.match(html, /Nenhum projeto recente/);
  assert.match(html, /análises que você criar ou abrir aparecerão aqui/);
  assert.doesNotMatch(html, /<button\b|<a\b/);
});
