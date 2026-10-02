"use client";

import { Car, MapPin } from "lucide-react";
import { useApp } from "@/components/app/AppProvider";
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
  const { events, profiles } = useApp();
  const forecast = useForecast();
  const upcoming = expandEvents(events, now, addDays(startOfDay(now), 3)).filter((o) => o.end > now);
  const next = upcoming.find((o) => !o.event.allDay) ?? upcoming[0];
  const todayAndTomorrow = upcoming.slice(0, 6);
  const cur = forecast?.current;
  const w = cur ? describeWeather(cur.weatherCode, cur.isDay) : null;
  const today = forecast?.daily[0];

  return (
    <div
      className="fixed inset-0 z-[70] flex animate-fade-in cursor-pointer flex-col bg-bg p-8 select-none sm:p-14"
      onClick={onWake}
      role="button"
      aria-label="Revenir au calendrier"
    >
      <div className="flex flex-1 flex-col justify-between gap-10 lg:flex-row lg:items-end">
        <div>
          <div className={`tabular leading-none font-semibold tracking-tight ${night ? "text-[22vw] lg:text-[16vw] opacity-80" : "text-[24vw] lg:text-[14vw]"}`}>
            {fmt(now, "HH:mm")}
          </div>
          <div className="mt-2 text-3xl font-medium text-muted sm:text-4xl">{capitalize(fmt(now, "EEEE d MMMM"))}</div>
          {w && cur && (
            <div className="mt-6 flex items-center gap-4 text-2xl sm:text-3xl">
              <span className="text-5xl">{w.emoji}</span>
              <span className="tabular font-semibold">{Math.round(cur.temperature)}°</span>
              <span className="text-muted">
                {w.label}
                {today && ` · ${Math.round(today.tMin)}° / ${Math.round(today.tMax)}°`}
              </span>
            </div>
          )}
        </div>

        {!night && (
          <div className="w-full max-w-xl space-y-4">
            {next && <NextEvent occ={next} upcoming={upcoming} now={now} />}
            <div className="space-y-2">
              {todayAndTomorrow
                .filter((o) => o !== next)
                .slice(0, 4)
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
      <p className="mt-8 text-center text-sm text-muted">Touchez l&apos;écran pour revenir au calendrier</p>
    </div>
  );
}

function NextEvent({ occ, upcoming, now }: { occ: Occurrence; upcoming: Occurrence[]; now: Date }) {
  const { profiles } = useApp();
  const travel = useTravel(occ, upcoming.filter((o) => o.start.toDateString() === occ.start.toDateString()));
  const inMin = Math.round((occ.start.getTime() - now.getTime()) / 60000);
  const color = profileColor(occ.event.profileIds, profiles);
  return (
    <div className="rounded-[1.75rem] p-6 text-white shadow-pop" style={{ background: `linear-gradient(135deg, ${color}, color-mix(in srgb, ${color} 60%, black))` }}>
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
        <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/20 px-4 py-2 text-lg font-medium">
          <Car size={20} /> Départ à {fmtTime(travel.departAt)} · {travel.route.durationMin} min
        </div>
      )}
    </div>
  );
}
