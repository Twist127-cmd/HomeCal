"use client";

import { greeting } from "@/lib/appearance";
import { WeatherIcon } from "@/components/ui/WeatherIcon";
import { Car, MapPin, Pause, Play, SkipForward, Timer as TimerIcon } from "lucide-react";
import { useApp } from "@/components/app/AppProvider";
import { useMusic } from "@/components/music/MusicContext";
import { useNow } from "@/hooks/useNow";
import { formatRemaining, remainingMs } from "@/lib/timers";
import { AvatarStack } from "@/components/ui/primitives";
import { useForecast } from "@/hooks/useWeather";
import { useTravel } from "@/hooks/useTravel";
import { addDays, capitalize, fmt, fmtRelativeDay, fmtTime, startOfDay } from "@/lib/dates";
import { profileColor } from "@/lib/profiles";
import { expandEvents } from "@/lib/recurrence";
import type { Occurrence } from "@/lib/types";
import { describeWeather } from "@/providers/weather/WeatherProvider";

/** Full-screen clock + next events, shown after inactivity (kiosk). Tap to leave. */
export function AmbientScreen({ now, night, onWake }: { now: Date; night: boolean; onWake(): void }) {
  const { events, profiles, homePlace } = useApp();
  const forecast = useForecast();
  const upcoming = expandEvents(events, now, addDays(startOfDay(now), 3)).filter((o) => o.end > now);
  const next = upcoming.find((o) => !o.event.allDay) ?? upcoming[0];
  const todayAndTomorrow = upcoming.slice(0, 3);
  const cur = forecast?.current;
  const w = cur ? describeWeather(cur.weatherCode, cur.isDay) : null;
  const today = forecast?.daily[0];

  return (
    <div
      className="fixed inset-0 z-[70] ambient-shell flex animate-fade-in cursor-pointer flex-col overflow-y-auto p-6 select-none sm:p-14"
      onClick={onWake}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onWake(); } }}
      aria-label="Revenir à l’accueil"
    >
      <div className="flex flex-1 flex-col justify-between gap-10 lg:flex-row lg:items-end">
        <div>
          <p className="mb-5 text-2xl font-medium">{greeting(now.getHours())}</p>
          <div className={`tabular leading-none font-normal tracking-tight ${night ? "text-[22vw] lg:text-[16vw] opacity-80" : "text-[24vw] lg:text-[14vw]"}`}>
            {fmt(now, "HH:mm")}
          </div>
          <div className="mt-2 text-3xl font-medium text-muted sm:text-4xl">{capitalize(fmt(now, "EEEE d MMMM"))}</div>
          {w && cur && (
            <div className="mt-6 flex items-center gap-4 text-2xl sm:text-3xl">
              <WeatherIcon code={cur.weatherCode} isDay={cur.isDay} size={44} />
              <span className="tabular font-semibold">{Math.round(cur.temperature)}°</span>
              <span className="text-muted">
                {w.label}
                {today && ` · ${Math.round(today.tMin)}° / ${Math.round(today.tMax)}°`}
              </span>
            </div>
          )}
          {homePlace && <p className="mt-3 text-sm text-muted">{homePlace.name}</p>}
          <AmbientExtras />
        </div>

        {!night && (
          <div className="w-full max-w-xl space-y-4">
            {next && <NextEvent occ={next} upcoming={upcoming} now={now} />}
            <div className="space-y-2">
              {todayAndTomorrow
                .filter((o) => o !== next)
                .slice(0, 2)
                .map((o) => (
                  <div key={o.key} className="flex items-center gap-4 rounded-2xl bg-surface/70 px-4 py-3 text-lg">
                    <span className="h-8 w-1.5 rounded-full" style={{ backgroundColor: profileColor(o.event.profileIds, profiles) }} />
                    <span className="tabular w-28 shrink-0 text-muted">
                      {fmtRelativeDay(o.start, now) === "Aujourd'hui" ? "" : `${fmtRelativeDay(o.start, now).slice(0, 3)}. `}
                      {o.event.allDay ? "journée" : fmtTime(o.start)}
                    </span>
                    <span className="flex-1 truncate font-medium">{o.event.title}</span>
                    <AvatarStack profiles={profiles} ids={o.event.profileIds} size={26} />
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
      <p className="mt-8 text-center text-sm text-muted">Touchez l&apos;écran pour revenir à l’accueil</p>
    </div>
  );
}

/** Secondary info: running timers and the music being played (controls don't wake the screen). */
function AmbientExtras() {
  const { timers } = useApp();
  const music = useMusic();
  const tick = useNow(1000).getTime();
  const active = timers.filter((t) => t.status === "running" || t.status === "paused");
  const p = music.connected ? music.playback : null;
  if (!active.length && !p?.item) return null;
  return (
    <div className="mt-8 flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
      {active.map((t) => {
        const left = remainingMs(t, tick);
        return (
          <div key={t.id} className={`flex items-center gap-3 text-2xl ${left < 60000 && t.status === "running" ? "animate-pulse font-semibold text-warn" : "text-muted"}`}>
            <TimerIcon size={26} /> {t.label} <span className="tabular font-semibold text-text">{formatRemaining(left)}</span>
          </div>
        );
      })}
      {p?.item && (
        <div className="flex max-w-md items-center gap-3 rounded-2xl bg-surface/70 p-2 pr-3">
          {p.item.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.item.image} alt="" className="h-12 w-12 rounded-lg object-cover" />
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate font-medium">{p.item.name}</div>
            <div className="truncate text-sm text-muted">{p.item.subtitle}</div>
          </div>
          <button onClick={music.toggle} className="flex h-11 w-11 items-center justify-center rounded-full bg-text text-bg" aria-label={p.isPlaying ? "Pause" : "Lecture"}>
            {p.isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
          </button>
          <button onClick={music.next} className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-surface-2" aria-label="Suivant">
            <SkipForward size={18} />
          </button>
        </div>
      )}
    </div>
  );
}

function NextEvent({ occ, upcoming, now }: { occ: Occurrence; upcoming: Occurrence[]; now: Date }) {
  const { profiles } = useApp();
  const travel = useTravel(occ, upcoming.filter((o) => o.start.toDateString() === occ.start.toDateString()));
  const inMin = Math.round((occ.start.getTime() - now.getTime()) / 60000);
  const color = profileColor(occ.event.profileIds, profiles);
  return (
    <div className="glass-panel p-6" style={{ borderLeft: `3px solid color-mix(in srgb, ${color} 45%, var(--color-border))` }}>
      <div className="text-sm font-medium tracking-wide uppercase opacity-80">
        {occ.start <= now ? "En cours" : inMin < 60 ? `Dans ${inMin} min` : `Prochain · ${fmtRelativeDay(occ.start, now)}`}
      </div>
      <div className="mt-1 text-3xl font-semibold">{occ.event.title}</div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-lg opacity-90">
        <span className="tabular">{occ.event.allDay ? "Toute la journée" : `${fmtTime(occ.start)} – ${fmtTime(occ.end)}`}</span>
        {occ.event.location && (
          <span className="flex items-center gap-1">
            <MapPin size={18} /> {occ.event.location.label}
          </span>
        )}
      </div>
      {travel && (
        <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-accent-soft text-accent px-4 py-2 text-lg font-medium">
          <Car size={20} /> Départ à {fmtTime(travel.departAt)} · {travel.route.durationMin} min
        </div>
      )}
    </div>
  );
}
