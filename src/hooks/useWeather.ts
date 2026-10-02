"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/components/app/AppProvider";
import { hasCoords } from "@/lib/geo";
import type { EventLocation } from "@/lib/types";
import type { Forecast, WeatherPoint } from "@/providers/weather/WeatherProvider";

/** Forecast at home (or a given point). Refreshes every 30 minutes. */
export function useForecast(point?: { lat: number; lng: number } | null): Forecast | null {
  const { weather, homePlace } = useApp();
  const p = point ?? (homePlace ? { lat: homePlace.lat, lng: homePlace.lng } : null);
  const [forecast, setForecast] = useState<Forecast | null>(null);
  const lat = p?.lat;
  const lng = p?.lng;

  useEffect(() => {
    if (lat === undefined || lng === undefined) return;
    let cancelled = false;
    const load = () =>
      weather
        .getForecast(lat, lng)
        .then((f) => !cancelled && setForecast(f))
        .catch(() => {});
    load();
    const id = setInterval(load, 30 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [lat, lng, weather]);

  return forecast;
}

/** Weather at an event's location & time (home location when the event has none). */
export function useEventWeather(location: EventLocation | undefined, at: Date, enabled = true): WeatherPoint | null {
  const { weather, homePlace } = useApp();
  const target = hasCoords(location) ? location : homePlace;
  const [point, setPoint] = useState<WeatherPoint | null>(null);
  const lat = target?.lat;
  const lng = target?.lng;
  const t = at.getTime();

  useEffect(() => {
    if (!enabled || lat === undefined || lng === undefined) return;
    let cancelled = false;
    weather
      .getAt(lat, lng, new Date(t))
      .then((p) => !cancelled && setPoint(p))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [lat, lng, t, enabled, weather]);

  return enabled ? point : null;
}
