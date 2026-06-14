/*
 * EmbedSnippets — for publishers / bloggers / press citing this analysis.
 *
 * Surfaces three flavors of embed code, all backed by the same share_id:
 *   1. SVG <img> tag      — works in environments without JS (e.g. forums)
 *   2. JS <script> snippet — auto-injects an iframe with rich content
 *   3. Raw <iframe>        — for CMSes that strip <script>
 *
 * Tabs let the user pick the snippet that matches their CMS, copy with
 * one tap, and see a live preview rendered with the actual share_id.
 */
import { useMemo, useState } from "react";
import { Code2, Copy, Check, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { getApiBase } from "@/lib/config";
import { cn } from "@/lib/utils";

interface Props {
  shareId: string;
}

type Flavor = "svg" | "script" | "iframe";

const TAB_LABEL: Record<Flavor, string> = {
  svg: "SVG 이미지",
  script: "스크립트 태그",
  iframe: "iframe",
};

export function EmbedSnippets({ shareId }: Props) {
  const [flavor, setFlavor] = useState<Flavor>("script");
  const [copied, setCopied] = useState(false);

  const api = getApiBase();
  const snippets = useMemo(() => {
    return {
      svg: `<a href="https://cubixanews-j3ebzgvr.manus.space/r/${shareId}" target="_blank" rel="noopener">\n  <img src="${api}/r/${shareId}/badge.svg"\n       alt="Cubixa News Lens trust score" width="240" height="64"/>\n</a>`,
      script: `<span data-cubixa-badge="${shareId}"></span>\n<script src="${api}/badge.js" async></script>`,
      iframe: `<iframe src="${api}/embed/${shareId}"\n  width="360" height="96" frameborder="0" loading="lazy"\n  referrerpolicy="no-referrer"\n  title="Cubixa News Lens trust score"></iframe>`,
    };
  }, [api, shareId]);

  function copy() {
    const code = snippets[flavor];
    navigator.clipboard
      .writeText(code)
      .then(() => {
        setCopied(true);
        toast.success("임베드 코드를 복사했어요");
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => toast.error("복사에 실패했어요"));
  }

  return (
    <section className="cnl-card relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-12 -bottom-16 size-44 rounded-full opacity-50"
        style={{
          background:
            "radial-gradient(closest-side, rgba(167,139,250,0.32), transparent 70%)",
        }}
      />
      <div className="relative px-5 py-4">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary">
            <Code2 className="size-4" strokeWidth={1.9} />
          </span>
          <div className="flex-1 min-w-0">
            <p className="cnl-wordmark text-[10px] text-primary/80 mb-0.5">
              EMBED · 출처와 함께 인용하기
            </p>
            <p className="font-display text-[14px] font-semibold leading-tight">
              내 블로그·기사에 신뢰도 배지 붙이기
            </p>
            <p className="mt-1 text-[12px] text-foreground/60 leading-relaxed">
              아래 코드 한 줄을 복사해 글에 붙이면, 본 분석 결과가 자동으로
              임베드됩니다. 점수가 갱신되면 배지도 함께 갱신됩니다.
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-4 flex gap-1 rounded-xl bg-secondary/60 p-1">
          {(Object.keys(TAB_LABEL) as Flavor[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFlavor(f)}
              className={cn(
                "flex-1 h-8 rounded-lg text-[11.5px] font-medium transition-all",
                flavor === f
                  ? "bg-background shadow-sm text-foreground"
                  : "text-foreground/55 hover:text-foreground/80",
              )}>
              {TAB_LABEL[f]}
            </button>
          ))}
        </div>

        {/* Code block */}
        <div className="mt-3 rounded-xl border border-border/60 bg-foreground/[0.04] dark:bg-foreground/[0.06]">
          <pre className="overflow-x-auto px-3 py-2.5 text-[11px] leading-relaxed text-foreground/85 whitespace-pre">
            <code>{snippets[flavor]}</code>
          </pre>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={copy}
            className={cn(
              "inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl text-[12.5px] font-medium",
              copied
                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                : "bg-primary text-primary-foreground hover:opacity-90",
            )}>
            {copied ? (
              <>
                <Check className="size-4" strokeWidth={2.2} />
                복사 완료
              </>
            ) : (
              <>
                <Copy className="size-4" strokeWidth={2} />
                코드 복사
              </>
            )}
          </button>
          <a
            href={`${api}/embed/${shareId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-border/60 bg-background/60 px-3 text-[12px] font-medium text-foreground/70 hover:bg-secondary">
            미리보기
            <ExternalLink className="size-3.5" strokeWidth={2} />
          </a>
        </div>

        {/* Live mini-preview */}
        <div className="mt-4">
          <p className="cnl-wordmark text-[10px] text-foreground/40 mb-1.5">
            LIVE PREVIEW
          </p>
          {flavor === "svg" ? (
            <img
              src={`${api}/r/${shareId}/badge.svg`}
              alt="Cubixa trust badge preview"
              width={240}
              height={64}
              className="rounded-xl border border-border/40 bg-white"
            />
          ) : (
            <iframe
              src={`${api}/embed/${shareId}`}
              width={360}
              height={96}
              frameBorder={0}
              loading="lazy"
              title="Cubixa preview"
              className="rounded-xl border border-border/40 bg-background w-full max-w-[360px]"
            />
          )}
        </div>
      </div>
    </section>
  );
}
