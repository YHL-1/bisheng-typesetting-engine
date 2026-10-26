import type { Metrics } from "./types";

export type FixedMetrics = Metrics & {
  readonly kind: "fixed";
  readonly fontSize: number;
};

/**
 * Deterministic metrics for tests and headless runs.
 * Every glyph advances exactly one em, regardless of script or character.
 */
export function createFixedMetrics(fontSize: number): FixedMetrics {
  if (!Number.isFinite(fontSize) || fontSize <= 0) {
    throw new RangeError(`fontSize must be a positive finite number, got ${fontSize}`);
  }

  return {
    kind: "fixed",
    fontSize,
    width: () => fontSize,
    ascent: fontSize * 0.88,
    descent: fontSize * 0.12,
  };
}
