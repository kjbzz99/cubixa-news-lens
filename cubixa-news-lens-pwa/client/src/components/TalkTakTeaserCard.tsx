/**
 * TalkTakTeaserCard — sits at the bottom of ResultView and invites the user
 * to ask follow-up questions about the article *with their voice*.
 *
 * Design: dark amber/violet gradient surface, animated wave glyph, two lines
 * of copy, single CTA. Mirrors the "re-verify" CTA card structure but with a
 * distinct visual identity so it doesn't look like a duplicate button.
 */

import { Mic, Sparkles } from "lucide-react";

interface TalkTakTeaserCardProps {
  score: number;
  verdict?: string;
  onOpen: () => void;
}

export function TalkTakTeaserCard({
  score,
  verdict,
  onOpen,
}: TalkTakTeaserCardProps) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="cnl-card group relative w-full overflow-hidden px-5 py-4 text-left transition-transform hover:-translate-y-0.5 active:scale-[0.99]"
      style={{
        transitionDuration: "200ms",
        transitionTimingFunction: "cubic-bezier(0.23, 1, 0.32, 1)",
      }}>
      {/* Decorative gradient blobs */}
      <span
        aria-hidden
        className="pointer-events-none absolute -right-8 -top-10 size-32 rounded-full opacity-60"
        style={{
          background:
            "radial-gradient(closest-side, rgba(167,139,250,0.40), transparent 70%)",
        }}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute -left-12 bottom-[-40px] size-36 rounded-full opacity-40"
        style={{
          background:
            "radial-gradient(closest-side, rgba(245,158,11,0.30), transparent 70%)",
        }}
      />

      <div className="relative flex items-start gap-3">
        {/* Animated mic glyph */}
        <span className="relative flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary">
          <span className="absolute inset-0 rounded-2xl bg-primary/15 animate-ping opacity-50" />
          <Mic className="relative size-5" strokeWidth={2} />
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="cnl-wordmark text-[10px] tracking-[0.18em] text-primary/85">
              TALK TAK · BETA
            </span>
            <span className="inline-flex items-center gap-0.5 rounded-full bg-primary/12 px-1.5 py-[1px] text-[9.5px] font-semibold text-primary">
              <Sparkles className="size-2.5" strokeWidth={2} />
              NEW
            </span>
          </div>
          <p className="mt-0.5 font-display text-[14.5px] font-semibold leading-tight">
            이 기사에 대해 음성으로 물어보세요
          </p>
          <p className="mt-1 text-[12px] text-foreground/65 leading-relaxed">
            <span className="text-foreground/85">
              "이 기사 어떻게 생각해?"
            </span>{" "}
            처럼 자유롭게 질문하면 분석 결과(
            <span className="tabular-nums text-foreground/75">
              {score}
            </span>
            점{verdict ? ` · ${verdict}` : ""})를 근거로 답해드려요.
          </p>
          <span className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-xl bg-primary px-4 text-[12.5px] font-medium text-primary-foreground transition-transform group-hover:translate-x-0.5">
            <Mic className="size-3.5" strokeWidth={2} />
            대화 시작
          </span>
        </div>
      </div>
    </button>
  );
}
