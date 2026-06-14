/*
 * CollapsibleSection — accordion wrapper used by ResultView for secondary
 * analysis cards (logic, emotion, source, factuality, claims).
 *
 * Design notes:
 *  - Uses a Tailwind `grid-rows-[0fr|1fr]` trick for true content-height
 *    aware open/close transitions without measuring with JS.
 *  - Toggle pill mirrors the chip in ArticleHeader to keep visual lineage
 *    with the PC extension's expanding panel feel.
 *  - `defaultOpen` lets ResultView keep the most-important cards open.
 *  - When `count` is 0, the whole card is hidden (mirrors prior behavior).
 */

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  title: string;
  count?: number | null;
  countLabel?: string;
  icon?: React.ReactNode;
  defaultOpen?: boolean;
  hidden?: boolean; // explicit override; otherwise count===0 hides
  children: React.ReactNode;
}

export function CollapsibleSection({
  title,
  count,
  countLabel,
  icon,
  defaultOpen = false,
  hidden,
  children,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const isHidden = hidden === true || count === 0;
  if (isHidden) return null;

  return (
    <section className="cnl-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left">
        <div className="flex items-center gap-2.5 min-w-0">
          {icon && (
            <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
              {icon}
            </span>
          )}
          <h3 className="font-display text-base font-semibold tracking-tight truncate">
            {title}
          </h3>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {(typeof count === "number" || countLabel) && (
            <span className="cnl-wordmark text-[10px] text-foreground/55 tabular-nums">
              {countLabel ?? `${count}건`}
            </span>
          )}
          <span
            className={cn(
              "flex size-6 items-center justify-center rounded-full bg-secondary/70 transition-transform duration-200",
              open && "rotate-180"
            )}
            aria-hidden>
            <ChevronDown className="size-3.5 text-foreground/65" strokeWidth={2} />
          </span>
        </div>
      </button>

      {/* Smooth height-aware reveal */}
      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)]",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        )}>
        <div className="min-h-0 overflow-hidden">
          <div className="px-5 pb-5 pt-0">{children}</div>
        </div>
      </div>
    </section>
  );
}
