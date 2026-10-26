import { useEffect, useMemo, useRef } from "react";
import { pageCapacity, paginateLines } from "@typesetting-engine/core";
import type { LayoutOptions, LayoutResult, Line } from "@typesetting-engine/core";
import { currentDevicePixelRatio, drawLayout } from "@typesetting-engine/render-canvas";
import { pdfPageHeight } from "../lib/pdf";

type PageCanvasProps = {
  lines: Line[];
  options: LayoutOptions;
  pageHeight: number;
  firstBaseline: number;
};

function shiftedLine(line: Line, dy: number): Line {
  return {
    ...line,
    y: line.y - dy,
    glyphs: line.glyphs.map((glyph) => ({ ...glyph, y: glyph.y - dy })),
  };
}

function PageCanvas({ lines, options, pageHeight, firstBaseline }: PageCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const pageTop = (lines[0]?.y ?? firstBaseline) - firstBaseline;
    const shifted: LayoutResult = {
      lines: lines.map((line) => shiftedLine(line, pageTop)),
      height: pageHeight,
      diagnostics: [],
    };

    drawLayout(shifted, canvas, options, pageHeight, {
      dpr: currentDevicePixelRatio(),
    });
  }, [lines, options, pageHeight, firstBaseline]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: options.width, height: pageHeight }}
      aria-label="A4 页面文字"
    />
  );
}

type Props = {
  layout: LayoutResult;
  options: LayoutOptions;
  text: string;
  title: string;
  fontLabel: string;
  paperWidth: number;
};

export function PagedPreview({
  layout,
  options,
  text,
  title,
  fontLabel,
  paperWidth,
}: Props) {
  const pageHeight = pdfPageHeight(options);
  const lineBox = options.fontSize * options.lineHeight;
  const firstBaseline = layout.lines[0]?.y ?? 0;

  const pages = useMemo(() => {
    const chars = Array.from(text.replace(/\r\n?/g, "\n"));
    const capacity = pageCapacity(pageHeight, lineBox);
    return paginateLines(layout.lines, capacity, chars);
  }, [layout.lines, text, pageHeight, lineBox]);

  if (pages.length === 0) {
    return <div className="page-empty">没有可预览的页面。</div>;
  }

  return (
    <div className="page-stack">
      {pages.map((lines, index) => (
        <article className="page-sheet" style={{ width: paperWidth }} key={index}>
          <header className="page-head">
            <span>{title}</span>
            <span>
              {fontLabel} {options.fontSize} / {options.lineHeight} · A4 {index + 1} / {pages.length}
            </span>
          </header>
          <div className="page-canvas">
            <PageCanvas
              lines={lines}
              options={options}
              pageHeight={pageHeight}
              firstBaseline={firstBaseline}
            />
          </div>
          <footer className="page-foot">
            <span>毕昇 · A4 分页预览</span>
            <span>{lines.length} 行</span>
          </footer>
        </article>
      ))}
    </div>
  );
}
