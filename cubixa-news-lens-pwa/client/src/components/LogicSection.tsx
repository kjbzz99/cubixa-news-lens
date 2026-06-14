/*
 * LogicSection — logical issues + missing context (BODY-ONLY).
 * Designed to be wrapped by CollapsibleSection. Renders only inner content.
 */

import type { BackendLogic } from "@/lib/analysis";

interface Props {
  logic?: BackendLogic;
}

export function LogicSection({ logic }: Props) {
  const issues = logic?.logical_issues ?? [];
  const gaps = logic?.context_gaps ?? [];
  if (issues.length === 0 && gaps.length === 0) return null;

  return (
    <div className="space-y-5">
      {issues.length > 0 && (
        <div>
          <p className="cnl-wordmark text-[10px] text-foreground/55 mb-2">
            논리 비약 · {issues.length}건
          </p>
          <ol className="space-y-3">
            {issues.slice(0, 6).map((it, i) => (
              <li
                key={i}
                className="rounded-xl bg-secondary/40 px-4 py-3 border-l-2 border-primary/60">
                {it.type && (
                  <span className="inline-flex items-center text-[10.5px] cnl-wordmark text-primary/85 mb-1.5">
                    {it.type}
                  </span>
                )}
                {it.quote && (
                  <p className="font-display italic text-[13.5px] leading-snug text-foreground/85 mb-1.5">
                    “{it.quote}”
                  </p>
                )}
                {it.explanation && (
                  <p className="text-[12.5px] leading-relaxed text-foreground/65">
                    {it.explanation}
                  </p>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}

      {gaps.length > 0 && (
        <div>
          {issues.length > 0 && <div className="cnl-hairline mb-4" />}
          <p className="cnl-wordmark text-[10px] text-foreground/55 mb-2">
            맥락 누락 · {gaps.length}건
          </p>
          <ul className="space-y-2.5">
            {gaps.slice(0, 6).map((g, i) => (
              <li key={i} className="text-[13px] leading-relaxed">
                <p className="font-medium text-foreground/85">{g.missing}</p>
                {g.why_matters && (
                  <p className="mt-0.5 text-[12px] text-foreground/55">
                    {g.why_matters}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
