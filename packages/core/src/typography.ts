import type { LayoutOptions, Metrics } from "./types";

type TypeScale = Pick<LayoutOptions, "fontSize" | "lineHeight">;
type Spacing = Pick<LayoutOptions, "letterSpacing">;

/** Height of one line box in CSS px: fontSize × lineHeight. */
export function lineBoxHeight(opts: TypeScale): number {
  return opts.fontSize * opts.lineHeight;
}

/** Space above the text inside a line box, split evenly. */
export function halfLeading(opts: TypeScale): number {
  return (lineBoxHeight(opts) - opts.fontSize) / 2;
}

/** Distance from the top of the first line box to the alphabetic baseline. */
export function firstBaseline(opts: TypeScale, metrics: Pick<Metrics, "ascent">): number {
  return halfLeading(opts) + metrics.ascent;
}

/** Advance for one glyph: intrinsic width plus letter spacing. */
export function glyphAdvance(glyphWidth: number, opts: Spacing): number {
  return glyphWidth + opts.letterSpacing;
}
