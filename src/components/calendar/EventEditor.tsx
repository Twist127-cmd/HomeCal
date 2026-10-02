"use client";

import clsx from "clsx";
import { addDays, addMinutes } from "date-fns";
import { Bike, Car, Footprints, MapPin, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useApp } from "@/components/app/AppProvider";
import { PlaceSearch } from "@/components/places/PlaceSearch";
import { Avatar, Button, Chip, Field, inputClass, Sheet, Spinner, Toggle } from "@/components/ui/primitives";
import { toast } from "@/components/ui/toast";
import { atTime, fromDateInput, toDateInput, toTimeInput } from "@/lib/dates";
import { describeRecurrence } from "@/lib/recurrence";
import {
  EVENT_TYPES,
  type CalendarEvent,
  type EventLocation,
  type EventType,
  type Frequency,
  type NewEvent,
  type Occurrence,
  type Recurrence,
  type TravelMode,
} from "@/lib/types";

export interface EditorRequest {
  /** existing occurrence to edit */
  occurrence?: Occurrence;
  /** prefilled values for a new event */
  draft?: Partial<NewEvent>;
}

const WEEKDAY_SHORT = [
  [1, "L"],
  [2, "M"],
  [3, "M"],
  [4, "J"],
  [5, "V"],
  [6, "S"],
  [0, "D"],
] as const;

const REMINDER_CHOICES = [
  [0, "À l'heure"],
  [10, "10 min"],
  [30, "30 min"],
  [60, "1 h"],
  [120, "2 h"],
  [1440, "1 jour"],
] as const;

export function EventEditor({ request, onClose }: { request: EditorRequest; onClose(): void }) {
  const { calendar, profiles, places, myProfileId, user } = useApp();
  const occ = request.occurrence;
  const base: Partial<NewEvent> = occ ? occ.event : request.draft ?? {};
  const isRecurringEdit = !!occ?.event.recurrence;

  const initialStart = occ ? occ.start : base.start ? new Date(base.start) : roundUp(new Date());
  const initialEnd = occ ? occ.end : base.end ? new Date(base.end) : addMinutes(initialStart, 60);

  const [title, setTitle] = useState(base.title ?? "");
  const [description, setDescription] = useState(base.description ?? "");
  const [allDay, setAllDay] = useState(base.allDay ?? false);
  const [day, setDay] = useState(toDateInput(initialStart));
  const [endDay, setEndDay] = useState(toDateInput(base.allDay ? addDays(initialEnd, -1) : initialEnd));
  const [startTime, setStartTime] = useState(toTimeInput(initialStart));
  const [endTime, setEndTime] = useState(toTimeInput(initialEnd));
  const [profileIds, setProfileIds] = useState<string[]>(base.profileIds?.length ? base.profileIds : myProfileId ? [myProfileId] : []);
  const [type, setType] = useState<EventType>(base.type ?? "other");
  const [location, setLocation] = useState<EventLocation | undefined>(base.location);
  const [searchingPlace, setSearchingPlace] = useState(false);
  const [recurrence, setRecurrence] = useState<Recurrence | undefined>(base.recurrence);
  const [reminders, setReminders] = useState<number[]>(base.reminders ?? [30]);
  const [travelMode, setTravelMode] = useState<TravelMode | undefined>(base.travel?.mode);
  const [scope, setScope] = useState<"one" | "all">("all");
  const [busy, setBusy] = useState(false);

  const start = useMemo(() => (allDay ? fromDateInput(day) : atTime(fromDateInput(day), startTime)), [allDay, day, startTime]);
  const end = useMemo(() => {
    if (allDay) return addDays(fromDateInput(endDay < day ? day : endDay), 1);
    let e = atTime(fromDateInput(endDay < day ? day : endDay), endTime);
    if (e <= start) e = atTime(fromDateInput(day), endTime);
    if (e <= start) e = addMinutes(start, 60);
    return e;
  }, [allDay, day, endDay, endTime, start]);

  const toggleProfile = (id: string) =>
    setProfileIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  const build = (): NewEvent => ({
    title: title.trim() || "Sans titre",
    description: description.trim() || undefined,
    start: start.toISOString(),
    end: end.toISOString(),
    allDay,
    profileIds,
    type,
    location,
    recurrence,
    reminders,
    travel: travelMode ? { ...(base.travel ?? {}), mode: travelMode } : undefined,
    source: base.source ?? "local",
    createdBy: base.createdBy ?? user?.uid,
  });

  const save = async () => {
    if (!calendar) return;
    setBusy(true);
    try {
      const next = build();
      if (!occ) {
        await calendar.createEvent(next);
        toast({ text: `« ${next.title} » ajouté`, tone: "success" });
      } else if (isRecurringEdit && scope === "one") {
        // detach this occurrence from the series
        const series = occ.event;
        await calendar.replaceEvent({
          ...series,
          recurrence: { ...series.recurrence!, exdates: [...(series.recurrence!.exdates ?? []), occ.start.toISOString()] },
        });
        await calendar.createEvent({ ...next, recurrence: undefined });
        toast({ text: "Occurrence modifiée", tone: "success" });
      } else {
        const original: CalendarEvent = occ.event;
        // keep the series anchor date when editing a recurring series from a later occurrence
        let s = next.start;
        let e = next.end;
        if (isRecurringEdit) {
          const shift = start.getTime() - occ.start.getTime();
          const dur = end.getTime() - start.getTime();
          const anchor = new Date(new Date(original.start).getTime() + shift);
          s = anchor.toISOString();
          e = new Date(anchor.getTime() + dur).toISOString();
        }
        await calendar.replaceEvent({ ...original, ...next, start: s, end: e, id: original.id, createdAt: original.createdAt, updatedAt: original.updatedAt });
        toast({
          text: `« ${next.title} » modifié`,
          tone: "success",
          action: { label: "Annuler", run: () => calendar.replaceEvent(original) },
        });
      }
      onClose();
    } catch (e) {
      toast({ text: (e as Error).message, tone: "error" });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!calendar || !occ) return;
    setBusy(true);
    const original = occ.event;
    try {
      if (isRecurringEdit && scope === "one") {
        await calendar.replaceEvent({
          ...original,
          recurrence: { ...original.recurrence!, exdates: [...(original.recurrence!.exdates ?? []), occ.start.toISOString()] },
        });
      } else {
        await calendar.deleteEvent(original.id);
      }
      toast({ text: `« ${original.title} » supprimé`, action: { label: "Annuler", run: () => calendar.restoreEvent(original) } });
      onClose();
    } catch (e) {
      toast({ text: (e as Error).message, tone: "error" });
    } finally {
      setBusy(false);
    }
  };

  const setFreq = (f: Frequency | "") => {
    if (!f) return setRecurrence(undefined);
    setRecurrence((r) => ({
      freq: f,
      interval: r?.interval ?? 1,
      byWeekday: f === "WEEKLY" ? (r?.byWeekday?.length ? r.byWeekday : [start.getDay()]) : undefined,
      until: r?.until,
      count: r?.count,
      exdates: r?.exdates,
    }));
  };

  return (
    <Sheet
      open
      onClose={onClose}
      wide
      title={occ ? "Modifier l'événement" : "Nouvel événement"}
      footer={
        <>
          {occ && (
            <Button variant="danger" onClick={remove} disabled={busy}>
              <Trash2 size={18} /> Supprimer
            </Button>
          )}
          {isRecurringEdit && (
            <div className="flex rounded-full bg-surface-2 p-1 text-sm">
              {(
                [
                  ["one", "Cette occurrence"],
                  ["all", "Toute la série"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setScope(id)}
                  className={clsx("h-9 rounded-full px-3 font-medium", scope === id ? "bg-surface shadow-sm" : "text-muted")}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          <div className="flex-1" />
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="primary" onClick={save} disabled={busy || !profileIds.length}>
            {busy && <Spinner />} Enregistrer
          </Button>
        </>
      }
    >
      <div className="space-y-5 pb-2">
        <input
          className="h-14 w-full border-b border-border bg-transparent text-2xl font-semibold outline-none placeholder:text-muted/60 focus:border-accent"
          placeholder="Titre"
          value={title}
          autoFocus={!occ}
          onChange={(e) => setTitle(e.target.value)}
        />

        {/* when */}
        <div className="space-y-3 rounded-2xl bg-surface-2 p-4">
          <Toggle checked={allDay} onChange={setAllDay} label="Toute la journée" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="Date">
              <input
                type="date"
                className={inputClass}
                value={day}
                onChange={(e) => {
                  const d = e.target.value;
                  // keep duration in days
                  const diff = fromDateInput(endDay).getTime() - fromDateInput(day).getTime();
                  setDay(d);
                  setEndDay(toDateInput(new Date(fromDateInput(d).getTime() + Math.max(0, diff))));
                }}
              />
            </Field>
            {!allDay && (
              <Field label="Début">
                <input
                  type="time"
                  className={inputClass}
                  value={startTime}
                  onChange={(e) => {
                    const dur = end.getTime() - start.getTime();
                    setStartTime(e.target.value);
                    const ns = atTime(fromDateInput(day), e.target.value);
                    const ne = new Date(ns.getTime() + dur);
                    setEndTime(toTimeInput(ne));
                    setEndDay(toDateInput(ne));
                  }}
                />
              </Field>
            )}
            {!allDay && (
              <Field label="Fin">
                <input type="time" className={inputClass} value={endTime} onChange={(e) => setEndTime(e.target.value)} />
              </Field>
            )}
            <Field label={allDay ? "Jusqu'au" : "Date de fin"}>
              <input type="date" className={inputClass} value={endDay} min={day} onChange={(e) => setEndDay(e.target.value)} />
            </Field>
          </div>

          {/* recurrence */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              className={`${inputClass} w-auto`}
              value={recurrence?.freq ?? ""}
              onChange={(e) => setFreq(e.target.value as Frequency | "")}
            >
              <option value="">Ne se répète pas</option>
              <option value="DAILY">Tous les jours</option>
              <option value="WEEKLY">Chaque semaine</option>
              <option value="MONTHLY">Chaque mois</option>
              <option value="YEARLY">Chaque année</option>
            </select>
            {recurrence && (
              <>
                <label className="flex items-center gap-2 text-sm text-muted">
                  tous les
                  <input
                    type="number"
                    min={1}
                    max={12}
                    className={`${inputClass} w-16 px-2 text-center`}
                    value={recurrence.interval}
                    onChange={(e) => setRecurrence({ ...recurrence, interval: Math.max(1, +e.target.value || 1) })}
                  />
                </label>
                <label className="flex items-center gap-2 text-sm text-muted">
                  jusqu&apos;au
                  <input
                    type="date"
                    className={`${inputClass} w-auto`}
                    value={recurrence.until ? toDateInput(new Date(recurrence.until)) : ""}
                    onChange={(e) => {
                      if (!e.target.value) return setRecurrence({ ...recurrence, until: undefined });
                      const u = fromDateInput(e.target.value);
                      u.setHours(23, 59, 59);
                      setRecurrence({ ...recurrence, until: u.toISOString() });
                    }}
                  />
                </label>
              </>
            )}
          </div>
          {recurrence?.freq === "WEEKLY" && (
            <div className="flex gap-1.5">
              {WEEKDAY_SHORT.map(([d, l]) => {
                const on = recurrence.byWeekday?.includes(d);
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => {
                      const cur = recurrence.byWeekday ?? [];
                      const next = on ? cur.filter((x) => x !== d) : [...cur, d];
                      setRecurrence({ ...recurrence, byWeekday: next.length ? next : [d] });
                    }}
                    className={clsx(
                      "h-10 w-10 rounded-full text-sm font-semibold transition",
                      on ? "bg-accent text-white dark:text-black" : "bg-surface border border-border",
                    )}
                  >
                    {l}
                  </button>
                );
              })}
            </div>
          )}
          {recurrence && <p className="text-sm text-muted">{describeRecurrence(recurrence)}</p>}
        </div>

        {/* who */}
        <Field label="Pour qui ?">
          <div className="flex flex-wrap gap-2">
            {profiles.map((p) => (
              <Chip key={p.id} active={profileIds.includes(p.id)} color={p.color} onClick={() => toggleProfile(p.id)}>
                <Avatar profile={p} size={22} />
                {p.name}
              </Chip>
            ))}
          </div>
        </Field>

        {/* type */}
        <Field label="Type">
          <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
            {EVENT_TYPES.map((t) => (
              <Chip key={t.id} active={type === t.id} onClick={() => setType(t.id)}>
                {t.emoji} {t.label}
              </Chip>
            ))}
          </div>
        </Field>

        {/* where */}
        <Field label="Lieu">
          {location && !searchingPlace ? (
            <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface-2 px-4 py-3">
              <MapPin size={18} className="text-muted" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{location.label}</div>
                {location.address && location.address !== location.label && <div className="truncate text-xs text-muted">{location.address}</div>}
                {location.lat === undefined && <div className="text-xs text-warn">Sans coordonnées : pas de météo locale ni de trajet</div>}
              </div>
              <Button variant="ghost" size="icon" onClick={() => setLocation(undefined)} aria-label="Retirer le lieu">
                <X size={18} />
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {places.length > 0 && (
                <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
                  {places.map((p) => (
                    <Chip
                      key={p.id}
                      onClick={() => {
                        setLocation({ label: p.name, address: p.address, lat: p.lat, lng: p.lng, placeId: p.id });
                        setSearchingPlace(false);
                      }}
                    >
                      {p.icon} {p.name}
                    </Chip>
                  ))}
                </div>
              )}
              <PlaceSearch
                placeholder="Autre adresse…"
                onPick={(r) => {
                  setLocation({ label: r.label, address: r.address, lat: r.lat, lng: r.lng });
                  setSearchingPlace(false);
                }}
              />
            </div>
          )}
        </Field>

        {location?.lat !== undefined && !allDay && (
          <Field label="Trajet">
            <div className="flex flex-wrap gap-2">
              {(
                [
                  [undefined, "Par défaut", null],
                  ["driving", "Voiture", Car],
                  ["cycling", "Vélo", Bike],
                  ["walking", "À pied", Footprints],
                ] as const
              ).map(([m, label, Icon]) => (
                <Chip key={label} active={travelMode === m} onClick={() => setTravelMode(m)}>
                  {Icon && <Icon size={16} />} {label}
                </Chip>
              ))}
            </div>
          </Field>
        )}

        {!allDay && (
          <Field label="Rappels">
            <div className="flex flex-wrap gap-2">
              {REMINDER_CHOICES.map(([m, label]) => (
                <Chip
                  key={m}
                  active={reminders.includes(m)}
                  onClick={() => setReminders((r) => (r.includes(m) ? r.filter((x) => x !== m) : [...r, m].sort((a, b) => a - b)))}
                >
                  {label}
                </Chip>
              ))}
            </div>
          </Field>
        )}

        <Field label="Notes">
          <textarea
            className={`${inputClass} h-24 resize-none py-3`}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Détails, liste, code d'accès…"
          />
        </Field>
      </div>
    </Sheet>
  );
}

function roundUp(d: Date): Date {
  const x = new Date(d);
  x.setMinutes(Math.ceil(x.getMinutes() / 30) * 30, 0, 0);
  return x;
}
