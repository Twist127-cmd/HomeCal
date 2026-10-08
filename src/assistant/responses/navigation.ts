import type { ToolResult } from "../executor";
import { fromResult, sentence } from "./common";

export function navigationResponse(intent: string, r: ToolResult): string {
  if (!r.ok) return fromResult(r);
  if (intent === "navigation.open") return `🚗 ${sentence(r.summary)}`;
  return sentence(r.summary);
}
