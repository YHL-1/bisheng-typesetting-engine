import { firstBaseline, lineBoxHeight } from "@typesetting-engine/core";
import type { LayoutOptions, Metrics } from "@typesetting-engine/core";
import { computeCanvasSize, currentDevicePixelRatio } from "./dpr";
import { fontString } from "./font";

/** Ink colour from the design tokens. */
export const INK = "#23211C";

export type DrawStats = {
  elapsedMs: number;
  glyphs: number;
  visibleGlyphs: number;
  textWidth: number;
  baseline: number;
  canvasWidth: number;
  canvasHeight: number;
  dpr: number;
  lines: number;
};

/**
 * D1 preview: measure and draw the whole text on a single line.
 *
 * Glyphs past the right edge are measured (warming the cache) but not painted,
 * so the canvas stays cheap while the reported text width is still complete.
 * Line breaking arrives in D2 and replaces this function in the app.
 */
export function drawSingleLine(
  text: string,
  canvas: HTMLCanvasElement,
  opts: LayoutOptions,
  metrics: Metrics,
  cssHeightOverride?: number,
): DrawStats {
  const started = performance.now();

  const cssWidth = opts.width > 0 ? opts.width : canvas.clientWidth;
  const cssHeight =
    cssHeightOverride ??
    (canvas.clientHeight > 0 ? canvas.clientHeight : lineBoxHeight(opts));

  const size = computeCanvasSize(cssWidth, cssHeight, currentDevicePixelRatio());

  if (canvas.width !== size.width || canvas.height !== size.height) {
    canvas.width = size.width;
    canvas.height = size.height;
  }
  if (canvas.style.width !== `${size.cssWidth}px`) {
    canvas.style.width = `${size.cssWidth}px`;
  }
  if (canvas.style.height !== `${size.cssHeight}px`) {
    canvas.style.height = `${size.cssHeight}px`;
  }

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context is not available");

  // setTransform (not scale) so repeated draws never compound the dpr scale.
  ctx.setTransform(size.dpr, 0, 0, size.dpr, 0, 0);
  ctx.clearRect(0, 0, size.cssWidth, size.cssHeight);
  ctx.font = fontString(opts.fontSize, opts.fontFamily);
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = INK;

  const baseline = firstBaseline(opts, metrics);
  const glyphs = Array.from(text);
  let x = 0;
  let visibleGlyphs = 0;

  for (let index = 0; index < glyphs.length; index += 1) {
    const glyph = glyphs[index];
    if (glyph === undefined) continue;
    if (glyph === "\n") continue;

    const width = metrics.width(glyph);
    if (x <= size.cssWidth) {
      ctx.fillText(glyph, x, baseline);
      visibleGlyphs += 1;
    }

    x += width;
    if (index < glyphs.length - 1) x += opts.letterSpacing;
  }

  return {
    elapsedMs: performance.now() - started,
    glyphs: glyphs.length,
    visibleGlyphs,
    textWidth: x,
    baseline,
    canvasWidth: size.cssWidth,
    canvasHeight: size.cssHeight,
    dpr: size.dpr,
    lines: 1,
  };
}
