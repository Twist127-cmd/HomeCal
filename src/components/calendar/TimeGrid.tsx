"use client";

import clsx from "clsx";
import { format, isSameDay, isWeekend } from "date-fns";
import { fr } from "date-fns/locale";
import { useEffect, useMemo, useRef } from "react";
import { useForecast } from "@/hooks/useWeather";
import { clampToDay, startOfDay } from "@/lib/dates";
import { layoutDay } from "@/lib/layout";
import type { Occurrence } from "@/lib/types";
import { describeWeather } from "@/providers/weather/WeatherProvider";
import { EventBlock, EventPill } from "./EventBlock";

const HOUR_PX = 56;

export function TimeGrid({
  days,
  occurrences,
  conflictKeys,
  dayStartHour,
  dayEndHour,
  now,
  onSlot,
  onEvent,
}: {
  days: Date[];
  occurrences: Occurrence[];
  conflictKeys: Set<string>;
  dayStartHour: number;
  dayEndHour: number;
  now: Date;
  onSlot(start: Date): void;
  onEvent(o: Occurrence): void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const forecast = useForecast();

  const timed = occurrences.filter((o) => !o.event.allDay && o.end.getTime() - o.start.getTime() < 24 * 3600_000);
  const allDay = occurrences.filter((o) => o.event.allDay || o.end.getTime() - o.start.getTime() >= 24 * 3600_000);

  // extend the visible range if an event falls outside the configured day
  const [startH, endH] = useMemo(() => {
    let s = dayStartHour;
    let e = dayEndHour;
    for (const o of timed) {
      if (!days.some((d) => isSameDay(d, o.start))) continue;
      s = Math.min(s, o.start.getHours());
      const endHour = isSameDay(o.start, o.end) ? o.end.getHours() + (o.end.getMinutes() ? 1 : 0) : 24;
      e = Math.max(e, endHour);
    }
    return [Math.max(0, s), Math.min(24, Math.max(e, s + 1))];
  }, [timed, days, dayStartHour, dayEndHour]);

  const hours = Array.from({ length: endH - startH }, (_, i) => startH + i);
  const gridHeight = hours.length * HOUR_PX;

  // scroll near "now" on first render
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const h = new Date().getHours();
    el.scrollTop = Math.max(0, (h - startH - 1) * HOUR_PX);
  }, [startH]);

  const y = (d: Date) => ((d.getHours() + d.getMinutes() / 60 - startH) * HOUR_PX);

  const handleColumnClick = (day: Date, e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const hoursFloat = (e.clientY - rect.top) / HOUR_PX + startH;
    const minutes = Math.floor((hoursFloat * 60) / 30) * 30;
    const d = startOfDay(day);
    d.setMinutes(minutes);
    onSlot(d);
  };

  const cols = `56px repeat(${days.length}, minmax(0, 1fr))`;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* header */}
      <div className="grid shrink-0 border-b border-border" style={{ gridTemplateColumns: cols }}>
        <div />
        {days.map((d) => {
          const today = isSameDay(d, now);
          const w = forecast?.daily.find((x) => isSameDay(x.date, d));
          return (
            <div key={d.toISOString()} className={clsx("px-1 py-2 text-center", isWeekend(d) && "bg-surface-2/50")}>
              <div className={clsx("text-xs font-medium tracking-wide uppercase", today ? "text-accent" : "text-muted")}>
                {format(d, days.length === 1 ? "EEEE" : "EEE", { locale: fr })}
              </div>
              <div className="flex items-center justify-center gap-1.5">
                <span
                  className={clsx(
                    "tabular inline-flex h-9 min-w-9 items-center justify-center rounded-full px-1 text-xl font-semibold",
                    today && "bg-accent text-white dark:text-black",
                  )}
                >
                  {format(d, "d")}
                </span>
                {w && (
                  <span className="text-xs text-muted" title={describeWeather(w.weatherCode).label}>
                    {describeWeather(w.weatherCode).emoji}
                    <span className="tabular ml-0.5 hidden sm:inline">{Math.round(w.tMax)}°</span>
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* all-day row */}
      {allDay.length > 0 && (
        <div className="grid shrink-0 border-b border-border py-1" style={{ gridTemplateColumns: cols }}>
          <div className="pt-1 pr-2 text-right text-[10px] text-muted uppercase">jour</div>
          {days.map((d) => (
            <div key={d.toISOString()} className="space-y-0.5 px-0.5">
              {allDay
                .filter((o) => clampToDay(o.start, o.end, d))
                .map((o) => (
                  <EventPill key={o.key} occ={o} onClick={() => onEvent(o)} conflict={conflictKeys.has(o.key)} />
                ))}
            </div>
          ))}
        </div>
      )}

      {/* grid */}
      <div ref={scrollRef} className="scroll-thin relative min-h-0 flex-1 overflow-y-auto">
        <div className="grid" style={{ gridTemplateColumns: cols, height: gridHeight }}>
          <div className="relative">
            {hours.map((h, i) => (
              <div key={h} className="tabular absolute right-2 -translate-y-1/2 text-[11px] text-muted" style={{ top: i * HOUR_PX }}>
                {i === 0 ? "" : `${h}:00`}
              </div>
            ))}
          </div>
          {days.map((day) => {
            const items = timed
              .map((o) => ({ o, c: clampToDay(o.start, o.end, day) }))
              .filter((x): x is { o: Occurrence; c: { start: Date; end: Date } } => !!x.c)
              .map(({ o, c }) => ({ item: o, start: c.start.getTime(), end: c.end.getTime() }));
            const laid = layoutDay(items);
            const today = isSameDay(day, now);
            return (
              <div
                key={day.toISOString()}
                className={clsx("relative border-l border-border", isWeekend(day) && "bg-surface-2/40")}
                onClick={(e) => handleColumnClick(day, e)}
              >
                {hours.map((h, i) => (
                  <div key={h} className="absolute inset-x-0 border-t border-border/70" style={{ top: i * HOUR_PX }} />
                ))}
                {laid.map((l) => {
                  const top = y(new Date(l.start));
                  const height = Math.max(((l.end - l.start) / 3600_000) * HOUR_PX, 20);
                  const w = 100 / l.cols;
                  return (
                    <EventBlock
                      key={l.item.key}
                      occ={l.item}
                      top={top}
                      height={height}
                      left={`calc(${l.col * w}% + 2px)`}
                      width={`calc(${w}% - 4px)`}
                      conflict={conflictKeys.has(l.item.key)}
                      now={now}
                      onClick={() => onEvent(l.item)}
                    />
                  );
                })}
                {today && now.getHours() >= startH && now.getHours() < endH && (
                  <div className="pointer-events-none absolute inset-x-0 z-10" style={{ top: y(now) }}>
                    <div className="relative h-0.5 bg-danger">
                      <span className="absolute -top-[5px] -left-[5px] h-3 w-3 rounded-full bg-danger" />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
