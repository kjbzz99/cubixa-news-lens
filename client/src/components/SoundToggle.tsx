/*
 * SoundToggle — pill-style speaker icon for muting/unmuting analysis SFX.
 *
 * Reads the persisted preference on mount and toggles on click. The
 * AudioContext is created lazily on enable so we satisfy autoplay
 * policies without side effects on initial render.
 */

import { useCallback, useEffect, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";

import {
  isSoundEnabled,
  resume,
  setSoundEnabled,
  tick as playTick,
} from "@/lib/sound";

interface Props {
  className?: string;
}

export function SoundToggle({ className }: Props) {
  const [on, setOn] = useState(false);

  // Hydrate once on mount; useState initializer can't read window safely on SSR
  useEffect(() => {
    setOn(isSoundEnabled());
  }, []);

  const handleClick = useCallback(() => {
    const next = !on;
    setOn(next);
    setSoundEnabled(next);
    if (next) {
      // Confirm enabling with a short audible blip so the user knows it works
      resume();
      playTick();
    }
  }, [on]);

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={on}
      aria-label={on ? "사운드 끄기" : "사운드 켜기"}
      className={
        className ??
        "flex size-9 items-center justify-center rounded-full bg-card/70 backdrop-blur shadow-sm hover:bg-card active:scale-95 transition-transform"
      }>
      {on ? (
        <Volume2 className="size-4 text-foreground/70" strokeWidth={1.7} />
      ) : (
        <VolumeX className="size-4 text-foreground/55" strokeWidth={1.7} />
      )}
    </button>
  );
}
