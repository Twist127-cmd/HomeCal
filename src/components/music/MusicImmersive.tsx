"use client";
import { useEffect, useRef, useState } from "react";
import { Maximize2, Music2, Pause, Play, SkipBack, SkipForward, X } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { useNow } from "@/hooks/useNow";
import { useDesign } from "@/theme/ThemeProvider";
import { musicalTokens } from "@/theme/albumPalette";
import { useAlbumPalette } from "@/theme/useAlbumPalette";
import { useEffectivePreset } from "@/theme/useEffectivePreset";
import { useMusic } from "./MusicContext";
import { MusicPanel } from "./MusicPanel";
export default function MusicImmersive({ onClose }: { onClose(): void }) {
  const m = useMusic(); const p = m.connected ? m.playback : null;
  const { preferences } = useDesign();
  const preset = useEffectivePreset();
  const palette = useAlbumPalette(p?.item?.image);
  const now = useNow(1000).getTime();
  const root = useRef<HTMLDivElement>(null);
  const progress = p ? Math.max(0, Math.min(p.durationMs, p.progressMs + (p.isPlaying ? Math.max(0, now - p.fetchedAt) : 0))) : 0;
  const pct = p && p.durationMs > 0 ? progress / p.durationMs * 100 : 0;
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    root.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key !== "Tab") return;
      const targets = root.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),[tabindex="0"]');
      if (!targets?.length) return;
      const first = targets[0], last = targets[targets.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("keydown", key); before?.focus(); };
  }, [onClose]);
  return <div ref={root} role="dialog" aria-modal="true" aria-label="Spotify immersif" className="music-immersive" style={musicalTokens(palette, preset, preferences.musicAdaptation, true) as React.CSSProperties} data-playing={!!p?.isPlaying}>
    {p?.item?.image && preferences.musicAdaptation !== "off" && <div key={p.item.image} className="music-immersive-backdrop" aria-hidden="true" style={{ backgroundImage: `url(${JSON.stringify(p.item.image)})` }} />}
    <header className="flex items-center justify-between gap-3"><p className="text-sm font-medium">HomeCal / Spotify</p><div className="flex gap-2"><Button aria-label="Plein écran" onClick={() => { if (document.fullscreenElement) void document.exitFullscreen().catch(() => {}); else void root.current?.requestFullscreen?.().catch(() => {}); }}><Maximize2 size={18} /></Button><Button onClick={onClose} aria-label="Fermer Spotify immersif"><X size={20} /></Button></div></header>
    {p?.item ? <div className="music-immersive-content">
      <div className="music-art-frame" key={p.item.image ?? p.item.uri}>{p.item.image ? <Artwork src={p.item.image} /> : <Music2 size={100} strokeWidth={1} />}</div>
      <div className="music-immersive-info"><p className="music-kicker">{p.isPlaying ? "En lecture" : "En pause"}</p><h1 className="mt-3 text-3xl font-medium leading-tight sm:text-5xl">{p.item.name}</h1><p className="mt-3 text-xl text-muted">{p.item.subtitle}</p>{p.album && <p className="mt-2 text-sm text-muted">{p.album}</p>}
        <div className="mt-7 flex items-center gap-4"><Button size="lg" onClick={m.previous} aria-label="Précédent"><SkipBack size={24} /></Button><Button size="lg" variant="primary" onClick={m.toggle} aria-label={p.isPlaying ? "Pause" : "Lecture"}>{p.isPlaying ? <Pause size={26} /> : <Play size={26} />}</Button><Button size="lg" onClick={m.next} aria-label="Suivant"><SkipForward size={24} /></Button></div>
        <div className="mt-6 h-1.5 overflow-hidden rounded-full bg-surface-3" role="progressbar" aria-label="Progression de la lecture" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}><div className="h-full bg-accent" style={{ width: pct + "%" }} /></div><div className="mt-2 flex justify-between text-xs text-muted tabular"><span>{time(progress)}</span><span>{time(p.durationMs)}</span></div>
        {p.device && <p className="mt-5 text-sm text-muted">Lecture sur {p.device.name}</p>}{p.device?.supportsVolume && p.device.volume !== null && <label className="mt-5 block text-sm">Volume<input aria-label="Volume Spotify" className="mt-3 w-full accent-accent" type="range" min={0} max={100} defaultValue={p.device.volume} key={p.device.volume} onChange={(e) => { e.currentTarget.setAttribute("aria-valuetext", e.target.value + "%"); }} onPointerUp={(e) => void m.setVolume(Number(e.currentTarget.value))} onKeyUp={(e) => { if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) void m.setVolume(Number(e.currentTarget.value)); }} /></label>}
        {m.error && <p role="status" className="mt-4 text-sm text-warn">{m.error.message}</p>}
      </div>
    </div> : <div className="mx-auto w-full max-w-3xl py-8"><h1 className="text-3xl font-medium">La musique de la maison.</h1><p className="mt-3 text-muted">Choisissez une playlist ou une écoute récente pour commencer.</p><MusicPanel compact hideImmersive /></div>}
  </div>;
}
function time(ms: number) { const seconds = Math.max(0, Math.floor(ms / 1000)); return Math.floor(seconds / 60) + ":" + String(seconds % 60).padStart(2, "0"); }
function Artwork({ src }: { src: string }) { const [failed, setFailed] = useState(false); return failed ? <Music2 size={100} strokeWidth={1} aria-label="Pochette indisponible" /> : <img src={src} alt="Pochette du titre en cours" width={640} height={640} onError={() => setFailed(true)} />; } // eslint-disable-line @next/next/no-img-element
