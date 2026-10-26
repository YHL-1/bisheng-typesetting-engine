import { useEffect, useRef } from "react";
import { drawLayout } from "@typesetting-engine/render-canvas";
import type { DrawStats } from "@typesetting-engine/render-canvas";
import type { LayoutOptions, LayoutResult } from "@typesetting-engine/core";

type Props = {
  layout: LayoutResult | null;
  options: LayoutOptions;
  height: number;
  redrawKey: number;
  showGlyphWidths: boolean;
  onRender: (stats: DrawStats) => void;
};

export function PreviewCanvas({
  layout,
  options,
  height,
  redrawKey,
  showGlyphWidths,
  onRender,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !layout) return;

    const stats = drawLayout(layout, canvas, options, height, { showGlyphWidths });
    onRender(stats);
  }, [layout, options, height, redrawKey, showGlyphWidths, onRender]);

  return (
    <canvas
      ref={canvasRef}
      className="preview-canvas"
      style={{ width: options.width, height }}
      role="img"
      aria-label="排版预览"
    />
  );
}
