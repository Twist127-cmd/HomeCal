"use client";

import clsx from "clsx";
import { AlertTriangle, Car, MapPin, Repeat } from "lucide-react";
import { useApp } from "@/components/app/AppProvider";
import { AvatarStack } from "@/components/ui/primitives";
import { useTravel } from "@/hooks/useTravel";
import { useEventWeather } from "@/hooks/useWeather";
import { clampToDay, daysBetween, fmtRelativeDay, fmtTime } from "@/lib/dates";
import { profileColor } from "@/lib/profiles";
import type { Occurrence } from "@/lib/types";
import { describeWeather } from "@/providers/weather/WeatherProvider";

export function AgendaView({
  start,
  end,
  occurrences,
  conflictKeys,
  now,
  onEvent,
  onDay,
}: {
  start: Date;
  end: Date;
  occurrences: Occurrence[];
  conflictKeys: Set<string>;
  now: Date;
  onEvent(o: Occurrence): void;
  onDay(d: Date): void;
}) {
  const days = daysBetween(start, end)
    .map((d) => ({ d, list: occurrences.filter((o) => clampToDay(o.start, o.end, d)) }))
    .filter((x) => x.list.length);

  if (!days.length)
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-10 text-center text-muted">
        <span className="text-5xl">🌿</span>
        <p className="text-lg">Rien de prévu pour les 30 prochains jours.</p>
        <p className="text-sm">Utilisez « Ajouter quelque chose… » ou demandez à l&apos;assistant.</p>
      </div>
    );

  return (
    <div className="scroll-thin h-full overflow-y-auto px-3 py-3 sm:px-5">
      {days.map(({ d, list }) => (
        <section key={d.toISOString()} className="mb-5">
          <button onClick={() => onDay(d)} className="sticky top-0 z-10 mb-2 flex w-full items-baseline gap-2 bg-bg/95 py-1 text-left backdrop-blur">
            <h3 className="text-base font-semibold">{fmtRelativeDay(d, now)}</h3>
            {fmtRelativeDay(d, now).length < 12 && <span className="text-sm text-muted">{d.toLocaleDateString("fr-CH", { weekday: "long", day: "numeric", month: "long" })}</span>}
          </button>
          <div className="space-y-2">
            {list.map((o) => (
              <AgendaRow key={o.key} occ={o} day={list} conflict={conflictKeys.has(o.key)} now={now} onClick={() => onEvent(o)} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export function AgendaRow({
  occ,
  day,
  conflict,
  now,
  onClick,
  large,
}: {
  occ: Occurrence;
  day: Occurrence[];
  conflict?: boolean;
  now: Date;
  onClick(): void;
  large?: boolean;
}) {
  const { profiles } = useApp();
  const color = profileColor(occ.event.profileIds, profiles);
  const upcoming = occ.end > now && occ.start.getTime() - now.getTime() < 16 * 24 * 3600_000;
  const weather = useEventWeather(occ.event.location, occ.start, upcoming && !occ.event.allDay);
  const travel = useTravel(upcoming ? occ : null, day);
  const w = weather ? describeWeather(weather.weatherCode, weather.isDay) : null;
  const leaveSoon = travel && travel.departAt > now && travel.departAt.getTime() - now.getTime() < 45 * 60000;

  return (
    <button
      onClick={onClick}
      className={clsx(
        "flex w-full items-stretch gap-3 rounded-2xl border border-border bg-surface p-3 text-left shadow-card transition active:scale-[0.99]",
        occ.end < now && "opacity-55",
      )}
    >
      <span className="w-1.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      <div className={clsx("tabular w-14 shrink-0 text-sm", large && "w-16 text-base")}>
        {occ.event.allDay ? (
          <span className="text-muted">Journée</span>
        ) : (
          <>
            <div className="font-semibold">{fmtTime(occ.start)}</div>
            <div className="text-muted">{fmtTime(occ.end)}</div>
          </>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className={clsx("flex items-center gap-1.5 font-semibold", large ? "text-lg" : "text-[15px]")}>
          {conflict && <AlertTriangle size={15} className="shrink-0 text-warn" />}
          <span className="truncate">{occ.event.title}</span>
          {occ.event.recurrence && <Repeat size={13} className="shrink-0 text-muted" />}
        </div>
        {occ.event.location && (
          <div className="mt-0.5 flex items-center gap-1 truncate text-sm text-muted">
            <MapPin size={13} className="shrink-0" /> {occ.event.location.label}
          </div>
        )}
        {travel && (
          <div className={clsx("mt-1 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium", leaveSoon ? "bg-warn/15 text-warn" : "bg-surface-2 text-muted")}>
            <Car size={12} /> Départ {fmtTime(travel.departAt)} · {travel.route.durationMin} min
          </div>
        )}
      </div>
      <div className="flex shrink-0 flex-col items-end justify-between gap-1">
        <AvatarStack profiles={profiles} ids={occ.event.profileIds} size={22} />
        {w && weather && (
          <span className="tabular text-sm text-muted" title={w.label}>
            {w.emoji} {Math.round(weather.temperature)}°
          </span>
        )}
      </div>
    </button>
  );
}
