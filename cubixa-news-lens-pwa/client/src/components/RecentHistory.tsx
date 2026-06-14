/*
 * RecentHistory — shows the 5 most recent analyses on Home.
 * Tapping an entry re-runs analysis with that URL/title.
 */

import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Clock, Trash2, X, ArrowRight } from "lucide-react";
import { loadHistory, removeHistory, clearHistory, type HistoryEntry } from "@/lib/history";
import { scoreColor } from "@/lib/analysis";
import { cn } from "@/lib/utils";

interface Props {
  onPick: (entry: HistoryEntry) => void;
  refreshKey?: number;
}

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

export function RecentHistory({ onPick, refreshKey }: Props) {
  const [items, setItems] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setItems(loadHistory());
  }, [refreshKey]);

  if (items.length === 0) return null;

  return (
    <section className="mt-10 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="cnl-wordmark text-[10px] text-foreground/45 inline-flex items-center gap-1.5">
          <Clock className="size-3" strokeWidth={2} />
최근 검증 기록 · {items.length}
        </h2>
        <div className="flex items-center gap-3">
          {items.length > 5 && (
            <Link
              href="/history"
              className="cnl-wordmark text-[10px] text-primary/80 hover:text-primary inline-flex items-center gap-1">
              전체보기 · {items.length}
              <ArrowRight className="size-3" strokeWidth={2} />
            </Link>
          )}
          <button
            type="button"
            onClick={() => {
              clearHistory();
              setItems([]);
            }}
            className="cnl-wordmark text-[10px] text-foreground/40 hover:text-foreground/70 inline-flex items-center gap-1">
            <Trash2 className="size-3" strokeWidth={1.8} />
            전체 삭제
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {items.slice(0, 5).map((it) => {
          const color = scoreColor(it.score);
          return (
            <button
              key={it.id}
              type="button"
              onClick={() => onPick(it)}
              className={cn(
                "cnl-card group flex w-full items-center gap-3 px-4 py-3 text-left",
                "transition-transform hover:-translate-y-0.5"
              )}>
              {/* Score pill */}
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
                <div className="mt-1 flex items-center gap-2 cnl-wordmark text-[10px] text-foreground/50">
                  <span className="truncate min-w-0 flex-shrink">{it.host}</span>
                  <span className="text-foreground/25 shrink-0">·</span>
                  <span className="shrink-0 whitespace-nowrap">{relativeTime(it.analyzedAt)}</span>
                </div>
                {it.verdict && (
                  <span
                    className="mt-1.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium leading-none whitespace-nowrap"
                    style={{
                      background: `${color}1A`,
                      color,
                      border: `1px solid ${color}33`,
                    }}>
                    {it.verdict}
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setItems(removeHistory(it.id));
                }}
                aria-label="삭제"
                className="flex size-7 shrink-0 items-center justify-center rounded-lg text-foreground/35 hover:bg-secondary hover:text-foreground/70 opacity-0 group-hover:opacity-100 transition-opacity">
                <X className="size-3.5" strokeWidth={1.8} />
              </button>
            </button>
          );
        })}
      </div>
    </section>
  );
}
