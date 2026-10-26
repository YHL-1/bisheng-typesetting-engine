import type { Metrics } from "@typesetting-engine/core";

export type MetricsStats = {
  reads: number;
  hits: number;
  misses: number;
  hitRate: number;
  uniqueGlyphs: number;
};

export type CanvasMetrics = Metrics & {
  readonly font: string;
  readonly stats: MetricsStats;
  resetStats(): void;
};

export type GlyphWidthCheck = {
  glyph: string;
  metric: number;
  measured: number;
  delta: number;
  ok: boolean;
};

const CJK_PROBE = "中";
const SPACE_PROBE = "中 中";

/**
 * Guard against the silent failure mode where a family-only string is assigned
 * to `ctx.font`: the assignment is ignored and the context keeps its default
 * 10px font, so every measured width is wrong.
 */
export function assertFontShorthand(font: string): void {
  if (!/\d+(?:\.\d+)?px/.test(font)) {
    throw new Error(
      `createCanvasMetrics expects a full CSS font shorthand with a px size, got "${font}"`,
    );
  }
}

function parseFontSize(font: string): number {
  const match = /(\d+(?:\.\d+)?)px/.exec(font);
  return match?.[1] ? Number.parseFloat(match[1]) : 16;
}

function measureSpaceWidth(measure: (ch: string) => number): number {
  const space = measure(" ");
  if (space > 0) return space;

  // Some fonts report zero for a lone space. Derive it from "中 中" instead.
  const cjk = measure(CJK_PROBE);
  if (cjk <= 0) return 0;
  return Math.max(0, measure(SPACE_PROBE) - 2 * cjk);
}

/**
 * Canvas-backed metrics with a `font|glyph` cache.
 *
 * `font` must be a complete CSS font shorthand, e.g. `16px "Noto Serif SC"`.
 * A family-only string is invalid and leaves the context at its default 10px
 * font, which silently produces metrics that do not match what is drawn.
 * Create a new instance when the family or size changes.
 */
export function createCanvasMetrics(font: string): CanvasMetrics {
  assertFontShorthand(font);

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context is not available");

  ctx.font = font;

  const cache = new Map<string, number>();
  let reads = 0;
  let hits = 0;
  let misses = 0;

  const measure = (ch: string): number => ctx.measureText(ch).width;
  const fallbackSpace = measureSpaceWidth(measure);

  const widthOf = (ch: string): number => {
    reads += 1;
    const cached = cache.get(ch);
    if (cached !== undefined) {
      hits += 1;
      return cached;
    }

    misses += 1;
    let width = measure(ch);
    if (ch === " " && width === 0) width = fallbackSpace;
    cache.set(ch, width);
    return width;
  };

  const probe = ctx.measureText(CJK_PROBE);
  const fontSize = parseFontSize(font);

  const metrics: CanvasMetrics = {
    font,
    width: widthOf,
    ascent: probe.actualBoundingBoxAscent || fontSize * 0.88,
    descent: probe.actualBoundingBoxDescent || fontSize * 0.22,
    get stats(): MetricsStats {
      return {
        reads,
        hits,
        misses,
        hitRate: reads === 0 ? 0 : hits / reads,
        uniqueGlyphs: cache.size,
      };
    },
    resetStats() {
      reads = 0;
      hits = 0;
      misses = 0;
    },
  };

  return metrics;
}

/**
 * Development check: the cached metric must equal a fresh `measureText` for
 * the same font. Any drift means the font finished loading after the cache was
 * built, and the caller should rebuild metrics.
 */
export function verifyGlyphWidth(metrics: Metrics, font: string, glyph = "汉"): GlyphWidthCheck {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context is not available");

  ctx.font = font;
  const measured = ctx.measureText(glyph).width;
  const metric = metrics.width(glyph);
  const delta = Math.abs(metric - measured);

  return { glyph, metric, measured, delta, ok: delta < 1e-6 };
}
