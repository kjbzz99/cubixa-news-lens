/**
 * Cubixa News Lens — runtime configuration.
 *
 * v3.7+: All news-trust backend calls now go through *our* Express server at
 * `/api/*` (see `server/index.ts`). This avoids:
 *   - "Failed to fetch" on mobile carriers/DNS that block the temporary
 *     sandbox URL `*.manus.computer`.
 *   - Brittle CORS configuration.
 *   - Frontend re-bundles when the upstream URL rotates.
 *
 * Power users can still point the PWA at a different *direct* backend URL
 * by storing it in localStorage under `cnl:apiBase`. When set, the client
 * will hit that URL with no `/api` prefix (legacy direct-call behaviour).
 */

const STORAGE_KEY = "cnl:apiBase";

/** Returned base URL for analysis endpoints. */
export function getApiBase(): string {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && /^https?:\/\//.test(stored)) return stored.replace(/\/+$/, "");
  } catch {
    /* SSR or storage disabled */
  }
  // Same-origin Express proxy. In dev (Vite) the same path is served by the
  // middleware in `server/index.ts` registered under Vite's connect server,
  // so this works in both `pnpm dev` and production.
  return "/api";
}

/** Returns true when calls should go through our same-origin proxy. */
export function isProxiedBase(): boolean {
  const base = getApiBase();
  return base === "/api";
}

export function setApiBase(value: string) {
  try {
    if (value) localStorage.setItem(STORAGE_KEY, value.replace(/\/+$/, ""));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
