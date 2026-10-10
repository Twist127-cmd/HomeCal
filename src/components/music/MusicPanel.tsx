"use client";

import clsx from "clsx";
import {
  ExternalLink,
  Laptop,
  ListMusic,
  Music2,
  Pause,
  Play,
  Search,
  SkipBack,
  SkipForward,
  Smartphone,
  Speaker,
  Tv,
  Volume1,
  Volume2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Button, Spinner, inputClass } from "@/components/ui/primitives";
import { useNow } from "@/hooks/useNow";
import type { MusicItem } from "@/providers/music";
import { useMusic } from "./MusicContext";

const fmt = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

function DeviceIcon({ type, size = 18 }: { type: string; size?: number }) {
  const t = type.toLowerCase();
  if (t.includes("smartphone") || t.includes("tablet")) return <Smartphone size={size} />;
  if (t.includes("speaker") || t.includes("avr") || t.includes("audio")) return <Speaker size={size} />;
  if (t.includes("tv") || t.includes("cast")) return <Tv size={size} />;
  return <Laptop size={size} />;
}

/** Full HomeCal music view (Spotify Connect remote). */
export function MusicPanel({ compact }: { compact?: boolean }) {
  const m = useMusic();
  const now = useNow(1000);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MusicItem[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [showDevices, setShowDevices] = useState(false);
  const { setActive, loadLibrary, loadDevices, connected } = m;

  useEffect(() => {
    if (!connected) return;
    setActive(true);
    loadLibrary();
    loadDevices();
    return () => setActive(false);
  }, [connected, setActive, loadLibrary, loadDevices]);

  useEffect(() => {
    if (query.trim().length < 2) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      setSearching(true);
      const r = await m.search(query);
      if (!cancelled) {
        setResults(r);
        setSearching(false);
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  if (!m.enabled) return <p className="p-6 text-muted">La musique est désactivée.</p>;

  if (!m.connected)
    return (
      <div className="flex flex-col items-center gap-4 px-6 py-10 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#1DB954] text-white">
          <Music2 size={30} />
        </span>
        <div>
          <h3 className="text-lg font-semibold">Connecter Spotify</h3>
          <p className="mt-1 text-sm text-muted">
            Pilotez la musique de la maison depuis HomeCal : lecture, playlists, enceintes. Spotify Premium est nécessaire pour contrôler la lecture.
          </p>
        </div>
        <Button variant="primary" size="lg" onClick={m.connect}>
          Connecter mon compte Spotify
        </Button>
        {m.error?.code === "NOT_CONFIGURED" && <p className="text-sm text-warn">{m.error.message}</p>}
      </div>
    );

  const p = m.playback;
  const progress = p ? Math.min(p.durationMs, p.progressMs + (p.isPlaying ? now.getTime() - p.fetchedAt : 0)) : 0;
  const volume = p?.device?.volume ?? null;

  const list = results ?? null;

  return (
    <div className={clsx("space-y-5", compact ? "p-4" : "p-5")}>
      {m.error && <div role="alert" className="rounded-2xl bg-surface-2 p-3 text-sm text-warn">
        <p>{m.error.message}</p>
        {(m.error.code === "ACCESS_DENIED" || m.error.code === "SCOPE_REQUIRED" || m.error.code === "AUTH_EXPIRED") &&
          <Button variant="ghost" onClick={m.connect} className="mt-2">Réautoriser Spotify</Button>}
      </div>}
      {/* now playing */}
      <section className={clsx("flex gap-4", compact ? "flex-col items-center text-center" : "flex-col items-center text-center sm:flex-row sm:text-left")}>
        {p?.item?.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.item.image} alt="" className="h-40 w-40 rounded-2xl object-cover shadow-card sm:h-44 sm:w-44" />
        ) : (
          <span className="flex h-40 w-40 items-center justify-center rounded-2xl bg-surface-2">
            <Music2 size={40} className="text-muted" />
          </span>
        )}
        <div className="min-w-0 flex-1 space-y-3 self-stretch">
          <div>
            <div className="truncate text-xl font-semibold">{p?.item?.name ?? "Rien en lecture"}</div>
            <div className="truncate text-muted">{p?.item ? [p.item.subtitle, p.album].filter(Boolean).join(" · ") : "Choisissez une playlist ci-dessous"}</div>
          </div>
          {p?.item && (
            <div>
              <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
                <div className="h-full rounded-full bg-text transition-[width] duration-1000 ease-linear" style={{ width: `${p.durationMs ? (progress / p.durationMs) * 100 : 0}%` }} />
              </div>
              <div className="tabular mt-1 flex justify-between text-xs text-muted">
                <span>{fmt(progress)}</span>
                <span>{fmt(p.durationMs)}</span>
              </div>
            </div>
          )}
          <div className="flex items-center justify-center gap-3 sm:justify-start">
            <button onClick={m.previous} className="flex h-12 w-12 items-center justify-center rounded-full hover:bg-surface-2" aria-label="Précédent">
              <SkipBack size={22} />
            </button>
            <button
              onClick={m.toggle}
              className="flex h-16 w-16 items-center justify-center rounded-full bg-text text-bg shadow-card transition active:scale-95"
              aria-label={p?.isPlaying ? "Pause" : "Lecture"}
            >
              {p?.isPlaying ? <Pause size={26} fill="currentColor" /> : <Play size={26} fill="currentColor" className="ml-1" />}
            </button>
            <button onClick={m.next} className="flex h-12 w-12 items-center justify-center rounded-full hover:bg-surface-2" aria-label="Suivant">
              <SkipForward size={22} />
            </button>
          </div>
          {volume !== null && p?.device?.supportsVolume && (
            <label className="flex items-center gap-2 text-muted">
              <Volume1 size={18} />
              <input
                type="range"
                min={0}
                max={100}
                defaultValue={volume}
                key={p.device.id}
                onPointerUp={(e) => m.setVolume(Number((e.target as HTMLInputElement).value))}
                onKeyUp={(e) => m.setVolume(Number((e.target as HTMLInputElement).value))}
                className="h-2 flex-1 accent-[var(--color-text)]"
                aria-label="Volume"
              />
              <Volume2 size={18} />
            </label>
          )}
        </div>
      </section>

      {/* device */}
      <section>
        <button
          onClick={() => {
            setShowDevices((v) => !v);
            m.loadDevices();
          }}
          className="flex w-full items-center gap-3 rounded-2xl bg-surface-2 px-4 py-3 text-left"
        >
          <DeviceIcon type={p?.device?.type ?? "computer"} />
          <span className="min-w-0 flex-1">
            <span className="block text-xs text-muted">Appareil</span>
            <span className="block truncate font-medium">{p?.device?.name ?? "Aucun appareil actif"}</span>
          </span>
          <span className="text-sm text-accent">Changer</span>
        </button>
        {showDevices && (
          <div className="mt-2 space-y-1 rounded-2xl border border-border p-1">
            {m.devices.length === 0 && (
              <p className="px-3 py-3 text-sm text-muted">Aucun appareil trouvé. Ouvrez Spotify sur un téléphone, un ordinateur ou une enceinte connectée, puis réessayez.</p>
            )}
            {m.devices.map((d) => (
              <button
                key={d.id}
                onClick={() => {
                  m.transfer(d.id);
                  setShowDevices(false);
                }}
                className={clsx("flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-surface-2", d.isActive && "text-accent")}
              >
                <DeviceIcon type={d.type} />
                <span className="flex-1 truncate">{d.name}</span>
                {d.isActive && <span className="text-xs font-semibold">En lecture</span>}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* search */}
      <section>
        <div className="relative">
          <Search size={18} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-muted" />
          <input
            className={`${inputClass} pl-11`}
            placeholder="Rechercher un titre, un artiste, une playlist…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (e.target.value.trim().length < 2) setResults(null);
            }}
          />
          {searching && (
            <span className="absolute top-1/2 right-4 -translate-y-1/2 text-muted">
              <Spinner size={16} />
            </span>
          )}
        </div>
      </section>

      {list ? (
        <ItemList title="Résultats" items={list} onPlay={m.playItem} empty="Aucun résultat" />
      ) : (
        <>
          <ItemList title="Vos playlists" items={m.playlists} onPlay={m.playItem} loading={m.loading} empty="Aucune playlist" grid />
          {m.recent.length > 0 && <ItemList title="Écoutés récemment" items={m.recent} onPlay={m.playItem} empty="" />}
        </>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4 text-sm">
        <Button size="sm" onClick={() => m.open(p?.item)}>
          <ExternalLink size={16} /> Ouvrir Spotify
        </Button>
        <span className="text-muted">
          {m.accountName ? `Connecté : ${m.accountName}` : "Spotify connecté"}
          {m.premium === false && " · Premium requis pour la lecture"}
        </span>
      </div>
    </div>
  );
}

function ItemList({
  title,
  items,
  onPlay,
  loading,
  empty,
  grid,
}: {
  title: string;
  items: MusicItem[];
  onPlay(i: MusicItem): void;
  loading?: boolean;
  empty: string;
  grid?: boolean;
}) {
  return (
    <section>
      <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-muted">
        <ListMusic size={16} /> {title}
      </h4>
      {loading && !items.length ? (
        <div className={clsx(grid ? "grid grid-cols-2 gap-2 sm:grid-cols-3" : "space-y-2")}>
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-surface-2" />
          ))}
        </div>
      ) : !items.length ? (
        <p className="text-sm text-muted">{empty}</p>
      ) : (
        <div className={clsx(grid ? "grid grid-cols-2 gap-2 sm:grid-cols-3" : "space-y-1")}>
          {items.map((it) => (
            <button
              key={it.uri}
              onClick={() => onPlay(it)}
              className="group flex min-w-0 items-center gap-3 rounded-xl p-2 text-left transition hover:bg-surface-2 active:scale-[0.98]"
            >
              {it.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={it.image} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
              ) : (
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-surface-3">
                  <Music2 size={18} className="text-muted" />
                </span>
              )}
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{it.name}</span>
                <span className="block truncate text-xs text-muted">{it.subtitle ?? it.type}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
