import type { Diagnostic, LayoutOptions, LayoutResult } from "./types";

const BLOCKED_LABEL: Record<string, string> = {
  "kinsoku-start": "下一个字是禁则首字，不能放在行首",
  "kinsoku-end": "上一个字是禁则尾字，不能留在行尾",
  word: "拉丁单词内部不允许断开",
  overflow: "找不到合法断点，只能硬断",
};

/**
 * Derive the four diagnostic classes from a finished layout.
 *
 * This is a pure pass over lines/glyphs. It never re-runs line breaking, so
 * "why did it break here" is always the engine's own data.
 */
export function diagnose(
  result: LayoutResult,
  text: string,
  opts: LayoutOptions,
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const chars = Array.from(text);
  let paragraphLines = 0;

  for (let index = 0; index < result.lines.length; index += 1) {
    const line = result.lines[index];
    if (line === undefined) continue;

    // Blank lines separate paragraphs; they do not count as a paragraph line.
    if (line.glyphs.length === 0) {
      paragraphLines = 0;
      continue;
    }

    paragraphLines += 1;
    const isParagraphEnd = line.end >= chars.length || chars[line.end] === "\n";
    const gaps = line.glyphs.length - 1;
    const extra = gaps > 0 ? line.slack / gaps : 0;
    const justifyFallback =
      opts.align === "justify" &&
      !isParagraphEnd &&
      gaps > 0 &&
      extra > opts.fontSize * 0.5;
    const justifyApplied =
      opts.align === "justify" &&
      !isParagraphEnd &&
      gaps > 0 &&
      extra <= opts.fontSize * 0.5;

    const blockedBy = line.breakReason?.blockedBy;
    if (blockedBy === "kinsoku-start" || blockedBy === "kinsoku-end") {
      const chosen = line.breakReason?.chosen ?? line.end;
      const blockedAt = line.breakReason?.blockedAt;
      const blockedChar = blockedAt === undefined ? undefined : chars[blockedAt];
      diagnostics.push({
        line: index,
        type: "kinsoku",
        detail:
          blockedChar === undefined
            ? `断点前移到第 ${chosen} 字符后：${BLOCKED_LABEL[blockedBy]}`
            : `断点前移到第 ${chosen} 字符后：第 ${blockedAt} 字符「${blockedChar}」${BLOCKED_LABEL[blockedBy]}`,
      });
    }

    const squeezed = line.glyphs.filter((glyph) => glyph.squeezed).length;
    if (squeezed > 0) {
      diagnostics.push({
        line: index,
        type: "squeeze",
        detail: `${squeezed} 个标点压缩到半角`,
      });
    }

    if (justifyFallback) {
      diagnostics.push({
        line: index,
        type: "slack",
        detail: `可拉伸余量 ${extra.toFixed(1)}px > 0.5em，已降级左对齐`,
      });
    } else if (!isParagraphEnd && !justifyApplied && line.slack > opts.width * 0.2) {
      diagnostics.push({
        line: index,
        type: "slack",
        detail: `行末余量 ${((line.slack / opts.width) * 100).toFixed(1)}% > 20%`,
      });
    }

    if (isParagraphEnd) {
      if (paragraphLines > 1 && line.width < opts.width * 0.25) {
        diagnostics.push({
          line: index,
          type: "orphan",
          detail: `段末行仅占 ${((line.width / opts.width) * 100).toFixed(1)}%，疑似孤行`,
        });
      }
      paragraphLines = 0;
    }
  }

  return diagnostics;
}
