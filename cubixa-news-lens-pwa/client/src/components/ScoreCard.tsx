/*
 * ScoreCard — Quiet Authority centerpiece.
 * Floating big number + halo glow + verdict pill underneath.
 * Numbers in Fraunces (serif, 600), halo via .cnl-halo helper.
 */

import { useEffect, useState } from "react";
import { scoreColor, verdictTone } from "@/lib/analysis";
import { cn } from "@/lib/utils";

interface ScoreCardProps {
  score: number;
  verdictLabel?: string;
  recommendation?: string;
}

export function ScoreCard({ score, verdictLabel, recommendation }: ScoreCardProps) {
  const tone = verdictTone(verdictLabel);
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const duration = 1200;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      // ease-out quart
      const eased = 1 - Math.pow(1 - t, 4);
      setDisplay(Math.round(eased * score));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [score]);

  const toneStyles: Record<string, { bg: string; fg: string }> = {
    safe: { bg: "oklch(0.94 0.07 155)", fg: "oklch(0.32 0.12 155)" },
    caution: { bg: "oklch(0.95 0.06 95)", fg: "oklch(0.4 0.12 70)" },
    warning: { bg: "oklch(0.95 0.07 50)", fg: "oklch(0.4 0.16 45)" },
    danger: { bg: "oklch(0.95 0.06 25)", fg: "oklch(0.4 0.18 25)" },
    neutral: { bg: "oklch(0.94 0.04 295)", fg: "oklch(0.4 0.1 295)" },
  };
  const t = toneStyles[tone];
  const color = scoreColor(score);

  return (
    <div className="cnl-card relative px-6 py-10 sm:py-12 overflow-hidden">
      <div className="cnl-halo flex flex-col items-center justify-center">
        <div className="relative z-10 flex items-baseline gap-1">
          <span
            className="font-display font-semibold tabular-nums tracking-tight leading-none"
            style={{
              fontSize: "clamp(72px, 22vw, 112px)",
              color,
              fontVariationSettings: "'opsz' 144",
            }}>
            {display}
          </span>
          <span
            className="font-display text-foreground/35 leading-none"
            style={{ fontSize: "clamp(18px, 5vw, 26px)" }}>
            /100
          </span>
        </div>
        <div className="cnl-wordmark mt-2 text-[10px] text-foreground/45 relative z-10">
          OVERALL TRUST SCORE
        </div>
      </div>

      {verdictLabel && (
        <div className="mt-6 flex justify-center">
          <span
            className={cn(
              "inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium"
            )}
            style={{ background: t.bg, color: t.fg }}>
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: t.fg }}
            />
            {verdictLabel}
          </span>
        </div>
      )}

      {recommendation && (
        <p className="mt-5 mx-auto max-w-md text-center text-sm leading-relaxed text-foreground/70">
          {recommendation}
        </p>
      )}
    </div>
  );
}
