import type { DailyWeather, Forecast, WeatherPoint, WeatherProvider } from "./WeatherProvider";

/** Open-Meteo — free, no API key, CORS enabled. https://open-meteo.com */
const TTL_MS = 30 * 60 * 1000;

interface OMResponse {
  current?: {
    time: string;
    temperature_2m: number;
    precipitation: number;
    weather_code: number;
    wind_speed_10m: number;
    is_day: number;
  };
  hourly: {
    time: string[];
    temperature_2m: number[];
    precipitation_probability: number[];
    precipitation: number[];
    weather_code: number[];
    wind_speed_10m: number[];
    is_day: number[];
  };
  daily: {
    time: string[];
    temperature_2m_min: number[];
    temperature_2m_max: number[];
    precipitation_probability_max: number[];
    precipitation_sum: number[];
    wind_speed_10m_max: number[];
    weather_code: number[];
  };
}

export class OpenMeteoProvider implements WeatherProvider {
  readonly id = "open-meteo";
  private cache = new Map<string, Forecast>();
  private inflight = new Map<string, Promise<Forecast>>();

  private key(lat: number, lng: number) {
    // ~1 km grid: avoids refetching for nearby places
    return `${lat.toFixed(2)},${lng.toFixed(2)}`;
  }

  async getForecast(lat: number, lng: number): Promise<Forecast> {
    const k = this.key(lat, lng);
    const cached = this.cache.get(k) ?? readStorage(k);
    if (cached && Date.now() - cached.fetchedAt < TTL_MS) {
      this.cache.set(k, cached);
      return cached;
    }
    if (this.inflight.has(k)) return this.inflight.get(k)!;

    const p = this.fetchForecast(lat, lng)
      .then((f) => {
        this.cache.set(k, f);
        writeStorage(k, f);
        return f;
      })
      .catch((e) => {
        if (cached) return cached; // offline: serve stale data
        throw e;
      })
      .finally(() => this.inflight.delete(k));
    this.inflight.set(k, p);
    return p;
  }

  private async fetchForecast(lat: number, lng: number): Promise<Forecast> {
    const params = new URLSearchParams({
      latitude: lat.toFixed(4),
      longitude: lng.toFixed(4),
      current: "temperature_2m,precipitation,weather_code,wind_speed_10m,is_day",
      hourly: "temperature_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m,is_day",
      daily: "temperature_2m_min,temperature_2m_max,precipitation_probability_max,precipitation_sum,wind_speed_10m_max,weather_code",
      timezone: "auto",
      forecast_days: "16",
      wind_speed_unit: "kmh",
    });
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
    if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status}`);
    return parse(lat, lng, (await res.json()) as OMResponse);
  }

  async getAt(lat: number, lng: number, at: Date): Promise<WeatherPoint | null> {
    const f = await this.getForecast(lat, lng);
    return closestPoint(f.hourly, at);
  }
}

export function closestPoint(points: WeatherPoint[], at: Date): WeatherPoint | null {
  if (!points.length) return null;
  const t = at.getTime();
  if (t < points[0].time.getTime() - 3600_000 || t > points[points.length - 1].time.getTime() + 3600_000) return null;
  let best = points[0];
  for (const p of points) if (Math.abs(p.time.getTime() - t) < Math.abs(best.time.getTime() - t)) best = p;
  return best;
}

/** Open-Meteo returns local wall-clock times ("2026-10-01T16:00") when timezone=auto. */
function localTime(s: string): Date {
  return new Date(s.length === 10 ? `${s}T00:00:00` : `${s}:00`);
}

export function parse(lat: number, lng: number, r: OMResponse): Forecast {
  const hourly: WeatherPoint[] = r.hourly.time.map((t, i) => ({
    time: localTime(t),
    temperature: r.hourly.temperature_2m[i],
    precipitationProbability: r.hourly.precipitation_probability[i] ?? 0,
    precipitation: r.hourly.precipitation[i] ?? 0,
    windSpeed: r.hourly.wind_speed_10m[i] ?? 0,
    weatherCode: r.hourly.weather_code[i] ?? 0,
    isDay: r.hourly.is_day[i] === 1,
  }));
  const daily: DailyWeather[] = r.daily.time.map((t, i) => ({
    date: localTime(t),
    tMin: r.daily.temperature_2m_min[i],
    tMax: r.daily.temperature_2m_max[i],
    precipitationProbability: r.daily.precipitation_probability_max[i] ?? 0,
    precipitation: r.daily.precipitation_sum[i] ?? 0,
    windMax: r.daily.wind_speed_10m_max[i] ?? 0,
    weatherCode: r.daily.weather_code[i] ?? 0,
  }));
  const c = r.current;
  return {
    lat,
    lng,
    current: c
      ? {
          time: localTime(c.time),
          temperature: c.temperature_2m,
          precipitation: c.precipitation,
          precipitationProbability: 0,
          windSpeed: c.wind_speed_10m,
          weatherCode: c.weather_code,
          isDay: c.is_day === 1,
        }
      : undefined,
    hourly,
    daily,
    fetchedAt: Date.now(),
  };
}

// ---------- localStorage persistence (offline / reload) ----------

function readStorage(k: string): Forecast | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(`homecal.weather.${k}`);
    if (!raw) return null;
    const f = JSON.parse(raw) as Forecast;
    const revive = <T extends { time?: unknown; date?: unknown }>(o: T): T => ({
      ...o,
      ...(o.time ? { time: new Date(o.time as string) } : {}),
      ...(o.date ? { date: new Date(o.date as string) } : {}),
    });
    return { ...f, current: f.current ? revive(f.current) : undefined, hourly: f.hourly.map(revive), daily: f.daily.map(revive) };
  } catch {
    return null;
  }
}

function writeStorage(k: string, f: Forecast) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(`homecal.weather.${k}`, JSON.stringify(f));
  } catch {
    /* quota / private mode */
  }
}
