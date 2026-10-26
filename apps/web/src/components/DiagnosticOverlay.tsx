import { useEffect, useRef } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import type { Diagnostic, LayoutOptions, LayoutResult } from "@typesetting-engine/core";
import { computeCanvasSize, currentDevicePixelRatio } from "@typesetting-engine/render-canvas";

type Props = {
  layout: LayoutResult;
  options: LayoutOptions;
  height: number;
  ascent: number;
  scrollTop?: number;
  selectedLine: number;
  ignoredTypes: ReadonlySet<Diagnostic["type"]>;
  onSelectLine: (line: number) => void;
};

const COLORS = {
  selectedFill: "rgba(180, 64, 42, 0.06)",
  selectedBorder: "rgba(180, 64, 42, 0.35)",
  kinsoku: "#B4402A",
  squeeze: "#D98B76",
  slack: "#B9801F",
  orphan: "#2F6B63",
};

export function DiagnosticOverlay({
  layout,
  options,
  height,
  ascent,
  scrollTop = 0,
  selectedLine,
  ignoredTypes,
  onSelectLine,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const size = computeCanvasSize(
      options.width,
      height,
      currentDevicePixelRatio(),
    );
    canvas.width = size.width;
    canvas.height = size.height;
    canvas.style.width = `${size.cssWidth}px`;
    canvas.style.height = `${size.cssHeight}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.setTransform(size.dpr, 0, 0, size.dpr, 0, 0);
    ctx.clearRect(0, 0, size.cssWidth, size.cssHeight);

    const lineBox = options.fontSize * options.lineHeight;
    const firstBaseline = ascent + (lineBox - options.fontSize) / 2;
    const topOf = (line: LayoutResult["lines"][number]) =>
      line.y - firstBaseline - scrollTop;
    const visible = (top: number) => top + lineBox >= 0 && top <= height;

    if (selectedLine >= 0 && selectedLine < layout.lines.length) {
      const line = layout.lines[selectedLine];
      if (line) {
        const top = topOf(line);
        if (visible(top)) {
          ctx.fillStyle = COLORS.selectedFill;
          ctx.fillRect(0, top, options.width, lineBox);
          ctx.strokeStyle = COLORS.selectedBorder;
          ctx.lineWidth = 1;
          ctx.strokeRect(0.5, top + 0.5, options.width - 1, lineBox - 1);
        }
      }
    }

    const byLine = new Map<number, Diagnostic[]>();
    for (const diagnostic of layout.diagnostics) {
      if (ignoredTypes.has(diagnostic.type)) continue;
      const list = byLine.get(diagnostic.line) ?? [];
      list.push(diagnostic);
      byLine.set(diagnostic.line, list);
    }

    for (const [index, diagnostics] of byLine) {
      const line = layout.lines[index];
      if (!line) continue;

      const top = topOf(line);
      if (!visible(top)) continue;
      const firstX = line.glyphs[0]?.x ?? 0;
      const types = new Set(diagnostics.map((diagnostic) => diagnostic.type));

      if (types.has("kinsoku")) {
        const x = Math.max(2, firstX - 13);
        ctx.fillStyle = COLORS.kinsoku;
        ctx.beginPath();
        ctx.moveTo(x, top + 2);
        ctx.lineTo(x + 8, top + 2);
        ctx.lineTo(x + 4, top + 9);
        ctx.closePath();
        ctx.fill();
      }

      if (types.has("squeeze")) {
        ctx.fillStyle = COLORS.squeeze;
        for (const glyph of line.glyphs) {
          if (!glyph.squeezed) continue;
          ctx.fillRect(
            glyph.x,
            top + options.fontSize * 0.18,
            Math.max(2, glyph.w - 1),
            2,
          );
        }
      }

      if (types.has("slack")) {
        ctx.fillStyle = COLORS.slack;
        ctx.fillRect(
          Math.min(options.width - 3, line.width),
          top + options.fontSize * 0.25,
          3,
          options.fontSize * 0.8,
        );
      }

      if (types.has("orphan")) {
        ctx.fillStyle = COLORS.orphan;
        ctx.beginPath();
        ctx.arc(Math.max(5, firstX - 9), top + options.fontSize * 0.65, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }, [layout, options, height, ascent, scrollTop, selectedLine, ignoredTypes]);

  const handleClick = (event: ReactMouseEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const lineBox = options.fontSize * options.lineHeight;
    const index = Math.floor((event.clientY - rect.top + scrollTop) / lineBox);
    if (index >= 0 && index < layout.lines.length) onSelectLine(index);
  };

  return (
    <canvas
      ref={canvasRef}
      className="diagnostic-overlay"
      style={{ width: options.width, height }}
      onClick={handleClick}
      aria-label="诊断标记层，点击行查看断点原因"
    />
  );
}
