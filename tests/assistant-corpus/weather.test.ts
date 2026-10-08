import { describe, expect, it } from "vitest";
import { handleUtterance } from "@/assistant/agent";
import { route } from "@/assistant/router/intentRouter";
import { makeAssistant, NOW } from "../helpers/assistant";

const strip = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[?!.]/g, "");
const variants = (p: string) => [p, strip(p), `euh ${strip(p)} stp`];

const a0 = makeAssistant();
const ctx = { now: NOW, profiles: a0.base.profiles, places: a0.base.places, scenes: a0.scenes, currentProfileId: "clement" };

const CASES: [string, string, Record<string, unknown>?][] = [
  ["Quel temps fait-il ?", "weather.now"],
  ["Il fait beau ?", "weather.now"],
  ["Il pleut ?", "weather.now"],
  ["Quelle météo ?", "weather.now"],
  ["Météo", "weather.now"],
  ["Quelle température fait-il ?", "weather.now"],
  ["Il fait combien ?", "weather.now"],
  ["Il fait froid dehors ?", "weather.now"],
  ["Il va pleuvoir ?", "weather.now"],
  ["Météo demain", "weather.date", { dateOnly: true }],
  ["Quel temps samedi ?", "weather.date", { dateOnly: true }],
  ["Il va pleuvoir demain ?", "weather.date"],
  ["Quel temps fera-t-il dimanche ?", "weather.date"],
  ["Il va faire chaud demain ?", "weather.date"],
  ["Les prévisions pour demain", "weather.date"],
  ["Il fera beau samedi ?", "weather.date"],
  ["Il fera combien à Annecy ?", "weather.location", { location: "Annecy" }],
  ["Quel temps à Genève demain ?", "weather.location", { location: "Genève" }],
  ["Météo à Lausanne", "weather.location"],
  ["Il pleut à Paris ?", "weather.location"],
  ["Quel temps fait-il à Zurich ?", "weather.location"],
  ["Est-ce qu'il pleuvra pour mon rendez-vous ?", "weather.event", { eventQuery: "" }],
  ["Quel temps pour mon prochain rendez-vous ?", "weather.event", { eventQuery: "" }],
  ["Il va pleuvoir pour le CrossFit ?", "weather.event", { eventQuery: "crossfit" }],
  ["Météo pour le dentiste", "weather.event", { eventQuery: "dentiste" }],
];

describe("weather corpus (route, no LLM)", () => {
  const all = CASES.flatMap(([p, intent, ent]) => variants(p).map((v) => [v, intent, ent] as const));
  it(`has ≥ 50 phrasings (${all.length})`, () => expect(all.length).toBeGreaterThanOrEqual(50));
  it.each(all)("%s → %s", (phrase, intent, ent) => {
    const r = route(phrase, ctx);
    expect(r.best?.intent).toBe(intent);
    expect(r.execute).toBe(true);
    if (ent) {
      for (const [k, v] of Object.entries(ent)) {
        const got = r.best!.entities[k];
        expect(typeof v === "string" && typeof got === "string" ? got.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "") : got).toEqual(
          typeof v === "string" ? v.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "") : v,
        );
      }
    }
  });
});

describe("not weather", () => {
  it.each([
    "Ajoute pique-nique samedi s'il fait beau",
    "Combien de temps pour y aller ?",
    "Combien de temps reste-t-il ?",
    "Qu'est-ce que j'ai demain ?",
    "Mets de la musique",
    "Ajoute du lait aux courses",
    "Il fait beau, mets ma playlist chill",
  ])("%s", (phrase) => {
    const r = route(phrase, ctx);
    expect(r.candidates.find((c) => c.module.domain === "weather")).toBeUndefined();
  });

  it("'à la maison' is not a city", () => {
    expect(route("Quel temps fait-il à la maison ?", ctx).best?.entities.location).toBeUndefined();
  });
});

describe("weather end-to-end (no LLM)", () => {
  it("now at home", async () => {
    const a = makeAssistant();
    const r = await handleUtterance({ ...a.base, input: "Quel temps fait-il ?" });
    expect(r.metrics?.llmCalls).toBe(0);
    expect(r.text).toBe("En ce moment à Maison : couvert, 14 degrés, 20 % de risque de pluie, vent 10 km/h.");
  });

  it("another city, lower-case voice input", async () => {
    const a = makeAssistant();
    const r = await handleUtterance({ ...a.base, input: "il fera combien a annecy demain" });
    expect(r.actions[0].args.location).toBe("Annecy");
    expect(r.text).toBe("Demain à Annecy : pluie, entre 8 et 16 degrés, 40 % de risque de pluie.");
  });

  it("weather for the next appointment", async () => {
    const a = makeAssistant();
    const r = await handleUtterance({ ...a.base, input: "Est-ce qu'il pleuvra pour mon rendez-vous ?" });
    expect(r.actions.map((x) => x.name)).toEqual(["getEvents", "getWeather"]);
    expect(r.actions[1].args).toEqual({ eventId: "cf" });
    expect(r.text).toBe("Pour CrossFit aujourd'hui à 18h30 : couvert, 14 degrés, 20 % de risque de pluie.");
  });
});
