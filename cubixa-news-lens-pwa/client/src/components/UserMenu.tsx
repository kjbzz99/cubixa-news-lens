/*
 * UserMenu — 우상단 사용자 진입점.
 *
 * 로그아웃 상태:  "시작하기" 버튼 → SignInModal 오픈
 * 로그인 상태:    아바타 → 클릭 시 드롭다운(이름/이메일/로그아웃)
 */

import { useEffect, useRef, useState } from "react";
import { LogOut } from "lucide-react";
import { getAuthUser, signOut, subscribeAuth, type AuthUser } from "@/lib/auth";
import { SignInModal } from "@/components/SignInModal";

export function UserMenu({ compact = false }: { compact?: boolean }) {
  const [user, setUser] = useState<AuthUser | null>(getAuthUser());
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    return subscribeAuth(setUser);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  if (!user) {
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`group relative inline-flex items-center justify-center rounded-full font-medium transition-all duration-200 active:scale-[0.97] ${
            compact
              ? "size-9 bg-foreground/[0.06] text-[12px] text-foreground/75 hover:bg-foreground/10"
              : "h-9 px-4 text-[13px] text-white"
          }`}
          style={
            compact
              ? undefined
              : {
                  background:
                    "linear-gradient(120deg, oklch(0.42 0.18 295), oklch(0.58 0.22 295))",
                  boxShadow: "0 6px 18px -8px rgba(124,58,237,0.55)",
                }
          }
          aria-label="시작하기">
          {compact ? (
            <span className="text-[10px] font-semibold tracking-wider uppercase">
              Sign in
            </span>
          ) : (
            "시작하기"
          )}
        </button>
        <SignInModal open={open} onClose={() => setOpen(false)} />
      </>
    );
  }

  const initials = (user.name || user.email).slice(0, 1).toUpperCase();

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        className="group inline-flex size-9 items-center justify-center overflow-hidden rounded-full ring-1 ring-foreground/10 transition-transform duration-200 hover:ring-violet-400/50 active:scale-95"
        aria-label={`${user.name} 메뉴`}>
        {user.picture ? (
          // eslint-disable-next-line jsx-a11y/img-redundant-alt
          <img
            src={user.picture}
            alt={`${user.name}님 프로필`}
            className="h-full w-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <span
            className="flex h-full w-full items-center justify-center text-[12px] font-semibold text-white"
            style={{
              background:
                "linear-gradient(135deg, oklch(0.42 0.18 295), oklch(0.62 0.22 295))",
            }}>
            {initials}
          </span>
        )}
      </button>

      {menuOpen && (
        <div className="absolute right-0 z-50 mt-2 w-60 origin-top-right overflow-hidden rounded-2xl border border-foreground/10 bg-background shadow-xl">
          <div className="flex items-center gap-3 border-b border-foreground/5 px-4 py-3">
            {user.picture ? (
              // eslint-disable-next-line jsx-a11y/img-redundant-alt
              <img
                src={user.picture}
                alt={`${user.name}`}
                className="size-9 rounded-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <span
                className="flex size-9 items-center justify-center rounded-full text-[13px] font-semibold text-white"
                style={{
                  background:
                    "linear-gradient(135deg, oklch(0.42 0.18 295), oklch(0.62 0.22 295))",
                }}>
                {initials}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-medium text-foreground">
                {user.name}
              </div>
              <div className="truncate text-[11px] text-foreground/55">
                {user.email}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              signOut();
              setMenuOpen(false);
            }}
            className="flex w-full items-center gap-2 px-4 py-3 text-left text-[13px] text-foreground/75 transition-colors hover:bg-foreground/[0.04]">
            <LogOut className="size-4" />
            로그아웃
          </button>
        </div>
      )}
    </div>
  );
}
