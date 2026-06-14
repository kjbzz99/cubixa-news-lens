/*
 * ShareBar — SNS sharing for analysis result.
 * Uses native Web Share API on mobile; falls back to per-platform URLs.
 * KakaoTalk has no public share URL → copy + open kakao web messenger.
 */

import { Share2, Copy, Check, Link2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface ShareBarProps {
  /** Original article URL (used as fallback when no shareUrl is available) */
  url: string;
  /** Permanent Cubixa share permalink (preferred destination for SNS) */
  shareUrl?: string;
  score?: number;
  verdictLabel?: string;
}

function buildShareText(score?: number, verdictLabel?: string) {
  const s = typeof score === "number" ? `${score}/100` : "";
  const v = verdictLabel ? ` (${verdictLabel})` : "";
  return `[Cubixa News Lens] 이 기사의 신뢰도: ${s}${v}`;
}

export function ShareBar({
  url,
  shareUrl,
  score,
  verdictLabel,
}: ShareBarProps) {
  const [copied, setCopied] = useState(false);
  // Prefer the Cubixa permalink so recipients land on the analysis page
  // rather than the original article. Fall back to article URL.
  const targetUrl = shareUrl || url;
  const text = buildShareText(score, verdictLabel);
  const ua =
    typeof navigator !== "undefined" ? navigator.userAgent.toLowerCase() : "";
  const isMobile = /android|iphone|ipad|ipod/i.test(ua);

  function nativeShare() {
    if (!navigator.share) {
      copyLink();
      return;
    }
    navigator
      .share({ title: "Cubixa News Lens", text, url: targetUrl })
      .catch(() => {
        /* user cancel */
      });
  }

  function copyLink() {
    navigator.clipboard
      .writeText(`${text}\n${targetUrl}`)
      .then(() => {
        setCopied(true);
        toast.success("결과 링크가 복사되었어요");
        setTimeout(() => setCopied(false), 1800);
      })
      .catch(() => toast.error("복사에 실패했어요. 직접 복사해주세요."));
  }

  function shareTo(network: "fb" | "x" | "kakao") {
    if (network === "fb") {
      window.open(
        `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(targetUrl)}`,
        "_blank",
        "noopener,width=600,height=520"
      );
      return;
    }
    if (network === "x") {
      window.open(
        `https://twitter.com/intent/tweet?text=${encodeURIComponent(
          text
        )}&url=${encodeURIComponent(targetUrl)}`,
        "_blank",
        "noopener,width=600,height=520"
      );
      return;
    }
    if (network === "kakao") {
      navigator.clipboard.writeText(`${text}\n${targetUrl}`).catch(() => {});
      if (isMobile && navigator.share) {
        navigator
          .share({ title: "Cubixa News Lens", text, url: targetUrl })
          .catch(() => {
            /* ignore */
          });
        return;
      }
      window.open("https://accounts.kakao.com/login/?continue=https%3A%2F%2Fmessenger.kakao.com%2Fchats", "_blank", "noopener");
      toast("링크 복사됨 — 카카오 웹에서 붙여넣기 해주세요", {
        description: "정식 카카오 SDK는 사업자 앱키 등록 후 연결됩니다.",
      });
    }
  }

  return (
    <div className="cnl-card px-5 py-5">
      <div className="flex items-center justify-between">
        <h4 className="font-display text-sm font-semibold tracking-tight">
          결과 공유
        </h4>
        <span className="cnl-wordmark text-[9px] text-foreground/45">
          SHARE
        </span>
      </div>

      {shareUrl && (
        <button
          type="button"
          onClick={copyLink}
          className="mt-3 flex w-full items-center gap-2 rounded-xl bg-secondary/60 px-3 py-2 text-left transition-colors hover:bg-secondary"
          aria-label="영구 링크 복사">
          <Link2 className="size-3.5 text-primary shrink-0" strokeWidth={1.9} />
          <span className="truncate text-[11.5px] font-mono tabular-nums text-foreground/75">
            {shareUrl.replace(/^https?:\/\//, "")}
          </span>
          {copied ? (
            <Check className="size-3.5 text-primary shrink-0" strokeWidth={2} />
          ) : (
            <Copy className="size-3.5 text-foreground/45 shrink-0" strokeWidth={1.8} />
          )}
        </button>
      )}
      <div className="mt-4 grid grid-cols-4 gap-2">
        <ShareButton
          label="Facebook"
          onClick={() => shareTo("fb")}
          bg="#1877F2"
          fg="#fff">
          <span className="font-display text-base font-bold">f</span>
        </ShareButton>
        <ShareButton
          label="X"
          onClick={() => shareTo("x")}
          bg="#0F0F0F"
          fg="#fff">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
            <path d="M18.244 2H21.5l-7.5 8.575L23 22h-6.844l-5.36-6.79L4.6 22H1.34l8.027-9.176L1 2h7.012l4.836 6.226L18.244 2zm-2.398 18h1.84L7.243 4H5.27l10.576 16z" />
          </svg>
        </ShareButton>
        <ShareButton
          label="카카오톡"
          onClick={() => shareTo("kakao")}
          bg="#FEE500"
          fg="#191600">
          <span className="font-display text-base font-bold">K</span>
        </ShareButton>
        <ShareButton
          label={copied ? "복사됨" : "링크"}
          onClick={copyLink}
          bg="oklch(0.94 0.04 295)"
          fg="oklch(0.32 0.08 295)">
          {copied ? (
            <Check className="size-4" />
          ) : (
            <Copy className="size-4" strokeWidth={1.8} />
          )}
        </ShareButton>
      </div>
      {isMobile && (
        <button
          type="button"
          onClick={nativeShare}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-border/70 bg-background/40 py-2.5 text-sm font-medium text-foreground/75 hover:bg-secondary/60 active:scale-[0.99]">
          <Share2 className="size-4" strokeWidth={1.6} />
          OS 공유 시트로 보내기
        </button>
      )}
    </div>
  );
}

function ShareButton({
  label,
  bg,
  fg,
  onClick,
  children,
}: {
  label: string;
  bg: string;
  fg: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 rounded-xl py-3 text-[11px] font-medium transition-colors"
      style={{ background: bg, color: fg }}
      aria-label={`${label}로 공유`}>
      <span className="flex size-7 items-center justify-center rounded-md bg-white/10">
        {children}
      </span>
      {label}
    </button>
  );
}
