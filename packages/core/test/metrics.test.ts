import { describe, expect, it } from "vitest";
import { createFixedMetrics } from "../src/metrics";

describe("createFixedMetrics", () => {
  it("advances every glyph by exactly one em", () => {
    const metrics = createFixedMetrics(16);
    for (const glyph of ["汉", "A", "1", " ", "，", "🙂"]) {
      expect(metrics.width(glyph)).toBe(16);
    }
  });

  it("keeps ascent and descent proportional to the em", () => {
    const metrics = createFixedMetrics(20);
    expect(metrics.ascent).toBeCloseTo(17.6, 6);
    expect(metrics.descent).toBeCloseTo(2.4, 6);
    expect(metrics.ascent + metrics.descent).toBeCloseTo(20, 6);
  });

  it("is deterministic across calls", () => {
    const a = createFixedMetrics(16);
    const b = createFixedMetrics(16);
    expect(a.width("中")).toBe(b.width("中"));
    expect(a.ascent).toBe(b.ascent);
    expect(a.descent).toBe(b.descent);
  });

  it("rejects non-positive and non-finite sizes", () => {
    expect(() => createFixedMetrics(0)).toThrow(RangeError);
    expect(() => createFixedMetrics(-1)).toThrow(RangeError);
    expect(() => createFixedMetrics(Number.NaN)).toThrow(RangeError);
    expect(() => createFixedMetrics(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });
});
