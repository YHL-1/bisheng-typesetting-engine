import { useEffect, useRef, useState } from "react";
import type { UIEvent as ReactUIEvent } from "react";
import type {
  Diagnostic,
  LayoutOptions,
  LayoutResult,
} from "@typesetting-engine/core";
import { drawLayoutViewport } from "@typesetting-engine/render-canvas";
import { DiagnosticOverlay } from "./DiagnosticOverlay";

type Props = {
  layout: LayoutResult;
  options: LayoutOptions;
  height: number;
  ascent: number;
  showGlyphWidths: boolean;
  showLineNumbers: boolean;
  diagnosticsOpen: boolean;
  selectedLine: number;
  ignoredTypes: ReadonlySet<Diagnostic["type"]>;
  onSelectLine: (line: number) => void;
};

/**
 * D6 virtual paper: the document is `layout.height` tall, but only the canvas
 * viewport is rasterised. Scroll events are collapsed to one paint per frame.
 */
export function VirtualPreview({
  layout,
  options,
  height,
  ascent,
  showGlyphWidths,
  showLineNumbers,
  diagnosticsOpen,
  selectedLine,
  ignoredTypes,
  onSelectLine,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const pendingTop = useRef(0);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const maxScroll = Math.max(layout.height - height, 0);
    const offset = Math.min(Math.max(scrollTop, 0), maxScroll);

    drawLayoutViewport(layout, canvas, options, {
      scrollTop: offset,
      viewportHeight: height,
      showGlyphWidths,
    });
  }, [layout, options, height, scrollTop, showGlyphWidths]);

  useEffect(() => {
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, []);

  const handleScroll = (event: ReactUIEvent<HTMLDivElement>) => {
    pendingTop.current = event.currentTarget.scrollTop;
    if (frame.current !== null) return;

    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      setScrollTop(pendingTop.current);
    });
  };

  const lineBox = options.fontSize * options.lineHeight;
  const firstBaseline = ascent + (lineBox - options.fontSize) / 2;
  const visibleLines = showLineNumbers
    ? layout.lines
        .map((line, index) => ({
          index,
          top: line.y - firstBaseline - scrollTop,
        }))
        .filter((line) => line.top >= -lineBox && line.top <= height)
    : [];

  return (
    <div
      className="virtual-viewport"
      style={{ height }}
      onScroll={handleScroll}
    >
      <div className="virtual-paper" style={{ height: Math.max(layout.height, height) }}>
        <div className="virtual-sticky" style={{ height }}>
          <canvas
            ref={canvasRef}
            className="preview-canvas"
            style={{ width: options.width, height }}
            role="img"
            aria-label="大文档排版预览"
          />
          {diagnosticsOpen ? (
            <DiagnosticOverlay
              layout={layout}
              options={options}
              height={height}
              ascent={ascent}
              scrollTop={scrollTop}
              selectedLine={selectedLine}
              ignoredTypes={ignoredTypes}
              onSelectLine={onSelectLine}
            />
          ) : null}
          {showLineNumbers ? (
            <div className="virtual-line-numbers" style={{ height }} aria-hidden="true">
              {visibleLines.map((line) => (
                <span key={line.index} style={{ top: line.top }}>
                  {line.index + 1}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
