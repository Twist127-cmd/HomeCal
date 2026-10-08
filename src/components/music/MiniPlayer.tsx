"use client";

import clsx from "clsx";
import { Music2, Pause, Play, SkipBack, SkipForward } from "lucide-react";
import { useMusic } from "./MusicContext";

/** Discreet "now playing" bar. Tap → full Music view. Hidden when nothing to show. */
export function MiniPlayer({ onOpen, className, variant = "card" }: { onOpen(): void; className?: string; variant?: "card" | "bar" }) {
  const m = useMusic();
  if (!m.enabled || !m.connected || !m.playback?.item) return null;
  const { item, isPlaying, device } = m.playback;

  return (
    <div
      className={clsx(
        "flex min-w-0 items-center gap-3 bg-surface",
        variant === "card" ? "rounded-2xl border border-border p-2.5 shadow-card" : "rounded-xl px-2 py-1.5",
        className,
      )}
    >
      <button onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-label="Ouvrir la musique">
        {item.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.image} alt="" className={clsx("shrink-0 rounded-lg object-cover", variant === "card" ? "h-12 w-12" : "h-10 w-10")} />
        ) : (
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-surface-2">
            <Music2 size={20} className="text-muted" />
          </span>
        )}
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold">{item.name}</span>
          <span className="block truncate text-xs text-muted">
            {item.subtitle}
            {device && variant === "card" ? ` · ${device.name}` : ""}
          </span>
        </span>
      </button>
      <div className="flex shrink-0 items-center">
        {variant === "card" && (
          <button onClick={m.previous} className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-surface-2" aria-label="Précédent">
            <SkipBack size={18} />
          </button>
        )}
        <button
          onClick={m.toggle}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-text text-bg transition active:scale-95"
          aria-label={isPlaying ? "Pause" : "Lecture"}
        >
          {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
        </button>
        <button onClick={m.next} className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-surface-2" aria-label="Suivant">
          <SkipForward size={18} />
        </button>
      </div>
    </div>
  );
}
