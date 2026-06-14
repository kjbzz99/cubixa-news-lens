/*
 * Lightweight client-side auth.
 *
 * The PWA itself has no backend user system, so we store a minimal "session"
 * in localStorage purely so we can personalise the UI (greet by name, gate
 * features later, prefill share author). Real OAuth-server-backed auth will
 * arrive when we upgrade the project to web-db-user.
 *
 * For now:
 *   - Google: real client-side Identity Services flow → ID token → decode
 *     to get { name, email, picture } locally. No backend trust assumed.
 *   - Kakao / Naver / Facebook: placeholder buttons with a "곧 지원" toast.
 */

export type AuthProvider = "google" | "kakao" | "naver" | "facebook";

export interface AuthUser {
  provider: AuthProvider;
  name: string;
  email: string;
  picture?: string;
  signedInAt: number;
}

const STORAGE_KEY = "cnl_auth_user";
const LISTENERS = new Set<(u: AuthUser | null) => void>();

export function getAuthUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function setAuthUser(user: AuthUser | null) {
  if (typeof window === "undefined") return;
  if (user) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  else window.localStorage.removeItem(STORAGE_KEY);
  LISTENERS.forEach((fn) => fn(user));
}

export function subscribeAuth(fn: (u: AuthUser | null) => void): () => void {
  LISTENERS.add(fn);
  return () => {
    LISTENERS.delete(fn);
  };
}

/** Decode a JWT payload without verification (we only use it for display). */
function decodeJwt(token: string): Record<string, unknown> | null {
  try {
    const seg = token.split(".")[1];
    if (!seg) return null;
    const b64 = seg.replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(b64)
        .split("")
        .map(
          (c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2),
        )
        .join(""),
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

// We avoid `declare global` here because the host app already pulls in
// @types/google.accounts via other modules and that causes a TS2717 conflict.
// Instead we cast a single shape locally in the call site below.

interface GisIdClient {
  initialize: (cfg: {
    client_id: string;
    callback: (resp: { credential: string }) => void;
    ux_mode?: "popup" | "redirect";
    auto_select?: boolean;
  }) => void;
  prompt: () => void;
}

function getGisId(): GisIdClient | null {
  const w = window as unknown as {
    google?: { accounts?: { id?: GisIdClient } };
  };
  return w.google?.accounts?.id ?? null;
}

let gisLoaded: Promise<void> | null = null;

function loadGis(): Promise<void> {
  if (gisLoaded) return gisLoaded;
  gisLoaded = new Promise((resolve, reject) => {
    if (typeof window === "undefined") return reject(new Error("no window"));
    if (getGisId()) return resolve();
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Google Identity Services 로드 실패"));
    document.head.appendChild(s);
  });
  return gisLoaded;
}

const GOOGLE_CLIENT_ID =
  // Public test client id – replace with a real one for production.
  // Without a real client id, the GIS prompt will surface an "원본 미일치" error,
  // which we surface as a toast in SignInModal.
  (import.meta as unknown as { env?: { VITE_GOOGLE_CLIENT_ID?: string } }).env
    ?.VITE_GOOGLE_CLIENT_ID || "";

export async function signInWithGoogle(): Promise<AuthUser> {
  if (!GOOGLE_CLIENT_ID) {
    throw new Error(
      "Google 클라이언트 ID가 설정되지 않았습니다. 환경 변수 VITE_GOOGLE_CLIENT_ID를 추가해 주세요.",
    );
  }
  await loadGis();
  return new Promise<AuthUser>((resolve, reject) => {
    const id = getGisId();
    if (!id) return reject(new Error("Google SDK 로드 실패"));
    id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: (resp) => {
        const claims = decodeJwt(resp.credential);
        if (!claims) return reject(new Error("Google 응답을 해석할 수 없습니다"));
        const user: AuthUser = {
          provider: "google",
          name: (claims.name as string) || (claims.email as string) || "사용자",
          email: (claims.email as string) || "",
          picture: (claims.picture as string) || undefined,
          signedInAt: Date.now(),
        };
        setAuthUser(user);
        resolve(user);
      },
      ux_mode: "popup",
    });
    id.prompt();
  });
}

export function signOut() {
  setAuthUser(null);
}
