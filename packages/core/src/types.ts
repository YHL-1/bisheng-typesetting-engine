export type Metrics = {
  width(ch: string): number; // 单字宽度（CSS px，允许小数）
  ascent: number;
  descent: number;
};

export type Strategy = "greedy" | "knuth-plass";
export type Kinsoku = "off" | "basic" | "strict";

export type LayoutOptions = {
  width: number;
  fontFamily: string;
  fontWeight?: number;
  fontSize: number;
  lineHeight: number; // 倍数，如 1.8
  letterSpacing: number; // 额外字距，默认 0
  indent: number; // 首行缩进（px），默认 0
  strategy: Strategy;
  kinsoku: Kinsoku;
  squeeze: boolean; // 标点挤压
  autospace: boolean; // 中西混排间距
  align: "left" | "justify" | "center";
};

export type Glyph = {
  ch: string;
  x: number; // 相对行首
  y: number; // 基线（相对页顶）
  w: number; // 实际占宽（含挤压）
  squeezed: boolean;
};

export type Line = {
  glyphs: Glyph[];
  width: number; // 未对齐的自然宽度
  slack: number; // 剩余空间
  y: number; // 基线
  start: number; // 起始字符下标
  end: number; // 结束字符下标（不含）
  breakReason?: BreakReason;
};

export type BreakReason = {
  candidates: number[]; // 候选断点
  chosen: number; // 实际断点
  cost: number; // 诊断归一化代价（贪心搜索本身为 0）
  /** 代价构成，供诊断面板拆开显示。 */
  costParts?: {
    slack: number;
    squeeze: number;
    kinsoku: number;
    overflow: number;
  };
  blockedBy?: "kinsoku-start" | "kinsoku-end" | "overflow" | "word";
  /** 字符下标：导致断点前移/硬断的那个字。 */
  blockedAt?: number;
};

export type Diagnostic = {
  line: number;
  type: "kinsoku" | "squeeze" | "slack" | "orphan";
  detail: string;
};

export type LayoutResult = {
  lines: Line[];
  height: number;
  diagnostics: Diagnostic[];
};
