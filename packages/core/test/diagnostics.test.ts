import { describe, expect, it } from "vitest";
import { createLayoutOptions } from "../src/defaults";
import { layout } from "../src/layout";
import { createFixedMetrics } from "../src/metrics";
import type { LayoutOptions } from "../src/types";

const metrics = createFixedMetrics(16);

function opts(overrides: Partial<LayoutOptions> = {}): LayoutOptions {
  return createLayoutOptions({
    width: 200,
    fontSize: 16,
    lineHeight: 1.9,
    letterSpacing: 0,
    indent: 0,
    autospace: false,
    squeeze: false,
    align: "left",
    ...overrides,
  });
}

describe("diagnostics", () => {
  it("reports a kinsoku break and the slack it leaves", () => {
    const result = layout("一二三四五，六", opts({ width: 90 }), metrics);
    const types = result.diagnostics.map((diagnostic) => diagnostic.type);

    expect(result.lines[0]!.breakReason?.blockedBy).toBe("kinsoku-start");
    expect(types).toContain("kinsoku");
    expect(types).toContain("slack");

    const kinsoku = result.diagnostics.find((diagnostic) => diagnostic.type === "kinsoku");
    expect(kinsoku?.line).toBe(0);
    expect(kinsoku?.detail).toContain("禁则首");
    expect(kinsoku?.detail).toContain("第 5 字符「，」");
  });

  it("reports squeezed punctuation", () => {
    const result = layout(
      "。」",
      opts({ width: 100, squeeze: true, align: "justify" }),
      metrics,
    );
    const squeeze = result.diagnostics.find((diagnostic) => diagnostic.type === "squeeze");

    expect(squeeze?.line).toBe(0);
    expect(squeeze?.detail).toContain("2 个标点");
  });

  it("does not report slack on a successfully justified line", () => {
    const result = layout(
      "中".repeat(20),
      opts({ width: 200, align: "justify" }),
      metrics,
    );

    expect(result.diagnostics.some((diagnostic) => diagnostic.type === "slack")).toBe(false);
  });

  it("reports a justify fallback when gaps exceed half an em", () => {
    const result = layout(
      "中中中，",
      opts({ width: 50, align: "justify" }),
      metrics,
    );
    const slack = result.diagnostics.find(
      (diagnostic) =>
        diagnostic.type === "slack" && diagnostic.detail.includes("0.5em"),
    );

    expect(slack?.line).toBe(0);
    expect(slack?.detail).toContain("降级左对齐");
  });

  it("marks a short paragraph-ending line as an orphan", () => {
    const result = layout("中".repeat(37), opts({ width: 200 }), metrics);
    const orphan = result.diagnostics.find((diagnostic) => diagnostic.type === "orphan");

    expect(orphan?.line).toBe(result.lines.length - 1);
    expect(orphan?.detail).toContain("孤行");
  });

  it("returns no diagnostics for a clean paragraph", () => {
    const result = layout("中".repeat(12), opts({ width: 200 }), metrics);
    expect(result.diagnostics).toEqual([]);
  });
});
