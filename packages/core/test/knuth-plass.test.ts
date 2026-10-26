import { describe, expect, it } from "vitest";
import { createLayoutOptions } from "../src/defaults";
import { layout } from "../src/layout";
import { createFixedMetrics } from "../src/metrics";

const metrics = createFixedMetrics(16);

function opts(overrides = {}) {
  return createLayoutOptions({
    width: 200,
    fontSize: 16,
    lineHeight: 1.9,
    letterSpacing: 0,
    indent: 0,
    strategy: "knuth-plass",
    kinsoku: "strict",
    squeeze: true,
    autospace: true,
    align: "left",
    ...overrides,
  });
}

const text =
  "中文排版引擎要把文字放进一个有限的容器里，同时兼顾避头尾和标点挤压。".repeat(3);

describe("Knuth-Plass total-fit layout", () => {
  it("covers the paragraph with contiguous, non-overflowing lines", () => {
    const result = layout(text, opts(), metrics);

    expect(result.lines.length).toBeGreaterThan(1);
    expect(result.lines[0]!.start).toBe(0);
    expect(result.lines.at(-1)!.end).toBe(Array.from(text).length);

    for (const line of result.lines) {
      expect(line.glyphs.length).toBeGreaterThan(0);
      expect(line.width).toBeLessThanOrEqual(200 + 16 * 0.75 + 0.01);
    }

    for (let index = 1; index < result.lines.length; index += 1) {
      expect(result.lines[index]!.start).toBe(result.lines[index - 1]!.end);
    }
  });

  it("does not split Latin words under strict kinsoku", () => {
    const source = "中文 hello world 中文中文中文";
    const result = layout(source, opts({ width: 80 }), metrics);
    const chars = Array.from(source);
    const helloStart = chars.indexOf("h");
    const helloEnd = chars.indexOf("o", helloStart) + 1;

    for (const line of result.lines) {
      const cutsInside =
        (line.start > helloStart && line.start < helloEnd) ||
        (line.end > helloStart && line.end < helloEnd);
      expect(cutsInside).toBe(false);
    }
  });

  it("terminates on an all-punctuation paragraph", () => {
    const result = layout("。。。。。。。。。。", opts({ width: 24 }), metrics);
    expect(result.lines.length).toBeGreaterThan(0);
    expect(result.lines.at(-1)!.end).toBe(10);
  });

  it("records diagnostic cost parts", () => {
    const result = layout(text, opts(), metrics);
    const line = result.lines.find((entry) => entry.breakReason?.costParts);
    expect(line?.breakReason?.costParts).toBeDefined();
    expect(line?.breakReason?.cost).toBeGreaterThanOrEqual(0);
  });
});
