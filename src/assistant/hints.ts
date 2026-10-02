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
  if (/\b(ajoute|ajouter|cree|creer|planifie|planifier|programme|programmer|note|noter|reserve|reserver|mets|mettre|inscris|rajoute)\b/.test(n)) return "create";
  return "query";
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
