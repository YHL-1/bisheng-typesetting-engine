import { describe, expect, it } from "vitest";
import { DEFAULT_LAYOUT_OPTIONS, SERIF_STACK, createLayoutOptions } from "../src/defaults";

describe("layout defaults", () => {
  it("matches the workbench's initial settings", () => {
    expect(DEFAULT_LAYOUT_OPTIONS.width).toBe(592);
    expect(DEFAULT_LAYOUT_OPTIONS.fontSize).toBe(16);
    expect(DEFAULT_LAYOUT_OPTIONS.lineHeight).toBe(1.9);
    expect(DEFAULT_LAYOUT_OPTIONS.indent).toBe(32);
    expect(DEFAULT_LAYOUT_OPTIONS.align).toBe("justify");
    expect(DEFAULT_LAYOUT_OPTIONS.fontFamily).toBe(SERIF_STACK);
  });

  it("creates a fresh object and applies overrides", () => {
    const opts = createLayoutOptions({ width: 800, align: "left" });
    expect(opts.width).toBe(800);
    expect(opts.align).toBe("left");
    expect(opts.fontSize).toBe(16);
    expect(opts).not.toBe(DEFAULT_LAYOUT_OPTIONS);
  });

  it("does not mutate the frozen defaults", () => {
    createLayoutOptions({ width: 1200 });
    expect(DEFAULT_LAYOUT_OPTIONS.width).toBe(592);
  });
});
