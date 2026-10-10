import { Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudRain, CloudSnow, CloudSun, Moon, Sun } from "lucide-react";
export function WeatherIcon({ code, isDay = true, size = 32, className }: { code: number; isDay?: boolean; size?: number; className?: string }) {
  const Icon = code >= 95 ? CloudLightning : code >= 71 && code <= 77 || code === 85 || code === 86 ? CloudSnow : code >= 61 ? CloudRain : code >= 51 ? CloudDrizzle : code >= 45 ? CloudFog : code === 3 ? Cloud : code > 0 ? CloudSun : isDay ? Sun : Moon;
  return <Icon size={size} strokeWidth={1.5} className={className} aria-hidden="true" />;
}
