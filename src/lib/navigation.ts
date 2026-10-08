import type { EventLocation, NavigationApp, TravelMode } from "./types";

/** Deep links to navigation apps. Coordinates are preferred over a free-text address. */
export function navigationUrl(dest: EventLocation, app: Exclude<NavigationApp, "ask">, mode: TravelMode = "driving"): string {
  const hasLL = typeof dest.lat === "number" && typeof dest.lng === "number";
  const ll = hasLL ? `${dest.lat},${dest.lng}` : "";
  const q = encodeURIComponent(dest.address ?? dest.label);
  switch (app) {
    case "waze":
      return hasLL ? `https://waze.com/ul?ll=${ll}&navigate=yes` : `https://waze.com/ul?q=${q}&navigate=yes`;
    case "google": {
      const gm = { driving: "driving", cycling: "bicycling", walking: "walking" }[mode];
      return `https://www.google.com/maps/dir/?api=1&destination=${hasLL ? ll : q}&travelmode=${gm}`;
    }
    case "apple": {
      const am = { driving: "d", cycling: "c", walking: "w" }[mode];
      return `https://maps.apple.com/?daddr=${hasLL ? ll : q}&dirflg=${am}`;
    }
  }
}

export const NAV_APPS: { id: Exclude<NavigationApp, "ask">; label: string }[] = [
  { id: "waze", label: "Waze" },
  { id: "google", label: "Google Maps" },
  { id: "apple", label: "Apple Plans" },
];

/** Apple Plans only makes sense on Apple devices. */
export function availableNavApps(userAgent: string) {
  const apple = /iphone|ipad|macintosh/i.test(userAgent);
  return NAV_APPS.filter((a) => a.id !== "apple" || apple);
}

export type DepartureLevel = "green" | "orange" | "red" | "late";

export interface DepartureStatus {
  level: DepartureLevel;
  /** minutes until departure (negative when late) */
  minutes: number;
  text: string;
  emoji: string;
}

/**
 * 🟢 Départ conseillé dans 24 min → 🟠 Pars dans 5 min → 🔴 Il est temps de partir
 * → ⚠️ Tu devrais déjà être parti depuis 7 min
 */
export function departureStatus(departAt: Date, now: Date): DepartureStatus {
  const minutes = Math.round((departAt.getTime() - now.getTime()) / 60000);
  if (minutes > 10) return { level: "green", minutes, emoji: "🟢", text: `Départ conseillé dans ${formatMin(minutes)}` };
  if (minutes > 1) return { level: "orange", minutes, emoji: "🟠", text: `Pars dans ${minutes} min` };
  if (minutes >= -1) return { level: "red", minutes, emoji: "🔴", text: "Il est temps de partir" };
  return { level: "late", minutes, emoji: "⚠️", text: `Tu devrais déjà être parti depuis ${formatMin(-minutes)}` };
}

function formatMin(m: number): string {
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return m % 60 ? `${h} h ${String(m % 60).padStart(2, "0")}` : `${h} h`;
}
