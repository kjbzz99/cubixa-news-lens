/*
 * AnalyzingOverlay — full-screen "AI is working" visualization.
 *
 * Two stacked panels:
 *   1. PipelineDiagram (top, ~62%) — 9 agent nodes connected by edges.
 *      Active node pulses, completed nodes show check, queued are dimmed.
 *   2. BodyScanner    (bottom, ~38%) — body preview with a sweeping scan
 *      line and live "detected" counters (감정·낚시·논리·출처).
 *
 * The backend runs everything in a single ~30s POST, so we drive the
 * timeline locally with a hand-tuned schedule. When backend resolves the
 * overlay snaps to "complete" and unmounts.
 *
 * Design philosophy: this is the centerpiece moment of the experience —
 * where users feel the AI "thinking". Generous whitespace, deliberate
 * stagger (60ms), GPU-only animations, snappy ease-out custom curves.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, X } from "lucide-react";
import { Brand } from "./Brand";
import { chime, ding, tick as playTick } from "@/lib/sound";

interface AgentNode {
  id: string;
  label: string;
  /** Group color: input / parallel-A / parallel-B / sink */
  group: "in" | "claim" | "search" | "logic" | "emotion" | "source" | "out";
  /** Estimated cumulative time when this node should "activate" (sec). */
  activateAt: number;
  /** Estimated cumulative time when this node should "complete" (sec). */
  completeAt: number;
}

// Schedule tuned to the 30~35s real backend duration. Order:
// fetch → claims → (factuality + source + logic + emotion in parallel)
// → risk synthesis. Numbers are intentionally pessimistic (slightly
// behind reality) so users always see the "complete" snap when /analyze
// resolves, never staring at a stalled pipeline.
const NODES: AgentNode[] = [
  { id: "fetch",      label: "기사 수집",         group: "in",      activateAt: 0,    completeAt: 3 },
  { id: "claims",     label: "주장 분해",         group: "claim",   activateAt: 3,    completeAt: 7 },
  { id: "factuality", label: "사실성 검증",       group: "search",  activateAt: 7,    completeAt: 18 },
  { id: "evidence",   label: "외부 자료 수집",     group: "search",  activateAt: 7,    completeAt: 16 },
  { id: "source",     label: "출처 신뢰도",       group: "source",  activateAt: 9,    completeAt: 17 },
  { id: "logic",      label: "논리 맥락 분석",     group: "logic",   activateAt: 11,   completeAt: 20 },
  { id: "emotion",    label: "감정·제목 과장",    group: "emotion", activateAt: 13,   completeAt: 22 },
  { id: "risk",       label: "위험 종합 평가",    group: "out",     activateAt: 22,   completeAt: 30 },
  { id: "verdict",    label: "최종 판정",         group: "out",     activateAt: 28,   completeAt: 32 },
];

interface Props {
  /** Article body / title preview to show in the BodyScanner */
  preview?: string;
  title?: string;
  /** Best-effort source url to display under header */
  sourceUrl?: string;
  /** Cancel & abort handler */
  onCancel?: () => void;
  /**
   * Set to true the moment backend responds successfully.
   * Triggers a 0.9s celebratory "all-done" cascade before the
   * parent unmounts the overlay.
   */
  completing?: boolean;
}

type NodeState = "queued" | "active" | "done";

export function AnalyzingOverlay({
  preview,
  title,
  sourceUrl,
  onCancel,
  completing = false,
}: Props) {
  const startedAt = useRef(performance.now());
  const [elapsed, setElapsed] = useState(0);
  const [tick, setTick] = useState(0);
  // 0..1 progress of the celebratory completion sequence
  const [completePhase, setCompletePhase] = useState(0);

  // 60fps-friendly RAF loop; we only need ~10fps for state, but RAF
  // pauses cleanly when the tab backgrounds.
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      setElapsed((performance.now() - startedAt.current) / 1000);
      setTick((t) => (t + 1) % 1_000_000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Drive the completion phase from 0→1 over ~700ms once `completing` flips on
  useEffect(() => {
    if (!completing) return;
    chime();
    const start = performance.now();
    let raf = 0;
    const loop = () => {
      const t = Math.min(1, (performance.now() - start) / 700);
      setCompletePhase(t);
      if (t < 1) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [completing]);

  // Play a subtle SFX whenever an agent activates / completes.
  // We track the previous state map in a ref so we only fire on transitions.
  const prevStatesRef = useRef<Record<string, NodeState>>({});
  useEffect(() => {
    if (completing) return; // celebration handles audio itself
    const prev = prevStatesRef.current;
    for (const n of NODES) {
      const before = prev[n.id];
      const after = (() => {
        if (elapsed >= n.completeAt) return "done" as NodeState;
        if (elapsed >= n.activateAt) return "active" as NodeState;
        return "queued" as NodeState;
      })();
      if (before !== after) {
        if (after === "active") playTick();
        else if (after === "done") ding();
      }
    }
    // Snapshot for next tick
    const snap: Record<string, NodeState> = {};
    for (const n of NODES) {
      snap[n.id] =
        elapsed >= n.completeAt
          ? "done"
          : elapsed >= n.activateAt
            ? "active"
            : "queued";
    }
    prevStatesRef.current = snap;
  }, [elapsed, completing]);

  const states: Record<string, NodeState> = useMemo(() => {
    const out: Record<string, NodeState> = {};
    // When completion fires, slam every node into "done" regardless of clock
    if (completing) {
      for (const n of NODES) out[n.id] = "done";
      return out;
    }
    for (const n of NODES) {
      if (elapsed >= n.completeAt) out[n.id] = "done";
      else if (elapsed >= n.activateAt) out[n.id] = "active";
      else out[n.id] = "queued";
    }
    return out;
  }, [elapsed, completing]);

  const activeLabel = completing
    ? "검증 완료"
    : (NODES.find((n) => states[n.id] === "active")?.label ?? "판정 잠시 대기 중…");

  return (
    <div
      className="fixed inset-0 z-50 cnl-mist overflow-hidden flex flex-col"
      role="status"
      aria-live="polite">
      {/* Decorative halos */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 -right-32 h-[420px] w-[420px] rounded-full opacity-50 blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, oklch(0.7 0.22 295 / 0.45), transparent 70%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-40 -left-32 h-[480px] w-[480px] rounded-full opacity-40 blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, oklch(0.7 0.18 305 / 0.4), transparent 70%)",
        }}
      />

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between px-5 pt-5">
        <Brand size="sm" />
        <div className="flex items-center gap-3">
          <span className="cnl-wordmark text-[10.5px] text-foreground/55 tabular-nums">
            T+{elapsed.toFixed(1)}s
          </span>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              aria-label="분석 취소"
              className="flex size-8 items-center justify-center rounded-full bg-card/70 backdrop-blur shadow-sm hover:bg-card active:scale-95 transition-transform">
              <X className="size-3.5 text-foreground/55" strokeWidth={1.9} />
            </button>
          )}
        </div>
      </div>

      {/* Big rotating cube + status */}
      <div
        className="relative z-10 mx-5 mt-3 flex items-center gap-4"
        style={{
          // Shared-element trick: during the second half of the
          // completion phase, slide the whole row up and slightly left
          // toward the result-page header position; fade text away.
          transform:
            completing && completePhase > 0.4
              ? `translate3d(-12px, -${(completePhase - 0.4) * 28}px, 0) scale(${
                  1 - (completePhase - 0.4) * 0.18
                })`
              : undefined,
          transformOrigin: "top left",
          transition: "transform 0.28s var(--ease-out)",
        }}>
        <RotatingCube tick={tick} />
        <div
          className="min-w-0 flex-1"
          style={{
            opacity:
              completing && completePhase > 0.5
                ? Math.max(0, 1 - (completePhase - 0.5) * 2.4)
                : 1,
            transition: "opacity 0.18s var(--ease-out)",
          }}>
          <p className="cnl-wordmark text-[10px] text-foreground/55 tracking-[0.18em]">
            CUBIXA · 뉴스 신뢰도 검증 관제판
          </p>
          <p className="font-display text-[19px] font-semibold tracking-tight leading-tight truncate">
            {activeLabel}
          </p>
          {sourceUrl && (
            <p className="text-[11.5px] text-foreground/55 truncate font-mono">
              {sourceUrl.replace(/^https?:\/\//, "")}
            </p>
          )}
        </div>
      </div>

      {/* Overlay-wide fade-out during the last 35% of completion */}
      <style>{`
        .cnl-overlay-fadeout { transition: opacity 0.32s var(--ease-out); }
      `}</style>
      {/* Pipeline diagram (top) */}
      <div
        className="cnl-overlay-fadeout relative z-10 mx-4 mt-4 flex-[1.55] min-h-[260px]"
        style={{
          opacity:
            completing && completePhase > 0.65
              ? Math.max(0, 1 - (completePhase - 0.65) * 3)
              : 1,
        }}>
        <PipelineDiagram
          nodes={NODES}
          states={states}
          elapsed={elapsed}
          completing={completing}
          completePhase={completePhase}
        />
      </div>

      {/* Body scanner (bottom) */}
      <div
        className="cnl-overlay-fadeout relative z-10 mx-4 mb-4 mt-3 flex-1 min-h-[180px]"
        style={{
          opacity:
            completing && completePhase > 0.55
              ? Math.max(0, 1 - (completePhase - 0.55) * 2.6)
              : 1,
        }}>
        <BodyScanner
          preview={preview}
          title={title}
          elapsed={elapsed}
          tick={tick}
        />
      </div>
    </div>
  );
}

/* ───────────────────────── Rotating cube ───────────────────────── */

function RotatingCube({ tick: _tick }: { tick: number }) {
  return (
    <div className="relative size-14 shrink-0">
      <div
        className="absolute inset-0 rounded-xl"
        style={{
          background:
            "linear-gradient(135deg, oklch(0.55 0.22 295), oklch(0.48 0.20 300))",
          boxShadow:
            "0 10px 22px -14px oklch(0.5 0.22 295 / 0.55)",
          animation: "cnl-cube-spin 3.6s linear infinite",
        }}
      />
      <div
        className="absolute inset-1.5 rounded-lg"
        style={{
          background:
            "linear-gradient(160deg, oklch(0.95 0.04 295 / 0.32), transparent 60%)",
          animation: "cnl-cube-glow 1.8s ease-in-out infinite",
        }}
      />
      {/* Tiny status dot */}
      <span
        className="absolute -top-0.5 -right-0.5 size-2 rounded-full"
        style={{
          background: "oklch(0.62 0.20 160)",
          animation: "cnl-pulse 1.2s ease-in-out infinite",
        }}
      />
    </div>
  );
}

/* ───────────────────────── Pipeline diagram ───────────────────────── */

interface PipelineProps {
  nodes: AgentNode[];
  states: Record<string, NodeState>;
  elapsed: number;
  completing?: boolean;
  /** 0..1 progress of the completion celebration */
  completePhase?: number;
}

/**
 * Hand-laid out node positions on a 320×220 viewBox.
 * Pipeline shape:
 *
 *           [fetch] → [claims]
 *                       │
 *      ┌──────┬─────────┼─────────┬──────┐
 *      ▼      ▼         ▼         ▼      ▼
 *  evidence factuality source  logic  emotion
 *      └──────┴─────────┼─────────┴──────┘
 *                       ▼
 *                     [risk] → [verdict]
 */
const POSITIONS: Record<string, { x: number; y: number }> = {
  fetch:      { x: 36,  y: 30  },
  claims:     { x: 156, y: 30  },
  evidence:   { x: 38,  y: 110 },
  factuality: { x: 102, y: 110 },
  source:     { x: 162, y: 110 },
  logic:      { x: 222, y: 110 },
  emotion:    { x: 282, y: 110 },
  risk:       { x: 162, y: 188 },
  verdict:    { x: 282, y: 188 },
};

// 12 sparkles spread across the SVG center for the celebration burst
const SPARKLES = Array.from({ length: 12 }, (_, i) => ({
  angle: (i / 12) * Math.PI * 2,
  dist: 60 + (i % 3) * 14,
}));

const EDGES: Array<[string, string]> = [
  ["fetch", "claims"],
  ["claims", "evidence"],
  ["claims", "factuality"],
  ["claims", "source"],
  ["claims", "logic"],
  ["claims", "emotion"],
  ["evidence", "risk"],
  ["factuality", "risk"],
  ["source", "risk"],
  ["logic", "risk"],
  ["emotion", "risk"],
  ["risk", "verdict"],
];

function PipelineDiagram({
  nodes,
  states,
  completing = false,
  completePhase = 0,
}: PipelineProps) {
  return (
    <div
      className="cnl-card relative h-full w-full overflow-hidden p-3"
      style={{
        contain: "paint",
        boxShadow: completing
          ? `0 0 0 ${1 + completePhase * 4}px oklch(0.78 0.2 145 / ${
              0.18 * (1 - completePhase)
            })`
          : undefined,
        transition: "box-shadow 0.18s var(--ease-out)",
      }}>
      <p className="cnl-wordmark absolute left-4 top-3 text-[9.5px] text-foreground/55 tracking-[0.16em]">
        CUBIXA 뉴스 신뢰도 검증 흐름
      </p>

      <svg
        viewBox="0 0 320 220"
        preserveAspectRatio="xMidYMid meet"
        className="h-full w-full">
        <defs>
          {/* Edge gradient from violet to fuchsia */}
          <linearGradient id="edge-active" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="oklch(0.55 0.22 295)" stopOpacity="0.95" />
            <stop offset="100%" stopColor="oklch(0.6 0.22 305)" stopOpacity="0.85" />
          </linearGradient>
          <linearGradient id="edge-done" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="oklch(0.62 0.20 295)" stopOpacity="0.7" />
            <stop offset="100%" stopColor="oklch(0.66 0.18 305)" stopOpacity="0.55" />
          </linearGradient>

          {/* Node glow filter — used only by active nodes */}
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Edges */}
        {EDGES.map(([from, to]) => {
          const a = POSITIONS[from];
          const b = POSITIONS[to];
          const sFrom = states[from];
          const sTo = states[to];
          const lit = sFrom === "done" || sFrom === "active";
          const live = sFrom === "done" && sTo === "active";
          const completed = sFrom === "done" && sTo === "done";

          return (
            <g key={`${from}-${to}`}>
              {/* Base line */}
              <line
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={
                  lit
                    ? completed
                      ? "url(#edge-done)"
                      : "url(#edge-active)"
                    : "oklch(0.88 0.012 295)"
                }
                strokeWidth={lit ? 1.1 : 0.8}
                strokeLinecap="round"
                strokeDasharray={lit ? undefined : "3 4"}
                opacity={lit ? 0.95 : 0.6}
              />
              {/* Travelling dot for live edges */}
              {live && (
                <circle r="1.8" fill="oklch(0.55 0.22 295)">
                  <animateMotion dur="1.2s" repeatCount="indefinite">
                    <mpath href={`#path-${from}-${to}`} />
                  </animateMotion>
                </circle>
              )}
              {/* Hidden path used by animateMotion */}
              <path
                id={`path-${from}-${to}`}
                d={`M${a.x},${a.y} L${b.x},${b.y}`}
                fill="none"
                stroke="none"
              />
            </g>
          );
        })}

        {/* Nodes */}
        {nodes.map((n, i) => {
          const p = POSITIONS[n.id];
          if (!p) return null;
          const s = states[n.id];
          return (
            <PipelineNode
              key={n.id}
              node={n}
              pos={p}
              state={s}
              order={i}
              completing={completing}
              completePhase={completePhase}
            />
          );
        })}

        {/* Completion sparkles — small stars expanding outward */}
        {completing && completePhase > 0 && completePhase < 1 && (
          <g>
            {SPARKLES.map((s, i) => {
              const r = 4 + completePhase * s.dist;
              const x = 160 + Math.cos(s.angle) * r;
              const y = 110 + Math.sin(s.angle) * r;
              return (
                <circle
                  key={i}
                  cx={x}
                  cy={y}
                  r={1.6 * (1 - completePhase)}
                  fill="oklch(0.78 0.2 145)"
                  opacity={1 - completePhase}
                />
              );
            })}
          </g>
        )}
      </svg>

      {/* Legend */}
      <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between text-[9.5px] text-foreground/40 cnl-wordmark">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span
              className="size-1.5 rounded-full"
              style={{
                background: "oklch(0.55 0.22 295)",
              }}
            />
            분석 진행
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="size-1.5 rounded-full"
              style={{ background: "oklch(0.62 0.20 160)" }}
            />
            검증 완료
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="size-1.5 rounded-full"
              style={{ background: "oklch(0.86 0.008 295)" }}
            />
            판정 대기
          </span>
        </div>
        <span className="tabular-nums">
          {Object.values(states).filter((s) => s === "done").length}/
          {nodes.length}
        </span>
      </div>
    </div>
  );
}

function PipelineNode({
  node,
  pos,
  state,
  order,
  completing,
  completePhase = 0,
}: {
  node: AgentNode;
  pos: { x: number; y: number };
  state: NodeState;
  order: number;
  completing?: boolean;
  completePhase?: number;
}) {
  const fill =
    state === "done"
      ? "oklch(0.62 0.20 160)"
      : state === "active"
        ? "oklch(0.55 0.22 295)"
        : "oklch(0.97 0.008 295)";
  const stroke =
    state === "queued"
      ? "oklch(0.84 0.012 295)"
      : state === "active"
        ? "oklch(0.45 0.22 295)"
        : "oklch(0.55 0.20 160)";
  const textColor =
    state === "queued" ? "oklch(0.45 0.025 285)" : "oklch(0.18 0.03 280)";

  // Completion bounce: slight scale-up then settle
  const burstScale =
    completing && completePhase < 1
      ? 1 + 0.18 * Math.sin(completePhase * Math.PI)
      : 1;

  return (
    <g
      filter={state === "active" ? "url(#glow)" : undefined}
      style={{
        transformOrigin: `${pos.x}px ${pos.y}px`,
        transform: `scale(${burstScale})`,
        transition: "transform 0.18s var(--ease-out)",
        animation:
          state === "active" && !completing
            ? "cnl-node-pulse 1.4s ease-in-out infinite"
            : undefined,
        // Stagger fade-in only during the first 700ms
        opacity: 1,
      }}>
      {/* Stagger fade-in via CSS animation */}
      <animate
        attributeName="opacity"
        from="0"
        to="1"
        dur="0.4s"
        begin={`${order * 0.06}s`}
        fill="freeze"
      />
      <rect
        x={pos.x - 30}
        y={pos.y - 10}
        width={60}
        height={20}
        rx={11}
        fill={fill}
        stroke={stroke}
        strokeWidth={0.9}
      />
      {state === "done" && (
        <circle cx={pos.x - 19} cy={pos.y} r={3.2} fill="white" opacity="0.95" />
      )}
      <text
        x={pos.x + (state === "done" ? 3 : 0)}
        y={pos.y + 2.5}
        textAnchor="middle"
        fontSize="7.4"
        fontFamily="Pretendard Variable, sans-serif"
        fontWeight="600"
        fill={state === "queued" ? textColor : "white"}>
        {node.label}
      </text>
      {/* Done check tick */}
      {state === "done" && (
        <path
          d={`M${pos.x - 21} ${pos.y - 0.5} l1.4 1.6 l3 -3.2`}
          stroke="oklch(0.45 0.18 145)"
          strokeWidth="1.3"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </g>
  );
}

/* ───────────────────────── Body scanner ───────────────────────── */

interface BodyScannerProps {
  preview?: string;
  title?: string;
  elapsed: number;
  tick: number;
}

const SCAN_PERIOD = 2.4; // seconds for one full top→bottom sweep

function BodyScanner({ preview, title, elapsed }: BodyScannerProps) {
  // Synthesize plausible "detected" counters that grow over time so the
  // user feels real-time discovery even though the backend returns once.
  const counts = useMemo(() => {
    const f = (rate: number, max: number) =>
      Math.min(max, Math.floor(elapsed * rate * (0.85 + Math.random() * 0.15)));
    // Random factor evaluated on every render gives a subtle flicker.
    return {
      claims: f(0.18, 6),
      sources: f(0.14, 5),
      emotion: f(0.07, 3),
      risk: f(0.05, 2),
    };
  }, [elapsed]);

  const previewText =
    preview && preview.length > 0
      ? preview
      : "기사 본문이 분석 엔진에 전달되었습니다. 9개 에이전트가 순차·병렬로 신뢰도 평가를 진행합니다.";

  // 0..1 position of scan line within the panel (re-computed each render).
  const phase = (elapsed % SCAN_PERIOD) / SCAN_PERIOD;
  const scanY = phase * 100; // %

  return (
    <div className="cnl-card relative h-full w-full overflow-hidden p-3">
      <p className="cnl-wordmark absolute left-4 top-3 z-10 text-[9.5px] text-foreground/55 tracking-[0.16em]">
        기사 본문 스캔
      </p>

      <div className="grid h-full grid-cols-[1fr_auto] gap-3 pt-5">
        {/* Body preview with scan line */}
        <div className="relative overflow-hidden rounded-xl bg-secondary/55 p-3">
          {title && (
            <p className="font-display text-[11.5px] font-semibold tracking-tight leading-snug line-clamp-2">
              {title}
            </p>
          )}
          <p
            className="mt-1.5 text-[10.5px] leading-relaxed text-foreground/55"
            style={{
              display: "-webkit-box",
              WebkitLineClamp: 5,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}>
            {previewText}
          </p>

          {/* Scan line */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 h-10"
            style={{
              top: `calc(${scanY}% - 20px)`,
              background:
                "linear-gradient(180deg, transparent 0%, oklch(0.58 0.14 295 / 0.0) 20%, oklch(0.58 0.14 295 / 0.10) 50%, oklch(0.58 0.14 295 / 0.0) 80%, transparent 100%)",
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 h-px"
            style={{
              top: `${scanY}%`,
              background:
                "linear-gradient(90deg, transparent 0%, oklch(0.58 0.14 295 / 0.85) 50%, transparent 100%)",
            }}
          />
        </div>

        {/* Counters */}
        <div className="flex w-[120px] flex-col justify-between">
          <Counter label="주장" value={counts.claims} tone="primary" />
          <Counter label="출처" value={counts.sources} tone="emerald" />
          <Counter label="감정" value={counts.emotion} tone="amber" />
          <Counter label="위험" value={counts.risk} tone="rose" />
        </div>
      </div>
    </div>
  );
}

function Counter({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "primary" | "emerald" | "amber" | "rose";
}) {
  const color = {
    primary: "oklch(0.55 0.14 295)",
    emerald: "oklch(0.6 0.12 160)",
    amber: "oklch(0.66 0.12 75)",
    rose: "oklch(0.58 0.16 25)",
  }[tone];

  return (
    <div className="flex items-baseline justify-between gap-1.5 rounded-lg bg-secondary/40 px-2.5 py-1.5">
      <span className="cnl-wordmark text-[9px] text-foreground/50">
        {label}
      </span>
      <span
        className="font-display text-[18px] font-semibold leading-none tabular-nums"
        style={{ color }}>
        {value}
      </span>
    </div>
  );
}

/* Re-export Check for downstream imports if ever needed */
export { Check };
