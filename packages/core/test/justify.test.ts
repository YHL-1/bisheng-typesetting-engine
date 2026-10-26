import { describe, expect, it } from "vitest";
import { createLayoutOptions } from "../src/defaults";
import { justifyLine } from "../src/justify";
import { layout, measureLayout } from "../src/layout";
import { createFixedMetrics } from "../src/metrics";
import type { LayoutOptions, Line } from "../src/types";

const metrics = createFixedMetrics(16);

function opts(overrides: Partial<LayoutOptions> = {}): LayoutOptions {
  return createLayoutOptions({
    width: 200,
    fontSize: 16,
    lineHeight: 1.9,
    letterSpacing: 0,
    indent: 0,
    autospace: false,
    squeeze: false,
    align: "justify",
    ...overrides,
  });
}

function rightEdge(line: Line): number {
  const last = line.glyphs[line.glyphs.length - 1];
  return last === undefined ? 0 : last.x + last.w;
}

describe("justifyLine", () => {
  it("fills the target width on a justified line", () => {
    const text = "中".repeat(20);
    const left = layout(text, opts({ align: "left" }), metrics);
    const justified = layout(text, opts({ align: "justify" }), metrics);

    expect(rightEdge(left.lines[0]!)).toBe(192);
    expect(rightEdge(justified.lines[0]!)).toBeCloseTo(200, 9);
    expect(justified.lines[0]!.width).toBe(left.lines[0]!.width);
    expect(justified.lines[0]!.slack).toBe(left.lines[0]!.slack);
  });

  it("does not justify the last line of a paragraph", () => {
    const text = "中".repeat(20);
    const left = layout(text, opts({ align: "left" }), metrics);
    const justified = layout(text, opts({ align: "justify" }), metrics);

    expect(justified.lines[1]!.glyphs.map((glyph) => glyph.x)).toEqual(
      left.lines[1]!.glyphs.map((glyph) => glyph.x),
    );
    expect(rightEdge(justified.lines[1]!)).toBe(128);
  });

  it("centres a line, including the last one", () => {
    const text = "中".repeat(10);
    const result = layout(text, opts({ align: "center" }), metrics);
    const line = result.lines[0]!;

    expect(line.glyphs[0]!.x).toBe(20);
    expect(rightEdge(line)).toBe(180);
    expect(line.width).toBe(160);
    expect(line.slack).toBe(40);
  });

  it("keeps the first-line indent when justifying", () => {
    const text = "中".repeat(20);
    const result = layout(text, opts({ align: "justify", indent: 32 }), metrics);
    const first = result.lines[0]!;

    expect(first.glyphs[0]!.x).toBe(32);
    expect(rightEdge(first)).toBeCloseTo(200, 9);
  });

  it("falls back to left when the gaps would exceed half an em", () => {
    const line: Line = {
      glyphs: [
        { ch: "中", x: 0, y: 21.28, w: 16, squeezed: false },
        { ch: "文", x: 16, y: 21.28, w: 16, squeezed: false },
      ],
      width: 32,
      slack: 168,
      y: 21.28,
      start: 0,
      end: 2,
    };

    const outcome = justifyLine(line, opts(), false);

    expect(outcome).toEqual({ applied: false, fallback: "gap" });
    expect(line.glyphs.map((glyph) => glyph.x)).toEqual([0, 16]);
  });

  it("leaves a single glyph alone", () => {
    const result = layout("中", opts({ width: 100 }), metrics);
    expect(result.lines[0]!.glyphs[0]!.x).toBe(0);
  });

  it("never stretches the inside of a Latin word", () => {
    const characters = ["中", "h", "e", "l", "l", "o", "中"];
    const line: Line = {
      glyphs: characters.map((ch, index) => ({
        ch,
        x: index * 16,
        y: 21.28,
        w: 16,
        squeezed: false,
      })),
      width: 112,
      slack: 8,
      y: 21.28,
      start: 0,
      end: 7,
    };

    const outcome = justifyLine(line, opts({ width: 120 }), false);

    expect(outcome).toEqual({ applied: true });
    // 中→h and o→中 are stretchable; h→e is not.
    expect(line.glyphs[1]!.x - line.glyphs[0]!.x).toBe(20);
    expect(line.glyphs[2]!.x - line.glyphs[1]!.x).toBe(16);
    expect(line.glyphs[6]!.x - line.glyphs[5]!.x).toBe(20);
    expect(line.glyphs[6]!.x + line.glyphs[6]!.w).toBe(120);
  });
});

describe("measureLayout", () => {
  it("returns the same layout plus a non-negative duration", () => {
    const text = "中".repeat(20);
    const measured = measureLayout(text, opts(), metrics);
    const expected = layout(text, opts(), metrics);

    expect(measured.result.lines.length).toBe(expected.lines.length);
    expect(measured.result.height).toBe(expected.height);
    expect(measured.elapsedMs).toBeGreaterThanOrEqual(0);
  });
});
