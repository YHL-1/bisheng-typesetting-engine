import { describe, expect, it } from "vitest";
import { createDefaultOptions } from "./helpers";
import { createFixedMetrics } from "../src/metrics";
import { firstBaseline, glyphAdvance, halfLeading, lineBoxHeight } from "../src/typography";

describe("typography", () => {
  it("computes the line box from size and line height multiplier", () => {
    const opts = createDefaultOptions({ fontSize: 16, lineHeight: 1.9 });
    expect(lineBoxHeight(opts)).toBeCloseTo(30.4, 6);
  });

  it("splits the leading evenly above and below the em box", () => {
    const opts = createDefaultOptions({ fontSize: 16, lineHeight: 1.9 });
    expect(halfLeading(opts)).toBeCloseTo(7.2, 6);
  });

  it("puts the baseline at half leading plus ascent", () => {
    const opts = createDefaultOptions({ fontSize: 16, lineHeight: 1.9 });
    const metrics = createFixedMetrics(16);
    expect(firstBaseline(opts, metrics)).toBeCloseTo(7.2 + 14.08, 6);
  });

  it("adds letter spacing to the glyph advance", () => {
    expect(glyphAdvance(16, { letterSpacing: 0 })).toBe(16);
    expect(glyphAdvance(16, { letterSpacing: 0.5 })).toBe(16.5);
    expect(glyphAdvance(16, { letterSpacing: -1 })).toBe(15);
  });

  it("keeps fractional advances unrounded", () => {
    expect(glyphAdvance(15.734, { letterSpacing: 0.125 })).toBeCloseTo(15.859, 6);
  });
});
