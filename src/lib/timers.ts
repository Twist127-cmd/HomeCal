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
  onze: 11, douze: 12, treize: 13, quatorze: 14, quinze: 15, seize: 16, "dix-sept": 17, "dix-huit": 18,
  "dix-neuf": 19, vingt: 20, "vingt-cinq": 25, trente: 30, quarante: 40, "quarante-cinq": 45, cinquante: 50, soixante: 60,
};
const NUM = String.raw`(\d+(?:[.,]\d+)?|${Object.keys(NUMBERS).sort((a, b) => b.length - a.length).join("|")})`;
const num = (s: string) => NUMBERS[s] ?? Number(s.replace(",", "."));

/** Parse a French duration: "12 minutes", "1h30", "1 heure et demie", "30 secondes", "un quart d'heure". */
export function parseDuration(input: string): { ms: number; match: string } | null {
  const n = normalize(input).replace(/[’]/g, "'");
  let m: RegExpExecArray | null;
  if ((m = /\b(un|1) quart d'heure\b/.exec(n))) return { ms: 15 * 60000, match: m[0] };
  if ((m = /\b(une|1) demi[- ]heure\b/.exec(n))) return { ms: 30 * 60000, match: m[0] };
  if ((m = /\b(\d{1,2})\s*h\s*(\d{1,2})\b/.exec(n))) return { ms: (+m[1] * 60 + +m[2]) * 60000, match: m[0] };
  m = new RegExp(String.raw`\b${NUM}\s*(heures?|h)\b(?:\s*(?:et\s*)?(demie|quart|${NUM}\s*(?:minutes?|min|mn)?))?`).exec(n);
  if (m) {
    let ms = num(m[1]) * 3600000;
    if (m[3] === "demie") ms += 30 * 60000;
    else if (m[3] === "quart") ms += 15 * 60000;
    else if (m[4]) ms += num(m[4]) * 60000;
    return { ms, match: m[0] };
  }
  m = new RegExp(String.raw`\b${NUM}\s*(minutes?|min|mn)\b(?:\s*(?:et\s*)?(demie|${NUM}(?:\s*(?:secondes?|s|sec))?))?(?!\s*(?:minutes?|min|h|heures?))`).exec(n);
  if (m) {
    let ms = num(m[1]) * 60000;
    if (m[3] === "demie") ms += 30000;
    else if (m[4]) ms += num(m[4]) * 1000;
    return { ms, match: m[0] };
  }
  m = new RegExp(String.raw`\b${NUM}\s*(secondes?|sec)\b`).exec(n);
  if (m) return { ms: num(m[1]) * 1000, match: m[0] };
  return null;
}

export type TimerCommand =
  | { op: "create"; durationMs: number; label: string }
  | { op: "cancel"; label?: string; all?: boolean }
  | { op: "pause"; label?: string }
  | { op: "resume"; label?: string }
  | { op: "add"; durationMs: number; label?: string }
  | { op: "list" };

const cleanLabel = (s: string) =>
  s
    .replace(/^(pour|de|du|des|la|le|les|l'|d')\s+/i, "")
    .replace(/^(pour|de|du|des|la|le|les|l'|d')\s+/i, "")
    .replace(/[?.!]+$/, "")
    .trim();

/** Deterministic timer commands (no LLM): instant and reliable. */
export function parseTimerCommand(input: string): TimerCommand | null {
  const raw = input.trim();
  const n = normalize(raw).replace(/[’]/g, "'");
  const mentionsTimer = /\b(minuteurs?|minuterie|chrono|timer|compte a rebours)\b/.test(n);

  if (mentionsTimer && /\b(quels?|combien|liste|reste-t-il|reste t il|ou en est|en cours)\b/.test(n) && !/\b(ajoute|rajoute)\b/.test(n)) return { op: "list" };

  const labelAfter = (re: RegExp) => {
    const mm = re.exec(raw);
    return mm ? cleanLabel(mm[1]) || undefined : undefined;
  };

  if (mentionsTimer && /\b(annule|annuler|supprime|supprimer|arrete|arreter|stop|stoppe|efface)\b/.test(n)) {
    if (/\b(tous|toutes)\b/.test(n)) return { op: "cancel", all: true };
    return { op: "cancel", label: labelAfter(/minuteur\s+(?:(?:des|du|de|pour)\s+|d')?(.+)$/i) };
  }
  if (mentionsTimer && /\b(pause|mets en pause|suspends?)\b/.test(n)) return { op: "pause", label: labelAfter(/minuteur\s+(?:(?:des|du|de|pour)\s+)?(.+)$/i) };
  if (mentionsTimer && /\b(reprends?|relance|continue)\b/.test(n)) return { op: "resume", label: labelAfter(/minuteur\s+(?:(?:des|du|de|pour)\s+)?(.+)$/i) };

  const d = parseDuration(raw);
  if (mentionsTimer && d && /\b(ajoute|rajoute|plus|encore)\b/.test(n)) {
    return { op: "add", durationMs: d.ms, label: labelAfter(/minuteur\s+(?:des|du|de|pour)\s+(.+)$/i) };
  }

  if (d) {
    // "minuteur 12 minutes pour les pâtes", "lance un minuteur de 5 minutes"
    if (mentionsTimer) {
      const after = normalize(raw).indexOf(d.match) + d.match.length;
      const rest = raw.slice(after).replace(/^\s*(pour|de)\s+/i, "").trim();
      const before = /minuteur\s+(?:pour|de)\s+(?!\d)(.+?)\s+(?:de\s+)?\d/i.exec(raw)?.[1];
      return { op: "create", durationMs: d.ms, label: cleanLabel(rest) || cleanLabel(before ?? "") || "Minuteur" };
    }
    // "réveille-moi dans 20 minutes"
    if (/\b(reveille|reveiller|sonne|previens|previens-moi|bip)\b/.test(n) && /\bdans\b/.test(n)) return { op: "create", durationMs: d.ms, label: "Réveil" };
    // "dans 45 minutes rappelle-moi de sortir le linge"
    const m = /\bdans\s+.+?\s+rappelle[- ]moi\s+(?:de\s+|d')?(.+)$/i.exec(raw) ?? /\brappelle[- ]moi\s+(?:de\s+|d')?(.+?)\s+dans\s+/i.exec(raw);
    if (m && /\bdans\b/.test(n)) return { op: "create", durationMs: d.ms, label: cleanLabel(m[1]) };
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
