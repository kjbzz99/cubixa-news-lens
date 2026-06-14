/**
 * Cubixa News Lens — analysis API client.
 * Calls POST {apiBase}/analyze with either {url} or {body, title}.
 *
 * IMPORTANT: response shape mirrors news-trust-backend/server.py
 * run_pipeline() output exactly. Do not invent fields here.
 */

import { getApiBase } from "./config";

// ────────────────────────────────────────────────────────────
// Backend response — direct mirror of server.py run_pipeline()
// ────────────────────────────────────────────────────────────

export interface BackendMeta {
  title: string;
  elapsed_seconds: number;
  model: string;
}

export interface BackendClaim {
  id: number | string;
  text: string;
  type?: string;
  verifiable?: boolean;
  search_query?: string;
}

export interface BackendEvidenceItem {
  title?: string;
  url?: string;
  content?: string;
  score?: number;
}

export interface BackendFactualityFinding {
  claim_id?: number | string;
  verdict?: string; // "사실|일부사실|미확인|허위"
  reasoning?: string;
  /** Legacy field name from older backend builds. */
  reason?: string;
  confidence?: number;
  evidence_quotes?: string[];
}

export interface BackendFactuality {
  results?: BackendFactualityFinding[];
  summary?: string;
}

export interface BackendSource {
  official_sources?: string[];
  anonymous_sources?: string[];
  source_clarity_score?: number;
  comment?: string;
}

export interface BackendLogicIssue {
  type?: string;
  quote?: string;
  explanation?: string;
}

export interface BackendContextGap {
  missing?: string;
  why_matters?: string;
}

export interface BackendLogic {
  logical_issues?: BackendLogicIssue[];
  context_gaps?: BackendContextGap[];
  logic_score?: number;
}

export interface BackendEmotionalPhrase {
  phrase?: string;
  context?: string;
  excessive?: boolean;
}

export interface BackendTitleMismatch {
  is_clickbait?: boolean;
  title_exaggeration_score?: number;
  reason?: string;
}

export interface BackendEmotion {
  emotional_phrases?: BackendEmotionalPhrase[];
  title_body_mismatch?: BackendTitleMismatch;
  emotion_risk_score?: number;
}

export interface BackendRisk {
  overall_trust_score?: number;
  distortion_risk?: string; // "낮음|보통|높음|매우높음"
  reader_misperception_risk?: string;
  verdict_label?: string; // "신뢰가능|일부주의|왜곡위험|허위가능성"
  key_findings?: string[];
  reader_advisory?: string;
}

export interface BackendAnalysisResponse {
  meta?: BackendMeta;
  claims?: BackendClaim[];
  evidence?: Record<string | number, BackendEvidenceItem[]>;
  factuality?: BackendFactuality;
  source?: BackendSource;
  logic?: BackendLogic;
  emotion?: BackendEmotion;
  risk?: BackendRisk;
  cached?: boolean;
  /** Permanent shareable id minted by backend on /analyze success */
  share_id?: string;
  /** Echoes the original url submitted (when /analyze was called with url) */
  source_url?: string | null;
}

// ────────────────────────────────────────────────────────────
// Request
// ────────────────────────────────────────────────────────────

export interface AnalyzeOptions {
  url?: string;
  text?: string; // body text directly pasted
  title?: string;
  signal?: AbortSignal;
}

export async function analyzeArticle(
  options: AnalyzeOptions
): Promise<BackendAnalysisResponse> {
  const base = getApiBase();
  const body: Record<string, unknown> = {};
  if (options.url) body.url = options.url;
  if (options.text) body.body = options.text;
  if (options.title) body.title = options.title;

  let res: Response;
  try {
    res = await fetch(`${base}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: options.signal,
    });
  } catch (e) {
    // Network-level failure (DNS/TLS/offline). Surface a Korean message the
    // UI can render without users seeing raw "Failed to fetch".
    const detail = e instanceof Error ? e.message : "";
    throw new Error(
      detail.includes("abort")
        ? "\uBD84\uC11D\uC774 \uCDE8\uC18C\uB418\uC5C8\uC5B4\uC694."
        : "\uB124\uD2B8\uC6CC\uD06C\uAC00 \uBD88\uC548\uC815\uD574\uC694. \uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574 \uC8FC\uC138\uC694.",
    );
  }

  if (!res.ok) {
    let detail = `${res.status}`;
    try {
      const data = await res.json();
      detail = data.detail || data.error || JSON.stringify(data);
    } catch {
      detail = await res.text().catch(() => `${res.status}`);
    }
    if (res.status === 502 || res.status === 503 || res.status === 504) {
      throw new Error(
        "\uBD84\uC11D \uC11C\uBC84\uAC00 \uC77C\uC2DC\uC801\uC73C\uB85C \uC751\uB2F5\uD558\uC9C0 \uC54A\uC544\uC694. \uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574 \uC8FC\uC138\uC694.",
      );
    }
    throw new Error(detail);
  }

  return (await res.json()) as BackendAnalysisResponse;
}

/**
 * Fetch a previously stored analysis by its short share_id.
 * Throws if the id no longer exists (e.g. backend restarted).
 */
export async function fetchSharedResult(
  shareId: string,
  signal?: AbortSignal
): Promise<BackendAnalysisResponse> {
  const base = getApiBase();
  let res: Response;
  try {
    res = await fetch(`${base}/r/${encodeURIComponent(shareId)}`, { signal });
  } catch (e) {
    const detail = e instanceof Error ? e.message : "";
    throw new Error(
      detail.includes("abort")
        ? "\uCDE8\uC18C\uB418\uC5C8\uC5B4\uC694."
        : "\uB124\uD2B8\uC6CC\uD06C\uAC00 \uBD88\uC548\uC815\uD574\uC694. \uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574 \uC8FC\uC138\uC694.",
    );
  }
  if (!res.ok) {
    let detail = `${res.status}`;
    try {
      const data = await res.json();
      detail = data.detail || JSON.stringify(data);
    } catch {
      detail = await res.text().catch(() => `${res.status}`);
    }
    throw new Error(detail);
  }
  return (await res.json()) as BackendAnalysisResponse;
}

/** Returns the user-facing permalink to a shared result. */
export function buildShareUrl(shareId: string): string {
  if (typeof window === "undefined") return `/r/${shareId}`;
  return `${window.location.origin}/r/${shareId}`;
}

// ────────────────────────────────────────────────────────────
// View helpers
// ────────────────────────────────────────────────────────────

export function verdictTone(label?: string):
  | "safe"
  | "caution"
  | "warning"
  | "danger"
  | "neutral" {
  if (!label) return "neutral";
  if (label.includes("허위")) return "danger";
  if (label.includes("왜곡") || label.includes("매우높음")) return "warning";
  if (label.includes("일부") || label.includes("주의") || label.includes("높음")) return "caution";
  if (label.includes("신뢰") || label.includes("낮음")) return "safe";
  return "neutral";
}

export function scoreTone(
  score: number
): "safe" | "caution" | "warning" | "danger" {
  if (score >= 75) return "safe";
  if (score >= 55) return "caution";
  if (score >= 35) return "warning";
  return "danger";
}

export function scoreColor(score: number): string {
  if (score >= 75) return "oklch(0.55 0.12 155)";
  if (score >= 55) return "oklch(0.7 0.15 95)";
  if (score >= 35) return "oklch(0.62 0.22 50)";
  return "oklch(0.6 0.22 25)";
}

export function hostFromUrl(url?: string): string {
  if (!url) return "";
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return "";
  }
}

// Risk score is an "expressed concern" measure on backend (high = bad).
// We invert into a 0..100 trust signal for the bar chart only.
export function trustFromEmotion(emotionRisk?: number): number {
  if (typeof emotionRisk !== "number") return 50;
  return Math.max(0, Math.min(100, 100 - emotionRisk));
}

export function trustFromTitleExag(titleExag?: number): number {
  if (typeof titleExag !== "number") return 50;
  return Math.max(0, Math.min(100, 100 - titleExag));
}


// ────────────────────────────────────────────────────────────
// RSS Headline Feed (GET /feed) — v2.1
// ────────────────────────────────────────────────────────────

export interface FeedItem {
  url: string;
  title: string;
  summary: string;
  source: string;
  source_tag: string;
  /** ISO 8601 string from publisher (may be empty) */
  published: string;
  /** unix seconds when we polled */
  fetched_at: number;
  /** present iff this URL has a recent cached score */
  score?: number | null;
  verdict?: string | null;
  share_id?: string | null;
  analyzed_at?: number | null;
}

export interface FeedResponse {
  items: FeedItem[];
  /** Optional source list (some backends include this for filtering UI) */
  sources?: string[];
}

export async function fetchFeed(
  limit = 30,
  signal?: AbortSignal
): Promise<FeedResponse> {
  const base = getApiBase();
  let res: Response;
  try {
    res = await fetch(`${base}/feed?limit=${limit}`, { signal });
  } catch (e) {
    const detail = e instanceof Error ? e.message : "";
    throw new Error(
      detail.includes("abort")
        ? "\uCDE8\uC18C\uB418\uC5C8\uC5B4\uC694."
        : "\uB124\uD2B8\uC6CC\uD06C\uAC00 \uBD88\uC548\uC815\uD574\uC694. \uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574 \uC8FC\uC138\uC694.",
    );
  }
  if (!res.ok) {
    if (res.status === 502 || res.status === 503 || res.status === 504) {
      throw new Error(
        "\uD5E4\uB4DC\uB77C\uC778 \uC11C\uBC84\uAC00 \uC7A0\uC2DC \uC751\uB2F5\uD558\uC9C0 \uC54A\uC544\uC694. \uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574 \uC8FC\uC138\uC694.",
      );
    }
    throw new Error(`feed ${res.status}`);
  }
  return (await res.json()) as FeedResponse;
}

export async function refreshFeed(signal?: AbortSignal): Promise<number> {
  const base = getApiBase();
  let res: Response;
  try {
    res = await fetch(`${base}/feed/refresh`, {
      method: "POST",
      signal,
    });
  } catch (e) {
    const detail = e instanceof Error ? e.message : "";
    throw new Error(
      detail.includes("abort")
        ? "\uCDE8\uC18C\uB418\uC5C8\uC5B4\uC694."
        : "\uB124\uD2B8\uC6CC\uD06C\uAC00 \uBD88\uC548\uC815\uD574\uC694. \uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574 \uC8FC\uC138\uC694.",
    );
  }
  if (!res.ok) {
    if (res.status === 502 || res.status === 503 || res.status === 504) {
      throw new Error(
        "\uC11C\uBC84\uAC00 \uC7A0\uC2DC \uC751\uB2F5\uD558\uC9C0 \uC54A\uC544\uC694. \uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574 \uC8FC\uC138\uC694.",
      );
    }
    throw new Error(`refresh ${res.status}`);
  }
  const data = (await res.json()) as { refreshed?: number };
  return data.refreshed ?? 0;
}

/** Format a unix timestamp as relative Korean time. */
export function relativeTime(unixSec?: number | null, isoStr?: string): string {
  let t = 0;
  if (typeof unixSec === "number" && unixSec > 0) {
    t = unixSec * 1000;
  } else if (isoStr) {
    const parsed = Date.parse(isoStr);
    if (!Number.isNaN(parsed)) t = parsed;
  }
  if (!t) return "";
  const diff = Date.now() - t;
  if (diff < 0) return "방금";
  const min = Math.floor(diff / 60000);
  if (min < 1) return "방금";
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}일 전`;
  return new Date(t).toLocaleDateString("ko-KR", {
    month: "numeric",
    day: "numeric",
  });
}
