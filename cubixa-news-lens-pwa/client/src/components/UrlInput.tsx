/*
 * UrlInput — primary call-to-action with TWO input modes.
 *
 *   1. URL mode (default)  → user pastes a news article link.
 *   2. BODY mode (toggle)  → user pastes the article body text directly,
 *      with an optional title field. Useful when the publisher blocks
 *      server-side fetching (Daum/Naver bot guards, paywalls, captchas).
 *
 * The parent receives a unified payload via onSubmit({ kind, value, title? }).
 * Mobile-first design — labels are short, the textarea grows generously.
 */

import { useEffect, useRef, useState } from "react";
import { Sparkles, Link2, Clipboard, FileText } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { setApiBase } from "@/lib/config";

export interface UrlInputSubmit {
  kind: "url" | "body";
  value: string;
  title?: string;
}

interface UrlInputProps {
  initialValue?: string;
  loading?: boolean;
  onSubmit: (payload: UrlInputSubmit) => void;
  autoSubmit?: boolean;
}

type Mode = "url" | "body";

export function UrlInput({
  initialValue,
  loading,
  onSubmit,
  autoSubmit,
}: UrlInputProps) {
  // On first mount, clear any stale backend URL override from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem("cnl:apiBase");
      if (stored && /^https?:\/\//.test(stored)) {
        // Clear the override so we use the default /api proxy
        setApiBase("");
        console.log("[UrlInput] Cleared stale backend override");
      }
    } catch (e) {
      console.error("[UrlInput] Failed to clear backend override:", e);
    }
  }, []);

  // Auto-detect: if initialValue looks like a URL → url mode, else body mode.
  const initialMode: Mode = initialValue && /^https?:\/\//i.test(initialValue) ? "url" : "url";

  const [mode, setMode] = useState<Mode>(initialMode);
  const [urlValue, setUrlValue] = useState(
    initialValue && /^https?:\/\//i.test(initialValue) ? initialValue : ""
  );
  const [bodyValue, setBodyValue] = useState(
    initialValue && !/^https?:\/\//i.test(initialValue) ? initialValue : ""
  );
  const [titleValue, setTitleValue] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const submittedRef = useRef(false);

  // When parent feeds a new initialValue (share-target / deep link)
  useEffect(() => {
    if (!initialValue) return;
    if (/^https?:\/\//i.test(initialValue)) {
      setMode("url");
      setUrlValue(initialValue);
    } else {
      setMode("body");
      setBodyValue(initialValue);
    }
  }, [initialValue]);

  useEffect(() => {
    if (autoSubmit && initialValue && !submittedRef.current) {
      submittedRef.current = true;
      const isUrl = /^https?:\/\//i.test(initialValue);
      onSubmit({
        kind: isUrl ? "url" : "body",
        value: initialValue,
      });
    }
  }, [autoSubmit, initialValue, onSubmit]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "url") {
      const trimmed = urlValue.trim();
      if (!trimmed) {
        toast("기사 URL을 입력해주세요");
        inputRef.current?.focus();
        return;
      }
      if (!/^https?:\/\//i.test(trimmed)) {
        toast("URL은 https:// 또는 http:// 로 시작해야 해요");
        inputRef.current?.focus();
        return;
      }
      onSubmit({ kind: "url", value: trimmed });
    } else {
      const trimmed = bodyValue.trim();
      if (trimmed.length < 50) {
        toast("본문이 너무 짧아요 (최소 50자)");
        textareaRef.current?.focus();
        return;
      }
      onSubmit({
        kind: "body",
        value: trimmed,
        title: titleValue.trim() || undefined,
      });
    }
  }

  async function pasteUrl() {
    try {
      const t = await navigator.clipboard.readText();
      if (t) {
        setUrlValue(t.trim());
        toast.success("URL을 붙여넣었어요");
        setTimeout(() => inputRef.current?.focus(), 50);
      }
    } catch {
      toast("브라우저가 클립보드 접근을 차단했어요");
    }
  }

  async function pasteBody() {
    try {
      const t = await navigator.clipboard.readText();
      if (t) {
        setBodyValue(t);
        toast.success(`본문 ${t.length}자 붙여넣었어요`);
        setTimeout(() => textareaRef.current?.focus(), 50);
      }
    } catch {
      toast("브라우저가 클립보드 접근을 차단했어요");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="cnl-card p-5">
      {/* Mode toggle — segmented control */}
      <div
        role="tablist"
        aria-label="입력 모드"
        className="mb-4 flex rounded-xl bg-secondary/60 p-1 text-[12px]">
        <ModeTab
          active={mode === "url"}
          onClick={() => setMode("url")}
          icon={<Link2 className="size-3.5" strokeWidth={2} />}>
          URL
        </ModeTab>
        <ModeTab
          active={mode === "body"}
          onClick={() => setMode("body")}
          icon={<FileText className="size-3.5" strokeWidth={2} />}>
          본문 붙여넣기
        </ModeTab>
      </div>

      {mode === "url" ? (
        <>
          <label className="mb-3 flex items-center gap-2 text-[11px] cnl-wordmark text-foreground/55">
            <Link2 className="size-3.5" strokeWidth={2} />
            기사 주소
          </label>
          <div className="relative">
            <input
              ref={inputRef}
              value={urlValue}
              onChange={(e) => setUrlValue(e.target.value)}
              inputMode="url"
              enterKeyHint="go"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              placeholder="https://news.naver.com/..."
              className="w-full rounded-xl bg-secondary/60 border border-transparent px-4 py-3 pr-11 text-[15px] outline-none transition-colors focus:bg-card focus:border-primary/40 focus:shadow-[0_0_0_4px_oklch(0.85_0.12_295/0.18)]"
            />
            <button
              type="button"
              onClick={pasteUrl}
              aria-label="URL 붙여넣기"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 flex size-8 items-center justify-center rounded-lg text-foreground/55 hover:bg-accent hover:text-accent-foreground">
              <Clipboard className="size-4" strokeWidth={1.6} />
            </button>
          </div>
          <p className="mt-2 text-[11px] text-foreground/45 leading-relaxed">
            기사 페이지의 주소창 링크를 그대로 붙여넣으세요.
          </p>
        </>
      ) : (
        <>
          <label className="mb-2 flex items-center gap-2 text-[11px] cnl-wordmark text-foreground/55">
            <FileText className="size-3.5" strokeWidth={2} />
            기사 본문
          </label>
          <div className="relative">
            <textarea
              ref={textareaRef}
              value={bodyValue}
              onChange={(e) => setBodyValue(e.target.value)}
              rows={9}
              placeholder={`기사 본문을 그대로 붙여넣으세요.\n예) 정부는 16일… (최소 50자)`}
              className="w-full resize-none rounded-xl bg-secondary/60 border border-transparent px-4 py-3 pr-12 text-[14px] leading-relaxed outline-none transition-colors focus:bg-card focus:border-primary/40 focus:shadow-[0_0_0_4px_oklch(0.85_0.12_295/0.18)]"
            />
            <button
              type="button"
              onClick={pasteBody}
              aria-label="본문 붙여넣기"
              className="absolute right-2 top-2 flex size-8 items-center justify-center rounded-lg text-foreground/55 hover:bg-accent hover:text-accent-foreground bg-card/70 backdrop-blur">
              <Clipboard className="size-4" strokeWidth={1.6} />
            </button>
          </div>
          <div className="mt-2 flex items-center justify-between text-[10.5px] text-foreground/45">
            <span>{bodyValue.length.toLocaleString()}자 · 최소 50자</span>
            <button
              type="button"
              onClick={() => setBodyValue("")}
              disabled={!bodyValue}
              className="cnl-wordmark text-[10px] hover:text-foreground/70 disabled:opacity-40">
              지우기
            </button>
          </div>

          {/* Optional title */}
          <label className="mt-4 mb-2 flex items-center gap-2 text-[11px] cnl-wordmark text-foreground/55">
            제목 <span className="text-foreground/35">(선택)</span>
          </label>
          <input
            value={titleValue}
            onChange={(e) => setTitleValue(e.target.value)}
            type="text"
            autoComplete="off"
            placeholder="기사 제목을 입력하면 더 정확한 분석이 됩니다"
            className="w-full rounded-xl bg-secondary/60 border border-transparent px-4 py-2.5 text-[13.5px] outline-none transition-colors focus:bg-card focus:border-primary/40 focus:shadow-[0_0_0_4px_oklch(0.85_0.12_295/0.18)]"
          />
        </>
      )}

      <button
        type="submit"
        disabled={loading}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-[15px] font-semibold text-primary-foreground shadow-[0_8px_24px_-8px_oklch(0.55_0.22_295/0.45)] hover:opacity-95 disabled:opacity-60">
        {loading ? (
          <>
            <span className="cnl-dots">
              <span />
              <span />
              <span />
              <span />
            </span>
            <span className="ml-2">분석 중…</span>
          </>
        ) : (
          <>
            <Sparkles className="size-4" strokeWidth={2} />
            신뢰도 검증하기
          </>
        )}
      </button>

      {mode === "url" ? (
        <p className="mt-3 text-center text-[11px] text-foreground/45 leading-relaxed">
          서버가 기사를 가져오지 못하면 <strong className="font-semibold text-foreground/65">본문 붙여넣기</strong> 모드로 전환해 주세요.
        </p>
      ) : (
        <p className="mt-3 text-center text-[11px] text-foreground/45 leading-relaxed">
          본문 모드는 페이월·로그인·봇 차단된 기사도 분석할 수 있어요.
        </p>
      )}
    </form>
  );
}

function ModeTab({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 cnl-wordmark text-[10.5px] transition-colors",
        active
          ? "bg-card text-foreground shadow-[0_2px_6px_-2px_oklch(0.5_0.15_295/0.18)]"
          : "text-foreground/55 hover:text-foreground/80"
      )}>
      {icon}
      {children}
    </button>
  );
}
