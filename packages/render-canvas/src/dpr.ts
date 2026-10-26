export type CanvasSize = {
  cssWidth: number;
  cssHeight: number;
  dpr: number;
  /** Backing-store width in device pixels. */
  width: number;
  /** Backing-store height in device pixels. */
  height: number;
};

const MIN_DPR = 0.5;
const MAX_DPR = 4;

/** Sanitise a device pixel ratio; never trust it blindly (zoom, weird VMs). */
export function normalizeDpr(dpr: number | null | undefined): number {
  if (typeof dpr !== "number" || !Number.isFinite(dpr) || dpr <= 0) return 1;
  return Math.min(MAX_DPR, Math.max(MIN_DPR, dpr));
}

/**
 * CSS pixels are the layout unit. The backing store is CSS × dpr, rounded up,
 * so text stays crisp without changing any measured width.
 */
export function computeCanvasSize(
  cssWidth: number,
  cssHeight: number,
  dpr?: number | null,
): CanvasSize {
  const safeWidth = Number.isFinite(cssWidth) && cssWidth > 0 ? cssWidth : 0;
  const safeHeight = Number.isFinite(cssHeight) && cssHeight > 0 ? cssHeight : 0;
  const ratio = normalizeDpr(dpr);

  return {
    cssWidth: safeWidth,
    cssHeight: safeHeight,
    dpr: ratio,
    width: Math.max(1, Math.ceil(safeWidth * ratio)),
    height: Math.max(1, Math.ceil(safeHeight * ratio)),
  };
}

export function currentDevicePixelRatio(): number {
  return typeof window === "undefined" ? 1 : normalizeDpr(window.devicePixelRatio);
}
