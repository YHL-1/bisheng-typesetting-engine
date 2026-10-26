import { firstBaseline, lineBoxHeight } from "@typesetting-engine/core";
import type { LayoutOptions, LayoutResult, Metrics } from "@typesetting-engine/core";
import { computeCanvasSize, currentDevicePixelRatio } from "./dpr";
import type { CanvasSize } from "./dpr";
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

export type DrawOptions = {
  /** Draw a short horizontal rule under every glyph, showing its advance. */
  showGlyphWidths?: boolean;
  /** Override the device pixel ratio (used by PNG/PDF export). */
  dpr?: number;
  /** Paint an opaque background before the glyphs (export uses white). */
  background?: string;
};

type PreparedCanvas = {
  ctx: CanvasRenderingContext2D;
  size: CanvasSize;
};

function prepareCanvas(
  canvas: HTMLCanvasElement,
  cssWidth: number,
  cssHeight: number,
  opts: LayoutOptions,
  dpr: number = currentDevicePixelRatio(),
): PreparedCanvas {
  const size = computeCanvasSize(cssWidth, cssHeight, dpr);

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
  ctx.font = fontString(opts.fontSize, opts.fontFamily, opts.fontWeight);
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = INK;

  return { ctx, size };
}

/**
 * D2 renderer: paint every line produced by `layout()`.
 *
 * The canvas height follows the layout height (or the caller's viewport
 * height), so the paper grows with the text instead of clipping after one line.
 */
export function drawLayout(
  result: LayoutResult,
  canvas: HTMLCanvasElement,
  opts: LayoutOptions,
  cssHeightOverride?: number,
  drawOptions: DrawOptions = {},
): DrawStats {
  const started = performance.now();

  const cssWidth = opts.width > 0 ? opts.width : canvas.clientWidth;
  const fallbackHeight =
    result.height > 0
      ? result.height
      : canvas.clientHeight > 0
        ? canvas.clientHeight
        : lineBoxHeight(opts);
  const cssHeight = cssHeightOverride ?? fallbackHeight;

  const { ctx, size } = prepareCanvas(
    canvas,
    cssWidth,
    cssHeight,
    opts,
    drawOptions.dpr ?? currentDevicePixelRatio(),
  );

  if (drawOptions.background) {
    ctx.fillStyle = drawOptions.background;
    ctx.fillRect(0, 0, size.cssWidth, size.cssHeight);
    ctx.fillStyle = INK;
  }

  let glyphs = 0;
  let textWidth = 0;

  for (const line of result.lines) {
    if (line.width > textWidth) textWidth = line.width;

    for (const glyph of line.glyphs) {
      ctx.fillText(glyph.ch, glyph.x, line.y);
      glyphs += 1;
    }
  }

  if (drawOptions.showGlyphWidths) {
    // A second pass keeps the text/width layers independent and makes the
    // effect of squeeze (short rules) and autospace (long rules) visible.
    ctx.save();
    ctx.strokeStyle = "rgba(47, 107, 99, 0.7)";
    ctx.lineWidth = 1;
    ctx.beginPath();

    for (const line of result.lines) {
      const ruleY = line.y + Math.max(2, opts.fontSize * 0.16);
      for (const glyph of line.glyphs) {
        // Leave a 1px gap so neighbouring rules read as per-glyph boxes
        // instead of one continuous underline.
        ctx.moveTo(glyph.x, ruleY);
        ctx.lineTo(glyph.x + Math.max(1, glyph.w - 1), ruleY);
      }
    }

    ctx.stroke();
    ctx.restore();
  }

  return {
    elapsedMs: performance.now() - started,
    glyphs,
    visibleGlyphs: glyphs,
    textWidth,
    baseline: result.lines[0]?.y ?? 0,
    canvasWidth: size.cssWidth,
    canvasHeight: size.cssHeight,
    dpr: size.dpr,
    lines: result.lines.length,
  };
}

export type ViewportOptions = {
  scrollTop: number;
  viewportHeight: number;
  showGlyphWidths?: boolean;
  dpr?: number;
};

/**
 * Draw only the lines intersecting a scroll viewport. Used by the D6 virtual
 * paper for very long documents; line coordinates stay in document space and
 * are shifted by `scrollTop` at paint time.
 */
export function drawLayoutViewport(
  result: LayoutResult,
  canvas: HTMLCanvasElement,
  opts: LayoutOptions,
  viewport: ViewportOptions,
): DrawStats {
  const started = performance.now();
  const cssWidth = opts.width > 0 ? opts.width : canvas.clientWidth;
  const cssHeight = viewport.viewportHeight;

  const { ctx, size } = prepareCanvas(
    canvas,
    cssWidth,
    cssHeight,
    opts,
    viewport.dpr ?? currentDevicePixelRatio(),
  );

  let glyphs = 0;
  let textWidth = 0;
  const margin = opts.fontSize * opts.lineHeight;

  for (const line of result.lines) {
    if (line.width > textWidth) textWidth = line.width;

    const y = line.y - viewport.scrollTop;
    if (y < -margin || y > cssHeight + margin) continue;

    for (const glyph of line.glyphs) {
      ctx.fillText(glyph.ch, glyph.x, y);
      glyphs += 1;
    }

    if (viewport.showGlyphWidths) {
      ctx.save();
      ctx.strokeStyle = "rgba(47, 107, 99, 0.7)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      const ruleY = y + Math.max(2, opts.fontSize * 0.16);
      for (const glyph of line.glyphs) {
        ctx.moveTo(glyph.x, ruleY);
        ctx.lineTo(glyph.x + Math.max(1, glyph.w - 1), ruleY);
      }
      ctx.stroke();
      ctx.restore();
    }
  }

  return {
    elapsedMs: performance.now() - started,
    glyphs,
    visibleGlyphs: glyphs,
    textWidth,
    baseline: 0,
    canvasWidth: size.cssWidth,
    canvasHeight: size.cssHeight,
    dpr: size.dpr,
    lines: result.lines.length,
  };
}

/**
 * D1 preview kept as a debugging/compare tool: measure and draw the whole text
 * on a single line. Glyphs past the right edge are measured but not painted.
 * The workbench now uses `drawLayout`.
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

  const { ctx, size } = prepareCanvas(canvas, cssWidth, cssHeight, opts);

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
