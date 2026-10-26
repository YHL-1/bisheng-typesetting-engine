import type { Kinsoku, LayoutOptions, Metrics } from "./types";

/** Characters that must not appear at the start of a line. */
export const KINSOKU_START: ReadonlySet<string> = new Set([
  ..."，。、；：？！）〕〉》」』】”’·…—～%‰℃",
]);

/** Characters that must not appear at the end of a line. */
export const KINSOKU_END: ReadonlySet<string> = new Set([
  ..."（〔〈《「『【“‘",
]);

export function isKinsokuStart(ch: string): boolean {
  return KINSOKU_START.has(ch);
}

export function isKinsokuEnd(ch: string): boolean {
  return KINSOKU_END.has(ch);
}

/** Latin letters and digits, used by the strict word-breaking rule. */
export function isLatin(ch: string): boolean {
  return /[A-Za-z0-9]/.test(ch);
}

const CJK_RE = /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\u3040-\u30FF\uAC00-\uD7AF]/;

/** Han, kana and hangul — not CJK punctuation. */
export function isCJK(ch: string): boolean {
  return CJK_RE.test(ch);
}

/** Chinese punctuation from the two kinsoku tables. */
export function isPunct(ch: string): boolean {
  return KINSOKU_START.has(ch) || KINSOKU_END.has(ch);
}

/** Opening brackets / quotes: `（〔〈《「『【“‘`. */
export function isOpeningPunct(ch: string): boolean {
  return KINSOKU_END.has(ch);
}

/** Closing punctuation / quotes: `，。、；：？！）〕〉》」』】”’…`. */
export function isClosingPunct(ch: string): boolean {
  return KINSOKU_START.has(ch);
}

export type GlyphWidth = {
  w: number;
  squeezed: boolean;
};

/**
 * Actual advance width for one glyph.
 *
 * Squeezing never mutates `Metrics`; it is applied here, when the glyph is
 * generated. A consecutive punctuation run is compressed per glyph, so the
 * pair `。」` becomes about one em wide. Autospacing only happens on a
 * CJK ↔ Latin/digit boundary and never around punctuation.
 */
export function glyphWidth(
  ch: string,
  prev: string | null,
  next: string | null,
  isLineStart: boolean,
  isLineEnd: boolean,
  opts: LayoutOptions,
  metrics: Metrics,
): GlyphWidth {
  let w = metrics.width(ch);
  let squeezed = false;

  // The quarter-em belongs to the boundary, so it is attached to the glyph
  // *before* it. Adding it to the current glyph would put the gap one glyph
  // too late (the classical off-by-one in autospacing).
  if (opts.autospace && next !== null) {
    const cjk = isCJK(ch);
    const nextCjk = isCJK(next);
    if ((cjk && isLatin(next)) || (isLatin(ch) && nextCjk)) {
      w += opts.fontSize * 0.25;
    }
  }

  if (opts.squeeze && isPunct(ch)) {
    const clustered =
      (prev !== null && isPunct(prev)) || (next !== null && isPunct(next));
    const atLineStart = isLineStart && isOpeningPunct(ch);
    const atLineEnd = isLineEnd && isClosingPunct(ch);

    if (clustered || atLineStart || atLineEnd) {
      w *= 0.5;
      squeezed = true;
    }
  }

  return { w, squeezed };
}

/**
 * May a line break be placed between `prev` and `next`?
 *
 * - off:    every boundary is allowed.
 * - basic: no break before closing punctuation, no break after opening ones.
 * - strict: basic + never split a Latin word or number.
 */
export function canBreakBetween(prev: string, next: string, level: Kinsoku): boolean {
  if (level === "off") return true;
  if (prev === "" || next === "") return true;

  if (KINSOKU_START.has(next)) return false;
  if (KINSOKU_END.has(prev)) return false;

  if (level === "strict" && isLatin(prev) && isLatin(next)) return false;

  return true;
}
