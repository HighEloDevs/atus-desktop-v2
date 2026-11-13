/** The home project UI follows the brand palette: cobalt is reserved for analysis and series. */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

const directory = join(process.cwd(), "src/features/projects");
const files = readdirSync(directory).filter((name) => name.endsWith(".tsx"));

it("does not use the cobalt accent or loose hex colors in project components", () => {
  expect(files.length).toBeGreaterThan(0);
  for (const name of files) {
    const source = readFileSync(join(directory, name), "utf8");
    // Focus rings (focus-visible:*) keep the shared focus color; nothing else may use it.
    expect(source, name).not.toMatch(/(?<!focus-visible:)\b(?:text|bg|border)-ring\b/);
    expect(source, name).not.toMatch(/#[0-9a-fA-F]{6}\b/);
  }
});
