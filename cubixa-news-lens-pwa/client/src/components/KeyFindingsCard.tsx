/*
 * KeyFindingsCard — top-line readable take of the analysis.
 *  - reader_advisory rendered as a soft yellow highlight box.
 *  - key_findings as a numbered list with serif numerals.
 */

import { AlertTriangle, KeyRound } from "lucide-react";
import type { BackendRisk } from "@/lib/analysis";

interface Props {
  risk?: BackendRisk;
}

export function KeyFindingsCard({ risk }: Props) {
  if (!risk) return null;
  const findings = risk.key_findings ?? [];
  if (findings.length === 0 && !risk.reader_advisory) return null;

  return (
    <section className="cnl-card overflow-hidden">
      {risk.reader_advisory && (
        <div className="px-5 py-4 border-l-[3px] bg-amber-50 border-l-amber-300 dark:bg-amber-500/10 dark:border-l-amber-400/70">
          <p className="cnl-wordmark text-[10px] mb-1.5 flex items-center gap-1.5 text-amber-700 dark:text-amber-300">
            <AlertTriangle className="size-3" strokeWidth={2} />
            독자 주의사항
          </p>
          <p className="text-[13.5px] leading-relaxed text-amber-950/90 dark:text-amber-50/95">
            {risk.reader_advisory}
          </p>
        </div>
      )}

      {findings.length > 0 && (
        <div className="px-5 py-5">
          <header className="flex items-baseline justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
                <KeyRound className="size-3.5" strokeWidth={1.7} />
              </span>
              <h3 className="font-display text-base font-semibold tracking-tight">
                핵심 발견
              </h3>
            </div>
            <span className="cnl-wordmark text-[10px] text-foreground/45 tabular-nums">
              {findings.length}건
            </span>
          </header>
          <ol className="space-y-3">
            {findings.map((f, i) => (
              <li key={i} className="flex gap-3">
                <span className="font-display text-[20px] font-semibold leading-none text-primary tabular-nums shrink-0">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <p className="text-[13.5px] leading-relaxed text-foreground/85 pt-0.5">
                  {f}
                </p>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}
