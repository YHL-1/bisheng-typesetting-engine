import { pageCapacity, paginateLines } from "@typesetting-engine/core";
import type { LayoutOptions, LayoutResult, Line } from "@typesetting-engine/core";
import { canvasToBlob, downloadBlob, renderLayoutToCanvas } from "./export";

const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
const PAGE_MARGIN = 36;
const CONTENT_WIDTH = A4_WIDTH - PAGE_MARGIN * 2;
const CONTENT_HEIGHT = A4_HEIGHT - PAGE_MARGIN * 2;

/** CSS height of one A4 content area when the text measure is `options.width`. */
export function pdfPageHeight(options: LayoutOptions): number {
  const scale = CONTENT_WIDTH / options.width;
  return CONTENT_HEIGHT / scale;
}

function pageResult(
  lines: Line[],
  pageHeight: number,
  firstBaseline: number,
): LayoutResult {
  const pageTop = (lines[0]?.y ?? firstBaseline) - firstBaseline;
  const shifted = lines.map((line) => ({
    ...line,
    y: line.y - pageTop,
    glyphs: line.glyphs.map((glyph) => ({ ...glyph, y: glyph.y - pageTop })),
  }));

  return {
    lines: shifted,
    height: pageHeight,
    diagnostics: [],
  };
}

export async function exportPdf(
  layout: LayoutResult,
  options: LayoutOptions,
  text: string,
  scale = 2,
): Promise<{ pages: number }> {
  if (layout.lines.length === 0) {
    throw new Error("没有可导出的内容");
  }

  const normalized = text.replace(/\r\n?/g, "\n");
  const chars = Array.from(normalized);
  const pageHeight = pdfPageHeight(options);
  const lineBox = options.fontSize * options.lineHeight;
  const capacity = pageCapacity(pageHeight, lineBox);
  const pages = paginateLines(layout.lines, capacity, chars);

  // PDF is an on-demand path; keep pdf-lib out of the initial bundle.
  const { PDFDocument } = await import("pdf-lib");
  const pdf = await PDFDocument.create();
  const firstBaseline = layout.lines[0]?.y ?? 0;

  for (const pageLines of pages) {
    if (pageLines.length === 0) continue;

    const result = pageResult(pageLines, pageHeight, firstBaseline);
    const canvas = renderLayoutToCanvas(result, options, scale);
    const pngBytes = await (await canvasToBlob(canvas)).arrayBuffer();
    const image = await pdf.embedPng(pngBytes);

    const page = pdf.addPage([A4_WIDTH, A4_HEIGHT]);
    page.drawImage(image, {
      x: PAGE_MARGIN,
      y: PAGE_MARGIN,
      width: CONTENT_WIDTH,
      height: CONTENT_HEIGHT,
    });
  }

  const bytes = await pdf.save();
  downloadBlob(
    new Blob([new Uint8Array(bytes)], { type: "application/pdf" }),
    `bisheng-${pages.length}p.pdf`,
  );

  return { pages: pages.length };
}

/**
 * Text PDF: embeds the uploaded TTF/OTF with fontkit and draws each glyph at
 * its laid-out x/y. Text is selectable/searchable; the font is subsetted.
 */
export async function exportTextPdf(
  layout: LayoutResult,
  options: LayoutOptions,
  text: string,
  fontBytes: ArrayBuffer,
): Promise<{ pages: number }> {
  if (layout.lines.length === 0) {
    throw new Error("没有可导出的内容");
  }

  const { PDFDocument, rgb } = await import("pdf-lib");
  const fontkitModule = await import("@pdf-lib/fontkit");
  const fontkit = (fontkitModule.default ?? fontkitModule) as never;

  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(new Uint8Array(fontBytes), { subset: false });

  const normalized = text.replace(/\r\n?/g, "\n");
  const chars = Array.from(normalized);
  const pageHeight = pdfPageHeight(options);
  const lineBox = options.fontSize * options.lineHeight;
  const capacity = pageCapacity(pageHeight, lineBox);
  const pages = paginateLines(layout.lines, capacity, chars);
  const firstBaseline = layout.lines[0]?.y ?? 0;
  const scale = CONTENT_WIDTH / options.width;

  for (const pageLines of pages) {
    if (pageLines.length === 0) continue;
    const page = pdf.addPage([A4_WIDTH, A4_HEIGHT]);
    const pageTop = (pageLines[0]?.y ?? firstBaseline) - firstBaseline;

    for (const line of pageLines) {
      const textLine = line.glyphs.map((glyph) => glyph.ch).join("");
      if (textLine.length === 0) continue;
      page.drawText(textLine, {
        x: PAGE_MARGIN + (line.glyphs[0]?.x ?? 0) * scale,
        y: A4_HEIGHT - PAGE_MARGIN - (line.y - pageTop) * scale,
        size: options.fontSize * scale,
        font,
        color: rgb(0, 0, 0),
      });
    }
  }

  const bytes = await pdf.save();
  downloadBlob(
    new Blob([new Uint8Array(bytes)], { type: "application/pdf" }),
    `bisheng-text-${pages.length}p.pdf`,
  );

  return { pages: pages.length };
}
