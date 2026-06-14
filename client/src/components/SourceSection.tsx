/*
 * SourceSection — official + anonymous source breakdown (BODY-ONLY).
 * Wrapped by CollapsibleSection.
 */

import { ShieldCheck, ShieldAlert } from "lucide-react";
import type { BackendSource } from "@/lib/analysis";

interface Props {
  source?: BackendSource;
}

export function SourceSection({ source }: Props) {
  const off = source?.official_sources ?? [];
  const anon = source?.anonymous_sources ?? [];
  if (off.length === 0 && anon.length === 0 && !source?.comment) return null;

  return (
    <div className="space-y-3">
      {off.length > 0 && (
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-[oklch(0.94_0.08_155)] text-[oklch(0.32_0.13_155)]">
            <ShieldCheck className="size-3.5" strokeWidth={1.8} />
          </span>
          <div className="text-[13px] leading-relaxed flex-1">
            <p className="cnl-wordmark text-[10px] text-[oklch(0.32_0.13_155)] mb-0.5">
              공식 출처 · {off.length}곳
            </p>
            <p className="text-foreground/80">
              {off.map((s, i) => (
                <span key={i}>
                  {i > 0 && <span className="text-foreground/30 mx-1.5">·</span>}
                  {s}
                </span>
              ))}
            </p>
          </div>
        </div>
      )}

      {anon.length > 0 && (
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-[oklch(0.95_0.07_25)] text-[oklch(0.45_0.18_25)]">
            <ShieldAlert className="size-3.5" strokeWidth={1.8} />
          </span>
          <div className="text-[13px] leading-relaxed flex-1">
            <p className="cnl-wordmark text-[10px] text-[oklch(0.45_0.18_25)] mb-0.5">
              익명·불명확 · {anon.length}건
            </p>
            <p className="text-foreground/80">
              {anon.map((s, i) => (
                <span key={i}>
                  {i > 0 && <span className="text-foreground/30 mx-1.5">·</span>}
                  {s}
                </span>
              ))}
            </p>
          </div>
        </div>
      )}

      {source?.comment && (
        <p className="text-[12.5px] leading-relaxed text-foreground/60 italic border-t border-border/60 pt-3">
          {source.comment}
        </p>
      )}
    </div>
  );
}
