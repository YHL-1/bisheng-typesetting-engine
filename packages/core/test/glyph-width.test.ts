import { describe, expect, it } from "vitest";
import { createLayoutOptions } from "../src/defaults";
import { createFixedMetrics } from "../src/metrics";
import {
  glyphWidth,
  isCJK,
  isClosingPunct,
  isOpeningPunct,
  isPunct,
} from "../src/rules";

const metrics = createFixedMetrics(16);
const base = createLayoutOptions({
  fontSize: 16,
  indent: 0,
  squeeze: true,
  autospace: true,
});
const off = createLayoutOptions({
  fontSize: 16,
  indent: 0,
  squeeze: false,
  autospace: false,
});

describe("character classes", () => {
  it("isCJK covers Han, kana and hangul but not punctuation", () => {
    expect(isCJK("中")).toBe(true);
    expect(isCJK("文")).toBe(true);
    expect(isCJK("あ")).toBe(true);
    expect(isCJK("한")).toBe(true);
    expect(isCJK("A")).toBe(false);
    expect(isCJK("，")).toBe(false);
    expect(isCJK(" ")).toBe(false);
  });

  it("isPunct covers both kinsoku tables", () => {
    expect(isPunct("，")).toBe(true);
    expect(isPunct("。")).toBe(true);
    expect(isPunct("（")).toBe(true);
    expect(isPunct("」")).toBe(true);
    expect(isPunct("A")).toBe(false);
    expect(isPunct("中")).toBe(false);
    expect(isPunct(" ")).toBe(false);
  });

  it("distinguishes opening and closing punctuation", () => {
    expect(isOpeningPunct("（")).toBe(true);
    expect(isOpeningPunct("「")).toBe(true);
    expect(isOpeningPunct("）")).toBe(false);
    expect(isClosingPunct("）")).toBe(true);
    expect(isClosingPunct("。")).toBe(true);
    expect(isClosingPunct("（")).toBe(false);
  });
});

describe("glyphWidth", () => {
  it("leaves ordinary CJK alone", () => {
    const glyph = glyphWidth("中", null, null, false, false, base, metrics);
    expect(glyph).toEqual({ w: 16, squeezed: false });
  });

  it("adds a quarter em after the glyph at a CJK → Latin boundary", () => {
    const glyph = glyphWidth("文", "中", "A", false, false, base, metrics);
    expect(glyph.w).toBe(20);
    expect(glyph.squeezed).toBe(false);
    expect(glyphWidth("文", "中", "A", false, false, off, metrics).w).toBe(16);
  });

  it("adds a quarter em after the glyph at a Latin → CJK boundary", () => {
    expect(glyphWidth("3", "C", "中", false, false, base, metrics).w).toBe(20);
    expect(glyphWidth("3", "C", "中", false, false, off, metrics).w).toBe(16);
  });

  it("never autospaces around punctuation", () => {
    expect(glyphWidth("A", "，", "B", false, false, base, metrics).w).toBe(16);
    expect(glyphWidth("，", "文", "A", false, false, base, metrics).w).toBe(16);
  });

  it("compresses a consecutive punctuation pair to about one em", () => {
    const period = glyphWidth("。", null, "」", false, false, base, metrics);
    const quote = glyphWidth("」", "。", null, false, false, base, metrics);

    expect(period).toEqual({ w: 8, squeezed: true });
    expect(quote).toEqual({ w: 8, squeezed: true });
    expect(period.w + quote.w).toBe(16);
  });

  it("does not squeeze a lone comma in the middle of a line", () => {
    const glyph = glyphWidth("，", "中", "文", false, false, base, metrics);
    expect(glyph).toEqual({ w: 16, squeezed: false });
  });

  it("squeezes an opening bracket at line start", () => {
    expect(glyphWidth("（", null, "中", true, false, base, metrics)).toEqual({
      w: 8,
      squeezed: true,
    });
    expect(glyphWidth("（", null, "中", false, false, base, metrics).w).toBe(16);
  });

  it("squeezes closing punctuation at line end", () => {
    expect(glyphWidth("。", "中", null, false, true, base, metrics)).toEqual({
      w: 8,
      squeezed: true,
    });
    expect(glyphWidth("，", "中", null, false, true, base, metrics).w).toBe(8);
  });

  it("does not squeeze opening punctuation at line end", () => {
    const glyph = glyphWidth("（", "中", null, false, true, base, metrics);
    expect(glyph).toEqual({ w: 16, squeezed: false });
  });

  it("does not squeeze closing punctuation at line start unless clustered", () => {
    const glyph = glyphWidth("。", null, "中", true, false, base, metrics);
    expect(glyph).toEqual({ w: 16, squeezed: false });
  });
});
