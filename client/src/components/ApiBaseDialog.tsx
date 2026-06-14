/*
 * ApiBaseDialog — advanced setting to override the backend URL.
 * Useful when the temporary Manus public proxy rotates or when
 * self-hosting the backend.
 */

import { useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { getApiBase, setApiBase } from "@/lib/config";

export function ApiBaseDialog({ onClose }: { onClose: () => void }) {
  const [value, setValue] = useState(getApiBase());

  function save() {
    if (value && !/^https?:\/\//.test(value)) {
      toast.error("URL은 http:// 또는 https:// 로 시작해야 합니다");
      return;
    }
    setApiBase(value.trim());
    toast.success("백엔드 주소가 저장되었습니다");
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/30 p-4 sm:items-center">
      <div className="w-full max-w-md rounded-3xl bg-card p-5 shadow-xl">
        <header className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-base font-semibold tracking-tight">
              백엔드 주소
            </h3>
            <p className="mt-1 text-[12px] text-foreground/55">
              임시 프록시가 만료되었을 때 새 주소로 바꿀 수 있어요.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="-mr-1 flex size-8 items-center justify-center rounded-full hover:bg-secondary"
            aria-label="닫기">
            <X className="size-4" />
          </button>
        </header>

        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          inputMode="url"
          spellCheck={false}
          className="mt-4 w-full rounded-xl bg-secondary/60 border border-transparent px-4 py-3 text-[13px] font-mono outline-none focus:bg-card focus:border-primary/40"
          placeholder="https://your-backend.example.com"
        />

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl bg-secondary py-2.5 text-sm font-medium text-secondary-foreground hover:bg-accent">
            취소
          </button>
          <button
            type="button"
            onClick={save}
            className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground">
            저장
          </button>
        </div>
      </div>
    </div>
  );
}
