/*
 * ClaimsSection — list of decomposed claims (BODY-ONLY).
 * Wrapped by CollapsibleSection.
 */

import type { BackendClaim } from "@/lib/analysis";

interface Props {
  claims?: BackendClaim[];
}

export function ClaimsSection({ claims }: Props) {
  if (!claims || claims.length === 0) return null;

  return (
    <ol className="space-y-3">
      {claims.slice(0, 8).map((c) => (
        <li key={String(c.id)} className="flex gap-3">
          <span className="font-mono text-[11px] tabular-nums text-foreground/40 mt-0.5 shrink-0">
            {String(c.id).padStart(2, "0")}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-[13.5px] leading-relaxed text-foreground/80">
              {c.text}
            </p>
            <div className="mt-1 flex items-center gap-1.5 flex-wrap">
              {c.type && (
                <span className="text-[10px] cnl-wordmark text-foreground/45">
                  {c.type}
                </span>
              )}
              {c.verifiable && (
                <span className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary cnl-wordmark">
                  검증가능
                </span>
              )}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
