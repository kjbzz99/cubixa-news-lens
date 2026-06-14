/*
 * HeadlineFeed — "오늘의 헤드라인" section on Home.
 *
 * Design philosophy: Quiet Authority.
 *  - Headlines come from publisher RSS (legal pull); only title + dek + link.
 *  - Trust scores are Cubixa's own analysis cache (24h TTL), shown as a
 *    rounded chip beside the source tag.
 *  - Tapping a card with a cached share_id navigates to /r/:id (no recompute).
 *  - Tapping an un-analyzed card calls onAnalyze(url) to trigger the existing
 *    /analyze flow on Home.
 *  - Deliberately no images, no body cache: this is a verification ledger,
 *    not an editorial portal.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { RefreshCw, Loader2, AlertCircle } from "lucide-react";
import {
  fetchFeed,
  refreshFeed,
  relativeTime,
  scoreColor,
  type FeedItem,
} from "@/lib/analysis";
import { cn } from "@/lib/utils";

interface Props {
  /** Triggered when user taps an unverified card (no share_id yet). */
  onAnalyze: (url: string, title?: string) => void;
  /** Bumped from parent after each successful analysis to refetch scores. */
  refreshKey?: number;
  /** URL currently being analyzed (so we can render a per-card loader). */
  pendingUrl?: string;
}

const SOURCE_COLORS: Record<string, string> = {
  // 통신사
  연합뉴스: "oklch(0.55 0.08 250)",
  뉴시스: "oklch(0.55 0.1 215)",
  // 종합일간지
  한겨레: "oklch(0.55 0.18 25)",
  경향신문: "oklch(0.5 0.15 30)",
  조선일보: "oklch(0.45 0.05 260)",
  중앙일보: "oklch(0.5 0.18 280)",
  동아일보: "oklch(0.5 0.18 250)",
  국민일보: "oklch(0.55 0.16 70)",
  // 경제
  매일경제: "oklch(0.5 0.16 50)",
  한국경제: "oklch(0.5 0.18 35)",
  연합인포맥스: "oklch(0.5 0.14 240)",
  // 방송
  JTBC: "oklch(0.5 0.16 300)",
  SBS: "oklch(0.55 0.18 50)",
  MBC: "oklch(0.5 0.15 200)",
  KBS: "oklch(0.5 0.18 230)",
  YTN: "oklch(0.5 0.18 20)",
  // 온라인
  오마이뉴스: "oklch(0.55 0.15 145)",
  프레시안: "oklch(0.5 0.15 100)",
  // 시사·비평
  시사인: "oklch(0.5 0.16 320)",
  미디어오늘: "oklch(0.5 0.15 340)",
  // IT
  "ZDNet 코리아": "oklch(0.5 0.18 195)",
  // 해외
  "BBC 코리아": "oklch(0.45 0.18 15)",
  // 레거시
  뉴스1: "oklch(0.55 0.1 220)",
};

function sourceTone(name: string): string {
  return SOURCE_COLORS[name] ?? "oklch(0.5 0.05 270)";
}

function ScoreChip({
  score,
  verdict,
}: {
  score?: number | null;
  verdict?: string | null;
}) {
  if (typeof score !== "number") {
    return (
      <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-secondary-foreground/55 cnl-wordmark">
        UNVERIFIED
      </span>
    );
  }
  const color = scoreColor(score);
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
      style={{
        background: `color-mix(in oklch, ${color} 14%, transparent)`,
        color,
      }}
    >
      <span className="font-display text-[12px] tabular-nums">{score}</span>
      {verdict ? <span className="text-[10px] opacity-80">{verdict}</span> : null}
    </span>
  );
}

function CardSkeleton() {
  return (
    <div className="cnl-card animate-pulse px-4 py-3.5">
      <div className="flex items-center gap-2">
        <div className="h-3 w-12 rounded-full bg-secondary" />
        <div className="ml-auto h-3 w-10 rounded-full bg-secondary" />
      </div>
      <div className="mt-2.5 h-4 w-[88%] rounded bg-secondary" />
      <div className="mt-1.5 h-3 w-[70%] rounded bg-secondary" />
    </div>
  );
}

export function HeadlineFeed({ onAnalyze, refreshKey, pendingUrl }: Props) {
  const [, navigate] = useLocation();
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ctrlRef = useRef<AbortController | null>(null);
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(async () => {
    ctrlRef.current?.abort();
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;
    setError(null);
    try {
      const data = await fetchFeed(40, ctrl.signal);
      setItems(data.items || []);
    } catch (err) {
      if ((err as { name?: string }).name === "AbortError") return;
      const msg = err instanceof Error ? err.message : "네트워크 오류";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch + polling every 5 minutes
  useEffect(() => {
    setLoading(true);
    load();
    const id = window.setInterval(load, 5 * 60 * 1000);
    return () => {
      window.clearInterval(id);
      ctrlRef.current?.abort();
    };
  }, [load]);

  // Refetch after parent finishes a new analysis (so cached score appears)
  useEffect(() => {
    if (!refreshKey) return;
    load();
  }, [refreshKey, load]);

  async function handleManualRefresh() {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await refreshFeed();
      await load();
    } catch {
      /* swallow — load() will surface its own error */
    } finally {
      setRefreshing(false);
    }
  }

  function handleTap(item: FeedItem) {
    if (item.share_id) {
      navigate(`/r/${item.share_id}`);
      return;
    }
    onAnalyze(item.url, item.title);
  }

  const visible = useMemo(
    () => (showAll ? items : items.slice(0, 12)),
    [items, showAll]
  );

  return (
    <section className="mt-10 space-y-3" aria-label="오늘의 헤드라인">
      <header className="flex items-end justify-between gap-3">
        <div>
          <p className="cnl-wordmark text-[10px] text-foreground/55 tracking-[0.16em]">
            오늘 · 사회적 검증 기록
          </p>
          <h2 className="font-display text-[20px] font-semibold tracking-tight">
            오늘의 헤드라인
          </h2>
        </div>
        <button
          type="button"
          onClick={handleManualRefresh}
          disabled={refreshing}
          className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-[11px] font-medium text-secondary-foreground hover:bg-accent disabled:opacity-50"
          aria-label="새로고침"
        >
          <RefreshCw
            className={cn("size-3.5", refreshing && "animate-spin")}
            strokeWidth={2}
          />
          새로고침
        </button>
      </header>

      <p className="text-[11.5px] leading-relaxed text-foreground/55">
        헤드라인은 매체 RSS에서 가져오며, 신뢰도 점수는 Cubixa의 9-에이전트
        분석 결과입니다. <strong className="text-foreground/70">미분석</strong>
        칩을 탭하면 즉시 검증을 시작합니다.
      </p>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : error ? (
        <div className="cnl-card flex items-start gap-3 px-4 py-4 text-[13px]">
          <AlertCircle
            className="mt-0.5 size-4 shrink-0 text-foreground/50"
            strokeWidth={1.7}
          />
          <div>
            <p className="font-medium">헤드라인을 불러오지 못했어요.</p>
            <p className="mt-0.5 text-[12px] text-foreground/55">{error}</p>
            <button
              type="button"
              onClick={load}
              className="mt-2 rounded-full bg-secondary px-3 py-1 text-[11px] font-medium text-secondary-foreground hover:bg-accent"
            >
              다시 시도
            </button>
          </div>
        </div>
      ) : items.length === 0 ? (
        <div className="cnl-card px-4 py-6 text-center text-[13px] text-foreground/55">
          아직 수집된 헤드라인이 없습니다. 잠시 후 다시 시도해 주세요.
        </div>
      ) : (
        <>
          <ul className="space-y-2">
            {visible.map((item) => {
              const isPending = pendingUrl && pendingUrl === item.url;
              const tone = sourceTone(item.source);
              const when = relativeTime(item.fetched_at, item.published);
              return (
                <li key={item.url}>
                  <button
                    type="button"
                    onClick={() => handleTap(item)}
                    disabled={Boolean(isPending)}
                    className={cn(
                      "cnl-card group relative w-full px-4 py-3.5 text-left transition-transform",
                      "hover:-translate-y-0.5 hover:shadow-md",
                      "active:scale-[0.99]",
                      isPending && "opacity-70"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-tight"
                        style={{
                          background: `color-mix(in oklch, ${tone} 12%, transparent)`,
                          color: tone,
                        }}
                      >
                        {item.source}
                      </span>
                      {when ? (
                        <span className="text-[11px] text-foreground/45">
                          {when}
                        </span>
                      ) : null}
                      <span className="ml-auto">
                        {isPending ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-foreground/60">
                            <Loader2
                              className="size-3 animate-spin"
                              strokeWidth={2}
                            />
                            분석 중
                          </span>
                        ) : (
                          <ScoreChip
                            score={item.score}
                            verdict={item.verdict}
                          />
                        )}
                      </span>
                    </div>
                    <p className="mt-2 font-display text-[15px] font-semibold leading-snug tracking-tight text-foreground line-clamp-2">
                      {item.title}
                    </p>
                    {item.summary ? (
                      <p className="mt-1 text-[12.5px] leading-relaxed text-foreground/55 line-clamp-2">
                        {item.summary}
                      </p>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>

          {items.length > 12 ? (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => setShowAll((v) => !v)}
                className="rounded-full bg-secondary px-4 py-1.5 text-[11px] font-medium text-secondary-foreground hover:bg-accent"
              >
                {showAll ? "접기" : `더 보기 (${items.length - 12})`}
              </button>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
