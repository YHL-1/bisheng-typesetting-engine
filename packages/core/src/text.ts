/** Characters excluding all whitespace, matching the counter in the workbench. */
export function countChars(text: string): number {
  return text.replace(/\s/g, "").length;
}

/** Paragraphs are separated by one or more blank lines. */
export function countParagraphs(text: string): number {
  return text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0).length;
}
