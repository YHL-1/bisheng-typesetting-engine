import { useEffect, useRef } from "react";
import { drawSingleLine } from "@typesetting-engine/render-canvas";
import type { CanvasMetrics, DrawStats } from "@typesetting-engine/render-canvas";
import type { LayoutOptions } from "@typesetting-engine/core";

type Props = {
  text: string;
  options: LayoutOptions;
  metrics: CanvasMetrics | null;
  height: number;
  redrawKey: number;
  onRender: (stats: DrawStats, metrics: CanvasMetrics) => void;
};

export function PreviewCanvas({
  text,
  options,
  metrics,
  height,
  redrawKey,
  onRender,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !metrics) return;
    const stats = drawSingleLine(text, canvas, options, metrics, height);
    onRender(stats, metrics);
  }, [text, options, metrics, height, redrawKey, onRender]);

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
