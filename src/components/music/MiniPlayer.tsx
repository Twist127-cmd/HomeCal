"use client";

import clsx from "clsx";
import { Music2, Pause, Play, SkipBack, SkipForward } from "lucide-react";
import { useNow } from "@/hooks/useNow";
import type { WidgetSize } from "@/lib/appearance";
import { useMusic } from "./MusicContext";

export function MiniPlayer({ onOpen, className, variant = "card", size = "standard" }: { onOpen(): void; className?: string; variant?: "card" | "bar"; size?: WidgetSize }) {
  const m = useMusic();
  const now = useNow(1000).getTime();
  if (!m.enabled || !m.connected || !m.playback?.item) return null;
  const { item, isPlaying, device, progressMs, durationMs, fetchedAt } = m.playback;
  const progress = Math.max(0, Math.min(durationMs, progressMs + (isPlaying ? Math.max(0, now - fetchedAt) : 0)));
  const pct = durationMs > 0 ? progress / durationMs * 100 : 0;
  const compact = variant === "bar" || size === "compact";
  return (
    <div className={clsx("min-w-0 bg-surface", variant === "card" ? "glass-panel p-4" : "rounded-xl px-2 py-1.5", className)}>
      <div className={clsx("flex min-w-0 gap-3", compact ? "items-center" : "flex-wrap items-center")}>
        <button onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-label="Ouvrir la musique">
          {size !== "compact" && (item.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.image} alt="" loading="lazy" width={compact ? 40 : 64} height={compact ? 40 : 64} className={clsx("shrink-0 rounded-xl object-cover", compact ? "h-10 w-10" : "h-16 w-16")} />
          ) : <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-surface-2"><Music2 size={24} className="text-muted" /></span>)}
          <span className="min-w-0"><span className="block truncate text-sm font-medium">{item.name}</span><span className="mt-1 block truncate text-xs text-muted">{item.subtitle}</span>{!compact && device && <span className="mt-1 block truncate text-xs text-muted">{device.name}</span>}</span>
        </button>
        <div className="flex shrink-0 items-center gap-1">
          {variant === "card" && <button onClick={m.previous} className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-surface-2" aria-label="Précédent"><SkipBack size={18} /></button>}
          <button onClick={m.toggle} className="flex h-11 w-11 items-center justify-center rounded-full bg-accent-soft text-accent transition active:scale-95" aria-label={isPlaying ? "Pause" : "Lecture"}>{isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}</button>
          <button onClick={m.next} className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-surface-2" aria-label="Suivant"><SkipForward size={18} /></button>
        </div>
      </div>
      {!compact && durationMs > 0 && <div className="mt-4 h-1 overflow-hidden rounded-full bg-surface-3" role="progressbar" aria-label="Progression de la lecture" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}><div className="h-full rounded-full bg-accent" style={{ width: pct + "%" }} /></div>}
    </div>
  );
}
