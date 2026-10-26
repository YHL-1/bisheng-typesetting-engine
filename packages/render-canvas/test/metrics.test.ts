import { describe, expect, it } from "vitest";
import { assertFontShorthand } from "../src/metrics";

describe("assertFontShorthand", () => {
  it("accepts a size plus a family stack", () => {
    expect(() => assertFontShorthand('16px "Noto Serif SC", serif')).not.toThrow();
    expect(() => assertFontShorthand("600 13.5px sans-serif")).not.toThrow();
  });

  it("rejects a family-only string (the context would stay at 10px)", () => {
    expect(() => assertFontShorthand('"Noto Serif SC", serif')).toThrow(/full CSS font shorthand/);
    expect(() => assertFontShorthand("serif")).toThrow(/full CSS font shorthand/);
    expect(() => assertFontShorthand("")).toThrow(/full CSS font shorthand/);
  });
});
