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
export const CALENDAR_TOOLS: ToolDefinition[] = [
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

const labelParam = { type: "string", description: "Nom du minuteur, ex. Pâtes" };
const itemsParam = { type: "array", items: { type: "string" }, description: "Articles, ex. [\"lait\", \"6 œufs\"]" };

export const TIMER_TOOLS: ToolDefinition[] = [
  tool("createTimer", "Lancer un minuteur.", { minutes: { type: "number" }, seconds: { type: "number" }, label: labelParam }, ["minutes"]),
  tool("listTimers", "Lister les minuteurs en cours et le temps restant.", {}),
  tool("cancelTimer", "Annuler un minuteur (ou tous avec all=true).", { label: labelParam, all: { type: "boolean" } }),
  tool("pauseTimer", "Mettre un minuteur en pause.", { label: labelParam }),
  tool("resumeTimer", "Reprendre un minuteur en pause.", { label: labelParam }),
  tool("addTimeToTimer", "Ajouter du temps à un minuteur.", { minutes: { type: "number" }, label: labelParam }, ["minutes"]),
];

export const SHOPPING_TOOLS: ToolDefinition[] = [
  tool("addShoppingItem", "Ajouter des articles à la liste de courses partagée du foyer.", { items: itemsParam }, ["items"]),
  tool("removeShoppingItem", "Retirer des articles de la liste de courses.", { items: itemsParam }, ["items"]),
  tool("completeShoppingItem", "Cocher des articles achetés.", { items: itemsParam }, ["items"]),
  tool("uncompleteShoppingItem", "Décocher des articles.", { items: itemsParam }, ["items"]),
  tool("getShoppingList", "Lire ce qu'il reste à acheter.", {}),
  tool("clearCompletedShoppingItems", "Supprimer les articles déjà cochés.", {}),
];

export const MUSIC_TOOLS: ToolDefinition[] = [
  tool("playMusic", "Lancer de la musique sur Spotify (recherche libre : artiste, titre, ambiance). Sans query = reprendre.", { query: { type: "string" } }),
  tool("playPlaylist", "Lancer une playlist de l'utilisateur par son nom.", { name: { type: "string" } }, ["name"]),
  tool("pauseMusic", "Mettre la musique en pause.", {}),
  tool("resumeMusic", "Reprendre la lecture.", {}),
  tool("nextTrack", "Morceau suivant.", {}),
  tool("previousTrack", "Morceau précédent.", {}),
  tool("setMusicVolume", "Régler le volume (0-100) ou le changer (delta).", { volume: { type: "number" }, delta: { type: "number" } }),
  tool("changeMusicDevice", "Envoyer la musique sur un autre appareil Spotify (enceinte, téléphone…).", { device: { type: "string" } }, ["device"]),
  tool("searchMusic", "Rechercher sur Spotify sans lancer.", { query: { type: "string" } }, ["query"]),
  tool("getCurrentTrack", "Savoir ce qui est en lecture.", {}),
];

export const SCENE_TOOLS: ToolDefinition[] = [
  tool("activateScene", "Activer une scène HomeCal (ex. Matin, Cuisine, Soir).", { name: { type: "string" } }, ["name"]),
  tool("exitScene", "Quitter la scène et revenir au calendrier.", {}),
];

export const NAVIGATION_TOOLS: ToolDefinition[] = [
  tool("getNextDeparture", "Heure de départ conseillée pour le prochain rendez-vous (ou celui nommé).", { query: { type: "string" } }),
  tool("openNavigation", "Ouvrir Waze / Google Maps / Apple Plans vers le prochain rendez-vous (ou celui nommé).", {
    query: { type: "string" },
    app: { type: "string", enum: ["waze", "google", "apple"] },
  }),
];

export const REMINDER_TOOLS: ToolDefinition[] = [
  tool("listReminders", "Lister les rappels à venir.", {}),
  tool("cancelReminder", "Annuler un rappel (par son texte, ou le dernier avec latest=true).", { text: { type: "string" }, latest: { type: "boolean" } }),
];

export const TOOLS: ToolDefinition[] = [...CALENDAR_TOOLS, ...TIMER_TOOLS, ...SHOPPING_TOOLS, ...MUSIC_TOOLS, ...SCENE_TOOLS, ...NAVIGATION_TOOLS, ...REMINDER_TOOLS];

const pick = (...names: string[]) => TOOLS.filter((t) => names.includes(t.function.name));

/**
 * Tools exposed to the LLM for a given domain (from the router's best guess).
 * Never send out-of-domain tools: shorter prompt = faster and more accurate.
 */
export function toolsForDomain(domain: string | undefined, input: string): ToolDefinition[] {
  const n = input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  switch (domain) {
    case "weather":
      return pick("getWeather", "searchEvents");
    case "music":
      return pick("searchMusic", "playMusic", "playPlaylist", "getCurrentTrack", "changeMusicDevice", "setMusicVolume");
    case "timers":
      return TIMER_TOOLS;
    case "shopping":
      return SHOPPING_TOOLS;
    case "scenes":
      return SCENE_TOOLS;
    case "navigation":
      return [...NAVIGATION_TOOLS, ...pick("calculateRoute", "searchEvents")];
    case "reminders":
      return [...pick("createReminder", "searchEvents"), ...REMINDER_TOOLS];
    case "calendar":
      if (/\b(libres?|disponibles?|dispo|creneau|moment)\b/.test(n)) return pick("getEvents", "findAvailability", "createEvent");
      if (/\b(supprime|efface|annule|enleve|retire)\b/.test(n)) return pick("searchEvents", "getEvents", "deleteEvent");
      if (/\b(decale|deplace|repousse|avance|reporte|modifie|change|renomme)\b/.test(n)) return pick("searchEvents", "getEvents", "moveEvent", "updateEvent");
      if (/\b(ajoute|cree|planifie|programme|note|reserve)\b/.test(n)) return pick("createEvent", "findAvailability", "getEvents");
      return pick("getEvents", "searchEvents", "findAvailability", "getWeather");
  }
  return selectTools(input);
}
export const TOOL_NAMES = TOOLS.map((t) => t.function.name);

/**
 * Only send the tool groups relevant to the request: the local model is small and
 * slow, a shorter prompt is faster and more accurate.
 */
export function selectTools(input: string): ToolDefinition[] {
  const n = input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  const tools = [...CALENDAR_TOOLS];
  if (/\b(minuteur|minuterie|chrono|timer|reveille|sonne dans)\b/.test(n)) tools.push(...TIMER_TOOLS);
  if (/\b(courses|commissions|liste|acheter|achete)\b/.test(n)) tools.push(...SHOPPING_TOOLS);
  if (/\b(musique|spotify|chanson|morceau|playlist|son|volume|ecouter|joue|enceinte|album|artiste)\b/.test(n)) tools.push(...MUSIC_TOOLS);
  if (/\b(mode|scene|ambiance)\b/.test(n)) tools.push(...SCENE_TOOLS);
  if (/\b(partir|depart|itineraire|waze|maps|trajet|route|gps|navigation)\b/.test(n)) tools.push(...NAVIGATION_TOOLS);
  return tools;
}
