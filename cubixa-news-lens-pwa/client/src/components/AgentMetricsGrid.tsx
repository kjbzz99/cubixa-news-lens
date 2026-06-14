/*
 * AgentMetricsGrid — 5축 신뢰도 지표 그리드
 *
 * 사용자 피드백(v3.8)에 따라 결과 화면의 핵심 지표를 5개 공식 보고서 축으로
 * 정리:  왜곡 가능성 · 사실성 · 출처 신뢰도 · 감정 선동성 · 논리 비약
 *
 * 라벨은 모두 한국어 공식 보고서체. 각 축마다 한 줄 해석을 같이 노출해
 * 점수만 보고도 무슨 위험인지 즉시 이해되도록 한다. 톤은 v3.8 톤다운에
 * 맞춰 채도를 약간 낮춘 보드 색을 사용.
 */

import type {
  BackendSource,
  BackendLogic,
  BackendEmotion,
  BackendFactuality,
  BackendRisk,
} from "@/lib/analysis";

interface Props {
  source?: BackendSource;
  logic?: BackendLogic;
  emotion?: BackendEmotion;
  factuality?: BackendFactuality;
  risk?: BackendRisk;
}

type Tone = "safe" | "caution" | "warning" | "danger";

function toneOf(score: number, invert = false): Tone {
  const v = invert ? 100 - score : score;
  if (v >= 75) return "safe";
  if (v >= 55) return "caution";
  if (v >= 35) return "warning";
  return "danger";
}

// 원래 톤(v3.8 직전)으로 채도 복원
const palette: Record<Tone, { bg: string; fg: string }> = {
  safe: { bg: "oklch(0.95 0.06 155)", fg: "oklch(0.34 0.13 155)" },
  caution: { bg: "oklch(0.95 0.06 95)", fg: "oklch(0.42 0.13 70)" },
  warning: { bg: "oklch(0.95 0.07 50)", fg: "oklch(0.42 0.15 45)" },
  danger: { bg: "oklch(0.95 0.06 25)", fg: "oklch(0.42 0.17 25)" },
};

interface Tile {
  /** 공식 보고서체 라벨 */
  label: string;
  /** 0~100 점수 (높을수록 좋음 또는 invert=true 시 높을수록 위험) */
  value: number;
  /** invert=true 면 위험 척도(높을수록 나쁨) */
  invert?: boolean;
  /** 한 줄 해석 */
  hint?: string;
}

/** 위험 단계명("낮음"/"보통"/"높음"/"매우높음")을 0~100 점수로 환산.
 *  ScoreCard와 동일 매핑 — 낮음=85, 보통=60, 높음=35, 매우높음=15. */
function distortionScore(label?: string): number {
  switch ((label || "").trim()) {
    case "낮음":
      return 85;
    case "보통":
      return 60;
    case "높음":
      return 35;
    case "매우높음":
      return 15;
    default:
      return 50;
  }
}

/** factuality.results의 verdict 분포로 사실성 점수 산출.
 *  사실=100, 일부사실=60, 미확인=40, 허위=0. 결과가 비면 50을 폴백. */
function factualityScore(f?: BackendFactuality): number {
  const items = f?.results;
  if (!items || items.length === 0) return 50;
  const map: Record<string, number> = {
    사실: 100,
    일부사실: 60,
    미확인: 40,
    허위: 0,
  };
  let sum = 0;
  let n = 0;
  for (const r of items) {
    const v = r.verdict ? map[r.verdict.trim()] : undefined;
    if (typeof v === "number") {
      sum += v;
      n += 1;
    }
  }
  if (n === 0) return 50;
  return Math.round(sum / n);
}

export function AgentMetricsGrid({
  source,
  logic,
  emotion,
  factuality,
  risk,
}: Props) {
  // 5축. 순서는 사용자 피드백 그대로:
  // 왜곡 가능성 → 사실성 → 출처 신뢰도 → 감정 선동성 → 논리 비약
  const tiles: Tile[] = [
    {
      label: "왜곡 가능성",
      value: distortionScore(risk?.distortion_risk),
      invert: true,
      hint: "보도 의도·프레임이 사실을 비트는 위험도 (낮을수록 좋음)",
    },
    {
      label: "사실성",
      value: factualityScore(factuality),
      hint: "주장이 외부 자료로 확인되는 정도 (높을수록 좋음)",
    },
    {
      label: "출처 신뢰도",
      value: source?.source_clarity_score ?? 0,
      hint: "공식·실명 출처 비중이 높을수록 높음",
    },
    {
      label: "감정 선동성",
      value: emotion?.emotion_risk_score ?? 0,
      invert: true,
      hint: "감정 자극·과장 표현이 많을수록 높음 (낮을수록 좋음)",
    },
    {
      label: "논리 비약",
      value: 100 - (logic?.logic_score ?? 0),
      invert: true,
      hint: "비약·모순·맥락 누락이 많을수록 높음 (낮을수록 좋음)",
    },
  ];

  return (
    <section className="cnl-card overflow-hidden">
      <header className="px-5 pt-5 pb-3 flex items-baseline justify-between">
        <h3 className="font-display text-base font-semibold tracking-tight">
          핵심 지표
        </h3>
        <span className="cnl-wordmark text-[9px] text-foreground/55 tracking-[0.16em]">
          5축 신뢰도 지표
        </span>
      </header>
      {/* 5개 균등 — 9-에이전트가 동시에 돌아가는 검증 연출에 맞춰
          5축을 한 줄에 가로로 펼쳐 보여준다.
          모바일(좁은 화면)에서는 2열로 자연스럽게 떨어지고,
          sm 이상에서는 5열 균등 배치. */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-px bg-border/60">
        {tiles.map((t) => {
          const p = palette[toneOf(t.value, t.invert)];
          return (
            <div
              key={t.label}
              className="bg-card px-3.5 py-4 flex flex-col items-center text-center gap-2">
              <div
                className="w-14 h-14 rounded-2xl flex flex-col items-center justify-center"
                style={{ background: p.bg, color: p.fg }}>
                <span className="font-display tabular-nums text-[20px] leading-none font-semibold">
                  {t.value}
                </span>
                <span className="cnl-wordmark text-[8px] mt-0.5 opacity-75">
                  /100
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-[12px] font-medium text-foreground/85 leading-tight">
                  {t.label}
                </p>
                {t.hint && (
                  <p className="mt-1 text-[10px] leading-snug text-foreground/55">
                    {t.hint}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
