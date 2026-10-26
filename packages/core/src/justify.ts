import { isLatin } from "./rules";
import type { LayoutOptions, Line } from "./types";

export type JustifyOutcome = {
  applied: boolean;
  fallback?: "gap";
};

/**
 * Apply alignment to one line in place.
 *
 * `Line.width` stays the natural (pre-justification) width and `slack` stays
 * the natural remainder; only glyph x positions move. Callers must pass
 * `isParagraphEnd` so the last line of a paragraph is never stretched.
 */
export function justifyLine(
  line: Line,
  opts: LayoutOptions,
  isParagraphEnd: boolean,
): JustifyOutcome {
  if (opts.align === "left" || line.glyphs.length === 0) return { applied: false };

  const slack = opts.width - line.width;
  if (slack <= 0) return { applied: false };

  if (opts.align === "center") {
    const offset = slack / 2;
    for (const glyph of line.glyphs) glyph.x += offset;
    return { applied: true };
  }

  // justify
  if (isParagraphEnd) return { applied: false };

  const gaps = line.glyphs.length - 1;
  if (gaps <= 0) return { applied: false };

  // Never stretch inside a Latin word/number. Only gaps whose two sides are
  // not both Latin may absorb the slack.
  const stretchable: boolean[] = [];
  for (let index = 0; index < gaps; index += 1) {
    const left = line.glyphs[index];
    const right = line.glyphs[index + 1];
    if (!left || !right) continue;
    stretchable[index] = !(isLatin(left.ch) && isLatin(right.ch));
  }

  const stretchCount = stretchable.filter(Boolean).length;
  if (stretchCount === 0) return { applied: false };

  const extra = slack / stretchCount;
  if (extra > opts.fontSize * 0.5) {
    // Pulling this hard would look like a fence, not a paragraph.
    return { applied: false, fallback: "gap" };
  }

  const first = line.glyphs[0];
  if (first === undefined) return { applied: false };

  let x = first.x;
  for (let index = 0; index < line.glyphs.length; index += 1) {
    const glyph = line.glyphs[index];
    if (glyph === undefined) continue;

    glyph.x = x;
    x += glyph.w;
    if (index < gaps) {
      x += opts.letterSpacing;
      if (stretchable[index]) x += extra;
    }
  }

  return { applied: true };
}
