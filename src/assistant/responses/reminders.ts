import { fmtRelativeDay, fmtTime } from "@/lib/dates";
import type { ToolResult } from "../executor";
import { failure, fromResult, sentence } from "./common";

/** Deterministic answers for reminders. */
export function reminderResponse(intent: string, r: ToolResult, q?: { text: string; at: Date; now: Date }): string {
  if (!r.ok) return intent === "reminder.create" ? failure("créer le rappel", r) : fromResult(r);
  if (intent === "reminder.create") {
    if (!q) return `✓ ${sentence(r.summary)}`;
    const sameDay = q.at.toDateString() === q.now.toDateString();
    const day = sameDay ? "" : ` ${fmtRelativeDay(q.at, q.now).toLowerCase()}`;
    return `✓ Rappel « ${q.text} »${day} à ${fmtTime(q.at)}.`;
  }
  if (intent === "reminder.cancel") return `✓ ${sentence(r.summary)}`;
  return sentence(r.summary);
}
