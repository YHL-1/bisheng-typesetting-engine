import { describe, expect, it } from "vitest";
import { countChars, countParagraphs } from "../src/text";

describe("countChars", () => {
  it("counts non-whitespace characters", () => {
    expect(countChars("中文 A\n1\t")).toBe(4);
    expect(countChars("")).toBe(0);
  });

  it("counts full-width punctuation", () => {
    expect(countChars("，。、")).toBe(3);
  });
});

describe("countParagraphs", () => {
  it("splits on blank lines", () => {
    expect(countParagraphs("第一段\n\n第二段\n\n第三段")).toBe(3);
  });

  it("tolerates extra spaces on an empty line", () => {
    expect(countParagraphs("第一段\n   \n第二段")).toBe(2);
  });

  it("ignores leading, trailing and all-blank input", () => {
    expect(countParagraphs("\n\n第一段\n\n")).toBe(1);
    expect(countParagraphs("   \n\n  ")).toBe(0);
  });
});
