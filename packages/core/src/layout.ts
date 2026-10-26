import { layoutGreedy, layoutKnuthPlass } from "./break";
import { diagnose } from "./diagnostics";
import { justifyLine } from "./justify";
import { firstBaseline, lineBoxHeight } from "./typography";
import type { LayoutOptions, LayoutResult, Line, Metrics } from "./types";

export type MeasuredLayout = {
  result: LayoutResult;
  elapsedMs: number;
};

type Clock = { now(): number };

function clock(): Clock {
  const globalWithPerformance = globalThis as typeof globalThis & {
    performance?: Clock;
  };
  return globalWithPerformance.performance ?? { now: () => Date.now() };
}

/* -------------------------------------------------------------------------
 * Paragraph cache (D6)
 *
 * Breakpoints depend on width/type/kinsoku/squeeze/autospace, but *not* on
 * align. Caching the raw paragraph lines lets a rule change that only affects
 * alignment re-use every paragraph, while editing one paragraph only misses
 * that paragraph (and any paragraph whose offset/line index moved).
 * ---------------------------------------------------------------------- */

const PARAGRAPH_CACHE_LIMIT = 128;
const paragraphCache = new Map<string, Line[]>();
const cacheStats = { hits: 0, misses: 0 };

const metricsIds = new WeakMap<Metrics, number>();
let nextMetricsId = 0;

function metricsId(metrics: Metrics): number {
  let id = metricsIds.get(metrics);
  if (id === undefined) {
    nextMetricsId += 1;
    id = nextMetricsId;
    metricsIds.set(metrics, id);
  }
  return id;
}

function breakSignature(opts: LayoutOptions): string {
  return JSON.stringify({
    width: opts.width,
    fontFamily: opts.fontFamily,
    fontWeight: opts.fontWeight,
    fontSize: opts.fontSize,
    lineHeight: opts.lineHeight,
    letterSpacing: opts.letterSpacing,
    indent: opts.indent,
    strategy: opts.strategy,
    kinsoku: opts.kinsoku,
    squeeze: opts.squeeze,
    autospace: opts.autospace,
  });
}

function cloneLines(lines: readonly Line[]): Line[] {
  return lines.map((line) => ({
    ...line,
    glyphs: line.glyphs.map((glyph) => ({ ...glyph })),
    ...(line.breakReason === undefined
      ? {}
      : {
          breakReason: {
            ...line.breakReason,
            candidates: [...line.breakReason.candidates],
          },
        }),
  }));
}

function rawParagraphLines(
  segment: string,
  opts: LayoutOptions,
  metrics: Metrics,
  offset: number,
  firstLine: number,
): Line[] {
  const key = `${offset}|${firstLine}|${metricsId(metrics)}|${breakSignature(opts)}|${segment}`;
  const cached = paragraphCache.get(key);
  if (cached !== undefined) {
    cacheStats.hits += 1;
    return cloneLines(cached);
  }

  const raw =
    opts.strategy === "knuth-plass"
      ? layoutKnuthPlass(segment, opts, metrics, { offset, firstLine })
      : layoutGreedy(segment, opts, metrics, { offset, firstLine });
  cacheStats.misses += 1;
  paragraphCache.set(key, cloneLines(raw));

  if (paragraphCache.size > PARAGRAPH_CACHE_LIMIT) {
    const oldest = paragraphCache.keys().next().value;
    if (oldest !== undefined) paragraphCache.delete(oldest);
  }

  return raw;
}

export function clearLayoutCache(): void {
  paragraphCache.clear();
  cacheStats.hits = 0;
  cacheStats.misses = 0;
}

export function getLayoutCacheStats(): {
  hits: number;
  misses: number;
  size: number;
} {
  return { ...cacheStats, size: paragraphCache.size };
}

/** Profiling wrapper for the UI; `layout` itself stays pure. */
export function measureLayout(
  text: string,
  opts: LayoutOptions,
  metrics: Metrics,
): MeasuredLayout {
  const timer = clock();
  const started = timer.now();
  const result = layout(text, opts, metrics);
  return { result, elapsedMs: timer.now() - started };
}

/**
 * Layout entry: normalise CRLF, split paragraphs, break/squeeze each paragraph
 * (cached), justify, then stack. `Line.start` / `Line.end` and BreakReason
 * offsets are code-point offsets in the normalised text.
 */
export function layout(text: string, opts: LayoutOptions, metrics: Metrics): LayoutResult {
  const normalized = text.replace(/\r\n?/g, "\n");
  if (normalized.length === 0) {
    return { lines: [], height: 0, diagnostics: [] };
  }

  const segments = normalized.split("\n");
  const lines: Line[] = [];
  let offset = 0;

  for (let segmentIndex = 0; segmentIndex < segments.length; segmentIndex += 1) {
    const segment = segments[segmentIndex];
    if (segment === undefined) continue;

    const isLast = segmentIndex === segments.length - 1;
    // A trailing newline closes the last paragraph; it should not render as an
    // extra blank line. Interior blank lines are kept.
    if (isLast && segment.length === 0 && normalized.endsWith("\n")) break;

    const chars = Array.from(segment);

    if (chars.length === 0) {
      const baseline = firstBaseline(opts, metrics) + lines.length * lineBoxHeight(opts);
      lines.push({
        glyphs: [],
        width: 0,
        slack: opts.width,
        y: baseline,
        start: offset,
        end: offset,
      });
    } else {
      const paragraphLines = rawParagraphLines(
        segment,
        opts,
        metrics,
        offset,
        lines.length,
      );

      // Alignment is the only step re-applied on a cache hit; the break itself
      // is reused. The last line of each paragraph is never stretched.
      paragraphLines.forEach((line, index) => {
        justifyLine(line, opts, index === paragraphLines.length - 1);
      });

      lines.push(...paragraphLines);
    }

    // +1 accounts for the newline character between paragraphs.
    offset += chars.length + 1;
  }

  // Attach the diagnostic cost breakdown after squeeze/justify, when slack
  // and squeezed glyphs are final.
  for (const line of lines) {
    const reason = line.breakReason;
    if (!reason) continue;

    const slack = opts.width > 0 ? Math.max(0, line.slack) / opts.width : 0;
    const squeeze = line.glyphs.some((glyph) => glyph.squeezed) ? 0.5 : 0;
    const kinsoku =
      reason.blockedBy === "kinsoku-start" || reason.blockedBy === "kinsoku-end"
        ? 0.01
        : 0;
    const overflow = reason.blockedBy === "overflow" ? 0.5 : 0;

    reason.costParts = { slack, squeeze, kinsoku, overflow };
    // Greedy has no search cost; KP keeps its total-fit badness.
    if (reason.cost === 0) {
      reason.cost = slack + squeeze + kinsoku + overflow;
    }
  }

  const result: LayoutResult = {
    lines,
    height: lines.length * lineBoxHeight(opts),
    diagnostics: [],
  };
  result.diagnostics = diagnose(result, normalized, opts);
  return result;
}
