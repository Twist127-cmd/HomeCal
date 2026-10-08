"use client";

import { AlertTriangle, Bell, Car, Clock, ExternalLink, MapPin, Pencil, Repeat, Trash2, Umbrella, Wind } from "lucide-react";
import { useApp } from "@/components/app/AppProvider";
import { RouteButton } from "@/components/navigation/Departure";
import { Avatar, Button, Sheet } from "@/components/ui/primitives";
import { toast } from "@/components/ui/toast";
import { useTravel } from "@/hooks/useTravel";
import { useEventWeather } from "@/hooks/useWeather";
import type { Conflict } from "@/lib/conflicts";
import { fmtDuration, fmtRange, fmtRelativeDay, fmtTime } from "@/lib/dates";
import { describeRecurrence } from "@/lib/recurrence";
import { EVENT_TYPES, type Occurrence } from "@/lib/types";
import { describeWeather, weatherAdvice } from "@/providers/weather/WeatherProvider";

const MODE_LABEL = { driving: "en voiture", cycling: "à vélo", walking: "à pied" } as const;

export function EventDetail({
  occ,
  dayOccurrences,
  conflicts,
  now,
  onClose,
  onEdit,
}: {
  occ: Occurrence;
  dayOccurrences: Occurrence[];
  conflicts: Conflict[];
  now: Date;
  onClose(): void;
  onEdit(): void;
}) {
  const { profiles, calendar } = useApp();
  const e = occ.event;
  const forecastable = occ.end > now && occ.start.getTime() - now.getTime() < 16 * 24 * 3600_000;
  const weather = useEventWeather(e.location, occ.start, forecastable && !e.allDay);
  const travel = useTravel(forecastable ? occ : null, dayOccurrences);
  const w = weather ? describeWeather(weather.weatherCode, weather.isDay) : null;
  const advice = weather ? weatherAdvice(weather) : null;
  const type = EVENT_TYPES.find((t) => t.id === e.type);
  const mine = conflicts.filter((c) => c.a.key === occ.key || c.b.key === occ.key);

  const remove = async () => {
    if (!calendar) return;
    const original = e;
    if (e.recurrence) {
      await calendar.replaceEvent({
        ...e,
        recurrence: { ...e.recurrence, exdates: [...(e.recurrence.exdates ?? []), occ.start.toISOString()] },
      });
      toast({ text: "Occurrence supprimée", action: { label: "Annuler", run: () => calendar.replaceEvent(original) } });
    } else {
      await calendar.deleteEvent(e.id);
      toast({ text: `« ${e.title} » supprimé`, action: { label: "Annuler", run: () => calendar.restoreEvent(original) } });
    }
    onClose();
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={
        <span className="flex items-center gap-2">
          {type && <span>{type.emoji}</span>}
          <span className="truncate">{e.title}</span>
        </span>
      }
      footer={
        <>
          <Button variant="danger" onClick={remove}>
            <Trash2 size={18} /> {e.recurrence ? "Supprimer celle-ci" : "Supprimer"}
          </Button>
          <div className="flex-1" />
          <Button variant="primary" onClick={onEdit}>
            <Pencil size={18} /> Modifier
          </Button>
        </>
      }
    >
      <div className="space-y-4 pb-2">
        <div className="flex items-start gap-3">
          <Clock size={20} className="mt-0.5 shrink-0 text-muted" />
          <div>
            <div className="font-medium">{fmtRelativeDay(occ.start, now)}</div>
            <div className="text-muted">
              {fmtRange(occ.start, occ.end, e.allDay)}
              {!e.allDay && ` · ${fmtDuration((occ.end.getTime() - occ.start.getTime()) / 60000)}`}
            </div>
            {e.recurrence && (
              <div className="mt-1 flex items-center gap-1.5 text-sm text-muted">
                <Repeat size={14} /> {describeRecurrence(e.recurrence)}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {e.profileIds.map((id) => {
            const p = profiles.find((x) => x.id === id);
            return p ? (
              <span key={id} className="inline-flex items-center gap-2 rounded-full bg-surface-2 py-1 pr-3 pl-1 text-sm font-medium">
                <Avatar profile={p} size={24} /> {p.name}
              </span>
            ) : null;
          })}
        </div>

        {mine.length > 0 && (
          <div className="space-y-1 rounded-2xl bg-warn/10 p-3 text-sm text-warn">
            {mine.map((c, i) => (
              <div key={i} className="flex gap-2">
                <AlertTriangle size={16} className="mt-0.5 shrink-0" /> {c.message}
              </div>
            ))}
          </div>
        )}

        {e.location && (
          <div className="flex items-start gap-3">
            <MapPin size={20} className="mt-0.5 shrink-0 text-muted" />
            <div className="min-w-0 flex-1">
              <div className="font-medium">{e.location.label}</div>
              {e.location.address && e.location.address !== e.location.label && <div className="text-sm text-muted">{e.location.address}</div>}
              {e.location.lat !== undefined && (
                <a
                  href={`https://www.openstreetmap.org/?mlat=${e.location.lat}&mlon=${e.location.lng}#map=16/${e.location.lat}/${e.location.lng}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-flex items-center gap-1 text-sm text-accent"
                >
                  Voir la carte <ExternalLink size={13} />
                </a>
              )}
            </div>
          </div>
        )}

        {(travel || w) && (
          <div className="grid gap-3 sm:grid-cols-2">
            {travel && (
              <div className="rounded-2xl bg-accent-soft p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-accent">
                  <Car size={16} /> Départ conseillé
                </div>
                <div className="tabular mt-1 text-3xl font-semibold">{fmtTime(travel.departAt)}</div>
                <div className="mt-1 text-sm text-muted">
                  {travel.route.durationMin} min {MODE_LABEL[travel.route.mode]} ({travel.route.distanceKm} km) depuis {travel.origin.label}
                  {" · "}marge {travel.marginMin} min
                  {travel.route.source === "estimate" && " · estimation"}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <RouteButton location={e.location!} mode={travel.route.mode} label={travel.departAt.getTime() - now.getTime() < 30 * 60000 ? "Pars maintenant" : "Itinéraire"} />
                </div>
              </div>
            )}
            {!travel && e.location?.lat !== undefined && forecastable && (
              <div className="rounded-2xl bg-surface-2 p-4">
                <RouteButton location={e.location} />
              </div>
            )}
            {w && weather && (
              <div className="rounded-2xl bg-surface-2 p-4">
                <div className="text-sm font-medium text-muted">Météo à {fmtTime(weather.time)}</div>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-3xl">{w.emoji}</span>
                  <span className="tabular text-3xl font-semibold">{Math.round(weather.temperature)}°</span>
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 text-sm text-muted">
                  <span>{w.label}</span>
                  <span className="inline-flex items-center gap-1">
                    <Umbrella size={13} /> {weather.precipitationProbability}%
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Wind size={13} /> {Math.round(weather.windSpeed)} km/h
                  </span>
                </div>
                {advice && <div className="mt-2 text-sm font-medium text-accent">{advice}</div>}
              </div>
            )}
          </div>
        )}

        {e.reminders.length > 0 && !e.allDay && (
          <div className="flex items-center gap-3 text-sm text-muted">
            <Bell size={18} />
            {e.reminders.map((m) => (m === 0 ? "à l'heure" : m >= 1440 ? `${m / 1440} j avant` : m >= 60 ? `${m / 60} h avant` : `${m} min avant`)).join(", ")}
          </div>
        )}

        {e.description && <p className="rounded-2xl bg-surface-2 p-4 whitespace-pre-wrap">{e.description}</p>}

        <p className="text-xs text-muted">
          {e.source === "assistant" ? "Ajouté par l'assistant" : e.source === "quickadd" ? "Ajout rapide" : e.source === "google" ? "Google Calendar" : "HomeCal"}
        </p>
      </div>
    </Sheet>
  );
}
