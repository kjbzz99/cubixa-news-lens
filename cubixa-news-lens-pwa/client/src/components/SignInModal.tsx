/*
 * SignInModal — 시작하기 모달.
 *
 * 4개 소셜 버튼(Google · Facebook · Kakao · Naver)을 한국 사용자에게 익숙한
 * 시각 위계로 노출한다. 현재는 Google 만 client-side Identity Services 로
 * 실제 작동하고, 나머지 3개는 placeholder 토스트("곧 지원 예정")만 띄운다.
 * web-db-user 업그레이드 후 카카오/네이버 OAuth 정식 연동 예정.
 */

import { useState } from "react";
import { X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { signInWithGoogle, type AuthProvider, type AuthUser } from "@/lib/auth";
import { Brand } from "@/components/Brand";

interface SignInModalProps {
  open: boolean;
  onClose: () => void;
  onSignedIn?: (user: AuthUser) => void;
}

interface ProviderButtonProps {
  provider: AuthProvider;
  label: string;
  loading?: boolean;
  onClick: () => void;
}

const providerStyles: Record<
  AuthProvider,
  { bg: string; fg: string; ring: string; border: string }
> = {
  google: {
    bg: "bg-white",
    fg: "text-foreground",
    ring: "hover:ring-2 hover:ring-foreground/10",
    border: "border-foreground/15",
  },
  kakao: {
    bg: "bg-[#FEE500]",
    fg: "text-[#191600]",
    ring: "hover:brightness-95",
    border: "border-transparent",
  },
  naver: {
    bg: "bg-[#03C75A]",
    fg: "text-white",
    ring: "hover:brightness-95",
    border: "border-transparent",
  },
  facebook: {
    bg: "bg-[#1877F2]",
    fg: "text-white",
    ring: "hover:brightness-95",
    border: "border-transparent",
  },
};

function ProviderIcon({ provider }: { provider: AuthProvider }) {
  switch (provider) {
    case "google":
      return (
        <svg width="22" height="22" viewBox="0 0 48 48" aria-hidden>
          <path
            fill="#FFC107"
            d="M43.611 20.083H42V20H24v8h11.303C33.602 32.91 29.223 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.155 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.954 4 4 12.954 4 24s8.954 20 20 20c11.045 0 20-8.954 20-20 0-1.341-.138-2.65-.389-3.917z"
          />
          <path
            fill="#FF3D00"
            d="m6.306 14.691 6.572 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.155 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
          />
          <path
            fill="#4CAF50"
            d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
          />
          <path
            fill="#1976D2"
            d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
          />
        </svg>
      );
    case "kakao":
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
          <path
            fill="#191600"
            d="M12 3C6.48 3 2 6.48 2 10.8c0 2.78 1.86 5.2 4.66 6.55l-.95 3.45c-.09.32.27.58.55.4l4.13-2.74c.53.07 1.07.11 1.61.11 5.52 0 10-3.48 10-7.77S17.52 3 12 3z"
          />
        </svg>
      );
    case "naver":
      return (
        <svg width="18" height="18" viewBox="0 0 16 16" aria-hidden>
          <path
            fill="#fff"
            d="M10.59 8.55 5.34 1H1v14h4.41V7.45L10.66 15H15V1h-4.41v7.55Z"
          />
        </svg>
      );
    case "facebook":
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
          <path
            fill="#fff"
            d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3v3h-3v6.95c5.05-.5 9-4.76 9-9.95Z"
          />
        </svg>
      );
  }
}

function ProviderButton({ provider, label, loading, onClick }: ProviderButtonProps) {
  const s = providerStyles[provider];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className={`group relative flex w-full items-center justify-center gap-3 rounded-2xl border px-4 py-3.5 text-[15px] font-medium transition-all duration-200 active:scale-[0.98] ${s.bg} ${s.fg} ${s.ring} ${s.border} disabled:opacity-60`}>
      <span className="flex size-6 items-center justify-center">
        {loading ? (
          <Loader2 className="size-5 animate-spin" />
        ) : (
          <ProviderIcon provider={provider} />
        )}
      </span>
      <span>{label}</span>
    </button>
  );
}

export function SignInModal({ open, onClose, onSignedIn }: SignInModalProps) {
  const [busy, setBusy] = useState<AuthProvider | null>(null);

  if (!open) return null;

  const handle = async (provider: AuthProvider) => {
    if (busy) return;
    if (provider === "google") {
      try {
        setBusy("google");
        const user = await signInWithGoogle();
        toast.success(`${user.name}님 환영합니다`);
        onSignedIn?.(user);
        onClose();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "로그인에 실패했어요";
        toast.error(msg);
      } finally {
        setBusy(null);
      }
      return;
    }
    // Placeholder providers — real OAuth will arrive after web-db-user upgrade.
    toast.info(`${labelFor(provider)} 로그인은 곧 지원될 예정이에요`, {
      description: "지금은 구글 로그인만 사용 가능해요.",
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[80] flex items-end justify-center bg-foreground/40 backdrop-blur-sm sm:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}>
      <div
        className="relative w-full max-w-sm overflow-hidden rounded-t-3xl bg-background pb-7 pt-6 shadow-2xl sm:rounded-3xl"
        style={{ animation: "cnl-install-in 240ms cubic-bezier(0.23,1,0.32,1)" }}>
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 inline-flex size-8 items-center justify-center rounded-full text-foreground/60 hover:bg-foreground/5"
          aria-label="닫기">
          <X className="size-4" />
        </button>

        <div className="flex flex-col items-center px-6 text-center">
          <Brand size="md" showUtta={false} />
          <h2 className="font-display mt-5 text-[22px] font-semibold leading-tight tracking-tight text-foreground">
            검증된 신뢰도, 로그인 후 시작
          </h2>
          <p className="mt-2 text-[13px] leading-relaxed text-foreground/65">
            로그인하면 분석 기록과 공유한 결과를 한곳에 모아둘 수 있어요.
          </p>
        </div>

        <div className="mt-6 flex flex-col gap-2.5 px-6">
          <ProviderButton
            provider="google"
            label="Google로 시작하기"
            loading={busy === "google"}
            onClick={() => handle("google")}
          />
          <ProviderButton
            provider="kakao"
            label="카카오로 시작하기"
            onClick={() => handle("kakao")}
          />
          <ProviderButton
            provider="naver"
            label="네이버로 시작하기"
            onClick={() => handle("naver")}
          />
          <ProviderButton
            provider="facebook"
            label="Facebook으로 시작하기"
            onClick={() => handle("facebook")}
          />
        </div>

        <p className="mt-6 px-8 text-center text-[11px] leading-relaxed text-foreground/45">
          계속 진행하면 Cubixa News Lens의{" "}
          <span className="underline">이용약관</span>과{" "}
          <span className="underline">개인정보 처리방침</span>에 동의하는 것으로
          간주됩니다.
        </p>
      </div>
    </div>
  );
}

function labelFor(p: AuthProvider): string {
  return p === "kakao"
    ? "카카오"
    : p === "naver"
    ? "네이버"
    : p === "facebook"
    ? "페이스북"
    : "구글";
}
