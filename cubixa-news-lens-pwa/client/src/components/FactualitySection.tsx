/*
 * FactualitySection — claim-by-claim verification + evidence (BODY-ONLY).
 * Wrapped by CollapsibleSection.
 */

import { ExternalLink } from "lucide-react";
import type {
  BackendFactuality,
  BackendEvidenceItem,
} from "@/lib/analysis";

interface Props {
  factuality?: BackendFactuality;
  evidence?: Record<string | number, BackendEvidenceItem[]>;
}

const verdictTone: Record<
  string,
  { fg: string; bg: string; border: string }
> = {
  사실확인: {
    fg: "oklch(0.32 0.13 155)",
    bg: "oklch(0.96 0.05 155)",
    border: "oklch(0.55 0.12 155)",
  },
  사실: {
    fg: "oklch(0.32 0.13 155)",
    bg: "oklch(0.96 0.05 155)",
    border: "oklch(0.55 0.12 155)",
  },
  사실충돌: {
    fg: "oklch(0.4 0.18 25)",
    bg: "oklch(0.96 0.05 25)",
    border: "oklch(0.62 0.22 25)",
  },
  허위: {
    fg: "oklch(0.4 0.18 25)",
    bg: "oklch(0.96 0.05 25)",
    border: "oklch(0.62 0.22 25)",
  },
  추가검증필요: {
    fg: "oklch(0.4 0.16 45)",
    bg: "oklch(0.96 0.06 50)",
    border: "oklch(0.62 0.22 50)",
  },
  일부사실: {
    fg: "oklch(0.4 0.16 45)",
    bg: "oklch(0.96 0.06 50)",
    border: "oklch(0.62 0.22 50)",
  },
  확인불가: {
    fg: "oklch(0.45 0.025 285)",
    bg: "oklch(0.96 0.012 295)",
    border: "oklch(0.7 0.02 285)",
  },
  미확인: {
    fg: "oklch(0.45 0.025 285)",
    bg: "oklch(0.96 0.012 295)",
    border: "oklch(0.7 0.02 285)",
  },
};

function pickTone(verdict?: string) {
  if (!verdict) return verdictTone["미확인"];
  for (const k of Object.keys(verdictTone)) {
    if (verdict.includes(k)) return verdictTone[k];
  }
  return verdictTone["미확인"];
}

export function FactualitySection({ factuality, evidence }: Props) {
  const findings = factuality?.results ?? [];
  const allEv = evidence ? Object.values(evidence).flat().slice(0, 6) : [];
  if (findings.length === 0 && allEv.length === 0 && !factuality?.summary)
    return null;

  return (
    <div className="space-y-4">
      {factuality?.summary && (
        <p className="text-[13px] leading-relaxed text-foreground/65 italic">
          {factuality.summary}
        </p>
      )}

      {findings.length > 0 && (
        <ul className="space-y-2">
          {findings.slice(0, 8).map((f, i) => {
            const t = pickTone(f.verdict);
            return (
              <li
                key={i}
                className="rounded-xl px-4 py-3 border-l-[3px]"
                style={{ background: t.bg, borderLeftColor: t.border }}>
                <p
                  className="cnl-wordmark text-[10px] mb-1"
                  style={{ color: t.fg }}>
                  {f.verdict || "미확인"}
                </p>
                {(f.reasoning || f.reason) && (
                  <p className="text-[13px] leading-relaxed text-foreground/80">
                    {f.reasoning || f.reason}
                  </p>
                )}
                {f.evidence_quotes && f.evidence_quotes.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {f.evidence_quotes.slice(0, 2).map((q, j) => (
                      <li
                        key={j}
                        className="text-[11.5px] italic text-foreground/55 pl-2 border-l border-border/60">
                        “{q}”
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {allEv.length > 0 && (
        <div>
          <div className="cnl-hairline mb-3" />
          <p className="cnl-wordmark text-[10px] text-foreground/55 mb-2">
            참조 자료 · TAVILY · {allEv.length}개
          </p>
          <ul className="space-y-2">
            {allEv.map((e, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-[12.5px] leading-snug">
                <ExternalLink
                  className="size-3 mt-0.5 shrink-0 text-foreground/35"
                  strokeWidth={2}
                />
                <a
                  href={e.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-foreground/80 hover:text-primary hover:underline underline-offset-2 break-all">
                  {e.title || e.url}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
