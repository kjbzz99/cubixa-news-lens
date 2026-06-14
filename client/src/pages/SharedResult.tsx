/*
 * SharedResult — public permalink page for an analysis (`/r/:id`).
 *
 * Visited when someone scans the QR on a share image, or follows a copied
 * link. We fetch the cached result from the backend and re-use the same
 * <ResultView/> the original analyst saw.
 *
 * Failure modes:
 *  - 404: backend restarted (in-memory store) → friendly empty state.
 *  - Network error: retry button.
 */

import { useEffect, useState } from "react";
import { useLocation, useRoute, Link } from "wouter";
import { ArrowLeft, AlertCircle, RefreshCcw } from "lucide-react";

import { Brand } from "@/components/Brand";
import { ResultView } from "@/components/ResultView";
import {
  fetchSharedResult,
  type BackendAnalysisResponse,
} from "@/lib/analysis";
import { getApiBase } from "@/lib/config";

/**
 * Mutate (or insert) a meta tag on document.head. Pure DOM since this is a
 * pre-render-free SPA — social bots (Slack, KakaoTalk, X) typically don't run
 * JS, but the tags help when shared inside Manus/native apps that *do* render.
 */
function setMeta(
  attrName: "property" | "name",
  attrValue: string,
  content: string,
): void {
  if (typeof document === "undefined") return;
  const sel = `meta[${attrName}="${attrValue}"]`;
  let el = document.head.querySelector<HTMLMetaElement>(sel);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attrName, attrValue);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

export default function SharedResult() {
  const [, params] = useRoute<{ id: string }>("/r/:id");
  const [, navigate] = useLocation();
  const id = params?.id ?? "";

  const [result, setResult] = useState<BackendAnalysisResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (!id) return;
    let aborted = false;
    setLoading(true);
    setError(null);
    fetchSharedResult(id)
      .then((r) => {
        if (!aborted) setResult(r);
      })
      .catch((e) => {
        if (!aborted)
          setError(e instanceof Error ? e.message : "결과를 불러오지 못했어요");
      })
      .finally(() => {
        if (!aborted) setLoading(false);
      });
    return () => {
      aborted = true;
    };
  }, [id, retryKey]);

  // Update <title> + OG meta whenever the result is loaded so social previews
  // and browser tabs reflect the actual analysis.
  useEffect(() => {
    if (!result) return;
    const title =
      result.meta?.title?.trim() || "Cubixa News Lens 신뢰도 분석";
    const score = result.risk?.overall_trust_score ?? 0;
    const verdict = result.risk?.verdict_label ?? "";
    const desc = `신뢰도 ${score}/100 · ${verdict} — 9개 AI 에이전트가 있다·출처·논리·감정·제목 일치도를 교차 검증한 결과입니다.`;
    const ogImage = `${getApiBase()}/r/${id}/og.png`;
    const pageUrl =
      typeof window !== "undefined"
        ? window.location.href
        : "";

    document.title = `${title} · 신뢰도 ${score}/100 · Cubixa News Lens`;
    setMeta("name", "description", desc);
    setMeta("property", "og:title", title);
    setMeta("property", "og:description", desc);
    setMeta("property", "og:image", ogImage);
    setMeta("property", "og:image:width", "1200");
    setMeta("property", "og:image:height", "630");
    setMeta("property", "og:url", pageUrl);
    setMeta("property", "og:type", "article");
    setMeta("name", "twitter:card", "summary_large_image");
    setMeta("name", "twitter:title", title);
    setMeta("name", "twitter:description", desc);
    setMeta("name", "twitter:image", ogImage);
  }, [result, id]);

  if (loading) {
    return (
      <div className="cnl-mist flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <Brand size="md" />
        <span className="cnl-dots mt-8">
          <span />
          <span />
          <span />
          <span />
        </span>
        <p className="mt-4 text-sm text-foreground/55">
          공유된 분석 결과를 불러오는 중…
        </p>
      </div>
    );
  }

  if (error || !result) {
    return (
      <div className="cnl-mist flex min-h-screen flex-col items-center justify-center gap-5 px-6 text-center">
        <Brand size="sm" />
        <div className="cnl-card max-w-md w-full p-7 flex flex-col items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertCircle className="size-5" strokeWidth={1.8} />
          </span>
          <h1 className="font-display text-[20px] font-semibold tracking-tight">
            결과를 찾을 수 없어요
          </h1>
          <p className="text-[13.5px] text-foreground/60 leading-relaxed">
            이 링크는 만료되었거나 서버가 재시작되어 메모리에서 사라졌어요. 원본
            기사에서 다시 분석해 주세요.
          </p>
          {error && (
            <p className="cnl-wordmark text-[10px] text-foreground/35 break-all">
              {error}
            </p>
          )}
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setRetryKey((k) => k + 1)}
              className="flex items-center gap-1.5 rounded-full bg-secondary px-4 py-2 text-[13px] font-medium hover:bg-accent">
              <RefreshCcw className="size-3.5" strokeWidth={1.8} />
              다시 시도
            </button>
            <Link
              href="/"
              className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground hover:opacity-90">
              <ArrowLeft className="size-3.5" strokeWidth={1.8} />
              홈으로
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ResultView
      result={result}
      sourceUrl={result.source_url || ""}
      onBack={() => navigate("/")}
      onRerun={() => navigate("/")}
    />
  );
}
