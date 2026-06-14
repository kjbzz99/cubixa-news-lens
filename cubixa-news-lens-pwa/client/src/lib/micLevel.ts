/**
 * useMicLevel — 0..1 RMS amplitude of the user's microphone, sampled via
 * Web Audio API. Designed so the rendering component can drive a waveform
 * or pulsing ring directly from the returned value with `requestAnimationFrame`
 * already smoothed inside this hook.
 *
 * The hook intentionally lazily acquires `getUserMedia()` only when `active`
 * flips to true so the browser permission prompt is not requested up-front.
 *
 * Returns a *ref* (not state) for the current level so consumers can read it
 * inside a 60fps render loop without re-rendering React on every sample.
 */
import { useEffect, useRef } from "react";

/** Smoothing factor for exponential moving average (0..1, higher = snappier). */
const SMOOTH = 0.35;

export function useMicLevel(active: boolean) {
  // Public ref consumed by the visualizer. Always 0..1.
  const levelRef = useRef(0);
  // Internal handles so we can fully tear down on `active=false`.
  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!active) {
      teardown();
      return;
    }

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;

        // Use webkit prefix for older Safari just in case.
        const Ctx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;
        const ctx = new Ctx();
        ctxRef.current = ctx;

        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        analyser.smoothingTimeConstant = 0.6;
        source.connect(analyser);
        analyserRef.current = analyser;

        const buf = new Uint8Array(analyser.fftSize);
        const tick = () => {
          if (!analyserRef.current) return;
          analyserRef.current.getByteTimeDomainData(buf);
          // RMS over the buffer; values in 0..128 around 128 (silence).
          let sumSq = 0;
          for (let i = 0; i < buf.length; i++) {
            const v = (buf[i] - 128) / 128;
            sumSq += v * v;
          }
          const rms = Math.sqrt(sumSq / buf.length);
          // Apply gentle gain so soft speech still moves the bar visibly.
          const boosted = Math.min(1, rms * 2.4);
          // Exponential moving average so the rendered ring feels organic.
          levelRef.current = levelRef.current * (1 - SMOOTH) + boosted * SMOOTH;
          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
      } catch {
        // Permission denied or device unavailable — silently keep level at 0.
        levelRef.current = 0;
      }
    })();

    return () => {
      cancelled = true;
      teardown();
    };

    function teardown() {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      if (analyserRef.current) {
        try {
          analyserRef.current.disconnect();
        } catch {
          /* ignore */
        }
        analyserRef.current = null;
      }
      if (ctxRef.current) {
        try {
          void ctxRef.current.close();
        } catch {
          /* ignore */
        }
        ctxRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      levelRef.current = 0;
    }
  }, [active]);

  return levelRef;
}
