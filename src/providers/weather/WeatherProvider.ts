export interface WeatherPoint {
  time: Date;
  temperature: number; // °C
  precipitationProbability: number; // %
  precipitation: number; // mm
  windSpeed: number; // km/h
  weatherCode: number; // WMO
  isDay: boolean;
}

export interface DailyWeather {
  date: Date;
  tMin: number;
  tMax: number;
  precipitationProbability: number;
  precipitation: number;
  windMax: number;
  weatherCode: number;
}

export interface Forecast {
  lat: number;
  lng: number;
  current?: WeatherPoint;
  hourly: WeatherPoint[];
  daily: DailyWeather[];
  fetchedAt: number;
}

export interface WeatherProvider {
  readonly id: string;
  getForecast(lat: number, lng: number): Promise<Forecast>;
  /** Hourly point closest to `at` (null if beyond the forecast horizon). */
  getAt(lat: number, lng: number, at: Date): Promise<WeatherPoint | null>;
}

/** WMO weather code → French label + emoji */
export function describeWeather(code: number, isDay = true): { label: string; emoji: string } {
  if (code === 0) return { label: "Ciel dégagé", emoji: isDay ? "☀️" : "🌙" };
  if (code === 1) return { label: "Peu nuageux", emoji: isDay ? "🌤️" : "🌙" };
  if (code === 2) return { label: "Partiellement nuageux", emoji: "⛅" };
  if (code === 3) return { label: "Couvert", emoji: "☁️" };
  if (code === 45 || code === 48) return { label: "Brouillard", emoji: "🌫️" };
  if (code >= 51 && code <= 57) return { label: "Bruine", emoji: "🌦️" };
  if (code >= 61 && code <= 65) return { label: code === 65 ? "Forte pluie" : "Pluie", emoji: "🌧️" };
  if (code === 66 || code === 67) return { label: "Pluie verglaçante", emoji: "🌧️" };
  if (code >= 71 && code <= 77) return { label: "Neige", emoji: "🌨️" };
  if (code >= 80 && code <= 82) return { label: "Averses", emoji: "🌦️" };
  if (code === 85 || code === 86) return { label: "Averses de neige", emoji: "🌨️" };
  if (code >= 95) return { label: "Orage", emoji: "⛈️" };
  return { label: "—", emoji: "🌡️" };
}

/** Short advice for an event: umbrella, wind, cold… */
export function weatherAdvice(p: WeatherPoint): string | null {
  if (p.precipitationProbability >= 60 || p.precipitation >= 1) return "Prendre un parapluie";
  if (p.windSpeed >= 45) return "Vent fort";
  if (p.temperature <= 0) return "Risque de gel";
  if (p.temperature >= 30) return "Forte chaleur";
  return null;
}
