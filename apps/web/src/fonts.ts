import { SANS_STACK, SERIF_STACK } from "@typesetting-engine/core";

export type FontOption = {
  id: string;
  label: string;
  /** Full CSS fallback stack used for layout and rendering. */
  family: string;
  /** The primary family, checked separately to report a fallback. */
  probe: string;
};

export const FONT_OPTIONS: readonly FontOption[] = [
  { id: "serif-sc", label: "思源宋体", family: SERIF_STACK, probe: '"Noto Serif SC"' },
  { id: "sans-sc", label: "思源黑体", family: SANS_STACK, probe: '"Noto Sans SC"' },
  { id: "serif", label: "系统衬线", family: "serif", probe: "serif" },
  { id: "sans", label: "系统无衬线", family: "sans-serif", probe: "sans-serif" },
];

export function findFont(id: string): FontOption {
  return FONT_OPTIONS.find((option) => option.id === id) ?? FONT_OPTIONS[0]!;
}
