import { addDays, addMonths, addWeeks } from "date-fns";
import { bestProfileFor, normalize, resolvePersons } from "./profiles";
import type { EventLocation, EventType, FavoritePlace, Profile, Recurrence } from "./types";

/**
 * Deterministic French parser for the "Ajouter quelque chose…" field.
 * Examples: "Dentiste jeudi 16h", "CrossFit mardi 18h30",
 *           "Restaurant vendredi à 20h pour nous deux", "Réunion demain de 14h à 15h30".
 * The LLM assistant is used for anything more complex.
 */

export interface QuickAddResult {
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  profileIds: string[];
  type: EventType;
  location?: EventLocation;
  recurrence?: Recurrence;
  /** 0..1 — how much of the sentence was understood */
  confidence: number;
  hasExplicitDate: boolean;
  hasExplicitTime: boolean;
}

export interface QuickAddOptions {
  now?: Date;
  profiles?: Profile[];
  places?: FavoritePlace[];
  /** Profile used for "pour moi" and when nobody is mentioned */
  currentProfileId?: string;
  defaultProfileIds?: string[];
}

const WEEKDAYS: Record<string, number> = {
  dimanche: 0,
  lundi: 1,
  mardi: 2,
  mercredi: 3,
  jeudi: 4,
  vendredi: 5,
  samedi: 6,
};

const MONTHS: Record<string, number> = {
  janvier: 0,
  janv: 0,
  fevrier: 1,
  fevr: 1,
  fev: 1,
  mars: 2,
  avril: 3,
  avr: 3,
  mai: 4,
  juin: 5,
  juillet: 6,
  juil: 6,
  aout: 7,
  septembre: 8,
  sept: 8,
  octobre: 9,
  oct: 9,
  novembre: 10,
  nov: 10,
  decembre: 11,
  dec: 11,
};

const TYPE_KEYWORDS: [EventType, RegExp][] = [
  ["appointment", /\b(dentiste|medecin|docteur|dr|rdv|rendez[- ]vous|kine|osteo|ophtalmo|veto|veterinaire|coiffeur|banque|garage|pediatre|gyneco|dermato|analyse)/],
  ["sport", /\b(crossfit|sport|gym|fitness|yoga|pilates|course|running|jogging|foot|football|natation|piscine|tennis|padel|velo|ski|muscu|escalade|boxe|match)/],
  ["social", /\b(restaurant|resto|apero|cinema|cine|soiree|diner|dejeuner|brunch|concert|theatre|bar|fete|amis|sortie)/],
  ["work", /\b(reunion|travail|boulot|meeting|call|visio|bureau|conference|formation|client)/],
  ["family", /\b(anniversaire|anniv|famille|parents|maman|papa|mamie|papi|bapteme|mariage|noel)/],
  ["travel", /\b(vol|avion|train|voyage|vacances|aeroport|gare|weekend|week-end)/],
  ["chore", /\b(menage|courses|lessive|poubelles|jardin|bricolage|rangement|demenagement|livraison|plombier|electricien)/],
];

const DEFAULT_DURATION: Record<EventType, number> = {
  appointment: 60,
  sport: 60,
  social: 120,
  work: 60,
  family: 120,
  travel: 120,
  chore: 60,
  other: 60,
};

// ------------------------------------------------------------------

class Masker {
  norm: string;
  private removed: boolean[];
  constructor(readonly original: string) {
    // per-character normalisation keeps indices aligned with the original string
    this.norm = [...original]
      .map((c) => {
        const n = c.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
        return n.length === 1 ? n : c.toLowerCase().charAt(0) || " ";
      })
      .join("")
      .replace(/[’`]/g, "'");
    this.removed = new Array(this.norm.length).fill(false);
  }
  /** Find a regex in the not-yet-consumed text. */
  match(re: RegExp): RegExpExecArray | null {
    re.lastIndex = 0;
    return re.exec(this.norm);
  }
  consume(m: RegExpExecArray, removeFromTitle = true) {
    const start = m.index;
    const end = m.index + m[0].length;
    this.norm = this.norm.slice(0, start) + " ".repeat(end - start) + this.norm.slice(end);
    if (removeFromTitle) for (let i = start; i < end; i++) this.removed[i] = true;
  }
  consumedRatio(): number {
    const meaningful = this.original.replace(/\s/g, "").length || 1;
    let n = 0;
    for (let i = 0; i < this.original.length; i++) if (this.removed[i] && /\S/.test(this.original[i])) n++;
    return n / meaningful;
  }
  remainingTitle(): string {
    let s = "";
    for (let i = 0; i < this.original.length; i++) s += this.removed[i] ? " " : this.original[i];
    return s;
  }
}

const T = String.raw`(\d{1,2})\s*(?:h|:|heures?)\s*(\d{2})?(?!\d)`;

function setTime(d: Date, h: number, m: number): Date {
  const x = new Date(d);
  x.setHours(h, m, 0, 0);
  return x;
}

function validTime(h: number, m: number) {
  return h >= 0 && h <= 23 && m >= 0 && m <= 59;
}

function cleanTitle(s: string): string {
  let t = s.replace(/\s+/g, " ").trim();
  // drop dangling prepositions / articles left by removed tokens
  const dangling = /(^|\s)(a|à|au|aux|le|la|les|l'|de|du|des|d'|pour|avec|et|chez|vers|ce|cette|en|dans|sur)$/i;
  const leading = /^(a|à|le|la|les|de|pour|avec|et|vers|ce|cette)\s+/i;
  for (let i = 0; i < 4; i++) {
    t = t.replace(dangling, "").replace(leading, "").replace(/[\s,;:.-]+$/g, "").replace(/^[\s,;:.-]+/g, "").trim();
  }
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function parseQuickAdd(input: string, opts: QuickAddOptions = {}): QuickAddResult {
  const now = opts.now ?? new Date();
  const profiles = opts.profiles ?? [];
  const places = opts.places ?? [];
  const mk = new Masker(input.trim());

  let day: Date | null = null;
  let hasExplicitDate = false;
  let startTime: { h: number; m: number } | null = null;
  let endTime: { h: number; m: number } | null = null;
  let durationMin: number | null = null;
  let recurrence: Recurrence | undefined;
  let weekdayForced: number | null = null;
  let partOfDay: number | null = null;

  // ---------- recurrence ----------
  let m = mk.match(/\b(?:tous les|chaque)\s+(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)s?\b/);
  if (m) {
    const wd = WEEKDAYS[m[1]];
    recurrence = { freq: "WEEKLY", interval: 1, byWeekday: [wd] };
    weekdayForced = wd;
    mk.consume(m);
  } else if ((m = mk.match(/\b(?:tous les|chaque)\s+jours?\b/))) {
    recurrence = { freq: "DAILY", interval: 1 };
    mk.consume(m);
  } else if ((m = mk.match(/\b(?:toutes les|chaque)\s+(?:(deux|2|trois|3)\s+)?semaines?\b/))) {
    recurrence = { freq: "WEEKLY", interval: m[1] ? (/(deux|2)/.test(m[1]) ? 2 : 3) : 1 };
    mk.consume(m);
  } else if ((m = mk.match(/\b(?:tous les|chaque)\s+mois\b/))) {
    recurrence = { freq: "MONTHLY", interval: 1 };
    mk.consume(m);
  } else if ((m = mk.match(/\b(?:tous les|chaque)\s+ans?\b|\bchaque annee\b/))) {
    recurrence = { freq: "YEARLY", interval: 1 };
    mk.consume(m);
  }

  // ---------- time ranges & durations (before single times) ----------
  m = mk.match(new RegExp(String.raw`\b(?:de|entre)\s+${T}\s*(?:a|et|-|jusqu'a)\s*${T}`));
  if (!m) m = mk.match(new RegExp(String.raw`\b${T}\s*-\s*${T}`));
  if (m) {
    const s = { h: +m[1], m: +(m[2] ?? 0) };
    const e = { h: +m[3], m: +(m[4] ?? 0) };
    if (validTime(s.h, s.m) && validTime(e.h, e.m)) {
      startTime = s;
      endTime = e;
      mk.consume(m);
    }
  }

  m = mk.match(/\b(?:pendant|pour|durant|duree)\s+(\d{1,2})\s*(?:h|heures?)\s*(\d{2})?(?!\d)/);
  if (m) {
    durationMin = +m[1] * 60 + +(m[2] ?? 0);
    mk.consume(m);
  } else if ((m = mk.match(/\b(?:pendant|pour|durant)\s+(\d{1,3})\s*(?:min|minutes?)\b/))) {
    durationMin = +m[1];
    mk.consume(m);
  } else if ((m = mk.match(/\b(?:pendant|pour|durant)\s+(une|1)\s+heure\b/))) {
    durationMin = 60;
    mk.consume(m);
  } else if ((m = mk.match(/\b(?:pendant|pour|durant)\s+(une|1)\s+demi[- ]heure\b/))) {
    durationMin = 30;
    mk.consume(m);
  }

  // ---------- single time ----------
  if (!startTime) {
    m = mk.match(new RegExp(String.raw`\b(?:a|vers|des)?\s*${T}\s*(du matin|du soir|de l'apres-midi|de l'aprem)?`));
    if (m) {
      let h = +m[1];
      const mins = +(m[2] ?? 0);
      if (m[3] && /soir|apres|aprem/.test(m[3]) && h < 12) h += 12;
      if (validTime(h, mins)) {
        startTime = { h, m: mins };
        mk.consume(m);
      }
    }
  }
  if (!startTime && (m = mk.match(/\b(?:a\s+)?midi\b/))) {
    startTime = { h: 12, m: 0 };
    mk.consume(m);
  }
  if (!startTime && (m = mk.match(/\b(?:a\s+)?minuit\b/))) {
    startTime = { h: 0, m: 0 };
    mk.consume(m);
  }

  // ---------- dates ----------
  const today = setTime(now, 0, 0);

  if ((m = mk.match(/\bapres[- ]demain\b/))) {
    day = addDays(today, 2);
    mk.consume(m);
  } else if ((m = mk.match(/\bdemain(?:\s+(matin|soir|midi|apres-midi))?\b/))) {
    day = addDays(today, 1);
    partOfDay = m[1] ? ({ matin: 9, soir: 19, midi: 12, "apres-midi": 14 } as Record<string, number>)[m[1]] : null;
    mk.consume(m);
  } else if ((m = mk.match(/\baujourd'hui\b|\bce jour\b/))) {
    day = today;
    mk.consume(m);
  } else if ((m = mk.match(/\bce\s+(soir|matin|midi|apres-midi)\b/))) {
    day = today;
    partOfDay = ({ matin: 9, soir: 19, midi: 12, "apres-midi": 14 } as Record<string, number>)[m[1]];
    mk.consume(m);
  } else if ((m = mk.match(/\bdans\s+(\d{1,2}|un|une|deux|trois)\s+(jours?|semaines?|mois)\b/))) {
    const n = ({ un: 1, une: 1, deux: 2, trois: 3 } as Record<string, number>)[m[1]] ?? +m[1];
    day = m[2].startsWith("jour") ? addDays(today, n) : m[2].startsWith("sem") ? addWeeks(today, n) : addMonths(today, n);
    mk.consume(m);
  } else if (
    (m = mk.match(
      /\b(?:le\s+)?(?:(?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\s+)?(\d{1,2}|1er)\s+(janvier|janv|fevrier|fevr|fev|mars|avril|avr|mai|juin|juillet|juil|aout|septembre|sept|octobre|oct|novembre|nov|decembre|dec)\.?(?:\s+(\d{4}))?\b/,
    ))
  ) {
    const d = m[1] === "1er" ? 1 : +m[1];
    const month = MONTHS[m[2]];
    let year = m[3] ? +m[3] : now.getFullYear();
    let candidate = new Date(year, month, d);
    if (!m[3] && candidate < today) candidate = new Date(++year, month, d);
    day = candidate;
    mk.consume(m);
  } else if ((m = mk.match(/\b(?:le\s+)?(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?\b/))) {
    const d = +m[1];
    const month = +m[2] - 1;
    if (d >= 1 && d <= 31 && month >= 0 && month <= 11) {
      let year = m[3] ? (+m[3] < 100 ? 2000 + +m[3] : +m[3]) : now.getFullYear();
      let candidate = new Date(year, month, d);
      if (!m[3] && candidate < today) candidate = new Date(++year, month, d);
      day = candidate;
      mk.consume(m);
    }
  } else if ((m = mk.match(/\b(?:le\s+)(\d{1,2}|1er)\b(?!\s*(?:h|:|heures?|min))/))) {
    const d = m[1] === "1er" ? 1 : +m[1];
    if (d >= 1 && d <= 31) {
      let candidate = new Date(now.getFullYear(), now.getMonth(), d);
      if (candidate < today) candidate = addMonths(candidate, 1);
      day = candidate;
      mk.consume(m);
    }
  }

  if (!day) {
    m = mk.match(/\b(?:ce\s+|cette\s+)?(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)(\s+prochain)?(?:\s+(matin|soir|midi|apres-midi))?\b/);
    if (m) {
      const wd = WEEKDAYS[m[1]];
      let diff = (wd - now.getDay() + 7) % 7;
      if (diff === 0) {
        const passed = startTime ? setTime(now, startTime.h, startTime.m) <= now : false;
        if (m[2] || passed) diff = 7;
      }
      day = addDays(today, diff);
      if (m[3]) partOfDay = ({ matin: 9, soir: 19, midi: 12, "apres-midi": 14 } as Record<string, number>)[m[3]];
      mk.consume(m);
    } else if ((m = mk.match(/\b(?:la\s+)?semaine prochaine\b/))) {
      day = addDays(today, ((1 - now.getDay() + 7) % 7) || 7);
      mk.consume(m);
    } else if ((m = mk.match(/\b(?:ce\s+)?(?:week-end|weekend)\b/))) {
      day = addDays(today, (6 - now.getDay() + 7) % 7);
      mk.consume(m, false);
    }
  }
  if (day) hasExplicitDate = true;

  if (weekdayForced !== null && !day) {
    day = addDays(today, (weekdayForced - now.getDay() + 7) % 7);
    hasExplicitDate = true;
  }

  if (!startTime && partOfDay !== null) startTime = { h: partOfDay, m: 0 };

  // ---------- profiles ----------
  const persons = profiles.filter((p) => p.type === "PERSON");
  let profileIds: string[] = [];

  if ((m = mk.match(/\b(?:pour\s+|avec\s+)?(?:nous deux|tous les deux|toutes les deux|a deux|en couple|nous)\b/))) {
    const couple = profiles.find((p) => p.type === "COUPLE");
    profileIds = couple ? [couple.id] : bestProfileFor(persons.map((p) => p.id), profiles);
    mk.consume(m);
  } else if ((m = mk.match(/\b(?:pour\s+|avec\s+)?(?:tout le monde|toute la famille|la famille|toute la maison|tous)\b/))) {
    const hh = profiles.find((p) => p.type === "HOUSEHOLD");
    profileIds = hh ? [hh.id] : persons.map((p) => p.id);
    mk.consume(m);
  }

  const mentioned: string[] = [];
  for (const p of [...profiles].sort((a, b) => b.name.length - a.name.length)) {
    const name = normalize(p.name).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (!name) continue;
    const re = new RegExp(String.raw`(?:\b(?:pour|avec|et)\s+)?\b${name}\b`);
    const pm = mk.match(re);
    if (pm) {
      mentioned.push(p.id);
      mk.consume(pm);
    }
  }
  if ((m = mk.match(/\bpour moi\b/)) && opts.currentProfileId) {
    mentioned.push(opts.currentProfileId);
    mk.consume(m);
  }
  if (mentioned.length) {
    const all = new Set([...resolvePersons([...profileIds, ...mentioned], profiles)]);
    const groupsMentioned = mentioned.filter((id) => profiles.find((p) => p.id === id)?.type !== "PERSON");
    profileIds = groupsMentioned.length && mentioned.length === 1 ? mentioned : bestProfileFor([...all], profiles);
  }
  if (!profileIds.length) {
    profileIds = opts.defaultProfileIds?.length
      ? opts.defaultProfileIds
      : opts.currentProfileId
        ? [opts.currentProfileId]
        : [];
  }

  // ---------- favourite places ----------
  let location: EventLocation | undefined;
  for (const place of [...places].sort((a, b) => b.name.length - a.name.length)) {
    const name = normalize(place.name).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (!name) continue;
    const withPrep = mk.match(new RegExp(String.raw`\b(?:a la|a l'|au|aux|a|chez(?: les| mes| mon| ma)?)\s+${name}\b`));
    if (withPrep) {
      mk.consume(withPrep);
    } else {
      const bare = mk.match(new RegExp(String.raw`\b${name}\b`));
      if (!bare) continue;
      // keep the word in the title ("CrossFit mardi 18h30" -> title CrossFit)
      mk.consume(bare, false);
    }
    location = { label: place.name, address: place.address, lat: place.lat, lng: place.lng, placeId: place.id };
    break;
  }
  if (!location && (m = mk.match(/\b(?:a|au|chez)\s+([a-z][a-z' -]{2,40})$/))) {
    // free-text location at the end: "… à Lausanne"
    const raw = input.slice(m.index).replace(/^\s*(?:à|a|au|chez)\s+/i, "").trim();
    if (raw && !/^\d/.test(raw)) {
      location = { label: raw.charAt(0).toUpperCase() + raw.slice(1) };
      mk.consume(m);
    }
  }

  // ---------- type ----------
  const fullNorm = normalize(input);
  const type: EventType = TYPE_KEYWORDS.find(([, re]) => re.test(fullNorm))?.[0] ?? "other";

  // ---------- assemble ----------
  const hasExplicitTime = !!startTime;
  if (!day) {
    if (startTime && setTime(now, startTime.h, startTime.m) <= now) day = addDays(today, 1);
    else day = today;
  }

  let allDay = false;
  let start: Date;
  let end: Date;
  if (startTime) {
    start = setTime(day, startTime.h, startTime.m);
    if (endTime) {
      end = setTime(day, endTime.h, endTime.m);
      if (end <= start) end = addDays(end, 1);
    } else {
      end = new Date(start.getTime() + (durationMin ?? DEFAULT_DURATION[type]) * 60000);
    }
  } else {
    allDay = true;
    start = setTime(day, 0, 0);
    end = addDays(start, 1);
  }

  let title = cleanTitle(mk.remainingTitle());
  if (!title) title = location?.label ?? "Nouvel événement";

  const understood = mk.consumedRatio();
  const confidence = Math.min(1, (hasExplicitDate ? 0.35 : 0) + (hasExplicitTime ? 0.35 : 0) + (title ? 0.2 : 0) + understood * 0.1);

  return { title, start, end, allDay, profileIds, type, location, recurrence, confidence, hasExplicitDate, hasExplicitTime };
}
