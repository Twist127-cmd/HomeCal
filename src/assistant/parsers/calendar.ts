import { addDays } from "date-fns";
import { fmtRelativeDay, fmtTime, startOfDay } from "@/lib/dates";
import { normalize } from "@/lib/profiles";
import { parseQuickAdd, type QuickAddResult } from "@/lib/quickadd";
import { localIso } from "../executor";
import { quickCreateFromCommand } from "../hints";
import { call, type DomainModule, type RouteOutcome, type RunEnv } from "../router/types";
import { calendarCreatedText, describeDay, nextEventText } from "../responses/calendar";

const ALL_DAY_RE = /\b(toute la journee|journee entiere|journee complete|pas d'heure|sans heure)\b/;
const CANCEL_RE = /^(non|annule|laisse tomber|oublie|stop|rien|pas maintenant)\b/;

/** Calendar: calendar.create / today / tomorrow / day / next / move (others → LLM). */
export const calendarModule: DomainModule = {
  domain: "calendar",

  parse(u, ctx) {
    const n = u.norm;
    const qaOpts = { now: ctx.now, profiles: ctx.profiles, places: ctx.places, currentProfileId: ctx.currentProfileId };

    // ---- reads
    if (/\b(prochain|prochaine)\s+(rendez-vous|rdv|evenement|truc)\b/.test(n) && !/\b(partir|depart|itineraire|waze)\b/.test(n)) {
      return { intent: "calendar.next", confidence: 0.93, entities: {}, raw: u.raw };
    }
    const read = /\b(j'ai quoi|qu'est-ce que j'ai|qu'est ce que j'ai|qu'avons-nous|qu'est-ce qu'on a|que fait-on|on fait quoi|quel est le programme|programme|agenda|planning|qu'est-ce qui est prevu|c'est quoi le programme)\b/.test(n);
    if (read && !/\b(courses|minuteur|musique)\b/.test(n)) {
      const q = parseQuickAdd(u.text, { now: ctx.now });
      const day = q.hasExplicitDate ? startOfDay(q.start) : startOfDay(ctx.now);
      const intent = day.getTime() === startOfDay(ctx.now).getTime() ? "calendar.today" : day.getTime() === startOfDay(addDays(ctx.now, 1)).getTime() ? "calendar.tomorrow" : "calendar.day";
      return { intent, confidence: 0.92, entities: { day: day.toISOString() }, raw: u.raw };
    }

    // ---- move: "décale le dentiste à 17h", "déplace la réunion à demain"
    const mv = /^(?:decale|deplace|repousse|avance|reporte|mets)\s+(?:le |la |l'|les |mon |ma )?(.+?)\s+(?:a|au|pour|vers)\s+(.+)$/.exec(n);
    if (mv && /^(decale|deplace|repousse|avance|reporte)/.test(n)) {
      const when = parseQuickAdd(mv[2], { now: ctx.now });
      if (when.hasExplicitDate || when.hasExplicitTime) {
        return {
          intent: "calendar.move",
          confidence: 0.9,
          destructive: true,
          entities: { query: mv[1], hasDate: when.hasExplicitDate, hasTime: when.hasExplicitTime, start: when.start.toISOString() },
          raw: u.raw,
        };
      }
    }

    // ---- create: "Ajoute dentiste jeudi à 16h"
    const quick = quickCreateFromCommand(u.text, qaOpts);
    if (quick) return { intent: "calendar.create", confidence: 0.93, entities: { quick, allDayAsked: ALL_DAY_RE.test(n) }, raw: u.raw };
    return null;
  },

  async run(p, env) {
    const now = env.ctx.now;
    switch (p.intent) {
      case "calendar.create": {
        const { quick, allDayAsked } = p.entities as { quick: QuickAddResult; allDayAsked: boolean };
        if (!quick.hasExplicitTime && !allDayAsked) {
          return {
            text: `À quelle heure pour « ${quick.title} » ${fmtRelativeDay(quick.start, now).toLowerCase()} ?`,
            actions: [],
            changed: false,
            pending: { domain: "calendar", kind: "time", data: { quick } },
          };
        }
        return createFromQuick(quick, env);
      }
      case "calendar.next": {
        const a = await call(env, "getEvents", { from: localIso(now), to: localIso(addDays(now, 14)) });
        return { text: nextEventText(a.result, now), actions: [a], changed: false };
      }
      case "calendar.today":
      case "calendar.tomorrow":
      case "calendar.day": {
        const day = new Date(String(p.entities.day));
        const a = await call(env, "getEvents", { from: localIso(day).slice(0, 10), to: localIso(day).slice(0, 10) }, "Je consulte le calendrier…");
        return { text: describeDay(a.result, day, now), actions: [a], changed: false };
      }
      case "calendar.move": {
        const e = p.entities as { query: string; hasDate: boolean; hasTime: boolean; start: string };
        const s = await call(env, "searchEvents", { query: e.query, from: localIso(now) });
        const hits = ((s.result.data as { events?: { id: string; title: string; start: string; occurrenceStart?: string }[] })?.events ?? []).filter((h) =>
          normalize(h.title).includes(normalize(e.query).split(" ")[0]),
        );
        if (!hits.length) return { text: `Je ne trouve pas d'événement « ${e.query} ».`, actions: [s], changed: false };
        if (hits.length > 1) {
          return {
            text: `Lequel ? ${hits.slice(0, 3).map((h) => `${h.title} (${h.start.replace("T", " à ")})`).join(", ")}.`,
            actions: [s],
            changed: false,
          };
        }
        const target = hits[0];
        const oldStart = new Date(target.occurrenceStart ?? target.start);
        const parsed = new Date(e.start);
        const ns = new Date(e.hasDate ? parsed : oldStart);
        if (e.hasTime) ns.setHours(parsed.getHours(), parsed.getMinutes(), 0, 0);
        else ns.setHours(oldStart.getHours(), oldStart.getMinutes(), 0, 0);
        const a = await call(env, "moveEvent", { eventId: target.id, newStart: localIso(ns), occurrenceStart: target.occurrenceStart }, "Je déplace…");
        return {
          text: a.result.ok ? `✓ ${target.title} déplacé ${fmtRelativeDay(ns, now).toLowerCase()} à ${fmtTime(ns)}.` : `Je n'ai pas pu déplacer ${target.title} : ${a.result.summary}.`,
          actions: [s, a],
          changed: !!a.result.changed,
        };
      }
    }
    return { text: "D'accord.", actions: [], changed: false };
  },

  async resume(pending, u, env) {
    if (pending.kind !== "time") return null;
    const draft = pending.data.quick as QuickAddResult;
    const start0 = new Date(draft.start);
    if (CANCEL_RE.test(u.norm)) return { text: "D'accord, je n'ajoute rien.", actions: [], changed: false };
    if (ALL_DAY_RE.test(u.norm)) {
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
    .map((x) => x!.name);
  return { text: calendarCreatedText(a.result, { title: quick.title, start, allDay: quick.allDay, who, now: env.ctx.now }), actions: [a], changed: !!a.result.changed };
}
