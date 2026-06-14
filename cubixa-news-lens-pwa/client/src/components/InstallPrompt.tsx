/*
 * InstallPrompt — first-visit nudge to add Cubixa News Lens to the home screen.
 *
 * Shows once per device (localStorage) after a short delay so it doesn't
 * eclipse the hero. Branches between three states:
 *   - Android Chrome / Edge: native beforeinstallprompt → "설치" button.
 *   - iOS Safari: no native API → instructions with the share-icon SVG.
 *   - Other / already installed: render nothing.
 *
 * Hidden when display-mode is standalone (already installed) or when the
 * user has dismissed it before. Auto-dismisses 12s after appearing.
 */
import { useEffect, useRef, useState } from "react";
import { Share, Plus, X, Sparkles, Smartphone } from "lucide-react";
import { Brand } from "./Brand";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "cnl:install:dismissed:v1";
const APPEAR_DELAY_MS = 4500;
const AUTO_HIDE_MS = 14000;

type Platform = "android" | "ios" | "other";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent;
  // iPad reports MacIntel UA in iOS 13+ but has touch events.
  const isIOS = /iPhone|iPad|iPod/.test(ua) ||
    (/Macintosh/.test(ua) && "ontouchend" in document);
  if (isIOS) return "ios";
  if (/Android/.test(ua)) return "android";
  return "other";
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  // iOS Safari uses navigator.standalone; the rest use display-mode.
  const nav = navigator as Navigator & { standalone?: boolean };
  if (nav.standalone) return true;
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  return false;
}

export function InstallPrompt() {
  const [visible, setVisible] = useState(false);
  const [platform] = useState<Platform>(detectPlatform);
  const promptEventRef = useRef<BeforeInstallPromptEvent | null>(null);
  const [hasNativePrompt, setHasNativePrompt] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isStandalone()) return;
    if (localStorage.getItem(STORAGE_KEY)) return;
    if (platform === "other") return; // desktop: don't bother

    // Capture Android Chrome's native install prompt event.
    const onBIP = (e: Event) => {
      e.preventDefault();
      promptEventRef.current = e as BeforeInstallPromptEvent;
      setHasNativePrompt(true);
    };
    window.addEventListener("beforeinstallprompt", onBIP);

    const showT = setTimeout(() => setVisible(true), APPEAR_DELAY_MS);
    const hideT = setTimeout(
      () => setVisible(false),
      APPEAR_DELAY_MS + AUTO_HIDE_MS,
    );

    return () => {
      window.removeEventListener("beforeinstallprompt", onBIP);
      clearTimeout(showT);
      clearTimeout(hideT);
    };
  }, [platform]);

  function dismiss(persist = true) {
    setVisible(false);
    if (persist) {
      try {
        localStorage.setItem(STORAGE_KEY, String(Date.now()));
      } catch {
        /* ignore */
      }
    }
  }

  async function handleInstall() {
    const evt = promptEventRef.current;
    if (!evt) return;
    try {
      await evt.prompt();
      const choice = await evt.userChoice;
      if (choice.outcome === "accepted") {
        dismiss(true);
      }
    } catch {
      /* user cancelled; allow showing again next visit */
    }
  }

  if (!visible) return null;
  if (platform === "other") return null;

  return (
    <div
      role="dialog"
      aria-live="polite"
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 px-4 pb-[max(env(safe-area-inset-bottom),0.75rem)]",
        "animate-cnl-install-in",
      )}>
      <div className="mx-auto max-w-md cnl-card relative overflow-hidden">
        {/* subtle gradient halo */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-12 -top-12 size-40 rounded-full opacity-60"
          style={{
            background:
              "radial-gradient(closest-side, rgba(167,139,250,0.45), transparent 70%)",
          }}
        />
        <div className="relative px-5 py-4">
          <button
            type="button"
            onClick={() => dismiss(true)}
            aria-label="닫기"
            className="absolute right-2 top-2 flex size-8 items-center justify-center rounded-lg text-foreground/45 hover:bg-secondary hover:text-foreground/80">
            <X className="size-4" strokeWidth={2} />
          </button>

          <div className="flex items-start gap-3 pr-7">
            <Brand size="sm" />
            <div className="flex-1 min-w-0">
              <p className="cnl-wordmark text-[10px] text-primary/80 mb-0.5 flex items-center gap-1">
                <Sparkles className="size-3" strokeWidth={2} />
                INSTALL · 5초면 끝나요
              </p>
              <p className="font-display text-[15px] font-semibold leading-tight">
                홈 화면에 추가하고 앱처럼 쓰세요
              </p>
              <p className="mt-1 text-[12.5px] text-foreground/60 leading-relaxed">
                {platform === "ios"
                  ? "Safari 공유 메뉴에서 [홈 화면에 추가]를 누르면 끝이에요."
                  : "주소창 옆 메뉴에서 [앱 설치]를 누르면 즉시 설치됩니다."}
              </p>
            </div>
          </div>

          {platform === "ios" && (
            <div className="mt-3 grid grid-cols-2 gap-2 text-[11.5px]">
              <div className="rounded-xl border border-border/60 bg-background/50 px-3 py-2 flex items-center gap-2">
                <Share className="size-4 text-primary/80" strokeWidth={2} />
                <span className="leading-tight">
                  ① Safari 하단 <strong>공유</strong> 버튼
                </span>
              </div>
              <div className="rounded-xl border border-border/60 bg-background/50 px-3 py-2 flex items-center gap-2">
                <Plus className="size-4 text-primary/80" strokeWidth={2} />
                <span className="leading-tight">
                  ② <strong>홈 화면에 추가</strong> 선택
                </span>
              </div>
            </div>
          )}

          {platform === "android" && (
            <div className="mt-3 flex items-center gap-2">
              {hasNativePrompt ? (
                <button
                  type="button"
                  onClick={handleInstall}
                  className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary px-4 text-[13.5px] font-medium text-primary-foreground hover:opacity-90">
                  <Smartphone className="size-4" strokeWidth={2} />
                  지금 설치하기
                </button>
              ) : (
                <div className="flex-1 rounded-xl border border-border/60 bg-background/50 px-3 py-2 text-[11.5px] text-foreground/65">
                  Chrome 우상단 ⋮ → <strong>앱 설치</strong> 또는 <strong>홈 화면에 추가</strong>
                </div>
              )}
              <button
                type="button"
                onClick={() => dismiss(true)}
                className="inline-flex h-10 items-center justify-center rounded-xl px-3 text-[12px] text-foreground/55 hover:bg-secondary">
                나중에
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
