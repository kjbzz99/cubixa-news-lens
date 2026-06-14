/**
 * TalkTakModal — voice/text conversation grounded in the current analysis.
 *
 * Lifecycle:
 *   open=true → show overlay → greet user with score line →
 *   user taps mic OR types → speech recognition or text submit →
 *   send to Forge with system prompt = analysis context →
 *   render reply bubble + speak (optional) → loop.
 *
 * Closing: ESC, backdrop tap, or X button. Cancels in-flight TTS + STT.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Mic,
  MicOff,
  Send,
  Volume2,
  VolumeX,
  X,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

import type { BackendAnalysisResponse } from "@/lib/analysis";
import { buildVoiceSystemPrompt } from "@/lib/voiceContext";
import {
  chatComplete,
  isVoiceChatConfigured,
  type ChatMessage,
} from "@/lib/voiceChat";
import {
  RecognitionSession,
  cancelSpeak,
  isRecognitionSupported,
  isSynthesisSupported,
  speak,
} from "@/lib/speech";
import { useMicLevel } from "@/lib/micLevel";
import { cn } from "@/lib/utils";
import { Sparkles } from "lucide-react";

interface Bubble {
  id: string;
  role: "user" | "assistant";
  text: string;
  pending?: boolean;
}

interface TalkTakModalProps {
  open: boolean;
  onClose: () => void;
  result: BackendAnalysisResponse;
  sourceUrl: string;
}

const TTS_PREF_KEY = "talktak.tts.enabled";
// Lifecycle policy as of v3.3:
//   - Modal open  → mic starts in *persistent* mode immediately (after
//     the greeting begins) and stays on for the whole conversation.
//   - Modal close → the only path that turns the mic off (abort()).
//   - Talk Tak speaking → the mic is *not* turned off; transcripts
//     arriving while TTS plays are dropped via shouldSuppress() so the
//     assistant's own voice can never bleed back in as user input.
// This eliminates the start/stop churn that was causing the engine to
// silently die mid-conversation. The legacy convoMode toggle and the
// silence-autostop timer have been retired.

function makeId(): string {
  return Math.random().toString(36).slice(2, 10);
}

// Filters out filler interjections that Android Chrome happily emits
// as a final transcript while the user is still gathering a thought:
// "어”, “아”, “음”, “네”, “에”. Without this gate the assistant
// front-runs the user every time they breathe in.
const INTERJECTIONS = new Set([
  "어", "아", "음", "네", "예", "응", "아하", "어멐", "아이",
  "에", "에이", "아아", "어어", "음음", "아이고", "아이고ㅅㅅ",
  "아ㅇ", "아 알결", "ㅇㅇ", "ㅇㅜ", "ㅇㅣ",
]);
function isMeaningfulUtterance(s: string): boolean {
  const t = s.trim();
  if (t.length === 0) return false;
  if (INTERJECTIONS.has(t)) return false;
  // Strip non-Hangul/letters so "어..." or "아!" still get filtered.
  const stripped = t.replace(/[\s\.\,\?\!\u3002\uff0c\uff01\uff1f\u2026\-\~\u30fc\u00b7]/g, "");
  if (stripped.length <= 1) return false;
  if (INTERJECTIONS.has(stripped)) return false;
  // Also reject pure repetition of one syllable ("어어어”).
  if (/^(.)\1+$/.test(stripped)) return false;
  return true;
}

export function TalkTakModal({
  open,
  onClose,
  result,
  sourceUrl,
}: TalkTakModalProps) {
  const score = result.risk?.overall_trust_score ?? 0;
  const verdict = result.risk?.verdict_label ?? "분석";

  // Greeting line — shown as the very first assistant bubble on open.
  // Spoken with TTS automatically so the user is greeted before they have
  // to find a button to press.
  const greeting = useMemo(() => {
    const findings = result.risk?.key_findings ?? [];
    const findingLine = findings[0] ? ` 핵심 발견은 "${findings[0]}" 이고요.` : "";
    return `안녕하세요, 톡탁입니다. 이 기사는 ${score}점, ${verdict} 등급이에요.${findingLine} 어떤 게 궁금하세요?`;
  }, [score, verdict, result.risk?.key_findings]);

  const systemPrompt = useMemo(
    () => buildVoiceSystemPrompt(result, sourceUrl),
    [result, sourceUrl],
  );

  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [interim, setInterim] = useState("");
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const [pendingReply, setPendingReply] = useState(false);
  const [speakingNow, setSpeakingNow] = useState(false);
  // Synchronous mirror of speakingNow. The recogniser callback uses this
  // to decide whether to drop a transcript that just arrived (i.e. the
  // assistant's own TTS bleeding back through the mic). React state
  // updates are async, so we must check a ref, not the state value.
  const speakingRef = useRef(false);
  // TTS defaults to ON so Talk Tak speaks first when the modal opens.
  // Users can mute via the speaker icon; the preference is then remembered.
  const [ttsEnabled, setTtsEnabled] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const v = localStorage.getItem(TTS_PREF_KEY);
    if (v === null) return true; // first-time visitors → on
    return v === "1";
  });

  const recRef = useRef<RecognitionSession | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  // Buffers fragmented `final` events from Android Chrome so a single
  // user utterance is collapsed into one send. The 700ms debounce is
  // long enough to reassemble "이 기사 신뢰할 만해?" out of three pieces
  // but short enough that the conversation still feels live.
  const finalBufferRef = useRef<string>("");
  const finalDebounceRef = useRef<number | null>(null);
  // Drives the SVG waveform around the mic button. Always read via ref to
  // avoid re-rendering React on every audio frame.
  const micLevelRef = useMicLevel(listening);

  // ── Open/close lifecycle ────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    // Seed greeting on open (only if no history yet).
    setBubbles((prev) =>
      prev.length === 0
        ? [{ id: makeId(), role: "assistant", text: greeting }]
        : prev,
    );
    // Greet the user with TTS. We never touch the mic from here on —
    // the persistent recogniser is started below and stays on for the
    // whole modal session.
    // Greeting + first mic open. Critical detail for Android Chrome:
    // when TTS audio is playing, SpeechRecognition self-fires `onend`
    // because the engine treats audio output as a competing source.
    // To avoid the visible mic-LED flicker loop we *gate* the mic on
    // the speaking state — we don't open it until TTS finishes.
    if (isSynthesisSupported() && ttsEnabled) {
      window.setTimeout(() => {
        speak(greeting, {
          onStart: () => {
            speakingRef.current = true;
            setSpeakingNow(true);
          },
          onEnd: () => {
            speakingRef.current = false;
            setSpeakingNow(false);
            // Now safe to bring up the mic.
            if (isRecognitionSupported()) {
              window.setTimeout(() => startListeningRef.current?.(), 200);
            }
          },
          onError: () => {
            speakingRef.current = false;
            setSpeakingNow(false);
            if (isRecognitionSupported()) {
              window.setTimeout(() => startListeningRef.current?.(), 200);
            }
          },
        });
      }, 180);
    } else if (isRecognitionSupported()) {
      // No greeting → open the mic immediately.
      window.setTimeout(() => startListeningRef.current?.(), 220);
    }

    // Lock body scroll.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
      cancelSpeak();
      recRef.current?.abort();
      recRef.current = null;
      abortRef.current?.abort();
      if (finalDebounceRef.current) {
        clearTimeout(finalDebounceRef.current);
        finalDebounceRef.current = null;
      }
      finalBufferRef.current = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Keyboard ESC to close.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Auto-scroll to bottom when bubbles change.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
  }, [bubbles, interim]);

  // ── Send a user message and request a reply ─────────────────────────────
  const send = useCallback(
    async (raw: string) => {
      const content = raw.trim();
      if (!content || pendingReply) return;
      if (!isVoiceChatConfigured()) {
        toast.error("Talk Tak이 아직 연결되지 않았어요.");
        return;
      }

      // Cancel any current TTS so the user's new turn is responsive.
      cancelSpeak();

      const userBubble: Bubble = { id: makeId(), role: "user", text: content };
      const assistantId = makeId();
      const placeholder: Bubble = {
        id: assistantId,
        role: "assistant",
        text: "",
        pending: true,
      };
      setBubbles((prev) => [...prev, userBubble, placeholder]);
      setInterim("");
      setText("");
      setPendingReply(true);

      // Build chat history from current bubbles + new user message.
      // Skip pending placeholders.
      const historyMsgs: ChatMessage[] = bubbles
        .filter((b) => !b.pending && b.text.trim())
        .map((b) => ({ role: b.role, content: b.text }));

      const messages: ChatMessage[] = [
        { role: "system", content: systemPrompt },
        ...historyMsgs,
        { role: "user", content },
      ];

      const ctrl = new AbortController();
      abortRef.current = ctrl;

      try {
        const reply = await chatComplete(messages, {
          signal: ctrl.signal,
          temperature: 0.5,
          maxTokens: 360,
        });
        setBubbles((prev) =>
          prev.map((b) =>
            b.id === assistantId ? { ...b, text: reply, pending: false } : b,
          ),
        );
        if (ttsEnabled && isSynthesisSupported()) {
          // Mobile reality check: keeping the mic open during TTS
          // produces a flicker loop on Android Chrome (SpeechRecognition
          // ends the moment audio output starts). So we *pause* the mic
          // for the duration of the reply, then reopen on TTS end.
          recRef.current?.abort();
          recRef.current = null;
          setListening(false);
          if (finalDebounceRef.current) {
            clearTimeout(finalDebounceRef.current);
            finalDebounceRef.current = null;
          }
          finalBufferRef.current = "";
          speak(reply, {
            onStart: () => {
              speakingRef.current = true;
              setSpeakingNow(true);
            },
            onEnd: () => {
              speakingRef.current = false;
              setSpeakingNow(false);
              if (isRecognitionSupported()) {
                window.setTimeout(
                  () => startListeningRef.current?.(),
                  200,
                );
              }
            },
            onError: () => {
              speakingRef.current = false;
              setSpeakingNow(false);
              if (isRecognitionSupported()) {
                window.setTimeout(
                  () => startListeningRef.current?.(),
                  200,
                );
              }
            },
          });
        }
      } catch (e) {
        const msg =
          e instanceof Error ? e.message : "응답을 가져오지 못했어요.";
        setBubbles((prev) =>
          prev.map((b) =>
            b.id === assistantId
              ? {
                  ...b,
                  text: `죄송해요, ${msg} 잠시 후 다시 물어봐 주세요.`,
                  pending: false,
                }
              : b,
          ),
        );
      } finally {
        setPendingReply(false);
        abortRef.current = null;
      }
    },
    [bubbles, pendingReply, systemPrompt, ttsEnabled],
  );

  // ── Recognition control ─────────────────────────────────────────────────
  const startListening = useCallback(() => {
    // Persistent / always-on mic. Opens once per modal session and stays
    // open until the user closes the modal. The recogniser self-restarts
    // on every onend; transcripts arriving while Talk Tak is speaking are
    // dropped via shouldSuppress so its own TTS audio cannot loop back.
    if (recRef.current) return; // already running
    if (!isRecognitionSupported()) {
      toast.error(
        "이 브라우저는 음성 인식을 지원하지 않아요. 텍스트로 질문해 주세요.",
      );
      return;
    }
    const session = new RecognitionSession({
      shouldSuppress: () => speakingRef.current,
      onInterim: (t) => {
        if (speakingRef.current) return;
        setInterim(t);
      },
      onFinal: (t) => {
        setInterim("");
        // Buffer fragmented finals (Android Chrome cuts a single
        // utterance into 2-3 pieces). Wait 700ms after the last
        // final before we actually send. The interjection filter
        // below also drops obvious filler sounds like "ㅇㅣ”, “아”.
        finalBufferRef.current = (finalBufferRef.current
          ? finalBufferRef.current + " "
          : "") + t.trim();
        if (finalDebounceRef.current) {
          clearTimeout(finalDebounceRef.current);
        }
        finalDebounceRef.current = window.setTimeout(() => {
          const buffered = finalBufferRef.current.trim();
          finalBufferRef.current = "";
          finalDebounceRef.current = null;
          if (!isMeaningfulUtterance(buffered)) return;
          send(buffered);
        }, 700);
      },
      onError: (code) => {
        if (code === "not-allowed" || code === "service-not-allowed") {
          toast.error(
            "마이크 권한이 거부됐어요. 브라우저 설정에서 허용 후 다시 시도해 주세요.",
          );
          recRef.current?.abort();
          recRef.current = null;
          setListening(false);
          if (finalDebounceRef.current) {
            clearTimeout(finalDebounceRef.current);
            finalDebounceRef.current = null;
          }
          finalBufferRef.current = "";
        } else if (code === "no-speech" || code === "aborted") {
          // Routine — engine will onend and self-restart.
        } else {
          toast.error(`음성 인식 오류: ${code}`);
        }
      },
      onEnd: () => {
        // Persistent mode spawns another engine immediately. Keep
        // `listening` true so the UI doesn't flicker between chunks.
        setInterim("");
      },
      onRestart: () => {
        setListening(true);
      },
    });
    if (session.start({ persistent: true })) {
      recRef.current = session;
      setListening(true);
    }
  }, [send]);

  // Stable ref to startListening so async TTS callbacks (declared earlier in
  // the file) can re-open the mic without depending on the freshly
  // re-created callback identity each render.
  const startListeningRef = useRef(startListening);
  useEffect(() => {
    startListeningRef.current = startListening;
  }, [startListening]);

  // Manual mic stop — used only by an optional pause UI. The default
  // flow keeps the mic on until the modal closes.
  const stopListening = useCallback(() => {
    recRef.current?.abort();
    recRef.current = null;
    setListening(false);
    setInterim("");
  }, []);

  // ── TTS toggle persistence ──────────────────────────────────────────────
  const toggleTts = useCallback(() => {
    setTtsEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(TTS_PREF_KEY, next ? "1" : "0");
      } catch {
        // ignore
      }
      if (!next) cancelSpeak();
      return next;
    });
  }, []);

  if (!open) return null;

  const recSupported = isRecognitionSupported();
  const ttsSupported = isSynthesisSupported();

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Talk Tak 음성 대화">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="닫기"
        onClick={onClose}
        className="absolute inset-0 bg-black/55 backdrop-blur-sm cursor-default"
      />

      {/* Sheet */}
      <div
        className={cn(
          "relative w-full sm:max-w-lg sm:mx-auto",
          "h-[92vh] sm:h-[80vh] sm:rounded-3xl rounded-t-3xl",
          "bg-background border border-border/60 shadow-2xl",
          "flex flex-col overflow-hidden",
          "animate-in slide-in-from-bottom-8 sm:zoom-in-95 duration-300",
        )}
        style={{
          // strong custom easing per Animation Guide
          animationTimingFunction: "cubic-bezier(0.23, 1, 0.32, 1)",
        }}>
        {/* Header */}
        <header className="flex items-center justify-between px-4 py-3 border-b border-border/40 bg-gradient-to-b from-primary/[0.06] to-transparent">
          <div className="flex items-center gap-2 min-w-0">
            <span className="relative flex size-8 items-center justify-center rounded-xl bg-primary/12 text-primary">
              <span className="absolute inset-0 rounded-xl bg-primary/15 animate-pulse" />
              <Mic className="relative size-4" strokeWidth={2} />
            </span>
            <div className="min-w-0">
              <p className="cnl-wordmark text-[10px] tracking-[0.18em] text-primary/80">
                TALK TAK
              </p>
              <p className="font-display text-[14px] font-semibold tracking-tight truncate">
                이 기사 · 점수{" "}
                <span className="tabular-nums">{score}</span>
                <span className="text-foreground/45 font-normal">
                  {" · "}
                  {verdict}
                </span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {ttsSupported && (
              <button
                type="button"
                onClick={toggleTts}
                aria-label={ttsEnabled ? "음성 응답 끄기" : "음성 응답 켜기"}
                className={cn(
                  "flex size-9 items-center justify-center rounded-lg transition-colors",
                  ttsEnabled
                    ? "bg-primary/15 text-primary"
                    : "hover:bg-secondary text-foreground/55",
                )}>
                {ttsEnabled ? (
                  <Volume2 className="size-4" strokeWidth={1.8} />
                ) : (
                  <VolumeX className="size-4" strokeWidth={1.8} />
                )}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="대화 닫기"
              className="flex size-9 items-center justify-center rounded-lg hover:bg-secondary">
              <X className="size-4" strokeWidth={1.8} />
            </button>
          </div>
                </header>
        {/* Live status bar — always visible so the user knows whether the
            mic is alive, Talk Tak is speaking, or we're waiting on a reply.
            This was added because users couldn't tell why the mic seemed to
            "die" between turns; now every state is named on screen. */}
        <div
          className="px-4 py-2 border-b border-border/40 bg-secondary/30 text-[12px] flex items-center gap-2"
          aria-live="polite">
          <span
            className={cn(
              "size-1.5 rounded-full",
              speakingNow
                ? "bg-primary animate-pulse"
                : listening
                  ? "bg-emerald-500 animate-pulse"
                  : pendingReply
                    ? "bg-amber-500 animate-pulse"
                    : "bg-foreground/30",
            )}
          />
          <span className="text-foreground/70 truncate">
            {speakingNow
              ? "톡탁이 말하는 동안은 마이크가 잠시 꺼져요 · 끝나면 자동으로 켜져요"
              : pendingReply
                ? "톡탁이 생각 중…"
                : listening
                  ? interim
                    ? `“${interim}”`
                    : "듣고 있어요 · 말씀해 주세요"
                  : "마이크 준비 중…"}
          </span>
        </div>
        {/* Bubble feed */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-4 py-4 space-y-3 scroll-smooth">
          {bubbles.map((b) => (
            <BubbleRow key={b.id} bubble={b} />
          ))}
          {interim && (
            <BubbleRow
              bubble={{
                id: "interim",
                role: "user",
                text: interim,
                pending: true,
              }}
            />
          )}
        </div>

        {/* Composer */}
        <div className="border-t border-border/40 bg-background/95 backdrop-blur px-3 py-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
          {!isVoiceChatConfigured() && (
            <p className="mb-2 text-[11.5px] text-destructive text-center">
              Talk Tak 서버 키가 설정되지 않아 응답이 제한돼요.
            </p>
          )}
                    <div className="flex items-end gap-2">
            <div className="flex-1 flex items-end gap-1.5 rounded-2xl border border-border/60 bg-secondary/40 px-3 py-2 focus-within:border-primary/60 transition-colors">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    send(text);
                  }
                }}
                placeholder={
                  recSupported
                    ? "마이크를 누르거나 직접 입력하세요"
                    : "이 브라우저는 음성 미지원 — 직접 입력해 주세요"
                }
                rows={1}
                className="flex-1 resize-none bg-transparent text-[14px] leading-relaxed outline-none placeholder:text-foreground/40 max-h-32"
                disabled={pendingReply}
              />
              <button
                type="button"
                onClick={() => send(text)}
                disabled={!text.trim() || pendingReply}
                aria-label="전송"
                className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-transform"
                style={{
                  transitionDuration: "140ms",
                  transitionTimingFunction:
                    "cubic-bezier(0.23, 1, 0.32, 1)",
                }}>
                {pendingReply ? (
                  <Loader2 className="size-4 animate-spin" strokeWidth={2} />
                ) : (
                  <Send className="size-4" strokeWidth={2} />
                )}
              </button>
            </div>
            {/* Mic button — placed on the right of the composer so the user's
                thumb (one-handed mobile use) lands on it naturally. */}
            <div className="relative shrink-0">
              {/* Mic-level reactive rings — only mounted while listening */}
              {listening && <MicWaveRings levelRef={micLevelRef} />}
              <button
                type="button"
                onClick={listening ? stopListening : startListening}
                disabled={!recSupported}
                aria-pressed={listening}
                aria-label={listening ? "마이크 일시정지" : "마이크 켜기"}
                className={cn(
                  "relative flex size-12 items-center justify-center rounded-2xl transition-transform active:scale-[0.96]",
                  listening
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30"
                    : speakingNow
                      ? "bg-primary/15 text-primary"
                      : "bg-secondary text-foreground hover:bg-accent",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                )}
                style={{
                  transitionDuration: "160ms",
                  transitionTimingFunction:
                    "cubic-bezier(0.23, 1, 0.32, 1)",
                }}>
                {listening ? (
                  <MicOff className="relative size-5" strokeWidth={2} />
                ) : (
                  <Mic className="relative size-5" strokeWidth={2} />
                )}
              </button>
            </div>
          </div>

          <p className="mt-2 text-center text-[10.5px] text-foreground/45 leading-relaxed">
            <span className="inline-flex items-center gap-1 mr-1 text-foreground/55">
              <Sparkles className="size-2.5" strokeWidth={2.2} />
              마이크는 대화 내내 켜져 있어요 · 닫으면 꺼져요
            </span>
            <br className="sm:hidden" />
            Talk Tak · 맥락·의도 기반 오케스트레이션 · 상표 출원 / 특허 4건 출원
            (KR)
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Mic-level waveform rings ─────────────────────────────────────────────
//
// Three concentric soft-purple rings that pulse in real time with the user's
// microphone input level (0..1 RMS) supplied via a ref. We update via
// requestAnimationFrame so that React re-renders never run during audio
// frames — only the rings' transform/opacity values mutate, which the GPU
// composites cheaply.
function MicWaveRings({ levelRef }: { levelRef: { current: number } }) {
  const r1 = useRef<HTMLSpanElement>(null);
  const r2 = useRef<HTMLSpanElement>(null);
  const r3 = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let rafId = 0;
    function tick() {
      const lvl = Math.min(1, Math.max(0, levelRef.current ?? 0));
      // Three rings reach in slightly staggered amplitudes so the wave feels
      // organic rather than a single sphere of light.
      const s1 = 1 + lvl * 0.55;
      const s2 = 1 + lvl * 0.85;
      const s3 = 1 + lvl * 1.15;
      const o1 = 0.55 + lvl * 0.3;
      const o2 = 0.32 + lvl * 0.35;
      const o3 = 0.16 + lvl * 0.32;
      if (r1.current) {
        r1.current.style.transform = `scale(${s1})`;
        r1.current.style.opacity = String(o1);
      }
      if (r2.current) {
        r2.current.style.transform = `scale(${s2})`;
        r2.current.style.opacity = String(o2);
      }
      if (r3.current) {
        r3.current.style.transform = `scale(${s3})`;
        r3.current.style.opacity = String(o3);
      }
      rafId = requestAnimationFrame(tick);
    }
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [levelRef]);

  return (
    <span aria-hidden className="pointer-events-none absolute inset-0">
      <span
        ref={r1}
        className="absolute inset-0 rounded-2xl bg-primary/22"
        style={{ transition: "transform 80ms linear, opacity 80ms linear" }}
      />
      <span
        ref={r2}
        className="absolute inset-0 rounded-2xl bg-primary/14"
        style={{ transition: "transform 110ms linear, opacity 110ms linear" }}
      />
      <span
        ref={r3}
        className="absolute inset-0 rounded-2xl bg-primary/8"
        style={{ transition: "transform 150ms linear, opacity 150ms linear" }}
      />
    </span>
  );
}

// ── Bubble row ──────────────────────────────────────────────────────────────

function BubbleRow({ bubble }: { bubble: Bubble }) {
  const isUser = bubble.role === "user";
  return (
    <div
      className={cn(
        "flex w-full",
        isUser ? "justify-end" : "justify-start",
        "animate-in fade-in slide-in-from-bottom-2",
      )}
      style={{
        animationDuration: "220ms",
        animationTimingFunction: "cubic-bezier(0.23, 1, 0.32, 1)",
      }}>
      <div
        className={cn(
          "max-w-[82%] rounded-2xl px-3.5 py-2.5 text-[13.5px] leading-relaxed whitespace-pre-wrap",
          isUser
            ? "bg-primary text-primary-foreground rounded-br-md"
            : "bg-secondary text-foreground rounded-bl-md",
          bubble.pending && !bubble.text && "min-w-[3rem]",
        )}>
        {bubble.text || (
          <span className="inline-flex items-center gap-1 text-foreground/55">
            <span className="size-1.5 rounded-full bg-current animate-bounce [animation-delay:-0.3s]" />
            <span className="size-1.5 rounded-full bg-current animate-bounce [animation-delay:-0.15s]" />
            <span className="size-1.5 rounded-full bg-current animate-bounce" />
          </span>
        )}
      </div>
    </div>
  );
}
