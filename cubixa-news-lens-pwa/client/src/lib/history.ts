/*
 * history.ts — localStorage helper for "최근 분석 5건" panel.
 * Stores compact records (no full agent payload) so storage stays small.
 *
 * Schema versioned via STORAGE_KEY suffix; bump if shape changes.
 */

export interface HistoryEntry {
  id: string;          // hash of url+timestamp
  url: string;         // empty for body-mode
  title: string;       // resolved meta.title or "(제목 없음)"
  host: string;        // url host or "본문" for body mode
  score: number;
  verdict: string;
  analyzedAt: number;  // epoch ms
  mode: "url" | "body";
  shareId?: string;    // backend share_id for /r/:id permalink (v2+)
}

const STORAGE_KEY = "cnl:history:v1";
const MAX_ENTRIES = 50; // expanded for archive page (was 8)

function safeParse(raw: string | null): HistoryEntry[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter(
      (x) =>
        x &&
        typeof x.id === "string" &&
        typeof x.title === "string" &&
        typeof x.score === "number"
    );
  } catch {
    return [];
  }
}

export function loadHistory(): HistoryEntry[] {
  try {
    return safeParse(localStorage.getItem(STORAGE_KEY));
  } catch {
    return [];
  }
}

export function saveHistory(entries: HistoryEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
  } catch {
    /* quota exceeded or storage disabled */
  }
}

export function appendHistory(entry: HistoryEntry) {
  const list = loadHistory();
  // Dedupe by url (or by title if body-mode without url)
  const key = entry.url || entry.title;
  const next = [
    entry,
    ...list.filter((e) => (e.url || e.title) !== key),
  ].slice(0, MAX_ENTRIES);
  saveHistory(next);
  return next;
}

export function removeHistory(id: string) {
  const list = loadHistory().filter((e) => e.id !== id);
  saveHistory(list);
  return list;
}

export function clearHistory() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function makeEntryId(url: string, ts: number): string {
  // Tiny non-crypto hash; we only need uniqueness for delete operations.
  let h = 0;
  const s = `${url}|${ts}`;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h).toString(36);
}
