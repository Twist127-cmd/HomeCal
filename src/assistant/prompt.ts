import { addDays, format } from "date-fns";
import { fr } from "date-fns/locale";
import type { FavoritePlace, Profile } from "@/lib/types";

const TYPE_LABEL: Record<Profile["type"], string> = {
  PERSON: "personne",
  COUPLE: "couple",
  GROUP: "groupe",
  HOUSEHOLD: "tout le foyer",
};

export function buildSystemPrompt(opts: {
  now: Date;
  householdName: string;
  profiles: Profile[];
  places: FavoritePlace[];
  speaker?: Profile;
  timezone: string;
}): string {
  const { now } = opts;
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = addDays(now, i);
    const label = i === 0 ? " (aujourd'hui)" : i === 1 ? " (demain)" : "";
    return `${format(d, "EEEE", { locale: fr })} ${format(d, "yyyy-MM-dd")}${label}`;
  }).join("\n");

  const profiles = opts.profiles
    .map((p) => {
      const members =
        p.type === "COUPLE" || p.type === "GROUP"
          ? ` = ${p.memberIds.map((id) => opts.profiles.find((x) => x.id === id)?.name).filter(Boolean).join(" + ")}`
          : "";
      return `- ${p.name} (${TYPE_LABEL[p.type]}${members})`;
    })
    .join("\n");

  const places = opts.places.length ? opts.places.map((p) => `- ${p.name}`).join("\n") : "- (aucun)";

  return `Tu es HomeCal, l'assistant du calendrier familial du foyer « ${opts.householdName} ».
Nous sommes le ${format(now, "EEEE d MMMM yyyy", { locale: fr })}, il est ${format(now, "HH:mm")} (fuseau ${opts.timezone}).

Calendrier des 14 prochains jours :
${days}

Profils :
${profiles}
${opts.speaker ? `La personne qui parle est : ${opts.speaker.name}. « moi », « je » = ${opts.speaker.name}.` : ""}
« nous deux », « nous » = le profil couple. « tout le monde », « la famille » = le profil du foyer.

Lieux favoris :
${places}

Règles :
1. Pour lire ou modifier le calendrier, utilise TOUJOURS les outils. N'invente jamais d'événement ni d'id.
2. Dates au format local AAAA-MM-JJTHH:MM, sans fuseau. Utilise le calendrier ci-dessus pour convertir « jeudi », « demain », etc.
   Un jour de la semaine sans précision désigne sa prochaine occurrence.
3. Pour modifier, déplacer ou supprimer : cherche d'abord l'événement (searchEvents ou getEvents) pour obtenir son id.
4. Agis directement : ne demande PAS de confirmation (l'utilisateur peut annuler d'un geste). Le lieu, la durée et la description sont facultatifs : ne les demande pas et ne les invente pas.
   Appelle uniquement les outils nécessaires : pour ajouter un événement, un seul appel createEvent suffit.
   Pose une question courte uniquement si la date ou l'événement visé est vraiment impossible à déterminer.
5. Durée par défaut : 1 h. « 16h » = 16:00, « 18h30 » = 18:30. « après-midi » = 13:00–18:00, « soir » = 18:00–23:00, « matin » = 8:00–12:00.
6. Réponds en français, en 1 ou 2 phrases courtes et naturelles, adaptées à la lecture à voix haute. Pas de markdown, pas de liste, pas d'emoji.
7. Après une action, confirme ce qui a été fait (quoi, quand, pour qui). Mentionne un éventuel conflit ou la pluie si pertinent.`;
}
