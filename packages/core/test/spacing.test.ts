import { describe, expect, it } from "vitest";
import { createLayoutOptions } from "../src/defaults";
import { layout } from "../src/layout";
import { createFixedMetrics } from "../src/metrics";
import type { LayoutOptions } from "../src/types";

const metrics = createFixedMetrics(16);

function opts(overrides: Partial<LayoutOptions> = {}): LayoutOptions {
  return createLayoutOptions({
    width: 200,
    fontSize: 16,
    lineHeight: 1.9,
    letterSpacing: 0,
    indent: 0,
    kinsoku: "strict",
    ...overrides,
  });
}

describe("layout: punctuation squeeze", () => {
  it("makes the pair 。」 about one em wide", () => {
    const result = layout("。」", opts({ width: 100, squeeze: true, autospace: false }), metrics);
    const line = result.lines[0]!;

    expect(line.glyphs.map((glyph) => glyph.w)).toEqual([8, 8]);
    expect(line.width).toBe(16);
    expect(line.glyphs.every((glyph) => glyph.squeezed)).toBe(true);
  });

  it("is twice as wide when squeeze is off", () => {
    const result = layout("。」", opts({ width: 100, squeeze: false, autospace: false }), metrics);
    const line = result.lines[0]!;

    expect(line.glyphs.map((glyph) => glyph.w)).toEqual([16, 16]);
    expect(line.width).toBe(32);
  });

  it("keeps line count stable while changing line width", () => {
    const text = "中文。」中文中文中文";
    const on = layout(text, opts({ width: 160, squeeze: true, autospace: false }), metrics);
    const off = layout(text, opts({ width: 160, squeeze: false, autospace: false }), metrics);

    // The manual's order is break first, then squeeze. A squeeze toggle must
    // not move breakpoints or the layout oscillates.
    expect(on.lines.length).toBe(off.lines.length);
    expect(on.lines[0]!.width).toBeLessThan(off.lines[0]!.width);
    expect(on.lines[0]!.slack).toBeGreaterThan(off.lines[0]!.slack);
  });

  it("squeezes an opening bracket at line start", () => {
    const result = layout("（中文", opts({ width: 100, squeeze: true, autospace: false }), metrics);
    const first = result.lines[0]!.glyphs[0]!;

    expect(first.ch).toBe("（");
    expect(first.w).toBe(8);
    expect(first.squeezed).toBe(true);
  });

  it("squeezes a closing punctuation at line end", () => {
    const result = layout("中文。", opts({ width: 100, squeeze: true, autospace: false }), metrics);
    const glyphs = result.lines[0]!.glyphs;

    expect(glyphs[glyphs.length - 1]!.ch).toBe("。");
    expect(glyphs[glyphs.length - 1]!.w).toBe(8);
    expect(glyphs[glyphs.length - 1]!.squeezed).toBe(true);
  });
});

describe("layout: CJK / Latin autospace", () => {
  it("adds 0.25em on both sides of a Latin run", () => {
    const text = "中文ABC123中文";
    const on = layout(text, opts({ width: 200, squeeze: false, autospace: true }), metrics);
    const off = layout(text, opts({ width: 200, squeeze: false, autospace: false }), metrics);

    expect(on.lines.length).toBe(1);
    expect(off.lines.length).toBe(1);
    expect(on.lines[0]!.width - off.lines[0]!.width).toBeCloseTo(8, 9);

    const glyphs = on.lines[0]!.glyphs;
    expect(glyphs.find((glyph) => glyph.ch === "文")!.w).toBe(20);
    expect(glyphs.find((glyph) => glyph.ch === "3")!.w).toBe(20);
  });

  it("uses the extra space in the fit decision", () => {
    const text = "中文ABC123中文";
    const off = layout(text, opts({ width: 160, squeeze: false, autospace: false }), metrics);
    const on = layout(text, opts({ width: 160, squeeze: false, autospace: true }), metrics);

    expect(off.lines.length).toBe(1);
    expect(on.lines.length).toBe(2);
    for (const line of on.lines) {
      expect(line.width).toBeLessThanOrEqual(160);
    }
  });

  it("does not add space around punctuation", () => {
    const result = layout("中文，ABC", opts({ width: 200, squeeze: false, autospace: true }), metrics);

    expect(result.lines[0]!.width).toBe(96);
  });
});
