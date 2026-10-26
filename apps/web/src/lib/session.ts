import type { RuleSettings } from "../rules";

const KEY = "bisheng.session.v1";

export type SavedSession = {
  text: string;
  rules: Partial<RuleSettings>;
};

export function loadSession(): SavedSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null) return null;
    const record = parsed as { text?: unknown; rules?: unknown };
    if (typeof record.text !== "string") return null;
    if (typeof record.rules !== "object" || record.rules === null) return null;
    return { text: record.text, rules: record.rules as Partial<RuleSettings> };
  } catch {
    return null;
  }
}

export function saveSession(session: SavedSession): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(session));
  } catch {
    // Quota or privacy mode: autosave is best-effort.
  }
}
