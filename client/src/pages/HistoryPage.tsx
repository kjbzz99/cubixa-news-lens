/*
 * HistoryPage — /history 경로
 * Local-only archive of all past analyses (up to MAX_ENTRIES = 50).
 * Features:
 *  - Search across title / host / verdict (case-insensitive substring)
 *  - Sort by recency or score (asc/desc)
 *  - Tap row → open permalink (if shareId exists) or run a fresh analysis
 *  - Per-row delete + clear all
 *
 * Design: identical card surface as RecentHistory but full-page with
 * a sticky filter bar so history-heavy users keep context while scrolling.
 */
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  ArrowLeft,
  Search,
  Trash2,
  X,
  ArrowUpDown,
  ExternalLink,
} from "lucide-react";
import {
  loadHistory,
  removeHistory,
  clearHistory,
  type HistoryEntry,
} from "@/lib/history";
import { scoreColor } from "@/lib/analysis";
import { Brand } from "@/components/Brand";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SoundToggle } from "@/components/SoundToggle";
import { cn } from "@/lib/utils";

type SortMode = "recent" | "score-desc" | "score-asc";

const SORT_LABEL: Record<SortMode, string> = {
  recent: "최신순",
  "score-desc": "점수 높은순",
  "score-asc": "점수 낮은순",
};

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "방금 전";
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}일 전`;
  return new Date(ts).toLocaleDateString("ko-KR");
}

export default function HistoryPage() {
  const [, navigate] = useLocation();
  const [items, setItems] = useState<HistoryEntry[]>([]);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortMode>("recent");

  useEffect(() => {
    setItems(loadHistory());
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let arr = items;
    if (q) {
      arr = arr.filter((it) => {
        const blob = `${it.title} ${it.host} ${it.verdict} ${it.url}`.toLowerCase();
        return blob.includes(q);
      });
    }
    const sorted = [...arr];
    if (sort === "recent") {
      sorted.sort((a, b) => b.analyzedAt - a.analyzedAt);
    } else if (sort === "score-desc") {
      sorted.sort((a, b) => b.score - a.score);
    } else if (sort === "score-asc") {
      sorted.sort((a, b) => a.score - b.score);
    }
    return sorted;
  }, [items, query, sort]);

  function handlePick(it: HistoryEntry) {
    if (it.shareId) {
      navigate(`/r/${it.shareId}`);
      return;
    }
    // Fallback: re-run analysis on Home with the URL prefilled.
    if (it.url) {
      navigate(`/?url=${encodeURIComponent(it.url)}`);
    }
  }

  function nextSort() {
    setSort((s) =>
      s === "recent" ? "score-desc" : s === "score-desc" ? "score-asc" : "recent",
    );
  }

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-20 border-b border-border/40 bg-background/85 backdrop-blur-md">
        <div className="container flex items-center justify-between py-3">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex size-9 items-center justify-center rounded-xl text-foreground/60 hover:bg-secondary hover:text-foreground"
              aria-label="홈으로">
              <ArrowLeft className="size-4" strokeWidth={2} />
            </Link>
            <Brand size="sm" />
          </div>
          <div className="flex items-center gap-1.5">
            <SoundToggle />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="container max-w-3xl pt-6 pb-16">
        <div className="space-y-1.5 mb-6">
          <p className="cnl-wordmark text-[10px] text-foreground/40">
            ARCHIVE · {items.length} ANALYSES
          </p>
          <h1 className="font-display text-[28px] font-semibold tracking-tight">
            나의 신뢰도 검증 기록
          </h1>
          <p className="text-[13.5px] text-foreground/55 max-w-prose">
            이 기기에 저장된 최근 {items.length}건의 분석입니다. 다른 기기와는
            동기화되지 않으며, 영구 링크로 공유하면 어디서든 다시 열 수 있어요.
          </p>
        </div>

        {/* Sticky filter bar */}
        <div className="sticky top-[57px] z-10 -mx-4 bg-background/85 px-4 py-3 backdrop-blur-md sm:mx-0 sm:rounded-2xl sm:border sm:border-border/50 sm:px-4">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-foreground/40" />
              <input
                type="search"
                placeholder="제목, 매체, 판정으로 검색"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="h-10 w-full rounded-xl border border-border/60 bg-background/60 pl-9 pr-3 text-[13.5px] outline-none placeholder:text-foreground/35 focus:border-primary/60 focus:ring-2 focus:ring-primary/15"
              />
            </div>
            <button
              type="button"
              onClick={nextSort}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-border/60 bg-background/60 px-3 text-[12px] font-medium text-foreground/70 hover:bg-secondary"
              title="정렬 변경">
              <ArrowUpDown className="size-3.5" strokeWidth={2} />
              {SORT_LABEL[sort]}
            </button>
            {items.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  if (confirm("기록 전체를 삭제할까요?")) {
                    clearHistory();
                    setItems([]);
                  }
                }}
                className="inline-flex h-10 items-center gap-1 rounded-xl px-3 text-[12px] text-foreground/45 hover:bg-secondary hover:text-foreground/80"
                title="모두 삭제">
                <Trash2 className="size-3.5" strokeWidth={1.8} />
              </button>
            )}
          </div>
          {query && (
            <p className="cnl-wordmark mt-2 text-[10px] text-foreground/40">
              {filtered.length} / {items.length} MATCHES
            </p>
          )}
        </div>

        {/* Empty states */}
        {items.length === 0 && (
          <div className="cnl-card mt-8 px-6 py-12 text-center">
            <p className="font-display text-[16px] font-semibold mb-1">
              아직 저장된 분석이 없어요
            </p>
            <p className="text-[13px] text-foreground/55">
              홈 화면에서 기사 URL이나 본문을 분석하면 여기에 자동으로 쌓입니다.
            </p>
            <Link
              href="/"
              className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground hover:opacity-90">
              첫 분석 시작하기
              <ExternalLink className="size-3.5" strokeWidth={2} />
            </Link>
          </div>
        )}
        {items.length > 0 && filtered.length === 0 && (
          <p className="mt-10 text-center text-[13px] text-foreground/45">
            "{query}"에 해당하는 기록이 없어요.
          </p>
        )}

        {/* List */}
        <ul className="mt-4 space-y-2">
          {filtered.map((it) => {
            const color = scoreColor(it.score);
            return (
              <li key={it.id}>
                <button
                  type="button"
                  onClick={() => handlePick(it)}
                  className={cn(
                    "cnl-card group flex w-full items-center gap-3 px-4 py-3 text-left",
                    "transition-transform hover:-translate-y-0.5",
                  )}>
                  <span
                    className="flex size-12 shrink-0 flex-col items-center justify-center rounded-xl tabular-nums"
                    style={{
                      background: "white",
                      border: `1.5px solid ${color}`,
                      color,
                    }}>
                    <span className="font-display text-[18px] font-semibold leading-none">
                      {it.score}
                    </span>
                    <span className="cnl-wordmark text-[8px] opacity-70 mt-0.5">
                      /100
                    </span>
                  </span>

                  <div className="flex-1 min-w-0">
                    <p className="font-display text-[13.5px] font-medium leading-snug line-clamp-2 text-foreground/85">
                      {it.title}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 cnl-wordmark text-[10px] text-foreground/50">
                      <span>{it.host}</span>
                      <span className="text-foreground/25">·</span>
                      <span>{it.verdict || "—"}</span>
                      <span className="text-foreground/25">·</span>
                      <span>{relativeTime(it.analyzedAt)}</span>
                      {it.shareId && (
                        <>
                          <span className="text-foreground/25">·</span>
                          <span className="text-primary/80">SHARED</span>
                        </>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setItems(removeHistory(it.id));
                    }}
                    aria-label="삭제"
                    className="flex size-7 shrink-0 items-center justify-center rounded-lg text-foreground/35 hover:bg-secondary hover:text-foreground/70 opacity-60 group-hover:opacity-100 transition-opacity">
                    <X className="size-3.5" strokeWidth={1.8} />
                  </button>
                </button>
              </li>
            );
          })}
        </ul>
      </main>
    </div>
  );
}
