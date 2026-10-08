"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useApp } from "@/components/app/AppProvider";
import { useMusic } from "@/components/music/MusicContext";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useNow } from "@/hooks/useNow";
import { seedDefaultScenes } from "@/lib/data/modules";
import { inTimeWindow } from "@/lib/dates";
import { features } from "@/lib/features";
import { firestore } from "@/lib/firebase/client";
import type { Scene } from "@/lib/types";

interface SceneState {
  scenes: Scene[];
  active: Scene | null;
  /** scene whose schedule matches now (and is not active) — suggested in contextual actions */
  suggested: Scene | null;
  activate(id: string): void;
  exit(): void;
}

const Ctx = createContext<SceneState | null>(null);

export function useScenes(): SceneState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useScenes must be used inside <SceneProvider>");
  return v;
}

const KEY = "homecal.scene";

/**
 * Active scene is per device (a kitchen tablet can be in "Cuisine" while a phone is not).
 * Scheduled scenes auto-activate on tablets / wall screens only, never on phones.
 */
export function SceneProvider({ children }: { children: ReactNode }) {
  const { scenes, householdId, status } = useApp();
  const music = useMusic();
  const now = useNow(30_000);
  const isPhone = useMediaQuery("(max-width: 767px)");
  const [activeId, setActiveId] = useState<string | null>(() => {
    try {
      return typeof window === "undefined" ? null : localStorage.getItem(KEY);
    } catch {
      return null;
    }
  });
  const autoRef = useRef<{ id: string; day: string } | null>(null);
  const dismissedRef = useRef<string | null>(null);
  const seeded = useRef(false);

  // first use: create the default scenes (Matin, Cuisine, Soir)
  useEffect(() => {
    if (!features.scenes || status !== "ready" || !householdId || seeded.current) return;
    const t = setTimeout(() => {
      if (scenes.length === 0 && !seeded.current) {
        seeded.current = true;
        try {
          if (localStorage.getItem(`homecal.scenesSeeded.${householdId}`)) return;
          localStorage.setItem(`homecal.scenesSeeded.${householdId}`, "1");
        } catch {
          /* ignore */
        }
        seedDefaultScenes(firestore(), householdId);
      } else seeded.current = true;
    }, 2500); // wait for the realtime snapshot
    return () => clearTimeout(t);
  }, [scenes.length, householdId, status]);

  const persist = (id: string | null) => {
    setActiveId(id);
    try {
      if (id) localStorage.setItem(KEY, id);
      else localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
  };

  const activate = useCallback(
    (id: string) => {
      const s = scenes.find((x) => x.id === id);
      if (!s) return;
      persist(id);
      if (s.playlist && s.autoPlay && music.connected) {
        music.playItem({ uri: s.playlist.uri, type: "playlist", name: s.playlist.name });
      }
    },
    [scenes, music],
  );

  const exit = useCallback(() => {
    if (activeId) dismissedRef.current = `${activeId}:${new Date().toDateString()}`;
    autoRef.current = null;
    persist(null);
  }, [activeId]);

  const active = features.scenes ? (scenes.find((s) => s.id === activeId) ?? null) : null;
  const suggested = useMemo(
    () =>
      features.scenes
        ? (scenes.find((s) => s.schedule?.enabled && s.id !== activeId && inTimeWindow(now, s.schedule.start, s.schedule.end)) ?? null)
        : null,
    [scenes, activeId, now],
  );

  // automatic activation / exit (tablets & wall screens)
  useEffect(() => {
    if (!features.scenes || isPhone) return;
    const day = now.toDateString();
    if (suggested && !active) {
      const key = `${suggested.id}:${day}`;
      if (dismissedRef.current === key || autoRef.current?.id === suggested.id) return;
      autoRef.current = { id: suggested.id, day };
      activate(suggested.id);
    } else if (active && autoRef.current?.id === active.id && active.schedule?.enabled && !inTimeWindow(now, active.schedule.start, active.schedule.end)) {
      autoRef.current = null;
      persist(null);
    }
  }, [suggested, active, now, isPhone, activate]);

  const value = useMemo<SceneState>(() => ({ scenes, active, suggested, activate, exit }), [scenes, active, suggested, activate, exit]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
