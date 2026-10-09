import { addDays, startOfWeek } from "date-fns";
import { fmtRelativeDay, fmtTime, startOfDay } from "@/lib/dates";
import { normalize } from "@/lib/profiles";
import { parseQuickAdd, type QuickAddResult } from "@/lib/quickadd";
import { localIso } from "../executor";
import { quickCreateFromCommand } from "../hints";
import type { Utterance } from "../router/normalize";
import { call, type DomainModule, type ParsedIntent, type RouteAction, type RouteOutcome, type RouterContext, type RunEnv } from "../router/types";
import { availabilityText, calendarCreatedText, describeDay, describeRange, eventFoundText, nextEventText } from "../responses/calendar";

/**
 * Calendar: calendar.create / delete / move / update / today / tomorrow / day / range / next / search / availability.
 * Complex requests (organise my Saturday, several constraints…) are left to the LLM.
 */

const ALL_DAY_RE = /\b(toute la journee|journee entiere|journee complete|toute la jour|pas d'heure|sans heure)\b/;
const CANCEL_RE = /^(non|annule|laisse tomber|oublie|stop|rien|pas maintenant|aucun)\b/;
/** other domains' markers: never a calendar sentence */
const OTHER_DOMAIN = /\b(courses|commissions|liste|minuteurs?|minuterie|chrono|timer|playlist|spotify|musique|chanson|morceau|son|volume|scene|rappel|rappelle-moi|rappelle moi|meteo|quel temps|temps fait|temps fera|temps qu'il|pleuvoir|pleuvra|pluie|degres|itineraire|waze|maps|gps|partir|depart)\b/;
/** never an event title */
const NOT_TITLE = /^(reveil|alarme|minuteur|son|volume|musique|chauffage|lumiere|lumieres|tele|television|mode|scene|four|lait|pain)$/;
/** complex planning → LLM */
const COMPLEX =
  /\b(organise|optimise|pour que|afin de|de sorte|sans etre en retard|avant le|apres le|entre midi|au moins|garde-moi|reorganise|tous mes|toutes mes|chaque fois|plutot|mais pas|sauf|excepte|a part le|a part la|sinon|si il|s'il|si on|si elle|compare|par rapport)\b/;
const EVENT_NOUNS = String.raw`(?:rendez-vous|rdv|evenement|reunion|seance|cours)`;
const ARTICLES = String.raw`(?:le |la |l'|les |mon |ma |mes |notre |nos |un |une )`;

const DATEWORD_RE = /\b(aujourd'hui|demain|apres-demain|ce soir|ce matin|cet apres-midi|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|week-end|weekend|semaine|\d{1,2}\s+(janvier|fevrier|mars|avril|mai|juin|juillet|aout|septembre|octobre|novembre|decembre))\b/;

/** Clean an event reference: "le rendez-vous chez le dentiste de demain" → "dentiste" */
export function cleanEventQuery(q: string): string {
  return q
    .replace(/\b(de|du|d')\s+(demain|aujourd'hui|ce soir|ce matin|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\b.*$/, "")
    .replace(new RegExp(String.raw`^${ARTICLES}?(?:prochain(?:e)?\s+)?${EVENT_NOUNS}\s+(?:chez le |chez la |chez l'|chez |avec le |avec la |avec |du |de la |de l'|des |de |d'|au |a la |pour )?`), "")
    .replace(new RegExp(`^${ARTICLES}`), "")
    .replace(/\s+(de mon|de l'|du|dans l')\s*(agenda|calendrier|planning)$/, "")
    .replace(/\b(prevu|prevue)\b.*$/, "")
    .trim();
}

interface RangeSpec {
  from: Date;
  to: Date;
  label: "today" | "tomorrow" | "day" | "range";
}

/** Date or range referenced by a read question. */
function readRange(u: Utterance, now: Date): RangeSpec {
  const n = u.norm;
  const today = startOfDay(now);
  if (/\b(week-end|weekend)\b/.test(n)) {
    let sat = addDays(today, (6 - now.getDay() + 7) % 7);
    if (now.getDay() === 0) sat = addDays(today, -1);
    if (/\bprochain\b/.test(n)) sat = addDays(sat, 7);
    return { from: sat, to: addDays(sat, 1), label: "range" };
  }
  if (/\bsemaine prochaine\b/.test(n)) {
    const mon = addDays(startOfWeek(today, { weekStartsOn: 1 }), 7);
    return { from: mon, to: addDays(mon, 6), label: "range" };
  }
  if (/\bcette semaine\b/.test(n)) {
    return { from: today, to: addDays(startOfWeek(today, { weekStartsOn: 1 }), 6), label: "range" };
  }
  const q = parseQuickAdd(u.text, { now });
  const day = q.hasExplicitDate ? startOfDay(q.start) : today;
  const label = day.getTime() === today.getTime() ? "today" : day.getTime() === addDays(today, 1).getTime() ? "tomorrow" : "day";
  return { from: day, to: day, label };
}

function intent(name: string, confidence: number, entities: Record<string, unknown>, u: Utterance, destructive = false): ParsedIntent {
  return { intent: name, confidence, entities, raw: u.raw, destructive };
}

/** Pure parsing (exported for tests). */
export function parseCalendar(u: Utterance, ctx: RouterContext): ParsedIntent | null {
  const n = u.norm.replace(/[.,!?]+$/g, "").trim();
  if (!n) return null;
  const qaOpts = { now: ctx.now, profiles: ctx.profiles, places: ctx.places, currentProfileId: ctx.currentProfileId };
  const other = OTHER_DOMAIN.test(n);
  const complex = COMPLEX.test(n);

  // ---- availability: "quand sommes-nous libres samedi ?", "est-ce qu'on est dispo demain soir ?"
  if (/\b(libres?|disponibles?|dispo|dispos|creneaux? libres?|un moment de libre|un trou)\b/.test(n) && /\b(quand|est-ce que|est ce que|suis-je|sommes-nous|on est|je suis|nous sommes|quels?|trouve|cherche|y a-t-il|a-t-on|ai-je)\b/.test(n)) {
    if (other) return null;
    const persons = /\b(nous|on|sommes-nous|nos|tous les deux|tous|ensemble|vous)\b/.test(n) ? "all" : "me";
    const r = readRange(u, ctx.now);
    const q = parseQuickAdd(u.text, { now: ctx.now });
    const part = /\bmatin\b/.test(n) ? [8, 12] : /\bapres-midi\b/.test(n) ? [13, 18] : /\bsoir(ee)?\b/.test(n) ? [18, 23] : null;
    const dur = /\b(\d+)\s*(h|heures?)\b/.exec(n) ?? /\b(une|deux|trois)\s+heures?\b/.exec(n);
    const durationMinutes = dur ? (({ une: 1, deux: 2, trois: 3 } as Record<string, number>)[dur[1]] ?? Number(dur[1])) * 60 : 60;
    const explicit = q.hasExplicitDate || /\b(week-end|weekend|semaine)\b/.test(n);
    return intent("calendar.availability", complex ? 0.6 : 0.92, { persons, from: r.from.toISOString(), to: r.to.toISOString(), part, durationMinutes, explicit }, u);
  }

  if (other) return null;

  // ---- next event
  if (/\b(prochain|prochaine)\s+(rendez-vous|rdv|evenement|reunion|truc|activite)\b/.test(n) && /\b(quoi|quel|quelle|c'est|quand|j'ai|ai-je|mon|ma|notre|dis|montre|lis)\b/.test(n)) {
    return intent("calendar.next", 0.94, {}, u);
  }
  if (/^(c'est quoi la suite|quelle est la suite|la suite du programme|c'est quoi la suite du programme|qu'est-ce qui vient apres|qu'est ce qui vient apres|c'est quoi le prochain truc|j'ai quoi apres|on a quoi apres|qu'est-ce que j'ai apres|qu'est ce que j'ai apres)$/.test(n)) {
    return intent("calendar.next", 0.93, {}, u);
  }

  // ---- reads: "j'ai quoi aujourd'hui ?", "que fait-on samedi ?", "on a quoi ce week-end ?"
  const READ =
    /\b(j'ai quoi|j'ai un truc|j'ai quelque chose|on a un truc|on a quelque chose|ai-je un truc|est-ce qu'on a quelque chose|est-ce qu'on a un truc|qu'est-ce que j'ai|qu'est ce que j'ai|qu'ai-je|ai-je quelque chose|ai-je des|est-ce que j'ai|qu'avons-nous|qu'est-ce qu'on a|qu'est ce qu'on a|on a quoi|que fait-on|qu'est-ce qu'on fait|qu'est ce qu'on fait|on fait quoi|que faisons-nous|quel est (le|mon|notre) programme|c'est quoi (le|mon|notre) programme|(mon|notre|le) programme|(mon|notre|l') ?agenda|(mon|notre|le) planning|qu'est-ce qui est prevu|qu'est ce qui est prevu|qu'y a-t-il|qu'est-ce qu'il y a|qu'est ce qu'il y a|il y a quoi|y a quoi|quoi de prevu|des rendez-vous|des rdv|montre-moi (la journee|ma journee|demain|aujourd'hui)|ma journee|la journee de)\b/;
  if (READ.test(n) && !complex && !/\b(ajoute|mets|note|cree|supprime|annule|decale|deplace)\b/.test(n.split(" ")[0])) {
    const r = readRange(u, ctx.now);
    const name = r.label === "today" ? "calendar.today" : r.label === "tomorrow" ? "calendar.tomorrow" : r.label === "range" ? "calendar.range" : "calendar.day";
    return intent(name, 0.93, { from: r.from.toISOString(), to: r.to.toISOString() }, u);
  }

  // ---- search: "c'est quand le dentiste ?", "à quelle heure est la réunion ?", "quand est mon rendez-vous chez le dentiste ?"
  const sr =
    /^(?:c'est quand|quand est|quand a lieu|quand c'est|a quelle heure (?:est|a lieu|commence|c'est|j'ai|est-ce que j'ai|on a|ai-je)|quand ai-je|quand est-ce que j'ai|quand j'ai|quand on a|c'est a quelle heure)\s+(.+)$/.exec(n) ??
    // "le dentiste c'est quand ?", "la réunion c'est à quelle heure ?"
    /^((?:le |la |l'|mon |ma )\S.*?)\s+(?:c'est quand|c'est a quelle heure|est quand|est a quelle heure|a quelle heure)$/.exec(n);
  if (sr && !complex) {
    const q = cleanEventQuery(sr[1].replace(/^(le |la |l'|mon |ma )?/, ""));
    if (q && q.split(" ").length <= 4 && !NOT_TITLE.test(q)) return intent("calendar.search", 0.92, { query: q }, u);
  }

  // ---- delete: "supprime le dentiste", "annule le rendez-vous chez le dentiste", "efface la réunion de demain"
  const del = /^(?:supprime|efface|annule|enleve|retire|vire)\s+(.+)$/.exec(n);
  if (del && !complex) {
    const rest = del[1];
    const day = DATEWORD_RE.test(rest) ? parseQuickAdd(u.text, { now: ctx.now }) : null;
    const query = cleanEventQuery(rest);
    const valid = query && !NOT_TITLE.test(query) && query.split(" ").length <= 4 && !/^(tout|tous|toutes|ca|cela|ce|celui)$/.test(query);
    if (valid) {
      return intent("calendar.delete", 0.96, { query, day: day?.hasExplicitDate ? startOfDay(day.start).toISOString() : undefined, all: /\b(tous les|toutes les|la serie|toute la serie)\b/.test(rest) }, u, true);
    }
    if (day?.hasExplicitDate && new RegExp(`^${ARTICLES}?${EVENT_NOUNS}`).test(rest)) {
      return intent("calendar.delete", 0.95, { query: "", day: startOfDay(day.start).toISOString() }, u, true);
    }
  }

  // ---- rename: "renomme le dentiste en orthodontiste"
  const rn = /^(?:renomme|appelle)\s+(.+?)\s+(?:en|par)\s+(.+)$/.exec(n);
  if (rn && !complex) {
    const query = cleanEventQuery(rn[1]);
    const title = u.text.replace(/^.*?\s(?:en|par)\s+/i, "").trim();
    if (query && title) return intent("calendar.update", 0.95, { query, title: title.charAt(0).toUpperCase() + title.slice(1) }, u, true);
  }

  // ---- move: "décale le dentiste à 17h", "déplace la réunion à demain", "repousse le dentiste d'une heure"
  const mvVerb = /^(decale|deplace|repousse|avance|reporte|bouge|recule|change)\s+(.+)$/.exec(n);
  if (mvVerb && !complex) {
    const rest = mvVerb[2];
    const rel = /^(.+?)\s+(?:de|d')\s*(\d+|une|un|deux|trois|quinze|trente|une demi)\s*(heures?|h|minutes?|min|jours?|semaines?)\b/.exec(rest) ?? /^(.+?)\s+d'(une|un)\s+(heure|demi-heure|jour|semaine)\b/.exec(rest);
    if (rel) {
      const nb = ({ une: 1, un: 1, deux: 2, trois: 3, quinze: 15, trente: 30, "une demi": 0.5 } as Record<string, number>)[rel[2]] ?? Number(rel[2]);
      const unit = rel[3];
      const minutes = /demi-heure/.test(unit) ? 30 : /^h|heure/.test(unit) ? nb * 60 : /^min/.test(unit) ? nb : /^jour/.test(unit) ? nb * 1440 : nb * 10080;
      const sign = mvVerb[1] === "avance" ? -1 : 1;
      const query = cleanEventQuery(rel[1]);
      if (query && !NOT_TITLE.test(query)) return intent("calendar.move", 0.96, { query, shiftMin: sign * minutes }, u, true);
    }
    const abs = /^(.+?)\s+(?:a|au|pour|vers|a la|en)\s+(.+)$/.exec(rest);
    if (abs) {
      const when = parseQuickAdd(abs[2], { now: ctx.now });
      const query = cleanEventQuery(abs[1]);
      if ((when.hasExplicitDate || when.hasExplicitTime) && query && !NOT_TITLE.test(query) && query.split(" ").length <= 4) {
        return intent("calendar.move", 0.96, { query, hasDate: when.hasExplicitDate, hasTime: when.hasExplicitTime, start: when.start.toISOString() }, u, true);
      }
    }
  }

  // ---- "mets le CrossFit à 19h" (existing event + time only, no date) → move
  const mets = /^mets\s+(le |la |l'|mon |ma )(.+?)\s+(?:a|pour|vers)\s+(.+)$/.exec(n);
  if (mets && !complex) {
    const when = parseQuickAdd(mets[3], { now: ctx.now });
    const query = cleanEventQuery(mets[2]);
    if (when.hasExplicitTime && !when.hasExplicitDate && query && query.split(" ").length <= 3 && !NOT_TITLE.test(query) && !/\d/.test(query)) {
      return intent("calendar.move", 0.95, { query, hasDate: false, hasTime: true, start: when.start.toISOString(), soft: true }, u, true);
    }
  }

  // ---- create with a verb: "Ajoute dentiste jeudi à 16h", "Note congé vendredi toute la journée"
  const allDayAsked = ALL_DAY_RE.test(n);
  let text = u.text.replace(/\s*(toute la journée|toute la journee|journée entière|journee entiere|journée complète|journee complete)\s*/i, " ").replace(/\s+/g, " ").trim();
  text = text.replace(/^(prévois|prevois|inscris|bloque|cale|programme|planifie|organise)\s+/i, "Ajoute ");
  if (!complex) {
    const quick = quickCreateFromCommand(text, qaOpts);
    if (quick && !NOT_TITLE.test(normalize(quick.title))) {
      if (allDayAsked && !quick.hasExplicitTime) {
        const day = startOfDay(quick.start);
        return intent("calendar.create", 0.94, { quick: { ...quick, allDay: true, start: day, end: addDays(day, 1) }, allDayAsked: true }, u);
      }
      return intent("calendar.create", 0.93, { quick, allDayAsked }, u);
    }
  }

  // ---- create without a verb: "Restaurant vendredi 20h", "Dentiste jeudi à 16h"
  if (!complex && !/^(quand|quel|quelle|qui|quoi|comment|est-ce|est ce|combien|pourquoi|ou)\b/.test(n) && !/\?\s*$/.test(u.raw.trim())) {
    const q = parseQuickAdd(text, qaOpts);
    const words = q.title.split(/\s+/).filter(Boolean);
    if (q.hasExplicitDate && (q.hasExplicitTime || allDayAsked) && words.length >= 1 && words.length <= 4 && !NOT_TITLE.test(normalize(q.title)) && q.title !== "Nouvel événement") {
      const quick = allDayAsked && !q.hasExplicitTime ? { ...q, allDay: true } : q;
      return intent("calendar.create", 0.86, { quick, allDayAsked }, u);
    }
  }
  return null;
}

type Hit = { id: string; title: string; start: string; end?: string; allDay?: boolean; occurrenceStart?: string; location?: string };

async function findEvents(env: RunEnv, query: string, day?: string): Promise<{ action: RouteAction; hits: Hit[] }> {
  const now = env.ctx.now;
  if (!query && day) {
    const d = new Date(day);
    const a = await call(env, "getEvents", { from: localIso(d).slice(0, 10), to: localIso(d).slice(0, 10) });
    return { action: a, hits: ((a.result.data as { events?: Hit[] })?.events ?? []).filter((h) => !h.allDay) };
  }
  const a = await call(env, "searchEvents", { query, from: localIso(addDays(startOfDay(now), -1)) });
  const words = normalize(query).split(/\s+/).filter((w) => w.length > 1);
  let hits = ((a.result.data as { events?: Hit[] })?.events ?? []).filter((h) => {
    const hay = normalize(`${h.title} ${h.location ?? ""}`);
    return words.every((w) => hay.includes(w) || hay.includes(w.replace(/s$/, "")));
  });
  if (day) {
    const ds = new Date(day).toDateString();
    hits = hits.filter((h) => new Date(h.occurrenceStart ?? h.start).toDateString() === ds);
  }
  return { action: a, hits };
}

const label = (h: Hit, now: Date) => {
  const s = new Date(h.occurrenceStart ?? h.start);
  return `${h.title} ${fmtRelativeDay(s, now).toLowerCase()}${h.allDay ? "" : ` à ${fmtTime(s)}`}`;
};

function chooseQuestion(hits: Hit[], now: Date, action: string, extra: Record<string, unknown>, prior: RouteAction[]): RouteOutcome {
  const list = hits.slice(0, 4);
  return {
    text: `Lequel ? ${list.map((h, i) => `${i + 1}) ${label(h, now)}`).join(", ")}.`,
    actions: prior,
    changed: false,
    pending: { domain: "calendar", kind: "eventChoice", data: { action, candidates: list, ...extra } },
  };
}

async function doMove(env: RunEnv, target: Hit, e: { hasDate?: boolean; hasTime?: boolean; start?: string; shiftMin?: number }, prior: RouteAction[]): Promise<RouteOutcome> {
  const now = env.ctx.now;
  const oldStart = new Date(target.occurrenceStart ?? target.start);
  let ns: Date;
  if (e.shiftMin) ns = new Date(oldStart.getTime() + e.shiftMin * 60000);
  else {
    const parsed = new Date(String(e.start));
    ns = new Date(e.hasDate ? parsed : oldStart);
    if (e.hasTime) ns.setHours(parsed.getHours(), parsed.getMinutes(), 0, 0);
    else ns.setHours(oldStart.getHours(), oldStart.getMinutes(), 0, 0);
  }
  const a = await call(env, "moveEvent", { eventId: target.id, newStart: localIso(ns), occurrenceStart: target.occurrenceStart }, "Je déplace…");
  return {
    text: a.result.ok ? `✓ ${target.title} déplacé ${fmtRelativeDay(ns, now).toLowerCase()} à ${fmtTime(ns)}.` : `Je n'ai pas pu déplacer ${target.title} : ${a.result.summary}.`,
    actions: [...prior, a],
    changed: !!a.result.changed,
  };
}

async function doDelete(env: RunEnv, target: Hit, all: boolean, prior: RouteAction[]): Promise<RouteOutcome> {
  const a = await call(env, "deleteEvent", { eventId: target.id, occurrenceStart: target.occurrenceStart, allOccurrences: all || undefined }, "Je supprime…");
  return {
    text: a.result.ok ? `✓ ${label(target, env.ctx.now).replace(/^./, (c) => c.toUpperCase())} supprimé.` : `Je n'ai pas pu supprimer ${target.title} : ${a.result.summary}.`,
    actions: [...prior, a],
    changed: !!a.result.changed,
  };
}

async function doRename(env: RunEnv, target: Hit, title: string, prior: RouteAction[]): Promise<RouteOutcome> {
  const a = await call(env, "updateEvent", { eventId: target.id, title }, "Je modifie…");
  return { text: a.result.ok ? `✓ ${target.title} renommé en ${title}.` : `Je n'ai pas pu modifier ${target.title} : ${a.result.summary}.`, actions: [...prior, a], changed: !!a.result.changed };
}

export const calendarModule: DomainModule = {
  domain: "calendar",

  parse(u, ctx) {
    return parseCalendar(u, ctx);
  },

  async run(p, env) {
    const now = env.ctx.now;
    switch (p.intent) {
      case "calendar.create": {
        const { quick, allDayAsked } = p.entities as { quick: QuickAddResult; allDayAsked: boolean };
        if (!quick.hasExplicitTime && !allDayAsked) {
          return {
            text: `À quelle heure pour « ${quick.title} » ${fmtRelativeDay(new Date(quick.start), now).toLowerCase()} ?`,
            actions: [],
            changed: false,
            pending: { domain: "calendar", kind: "time", data: { quick } },
          };
        }
        return createFromQuick(quick, env);
      }
      case "calendar.next": {
        const a = await call(env, "getEvents", { from: localIso(now), to: localIso(addDays(now, 14)) }, "Je consulte le calendrier…");
        return { text: nextEventText(a.result, now), actions: [a], changed: false };
      }
      case "calendar.today":
      case "calendar.tomorrow":
      case "calendar.day": {
        const day = new Date(String(p.entities.from));
        const a = await call(env, "getEvents", { from: localIso(day).slice(0, 10), to: localIso(day).slice(0, 10) }, "Je consulte le calendrier…");
        return { text: describeDay(a.result, day, now), actions: [a], changed: false };
      }
      case "calendar.range": {
        const from = new Date(String(p.entities.from));
        const to = new Date(String(p.entities.to));
        const a = await call(env, "getEvents", { from: localIso(from).slice(0, 10), to: localIso(to).slice(0, 10) }, "Je consulte le calendrier…");
        return { text: describeRange(a.result, from, to), actions: [a], changed: false };
      }
      case "calendar.search": {
        const { action, hits } = await findEvents(env, String(p.entities.query));
        return { text: eventFoundText(hits, String(p.entities.query), now), actions: [action], changed: false };
      }
      case "calendar.availability": {
        const e = p.entities as { persons: "all" | "me"; from: string; to: string; part: number[] | null; durationMinutes: number; explicit: boolean };
        const from = new Date(e.from);
        const to = e.explicit ? new Date(e.to) : addDays(startOfDay(now), 7);
        const profiles = e.persons === "all" ? env.ctx.profiles.filter((x) => x.type === "PERSON").map((x) => x.id) : env.ctx.currentProfileId ? [env.ctx.currentProfileId] : [];
        const start = from < now ? now : from;
        const args: Record<string, unknown> = {
          profiles,
          from: localIso(start),
          to: localIso(e.explicit && from.toDateString() === to.toDateString() ? addDays(startOfDay(to), 1) : addDays(startOfDay(to), 1)),
          durationMinutes: e.durationMinutes,
        };
        if (e.part) {
          args.dayStartHour = e.part[0];
          args.dayEndHour = e.part[1];
        }
        const a = await call(env, "findAvailability", args, "Je cherche des créneaux libres…");
        return { text: availabilityText(a.result, { together: e.persons === "all" && profiles.length > 1, now, singleDay: e.explicit && from.toDateString() === to.toDateString() ? from : null }), actions: [a], changed: false };
      }
      case "calendar.move":
      case "calendar.delete":
      case "calendar.update": {
        const e = p.entities as { query: string; day?: string; all?: boolean; title?: string; soft?: boolean };
        const { action, hits } = await findEvents(env, e.query, e.day);
        if (!hits.length) {
          const what = e.query ? `« ${e.query} »` : e.day ? `le ${fmtRelativeDay(new Date(e.day), now).toLowerCase()}` : "";
          const tip = e.soft ? ` Pour l'ajouter, dites « Ajoute ${e.query} … ».` : "";
          return { text: `Je ne trouve pas d'événement ${what}.${tip}`, actions: [action], changed: false };
        }
        // same series repeated (recurring): keep the next occurrence only
        const unique = hits.filter((h, i) => hits.findIndex((x) => x.id === h.id) === i);
        if (unique.length > 1) return chooseQuestion(unique, now, p.intent, { entities: p.entities }, [action]);
        const target = unique[0];
        if (p.intent === "calendar.move") return doMove(env, target, p.entities, [action]);
        if (p.intent === "calendar.update") return doRename(env, target, String(e.title), [action]);
        return doDelete(env, target, !!e.all, [action]);
      }
    }
    return { text: "D'accord.", actions: [], changed: false };
  },

  async resume(pending, u, env) {
    if (pending.kind === "eventChoice") {
      const candidates = (pending.data.candidates as Hit[]) ?? [];
      if (CANCEL_RE.test(u.norm)) return { text: "D'accord, je ne touche à rien.", actions: [], changed: false };
      const ordinals = ["premier|premiere|1|un|une", "deuxieme|second|seconde|2|deux", "troisieme|3|trois", "quatrieme|4|quatre"];
      let idx = ordinals.findIndex((o) => new RegExp(`\\b(${o})\\b`).test(u.norm));
      if (idx < 0) {
        const q = parseQuickAdd(u.text, { now: env.ctx.now });
        idx = candidates.findIndex((c) => {
          const s = new Date(c.occurrenceStart ?? c.start);
          if (q.hasExplicitTime && s.getHours() === q.start.getHours() && s.getMinutes() === q.start.getMinutes()) return true;
          if (q.hasExplicitDate && !q.hasExplicitTime && s.toDateString() === q.start.toDateString()) return true;
          return normalize(c.title) === u.norm || (u.norm.length > 2 && normalize(c.title).includes(u.norm));
        });
      }
      const target = candidates[idx];
      if (!target) return null;
      const action = String(pending.data.action);
      const e = (pending.data.entities ?? {}) as { all?: boolean; title?: string };
      if (action === "calendar.move") return doMove(env, target, pending.data.entities as Record<string, unknown>, []);
      if (action === "calendar.update") return doRename(env, target, String(e.title), []);
      return doDelete(env, target, !!e.all, []);
    }

    if (pending.kind !== "time") return null;
    const draft = pending.data.quick as QuickAddResult;
    const start0 = new Date(draft.start);
    if (CANCEL_RE.test(u.norm)) return { text: "D'accord, je n'ajoute rien.", actions: [], changed: false };
    if (ALL_DAY_RE.test(u.norm) || /^(la journee|journee)$/.test(u.norm)) {
      const day = startOfDay(start0);
      return createFromQuick({ ...draft, start: day, end: addDays(day, 1), allDay: true }, env);
    }
    const reply = parseQuickAdd(u.text, { now: env.ctx.now });
    if (!reply.hasExplicitTime) return null;
    const combined = parseQuickAdd(`${draft.title} ${u.text}`, { now: env.ctx.now });
    const start = new Date(start0);
    start.setHours(reply.start.getHours(), reply.start.getMinutes(), 0, 0);
    const end = new Date(start.getTime() + (combined.end.getTime() - combined.start.getTime()));
    return createFromQuick({ ...draft, start, end, allDay: false, hasExplicitTime: true }, env);
  },
};

async function createFromQuick(quick: QuickAddResult, env: RunEnv): Promise<RouteOutcome> {
  const start = new Date(quick.start);
  const end = new Date(quick.end);
  const args: Record<string, unknown> = {
    title: quick.title,
    start: quick.allDay ? localIso(start).slice(0, 10) : localIso(start),
    end: quick.allDay ? undefined : localIso(end),
    allDay: quick.allDay,
    profiles: quick.profileIds,
    location: quick.location?.label,
    type: quick.type,
    recurrence: quick.recurrence
      ? { freq: quick.recurrence.freq, interval: quick.recurrence.interval, weekdays: quick.recurrence.byWeekday?.map(String) }
      : undefined,
  };
  const a = await call(env, "createEvent", args, "J'ajoute l'événement…");
  const who = quick.profileIds
    .map((id) => env.ctx.profiles.find((x) => x.id === id))
    .filter((x) => x && x.id !== env.ctx.currentProfileId)
    .map((x) => (x!.type === "COUPLE" ? "vous deux" : x!.type === "HOUSEHOLD" ? "tout le monde" : x!.name));
  return { text: calendarCreatedText(a.result, { title: quick.title, start, allDay: quick.allDay, who, now: env.ctx.now }), actions: [a], changed: !!a.result.changed };
}
