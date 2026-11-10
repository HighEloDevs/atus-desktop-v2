import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

let server;
before(async () => {
  server = await createServer({
    configFile: false,
    esbuild: { jsx: "automatic" },
    optimizeDeps: { noDiscovery: true },
    server: { middlewareMode: true, watch: null },
    appType: "custom",
  });
});
after(async () => server?.close());

test("quick access offers two described actions and only advertises the implemented shortcut", async () => {
  const { ProjectQuickActions } = await server.ssrLoadModule(
    "/src/features/projects/ProjectQuickActions.tsx",
  );
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
  const { ProjectFilePath } = await server.ssrLoadModule(
    "/src/features/projects/ProjectFilePath.tsx",
  );
  for (const path of [
    "/Users/test/Experimentos/Queda livre.atus",
    "C:\\Projetos\\Queda livre.atus",
  ]) {
    const html = renderToStaticMarkup(createElement(ProjectFilePath, { path }));
    assert.ok(html.includes(`>${path}</span>`), html);
  }
});
