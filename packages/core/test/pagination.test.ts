import { describe, expect, it } from "vitest";
import { pageCapacity, paginateLines } from "../src/pagination";
import type { Line } from "../src/types";

function line(index: number, end: number): Line {
  return {
    glyphs: [{ ch: "中", x: 0, y: 21.28, w: 16, squeezed: false }],
    width: 16,
    slack: 0,
    y: 21.28,
    start: index,
    end,
    breakReason: { candidates: [], chosen: end, cost: 0 },
  };
}

describe("pageCapacity", () => {
  it("reserves one line for widow control", () => {
    expect(pageCapacity(838, 30.4)).toBe(26);
    expect(pageCapacity(30.4, 30.4)).toBe(1);
  });

  it("never returns zero", () => {
    expect(pageCapacity(0, 30)).toBe(1);
    expect(pageCapacity(-10, 30)).toBe(1);
    expect(pageCapacity(100, 0)).toBe(1);
  });
});

describe("paginateLines", () => {
  it("does not let a line cross a page", () => {
    const lines = Array.from({ length: 60 }, (_, index) => line(index, index + 1));
    const chars = Array.from("x".repeat(60));
    const pages = paginateLines(lines, 10, chars);

    expect(pages.length).toBe(6);
    expect(pages.every((page) => page.length <= 10)).toBe(true);
    expect(pages.flat().length).toBe(60);
  });

  it("pulls a paragraph's last line together with the previous line", () => {
    // Line 2 ends a paragraph. With capacity 2, the naive split would put it
    // alone at the top of page 2.
    const lines = [
      line(0, 1),
      line(1, 2),
      line(2, 3),
      line(3, 4),
      line(4, 5),
    ];
    const chars = Array.from("ab\n\ncd");

    const pages = paginateLines(lines, 2, chars);

    expect(pages[1]![0]!.end).toBe(2);
    expect(pages[1]!.some((entry) => entry.end === 3)).toBe(true);
    expect(pages.flat().length).toBe(5);
  });

  it("preserves all lines and the order", () => {
    const lines = Array.from({ length: 17 }, (_, index) => line(index, index + 1));
    const chars = Array.from("x".repeat(17));
    const pages = paginateLines(lines, 4, chars);

    expect(pages.flat().map((entry) => entry.start)).toEqual(
      Array.from({ length: 17 }, (_, index) => index),
    );
  });
});
