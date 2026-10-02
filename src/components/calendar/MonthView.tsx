"use client";

import clsx from "clsx";
import { format, isSameDay, isSameMonth } from "date-fns";
import { fr } from "date-fns/locale";
import { clampToDay, daysBetween } from "@/lib/dates";
import type { Occurrence } from "@/lib/types";
import { EventPill } from "./EventBlock";

export function MonthView({
  anchor,
  start,
  end,
  occurrences,
  conflictKeys,
  now,
  onDay,
  onEvent,
}: {
  anchor: Date;
  start: Date;
  end: Date;
  occurrences: Occurrence[];
  conflictKeys: Set<string>;
  now: Date;
  onDay(d: Date): void;
  onEvent(o: Occurrence): void;
}) {
  const days = daysBetween(start, end);
  const weeks = Math.ceil(days.length / 7);
  const max = weeks > 5 ? 3 : 4;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="grid shrink-0 grid-cols-7 border-b border-border">
        {days.slice(0, 7).map((d) => (
          <div key={d.toISOString()} className="py-2 text-center text-xs font-medium tracking-wide text-muted uppercase">
            {format(d, "EEE", { locale: fr })}
          </div>
        ))}
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-7" style={{ gridTemplateRows: `repeat(${weeks}, minmax(0, 1fr))` }}>
        {days.map((d) => {
          const list = occurrences.filter((o) => clampToDay(o.start, o.end, d));
          const today = isSameDay(d, now);
          return (
            <div
              key={d.toISOString()}
              role="button"
              tabIndex={0}
              onClick={() => onDay(d)}
              className={clsx(
                "min-h-0 overflow-hidden border-r border-b border-border p-1 text-left transition hover:bg-surface-2/60",
                !isSameMonth(d, anchor) && "bg-surface-2/40 text-muted",
              )}
            >
              <div className="mb-0.5 flex justify-end">
                <span
                  className={clsx(
                    "tabular inline-flex h-7 min-w-7 items-center justify-center rounded-full px-1 text-sm font-semibold",
                    today && "bg-accent text-white dark:text-black",
                  )}
                >
                  {format(d, "d")}
                </span>
              </div>
              <div className="space-y-0.5">
                {list.slice(0, max).map((o) => (
                  <EventPill key={o.key} occ={o} onClick={() => onEvent(o)} conflict={conflictKeys.has(o.key)} />
                ))}
                {list.length > max && <div className="px-1.5 text-[11px] font-medium text-muted">+{list.length - max} autre(s)</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
