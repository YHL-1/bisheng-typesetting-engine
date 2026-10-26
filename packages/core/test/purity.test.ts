import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const srcDir = fileURLToPath(new URL("../src/", import.meta.url));

const forbidden: ReadonlyArray<readonly [name: string, pattern: RegExp]> = [
  ["document", /\bdocument\b/],
  ["window", /\bwindow\b/],
  ["HTMLCanvasElement", /\bHTMLCanvasElement\b/],
  ["OffscreenCanvas", /\bOffscreenCanvas\b/],
  ["measureText", /\bmeasureText\s*\(/],
  ["requestAnimationFrame", /\brequestAnimationFrame\b/],
  ["navigator", /\bnavigator\b/],
  ["localStorage", /\blocalStorage\b/],
];

describe("core stays DOM-free", () => {
  const files = readdirSync(srcDir).filter((file) => file.endsWith(".ts"));

  it("has source files to scan", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const file of files) {
    it(`${file} uses no browser API`, () => {
      const source = readFileSync(join(srcDir, file), "utf8");
      for (const [name, pattern] of forbidden) {
        expect(source, `${file} must not use ${name}`).not.toMatch(pattern);
      }
    });
  }
});
