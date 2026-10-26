import { describe, expect, it } from "vitest";
import {
  canBreakBetween,
  isKinsokuEnd,
  isKinsokuStart,
  isLatin,
  KINSOKU_END,
  KINSOKU_START,
} from "../src/rules";

describe("KINSOKU_START", () => {
  for (const ch of KINSOKU_START) {
    it(`cannot start a line with ${ch}`, () => {
      expect(isKinsokuStart(ch)).toBe(true);
      expect(canBreakBetween("字", ch, "basic")).toBe(false);
      expect(canBreakBetween("字", ch, "strict")).toBe(false);
    });
  }
});

describe("KINSOKU_END", () => {
  for (const ch of KINSOKU_END) {
    it(`cannot end a line with ${ch}`, () => {
      expect(isKinsokuEnd(ch)).toBe(true);
      expect(canBreakBetween(ch, "字", "basic")).toBe(false);
      expect(canBreakBetween(ch, "字", "strict")).toBe(false);
    });
  }
});

describe("kinsoku levels", () => {
  it("off allows every boundary", () => {
    expect(canBreakBetween("字", "，", "off")).toBe(true);
    expect(canBreakBetween("（", "字", "off")).toBe(true);
    expect(canBreakBetween("a", "b", "off")).toBe(true);
  });

  it("basic allows latin word and number breaks", () => {
    expect(canBreakBetween("a", "b", "basic")).toBe(true);
    expect(canBreakBetween("1", "2", "basic")).toBe(true);
  });

  it("strict forbids latin word and number breaks", () => {
    expect(canBreakBetween("a", "b", "strict")).toBe(false);
    expect(canBreakBetween("Z", "9", "strict")).toBe(false);
    expect(canBreakBetween("1", "2", "strict")).toBe(false);
    expect(canBreakBetween("数", "a", "strict")).toBe(true);
    expect(canBreakBetween("a", "字", "strict")).toBe(true);
  });

  it("handles empty neighbours", () => {
    expect(canBreakBetween("", "字", "strict")).toBe(true);
    expect(canBreakBetween("字", "", "strict")).toBe(true);
  });

  it("isLatin matches letters and digits only", () => {
    expect(isLatin("A")).toBe(true);
    expect(isLatin("z")).toBe(true);
    expect(isLatin("0")).toBe(true);
    expect(isLatin("中")).toBe(false);
    expect(isLatin("，")).toBe(false);
    expect(isLatin(" ")).toBe(false);
  });
});
