/**
 * End-to-end test of the quick analysis, run against the real desktop application on each
 * platform. It follows the whole life of the feature in one application instance and ends by
 * quitting it, so the runner scripts run it after `smoke.e2e.mjs`.
 *
 * A WebDriver cannot press a system-wide shortcut or click the tray icon, so the tests drive the
 * same functions those entry points call through test-only commands (`quick_test_*`, only in the
 * `desktop-e2e` build). When the runner provides `ATUS_E2E_KEY_COMMAND`, one test also presses
 * the real shortcut with an operating system tool.
 */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile, readdir, realpath } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { before, test } from "node:test";
import { appIsAlive, native, nativeState, openSession, until, withWindow } from "./driver.mjs";

const run = promisify(execFile);
const SECOND = 1000;

const OHM = [
  "I (A)\tV (V)\tσV (V)",
  "0,10\t1,02\t0,05",
  "0,20\t2,05\t0,05",
  "0,30\t2,98\t0,05",
  "0,40\t4,03\t0,05",
  "0,50\t5,01\t0,05",
  "0,60\t5,97\t0,05",
].join("\n");
const RC = ["0\t5,00", "1\t3,04", "2\t1,83", "3\t1,12"].join("\n");

const projectDir = await realpath(process.env.ATUS_DESKTOP_E2E_PROJECT_DIR);

/** Names of the project files in the isolated directory. */
async function projectFiles() {
  return (await readdir(projectDir)).filter((name) => name.endsWith(".atus")).sort();
}

/** Waits until exactly `count` more projects than `before` exist and returns the new path. */
async function newProject(before, count = 1) {
  const names = await until(async () => {
    const now = await projectFiles();
    return now.length === before.length + count ? now : null;
  }, `Expected ${count} new project(s) in ${projectDir}`);
  const added = names.filter((name) => !before.includes(name));
  assert.equal(added.length, count);
  return path.join(projectDir, added[0]);
}

/** Opens the project file through the native command and returns its first dataset. */
async function readDataset(file) {
  return withWindow("quick", async (quick) => {
    const { snapshot } = await quick.invoke("project_open", { path: file });
    return snapshot.analyses[0].datasets[0];
  });
}

/** Sets the clipboard, then shows the quick window the way the shortcut does. */
async function showQuick(clipboard) {
  if ((await nativeState()).quick_visible) {
    // The shortcut toggles: pressing it with the window up and focused would hide it.
    await native("quick_dismiss");
    await until(quickIsHidden, "The quick window did not hide");
  }
  if (clipboard !== undefined) await native("quick_test_set_clipboard", { text: clipboard });
  await native("quick_test_press_shortcut");
  await until(async () => (await nativeState()).quick_visible, "The quick window did not show");
}

async function quickIsHidden() {
  return !(await nativeState()).quick_visible;
}

/** Waits for the main window to exist, be visible and have loaded its page. */
async function mainWindow() {
  await until(async () => {
    const state = await nativeState();
    return state.main_exists && state.main_visible;
  }, "The main window did not show");
  return until(async () => {
    const window = await openSession("main");
    if (await window.exists('//button[contains(., "Nova análise")] | //aside')) return window;
    await window.close();
    return null;
  }, "The main window did not load");
}

before(async () => {
  // The smoke test leaves a project open; start from the home page, as after a fresh launch.
  await withWindow("main", async (main) => {
    if (await main.exists('//button[@aria-label="Voltar ao início"]')) {
      await main.click('//button[@aria-label="Voltar ao início"]');
    }
    await main.waitForText("Acesso rápido");
  });
});

test("starts with the quick window preloaded, the shortcut registered and the tray created", async () => {
  const state = await until(async () => {
    const current = await nativeState();
    return current.main_exists ? current : null;
  }, "The application did not start");
  assert.equal(state.quick_exists, true, "The quick window is created hidden at startup");
  assert.equal(state.quick_visible, false);
  assert.equal(state.main_exists, true);
  assert.equal(state.shortcut_registered, true, "The system refused the global shortcut");
  assert.equal(state.tray, true, "The tray icon was not created");
});

test(
  "the real global shortcut shows the quick window",
  { skip: process.env.ATUS_E2E_KEY_COMMAND ? false : "no key injection tool on this runner" },
  async () => {
    assert.equal(await quickIsHidden(), true);
    await run(process.env.ATUS_E2E_KEY_COMMAND, { shell: true, timeout: 20 * SECOND });
    await until(
      async () => (await nativeState()).quick_visible,
      "The operating system shortcut did not show the quick window",
      15 * SECOND,
    );
    await native("quick_dismiss");
    await until(quickIsHidden, "The quick window did not hide");
  },
);

test("the shortcut shows the quick window and fills the data from the clipboard", async () => {
  await showQuick(OHM);
  await withWindow("quick", async (quick) => {
    await until(async () => (await quick.rows()) === 6, "The pasted rows did not appear");
    const text = await quick.text();
    assert.match(text, /6 pontos/);
    assert.match(text, /do clipboard/);
    assert.match(text, /Função de ajuste\s*\(opcional\)/);
    assert.match(text, /Abrir no ATUS/, "Without a function the button opens the data only");
    assert.equal(
      await quick.run("return document.querySelectorAll('.quick-point circle').length"),
      6,
    );
    await quick.type("Função de ajuste", "R * x");
    await quick.waitForText("Parâmetros");
    assert.match(await quick.text(), /Ajustar no ATUS/);
    await quick.type("Função de ajuste", "");
  });
});

test("Esc hides the window, which keeps its data for the next time", async () => {
  await withWindow("quick", (quick) =>
    quick.run(
      "window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }))",
    ),
  );
  await until(quickIsHidden, "Esc did not hide the quick window");
  await showQuick();
  await withWindow("quick", async (quick) => {
    assert.equal(await quick.rows(), 6, "The data should survive hiding and showing the window");
  });
});

test("losing focus or closing the quick window only hides it", async () => {
  await showQuick();
  await native("quick_test_blur_quick");
  await until(quickIsHidden, "Losing focus should hide the quick window");
  await showQuick();
  await native("quick_test_close_quick");
  await until(quickIsHidden, "Closing should hide the quick window");
  const state = await nativeState();
  assert.equal(state.quick_exists, true, "Closing must not destroy the quick window");
  await showQuick();
  assert.equal(await withWindow("quick", (quick) => quick.rows()), 6);
  await native("quick_dismiss");
  await until(quickIsHidden, "The quick window did not hide");
});

test("the tray menu shows the quick window", async () => {
  await native("quick_test_tray_menu", { id: "quick" });
  await until(async () => (await nativeState()).quick_visible, "The tray item did not show it");
  await native("quick_test_tray_menu", { id: "unknown" });
  await native("quick_dismiss");
  await until(quickIsHidden, "The quick window did not hide");
});

test("pressing the shortcut again hides the window while it has the focus", async () => {
  await showQuick();
  if (!(await nativeState()).quick_focused) {
    // Some systems (a bare X11 session) never give the focus to a window under automation.
    await native("quick_dismiss");
    await until(quickIsHidden, "The quick window did not hide");
    return;
  }
  await native("quick_test_press_shortcut");
  await until(quickIsHidden, "The shortcut should toggle the focused window off");
});

test("the quick window comes back when it was destroyed", async () => {
  // Call from the main window: the quick window's own page dies in the middle of its call.
  await withWindow("main", (main) => main.invoke("quick_test_destroy_quick").catch(() => {}));
  await until(
    async () => !(await nativeState()).quick_exists,
    "The quick window was not destroyed",
  );
  assert.equal(await appIsAlive(), true);
  await native("quick_test_press_shortcut");
  await until(async () => {
    const state = await nativeState();
    return state.quick_exists && state.quick_visible;
  }, "The shortcut did not recreate the quick window");
  await withWindow("quick", (quick) => quick.waitForText("Análise rápida"));
  await native("quick_dismiss");
  await until(quickIsHidden, "The quick window did not hide");
});

test("data alone opens the main window in a new project without running a fit", async () => {
  const before = await projectFiles();
  await showQuick(OHM);
  await withWindow("quick", async (quick) => {
    await until(async () => (await quick.rows()) === 6, "The pasted rows did not appear");
    await quick.type("Função de ajuste", ""); // the window keeps the last equation
  });

  await withWindow("quick", (quick) => quick.clickButton("Abrir no ATUS"));
  await until(quickIsHidden, "Submitting should hide the quick window");
  const file = await newProject(before);
  const main = await mainWindow();
  try {
    await main.waitForText("Dados da análise rápida");
    await main.waitForText("Nenhum ajuste calculado");
    assert.equal(await main.exists('//*[contains(text(), "Ver detalhes")]'), false);
    assert.equal(
      await main.exists('//input[starts-with(@aria-label, "Função de ajuste")]/..'),
      true,
    );
  } finally {
    await main.close();
  }
  const dataset = await readDataset(file);
  assert.equal(dataset.name, "Dados da análise rápida");
  assert.equal(dataset.points.length, 6);
  assert.deepEqual(
    dataset.points.map(({ x, y, sy }) => [x, y, sy]),
    [
      [0.1, 1.02, 0.05],
      [0.2, 2.05, 0.05],
      [0.3, 2.98, 0.05],
      [0.4, 4.03, 0.05],
      [0.5, 5.01, 0.05],
      [0.6, 5.97, 0.05],
    ],
  );
  assert.equal(dataset.state.equation ?? "", "");
});

test("invalid data is explained and nothing is submitted", async () => {
  const before = await projectFiles();
  await showQuick("1;2;-1");
  await withWindow("quick", async (quick) => {
    await quick.clickButton("Colar do clipboard");
    await quick.waitForText("incertezas não podem ser negativas");
    await quick.type("Função de ajuste", "sin(");
    await quick.waitForText("Função inválida");
    await quick.clickButton("Ajustar no ATUS");
  });
  await new Promise((resolve) => setTimeout(resolve, SECOND));
  assert.equal((await nativeState()).quick_visible, true, "The window should stay open");
  assert.deepEqual(await projectFiles(), before);
  await withWindow("quick", async (quick) => {
    await quick.type("Função de ajuste", "");
    await quick.run("document.querySelector('[aria-label=\"Limpar dados\"]')?.click()");
  });
  await native("quick_dismiss");
  await until(quickIsHidden, "The quick window did not hide");
});

test("an open analysis asks before it is replaced and keeps working when declined", async () => {
  const before = await projectFiles();
  await showQuick(RC);
  await withWindow("quick", async (quick) => {
    await until(async () => (await quick.rows()) === 4, "The new data did not appear");
    await quick.type("Função de ajuste", "V0 * exp(-x / tau)");
    await quick.clickButton("Ajustar no ATUS");
  });
  const main = await mainWindow();
  try {
    await main.waitForText("Abrir a análise rápida?");
    await main.clickButton("Continuar aqui");
    await until(
      async () => !(await main.exists('//*[contains(text(), "Abrir a análise rápida?")]')),
      "The prompt should close",
    );
    assert.deepEqual(await projectFiles(), before, "Declining must not create a project");

    await showQuick(RC);
    await withWindow("quick", async (quick) => {
      await until(async () => (await quick.rows()) === 4, "The data did not appear");
      await quick.type("Função de ajuste", "V0 * exp(-x / tau)");
      await quick.clickButton("Ajustar no ATUS");
    });
    await main.waitForText("Abrir a análise rápida?");
    await main.clickButton("Abrir análise rápida");
    const file = await newProject(before);
    await main.waitForText("Resultados da análise");
    await main.waitForText("Ver detalhes");
    assert.equal(
      await main.run(
        "return document.querySelector('input[aria-label^=\"Função de ajuste\"]').value",
      ),
      "V0 * exp(-x / tau)",
    );
    const dataset = await until(async () => {
      const current = await readDataset(file);
      return current.state.equation ? current : null;
    }, "The equation was not saved in the new project");
    assert.equal(dataset.points.length, 4);
    assert.equal(dataset.state.equation, "V0 * exp(-x / tau)");
  } finally {
    await main.close();
  }
});

test("closing the main window keeps ATUS running and the shortcut opens a new window", async () => {
  await native("quick_test_close_main");
  await until(async () => !(await nativeState()).main_exists, "The main window did not close");
  assert.equal(await appIsAlive(), true, "The application must keep running in the background");
  const state = await nativeState();
  assert.equal(state.quick_exists, true);
  assert.equal(state.shortcut_registered, true);
  assert.equal(state.tray, true);

  const before = await projectFiles();
  await showQuick(OHM);
  await withWindow("quick", async (quick) => {
    await until(async () => (await quick.rows()) === 6, "The pasted rows did not appear");
    await quick.type("Função de ajuste", "a * x + b");
    await quick.clickButton("Ajustar no ATUS");
  });
  const file = await newProject(before);
  const main = await mainWindow();
  try {
    await main.waitForText("Resultados da análise");
    assert.equal(
      await main.run(
        "return document.querySelector('input[aria-label^=\"Função de ajuste\"]').value",
      ),
      "a * x + b",
    );
  } finally {
    await main.close();
  }
  assert.equal((await readDataset(file)).points.length, 6);
});

test("a second launch brings the main window back after it was closed", async () => {
  await native("quick_test_close_main");
  await until(async () => !(await nativeState()).main_exists, "The main window did not close");
  await native("quick_test_second_launch");
  const main = await mainWindow();
  await main.close();
});

test("the tray reopens the main window after it was closed", async () => {
  await native("quick_test_close_main");
  await until(async () => !(await nativeState()).main_exists, "The main window did not close");
  assert.equal(await appIsAlive(), true);
  await native("quick_test_tray_menu", { id: "open" });
  const main = await mainWindow();
  try {
    await main.waitForText("Nova análise");
  } finally {
    await main.close();
  }
});

test("project management commands work in the running application", async () => {
  const [file] = (await projectFiles()).map((name) => path.join(projectDir, name));
  assert.ok(file, "A project is needed");
  await withWindow("quick", async (quick) => {
    const [details] = await quick.invoke("project_details", { paths: [file] });
    assert.equal(details.available, true);
    assert.equal(details.archived, false);
    const renamed = await quick.invoke("project_rename", { path: file, newName: "Renomeado e2e" });
    assert.match(renamed, /Renomeado e2e\.atus$/);
    const archived = await quick.invoke("project_archive", { path: renamed });
    assert.match(archived, /archived/);
    assert.ok((await quick.invoke("project_list_archived")).includes(archived));
    const restored = await quick.invoke("project_unarchive", { path: archived });
    assert.match(restored, /Renomeado e2e\.atus$/);
    assert.equal((await quick.invoke("project_list_archived")).includes(archived), false);
  });
});

test("quitting saves the open project and ends the application", async () => {
  const before = await projectFiles();
  await showQuick(RC);
  await withWindow("quick", async (quick) => {
    await until(async () => (await quick.rows()) === 4, "The data did not appear");
    await quick.type("Função de ajuste", ""); // the window keeps the last equation
    await quick.clickButton("Abrir no ATUS");
  });
  const file = await newProject(before);
  const main = await mainWindow();
  try {
    await main.waitForText("Dados da análise rápida");
    await main.type("Função de ajuste de Dados da análise rápida", "k_quit * x");
  } finally {
    await main.close();
  }
  // Quit right after the edit: the debounced autosave may not have run yet.
  await native("quick_test_tray_menu", { id: "quit" });
  await until(async () => !(await appIsAlive()), "The application did not quit", 30 * SECOND);
  const siblings = (await readdir(projectDir)).filter((name) =>
    name.startsWith(path.basename(file)),
  );
  const bytes = await Promise.all(siblings.map((name) => readFile(path.join(projectDir, name))));
  assert.ok(
    bytes.some((content) => content.includes("k_quit * x")),
    "The edit made just before quitting should be in the project file",
  );
});
