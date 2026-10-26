import type { LayoutOptions } from "./types";

export const SERIF_STACK = '"Noto Serif SC", "Songti SC", "SimSun", serif';
export const SANS_STACK = '"Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif';

/**
 * Defaults for the workbench. Width is the text measure (the paper adds its
 * own padding), indent is 2 chars at the default 16px size.
 */
export const DEFAULT_LAYOUT_OPTIONS: LayoutOptions = Object.freeze({
  width: 592,
  fontFamily: SERIF_STACK,
  fontWeight: 400,
  fontSize: 16,
  lineHeight: 1.9,
  letterSpacing: 0,
  indent: 32,
  strategy: "greedy",
  kinsoku: "strict",
  squeeze: true,
  autospace: true,
  align: "justify",
});

export function createLayoutOptions(overrides: Partial<LayoutOptions> = {}): LayoutOptions {
  return { ...DEFAULT_LAYOUT_OPTIONS, ...overrides };
}
