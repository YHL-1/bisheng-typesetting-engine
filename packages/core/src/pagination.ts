import type { Line } from "./types";

/**
 * Lines per page. One line is reserved so the widow-control pass can move a
 * line forward without overflowing the page box.
 */
export function pageCapacity(pageHeight: number, lineBox: number): number {
  if (!Number.isFinite(pageHeight) || pageHeight <= 0) return 1;
  if (!Number.isFinite(lineBox) || lineBox <= 0) return 1;
  return Math.max(1, Math.floor(pageHeight / lineBox) - 1);
}

function endsParagraph(line: Line, chars: readonly string[]): boolean {
  return line.end >= chars.length || chars[line.end] === "\n";
}

/**
 * Split lines into pages without letting a line cross a page boundary.
 *
 * Widow control: if a page would start with the last line of a paragraph and
 * the previous page has more than one line, the previous line moves forward so
 * the paragraph ends with at least two lines on the new page. This is the
 * "段末一行单独成页 → 拉回上一页" rule from the plan.
 */
export function paginateLines(
  lines: readonly Line[],
  capacity: number,
  chars: readonly string[],
): Line[][] {
  const size = Math.max(1, Math.floor(capacity));
  const pages: Line[][] = [];

  for (let index = 0; index < lines.length; index += size) {
    pages.push(lines.slice(index, index + size));
  }

  for (let page = 1; page < pages.length; page += 1) {
    const first = pages[page]?.[0];
    const previous = pages[page - 1];
    if (!first || !previous || previous.length <= 1) continue;
    if (!endsParagraph(first, chars)) continue;

    const moved = previous.pop();
    if (moved) pages[page]!.unshift(moved);
  }

  return pages;
}
