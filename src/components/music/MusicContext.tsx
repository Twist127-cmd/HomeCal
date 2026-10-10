"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useApp } from "@/components/app/AppProvider";
import { toast } from "@/components/ui/toast";
import { saveSpotifyConnection } from "@/lib/data/household";
import { features } from "@/lib/features";
import { firestore } from "@/lib/firebase/client";
import { MusicError, type MusicDevice, type MusicItem, type PlaybackState } from "@/providers/music";

export interface MusicState {
  enabled: boolean;
  connected: boolean;
  accountName?: string;
  premium: boolean | null;
  playback: PlaybackState | null;
  devices: MusicDevice[];
  playlists: MusicItem[];
  recent: MusicItem[];
  loading: boolean;
  error: MusicError | null;
  refresh(): Promise<void>;
  loadLibrary(): Promise<void>;
  loadDevices(): Promise<void>;
  toggle(): Promise<void>;
  play(): Promise<void>;
  pause(): Promise<void>;
  next(): Promise<void>;
  previous(): Promise<void>;
  setVolume(v: number): Promise<void>;
  transfer(deviceId: string): Promise<void>;
  playItem(item: MusicItem): Promise<void>;
  search(q: string): Promise<MusicItem[]>;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  open(item?: MusicItem | null): void;
  /** UI asks for faster polling (music panel open) */
  setActive(active: boolean): void;
}

const Ctx = createContext<MusicState | null>(null);

export function useMusic(): MusicState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useMusic must be used inside <MusicContextProvider>");
  return v;
}

export function MusicContextProvider({ children }: { children: ReactNode }) {
  const { music, spotify, user } = useApp();
  const connected = features.spotify && !!spotify?.cipher;
  const [playback, setPlayback] = useState<PlaybackState | null>(null);
  const [devices, setDevices] = useState<MusicDevice[]>([]);
  const [playlists, setPlaylists] = useState<MusicItem[]>([]);
  const [recent, setRecent] = useState<MusicItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<MusicError | null>(null);
  const [active, setActive] = useState(false);
  const busy = useRef(false);

  const handle = useCallback((e: unknown, silent = false) => {
    const err = e instanceof MusicError ? e : new MusicError("UNKNOWN", (e as Error)?.message);
    setError(err);
    if (!silent) toast({ text: err.message, tone: "error" });
    return err;
  }, []);

  const refresh = useCallback(async () => {
    if (!music || !connected || busy.current) return;
    busy.current = true;
    try {
      const p = await music.getCurrentPlayback();
      setPlayback(p);
      setError(null);
    } catch (e) {
      handle(e, true);
    } finally {
      busy.current = false;
    }
  }, [music, connected, handle]);

  // fill account name / premium flag after first connection
  useEffect(() => {
    if (!music || !connected || !user || spotify?.name) return;
    music
      .getProfile()
      .then((p) => saveSpotifyConnection(firestore(), user.uid, { ...spotify!, name: p.name, product: p.product }))
      .catch((e) => handle(e, true));
  }, [music, connected, user, spotify, handle]);

  // polling: fast when playing or panel open, slow otherwise, paused when hidden
  useEffect(() => {
    if (!connected) return;
    let timer: ReturnType<typeof setTimeout>;
    let stopped = false;
    const loop = async () => {
      if (stopped) return;
      if (document.visibilityState === "visible") await refresh();
      timer = setTimeout(loop, active ? 3000 : playback?.isPlaying ? 8000 : 20000);
    };
    loop();
    const onVis = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [connected, refresh, active, playback?.isPlaying]);

  const act = useCallback(
    async (fn: () => Promise<void>, optimistic?: (p: PlaybackState) => PlaybackState) => {
      if (!music) return;
      const before = playback;
      if (optimistic && playback) setPlayback(optimistic(playback));
      try {
        await fn();
        setError(null);
        setTimeout(refresh, 600);
      } catch (e) {
        setPlayback(before);
        handle(e);
      }
    },
    [music, playback, refresh, handle],
  );

  const loadLibrary = useCallback(async () => {
    if (!music || !connected) return;
    setLoading(true);
    try {
      const [pl, rc] = await Promise.all([music.getPlaylists(), music.getRecent().catch(() => [])]);
      setPlaylists(pl);
      setRecent(rc);
    } catch (e) {
      handle(e, true);
    } finally {
      setLoading(false);
    }
  }, [music, connected, handle]);

  const loadDevices = useCallback(async () => {
    if (!music || !connected) return;
    try {
      setDevices(await music.getDevices());
    } catch (e) {
      handle(e, true);
    }
  }, [music, connected, handle]);

  const value = useMemo<MusicState>(
    () => ({
      enabled: features.spotify,
      connected,
      accountName: spotify?.name,
      premium: spotify?.product === "premium" ? true : spotify?.product === "free" || spotify?.product === "open" ? false : null,
      playback,
      devices,
      playlists,
      recent,
      loading,
      error,
      refresh,
      setActive,
      loadLibrary,
      loadDevices,
      toggle: () =>
        playback?.isPlaying
          ? act(() => music!.pause(), (p) => ({ ...p, isPlaying: false }))
          : act(() => music!.play(), (p) => ({ ...p, isPlaying: true, fetchedAt: Date.now() })),
      play: () => act(() => music!.play(), (p) => ({ ...p, isPlaying: true, fetchedAt: Date.now() })),
      pause: () => act(() => music!.pause(), (p) => ({ ...p, isPlaying: false })),
      next: () => act(() => music!.next()),
      previous: () => act(() => music!.previous()),
      setVolume: (v) => act(() => music!.setVolume(v), (p) => (p.device ? { ...p, device: { ...p.device, volume: v } } : p)),
      transfer: (deviceId) =>
        act(async () => {
          await music!.transferPlayback(deviceId, true);
          setDevices((ds) => ds.map((d) => ({ ...d, isActive: d.id === deviceId })));
        }),
      playItem: (item) => act(() => music!.playUri(item.uri)),
      async search(q) {
        if (!music || !connected || q.trim().length < 2) return [];
        try {
          return await music.search(q);
        } catch (e) {
          handle(e, true);
          return [];
        }
      },
      async connect() {
        try {
          await music?.connect();
        } catch (e) {
          handle(e);
        }
      },
      async disconnect() {
        await music?.disconnect();
        setPlayback(null);
        setPlaylists([]);
        setRecent([]);
        setDevices([]);
        toast({ text: "Spotify déconnecté" });
      },
      open(item) {
        if (!music) return;
        const { app, web } = music.openUrl(item);
        const mobile = /iphone|ipad|android/i.test(navigator.userAgent);
        if (mobile) {
          window.location.href = app;
          setTimeout(() => window.open(web, "_blank"), 1200); // fallback when the app is not installed
        } else window.open(web, "_blank", "noopener");
      },
    }),
    [connected, spotify, playback, devices, playlists, recent, loading, error, refresh, music, act, handle, loadLibrary, loadDevices],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
