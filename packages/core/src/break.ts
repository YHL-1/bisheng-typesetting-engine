import {
  canBreakBetween,
  glyphWidth,
  isLatin,
  KINSOKU_END,
  KINSOKU_START,
} from "./rules";
import { firstBaseline, glyphAdvance, lineBoxHeight } from "./typography";
import type { BreakReason, Glyph, LayoutOptions, Line, Metrics } from "./types";

export type GreedyContext = {
  /** Code-point offset of this paragraph inside the full text. */
  offset?: number;
  /** Global line index of the first line, used for baselines. */
  firstLine?: number;
};

function makeLine(
  chars: readonly string[],
  start: number,
  end: number,
  opts: LayoutOptions,
  metrics: Metrics,
  baseline: number,
  indent: number,
  offset: number,
  breakReason: BreakReason,
): Line {
  const glyphs: Glyph[] = [];
  let x = indent;

  for (let index = start; index < end; index += 1) {
    const ch = chars[index];
    if (ch === undefined) continue;

    const prev = index > start ? (chars[index - 1] ?? null) : null;
    const next = index < end - 1 ? (chars[index + 1] ?? null) : null;
    const measured = glyphWidth(
      ch,
      prev,
      next,
      index === start,
      index === end - 1,
      opts,
      metrics,
    );

    glyphs.push({ ch, x, y: baseline, w: measured.w, squeezed: measured.squeezed });
    x += index < end - 1 ? glyphAdvance(measured.w, opts) : measured.w;
  }

  return {
    glyphs,
    width: x,
    slack: opts.width - x,
    y: baseline,
    start: offset + start,
    end: offset + end,
    breakReason,
  };
}

/**
 * Knuth-Plass-style total-fit line breaking for one paragraph.
 *
 * This is a bounded DP over legal breakpoints: every line's badness is derived
 * from its slack, and the final line is free. It is intentionally simpler than
 * TeX's full three-way (stretch/shrink/penalty) model, but it shares the same
 * break legality rules and produces a global minimum instead of a local greedy
 * choice. Hard-break edges keep all-punctuation paths finite.
 */
export function layoutKnuthPlass(
  text: string,
  opts: LayoutOptions,
  metrics: Metrics,
  context: GreedyContext = {},
): Line[] {
  const chars = Array.from(text);
  const n = chars.length;
  if (n === 0) return [];

  const offset = context.offset ?? 0;
  const firstLine = context.firstLine ?? 0;
  const breakOpts = opts.squeeze ? { ...opts, squeeze: false } : opts;
  const maxWidth = opts.width;
  const indent = opts.indent;
  const tolerance = opts.fontSize * 0.75;

  const best = new Float64Array(n + 1).fill(Number.POSITIVE_INFINITY);
  const previous = new Int32Array(n + 1).fill(-1);
  best[0] = 0;

  for (let start = 0; start < n; start += 1) {
    if (!Number.isFinite(best[start])) continue;

    let width = start === 0 ? indent : 0;
    let found = false;
    let hardEnd = -1;

    for (let index = start; index < n; index += 1) {
      const ch = chars[index]!;
      const prevChar = index > start ? (chars[index - 1] ?? null) : null;
      const nextChar = chars[index + 1] ?? null;
      const measured = glyphWidth(
        ch,
        prevChar,
        nextChar,
        index === start,
        false,
        breakOpts,
        metrics,
      );
      width += index > start ? glyphAdvance(measured.w, opts) : measured.w;

      const end = index + 1;
      const legal =
        end === n || canBreakBetween(ch, chars[end]!, opts.kinsoku);

      if (!legal) {
        if (width > maxWidth + tolerance && hardEnd < 0) hardEnd = end;
        continue;
      }

      if (width > maxWidth + tolerance) {
        if (hardEnd < 0) hardEnd = end;
        break;
      }

      const slack = maxWidth - width;
      const gaps = Math.max(1, end - start - 1);
      const stretch = Math.max(1, gaps) * opts.fontSize * 0.5;
      let badness: number;

      if (end === n) {
        badness = slack < 0 ? (-slack / opts.fontSize) * 10 + 100 : 0;
      } else if (slack < 0) {
        badness = (-slack / opts.fontSize) * 10 + 100;
      } else {
        const ratio = slack / stretch;
        badness = Math.min(10_000, ratio * ratio * ratio * 100);
      }

      const cost = best[start]! + badness;
      if (cost < best[end]!) {
        best[end] = cost;
        previous[end] = start;
      }
      found = true;
    }

    if (!found) {
      const end = hardEnd > start ? hardEnd : Math.min(n, start + 1);
      const cost = best[start]! + 10_000;
      if (cost < best[end]!) {
        best[end] = cost;
        previous[end] = start;
      }
    }
  }

  if (previous[n] < 0) return layoutGreedy(text, opts, metrics, context);

  const breaks: number[] = [];
  let cursor = n;
  while (cursor > 0) {
    breaks.push(cursor);
    const prior = previous[cursor]!;
    if (prior < 0) return layoutGreedy(text, opts, metrics, context);
    cursor = prior;
  }
  breaks.push(0);
  breaks.reverse();

  const lines: Line[] = [];
  for (let index = 0; index < breaks.length - 1; index += 1) {
    const start = breaks[index]!;
    const end = breaks[index + 1]!;
    const baseline =
      firstBaseline(opts, metrics) +
      (firstLine + lines.length) * lineBoxHeight(opts);
    const cost = Math.max(0, best[end]! - best[start]!);
    const line = makeLine(
      chars,
      start,
      end,
      opts,
      metrics,
      baseline,
      start === 0 ? indent : 0,
      offset,
      {
        candidates: [offset + end],
        chosen: offset + end,
        cost,
      },
    );

    if (line.width > opts.width + tolerance) {
      line.breakReason!.blockedBy = "overflow";
      line.breakReason!.blockedAt = offset + end;
    }
    lines.push(line);
  }

  return lines;
}

/**
 * Greedy line breaking for one paragraph.
 *
 * Breakpoints are chosen with squeezing disabled (autospacing is a spacing
 * rule and is included), then `makeLine` applies squeeze. That keeps line
 * count stable when the squeeze toggle flips instead of oscillating.
 * Every iteration advances `start`, which makes an infinite loop impossible
 * even when the container is narrower than a single glyph.
 */
export function layoutGreedy(
  text: string,
  opts: LayoutOptions,
  metrics: Metrics,
  context: GreedyContext = {},
): Line[] {
  const chars = Array.from(text);
  if (chars.length === 0) return [];

  const offset = context.offset ?? 0;
  const firstLine = context.firstLine ?? 0;
  // Squeezing is deliberately disabled while choosing breakpoints: widths
  // must stay stable, otherwise squeeze-then-refit oscillates. Autospacing is
  // a spacing rule, not a squeeze, so it is included in the fit decision.
  const breakOpts = opts.squeeze ? { ...opts, squeeze: false } : opts;
  const lines: Line[] = [];
  let start = 0;

  while (start < chars.length) {
    const isFirstLocalLine = lines.length === 0;
    let width = isFirstLocalLine ? opts.indent : 0;
    let lastBreak = -1;
    let index = start;
    const candidates: number[] = [];

    for (; index < chars.length; index += 1) {
      const ch = chars[index];
      if (ch === undefined) break;

      const prev = index > start ? (chars[index - 1] ?? null) : null;
      // `next` lets the fit decision reserve quarter-em autospacing after this
      // glyph. If the line ends here the gap is dropped by makeLine, which
      // only ever makes the final line narrower.
      const next = chars[index + 1] ?? null;
      const measured = glyphWidth(ch, prev, next, index === start, false, breakOpts, metrics);
      // Letter spacing belongs between glyphs, never before the first one.
      const advance = index > start ? glyphAdvance(measured.w, opts) : measured.w;

      if (width + advance > opts.width) break;
      width += advance;

      if (next !== null && canBreakBetween(ch, next, opts.kinsoku)) {
        candidates.push(index + 1);
        lastBreak = index + 1;
      }
    }

    let end = index;
    let blockedBy: BreakReason["blockedBy"];
    let blockedAt: number | undefined;

    if (index < chars.length) {
      if (lastBreak > start) {
        end = lastBreak;

        // The line stopped before the overflow point: explain which rule
        // rejected the later break.
        if (end < index) {
          const prev = chars[index - 1];
          const next = chars[index];

          if (next !== undefined && KINSOKU_START.has(next)) {
            blockedBy = "kinsoku-start";
            blockedAt = offset + index;
          } else if (prev !== undefined && KINSOKU_END.has(prev)) {
            blockedBy = "kinsoku-end";
            blockedAt = offset + index - 1;
          } else if (
            opts.kinsoku === "strict" &&
            prev !== undefined &&
            next !== undefined &&
            isLatin(prev) &&
            isLatin(next)
          ) {
            blockedBy = "word";
            blockedAt = offset + index;
          } else {
            blockedBy = "overflow";
            blockedAt = offset + index;
          }
        }
      } else {
        // No legal breakpoint at all: hard-break at the overflow point.
        if (end === start) end = start + 1;
        blockedBy = "overflow";
        blockedAt = offset + index;
      }
    } else {
      end = chars.length;
    }

    // Defensive progress guarantee; also keeps `end` inside the paragraph.
    if (end <= start) end = start + 1;
    if (end > chars.length) end = chars.length;

    const baseline =
      firstBaseline(opts, metrics) + (firstLine + lines.length) * lineBoxHeight(opts);

    const line = makeLine(
      chars,
      start,
      end,
      opts,
      metrics,
      baseline,
      isFirstLocalLine ? opts.indent : 0,
      offset,
      {
        candidates: candidates.map((candidate) => offset + candidate),
        chosen: offset + end,
        cost: 0,
        ...(blockedBy === undefined ? {} : { blockedBy }),
        ...(blockedAt === undefined ? {} : { blockedAt }),
      },
    );

    lines.push(line);
    start = end;
  }

  return lines;
}
