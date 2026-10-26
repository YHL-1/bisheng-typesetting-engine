import { describe, expect, it } from "vitest";
import { fontString } from "../src/font";

describe("fontString", () => {
  it("builds a CSS shorthand from size and family stack", () => {
    expect(fontString(16, '"Noto Serif SC", serif')).toBe('16px "Noto Serif SC", serif');
  });

  it("supports an optional weight", () => {
    expect(fontString(16, "serif", 600)).toBe("600 16px serif");
    expect(fontString(16, "serif", "bold")).toBe("bold 16px serif");
  });

  it("falls back for invalid sizes and empty families", () => {
    expect(fontString(0, "serif")).toBe("16px serif");
    expect(fontString(Number.NaN, "serif")).toBe("16px serif");
    expect(fontString(16, "   ")).toBe("16px serif");
  });
});
