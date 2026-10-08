import { describe, expect, it } from "vitest";
import { handleUtterance } from "@/assistant/agent";
import { route } from "@/assistant/router/intentRouter";
import { DEFAULT_SCENES, type Scene } from "@/lib/types";
import { places, profiles } from "../fixtures";
import { makeAssistant, NOW } from "../helpers/assistant";

const scenes: Scene[] = DEFAULT_SCENES.map((s, i) => ({ ...s, id: `s${i}` }));
const ctx = { now: NOW, profiles, places, scenes, currentProfileId: "clement" };

type Row = [string, string, Record<string, unknown>?];

const CORPUS: Row[] = [
  // open
  ["Ouvre Waze", "navigation.open", { app: "waze", query: undefined }],
  ["Lance Waze", "navigation.open", { app: "waze" }],
  ["Waze", "navigation.open", { app: "waze" }],
  ["Ouvre Waze s'il te plaît", "navigation.open", { app: "waze" }],
  ["Ouèze", "navigation.open", { app: "waze" }],
  ["Lance Waze pour mon prochain rendez-vous", "navigation.open", { app: "waze", query: undefined }],
  ["Ouvre Waze pour aller au CrossFit", "navigation.open", { app: "waze" }],
  ["Lance Google Maps", "navigation.open", { app: "google" }],
  ["Ouvre Google Maps", "navigation.open", { app: "google" }],
  ["Ouvre Maps", "navigation.open", { app: "google" }],
  ["Ouvre Plans", "navigation.open", { app: "apple" }],
  ["Lance Apple Plans", "navigation.open", { app: "apple" }],
  ["Lance l'itinéraire", "navigation.open", { query: undefined }],
  ["Itinéraire", "navigation.open"],
  ["Itinéraire vers le CrossFit", "navigation.open", { query: "CrossFit" }],
  ["Itinéraire pour le dentiste", "navigation.open", { query: "dentiste" }],
  ["Emmène-moi au prochain rendez-vous", "navigation.open", { query: undefined }],
  ["Emmène-moi au CrossFit", "navigation.open", { query: "CrossFit" }],
  ["Guide-moi jusqu'au CrossFit", "navigation.open", { query: "CrossFit" }],
  ["Lance la navigation", "navigation.open"],
  ["Ouvre le GPS", "navigation.open"],
  ["euh lance l'itinéraire stp", "navigation.open"],
  ["Tu peux ouvrir Waze ?", "navigation.open", { app: "waze" }],
  // departure
  ["Quand dois-je partir ?", "navigation.nextDeparture", { query: undefined }],
  ["À quelle heure je pars ?", "navigation.nextDeparture", { query: undefined }],
  ["À quelle heure dois-je partir ?", "navigation.nextDeparture"],
  ["Je pars quand ?", "navigation.nextDeparture"],
  ["Quand faut-il partir ?", "navigation.nextDeparture"],
  ["Quand est-ce que je dois partir ?", "navigation.nextDeparture"],
  ["Heure de départ ?", "navigation.nextDeparture"],
  ["Quand dois-je partir pour mon prochain rendez-vous ?", "navigation.nextDeparture", { query: undefined }],
  ["À quelle heure dois-je partir pour le dentiste ?", "navigation.nextDeparture", { query: "dentiste" }],
  ["Quand dois-je partir pour le CrossFit ?", "navigation.nextDeparture", { query: "CrossFit" }],
  ["On part quand ?", "navigation.nextDeparture"],
  ["Vers quelle heure je dois partir ?", "navigation.nextDeparture"],
  ["Je dois partir à quelle heure ?", "navigation.nextDeparture"],
  // travel time
  ["Combien de temps pour y aller ?", "navigation.travelTime", { query: undefined }],
  ["Combien de temps de trajet ?", "navigation.travelTime"],
  ["Il faut combien de temps pour aller au CrossFit ?", "navigation.travelTime", { query: "CrossFit" }],
  ["Temps de trajet pour le dentiste ?", "navigation.travelTime", { query: "dentiste" }],
  ["C'est à combien de temps ?", "navigation.travelTime"],
  ["Combien de temps pour aller au CrossFit ?", "navigation.travelTime", { query: "CrossFit" }],
];

const NEGATIVE = ["Combien de temps reste-t-il sur le minuteur ?", "Ouvre Spotify", "Mets ma playlist cuisine", "Qu'est-ce que j'ai demain ?", "Ajoute dentiste jeudi à 16h", "Quel temps fait-il ?"];

describe("navigation corpus (router)", () => {
  it("has ≥ 40 phrasings", () => expect(CORPUS.length).toBeGreaterThanOrEqual(40));

  it.each(CORPUS)("%s → %s", (phrase, intent, entities) => {
    const d = route(phrase, ctx);
    expect(d.best?.intent).toBe(intent);
    expect(d.execute).toBe(true);
    if (entities) expect(d.best?.entities).toMatchObject(entities);
  });

  it.each(NEGATIVE)("not navigation: %s", (phrase) => {
    const d = route(phrase, ctx);
    expect(d.execute && d.best?.module.domain === "navigation").toBe(false);
  });
});

describe("navigation end-to-end (no LLM)", () => {
  it("next departure", async () => {
    const a = makeAssistant();
    const r = await handleUtterance({ ...a.base, input: "Quand dois-je partir pour mon prochain rendez-vous ?" });
    expect(r.text).toBe("Pour CrossFit à 18h30, partez à 18h08 (12 min de trajet).");
    expect(r.metrics?.llmCalls).toBe(0);
  });

  it("travel time focuses on the duration", async () => {
    const a = makeAssistant();
    const r = await handleUtterance({ ...a.base, input: "Combien de temps pour y aller ?" });
    expect(r.text).toBe("Il faut 12 min pour aller à CrossFit (départ conseillé 18h08).");
  });

  it("opens Waze with coordinates", async () => {
    const a = makeAssistant();
    const r = await handleUtterance({ ...a.base, input: "Ouvre Waze" });
    expect(a.opened[0]).toBe("https://waze.com/ul?ll=46.5225,6.6165&navigate=yes");
    expect(r.text).toBe("🚗 Itinéraire vers CrossFit ouvert.");
  });

  it("Google Maps link", async () => {
    const a = makeAssistant();
    await handleUtterance({ ...a.base, input: "Lance Google Maps" });
    expect(a.opened[0]).toContain("https://www.google.com/maps/dir/?api=1&destination=46.5225,6.6165");
  });
});
