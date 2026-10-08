import type { ToolResult } from "../executor";
import { failure, fromResult, sentence } from "./common";

interface TimerInfo {
  label: string;
  remaining: string;
  paused?: boolean;
}

/** Deterministic answers for timers (built from the ToolResult, never from the LLM). */
export function timerResponse(intent: string, r: ToolResult, q: { label?: string } = {}): string {
  if (!r.ok) return intent === "timer.create" ? failure("lancer le minuteur", r) : fromResult(r);
  const d = (r.data ?? {}) as { timer?: { label: string; duration: string } | string; timers?: TimerInfo[] };
  switch (intent) {
    case "timer.create": {
      const t = d.timer as { label: string; duration: string } | undefined;
      if (t) return t.label && t.label !== "Minuteur" ? `✓ Minuteur « ${t.label} » lancé pour ${t.duration}.` : `✓ Minuteur lancé pour ${t.duration}.`;
      break;
    }
    case "timer.remaining":
    case "timer.list": {
      const list = d.timers ?? [];
      if (!list.length) return "Aucun minuteur en cours.";
      const wanted = q.label ? list.filter((t) => t.label.toLowerCase().includes(q.label!.toLowerCase())) : list;
      const shown = wanted.length ? wanted : list;
      if (shown.length === 1) {
        const t = shown[0];
        const name = t.label && t.label !== "Minuteur" ? `« ${t.label} »` : "";
        return `Il reste ${t.remaining}${name ? ` pour ${name}` : ""}${t.paused ? " (en pause)" : ""}.`;
      }
      return `${shown.map((t) => `${t.label} : ${t.remaining}${t.paused ? " (en pause)" : ""}`).join(", ")}.`;
    }
    case "timer.cancel":
    case "timer.pause":
    case "timer.resume":
    case "timer.extend":
      return `✓ ${sentence(r.summary)}`;
  }
  return sentence(r.summary);
}
