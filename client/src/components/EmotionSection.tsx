/*
 * EmotionSection — emotional language + clickbait (BODY-ONLY).
 * Wrapped by CollapsibleSection.
 */

import { Zap } from "lucide-react";
import type { BackendEmotion } from "@/lib/analysis";

interface Props {
  emotion?: BackendEmotion;
}

export function EmotionSection({ emotion }: Props) {
  const phrases = emotion?.emotional_phrases ?? [];
  const mismatch = emotion?.title_body_mismatch;
  if (phrases.length === 0 && !mismatch?.is_clickbait) return null;

  return (
    <div className="space-y-4">
      {phrases.length > 0 && (
        <div>
          <p className="cnl-wordmark text-[10px] text-foreground/55 mb-2">
            감정 유도 표현 · {phrases.length}건
          </p>
          <div className="flex flex-wrap gap-1.5">
            {phrases.slice(0, 18).map((p, i) => (
              <span
                key={i}
                className={
                  p.excessive
                    ? "inline-flex items-center rounded-full px-2.5 py-1 text-[11.5px] font-medium bg-primary/12 text-primary border border-primary/15"
                    : "inline-flex items-center rounded-full px-2.5 py-1 text-[11.5px] bg-secondary text-foreground/75 border border-border/60"
                }
                title={p.context || undefined}>
                {p.phrase}
              </span>
            ))}
          </div>
        </div>
      )}

      {mismatch?.is_clickbait && (
        <div className="rounded-xl border border-[oklch(0.7_0.15_70)]/20 bg-[oklch(0.97_0.04_55)] px-4 py-3 text-[13px] leading-relaxed">
          <p className="flex items-center gap-1.5 font-semibold text-[oklch(0.4_0.16_45)]">
            <Zap className="size-3.5" strokeWidth={2} />
            낚시성 제목 의심
          </p>
          {mismatch.reason && (
            <p className="mt-1.5 text-foreground/75">{mismatch.reason}</p>
          )}
          {typeof mismatch.title_exaggeration_score === "number" && (
            <p className="mt-2 cnl-wordmark text-[10px] text-foreground/55">
              제목 과장도 {mismatch.title_exaggeration_score}/100
            </p>
          )}
        </div>
      )}
    </div>
  );
}
