import { addDays, addWeeks, format, startOfWeek } from "date-fns";
import { fr } from "date-fns/locale";
import { normalize } from "@/lib/profiles";
import { parseQuickAdd, type QuickAddOptions } from "@/lib/quickadd";

/**
 * Deterministic pre-resolution of French date/time expressions.
 * Small local models are unreliable at mapping "vendredi" to a date; we resolve
 * the expressions in code and give the model explicit hints.
 */

const WEEKDAYS: Record<string, number> = { dimanche: 0, lundi: 1, mardi: 2, mercredi: 3, jeudi: 4, vendredi: 5, samedi: 6 };
const PARTS: Record<string, string> = { matin: "08:00–12:00", midi: "12:00–14:00", "apres-midi": "13:00–18:00", soir: "18:00–23:00" };
const MONTHS = ["janvier", "fevrier", "mars", "avril", "mai", "juin", "juillet", "aout", "septembre", "octobre", "novembre", "decembre"];

const day = (d: Date) => `${format(d, "EEEE", { locale: fr })} ${format(d, "yyyy-MM-dd")}`;

export function dateHints(input: string, now: Date): string[] {
  const n = normalize(input).replace(/[’']/g, "'");
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const hints: string[] = [];
  const push = (expr: string, value: string) => {
    const h = `« ${expr} » = ${value}`;
    if (!hints.includes(h)) hints.push(h);
  };

  const part = (s?: string) => (s ? ` (${PARTS[s.replace(/\s+/g, "-")] ?? ""})` : "");

  for (const m of n.matchAll(/\b(aujourd'hui|ce soir|ce matin|cet apres-midi|ce midi)\b/g)) {
    const p = m[1].split(" ").pop()!.replace("apres-midi", "apres-midi");
    push(m[1], day(today) + (m[1] === "aujourd'hui" ? "" : part(p)));
  }
  for (const m of n.matchAll(/\b(apres[- ]demain)\b/g)) push(m[1], day(addDays(today, 2)));
  for (const m of n.matchAll(/(?<!apres[- ])\bdemain(?:\s+(matin|midi|apres-midi|soir))?\b/g)) push(m[0], day(addDays(today, 1)) + part(m[1]));

  for (const m of n.matchAll(/\b(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)(\s+prochain)?(?:\s+(matin|midi|apres-midi|soir))?\b/g)) {
    const wd = WEEKDAYS[m[1]];
    let diff = (wd - now.getDay() + 7) % 7;
    if (diff === 0 && m[2]) diff = 7;
    push(m[0].trim(), day(addDays(today, diff)) + part(m[3]) + (diff === 0 ? " (aujourd'hui)" : ""));
  }

  for (const m of n.matchAll(/\b(?:la\s+)?semaine prochaine\b/g)) {
    const mon = addWeeks(startOfWeek(today, { weekStartsOn: 1 }), 1);
    push(m[0], `du ${day(mon)} au ${day(addDays(mon, 6))}`);
  }
  for (const m of n.matchAll(/\bcette semaine\b/g)) {
    push(m[0], `du ${day(today)} au ${day(addDays(startOfWeek(today, { weekStartsOn: 1 }), 6))}`);
  }
  for (const m of n.matchAll(/\b(?:ce\s+)?(?:week-end|weekend)(\s+prochain)?\b/g)) {
    let sat = addDays(today, (6 - now.getDay() + 7) % 7);
    if (now.getDay() === 0) sat = addDays(today, -1);
    if (m[1]) sat = addDays(sat, 7);
    push(m[0].trim(), `du ${day(sat)} au ${day(addDays(sat, 1))}`);
  }
  for (const m of n.matchAll(/\bdans\s+(\d{1,2})\s+jours?\b/g)) push(m[0], day(addDays(today, +m[1])));

  for (const m of n.matchAll(/\b(\d{1,2}|1er)\s+(janvier|fevrier|mars|avril|mai|juin|juillet|aout|septembre|octobre|novembre|decembre)\b/g)) {
    const dd = m[1] === "1er" ? 1 : +m[1];
    const mo = MONTHS.indexOf(m[2]);
    let d = new Date(now.getFullYear(), mo, dd);
    if (d < today) d = new Date(now.getFullYear() + 1, mo, dd);
    push(m[0], day(d));
  }

  for (const m of n.matchAll(/\b(\d{1,2})\s*h\s*(\d{2})?(?!\d)/g)) {
    const h = +m[1];
    const mi = +(m[2] ?? 0);
    if (h <= 23 && mi <= 59) push(m[0].replace(/\s+/g, ""), `${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}`);
  }
  if (/\bmidi\b/.test(n) && !/apres-midi/.test(n)) push("midi", "12:00");
  return hints;
}

export type Intent = "create" | "delete" | "move" | "update" | "query";

export function detectIntent(input: string): Intent {
  const n = normalize(input);
  if (/\b(supprime|supprimer|efface|effacer|annule|annuler|retire|retirer|enleve|enlever)\b/.test(n)) return "delete";
  if (/\b(deplace|deplacer|decale|decaler|repousse|repousser|avance|avancer|reporte|reporter)\b/.test(n)) return "move";
  if (/\b(modifie|modifier|change|changer|renomme|renommer|remplace)\b/.test(n)) return "update";
  if (/\b(ajoute|ajouter|cree|creer|planifie|planifier|programme|programmer|note|noter|reserve|reserver|mets|mettre|inscris|inscrire|rajoute|organise|organiser|prevois|prevoir|bloque|bloquer)\b/.test(n)) return "create";
  return "query";
}

// ------------------------------------------------------------------ weather

const WEATHER_RE =
  /\b(meteo|quel temps|temps fera|temps fait|temps qu'il|pleuvoir|pleut|pleuvra|pluie|parapluie|neiger|neige|neigera|temperature|degres|(?:fera|fait)(?:[- ]t)?(?:[- ]il)? (?:chaud|froid|beau|moche)|soleil|orage|vent)\b/;

const NOT_PLACE = new Set([
  "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche", "demain", "aujourd'hui",
  "janvier", "fevrier", "mars", "avril", "mai", "juin", "juillet", "aout", "septembre", "octobre", "novembre", "decembre",
  "midi", "minuit", "la maison", "maison", "moi", "nous",
]);

export interface WeatherQuestion {
  /** Place as written by the user (city, address or favourite place); undefined = home */
  location?: string;
  /** Point in time asked for */
  at: Date;
  /** Only a day was given → daily summary */
  dateOnly: boolean;
  /** "pour mon rendez-vous" / "pour le dentiste" → weather at an event ("" = next event) */
  eventQuery?: string;
}

// "il fera combien", "combien de degrés", "quelle température", "il fait froid ?"
const WEATHER_EXTRA_RE = /\b((fera|fait)(-t)?(-il)?\s+combien|combien de degres|quelle temperature|il fait (beau|chaud|froid|moche|bon)|il fera (beau|chaud|froid|moche|bon)|faire (beau|chaud|froid|moche)|il pleut|il neige|grele|canicule|pleuvoir|pleuvra|pleuvrait|neigera|degres|previsions?|parapluie|fait-il beau|fait-il froid|fait-il chaud)\b/;

const LOWER_STOP = new Set([
  "demain", "aujourd'hui", "apres-demain", "ce", "cette", "cet", "le", "la", "les", "l'", "midi", "minuit", "soir", "matin", "apres-midi",
  "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche", "quelle", "quel", "quelle heure", "partir", "maintenant",
  "week-end", "weekend", "semaine", "heure", "heures", "mon", "ma", "mes", "notre", "nos", "rendez-vous", "rdv", "moment", "y",
  "fin", "debut", "journee", "soiree", "nuit", "matinee", "verse", "dehors", "exterieur", "un", "une", "quoi", "combien",
]);

const EVENT_WORDS = /\b(?:pour|pendant|lors de|durant)\s+(?:mon|ma|le|la|l'|notre)\s*(?:prochain(?:e)?\s+)?(rendez-vous|rdv|evenement|reunion|sortie|match|rando(?:nnee)?|[a-z][a-z'-]{2,})\b/;

/** Detect "Quel temps fera-t-il à Genève demain ?" and extract place + date deterministically. */
export function parseWeatherQuestion(input: string, now: Date, places: { name: string }[] = []): WeatherQuestion | null {
  const n = normalize(input).replace(/[’]/g, "'");
  if (!WEATHER_RE.test(n) && !WEATHER_EXTRA_RE.test(n)) return null;
  if (detectIntent(input) !== "query") return null;
  if (/\b(minuteur|courses|playlist|spotify|scene)\b/.test(n)) return null;

  // weather at an event: "est-ce qu'il pleuvra pour mon rendez-vous ?", "météo pour le dentiste"
  const ev = EVENT_WORDS.exec(n);
  const generic = !!ev && /^(rendez-vous|rdv|evenement)$/.test(ev[1]);
  if (ev && !/\b(maison|ville|journee|semaine|week-end|weekend)\b/.test(ev[1]) && (generic || !LOWER_STOP.has(ev[1]))) {
    return { at: now, dateOnly: false, eventQuery: generic ? "" : ev[1] };
  }

  // favourite place mentioned ("au crossfit", "chez les parents")
  let location = places
    .filter((p) => !/^(maison|domicile|home)$/i.test(p.name))
    .sort((a, b) => b.name.length - a.name.length)
    .find((p) => new RegExp(String.raw`\b${normalize(p.name).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\b`).test(n))?.name;

  if (!location) {
    // "à Genève", "sur Lausanne", "pour Saint-Maurice", "en Valais", "au Mont-Pèlerin"
    const m = /(?:^|\s)(?:à|a|au|aux|sur|pour|en|vers|dans)\s+((?:[A-ZÀÂÄÉÈÊËÎÏÔÖÛÜÇ][\p{L}'’-]*)(?:[\s-](?:(?:de|du|des|la|le|les|sur|en|d'|l')\s?)?[A-ZÀÂÄÉÈÊËÎÏÔÖÛÜÇ][\p{L}'’-]*)*)/u.exec(input);
    if (m && !NOT_PLACE.has(normalize(m[1]))) location = m[1].trim();
  }

  if (!location) {
    // voice input is often lower-case: "il fera combien a annecy demain"
    const m = /(?:^|\s)(?:a|au|aux|sur|en|vers|dans)\s+([a-z][a-z'-]+(?:[\s-](?:(?:de|du|des|la|le|les|sur|en|d'|l')\s?)?[a-z][a-z'-]+){0,3})/.exec(n);
    if (m) {
      const words: string[] = [];
      for (const w of m[1].split(/\s+/)) {
        const connector = /^(de|du|des|sur|en|d'|l')$/.test(w) || (words.length > 0 && /^(la|le|les)$/.test(w));
        if (!connector && (LOWER_STOP.has(w) || /^\d/.test(w))) break;
        words.push(w);
      }
      // drop trailing linking words ("la chaux de")
      while (words.length && /^(de|du|des|la|le|les|sur|en|d'|l')$/.test(words[words.length - 1])) words.pop();
      const cand = words.join(" ");
      if (cand && !NOT_PLACE.has(cand) && !/^(quelle|quel|combien|moi|nous|toi|vous|la maison|maison|l'exterieur|dehors)$/.test(cand) && cand.length > 2) {
        location = cand.replace(/(^|[\s-])([a-z])/g, (_, s, c) => s + c.toUpperCase());
      }
    }
  }

  const r = parseQuickAdd(input, { now });
  let at: Date;
  let dateOnly = false;
  if (r.hasExplicitTime) at = r.start;
  else if (r.hasExplicitDate) {
    at = r.start;
    dateOnly = true;
  } else at = now;
  return { location, at, dateOnly };
}

const CREATE_PREFIX = /^\s*(?:(?:est-ce que tu peux|tu peux|peux-tu|pourrais-tu|merci de)\s+)?(?:ajoute[rz]?|rajoute[rz]?|cree[rz]?|crée[rz]?|planifie[rz]?|programme[rz]?|note[rz]?|réserve[rz]?|reserve[rz]?|mets|mettre|inscris)\s+(?:moi\s+|nous\s+)?(?:un |une |le |la |l'|du |des )?(?:(?:rendez-vous|rdv|événement|evenement)\s+(?:chez le |chez la |chez |au |à la |a la |pour |de |du )?)?/i;

/**
 * Fast path: "Ajoute dentiste jeudi à 16h" is handled without the LLM when the
 * deterministic parser understands an explicit date. Returns null when unsure.
 */
export function quickCreateFromCommand(input: string, opts: QuickAddOptions) {
  if (detectIntent(input) !== "create") return null;
  const stripped = input.replace(CREATE_PREFIX, "").replace(/\s+(?:dans|à) (?:l'|le )?(?:agenda|calendrier)\b/i, "").trim();
  if (!stripped || stripped === input.trim()) return null;
  if (/\?$/.test(stripped)) return null;
  const r = parseQuickAdd(stripped, opts);
  if (!r.hasExplicitDate && !r.hasExplicitTime) return null;
  if (r.title.split(/\s+/).length > 6) return null; // probably a complex sentence: let the LLM handle it
  return r;
}
