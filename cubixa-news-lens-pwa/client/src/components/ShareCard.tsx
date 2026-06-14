/*
 * ShareCard — visually rich, shareable summary card.
 *
 * Used by ShareBar's "이미지로 저장" feature. The DOM is captured by
 * html-to-image at 1080x1350 (Instagram portrait) so the result reads well
 * in social feeds. Contains: brand chip, title, big score gauge, verdict
 * badge, top 3 findings, and a "Cubixa News Lens" footer wordmark.
 *
 * IMPORTANT: this card is rendered OFF-SCREEN by ResultView and only made
 * visible during capture. Do not import in app shell.
 */

import { forwardRef, useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import QRCode from "qrcode";
import { hostFromUrl, scoreColor, buildShareUrl } from "@/lib/analysis";
import type { BackendAnalysisResponse } from "@/lib/analysis";

interface Props {
  result: BackendAnalysisResponse;
  sourceUrl: string;
}

/** Renders a QR data-url for the given share permalink. */
function useQrDataUrl(targetUrl: string | null): string | null {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!targetUrl) {
      setDataUrl(null);
      return;
    }
    let active = true;
    QRCode.toDataURL(targetUrl, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 360,
      color: {
        dark: "#1d1430ff",
        light: "#ffffffff",
      },
    })
      .then((url) => {
        if (active) setDataUrl(url);
      })
      .catch(() => {
        if (active) setDataUrl(null);
      });
    return () => {
      active = false;
    };
  }, [targetUrl]);
  return dataUrl;
}

export const ShareCard = forwardRef<HTMLDivElement, Props>(function ShareCard(
  { result, sourceUrl },
  ref
) {
  const score = result.risk?.overall_trust_score ?? 0;
  const verdict = result.risk?.verdict_label ?? "분석 결과";
  const findings = result.risk?.key_findings?.slice(0, 3) ?? [];
  const title = result.meta?.title || "(제목 없음)";
  const host = hostFromUrl(sourceUrl);
  const color = scoreColor(score);
  const shareUrl = result.share_id ? buildShareUrl(result.share_id) : null;
  const qrDataUrl = useQrDataUrl(shareUrl);

  return (
    <div
      ref={ref}
      style={{
        width: 1080,
        height: 1350,
        background:
          "linear-gradient(165deg, oklch(0.97 0.02 295) 0%, oklch(0.94 0.05 295) 55%, oklch(0.91 0.08 305) 100%)",
        fontFamily: "Pretendard Variable, Pretendard, sans-serif",
        position: "relative",
        overflow: "hidden",
        padding: 80,
        color: "oklch(0.22 0.03 280)",
        display: "flex",
        flexDirection: "column",
      }}>
      {/* Decorative halo */}
      <div
        style={{
          position: "absolute",
          top: -200,
          right: -200,
          width: 800,
          height: 800,
          borderRadius: "100%",
          background:
            "radial-gradient(closest-side, oklch(0.7 0.22 295 / 0.35), transparent 70%)",
          filter: "blur(40px)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: -200,
          left: -200,
          width: 700,
          height: 700,
          borderRadius: "100%",
          background:
            "radial-gradient(closest-side, oklch(0.7 0.18 305 / 0.28), transparent 70%)",
          filter: "blur(40px)",
          pointerEvents: "none",
        }}
      />

      {/* Header chip */}
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 12,
          padding: "14px 22px",
          borderRadius: 999,
          background:
            "linear-gradient(135deg, oklch(0.62 0.22 295), oklch(0.55 0.22 305))",
          color: "white",
          alignSelf: "flex-start",
          fontWeight: 700,
          fontSize: 22,
          boxShadow: "0 18px 36px -12px oklch(0.55 0.22 295 / 0.55)",
          position: "relative",
          zIndex: 1,
        }}>
        <Sparkles size={18} strokeWidth={2.4} />
        <span>Cubixa News Lens</span>
        <span
          style={{
            fontFamily: "Pretendard Variable, Space Grotesk, sans-serif",
            fontSize: 13,
            letterSpacing: "0.16em",
            opacity: 0.9,
          }}>
          검증 완료
        </span>
      </div>

      {/* Title */}
      <div style={{ marginTop: 50, position: "relative", zIndex: 1 }}>
        <p
          style={{
            fontFamily: "Pretendard Variable, Space Grotesk, sans-serif",
            fontSize: 16,
            letterSpacing: "0.18em",
            color: "oklch(0.4 0.025 285)",
            margin: 0,
          }}>
          검증 대상 기사
        </p>
        <h2
          style={{
            fontFamily: "Fraunces, serif",
            fontSize: 56,
            fontWeight: 600,
            lineHeight: 1.15,
            margin: "16px 0 18px 0",
            letterSpacing: "-0.02em",
            color: "oklch(0.18 0.03 280)",
            // Allow up to 3 lines visually
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical" as never,
            overflow: "hidden",
          }}>
          {title}
        </h2>
        {host && (
          <span
            style={{
              display: "inline-block",
              padding: "8px 16px",
              borderRadius: 999,
              background: "white",
              fontFamily: "Space Grotesk, sans-serif",
              fontSize: 18,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "oklch(0.4 0.025 285)",
              border: "1px solid oklch(0.92 0.012 295)",
            }}>
            {host}
          </span>
        )}
      </div>

      {/* Big score */}
      <div
        style={{
          marginTop: 80,
          display: "flex",
          alignItems: "flex-end",
          gap: 36,
          position: "relative",
          zIndex: 1,
        }}>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 14,
            color,
          }}>
          <span
            style={{
              fontFamily: "Fraunces, serif",
              fontSize: 280,
              fontWeight: 600,
              lineHeight: 0.95,
              letterSpacing: "-0.04em",
            }}>
            {score}
          </span>
          <span
            style={{
              fontFamily: "Fraunces, serif",
              fontSize: 56,
              fontWeight: 500,
              opacity: 0.6,
            }}>
            /100
          </span>
        </div>
        <div style={{ paddingBottom: 36 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "12px 22px",
              borderRadius: 999,
              background: color,
              color: "white",
              fontWeight: 700,
              fontSize: 22,
              letterSpacing: "0.04em",
            }}>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: "100%",
                background: "white",
                opacity: 0.9,
              }}
            />
            {verdict}
          </div>
          <p
            style={{
              fontFamily: "Space Grotesk, sans-serif",
              fontSize: 16,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "oklch(0.4 0.025 285)",
              marginTop: 14,
            }}>
            OVERALL TRUST SCORE
          </p>
        </div>
      </div>

      {/* Findings */}
      {findings.length > 0 && (
        <div
          style={{
            marginTop: "auto",
            marginBottom: 60,
            padding: 36,
            background: "rgba(255,255,255,0.65)",
            backdropFilter: "blur(8px)",
            borderRadius: 28,
            border: "1px solid oklch(0.92 0.012 295)",
            position: "relative",
            zIndex: 1,
          }}>
          <p
            style={{
              fontFamily: "Space Grotesk, sans-serif",
              fontSize: 14,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "oklch(0.4 0.025 285)",
              margin: "0 0 18px 0",
            }}>
            KEY FINDINGS
          </p>
          <ol
            style={{
              listStyle: "none",
              padding: 0,
              margin: 0,
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}>
            {findings.map((f, i) => (
              <li
                key={i}
                style={{
                  display: "flex",
                  gap: 18,
                  fontSize: 22,
                  lineHeight: 1.45,
                  color: "oklch(0.22 0.03 280)",
                }}>
                <span
                  style={{
                    fontFamily: "Fraunces, serif",
                    fontSize: 28,
                    fontWeight: 600,
                    color: "oklch(0.58 0.22 295)",
                    minWidth: 38,
                  }}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span style={{ flex: 1 }}>{f}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Footer */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: 28,
          position: "relative",
          zIndex: 1,
        }}>
        <div style={{ flex: 1 }}>
          <p
            style={{
              fontFamily: "Fraunces, serif",
              fontSize: 30,
              fontWeight: 600,
              margin: 0,
              letterSpacing: "-0.02em",
            }}>
            Cubixa <span style={{ fontWeight: 400 }}>News Lens</span>
          </p>
          <p
            style={{
              fontFamily: "Pretendard Variable, Space Grotesk, sans-serif",
              fontSize: 13,
              letterSpacing: "0.16em",
              color: "oklch(0.4 0.025 285)",
              margin: "4px 0 0 0",
            }}>
            UTTA AI · 9-에이전트 신뢰도 검증
          </p>
          <p
            style={{
              fontFamily: "Space Grotesk, sans-serif",
              fontSize: 12,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "oklch(0.45 0.025 285)",
              margin: "14px 0 0 0",
            }}>
            cubixanews-j3ebzgvr.manus.space
          </p>
        </div>

        {/* QR code panel */}
        {qrDataUrl && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 10,
              padding: 18,
              borderRadius: 22,
              background: "white",
              boxShadow: "0 18px 36px -16px oklch(0.55 0.18 295 / 0.35)",
              border: "1px solid oklch(0.92 0.012 295)",
            }}>
            <img
              src={qrDataUrl}
              alt="결과 페이지 QR"
              style={{
                width: 160,
                height: 160,
                imageRendering: "pixelated",
                display: "block",
              }}
            />
            <p
              style={{
                fontFamily: "Space Grotesk, sans-serif",
                fontSize: 11,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "oklch(0.4 0.025 285)",
                margin: 0,
                textAlign: "center",
              }}>
              SCAN TO VERIFY
            </p>
          </div>
        )}
      </div>
    </div>
  );
});
