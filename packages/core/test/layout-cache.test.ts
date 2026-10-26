import { beforeEach, describe, expect, it } from "vitest";
import { createLayoutOptions } from "../src/defaults";
import { clearLayoutCache, getLayoutCacheStats, layout } from "../src/layout";
import { createFixedMetrics } from "../src/metrics";

const metrics = createFixedMetrics(16);

function opts() {
  return createLayoutOptions({
    width: 200,
    fontSize: 16,
    lineHeight: 1.9,
    letterSpacing: 0,
    indent: 0,
    autospace: false,
    squeeze: false,
    align: "justify",
  });
}

beforeEach(() => {
  clearLayoutCache();
});

describe("paragraph layout cache", () => {
  it("reuses paragraph breaks on a repeat layout", () => {
    const text = "中".repeat(40);

    layout(text, opts(), metrics);
    const first = getLayoutCacheStats();
    expect(first.misses).toBeGreaterThan(0);

    layout(text, opts(), metrics);
    const second = getLayoutCacheStats();
    expect(second.hits).toBeGreaterThan(0);
    expect(second.misses).toBe(first.misses);
  });

  it("re-applies alignment without re-breaking", () => {
    const text = "中".repeat(40);
    layout(text, opts(), metrics);
    const misses = getLayoutCacheStats().misses;

    const left = layout(text, { ...opts(), align: "left" }, metrics);
    const stats = getLayoutCacheStats();

    expect(stats.misses).toBe(misses);
    expect(stats.hits).toBeGreaterThan(0);
    expect(left.lines[0]!.glyphs.at(-1)!.x).toBeLessThan(
      layout(text, opts(), metrics).lines[0]!.glyphs.at(-1)!.x,
    );
  });

  it("only misses the paragraph whose text changed", () => {
    const firstParagraph = "第一段。".repeat(20);
    const secondParagraph = "第二段。".repeat(20);

    layout(`${firstParagraph}\n${secondParagraph}`, opts(), metrics);
    const missesBefore = getLayoutCacheStats().misses;

    layout(`${firstParagraph}\n${secondParagraph}改`, opts(), metrics);
    const stats = getLayoutCacheStats();

    expect(stats.hits).toBeGreaterThan(0);
    expect(stats.misses).toBe(missesBefore + 1);
  });

  it("invalidates every paragraph when the break width changes", () => {
    const text = "第一段。".repeat(20) + "\n" + "第二段。".repeat(20);
    layout(text, opts(), metrics);
    const first = getLayoutCacheStats();

    layout(text, opts(), metrics);
    layout(text, { ...opts(), width: 240 }, metrics);
    const after = getLayoutCacheStats();

    expect(after.misses).toBeGreaterThan(first.misses + 1);
  });
});
