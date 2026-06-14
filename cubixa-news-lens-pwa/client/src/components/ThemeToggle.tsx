/*
 * ThemeToggle — sun/moon pill that flips the global theme.
 * Uses ThemeContext (switchable=true). Animates icon swap subtly.
 */

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";

interface Props {
  className?: string;
}

export function ThemeToggle({ className }: Props) {
  const { theme, toggleTheme } = useTheme();
  if (!toggleTheme) return null;
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "라이트 모드로 전환" : "다크 모드로 전환"}
      className={cn(
        "flex size-9 items-center justify-center rounded-full bg-card/70 backdrop-blur shadow-sm hover:bg-card",
        "transition-transform",
        className
      )}>
      <span className="relative size-4">
        <Sun
          className={cn(
            "absolute inset-0 size-4 transition-all duration-300 ease-[cubic-bezier(0.23,1,0.32,1)]",
            isDark ? "scale-0 rotate-90 opacity-0" : "scale-100 rotate-0 opacity-100"
          )}
          strokeWidth={1.7}
        />
        <Moon
          className={cn(
            "absolute inset-0 size-4 transition-all duration-300 ease-[cubic-bezier(0.23,1,0.32,1)]",
            isDark ? "scale-100 rotate-0 opacity-100" : "scale-0 -rotate-90 opacity-0"
          )}
          strokeWidth={1.7}
        />
      </span>
    </button>
  );
}
