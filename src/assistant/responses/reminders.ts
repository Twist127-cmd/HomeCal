import type { ToolResult } from "../executor";
import { failure, fromResult, sentence } from "./common";

export function reminderResponse(intent: string, r: ToolResult): string {
  if (!r.ok) return intent === "reminder.create" ? failure("créer le rappel", r) : fromResult(r);
  if (intent === "reminder.create") return `✓ ${sentence(r.summary)}`;
  return sentence(r.summary);
}
