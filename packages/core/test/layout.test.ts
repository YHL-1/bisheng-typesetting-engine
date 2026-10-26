import { describe, expect, it } from "vitest";
import { createLayoutOptions } from "../src/defaults";
import { layout } from "../src/layout";
import { createFixedMetrics } from "../src/metrics";
import { KINSOKU_START } from "../src/rules";
import type { LayoutOptions } from "../src/types";

const metrics = createFixedMetrics(16);

function opts(overrides: Partial<LayoutOptions> = {}): LayoutOptions {
  return createLayoutOptions({
    width: 320,
    fontSize: 16,
    lineHeight: 1.9,
    letterSpacing: 0,
    indent: 32,
    kinsoku: "strict",
    ...overrides,
  });
}

function chars(text: string): string[] {
  return Array.from(text);
}

function lineText(text: string, line: { start: number; end: number }): string {
  return chars(text).slice(line.start, line.end).join("");
}

describe("layout: line breaking across widths", () => {
  const text =
    "中文排版讲究呼吸，标点不能落在行首。行尾也不能留下开引号（比如这样），连续标点要挤掉半格；中英文之间留四分之一个字。好的版面不会让人注意到框的存在，只让人读得下去。".repeat(
      3,
    );

  for (const width of [320, 800, 1200]) {
    it(`never starts a line with a kin-soku character at ${width}px`, () => {
      const result = layout(text, opts({ width }), metrics);
      const source = chars(text);

      expect(result.lines.length).toBeGreaterThan(1);

      for (const line of result.lines) {
        if (line.end <= line.start) continue;
        const first = source[line.start];
        expect(first).toBeDefined();
        expect(KINSOKU_START.has(first!)).toBe(false);
      }
    });
  }

  it("keeps width and slack consistent at 320px", () => {
    const width = 320;
    const result = layout(text, opts({ width }), metrics);

    for (const line of result.lines) {
      expect(line.width).toBeLessThanOrEqual(width + 1e-9);
      expect(line.slack).toBeCloseTo(width - line.width, 9);
    }
  });

  it("produces more lines as the container narrows", () => {
    const counts = [320, 800, 1200].map(
      (width) => layout(text, opts({ width }), metrics).lines.length,
    );

    expect(counts[0]!).toBeGreaterThan(counts[1]!);
    expect(counts[1]!).toBeGreaterThan(counts[2]!);
    expect(counts[0]!).toBeLessThan(chars(text).length);
  });
});

describe("layout: geometry", () => {
  it("indents the first line of every paragraph only", () => {
    const text = "中".repeat(5) + "\n" + "中".repeat(5);
    const result = layout(text, opts({ width: 160, indent: 32 }), metrics);

    expect(result.lines.length).toBe(2);
    expect(result.lines[0]!.glyphs[0]!.x).toBe(32);
    expect(result.lines[1]!.glyphs[0]!.x).toBe(32);
    expect(result.lines[0]!.width).toBe(32 + 5 * 16);
    expect(result.lines[1]!.width).toBe(32 + 5 * 16);
  });

  it("does not indent continuation lines", () => {
    const text = "中".repeat(40);
    const result = layout(text, opts({ width: 160, indent: 32 }), metrics);

    expect(result.lines.length).toBeGreaterThan(1);
    expect(result.lines[0]!.glyphs[0]!.x).toBe(32);
    expect(result.lines[1]!.glyphs[0]!.x).toBe(0);
  });

  it("stacks baselines by the line box", () => {
    const result = layout("中".repeat(40), opts({ width: 160, indent: 0 }), metrics);

    expect(result.lines[0]!.y).toBeCloseTo(21.28, 9);
    expect(result.lines[1]!.y - result.lines[0]!.y).toBeCloseTo(30.4, 9);
    expect(result.height).toBeCloseTo(result.lines.length * 30.4, 9);
  });

  it("counts letter spacing between glyphs, not around the line", () => {
    const result = layout("中中中", opts({ width: 200, indent: 0, letterSpacing: 2 }), metrics);
    const line = result.lines[0]!;

    expect(line.glyphs.map((glyph) => glyph.x)).toEqual([0, 18, 36]);
    expect(line.width).toBe(52);
    expect(line.slack).toBe(148);
  });

  it("handles a single glyph", () => {
    const result = layout("中", opts({ width: 100, indent: 0 }), metrics);

    expect(result.lines.length).toBe(1);
    expect(result.lines[0]!.width).toBe(16);
    expect(result.lines[0]!.slack).toBe(84);
  });

  it("hard-breaks when one glyph is wider than the container", () => {
    const result = layout("中中中", opts({ width: 8, indent: 0 }), metrics);

    expect(result.lines.length).toBe(3);
    for (const line of result.lines) {
      expect(line.width).toBe(16);
      expect(line.slack).toBe(-8);
    }
  });

  it("keeps making progress when every boundary is forbidden", () => {
    const text = "，。、；".repeat(10);
    const result = layout(text, opts({ width: 48, indent: 0 }), metrics);
    const total = result.lines.reduce((sum, line) => sum + line.glyphs.length, 0);

    expect(result.lines.length).toBeGreaterThan(1);
    expect(total).toBe(40);
  });
});

describe("layout: paragraphs", () => {
  it("keeps interior blank lines", () => {
    const text = "第一段。\n\n第二段。";
    const result = layout(text, opts(), metrics);

    expect(result.lines.length).toBe(3);
    expect(result.lines[1]!.glyphs.length).toBe(0);
    expect(result.lines[1]!.start).toBe(result.lines[1]!.end);
    expect(lineText(text, result.lines[2]!)).toBe("第二段。");
    expect(result.lines[2]!.start).toBe(6);
  });

  it("drops the line created by a trailing newline", () => {
    expect(layout("第一段。\n", opts(), metrics).lines.length).toBe(1);
    expect(layout("第一段。\n\n", opts(), metrics).lines.length).toBe(2);
  });

  it("returns no lines for empty text", () => {
    const result = layout("", opts(), metrics);

    expect(result.lines).toEqual([]);
    expect(result.height).toBe(0);
  });

  it("normalises CRLF before splitting", () => {
    const result = layout("第一段。\r\n第二段。", opts(), metrics);

    expect(result.lines.length).toBe(2);
    expect(lineText("第一段。\n第二段。", result.lines[1]!)).toBe("第二段。");
  });
});

describe("layout: break reasons", () => {
  it("moves a break before a closing punctuation and records why", () => {
    const text = "一二三四五，六";
    const result = layout(text, opts({ width: 80, indent: 0 }), metrics);
    const first = result.lines[0]!;

    expect(lineText(text, first)).toBe("一二三四");
    expect(first.breakReason?.chosen).toBe(4);
    expect(first.breakReason?.blockedBy).toBe("kinsoku-start");
    expect(first.breakReason?.blockedAt).toBe(5);
    expect(chars(text)[first.breakReason!.blockedAt!]).toBe("，");
    expect(first.breakReason?.candidates).toContain(4);
  });

  it("does not leave an opening bracket at the end of a line", () => {
    const text = "一二（三四";
    const result = layout(text, opts({ width: 48, indent: 0 }), metrics);
    const first = result.lines[0]!;

    expect(lineText(text, first)).toBe("一二");
    expect(first.breakReason?.chosen).toBe(2);
    expect(first.breakReason?.blockedBy).toBe("kinsoku-end");
  });

  it("reports a hard overflow", () => {
    const result = layout("中中", opts({ width: 8, indent: 0 }), metrics);
    const first = result.lines[0]!;

    expect(first.breakReason?.chosen).toBe(1);
    expect(first.breakReason?.blockedBy).toBe("overflow");
  });

  it("reports a word break in strict mode", () => {
    const text = "abc def";
    const result = layout(text, opts({ width: 80, indent: 0 }), metrics);
    const first = result.lines[0]!;

    expect(lineText(text, first)).toBe("abc ");
    expect(first.breakReason?.blockedBy).toBe("word");
  });

  it("uses global candidates on later lines", () => {
    const text = "中".repeat(40);
    const result = layout(text, opts({ width: 160, indent: 0 }), metrics);
    const second = result.lines[1]!;

    expect(second.start).toBe(10);
    expect(second.breakReason?.chosen).toBeGreaterThanOrEqual(second.end);
    expect(second.breakReason?.candidates.every((candidate) => candidate >= 10)).toBe(true);
  });
});

describe("layout: language smoke tests", () => {
  it("lays out pure English without losing characters", () => {
    const text = "hello world";
    const result = layout(text, opts({ width: 80, indent: 0 }), metrics);
    const total = result.lines.reduce((sum, line) => sum + line.glyphs.length, 0);

    expect(result.lines.length).toBeGreaterThan(0);
    expect(total).toBe(text.length);
    expect(result.lines[0]!.glyphs.map((glyph) => glyph.ch).join("")).toBe("hello");
  });

  it("lays out mixed CJK, Latin and digits", () => {
    const text = "中文ABC123中文";
    const result = layout(text, opts({ width: 80, indent: 0 }), metrics);
    const total = result.lines.reduce((sum, line) => sum + line.glyphs.length, 0);

    expect(total).toBe(Array.from(text).length);
    expect(result.lines.length).toBeGreaterThan(0);
  });

  it("lays out 100k characters without hanging", () => {
    const text = "中".repeat(100_000);
    const result = layout(text, opts({ width: 592, indent: 0 }), metrics);
    const total = result.lines.reduce((sum, line) => sum + line.glyphs.length, 0);

    expect(result.lines.length).toBeGreaterThan(2_000);
    expect(total).toBe(100_000);
  });
});
