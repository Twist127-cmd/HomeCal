import type { ToolResult } from "../executor";
import { fromResult, sentence } from "./common";

export function navigationResponse(intent: string, r: ToolResult): string {
  if (!r.ok) return fromResult(r);
  if (intent === "navigation.open") return `🚗 ${sentence(r.summary)}`;
  if (intent === "navigation.travelTime") {
    const d = (r.data ?? {}) as { event?: string; start?: string; departAt?: string | null; travelMinutes?: number | null };
    if (d.travelMinutes != null && d.event) {
      return `Il faut ${d.travelMinutes} min pour aller à ${d.event}${d.departAt ? ` (départ conseillé ${d.departAt})` : ""}.`;
    }
    if (d.event) return `Pas de trajet nécessaire pour ${d.event}.`;
  }
  return sentence(r.summary);
}
