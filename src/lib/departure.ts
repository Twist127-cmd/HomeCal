import { hasCoords } from "./geo";
import type { CalendarEvent, EventLocation, FavoritePlace, Occurrence } from "./types";

/** départ conseillé = début − durée trajet − marge */
export function departureTime(eventStart: Date, travelMin: number, marginMin: number): Date {
  return new Date(eventStart.getTime() - (travelMin + marginMin) * 60000);
}

/**
 * Where does the person leave from? The previous same-day event location if it ends
 * less than `maxGapMin` before, else the event's origin place, else home.
 */
export function pickOrigin(
  target: Occurrence,
  dayOccurrences: Occurrence[],
  places: FavoritePlace[],
  homePlaceId?: string,
  maxGapMin = 180,
): EventLocation | null {
  const prev = dayOccurrences
    .filter(
      (o) =>
        o.key !== target.key &&
        !o.event.allDay &&
        o.end <= target.start &&
        target.start.getTime() - o.end.getTime() <= maxGapMin * 60000 &&
        hasCoords(o.event.location) &&
        o.event.profileIds.some((p) => target.event.profileIds.includes(p)),
    )
    .sort((a, b) => b.end.getTime() - a.end.getTime())[0];
  if (prev) return prev.event.location!;

  const placeId = target.event.travel?.originPlaceId ?? homePlaceId;
  const place = places.find((p) => p.id === placeId) ?? places.find((p) => /maison|home/i.test(p.name));
  return place ? { label: place.name, address: place.address, lat: place.lat, lng: place.lng, placeId: place.id } : null;
}

export function needsTravel(event: CalendarEvent, origin: EventLocation | null): boolean {
  if (event.allDay || !hasCoords(event.location) || !hasCoords(origin)) return false;
  return !(event.location.lat === origin.lat && event.location.lng === origin.lng);
}
