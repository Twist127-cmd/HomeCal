import type { ToolResult } from "../executor";
import { fromResult, sentence } from "./common";

export function musicResponse(intent: string, r: ToolResult): string {
  if (!r.ok) return fromResult(r);
  const d = (r.data ?? {}) as { volume?: number; device?: string; playing?: string };
  switch (intent) {
    case "music.pause":
      return "⏸ Musique en pause.";
    case "music.resume":
      return "▶ Lecture reprise.";
    case "music.next":
      return "⏭ Morceau suivant.";
    case "music.previous":
      return "⏮ Morceau précédent.";
    case "music.volume":
      return typeof d.volume === "number" ? `🔊 Volume à ${d.volume} %.` : sentence(r.summary);
    case "music.device":
      return d.device ? `✓ Musique sur ${d.device}.` : sentence(r.summary);
    case "music.playlist":
    case "music.play":
      return `▶ ${sentence(r.summary)}`;
    default:
      return sentence(r.summary);
  }
}
