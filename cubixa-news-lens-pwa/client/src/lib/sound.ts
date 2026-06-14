/*
 * sound.ts — minimal Web Audio synth for the AnalyzingOverlay.
 *
 * Generates short sine-wave tones with quick attack/decay envelopes.
 * No external audio files; everything is synthesized on demand. The
 * AudioContext is created lazily on the first user gesture (browsers
 * block autoplay until user interaction).
 *
 * Public API:
 *   - isSoundEnabled() / setSoundEnabled(bool)   ← persists in localStorage
 *   - tick()      ← short percussive blip; play when an agent activates
 *   - chime()     ← rising 2-note chord; play on completion
 *   - resume()    ← unlock the AudioContext after first gesture
 */

const STORAGE_KEY = "cubixa.sound.enabled";

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;

function ensureCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    try {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (!Ctor) return null;
      ctx = new Ctor();
      masterGain = ctx.createGain();
      masterGain.gain.value = 0.18;
      masterGain.connect(ctx.destination);
    } catch {
      return null;
    }
  }
  return ctx;
}

export function resume(): void {
  const c = ensureCtx();
  if (c && c.state === "suspended") {
    void c.resume();
  }
}

export function isSoundEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return v === "1";
  } catch {
    return false;
  }
}

export function setSoundEnabled(on: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, on ? "1" : "0");
  } catch {
    /* ignore */
  }
  if (on) resume();
}

interface ToneOpts {
  freq: number;
  duration: number;
  type?: OscillatorType;
  /** Peak gain before the master mix (0..1). Default 0.5 */
  peak?: number;
  /** Attack time in seconds. Default 0.005 */
  attack?: number;
}

function tone(opts: ToneOpts): void {
  const c = ensureCtx();
  if (!c || !masterGain) return;
  const now = c.currentTime;
  const osc = c.createOscillator();
  const env = c.createGain();
  osc.type = opts.type ?? "sine";
  osc.frequency.setValueAtTime(opts.freq, now);

  const peak = opts.peak ?? 0.5;
  const attack = opts.attack ?? 0.005;
  env.gain.setValueAtTime(0, now);
  env.gain.linearRampToValueAtTime(peak, now + attack);
  env.gain.exponentialRampToValueAtTime(0.0001, now + opts.duration);

  osc.connect(env).connect(masterGain);
  osc.start(now);
  osc.stop(now + opts.duration + 0.02);
}

/** Subtle "tick" — agent activated. */
export function tick(): void {
  if (!isSoundEnabled()) return;
  tone({ freq: 1120, duration: 0.07, type: "triangle", peak: 0.32 });
}

/** Soft "ding" — agent completed. */
export function ding(): void {
  if (!isSoundEnabled()) return;
  tone({ freq: 1380, duration: 0.18, type: "sine", peak: 0.28 });
}

/** Celebratory chord on full completion (rising minor third). */
export function chime(): void {
  if (!isSoundEnabled()) return;
  // 660 Hz (E5) → 880 Hz (A5) with overlap to feel "harmonic"
  tone({ freq: 660, duration: 0.32, type: "sine", peak: 0.35 });
  setTimeout(() => tone({ freq: 880, duration: 0.42, type: "sine", peak: 0.32 }), 110);
  setTimeout(() => tone({ freq: 1320, duration: 0.5, type: "triangle", peak: 0.18 }), 240);
}
