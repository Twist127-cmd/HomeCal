"use client";

import { addDays } from "date-fns";
import { CalendarPlus } from "lucide-react";
import { useMemo, useState } from "react";
import { useApp } from "@/components/app/AppProvider";
import { Avatar, Chip, Field, Sheet } from "@/components/ui/primitives";
import { findAvailability } from "@/lib/availability";
import { capitalize, fmt, fmtDuration, fmtTime, startOfDay } from "@/lib/dates";
import { expandEvents } from "@/lib/recurrence";
import type { NewEvent } from "@/lib/types";

const DURATIONS = [30, 60, 90, 120, 180];
const RANGES = [
  [1, "Aujourd'hui"],
  [3, "3 jours"],
  [7, "7 jours"],
  [14, "2 semaines"],
] as const;

export function AvailabilitySheet({ now, onClose, onCreate }: { now: Date; onClose(): void; onCreate(draft: Partial<NewEvent>): void }) {
  const { events, profiles, household } = useApp();
  const persons = profiles.filter((p) => p.type === "PERSON");
  const [selected, setSelected] = useState<string[]>(persons.map((p) => p.id));
  const [duration, setDuration] = useState(60);
  const [days, setDays] = useState(7);
  const [eveningsOnly, setEveningsOnly] = useState(false);

  const slots = useMemo(() => {
    const from = now;
    const to = addDays(startOfDay(now), days);
    const occ = expandEvents(events, addDays(from, -1), addDays(to, 1));
    return findAvailability({
      occurrences: occ,
      profiles,
      profileIds: selected,
      from,
      to,
      durationMin: duration,
      dayStartHour: eveningsOnly ? 18 : Math.max(8, household?.settings.dayStartHour ?? 8),
      dayEndHour: Math.min(22, household?.settings.dayEndHour ?? 22),
      maxResults: 30,
    });
  }, [events, profiles, selected, duration, days, eveningsOnly, now, household]);

  const byDay = slots.reduce<Record<string, typeof slots>>((acc, s) => {
    const k = s.start.toDateString();
    (acc[k] ??= []).push(s);
    return acc;
  }, {});

  return (
    <Sheet open onClose={onClose} title="Trouver un créneau libre" wide>
      <div className="space-y-4 pb-3">
        <Field label="Qui doit être libre ?">
          <div className="flex flex-wrap gap-2">
            {persons.map((p) => (
              <Chip
                key={p.id}
                active={selected.includes(p.id)}
                color={p.color}
                onClick={() => setSelected((s) => (s.includes(p.id) ? s.filter((x) => x !== p.id) : [...s, p.id]))}
              >
                <Avatar profile={p} size={22} /> {p.name}
              </Chip>
            ))}
          </div>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Durée">
            <div className="flex flex-wrap gap-2">
              {DURATIONS.map((d) => (
                <Chip key={d} active={duration === d} onClick={() => setDuration(d)}>
                  {fmtDuration(d)}
                </Chip>
              ))}
            </div>
          </Field>
          <Field label="Période">
            <div className="flex flex-wrap gap-2">
              {RANGES.map(([d, l]) => (
                <Chip key={d} active={days === d} onClick={() => setDays(d)}>
                  {l}
                </Chip>
              ))}
              <Chip active={eveningsOnly} onClick={() => setEveningsOnly((v) => !v)}>
                🌙 Soirées
              </Chip>
            </div>
          </Field>
        </div>

        {!selected.length ? (
          <p className="text-muted">Choisissez au moins une personne.</p>
        ) : slots.length === 0 ? (
          <p className="rounded-2xl bg-surface-2 p-4 text-muted">Aucun créneau commun trouvé sur cette période.</p>
        ) : (
          <div className="space-y-4">
            {Object.entries(byDay).map(([k, list]) => (
              <div key={k}>
                <div className="mb-2 text-sm font-semibold text-muted">{capitalize(fmt(list[0].start, "EEEE d MMMM"))}</div>
                <div className="flex flex-wrap gap-2">
                  {list.map((s) => (
                    <button
                      key={s.start.toISOString()}
                      onClick={() =>
                        onCreate({
                          start: s.start.toISOString(),
                          end: new Date(s.start.getTime() + duration * 60000).toISOString(),
                          profileIds: selected.length === persons.length && profiles.find((p) => p.type === "COUPLE") && selected.length === 2
                            ? [profiles.find((p) => p.type === "COUPLE")!.id]
                            : selected,
                        })
                      }
                      className="group flex items-center gap-2 rounded-2xl border border-border bg-surface px-4 py-3 text-left transition hover:border-accent"
                    >
                      <span className="tabular font-semibold">
                        {fmtTime(s.start)} – {fmtTime(s.end)}
                      </span>
                      <span className="text-xs text-muted">{fmtDuration((s.end.getTime() - s.start.getTime()) / 60000)} libre</span>
                      <CalendarPlus size={16} className="text-muted group-hover:text-accent" />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Sheet>
  );
}
