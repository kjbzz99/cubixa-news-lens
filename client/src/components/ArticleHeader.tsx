/*
 * ArticleHeader — top of result page.
 *  - Renders a faux "article preview" card with the analyzed title + host.
 *  - Sits a floating violet Lens chip above it to mimic the PC Chrome
 *    extension's in-article chip overlay (the user's most-requested UX).
 */

import { Sparkles } from "lucide-react";
import { hostFromUrl } from "@/lib/analysis";

interface Props {
  title?: string;
  url?: string;
  elapsedSeconds?: number;
  cached?: boolean;
}

export function ArticleHeader({ title, url, elapsedSeconds, cached }: Props) {
  const host = hostFromUrl(url);

  return (
    <section className="relative pt-6">
      {/* Floating Lens chip — mimics the PC extension's in-article pill. */}
      <div className="relative z-10 flex justify-center -mb-5">
        <div className="cnl-floating-chip flex items-center gap-2 rounded-full px-4 py-2 text-[12px] font-semibold text-white shadow-[0_8px_24px_-12px_oklch(0.5_0.16_295/0.45)]"
          style={{
            background:
              "linear-gradient(135deg, oklch(0.55 0.16 295), oklch(0.5 0.15 300))",
          }}>
          <Sparkles className="size-3.5" strokeWidth={2.2} />
          <span>Cubixa News Lens</span>
          <span className="cnl-wordmark text-[9px] opacity-85 tracking-wider">
            검증 완료
          </span>
        </div>
      </div>

      {/* Faux article preview card */}
      <div className="cnl-card relative overflow-hidden px-5 pt-8 pb-5">
        {/* Subtle violet wash so it reads as "scanned by Lens" */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-16"
          style={{
            background:
              "linear-gradient(180deg, oklch(0.95 0.025 295 / 0.45), transparent)",
          }}
        />
        <p className="cnl-wordmark text-[10px] text-foreground/55 mb-2 relative tracking-[0.16em]">
          검증 대상 기사
        </p>
        <h2 className="font-display text-[18px] sm:text-[20px] font-semibold leading-snug relative">
          {title?.trim() || "(기사 제목을 추출하지 못했어요)"}
        </h2>
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-2 text-[12px] text-primary/80 hover:underline underline-offset-2 max-w-full"
            title={url}>
            {host && (
              <span className="rounded-full bg-secondary px-2 py-0.5 text-[10.5px] cnl-wordmark text-foreground/65">
                {host}
              </span>
            )}
            <span className="truncate">{url}</span>
          </a>
        )}
        <div className="mt-3 flex items-center gap-2 text-[10.5px] text-foreground/50 cnl-wordmark">
          {cached ? (
            <span>이전 검증 결과 재사용</span>
          ) : typeof elapsedSeconds === "number" ? (
            <span>검증 소요 {elapsedSeconds}초</span>
          ) : (
            <span>실시간 검증</span>
          )}
          <span className="text-foreground/25">·</span>
          <span>9-에이전트 검증 파이프라인</span>
        </div>
      </div>
    </section>
  );
}
