/**
 * Web Speech API wrapper for Talk Tak.
 *
 * Recognition: Chrome / Edge / Safari 14+ (webkitSpeechRecognition).
 * Firefox is unsupported — callers MUST fall back to text input.
 *
 * Synthesis: SpeechSynthesisUtterance (works on most browsers, Korean voice
 * quality is OS-dependent). Off by default; user toggles.
 */

// ── Types ───────────────────────────────────────────────────────────────────

type SRConstructor = new () => SpeechRecognition;

interface SpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((this: SpeechRecognition, ev: SREvent) => void) | null;
  onerror: ((this: SpeechRecognition, ev: SRErrorEvent) => void) | null;
  onend: ((this: SpeechRecognition, ev: Event) => void) | null;
  onstart: ((this: SpeechRecognition, ev: Event) => void) | null;
  onspeechend: ((this: SpeechRecognition, ev: Event) => void) | null;
}

interface SRResult {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: { transcript: string; confidence: number };
  item(index: number): { transcript: string; confidence: number };
}

interface SREvent extends Event {
  resultIndex: number;
  results: { length: number; [index: number]: SRResult };
}

interface SRErrorEvent extends Event {
  error: string;
  message?: string;
}

// ── Capability detection ────────────────────────────────────────────────────

export function isRecognitionSupported(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as unknown as {
    SpeechRecognition?: SRConstructor;
    webkitSpeechRecognition?: SRConstructor;
  };
  return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
}

export function isSynthesisSupported(): boolean {
  if (typeof window === "undefined") return false;
  return typeof window.speechSynthesis !== "undefined";
}

function getRecognitionCtor(): SRConstructor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SRConstructor;
    webkitSpeechRecognition?: SRConstructor;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

// ── Recognition session ─────────────────────────────────────────────────────

export interface RecognitionHandlers {
  onInterim?: (text: string) => void;
  /** Called once per silence-finalized utterance. */
  onFinal?: (text: string) => void;
  onError?: (code: string, message?: string) => void;
  onEnd?: () => void;
  /** Called whenever the engine restarts itself in persistent mode. */
  onRestart?: () => void;
  /**
   * Synchronous predicate consulted on every final transcript. When it
   * returns true, the transcript is dropped silently — use this to ignore
   * the agent's own TTS audio bleeding back through the mic.
   */
  shouldSuppress?: () => boolean;
}

export interface RecognitionStartOptions {
  /**
   * When true, the session re-creates the underlying SpeechRecognition
   * the moment the engine fires `onend` for any reason except an explicit
   * `abort()`. This produces a true "always on" mic that survives
   * mid-pause termination, no-speech timeouts, and Android's chunked
   * dictation behaviour. The user only loses the mic when the app calls
   * `abort()` (i.e. the modal closes).
   */
  persistent?: boolean;
}

export class RecognitionSession {
  private rec: SpeechRecognition | null = null;
  private handlers: RecognitionHandlers;
  private aborted = false;
  private persistent = false;
  private restartTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(handlers: RecognitionHandlers) {
    this.handlers = handlers;
  }

  start(opts: RecognitionStartOptions = {}): boolean {
    this.persistent = Boolean(opts.persistent);
    return this.spawn();
  }

  private spawn(): boolean {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      this.handlers.onError?.("not-supported");
      return false;
    }
    try {
      const rec = new Ctor();
      rec.lang = "ko-KR";
      // continuous=true keeps the engine alive across natural pauses.
      // Persistent mode (above) restarts the engine if it still ends.
      rec.continuous = true;
      rec.interimResults = true;
      rec.maxAlternatives = 1;

      rec.onresult = (ev: SREvent) => {
        let interim = "";
        let final = "";
        for (let i = ev.resultIndex; i < ev.results.length; i++) {
          const r = ev.results[i];
          const alt = r[0];
          if (!alt) continue;
          if (r.isFinal) final += alt.transcript;
          else interim += alt.transcript;
        }
        // Drop everything that arrives while the agent is speaking. This is
        // how we keep the mic permanently on without it picking up the
        // assistant's own TTS audio as user input.
        if (this.handlers.shouldSuppress?.()) return;
        if (interim) this.handlers.onInterim?.(interim);
        if (final.trim()) this.handlers.onFinal?.(final.trim());
      };

      rec.onerror = (ev: SRErrorEvent) => {
        // 'no-speech' / 'aborted' are routine — let the app decide.
        this.handlers.onError?.(ev.error, ev.message);
      };

      rec.onend = () => {
        this.handlers.onEnd?.();
        // Auto-respawn unless the consumer explicitly aborted us. We add a
        // tiny delay so Chromium has a moment to release the audio device
        // before we ask for it again.
        if (this.persistent && !this.aborted) {
          this.restartTimer = setTimeout(() => {
            if (!this.aborted) {
              const ok = this.spawn();
              if (ok) this.handlers.onRestart?.();
            }
          }, 220);
        }
      };

      this.rec = rec;
      this.aborted = false;
      rec.start();
      return true;
    } catch (e) {
      this.handlers.onError?.(
        "start-failed",
        e instanceof Error ? e.message : "unknown",
      );
      return false;
    }
  }

  stop(): void {
    try {
      this.rec?.stop();
    } catch {
      // engine may already be stopped — ignore.
    }
  }

  abort(): void {
    this.aborted = true;
    this.persistent = false;
    if (this.restartTimer != null) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
    try {
      this.rec?.abort();
    } catch {
      // ignore
    }
  }

  get isAborted(): boolean {
    return this.aborted;
  }
}

// ── Synthesis (TTS) ─────────────────────────────────────────────────────────

let cachedKoreanVoice: SpeechSynthesisVoice | null = null;

/**
 * Pick the best Korean voice the OS exposes. Quality varies dramatically
 * by platform; we score candidates and prefer neural / premium ones.
 *
 * Heuristics (descending priority):
 *   - name contains "Neural" / "Premium" / "Enhanced" / "WaveNet"
 *   - name matches known high-quality Korean voices (Yuna, Heami, Sora,
 *     Google ko-KR Neural · Microsoft Sun-Hi/Heami)
 *   - localService=false (cloud voices are usually higher quality on
 *     Android/iOS than the bundled OS voice)
 *   - lang starts with ko
 * The cheap default voice (lang=ko but no other signal) wins only when
 * nothing else is available.
 */
function pickKoreanVoice(): SpeechSynthesisVoice | null {
  if (cachedKoreanVoice) return cachedKoreanVoice;
  if (!isSynthesisSupported()) return null;
  const voices = window.speechSynthesis.getVoices();
  const koVoices = voices.filter((v) =>
    v.lang?.toLowerCase().startsWith("ko"),
  );
  if (koVoices.length === 0) return null;

  // Quality boosters — neural / cloud voices regardless of gender.
  const QUALITY_NAMES = ["premium", "enhanced", "neural", "wavenet"];
  // Known male Korean voices across iOS / macOS / Windows / Android Google.
  // Apple ships "In-Joon" (male) and "Minsu" (male) on recent iOS/macOS.
  // Microsoft ships "InJoon" / "BongJin" / "GookMin" / "SeoHyeon". Google
  // doesn't expose a stable male voice name, so we additionally pattern-
  // match on "male" anywhere in the descriptor.
  const MALE_NAMES = [
    "in-joon",
    "injoon",
    "minsu",
    "bongjin",
    "bong-jin",
    "gookmin",
    "gook-min",
    "jiwon",
    "ji-won",
    "hyunsu",
    "hyun-su",
    "sungsu",
    "male",
  ];
  // Known female Korean voices — used only for *negative* scoring so we
  // pick a male voice when one exists, but still fall back gracefully.
  const FEMALE_NAMES = [
    "yuna",
    "heami",
    "sora",
    "sun-hi",
    "sunhi",
    "jiyoung",
    "ji-young",
    "seohyeon",
    "seo-hyeon",
    "narae",
    "jihye",
    "female",
  ];

  const score = (v: SpeechSynthesisVoice): number => {
    const name = v.name.toLowerCase();
    let s = 0;
    // Strong male preference — user explicitly asked for an announcer-style
    // male voice. We rank male presence above quality so that on devices
    // with both a premium female and a standard male voice, the male one
    // still wins. The penalty on known female names is intentionally large.
    if (MALE_NAMES.some((k) => name.includes(k))) s += 200;
    if (FEMALE_NAMES.some((k) => name.includes(k))) s -= 150;
    if (QUALITY_NAMES.some((k) => name.includes(k))) s += 60;
    if (!v.localService) s += 30; // cloud voices usually better
    if (name.includes("google")) s += 15;
    if (name.includes("microsoft")) s += 10;
    if (name.includes("samsung")) s += 5;
    return s;
  };

  const sorted = [...koVoices].sort((a, b) => score(b) - score(a));
  cachedKoreanVoice = sorted[0] ?? null;
  return cachedKoreanVoice;
}

// ── Text prep for natural delivery ─────────────────────────────────────────

/**
 * Massage text before sending it to the synthesiser so the prosody hits
 * better. Korean TTS engines tend to flatline on long single-utterance
 * input — we inject natural pauses by adding a thin space after key
 * punctuation, which engines render as a short breath.
 */
// Korean number readings 0–9 — used to spell out single-digit scores so
// they can never be mistaken for an ordinal or a letter. The user reported
// that "35点" reads cleanly as "삼십오 점" but "5点" was ambiguous.
const KO_DIGIT: Record<string, string> = {
  "0": "영",
  "1": "일",
  "2": "이",
  "3": "삼",
  "4": "사",
  "5": "오",
  "6": "육",
  "7": "칠",
  "8": "팔",
  "9": "구",
};
// Sino-Korean reading for two-digit numbers (10–99). Cubixa scores live in
// 0–100, so we cover the whole range. Hundred is rare here but kept simple.
function sinoKoreanReading(n: number): string {
  if (n < 0) return String(n);
  if (n <= 9) return KO_DIGIT[String(n)] ?? String(n);
  if (n === 10) return "십";
  if (n < 20) return "십" + KO_DIGIT[String(n - 10)];
  if (n < 100) {
    const tens = Math.floor(n / 10);
    const ones = n % 10;
    const tensWord = tens === 1 ? "십" : KO_DIGIT[String(tens)] + "십";
    return ones === 0 ? tensWord : tensWord + KO_DIGIT[String(ones)];
  }
  if (n === 100) return "백";
  if (n < 1000) {
    const hundreds = Math.floor(n / 100);
    const rest = n % 100;
    const head = hundreds === 1 ? "백" : KO_DIGIT[String(hundreds)] + "백";
    return rest === 0 ? head : head + " " + sinoKoreanReading(rest);
  }
  return String(n); // out of range — leave to the engine
}

function prepareForSpeech(input: string): string {
  let t = input.trim();
  // Strip markdown emphasis that engines literally read out.
  t = t.replace(/\*\*(.+?)\*\*/g, "$1").replace(/\*(.+?)\*/g, "$1");
  // Numbers tied to a score / grade / count unit are spelled out in Hangul
  // so single digits never get heard as ordinals or English letters. The
  // unit characters 점 / 등급 / 건 / 번 / 위 / 회 / 명 / 개 / 차
  // collectively cover Cubixa's domain vocabulary.
  t = t.replace(
    /(\d{1,4})\s*(점|등급|건|번|위|회|명|개|차)/g,
    (_m, num: string, unit: string) => {
      const n = parseInt(num, 10);
      if (Number.isFinite(n)) return `${sinoKoreanReading(n)} ${unit}`;
      return `${num} ${unit}`;
    },
  );
  // For numbers attached to other Korean tokens (e.g. middle-dot lists) we
  // keep the engine's own reader but force a hint space so prosody breaks.
  t = t.replace(/(\d+)(·)/g, "$1 $2");
  // Collapse whitespace.
  t = t.replace(/[\t ]+/g, " ");
  return t;
}

/**
 * Split a long answer into shorter utterances at sentence/clause
 * boundaries. Each chunk is queued separately, which forces the engine to
 * insert a real pause and reset its prosody contour, producing the most
 * natural "breathing" we can get out of Web Speech without an external TTS.
 */
function splitForCadence(text: string): string[] {
  const cleaned = prepareForSpeech(text);
  // Sentence-ending punctuation: . ! ? 죠 요 이에요 etc are tricky in
  // Korean so we err on side of "break on .?! plus newline". A single
  // chunk longer than ~80 chars also gets soft-split on the next comma.
  const sentences = cleaned
    .split(/(?<=[.!?。！？])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const out: string[] = [];
  for (const s of sentences) {
    if (s.length <= 80) {
      out.push(s);
      continue;
    }
    // Soft-split on commas / Korean topic particles after long subject phrase
    const parts = s.split(/(?<=[,，])\s+/);
    let buf = "";
    for (const p of parts) {
      if ((buf + " " + p).trim().length > 80 && buf) {
        out.push(buf.trim());
        buf = p;
      } else {
        buf = (buf + " " + p).trim();
      }
    }
    if (buf) out.push(buf);
  }
  return out;
}

// Voices may load async — listen once for the voiceschanged event.
if (typeof window !== "undefined" && isSynthesisSupported()) {
  window.speechSynthesis.onvoiceschanged = () => {
    cachedKoreanVoice = null;
    pickKoreanVoice();
  };
  // Trigger initial pick (some browsers populate synchronously).
  pickKoreanVoice();
}

export interface SpeakOptions {
  rate?: number; // 0.1..10, default 1
  pitch?: number; // 0..2, default 1
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (code: string) => void;
}

export function speak(text: string, opts: SpeakOptions = {}): void {
  if (!isSynthesisSupported() || !text) return;
  // iOS Safari sometimes "stuck" — calling cancel() first clears the queue.
  try {
    window.speechSynthesis.cancel();
  } catch {
    // ignore
  }

  const voice = pickKoreanVoice();
  // Slightly slower + slightly higher pitch reads more conversational.
  // Tuned by ear on Android Chrome (Google ko-KR Neural) and macOS Yuna.
  // Faster cadence + slightly lower pitch — closer to a male announcer
  // tone. Tuned by ear: 1.10 lands between conversational and broadcast.
  // Pitch 0.96 nudges any borderline female voice down a hair so it still
  // feels closer to the requested male timbre when no male voice exists.
  const rate = opts.rate ?? 1.10;
  const pitch = opts.pitch ?? 0.96;

  const chunks = splitForCadence(text);
  if (chunks.length === 0) return;

  let started = false;
  let cancelled = false;
  let pending = chunks.length;

  const queueChunk = (i: number) => {
    if (cancelled) return;
    const chunk = chunks[i];
    if (!chunk) return;
    const u = new SpeechSynthesisUtterance(chunk);
    if (voice) u.voice = voice;
    u.lang = "ko-KR";
    u.rate = rate;
    u.pitch = pitch;
    u.onstart = () => {
      if (!started) {
        started = true;
        opts.onStart?.();
      }
    };
    u.onend = () => {
      pending -= 1;
      if (pending === 0 && !cancelled) opts.onEnd?.();
    };
    u.onerror = (ev) => {
      const e = ev as SpeechSynthesisErrorEvent;
      // Treat any chunk error as terminal so the auto-cycle can recover.
      cancelled = true;
      opts.onError?.(e.error ?? "unknown");
    };
    try {
      window.speechSynthesis.speak(u);
    } catch {
      cancelled = true;
      opts.onError?.("start-failed");
    }
  };

  for (let i = 0; i < chunks.length; i++) queueChunk(i);
}

export function cancelSpeak(): void {
  if (!isSynthesisSupported()) return;
  try {
    window.speechSynthesis.cancel();
  } catch {
    // ignore
  }
}

/**
 * Best-effort microphone-permission probe. Some Chromium builds throw on
 * Permissions API for "microphone"; we just resolve to "prompt" in that case.
 */
export async function probeMicPermission(): Promise<
  "granted" | "denied" | "prompt"
> {
  if (typeof navigator === "undefined" || !navigator.permissions) {
    return "prompt";
  }
  try {
    const status = await navigator.permissions.query(
      // @ts-expect-error — non-standard but supported in Chromium
      { name: "microphone" },
    );
    return (status.state as "granted" | "denied" | "prompt") ?? "prompt";
  } catch {
    return "prompt";
  }
}
