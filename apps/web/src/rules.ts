import { DEFAULT_LAYOUT_OPTIONS } from "@typesetting-engine/core";
import type { Kinsoku, LayoutOptions } from "@typesetting-engine/core";
import { FONT_OPTIONS } from "./fonts";

export type RuleSettings = {
  width: number;
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
  indentChars: number;
  fontId: string;
  kinsoku: Kinsoku;
  squeeze: boolean;
  autospace: boolean;
  align: LayoutOptions["align"];
};

export const INITIAL_RULES: RuleSettings = {
  width: DEFAULT_LAYOUT_OPTIONS.width,
  fontSize: DEFAULT_LAYOUT_OPTIONS.fontSize,
  lineHeight: DEFAULT_LAYOUT_OPTIONS.lineHeight,
  letterSpacing: DEFAULT_LAYOUT_OPTIONS.letterSpacing,
  indentChars: 2,
  fontId: FONT_OPTIONS[0]!.id,
  kinsoku: DEFAULT_LAYOUT_OPTIONS.kinsoku,
  squeeze: DEFAULT_LAYOUT_OPTIONS.squeeze,
  autospace: DEFAULT_LAYOUT_OPTIONS.autospace,
  align: DEFAULT_LAYOUT_OPTIONS.align,
};
