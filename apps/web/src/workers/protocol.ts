import type { LayoutOptions, LayoutResult } from "@typesetting-engine/core";

export type LayoutRequest = {
  text: string;
  options: LayoutOptions;
  widths: Record<string, number>;
  ascent: number;
  descent: number;
};

export type LayoutProgress = {
  type: "progress";
  done: number;
  total: number;
  percent: number;
};

export type LayoutResponse =
  | { ok: true; result: LayoutResult; elapsedMs: number }
  | { ok: false; error: string }
  | LayoutProgress;
