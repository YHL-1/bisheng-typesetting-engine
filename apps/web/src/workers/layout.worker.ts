/// <reference lib="webworker" />

import { firstBaseline, layout } from "@typesetting-engine/core";
import type {
  Diagnostic,
  LayoutOptions,
  LayoutResult,
  Line,
  Metrics,
} from "@typesetting-engine/core";
import type {
  LayoutProgress,
  LayoutRequest,
  LayoutResponse,
} from "./protocol";

const workerScope = self as unknown as DedicatedWorkerGlobalScope;

function offsetBreakReason(line: Line, offset: number): void {
  const reason = line.breakReason;
  if (!reason) return;
  reason.candidates = reason.candidates.map((candidate) => candidate + offset);
  reason.chosen += offset;
  if (reason.blockedAt !== undefined) reason.blockedAt += offset;
}

/**
 * Paragraph-by-paragraph layout. Each paragraph still goes through the same
 * `layout` entry (and its cache), but the worker can yield and report progress
 * between paragraphs. Line offsets and y positions are shifted to the combined
 * document space.
 */
function layoutIncrementally(
  text: string,
  options: LayoutOptions,
  metrics: Metrics,
  onProgress: (progress: LayoutProgress) => void,
): Promise<LayoutResult> {
  const normalized = text.replace(/\r\n?/g, "\n");
  if (normalized.length === 0) {
    onProgress({ type: "progress", done: 1, total: 1, percent: 100 });
    return Promise.resolve({ lines: [], height: 0, diagnostics: [] });
  }

  const segments = normalized.split("\n");
  const lineBox = options.fontSize * options.lineHeight;
  const base = firstBaseline(options, metrics);
  const lines: Line[] = [];
  const diagnostics: Diagnostic[] = [];
  let offset = 0;

  return (async () => {
    onProgress({ type: "progress", done: 0, total: segments.length, percent: 0 });
    await new Promise((resolve) => setTimeout(resolve, 0));

    for (let index = 0; index < segments.length; index += 1) {
      const segment = segments[index]!;
      const isLast = index === segments.length - 1;
      if (isLast && segment.length === 0 && normalized.endsWith("\n")) break;

      const characters = Array.from(segment);
      const firstLine = lines.length;

      if (characters.length === 0) {
        lines.push({
          glyphs: [],
          width: 0,
          slack: options.width,
          y: base + lines.length * lineBox,
          start: offset,
          end: offset,
        });
      } else {
        const paragraph = layout(segment, options, metrics);
        const yShift = lines.length * lineBox;

        for (const line of paragraph.lines) {
          line.y += yShift;
          for (const glyph of line.glyphs) glyph.y += yShift;
          line.start += offset;
          line.end += offset;
          offsetBreakReason(line, offset);
          lines.push(line);
        }
        for (const diagnostic of paragraph.diagnostics) {
          diagnostics.push({ ...diagnostic, line: diagnostic.line + firstLine });
        }
      }

      offset += characters.length + 1;

      // Yield regularly so progress messages can reach the main thread.
      if (index % 8 === 0 || index === segments.length - 1) {
        onProgress({
          type: "progress",
          done: index + 1,
          total: segments.length,
          percent: Math.round(((index + 1) / segments.length) * 100),
        });
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }

    return {
      lines,
      height: lines.length * lineBox,
      diagnostics,
    };
  })();
}

workerScope.onmessage = async (event: MessageEvent<LayoutRequest>) => {
  const { text, options, widths, ascent, descent } = event.data;

  const metrics: Metrics = {
    width: (ch) => widths[ch] ?? 0,
    ascent,
    descent,
  };

  const started = Date.now();
  try {
    const result = await layoutIncrementally(text, options, metrics, (progress) => {
      workerScope.postMessage(progress);
    });
    const response: LayoutResponse = {
      ok: true,
      result,
      elapsedMs: Date.now() - started,
    };
    workerScope.postMessage(response);
  } catch (error) {
    const response: LayoutResponse = {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
    workerScope.postMessage(response);
  }
};
