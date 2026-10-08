"use client";

import clsx from "clsx";
import { BellRing, Pause, Play, Plus, Timer as TimerIcon, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useApp } from "@/components/app/AppProvider";
import { Button, inputClass } from "@/components/ui/primitives";
import { toast } from "@/components/ui/toast";
import { useModuleStores } from "@/hooks/useModules";
import { useNow } from "@/hooks/useNow";
import { beep, unlockAudio, vibrate } from "@/lib/sound";
import { addTime, formatDuration, formatRemaining, isExpired, newTimer, nowMs, pauseTimer, remainingMs, resumeTimer } from "@/lib/timers";
import type { Timer } from "@/lib/types";

const PRESETS = [1, 3, 5, 10, 15, 30];

export function activeTimers(timers: Timer[]) {
  return timers.filter((t) => t.status === "running" || t.status === "paused").sort((a, b) => a.expiresAt.localeCompare(b.expiresAt));
}

/** Timers panel: running timers + quick creation. */
export function TimersPanel({ large }: { large?: boolean }) {
  const { timers, myProfileId } = useApp();
  const stores = useModuleStores();
  const now = useNow(1000).getTime();
  const [label, setLabel] = useState("");
  const [minutes, setMinutes] = useState("");
  const list = activeTimers(timers);

  const create = (min: number) => {
    if (!stores || !(min > 0)) return;
    unlockAudio();
    const name = label.trim() || "Minuteur";
    stores.timers.add(newTimer(name, min * 60000, nowMs(), myProfileId)).then((t) =>
      toast({ text: `✓ Minuteur « ${t.label} » lancé pour ${formatDuration(t.duration)}`, tone: "success", action: { label: "Annuler", run: () => stores.timers.remove(t.id) } }),
    );
    setLabel("");
    setMinutes("");
    vibrate();
  };

  return (
    <div className="space-y-5 p-4">
      {list.length === 0 ? (
        <p className="rounded-2xl bg-surface-2 p-5 text-center text-muted">Aucun minuteur en cours. Dites « Minuteur 10 minutes pour les pâtes ».</p>
      ) : (
        <div className="space-y-3">
          {list.map((t) => (
            <TimerCard key={t.id} t={t} now={now} large={large} />
          ))}
        </div>
      )}

      <section className="space-y-3 rounded-2xl border border-border p-4">
        <input className={inputClass} placeholder="Nom (ex. Pâtes)" value={label} onChange={(e) => setLabel(e.target.value)} />
        <div className="grid grid-cols-3 gap-2">
          {PRESETS.map((p) => (
            <button
              key={p}
              onClick={() => create(p)}
              className={clsx("rounded-2xl bg-surface-2 font-semibold transition hover:bg-surface-3 active:scale-95", large ? "h-16 text-xl" : "h-12")}
            >
              {p} min
            </button>
          ))}
        </div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            create(Number(minutes.replace(",", ".")));
          }}
        >
          <input className={inputClass} inputMode="decimal" placeholder="Autre durée (min)" value={minutes} onChange={(e) => setMinutes(e.target.value)} />
          <Button type="submit" variant="primary" disabled={!(Number(minutes.replace(",", ".")) > 0)}>
            <Plus size={18} /> Lancer
          </Button>
        </form>
      </section>
    </div>
  );
}

function TimerCard({ t, now, large }: { t: Timer; now: number; large?: boolean }) {
  const stores = useModuleStores();
  const left = remainingMs(t, now);
  const pct = t.duration ? Math.min(100, (1 - left / t.duration) * 100) : 0;
  const urgent = t.status === "running" && left < 60000;
  return (
    <div className={clsx("rounded-2xl border p-4 transition", urgent ? "border-warn bg-warn/10" : "border-border bg-surface")}>
      <div className="flex items-center gap-3">
        <TimerIcon size={large ? 26 : 20} className={urgent ? "text-warn" : "text-muted"} />
        <div className="min-w-0 flex-1">
          <div className={clsx("truncate font-medium", large && "text-lg")}>{t.label}</div>
          <div className={clsx("tabular font-semibold tracking-tight", large ? "text-5xl" : "text-3xl", urgent && "text-warn", t.status === "paused" && "opacity-50")}>
            {formatRemaining(left)}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => stores?.timers.update(t.id, addTime(t, 60000, nowMs()))}
            className="h-11 rounded-full bg-surface-2 px-3 text-sm font-semibold hover:bg-surface-3"
          >
            +1 min
          </button>
          <button
            onClick={() => stores?.timers.update(t.id, t.status === "paused" ? resumeTimer(t, nowMs()) : pauseTimer(t, nowMs()))}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-2 hover:bg-surface-3"
            aria-label={t.status === "paused" ? "Reprendre" : "Pause"}
          >
            {t.status === "paused" ? <Play size={18} /> : <Pause size={18} />}
          </button>
          <button
            onClick={() => stores?.timers.remove(t.id)}
            className="flex h-11 w-11 items-center justify-center rounded-full text-danger hover:bg-danger/10"
            aria-label="Annuler"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-3">
        <div className={clsx("h-full rounded-full transition-[width] duration-1000 ease-linear", urgent ? "bg-warn" : "bg-accent")} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** Compact running timers (header / ambient). */
export function TimerChips({ onOpen, className }: { onOpen(): void; className?: string }) {
  const { timers } = useApp();
  const now = useNow(1000).getTime();
  const list = activeTimers(timers).slice(0, 3);
  if (!list.length) return null;
  return (
    <div className={clsx("flex gap-2", className)}>
      {list.map((t) => {
        const left = remainingMs(t, now);
        const urgent = t.status === "running" && left < 60000;
        return (
          <button
            key={t.id}
            onClick={onOpen}
            className={clsx(
              "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm shadow-card",
              urgent ? "animate-pulse bg-warn text-white" : "bg-surface",
              t.status === "paused" && "opacity-60",
            )}
          >
            <TimerIcon size={14} />
            <span className="max-w-24 truncate">{t.label}</span>
            <span className="tabular font-semibold">{formatRemaining(left)}</span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * Global watcher: marks expired timers as done and shows a full-screen alarm
 * (sound + voice + notification) until stopped. Based on expiresAt, so it also fires
 * after a refresh or when the device wakes up.
 */
export function TimerAlarm() {
  const { timers, household, tts } = useApp();
  const stores = useModuleStores();
  const now = useNow(1000).getTime();
  const announced = useRef(new Set<string>());
  const settings = household?.settings.timers;

  // unlock audio on first interaction (browser autoplay policy)
  useEffect(() => {
    const u = () => unlockAudio();
    window.addEventListener("pointerdown", u, { once: true });
    return () => window.removeEventListener("pointerdown", u);
  }, []);

  // expire timers
  useEffect(() => {
    if (!stores) return;
    for (const t of timers) if (isExpired(t, now)) stores.timers.update(t.id, { status: "done" });
  }, [timers, now, stores]);

  const ringing = timers.filter((t) => t.status === "done" || isExpired(t, now));

  // sound + voice + notification, repeated every 5 s while ringing
  useEffect(() => {
    if (!ringing.length) return;
    const fresh = ringing.filter((t) => !announced.current.has(t.id));
    for (const t of fresh) {
      announced.current.add(t.id);
      if (settings?.voice !== false) tts.speak(`Le minuteur ${t.label} est terminé.`);
      if (settings?.notifications !== false && typeof Notification !== "undefined" && Notification.permission === "granted" && document.visibilityState !== "visible") {
        new Notification("⏱ Minuteur terminé", { body: t.label, tag: `timer-${t.id}`, icon: "/icons/icon-192.png" });
      }
    }
    if (settings?.sound === false) return;
    beep();
    vibrate([300, 150, 300]);
    const id = setInterval(() => {
      beep();
      vibrate([300, 150, 300]);
    }, 5000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ringing.map((t) => t.id).join(",")]);

  if (!ringing.length || !stores) return null;
  const t = ringing[0];
  return (
    <div className="fixed inset-0 z-[80] flex animate-fade-in flex-col items-center justify-center gap-8 bg-black/80 p-8 text-center text-white backdrop-blur-sm">
      <div className="flex h-28 w-28 animate-pulse-ring items-center justify-center rounded-full bg-warn">
        <BellRing size={56} />
      </div>
      <div>
        <div className="text-lg uppercase tracking-widest opacity-80">Minuteur terminé</div>
        <div className="mt-2 text-5xl font-semibold sm:text-7xl">{t.label}</div>
        {ringing.length > 1 && <div className="mt-2 opacity-70">+ {ringing.length - 1} autre(s)</div>}
      </div>
      <div className="flex flex-wrap justify-center gap-4">
        <button
          onClick={() => {
            stores.timers.update(t.id, addTime({ ...t, status: "done" }, 5 * 60000, nowMs()));
            announced.current.delete(t.id);
          }}
          className="h-16 rounded-full bg-white/15 px-8 text-xl font-semibold hover:bg-white/25"
        >
          +5 min
        </button>
        <button
          onClick={() => {
            stores.timers.remove(t.id);
            tts.stop();
          }}
          className="flex h-16 items-center gap-2 rounded-full bg-white px-10 text-xl font-semibold text-black"
        >
          <X size={24} /> Arrêter
        </button>
      </div>
    </div>
  );
}
