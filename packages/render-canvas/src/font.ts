export type FontLoadResult = {
  font: string;
  supported: boolean;
  loaded: boolean;
  available: boolean;
  error?: string;
};

/** Build a CSS font shorthand. `family` may be a full fallback stack. */
export function fontString(
  size: number,
  family: string,
  weight?: number | string,
): string {
  const safeSize = Number.isFinite(size) && size > 0 ? size : 16;
  const safeFamily = family.trim() || "serif";
  const prefix = weight === undefined || weight === "" ? "" : `${weight} `;
  return `${prefix}${safeSize}px ${safeFamily}`;
}

/**
 * Wait for a font to be ready before measuring. Resolves even when the family
 * is unavailable, because the engine can still lay out with the fallback.
 */
export async function loadFont(font: string): Promise<FontLoadResult> {
  if (typeof document === "undefined" || !document.fonts) {
    return { font, supported: false, loaded: false, available: false };
  }

  try {
    const faces = await document.fonts.load(font);
    await document.fonts.ready;
    return {
      font,
      supported: true,
      loaded: true,
      available: faces.length > 0 || document.fonts.check(font),
    };
  } catch (error) {
    return {
      font,
      supported: true,
      loaded: false,
      available: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/** Is a single family (not a fallback stack) available at this size? */
export function isFontAvailable(family: string, size: number): boolean {
  if (typeof document === "undefined" || !document.fonts) return false;
  return document.fonts.check(fontString(size, family));
}
