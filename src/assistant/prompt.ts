import { addDays, format } from "date-fns";
import { fr } from "date-fns/locale";
import type { FavoritePlace, Profile } from "@/lib/types";

const TYPE_LABEL: Record<Profile["type"], string> = {
  PERSON: "personne",
  COUPLE: "couple",
  GROUP: "groupe",
  HOUSEHOLD: "foyer",
};

/**
 * Compact system prompt for the LLM fallback (simple commands never reach the model).
 * Kept short on purpose: fewer tokens = faster answers on a small local model.
 */
export function buildSystemPrompt(opts: {
  now: Date;
  householdName: string;
  profiles: Profile[];
  places: FavoritePlace[];
  speaker?: Profile;
  timezone: string;
  /** name chosen by the family (wake word) */
  assistantName?: string;
}): string {
  const { now } = opts;
  const days = Array.from({ length: 8 }, (_, i) => {
    const d = addDays(now, i);
    return `${format(d, "EEE", { locale: fr })} ${format(d, "yyyy-MM-dd")}`;
  }).join(", ");
  const profiles = opts.profiles
    .map((p) => {
      const members = p.type === "COUPLE" || p.type === "GROUP" ? `=${p.memberIds.map((id) => opts.profiles.find((x) => x.id === id)?.name).filter(Boolean).join("+")}` : "";
      return `${p.name} (${TYPE_LABEL[p.type]}${members})`;
    })
    .join(", ");
  const places = opts.places.map((p) => p.name).join(", ") || "aucun";

  return `Tu es ${opts.assistantName?.trim() || "HomeCal"}, assistant du foyer « ${opts.householdName} ». Nous sommes le ${format(now, "EEEE d MMMM yyyy HH:mm", { locale: fr })} (${opts.timezone}).
Jours : ${days}.
Profils : ${profiles}.${opts.speaker ? ` « moi » = ${opts.speaker.name}.` : ""} « nous deux » = couple, « tout le monde » = foyer.
Lieux : ${places}.
Règles :
- Utilise les outils pour lire ou agir. N'invente ni événement, ni id, ni réussite.
- Dates locales AAAA-MM-JJTHH:MM. Pour modifier/supprimer, trouve d'abord l'id (searchEvents).
- Agis sans demander de confirmation. Sans heure pour un nouvel événement, demande « À quelle heure ? ».
- Si plusieurs choix sont possibles, pose une question courte.
- Réponds en français, 1 phrase courte, sans markdown ni emoji. Ne contredis jamais le résultat d'un outil.`;
}
