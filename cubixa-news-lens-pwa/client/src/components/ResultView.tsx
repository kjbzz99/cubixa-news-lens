/*
 * ResultView — full analysis result page composition (v1.3).
 *
 * Changes from v1.2:
 *  - Secondary cards (logic / emotion / source / factuality / claims) are now
 *    wrapped in <CollapsibleSection/> for compact mobile reveal.
 *  - "Save as image" button captures a designed <ShareCard/> to PNG.
 *  - Persists each successful analysis to localStorage history.
 */

import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  RefreshCcw,
  ImageDown,
  Sparkles,
  ScanLine,
  Tags,
  ShieldCheck,
  Zap,
  ListOrdered,
} from "lucide-react";
import { toPng } from "html-to-image";
import { toast } from "sonner";

import type { BackendAnalysisResponse } from "@/lib/analysis";
import { hostFromUrl, buildShareUrl } from "@/lib/analysis";
import { appendHistory, makeEntryId } from "@/lib/history";

import { ScoreCard } from "./ScoreCard";
import { ArticleHeader } from "./ArticleHeader";
import { AgentMetricsGrid } from "./AgentMetricsGrid";
import { KeyFindingsCard } from "./KeyFindingsCard";
import { LogicSection } from "./LogicSection";
import { EmotionSection } from "./EmotionSection";
import { SourceSection } from "./SourceSection";
import { FactualitySection } from "./FactualitySection";
import { ClaimsSection } from "./ClaimsSection";
import { CollapsibleSection } from "./CollapsibleSection";
import { ShareBar } from "./ShareBar";
import { ShareCard } from "./ShareCard";
import { EmbedSnippets } from "./EmbedSnippets";
import { Brand } from "./Brand";
import { ThemeToggle } from "./ThemeToggle";
import { TalkTakTeaserCard } from "./TalkTakTeaserCard";
import { TalkTakModal } from "./TalkTakModal";

interface ResultViewProps {
  result: BackendAnalysisResponse;
  sourceUrl: string;
  onBack: () => void;
  onRerun: () => void;
}

export function ResultView({
  result,
  sourceUrl,
  onBack,
  onRerun,
}: ResultViewProps) {
  const risk = result.risk;
  const score = risk?.overall_trust_score ?? 0;
  const shareCardRef = useRef<HTMLDivElement>(null);
  const [capturing, setCapturing] = useState(false);
  const [talkTakOpen, setTalkTakOpen] = useState(false);

  // Scroll to top when result mounts so users on mobile (whose viewport is
  // sitting near the bottom of the input area) immediately see the score.
  useEffect(() => {
    if (typeof window === "undefined") return;
    // Use rAF + behavior:auto to avoid the smooth scroll being interrupted by
    // layout shifts as collapsibles / charts mount.
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    });
  }, [result]);

  // Persist to history once per result
  useEffect(() => {
    if (!result.meta) return;
    const ts = Date.now();
    const entry = {
      id: makeEntryId(sourceUrl || result.meta.title || "anon", ts),
      url: sourceUrl,
      title: result.meta.title || "(제목 없음)",
      host: sourceUrl ? hostFromUrl(sourceUrl) || "본문" : "본문",
      score,
      verdict: risk?.verdict_label || "",
      analyzedAt: ts,
      mode: (sourceUrl ? "url" : "body") as "url" | "body",
      shareId: result.share_id,
    };
    appendHistory(entry);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  const reco = [
    risk?.distortion_risk ? `왜곡 가능성 ${risk.distortion_risk}` : null,
    risk?.reader_misperception_risk
      ? `독자 오인 위험 ${risk.reader_misperception_risk}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  async function saveImage() {
    if (capturing) return; // double-click guard
    if (!shareCardRef.current) {
      toast.error("이미지 카드를 준비 중입니다");
      return;
    }
    setCapturing(true);

    /**
     * Wraps a promise with a hard timeout. Critical because html-to-image will
     * sometimes silently hang while waiting on cross-origin font fetches on
     * mobile networks, leaving the button stuck on "이미지 만드는 중…".
     */
    function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
      return new Promise<T>((resolve, reject) => {
        const t = setTimeout(
          () => reject(new Error(`${label} timeout after ${ms}ms`)),
          ms,
        );
        p.then(
          (v) => {
            clearTimeout(t);
            resolve(v);
          },
          (e) => {
            clearTimeout(t);
            reject(e);
          },
        );
      });
    }

    try {
      // 1) Wait for fonts so the captured image isn't a fallback. Cap at 4s.
      if (typeof document !== "undefined" && "fonts" in document) {
        await withTimeout(
          document.fonts.ready as Promise<unknown>,
          4000,
          "폰트 로드",
        ).catch(() => null);
      }
      // 2) Make sure layout is flushed.
      await new Promise((r) => requestAnimationFrame(() => r(null)));

      // 3) First attempt: full quality with embedded fonts.
      const sharedOpts = {
        pixelRatio: 1,
        cacheBust: false,
        backgroundColor: "#f6f3fb",
      } as const;

      let dataUrl: string;
      try {
        dataUrl = await withTimeout(
          toPng(shareCardRef.current, sharedOpts),
          12000,
          "이미지 생성",
        );
      } catch (firstErr) {
        // Fallback: skip embedding fonts — captured image will use system
        // fallbacks but at least the user gets *something* instead of an
        // infinite "만드는 중".
        console.warn("[saveImage] retry with skipFonts:", firstErr);
        dataUrl = await withTimeout(
          toPng(shareCardRef.current, { ...sharedOpts, skipFonts: true }),
          8000,
          "이미지 생성(폰트 제외)",
        );
      }

      const safeTitle = (result.meta?.title || "cubixa-news-lens")
        .replace(/[\s/?<>:"\\|*]+/g, "-")
        .slice(0, 40);
      const filename = `cubixa-${safeTitle}-${score}.png`;

      // Try Web Share API first — on iOS Safari & Android Chrome this opens
      // the native share sheet (KakaoTalk / X / saved photos / files) so the
      // user doesn't have to re-attach a downloaded PNG. Falls back to plain
      // download if unsupported, blocked, or the user cancels.
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], filename, { type: "image/png" });
      const nav = navigator as Navigator & {
        canShare?: (data: { files: File[] }) => boolean;
      };
      const canNativeShare =
        typeof navigator !== "undefined" &&
        typeof navigator.share === "function" &&
        typeof nav.canShare === "function" &&
        nav.canShare({ files: [file] });

      if (canNativeShare) {
        try {
          await navigator.share({
            files: [file],
            title: result.meta?.title || "Cubixa News Lens 신뢰도 분석",
            text: `신뢰도 ${score}/100 · ${result.risk?.verdict_label ?? ""}`.trim(),
          });
          toast.success("공유 완료");
          return;
        } catch (shareErr) {
          // User cancelled or share blocked — fall through to download.
          if (
            shareErr instanceof Error &&
            shareErr.name === "AbortError"
          ) {
            return; // silent: user cancelled the share sheet
          }
          console.warn("[saveImage] navigator.share failed:", shareErr);
        }
      }

      // Plain download fallback (desktop browsers, unsupported devices)
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success("이미지를 저장했어요");
    } catch (e) {
      console.error(e);
      const msg = e instanceof Error ? e.message : "알 수 없는 오류";
      toast.error("이미지 저장에 실패했어요", {
        description: msg.includes("timeout")
          ? "네트워크가 느려 폰트 로드가 오래 걸렸어요. Wi-Fi에서 다시 시도해 주세요."
          : msg,
      });
    } finally {
      setCapturing(false);
    }
  }

  return (
    <div className="cnl-mist min-h-screen pb-32">
      {/* Sticky compact header */}
      <header className="sticky top-0 z-30 backdrop-blur-md bg-background/70 border-b border-border/40">
        <div className="container flex items-center justify-between py-3">
          <button
            type="button"
            onClick={onBack}
            aria-label="뒤로가기"
            className="-ml-2 flex size-9 items-center justify-center rounded-lg hover:bg-secondary">
            <ArrowLeft className="size-5" strokeWidth={1.8} />
          </button>
          <Brand size="sm" showUtta={false} />
          <div className="flex items-center gap-0.5">
            <ThemeToggle className="size-9 bg-transparent shadow-none hover:bg-secondary" />
            <button
              type="button"
              onClick={saveImage}
              disabled={capturing}
              aria-label="이미지로 저장"
              className="flex size-9 items-center justify-center rounded-lg hover:bg-secondary disabled:opacity-50">
              <ImageDown className="size-4" strokeWidth={1.8} />
            </button>
            <button
              type="button"
              onClick={onRerun}
              aria-label="다시 분석"
              className="-mr-2 flex size-9 items-center justify-center rounded-lg hover:bg-secondary">
              <RefreshCcw className="size-4" strokeWidth={1.8} />
            </button>
          </div>
        </div>
      </header>

      <main className="container space-y-4">
        <ArticleHeader
          title={result.meta?.title}
          url={sourceUrl}
          elapsedSeconds={result.meta?.elapsed_seconds}
          cached={result.cached}
        />

        <ScoreCard
          score={score}
          verdictLabel={risk?.verdict_label}
          recommendation={reco || undefined}
        />

        <AgentMetricsGrid
          source={result.source}
          logic={result.logic}
          emotion={result.emotion}
          factuality={result.factuality}
          risk={result.risk}
        />

        {/* Always-open most-important findings */}
        <KeyFindingsCard risk={risk} />

        {/* Collapsible secondary cards */}
        <CollapsibleSection
          title="논리 비약 · 맥락 누락"
          count={
            (result.logic?.logical_issues?.length ?? 0) +
            (result.logic?.context_gaps?.length ?? 0)
          }
          icon={<ScanLine className="size-3.5" strokeWidth={1.8} />}
          defaultOpen={false}>
          <LogicSection logic={result.logic} />
        </CollapsibleSection>

        <CollapsibleSection
          title="감정·낚시성 표현"
          count={
            (result.emotion?.emotional_phrases?.length ?? 0) +
            (result.emotion?.title_body_mismatch?.is_clickbait ? 1 : 0)
          }
          icon={<Zap className="size-3.5" strokeWidth={1.8} />}
          defaultOpen={false}>
          <EmotionSection emotion={result.emotion} />
        </CollapsibleSection>

        <CollapsibleSection
          title="출처 분석"
          count={
            (result.source?.official_sources?.length ?? 0) +
            (result.source?.anonymous_sources?.length ?? 0)
          }
          icon={<ShieldCheck className="size-3.5" strokeWidth={1.8} />}
          defaultOpen={false}>
          <SourceSection source={result.source} />
        </CollapsibleSection>

        <CollapsibleSection
          title="사실성 검증"
          count={result.factuality?.results?.length ?? 0}
          icon={<Sparkles className="size-3.5" strokeWidth={1.8} />}
          defaultOpen={false}>
          <FactualitySection
            factuality={result.factuality}
            evidence={result.evidence}
          />
        </CollapsibleSection>

        <CollapsibleSection
          title="주장 분해"
          count={result.claims?.length ?? 0}
          icon={<Tags className="size-3.5" strokeWidth={1.8} />}
          defaultOpen={false}>
          <ClaimsSection claims={result.claims} />
        </CollapsibleSection>

        {/* Inline tertiary save-image CTA (in addition to header icon) */}
        <button
          type="button"
          onClick={saveImage}
          disabled={capturing}
          className="cnl-card flex w-full items-center justify-between px-5 py-4 transition-transform hover:-translate-y-0.5 disabled:opacity-60">
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary/12 text-primary">
              <ImageDown className="size-4" strokeWidth={1.9} />
            </span>
            <div className="text-left">
              <p className="font-display text-[14px] font-semibold tracking-tight">
                {capturing ? "이미지 만드는 중…" : "이미지로 저장하기"}
              </p>
              <p className="text-[11.5px] text-foreground/55">
                점수 카드를 PNG로 저장 · SNS에 그대로 올리기
              </p>
            </div>
          </div>
          {capturing ? (
            <span className="cnl-dots">
              <span />
              <span />
              <span />
              <span />
            </span>
          ) : (
            <span className="cnl-wordmark text-[10px] text-foreground/45 flex items-center gap-1">
              <ListOrdered className="size-3" strokeWidth={1.8} />
              1080×1350
            </span>
          )}
        </button>

        <ShareBar
          url={
            sourceUrl ||
            (typeof window !== "undefined" ? window.location.href : "")
          }
          shareUrl={
            result.share_id ? buildShareUrl(result.share_id) : undefined
          }
          score={score}
          verdictLabel={risk?.verdict_label}
        />

        {/* Embed snippets for publishers — only when permanent share link exists */}
        {result.share_id && <EmbedSnippets shareId={result.share_id} />}

        {/* Talk Tak voice companion — ask follow-up questions about THIS article */}
        <TalkTakTeaserCard
          score={score}
          verdict={risk?.verdict_label}
          onOpen={() => setTalkTakOpen(true)}
        />

        {/* Re-verify CTA — trust in the trust score itself */}
        <section className="cnl-card relative overflow-hidden px-5 py-4">
          <div
            aria-hidden
            className="pointer-events-none absolute -left-10 -top-10 size-32 rounded-full opacity-50"
            style={{
              background:
                "radial-gradient(closest-side, rgba(167,139,250,0.35), transparent 70%)",
            }}
          />
          <div className="relative flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary">
              <RefreshCcw className="size-4" strokeWidth={1.9} />
            </span>
            <div className="flex-1 min-w-0">
              <p className="cnl-wordmark text-[10px] text-primary/80 mb-0.5">
                RE-VERIFY · 이 분석, 진짜인가요?
              </p>
              <p className="font-display text-[14px] font-semibold leading-tight">
                동일 기사를 새로 분석해서 점수 재확인
              </p>
              <p className="mt-1 text-[12px] text-foreground/60 leading-relaxed">
                Cubixa의 점수 자체가 믿기지 않다면,
                동일한 주소로 다시 분석해서 결과가 재현되는지 확인해보세요.
              </p>
              <button
                type="button"
                onClick={onRerun}
                className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-xl bg-primary px-4 text-[12.5px] font-medium text-primary-foreground hover:opacity-90">
                <RefreshCcw className="size-3.5" strokeWidth={2} />
                지금 다시 검증하기
              </button>
            </div>
          </div>
        </section>

        <footer className="pt-6 pb-2 flex flex-col items-center gap-1.5 text-center">
          <Brand size="sm" />
          <p className="text-[11px] text-foreground/40 cnl-wordmark">
            CUBIXA NEWS LENS · UTTA AI
          </p>
          <p className="text-[10px] text-foreground/35 cnl-wordmark">
            TALK TAK · 맥락·의도 기반 오케스트레이션 · 상표 출원 / 특허 4건 출원 (KR)
          </p>
        </footer>
      </main>

      {/* Talk Tak voice modal */}
      <TalkTakModal
        open={talkTakOpen}
        onClose={() => setTalkTakOpen(false)}
        result={result}
        sourceUrl={sourceUrl}
      />

      {/* Off-screen capture surface — must remain in DOM for html-to-image */}
      <div
        aria-hidden
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          transform: "translate(-200vw, -200vh)",
          pointerEvents: "none",
          zIndex: -1,
          width: 1080,
          height: 1350,
        }}>
        <ShareCard ref={shareCardRef} result={result} sourceUrl={sourceUrl} />
      </div>
    </div>
  );
}
