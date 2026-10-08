"use client";

import { useMemo } from "react";
import { useApp } from "@/components/app/AppProvider";
import { useMusic } from "@/components/music/MusicContext";
import { useScenes } from "@/components/scenes/SceneContext";
import { getContextualActions, type ContextualAction } from "@/lib/contextual";
import { features } from "@/lib/features";
import { resolvePersons } from "@/lib/profiles";
import type { Occurrence } from "@/lib/types";
import type { NextDeparture } from "@/hooks/useNextDeparture";

/** 2–4 quick actions chosen by deterministic rules (time, events, departures, music…). */
export function ContextualActions({
  now,
  next,
  departure,
  filter,
  todayCount,
  onAction,
}: {
  now: Date;
  next: Occurrence | null;
  departure: NextDeparture | null;
  filter: string | null;
  todayCount: number;
  onAction(a: ContextualAction): void;
}) {
  const { timers, shopping, profiles } = useApp();
  const music = useMusic();
  const { suggested } = useScenes();
  const minute = Math.floor(now.getTime() / 60000);

  const actions = useMemo(
    () =>
      getContextualActions({
        now: new Date(minute * 60000),
        next,
        nextDepartAt: departure?.travel?.departAt ?? null,
        todayCount,
        selectedPersons: filter ? resolvePersons([filter], profiles).size : 0,
        musicEnabled: features.spotify,
        musicPlaying: !!music.playback?.isPlaying,
        timersRunning: timers.filter((t) => t.status === "running" || t.status === "paused").length,
        timersEnabled: features.timers,
        shoppingCount: shopping.filter((s) => !s.checked).length,
        shoppingEnabled: features.shopping,
        suggestedScene: suggested ? { id: suggested.id, name: suggested.name, icon: suggested.icon } : null,
      }),
    [minute, next, departure?.travel?.departAt, todayCount, filter, profiles, music.playback?.isPlaying, timers, shopping, suggested],
  );

  return (
    <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
      {actions.map((a) => (
        <button
          key={a.id}
          onClick={() => onAction(a)}
          className="flex h-10 shrink-0 animate-fade-in items-center gap-2 rounded-full border border-border bg-surface px-4 text-sm font-medium shadow-card transition hover:bg-surface-2 active:scale-95"
        >
          <span>{a.icon}</span> {a.label}
        </button>
      ))}
    </div>
  );
}
