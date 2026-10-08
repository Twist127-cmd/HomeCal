import { addDays } from "date-fns";
import { normalize } from "@/lib/profiles";
import { parseWeatherQuestion } from "../hints";
import { localIso } from "../executor";
import { call, type DomainModule } from "../router/types";
import { weatherEventResponse, weatherResponse } from "../responses/weather";

/** Weather: weather.now / date / location / event */
export const weatherModule: DomainModule = {
  domain: "weather",

  parse(u, ctx) {
    const w = parseWeatherQuestion(u.text, ctx.now, ctx.places);
    if (!w) return null;
    if (w.eventQuery !== undefined) {
      return { intent: "weather.event", confidence: 0.93, entities: { eventQuery: w.eventQuery }, raw: u.raw };
    }
    const intent = w.location ? "weather.location" : w.dateOnly || w.at.getTime() !== ctx.now.getTime() ? "weather.date" : "weather.now";
    return { intent, confidence: 0.94, entities: { location: w.location, at: w.at.toISOString(), dateOnly: w.dateOnly }, raw: u.raw };
  },

  async run(p, env) {
    const now = env.ctx.now;
    if (p.intent === "weather.event") {
      const q = String(p.entities.eventQuery ?? "");
      const ev = await call(env, "getEvents", { from: localIso(now), to: localIso(addDays(now, 14)) }, "Je regarde la météo…");
      const events = ((ev.result.data as { events?: { id: string; title: string; start: string; allDay?: boolean; location?: string }[] })?.events ?? []).filter(
        (e) => !e.allDay && new Date(e.start) > now,
      );
      const target = q ? events.find((e) => normalize(`${e.title} ${e.location ?? ""}`).includes(normalize(q))) : events[0];
      if (!target) {
        return { text: q ? `Je ne trouve pas d'événement « ${q} » à venir.` : "Aucun rendez-vous à venir dans les deux prochaines semaines.", actions: [ev], changed: false };
      }
      const a = await call(env, "getWeather", { eventId: target.id });
      return { text: weatherEventResponse(a.result, { title: target.title, start: new Date(target.start), now }), actions: [ev, a], changed: false };
    }
    const e = p.entities as { location?: string; at: string; dateOnly: boolean };
    const at = new Date(e.at);
    const args = { location: e.location, date: e.dateOnly ? localIso(at).slice(0, 10) : localIso(at) };
    const a = await call(env, "getWeather", args, "Je regarde la météo…");
    return { text: weatherResponse(a.result, { at, dateOnly: e.dateOnly, now }), actions: [a], changed: false };
  },
};
