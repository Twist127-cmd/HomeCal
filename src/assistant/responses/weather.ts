import { fmtRelativeDay, fmtTime } from "@/lib/dates";
import type { ToolResult } from "../executor";

interface WeatherData {
  location: string;
  conditions: string;
  temperature?: number;
  tMin?: number;
  tMax?: number;
  precipitationProbability: number;
  windKmh?: number;
}

const advice = (p: number) => (p >= 60 ? " Prenez un parapluie." : "");

/** "Demain à Genève : pluie, entre 9 et 16 degrés, 70 % de risque de pluie." */
export function weatherResponse(r: ToolResult, q: { at: Date; dateOnly: boolean; now: Date }): string {
  if (!r.ok) return `Je n'ai pas la météo : ${r.summary}.`;
  const d = r.data as WeatherData;
  const day = fmtRelativeDay(q.at, q.now);
  const rain = `${d.precipitationProbability} % de risque de pluie`;
  if (q.dateOnly) return `${day} à ${d.location} : ${d.conditions.toLowerCase()}, entre ${d.tMin} et ${d.tMax} degrés, ${rain}.${advice(d.precipitationProbability)}`;
  const sameDay = q.at.toDateString() === q.now.toDateString();
  const isNow = Math.abs(q.at.getTime() - q.now.getTime()) < 30 * 60000;
  const when = isNow ? "En ce moment" : sameDay ? `Aujourd'hui à ${fmtTime(q.at)}` : `${day} à ${fmtTime(q.at)}`;
  return `${when} à ${d.location} : ${d.conditions.toLowerCase()}, ${d.temperature} degrés, ${rain}, vent ${d.windKmh} km/h.${advice(d.precipitationProbability)}`;
}

/** "Pour CrossFit aujourd'hui à 18h30 : couvert, 14 degrés, 20 % de risque de pluie." */
export function weatherEventResponse(r: ToolResult, q: { title: string; start: Date; now: Date }): string {
  if (!r.ok) return `Je n'ai pas la météo pour ${q.title} : ${r.summary}.`;
  const d = r.data as WeatherData;
  const when = `${fmtRelativeDay(q.start, q.now).toLowerCase()} à ${fmtTime(q.start)}`;
  const temp = d.temperature !== undefined ? `${d.temperature} degrés` : `entre ${d.tMin} et ${d.tMax} degrés`;
  return `Pour ${q.title} ${when} : ${d.conditions.toLowerCase()}, ${temp}, ${d.precipitationProbability} % de risque de pluie.${advice(d.precipitationProbability)}`;
}
