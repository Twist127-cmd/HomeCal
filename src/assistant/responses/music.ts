import type { ToolResult } from "../executor";
import { fromResult, sentence } from "./common";

export function musicResponse(intent: string, r: ToolResult): string {
  if (!r.ok) return fromResult(r);
  switch (intent) {
    case "music.pause":
      return "⏸ Musique en pause.";
    case "music.resume":
      return "▶ Lecture reprise.";
    case "music.next":
      return "⏭ Morceau suivant.";
    case "music.previous":
      return "⏮ Morceau précédent.";
    default:
      return sentence(r.summary);
  }
}
