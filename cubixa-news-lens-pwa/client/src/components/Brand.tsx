/*
 * Cubixa News Lens — brand primitives (v2 / 9-node geometry).
 *
 * Logo concept: a 3×3 lattice of nodes (the nine analytic agents) connected
 * by thin diagonals; the centre node is solid violet to suggest the
 * synthesised verdict. Modern, AI-era feel — schematic and instantly readable
 * at any size including a 32×32 favicon.
 */

import { cn } from "@/lib/utils";

interface BrandProps {
  size?: "sm" | "md" | "lg";
  showUtta?: boolean;
  className?: string;
}

export function Brand({ size = "md", showUtta = true, className }: BrandProps) {
  const dim = size === "sm" ? 28 : size === "md" ? 38 : 50;
  const titleClass =
    size === "sm" ? "text-base" : size === "md" ? "text-xl" : "text-2xl";
  const subClass = size === "sm" ? "text-[9px]" : "text-[10px]";

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <CubeGlyph size={dim} />
      <div className="flex flex-col leading-none">
        <span
          className={cn(
            "font-display font-semibold tracking-tight",
            titleClass,
          )}
          style={{ letterSpacing: "-0.02em" }}>
          Cubixa <span className="font-light text-foreground/65">News Lens</span>
        </span>
        {showUtta && (
          <span
            className={cn("cnl-wordmark mt-1 text-foreground/55", subClass)}
            style={{ letterSpacing: "0.18em" }}>
            UTTA AI
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * 9-node geometric mark — 3×3 lattice with filled centre.
 */
export function CubeGlyph({ size = 32 }: { size?: number }) {
  return (
    <span
      aria-hidden
      className="relative inline-flex shrink-0 items-center justify-center rounded-[28%]"
      style={{
        width: size,
        height: size,
        background:
          "linear-gradient(140deg, oklch(0.42 0.18 295) 0%, oklch(0.58 0.22 295) 55%, oklch(0.72 0.16 295) 100%)",
        boxShadow:
          "0 6px 20px -10px rgba(124,58,237,0.55), inset 0 1px 0 rgba(255,255,255,0.18)",
      }}>
      <svg
        width={size * 0.7}
        height={size * 0.7}
        viewBox="0 0 32 32"
        fill="none"
        aria-hidden>
        <g stroke="white" strokeOpacity="0.55" strokeWidth="1.1" strokeLinecap="round">
          <line x1="6" y1="6" x2="26" y2="6" />
          <line x1="6" y1="16" x2="26" y2="16" />
          <line x1="6" y1="26" x2="26" y2="26" />
          <line x1="6" y1="6" x2="6" y2="26" />
          <line x1="16" y1="6" x2="16" y2="26" />
          <line x1="26" y1="6" x2="26" y2="26" />
          <line x1="6" y1="6" x2="26" y2="26" strokeOpacity="0.28" />
          <line x1="26" y1="6" x2="6" y2="26" strokeOpacity="0.28" />
        </g>

        <g>
          {[
            [6, 6],
            [16, 6],
            [26, 6],
            [6, 16],
            [26, 16],
            [6, 26],
            [16, 26],
            [26, 26],
          ].map(([cx, cy]) => (
            <circle
              key={`${cx}-${cy}`}
              cx={cx}
              cy={cy}
              r="1.7"
              fill="oklch(0.42 0.18 295)"
              stroke="white"
              strokeWidth="1.4"
            />
          ))}
        </g>

        <circle
          cx="16"
          cy="16"
          r="3.4"
          fill="white"
          style={{ filter: "drop-shadow(0 0 4px rgba(255,255,255,0.85))" }}
        />
        <circle cx="16" cy="16" r="1.6" fill="oklch(0.42 0.18 295)" />
      </svg>

      <span
        className="absolute right-1 top-1 size-1.5 rounded-full"
        style={{
          background: "oklch(0.86 0.18 215)",
          boxShadow: "0 0 6px oklch(0.86 0.18 215 / 0.85)",
        }}
      />
    </span>
  );
}
