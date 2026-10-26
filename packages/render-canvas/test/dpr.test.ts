import { describe, expect, it } from "vitest";
import { computeCanvasSize, normalizeDpr } from "../src/dpr";

describe("normalizeDpr", () => {
  it("falls back to 1 for missing or invalid ratios", () => {
    expect(normalizeDpr(undefined)).toBe(1);
    expect(normalizeDpr(null)).toBe(1);
    expect(normalizeDpr(Number.NaN)).toBe(1);
    expect(normalizeDpr(0)).toBe(1);
    expect(normalizeDpr(-2)).toBe(1);
  });

  it("keeps sane ratios as-is", () => {
    expect(normalizeDpr(1)).toBe(1);
    expect(normalizeDpr(1.25)).toBe(1.25);
    expect(normalizeDpr(2)).toBe(2);
    expect(normalizeDpr(3)).toBe(3);
  });

  it("clamps extreme ratios", () => {
    expect(normalizeDpr(0.1)).toBe(0.5);
    expect(normalizeDpr(12)).toBe(4);
  });
});

describe("computeCanvasSize", () => {
  it("scales CSS pixels by dpr and rounds up the backing store", () => {
    expect(computeCanvasSize(592, 440, 2)).toEqual({
      cssWidth: 592,
      cssHeight: 440,
      dpr: 2,
      width: 1184,
      height: 880,
    });
  });

  it("keeps fractional CSS sizes while ceiling device pixels", () => {
    const size = computeCanvasSize(592.4, 440.2, 1.25);
    expect(size.cssWidth).toBe(592.4);
    expect(size.cssHeight).toBe(440.2);
    expect(size.width).toBe(741);
    expect(size.height).toBe(551);
  });

  it("never produces a zero-pixel backing store", () => {
    expect(computeCanvasSize(0, 0, 2)).toMatchObject({ width: 1, height: 1 });
    expect(computeCanvasSize(-10, Number.NaN, 1)).toMatchObject({
      cssWidth: 0,
      cssHeight: 0,
      width: 1,
      height: 1,
    });
  });

  it("defaults to dpr 1 when none is given", () => {
    expect(computeCanvasSize(320, 200).width).toBe(320);
  });
});
