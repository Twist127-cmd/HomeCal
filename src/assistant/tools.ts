import type { ToolDefinition } from "@/providers/llm";

const dateTime = { type: "string", description: "Date/heure locale ISO, ex. 2026-10-01T16:00 (date seule = journée)" };
const profilesParam = {
  type: "array",
  items: { type: "string" },
  description: "Noms des profils concernés (personnes, couple, maison). Vide = la personne qui parle.",
};

function tool(name: string, description: string, properties: Record<string, unknown>, required: string[] = []): ToolDefinition {
  return { type: "function", function: { name, description, parameters: { type: "object", properties, required } } };
}

/** The ONLY way the LLM can act on HomeCal. It never touches Firestore directly. */
export const TOOLS: ToolDefinition[] = [
  tool(
    "createEvent",
    "Créer un événement dans le calendrier familial.",
    {
      title: { type: "string", description: "Titre court, ex. Dentiste" },
      start: dateTime,
      end: { ...dateTime, description: "Fin (optionnel). Sinon utiliser durationMinutes." },
      durationMinutes: { type: "number", description: "Durée en minutes si pas de fin (défaut 60)" },
      allDay: { type: "boolean" },
      profiles: profilesParam,
      location: { type: "string", description: "Lieu favori ou adresse" },
      description: { type: "string" },
      type: { type: "string", enum: ["appointment", "sport", "work", "social", "family", "travel", "chore", "other"] },
      recurrence: {
        type: "object",
        description: "Répétition optionnelle",
        properties: {
          freq: { type: "string", enum: ["DAILY", "WEEKLY", "MONTHLY", "YEARLY"] },
          interval: { type: "number" },
          weekdays: { type: "array", items: { type: "string" }, description: "ex. [\"mardi\",\"jeudi\"]" },
          until: { type: "string", description: "Date de fin AAAA-MM-JJ" },
          count: { type: "number" },
        },
      },
      reminderMinutes: { type: "array", items: { type: "number" }, description: "Rappels en minutes avant le début" },
    },
    ["title", "start"],
  ),
  tool(
    "updateEvent",
    "Modifier un événement existant (titre, horaires, lieu, profils…). Utiliser l'id obtenu par getEvents ou searchEvents.",
    {
      eventId: { type: "string" },
      title: { type: "string" },
      start: dateTime,
      end: dateTime,
      allDay: { type: "boolean" },
      profiles: profilesParam,
      location: { type: "string" },
      description: { type: "string" },
    },
    ["eventId"],
  ),
  tool(
    "moveEvent",
    "Déplacer un événement à une nouvelle date/heure en gardant sa durée.",
    {
      eventId: { type: "string" },
      occurrenceStart: { type: "string", description: "Pour un événement récurrent : début de l'occurrence à déplacer" },
      newStart: dateTime,
    },
    ["eventId", "newStart"],
  ),
  tool(
    "deleteEvent",
    "Supprimer un événement. Pour un événement récurrent, seule l'occurrence indiquée est supprimée sauf si allOccurrences=true.",
    {
      eventId: { type: "string" },
      occurrenceStart: { type: "string" },
      allOccurrences: { type: "boolean" },
    },
    ["eventId"],
  ),
  tool(
    "getEvents",
    "Lister les événements entre deux dates (inclut les récurrences).",
    { from: dateTime, to: dateTime, profiles: profilesParam },
    ["from", "to"],
  ),
  tool(
    "searchEvents",
    "Rechercher des événements par mot-clé (titre, lieu, description).",
    { query: { type: "string" }, from: dateTime, to: dateTime },
    ["query"],
  ),
  tool(
    "findAvailability",
    "Trouver des créneaux libres communs à plusieurs profils.",
    {
      profiles: profilesParam,
      from: dateTime,
      to: dateTime,
      durationMinutes: { type: "number" },
      dayStartHour: { type: "number", description: "Heure de début de journée (défaut 8)" },
      dayEndHour: { type: "number", description: "Heure de fin de journée (défaut 22)" },
    },
    ["from", "to", "durationMinutes"],
  ),
  tool(
    "getWeather",
    "Météo prévue (température, pluie, vent) pour une date/heure et un lieu. Sans lieu = maison.",
    {
      date: dateTime,
      location: { type: "string", description: "Ville ou adresse citée par l'utilisateur (ex. Genève). Obligatoire si un lieu est mentionné." },
      eventId: { type: "string", description: "Météo au lieu et à l'heure d'un événement" },
    },
  ),
  tool(
    "calculateRoute",
    "Calculer un trajet (durée, distance) et l'heure de départ conseillée.",
    {
      to: { type: "string", description: "Lieu favori, adresse, ou id d'événement" },
      from: { type: "string", description: "Départ (défaut : maison)" },
      mode: { type: "string", enum: ["driving", "cycling", "walking"] },
      arriveBy: dateTime,
    },
    ["to"],
  ),
  tool("getFavoritePlaces", "Lister les lieux favoris du foyer.", {}),
  tool(
    "createReminder",
    "Créer un rappel (notification à une heure donnée).",
    { text: { type: "string" }, at: dateTime, profiles: profilesParam, eventId: { type: "string" } },
    ["text", "at"],
  ),
];

export const TOOL_NAMES = TOOLS.map((t) => t.function.name);
