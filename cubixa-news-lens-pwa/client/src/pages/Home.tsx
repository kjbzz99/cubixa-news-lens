/*
 * Home page — Cubixa News Lens PWA.
 * Style: Quiet Authority (mist white background, violet accent halo,
 * Fraunces × Pretendard × Space Grotesk pairing).
 *
 * Behavior:
 *  - On mount, parse query params from /share (PWA share target) or from
 *    direct deep link (?url=...) and pre-fill the URL field.
 *  - Submit POSTs the URL to the existing FastAPI /analyze backend.
 *  - On success, render <ResultView/> which composes the analysis cards.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Settings2, ShieldCheck } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SoundToggle } from "@/components/SoundToggle";
import { UserMenu } from "@/components/UserMenu";
import { useLocation } from "wouter";
import { toast } from "sonner";

import { Brand } from "@/components/Brand";
import { UrlInput, type UrlInputSubmit } from "@/components/UrlInput";
import { ResultView } from "@/components/ResultView";
import { ApiBaseDialog } from "@/components/ApiBaseDialog";
import { RecentHistory } from "@/components/RecentHistory";
import { HeadlineFeed } from "@/components/HeadlineFeed";
import { AnalyzingOverlay } from "@/components/AnalyzingOverlay";
import { InstallPrompt } from "@/components/InstallPrompt";
import { analyzeArticle, type BackendAnalysisResponse } from "@/lib/analysis";
import type { HistoryEntry } from "@/lib/history";

const HERO_IMAGE =
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663564581020/J3ebzGvRREzwtrT8dcBfmK/hero-violet-mist-62GbWwkkY8k8RUMPN9z4kW.webp";

interface SharedPayload {
  url?: string;
  text?: string;
  title?: string;
}

function parseShared(search: string): SharedPayload {
  const params = new URLSearchParams(search);
  const url = params.get("url") ?? "";
  const text = params.get("text") ?? "";
  const title = params.get("title") ?? "";

  // Some Android intents put the URL inside `text` field
  let bestUrl = url;
  if (!bestUrl && text) {
    const m = text.match(/https?:\/\/\S+/);
    if (m) bestUrl = m[0];
  }
  return { url: bestUrl, text, title };
}

export default function Home() {
  const [location] = useLocation();
  const [shared, setShared] = useState<SharedPayload>({});
  const [autoSubmit, setAutoSubmit] = useState(false);
  const [loading, setLoading] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [result, setResult] = useState<BackendAnalysisResponse | null>(null);
  const [activeUrl, setActiveUrl] = useState("");
  const [activeBody, setActiveBody] = useState("");
  const [activeTitle, setActiveTitle] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Parse share-target / deep-link params on first mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    const payload = parseShared(window.location.search);
    if (payload.url || payload.text) {
      setShared(payload);
      setAutoSubmit(Boolean(payload.url));
    }
  }, [location]);



  async function runAnalysis(payload: UrlInputSubmit | string) {
    if (loading) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    // Normalize: string (re-run) → infer kind by URL pattern.
    const normalized: UrlInputSubmit =
      typeof payload === "string"
        ? {
            kind: /^https?:\/\//i.test(payload) ? "url" : "body",
            value: payload,
          }
        : payload;

    setLoading(true);
    setActiveUrl(normalized.kind === "url" ? normalized.value : "");
    setActiveBody(normalized.kind === "body" ? normalized.value : "");
    setActiveTitle(normalized.title ?? "");

    try {
      const res = await analyzeArticle({
        url: normalized.kind === "url" ? normalized.value : undefined,
        text: normalized.kind === "body" ? normalized.value : undefined,
        title: normalized.title,
        signal: ctrl.signal,
      });
      // Trigger celebratory completion: 700ms cascade, then swap to results
      setCompleting(true);
      await new Promise((r) => setTimeout(r, 700));
      setResult(res);
      setCompleting(false);
    } catch (err) {
      if ((err as { name?: string }).name === "AbortError") return;
      const msg = err instanceof Error ? err.message : "알 수 없는 오류";
      toast.error("분석 실패", {
        description:
          normalized.kind === "url"
            ? `${msg} — 본문 붙여넣기 모드를 시도해 보세요.`
            : msg,
      });
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setResult(null);
    setActiveUrl("");
    setAutoSubmit(false);
    abortRef.current?.abort();
  }

  const initial = useMemo(
    () => shared.url || shared.text || "",
    [shared]
  );

  if (result) {
    return (
      <ResultView
        result={result}
        sourceUrl={activeUrl}
        onBack={reset}
        onRerun={() => {
          if (!activeUrl) return;
          setResult(null);
          runAnalysis(activeUrl);
        }}
      />
    );
  }

  return (
    <div className="cnl-mist relative min-h-screen overflow-hidden">
      {/* Top-right floating actions */}
      <div className="absolute right-4 top-4 z-20 flex items-center gap-2">
        <SoundToggle />
        <ThemeToggle />
        <UserMenu />
        <button
          type="button"
          onClick={() => setShowSettings(true)}
          aria-label="설정"
          className="flex size-9 items-center justify-center rounded-full bg-card/70 backdrop-blur shadow-sm hover:bg-card">
          <Settings2 className="size-4 text-foreground/60" strokeWidth={1.7} />
        </button>
      </div>

      <div className="container pt-20 pb-24 sm:pt-10">
        {/* Hero */}
        <section className="mb-7 flex flex-col items-start gap-5">
          <Brand size="md" />

          <div className="relative w-full overflow-hidden rounded-3xl">
            <img
              src={HERO_IMAGE}
              alt=""
              className="h-44 w-full object-cover object-center sm:h-56"
              loading="eager"
              fetchPriority="high"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/60 via-background/10 to-transparent" />
          </div>

          <div className="space-y-2.5">
            <h1 className="font-display text-[28px] font-semibold leading-tight tracking-tight sm:text-[34px]">
              기사 한 줄 붙여넣기로
              <br />
              <span className="text-primary">신뢰도 검증.</span>
            </h1>
            <p className="text-[14px] leading-relaxed text-foreground/65">
              복수 AI 에이전트가 출처·논리·감정·제목 일치도까지 9단계로
              분석합니다. 의심스러운 기사 URL을 붙여넣어 보세요.
            </p>
          </div>
        </section>

        {/* Input */}
        <UrlInput
          initialValue={initial}
          loading={loading}
          autoSubmit={autoSubmit}
          onSubmit={runAnalysis}
        />

        {/* Today's verified headlines (RSS + cached scores) */}
        <HeadlineFeed
          refreshKey={result ? 1 : 0}
          pendingUrl={loading ? activeUrl : undefined}
          onAnalyze={(url, title) => {
            runAnalysis({ kind: "url", value: url, title });
          }}
        />

        {/* Recent analyses */}
        <RecentHistory
          refreshKey={result ? 1 : 0}
          onPick={(entry: HistoryEntry) => {
            if (entry.url) {
              runAnalysis({ kind: "url", value: entry.url });
            } else {
              setShared({ text: entry.title });
            }
          }}
        />

        {/* Trust pitch — 4 short cards */}
        <section className="mt-10 space-y-3">
          <h2 className="cnl-wordmark text-[10px] text-foreground/45">
            HOW IT WORKS
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {features.map((f) => (
              <div
                key={f.title}
                className="cnl-card px-4 py-4 transition-transform hover:-translate-y-0.5">
                <p className="font-display text-sm font-semibold tracking-tight">
                  {f.title}
                </p>
                <p className="mt-1 text-[12.5px] leading-relaxed text-foreground/60">
                  {f.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Privacy / install hints */}
        <section className="mt-10 cnl-card flex items-start gap-3 px-4 py-4">
          <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
            <ShieldCheck className="size-4" strokeWidth={1.7} />
          </span>
          <div className="text-[13px] leading-relaxed text-foreground/70">
            <p>
              <strong className="font-semibold text-foreground/90">
                홈 화면에 추가
              </strong>
              하면 어떤 뉴스 앱에서든 <em>공유 → Cubixa</em>로 즉시 분석할 수
              있어요.
            </p>
            <p className="mt-1 text-foreground/55 text-[12px]">
              iPhone: Safari 공유 → 홈 화면에 추가 · Android: 메뉴 → 앱 설치
            </p>
          </div>
        </section>

        <footer className="mt-12 flex flex-col items-center gap-2 text-center">
          <a
            href="#analyze"
            onClick={(e) => {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-4 py-2 text-[12px] font-medium text-secondary-foreground hover:bg-accent">
            지금 시작하기
            <ArrowRight className="size-3.5" strokeWidth={2} />
          </a>
          <p className="text-[10px] text-foreground/35 cnl-wordmark mt-2">
            UTTA AI · CUBIXA NEWS LENS
          </p>
        </footer>
      </div>

      {showSettings && (
        <ApiBaseDialog onClose={() => setShowSettings(false)} />
      )}

      {/* First-visit install nudge (auto-hides if already installed) */}
      <InstallPrompt />

      {/* Full-screen analyzing visualization */}
      {loading && (
        <AnalyzingOverlay
          sourceUrl={activeUrl}
          preview={activeBody}
          title={activeTitle}
          completing={completing}
          onCancel={() => {
            abortRef.current?.abort();
            setLoading(false);
            setCompleting(false);
          }}
        />
      )}
    </div>
  );
}

const features = [
  {
    title: "주장 분해",
    body: "기사를 검증 가능한 단위 주장으로 나눠 정확한 분석 단위를 만듭니다.",
  },
  {
    title: "팩트체크 교차 검증",
    body: "다수의 외부 자료와 출처를 실시간으로 교차 조회해 주장의 사실성을 확인합니다.",
  },
  {
    title: "감정·제목 과장도",
    body: "감정 유도 단어와 헤드라인의 본문 일치도를 별도 평가합니다.",
  },
  {
    title: "종합 신뢰도",
    body: "9개 에이전트 결과를 통합해 단일 점수와 추천 액션으로 정리합니다.",
  },
];
