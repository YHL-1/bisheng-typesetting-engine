import type { DrawStats } from "@typesetting-engine/render-canvas";

export type RenderReport = DrawStats & {
  hitRate: number;
  uniqueGlyphs: number;
};
