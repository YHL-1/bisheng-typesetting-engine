import type { LayoutOptions, LayoutResult, Line } from "@typesetting-engine/core";
import { drawLayout } from "@typesetting-engine/render-canvas";

export function renderLayoutToCanvas(
  layout: LayoutResult,
  options: LayoutOptions,
  scale = 2,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  drawLayout(layout, canvas, options, Math.max(layout.height, 1), {
    dpr: scale,
    background: "#ffffff",
  });
  return canvas;
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Canvas toBlob returned null"));
    }, "image/png");
  });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export type LayoutJson = {
  text: string;
  options: LayoutOptions;
  lines: LayoutResult["lines"];
  diagnostics: LayoutResult["diagnostics"];
  height: number;
};

export function buildLayoutJson(
  text: string,
  options: LayoutOptions,
  layout: LayoutResult,
): LayoutJson {
  return {
    text,
    options,
    lines: layout.lines,
    diagnostics: layout.diagnostics,
    height: layout.height,
  };
}

export function downloadJson(data: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  downloadBlob(blob, filename);
}

function shiftedLine(line: Line, dy: number): Line {
  return {
    ...line,
    y: line.y - dy,
    glyphs: line.glyphs.map((glyph) => ({ ...glyph, y: glyph.y - dy })),
  };
}

/**
 * Export one PNG, or split a very tall document into line-aligned parts.
 * Each part is <= 16,384px on both sides; boundaries never cut a line.
 */
export async function exportPng(
  layout: LayoutResult,
  options: LayoutOptions,
  scale = 2,
): Promise<{ width: number; height: number; parts: number }> {
  const maxDimension = 16_384;
  const width = Math.max(1, Math.ceil(options.width * scale));
  if (width > maxDimension) {
    throw new Error("容器宽度超过 PNG 上限，请降低倍率");
  }
  if (layout.lines.length === 0) {
    throw new Error("没有可导出的内容");
  }

  const lineBox = options.fontSize * options.lineHeight;
  const firstBaseline = layout.lines[0]?.y ?? 0;
  const maxCssHeight = Math.max(
    lineBox,
    Math.floor((maxDimension - 2) / scale),
  );

  const chunks: { lines: Line[]; startTop: number; height: number }[] = [];
  let current: Line[] = [];
  let startTop = 0;

  for (const line of layout.lines) {
    const top = line.y - firstBaseline;
    const bottom = top + lineBox;

    if (current.length > 0 && bottom - startTop > maxCssHeight) {
      const last = current[current.length - 1]!;
      chunks.push({
        lines: current,
        startTop,
        height: last.y - firstBaseline + lineBox - startTop,
      });
      current = [];
      startTop = top;
    }
    if (current.length === 0) startTop = top;
    current.push(line);
  }
  if (current.length > 0) {
    const last = current[current.length - 1]!;
    chunks.push({
      lines: current,
      startTop,
      height: last.y - firstBaseline + lineBox - startTop,
    });
  }

  for (let index = 0; index < chunks.length; index += 1) {
    const chunk = chunks[index]!;
    const shifted = chunk.lines.map((line) => shiftedLine(line, chunk.startTop));
    const result: LayoutResult = {
      lines: shifted,
      height: Math.max(chunk.height, 1),
      diagnostics: [],
    };
    const canvas = renderLayoutToCanvas(result, options, scale);
    const blob = await canvasToBlob(canvas);
    const suffix = chunks.length > 1 ? `-part${String(index + 1).padStart(2, "0")}` : "";
    downloadBlob(
      blob,
      `bisheng-${width}x${Math.ceil(layout.height * scale)}@${scale}x${suffix}.png`,
    );
  }

  return {
    width,
    height: Math.ceil(layout.height * scale),
    parts: chunks.length,
  };
}
