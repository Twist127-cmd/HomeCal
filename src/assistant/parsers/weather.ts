import { parseWeatherQuestion } from "../hints";
import { localIso } from "../executor";
import { call, type DomainModule } from "../router/types";
import { weatherResponse } from "../responses/weather";

/** Weather: weather.now / date / location / event */
export const weatherModule: DomainModule = {
  domain: "weather",

  parse(u, ctx) {
    const w = parseWeatherQuestion(u.text, ctx.now, ctx.places);
    if (!w) return null;
    const intent = w.location ? "weather.location" : w.dateOnly || w.at.getTime() !== ctx.now.getTime() ? "weather.date" : "weather.now";
    return { intent, confidence: 0.93, entities: { location: w.location, at: w.at.toISOString(), dateOnly: w.dateOnly }, raw: u.raw };
  },

  async run(p, env) {
    const e = p.entities as { location?: string; at: string; dateOnly: boolean };
    const at = new Date(e.at);
    const args = { location: e.location, date: e.dateOnly ? localIso(at).slice(0, 10) : localIso(at) };
    const a = await call(env, "getWeather", args, "Je regarde la météo…");
    return { text: weatherResponse(a.result, { at, dateOnly: e.dateOnly, now: env.ctx.now }), actions: [a], changed: false };
  },
};
