import type { ToolResult } from "../executor";
import { failure, fromResult, sentence } from "./common";

/** Deterministic answers for timers. */
export function timerResponse(intent: string, r: ToolResult): string {
  if (!r.ok) return intent === "timer.create" ? failure("lancer le minuteur", r) : fromResult(r);
  if (intent === "timer.create") {
    const d = (r.data ?? {}) as { timer?: { label: string; duration: string } };
    if (d.timer) return d.timer.label && d.timer.label !== "Minuteur" ? `✓ Minuteur « ${d.timer.label} » lancé pour ${d.timer.duration}.` : `✓ Minuteur lancé pour ${d.timer.duration}.`;
  }
  return sentence(r.summary);
}
