import { normalize } from "./profiles";
import type { Timer } from "./types";

/**
 * Timers: `expiresAt` is the source of truth while running (survives refresh, page
 * changes and screen lock); `remainingMs` while paused. No reliance on setInterval.
 */

/** Current time (ms). Kept outside components so render stays pure. */
export const nowMs = () => Date.now();

export function remainingMs(t: Timer, now: number): number {
  if (t.status === "paused") return Math.max(0, t.remainingMs ?? 0);
  if (t.status === "running") return Math.max(0, new Date(t.expiresAt).getTime() - now);
  return 0;
}

export function isExpired(t: Timer, now: number): boolean {
  return t.status === "running" && new Date(t.expiresAt).getTime() <= now;
}

export function newTimer(label: string, durationMs: number, now: number, createdBy?: string): Omit<Timer, "id"> {
  return {
    label: label.trim() || "Minuteur",
    duration: durationMs,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + durationMs).toISOString(),
    status: "running",
    createdBy,
  };
}

export function pauseTimer(t: Timer, now: number): Partial<Timer> {
  if (t.status !== "running") return {};
  return { status: "paused", remainingMs: remainingMs(t, now) };
}

export function resumeTimer(t: Timer, now: number): Partial<Timer> {
  if (t.status !== "paused") return {};
  return { status: "running", expiresAt: new Date(now + (t.remainingMs ?? 0)).toISOString(), remainingMs: 0 };
}

export function addTime(t: Timer, ms: number, now: number): Partial<Timer> {
  if (t.status === "paused") return { remainingMs: (t.remainingMs ?? 0) + ms, duration: t.duration + ms };
  if (t.status === "done") return { status: "running", expiresAt: new Date(now + ms).toISOString(), duration: t.duration + ms };
  return { expiresAt: new Date(Math.max(now, new Date(t.expiresAt).getTime()) + ms).toISOString(), duration: t.duration + ms };
}

/** "08:42", "1:02:05" */
export function formatRemaining(ms: number): string {
  const s = Math.ceil(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(h ? 2 : 2, "0");
  return h ? `${h}:${mm}:${String(sec).padStart(2, "0")}` : `${mm}:${String(sec).padStart(2, "0")}`;
}

/** "12 min", "1 h 30", "45 s" */
export function formatDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return m % 60 ? `${h} h ${String(m % 60).padStart(2, "0")}` : `${h} h`;
}

// ------------------------------------------------------------------ French parsing

const NUMBERS: Record<string, number> = {
  un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, dix: 10,
  onze: 11, douze: 12, treize: 13, quatorze: 14, quinze: 15, seize: 16, "dix-sept": 17, "dix sept": 17, "dix-huit": 18, "dix huit": 18,
  "dix-neuf": 19, "dix neuf": 19, vingt: 20, "vingt-cinq": 25, "vingt cinq": 25, trente: 30, quarante: 40, "quarante-cinq": 45, "quarante cinq": 45,
  cinquante: 50, soixante: 60, "quatre-vingt-dix": 90, "quatre vingt dix": 90,
};
const NUM = String.raw`(\d+(?:[.,]\d+)?|${Object.keys(NUMBERS).sort((a, b) => b.length - a.length).join("|")})`;
const num = (s: string) => NUMBERS[s] ?? Number(s.replace(",", "."));
const MIN_UNIT = String.raw`(?:minutes?|mins?|mn)`;
const SEC_UNIT = String.raw`(?:secondes?|secs?|s)`;

/** Parse a French duration: "12 minutes", "1h30", "1 heure et demie", "30 secondes", "un quart d'heure". */
export function parseDuration(input: string): { ms: number; match: string } | null {
  const n = normalize(input).replace(/[’]/g, "'");
  let m: RegExpExecArray | null;
  if ((m = /\b(trois|3) quarts? d'heure\b/.exec(n))) return { ms: 45 * 60000, match: m[0] };
  if ((m = /\b(un|1) quart d'heure\b/.exec(n))) return { ms: 15 * 60000, match: m[0] };
  if ((m = /\b(une|1) demi[- ]heure\b/.exec(n))) return { ms: 30 * 60000, match: m[0] };
  if ((m = /\b(\d{1,2})\s*h\s*(\d{1,2})\b(?!\s*(?:heures?))/.exec(n))) return { ms: (+m[1] * 60 + +m[2]) * 60000, match: m[0] };
  m = new RegExp(String.raw`\b${NUM}\s*(heures?|h)\b(?:\s*(?:et\s*)?(demie|quart|${NUM}\s*${MIN_UNIT}?\b))?`).exec(n);
  if (m) {
    let ms = num(m[1]) * 3600000;
    if (m[3] === "demie") ms += 30 * 60000;
    else if (m[3] === "quart") ms += 15 * 60000;
    else if (m[4]) ms += num(m[4]) * 60000;
    return { ms, match: m[0] };
  }
  m = new RegExp(String.raw`\b${NUM}\s*${MIN_UNIT}\b(?:\s*(?:et\s*)?(demie|${NUM}(?:\s*${SEC_UNIT}\b)?))?(?!\s*(?:${MIN_UNIT}|h\b|heures?))`).exec(n);
  if (m) {
    let ms = num(m[1]) * 60000;
    if (m[2] === "demie") ms += 30000;
    else if (m[3]) ms += num(m[3]) * 1000;
    return { ms, match: m[0] };
  }
  m = new RegExp(String.raw`\b${NUM}\s*${SEC_UNIT}\b`).exec(n);
  if (m) return { ms: num(m[1]) * 1000, match: m[0] };
  return null;
}

export type TimerCommand =
  | { op: "create"; durationMs: number; label: string; confidence?: number }
  | { op: "cancel"; label?: string; all?: boolean }
  | { op: "pause"; label?: string }
  | { op: "resume"; label?: string }
  | { op: "add"; durationMs: number; label?: string; confidence?: number }
  | { op: "list" }
  | { op: "remaining"; label?: string };

const ARTICLE = /^(?:(?:de la|pour|des|les|mon|mes|son|une|du|de|la|le|ma|sa|un|au|aux|pendant|sur)(?:\s+|$)|(?:de l'|l'|d')\s*)/i;
const STOP_LABEL = /^(de|du|des|la|le|les|pour|un|une|au|aux|sur|pendant|minute|minutes|seconde|secondes|heure|heures|s'il|stp|svp|merci)?$/i;

function cleanLabel(s: string): string {
  let t = s.replace(/[?.!,;]+$/g, "").trim();
  for (let i = 0; i < 3; i++) t = t.replace(ARTICLE, "").trim();
  t = t.replace(/\s+(?:de|d'|pendant|sur|pour)$/i, "").trim();
  return STOP_LABEL.test(t) ? "" : t;
}

/** Accent/case folding that keeps the string length (indexes stay aligned with the original). */
const fold = (s: string) => s.normalize("NFC").replace(/[\u00C0-\u024F]/g, (ch) => ch.normalize("NFD").replace(/[\u0300-\u036f]/g, "") || ch).toLowerCase().replace(/[’]/g, "'");

const TIMER_WORD = String.raw`(?:minuteurs?|minuterie|chronos?|chronometre|timers?|compte a rebours|compte-a-rebours|alarme)`;
const DATE_WORDS =
  /\b(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|demain|apres-demain|aujourd'hui|ce soir|ce matin|semaine|janvier|fevrier|mars|avril|mai|juin|juillet|aout|septembre|octobre|novembre|decembre|reunion|rendez-vous|rdv)\b|\b\d{1,2}\s*h(?:\s*\d{2})?\b(?!\s*(?:pour|de)\b)|\ba\s+\d{1,2}\s*h/;
const CANCEL_VERBS = /\b(annule|annuler|supprime|supprimer|arrete|arreter|stop|stoppe|stopper|efface|effacer|enleve|retire|coupe|couper|eteins|vire)\b/;
const PAUSE_VERBS = /\b(pause|mets en pause|met en pause|suspends?|suspendre|fige|bloque)\b/;
const RESUME_VERBS = /\b(reprends?|reprendre|relance|relancer|continue|continuer|redemarre|redemarrer|remets en route|debloque)\b/;
const ADD_VERBS = /\b(ajoute|ajouter|rajoute|rajouter|plus|encore|prolonge|prolonger|rallonge|rallonger|augmente|ajoute encore)\b/;
const REMAINING = /\b(combien de temps (?:il )?reste|combien (?:de temps )?(?:il )?reste[- ]t[- ]il|reste[- ]t[- ]il combien|il reste combien(?: de temps)?|temps restant|combien de temps encore|ou en est|on en est ou|c'est bientot fini|c'est bientot pret|il en est ou)\b/;

/** Label written after the timer word: "minuteur des pâtes" → "pâtes". */
function labelAfterTimerWord(raw: string): string | undefined {
  const plain = fold(raw);
  const m = new RegExp(String.raw`\b${TIMER_WORD}\b\s*(.*)$`).exec(plain);
  if (!m) return undefined;
  const start = plain.length - m[1].length;
  let rest = raw.slice(start).trim();
  rest = rest.replace(/\s+(?:en pause|en route)\s*$/i, "");
  const label = cleanLabel(rest);
  if (!label || /^(en pause|s'il|stp|svp|merci|maintenant|tout de suite|actuel|en cours)/i.test(normalize(label))) return undefined;
  if (parseDuration(label)) return undefined;
  return label;
}

/** Label for a creation: "… pour les pâtes", "minuteur pâtes 10 minutes", "minuteur des œufs de 8 minutes". */
function creationLabel(raw: string, d: { match: string }): string {
  const plain = fold(raw);
  const idx = plain.indexOf(d.match);
  const after = idx >= 0 ? raw.slice(idx + d.match.length) : "";
  // after the duration: "pour les pâtes", "pour le four", ": pâtes"
  const ma = /^\s*(?:,|:|-)?\s*(?:pour|pour le|pour la|pour les|de|du|des)?\s*(.*)$/i.exec(after);
  let label = ma ? cleanLabel(ma[1]) : "";
  if (label && /^(s'il|stp|svp|merci|maintenant|tout de suite|steuplait)/i.test(normalize(label))) label = "";
  if (!label && idx > 0) {
    // before the duration, after the timer word: "minuteur pâtes 10 minutes", "minuteur pour le riz de 12 minutes"
    const before = raw.slice(0, idx);
    const plainBefore = fold(before);
    const mb = new RegExp(String.raw`\b${TIMER_WORD}\b\s*(.*)$`).exec(plainBefore);
    if (mb) label = cleanLabel(before.slice(before.length - mb[1].length).replace(/\s+(?:de|d'|pendant|sur)\s*$/i, ""));
  }
  if (/^(minuteur|chrono|timer)$/i.test(label)) label = "";
  return label;
}

/** Deterministic timer commands (no LLM): instant and reliable. */
export function parseTimerCommand(input: string): TimerCommand | null {
  const raw = input.trim().replace(/^homecal[,\s]+/i, "");
  const n = normalize(raw).replace(/[’]/g, "'").replace(/[?!.]+/g, " ").replace(/\s+/g, " ").trim();
  const mentionsTimer = new RegExp(String.raw`\b${TIMER_WORD}\b`).test(n);
  const d = parseDuration(raw);

  // --- remaining time / list
  if (REMAINING.test(n) && !/\b(partir|trajet|aller|arriver|route|rendez-vous|rdv|courses|acheter)\b/.test(n)) {
    return { op: "remaining", label: mentionsTimer ? labelAfterTimerWord(raw) : undefined };
  }
  if (mentionsTimer && /\b(quels?|liste|lister|affiche|montre|en cours|combien|lis|dis-moi)\b/.test(n) && !ADD_VERBS.test(n) && !d) {
    return { op: "list" };
  }

  // --- cancel / pause / resume (need an explicit timer word)
  if (mentionsTimer && CANCEL_VERBS.test(n) && !d) {
    if (/\b(tous|toutes|les minuteurs|les chronos|tout)\b/.test(n)) return { op: "cancel", all: true };
    return { op: "cancel", label: labelAfterTimerWord(raw) };
  }
  if (mentionsTimer && PAUSE_VERBS.test(n) && !d) return { op: "pause", label: labelAfterTimerWord(raw) };
  if (mentionsTimer && RESUME_VERBS.test(n) && !d) return { op: "resume", label: labelAfterTimerWord(raw) };

  if (!d) return null;

  // --- extend: "ajoute 2 minutes au minuteur", "encore 5 minutes pour les pâtes"
  if (ADD_VERBS.test(n) && (mentionsTimer || /^(?:ajoute|rajoute|encore|plus|prolonge|rallonge)\b/.test(n))) {
    const shoppingOrCalendar = /\b(courses|liste|calendrier|agenda)\b/.test(n) || DATE_WORDS.test(n.replace(d.match, " "));
    if (!shoppingOrCalendar) {
      const lm = new RegExp(String.raw`\b${TIMER_WORD}\s+(?:des|du|de la|de l'|de|pour|d')\s*(.+)$`, "i").exec(raw) ?? /\b(?:pour|aux|au)\s+(?:les |le |la |l')?(.+)$/i.exec(raw.slice(normalize(raw).indexOf(d.match) + d.match.length));
      const label = lm ? cleanLabel(lm[1]) : undefined;
      return { op: "add", durationMs: d.ms, label: label && !new RegExp(TIMER_WORD).test(normalize(label)) ? label : undefined, confidence: mentionsTimer ? 0.96 : 0.86 };
    }
  }

  // anything with a date / clock time is a calendar or reminder sentence, not a timer
  const withoutDuration = n.replace(d.match, " ");
  const hasDate = DATE_WORDS.test(withoutDuration);

  // --- "rappelle-moi dans 20 minutes de sortir le linge", "dans 45 minutes rappelle-moi de…", "réveille-moi dans 20 minutes"
  if (/\bdans\b/.test(n) && !/\b\d{1,2}\s*h\b|\ba\s+\d{1,2}\b/.test(withoutDuration)) {
    const voice = /\b(rappelle[- ]?moi|rappelle[- ]?nous|previens[- ]?moi|previens[- ]?nous|reveille[- ]?moi|reveille[- ]?nous|sonne|bip|fais[- ]?moi signe|dis[- ]?moi|alerte[- ]?moi|fais[- ]?moi penser|n'oublie pas de me|pense a me)\b/.test(n);
    if (voice || mentionsTimer) {
      const de = /\b(?:de|d'|qu'il faut|que je dois|pour)\s*(.+)$/i;
      // part of the raw text that is neither the trigger nor the duration
      const plain = fold(raw);
      const di = plain.indexOf(d.match);
      const afterDur = raw.slice(di + d.match.length);
      const beforeDans = raw.slice(0, Math.max(0, plain.lastIndexOf("dans", di)));
      let label = "";
      const ma = de.exec(afterDur);
      if (ma) label = cleanLabel(ma[1]);
      if (!label) {
        const mb = /\b(?:rappelle|previens|fais|dis|n'oublie|pense)[^ ]*\s*(?:-?moi|-?nous)?\s*(?:de|d'|qu'il faut|à|a)?\s*(.*)$/i.exec(beforeDans);
        if (mb) label = cleanLabel(mb[1]);
      }
      if (/^signe$/i.test(label)) label = "";
      if (/\b(reveille|alarme)\b/.test(n) && !label) label = "Réveil";
      if (!label) label = /\b(reveille)\b/.test(n) ? "Réveil" : "Rappel";
      label = label.charAt(0).toUpperCase() + label.slice(1);
      return { op: "create", durationMs: d.ms, label, confidence: 0.94 };
    }
  }

  if (hasDate) return null;

  // --- explicit timer word: "minuteur 8 minutes", "lance un chrono de 5 min pour le riz"
  if (mentionsTimer) return { op: "create", durationMs: d.ms, label: creationLabel(raw, d) || "Minuteur", confidence: 0.97 };

  // --- bare duration: "8 minutes pour les pâtes", "mets 10 minutes pour le four", "lance 5 minutes"
  const bare = new RegExp(String.raw`^(?:(?:mets|met|lance|demarre|programme|regle|compte|go|top|chrono)\s+(?:moi\s+)?)?(?:un\s+|une\s+)?${d.match.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\b`).test(n);
  if (bare) {
    const label = creationLabel(raw, d);
    const verb = /^(mets|met|lance|demarre|programme|regle|compte|go|top|chrono)\b/.test(n);
    if (!label && !verb && n !== normalize(d.match)) return null;
    return { op: "create", durationMs: d.ms, label: label || "Minuteur", confidence: label ? 0.93 : 0.9 };
  }
  return null;
}

/** Pick the timer a command refers to (by label, else the only/most recent active one). */
export function findTimer(timers: Timer[], label?: string, statuses: Timer["status"][] = ["running", "paused"]): Timer | undefined {
  const active = timers.filter((t) => statuses.includes(t.status)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (!label) return active[0];
  const q = normalize(label);
  return active.find((t) => normalize(t.label) === q) ?? active.find((t) => normalize(t.label).includes(q) || q.includes(normalize(t.label)));
}
