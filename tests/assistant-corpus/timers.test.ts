import { describe, expect, it } from "vitest";
import { handleUtterance } from "@/assistant/agent";
import { route } from "@/assistant/router/intentRouter";
import { DEFAULT_SCENES } from "@/lib/types";
import { places, profiles } from "../fixtures";
import { makeAssistant, NOW } from "../helpers/assistant";

const ctx = { now: NOW, profiles, places, scenes: DEFAULT_SCENES.map((s, i) => ({ ...s, id: `s${i}` })), currentProfileId: "clement" };
const r = (s: string) => route(s, ctx);
const MIN = 60000;

// ------------------------------------------------------------------ creation corpus (generated + hand-written)

type Create = [string, number, string | undefined]; // phrase, ms, label (undefined = generic)

const DURATIONS: [string, number][] = [
  ["8 minutes", 8 * MIN],
  ["5 min", 5 * MIN],
  ["10 mn", 10 * MIN],
  ["dix minutes", 10 * MIN],
  ["1h20", 80 * MIN],
  ["une heure et demie", 90 * MIN],
  ["90 secondes", 90 * 1000],
  ["2 minutes 30", 150 * 1000],
  ["un quart d'heure", 15 * MIN],
  ["trois quarts d'heure", 45 * MIN],
  ["vingt minutes", 20 * MIN],
  ["30 secondes", 30 * 1000],
];

const TEMPLATES: ((d: string) => string)[] = [
  (d) => `Minuteur ${d}`,
  (d) => `Lance un minuteur de ${d}`,
  (d) => `Mets un minuteur de ${d}`,
  (d) => `minuteur de ${d} stp`,
  (d) => `Chrono ${d}`,
  (d) => `Lance un chrono de ${d}`,
  (d) => `euh mets moi un minuteur ${d} s'il te plaît`,
  (d) => `tu peux lancer un minuteur de ${d}`,
  (d) => `Démarre un timer de ${d}`,
  (d) => `compte à rebours ${d}`,
];

const GENERATED: Create[] = DURATIONS.flatMap(([d, ms]) => TEMPLATES.map((t) => [t(d), ms, undefined] as Create));

const LABELED: Create[] = [
  ["Minuteur 12 minutes pour les pâtes", 12 * MIN, "pâtes"],
  ["Minuteur de 8 minutes pour les œufs", 8 * MIN, "œufs"],
  ["8 minutes pour les pâtes", 8 * MIN, "pâtes"],
  ["Mets 10 minutes pour le four", 10 * MIN, "four"],
  ["10 min pour le riz", 10 * MIN, "riz"],
  ["Lance 20 minutes pour le gâteau", 20 * MIN, "gâteau"],
  ["Minuteur pâtes 9 minutes", 9 * MIN, "pâtes"],
  ["Minuteur des œufs de 6 minutes", 6 * MIN, "œufs"],
  ["minuteur pour le riz de 12 minutes", 12 * MIN, "riz"],
  ["Lance un minuteur de 45 minutes pour la lessive", 45 * MIN, "lessive"],
  ["mets un chrono de 3 minutes pour le thé", 3 * MIN, "thé"],
  ["minuteur 1h pour le rôti", 60 * MIN, "rôti"],
  ["minuteur une heure vingt pour le pain", 80 * MIN, "pain"],
  ["5 minutes pour les brocolis", 5 * MIN, "brocolis"],
  ["euh 7 minutes pour les pates s'il te plait", 7 * MIN, "pates"],
  ["minuteur 15 minutes pour la sieste", 15 * MIN, "sieste"],
  ["Rappelle-moi dans 20 minutes de sortir le linge", 20 * MIN, "Sortir le linge"],
  ["Dans 45 minutes rappelle-moi de sortir le linge", 45 * MIN, "Sortir le linge"],
  ["rappelle moi de sortir le linge dans 20 minutes", 20 * MIN, "Sortir le linge"],
  ["Préviens-moi dans 10 minutes", 10 * MIN, "Rappel"],
  ["Réveille-moi dans 20 minutes", 20 * MIN, "Réveil"],
  ["reveille moi dans une demi-heure", 30 * MIN, "Réveil"],
  ["dans 15 minutes préviens-moi de retourner la viande", 15 * MIN, "Retourner la viande"],
  ["fais moi signe dans 5 minutes", 5 * MIN, "Rappel"],
  ["rappelle-moi dans une heure d'appeler le garage", 60 * MIN, "Appeler le garage"],
  ["alarme dans 25 minutes", 25 * MIN, "Réveil"],
  ["mets 3 minutes", 3 * MIN, undefined],
  ["lance 4 minutes", 4 * MIN, undefined],
  ["Minuteur 8 minutes", 8 * MIN, undefined],
  ["minuteur 25 min", 25 * MIN, undefined],
];

const CREATE: Create[] = [...GENERATED, ...LABELED];

describe(`timer.create corpus (${CREATE.length} phrasings)`, () => {
  it.each(CREATE)("%s", (phrase, ms, label) => {
    const d = r(phrase);
    expect(d.best?.intent).toBe("timer.create");
    expect(d.execute).toBe(true);
    expect(d.best?.entities.durationMs).toBe(ms);
    if (label !== undefined) expect(d.best?.entities.label).toBe(label);
    else expect(["Minuteur", "Réveil", "Rappel"]).toContain(d.best?.entities.label);
  });
});

// ------------------------------------------------------------------ control corpus

const CONTROL: [string, string, Record<string, unknown>?][] = [
  ["Ajoute 2 minutes au minuteur", "timer.extend", { durationMs: 2 * MIN }],
  ["rajoute 5 minutes au minuteur des pâtes", "timer.extend", { durationMs: 5 * MIN, label: "pâtes" }],
  ["encore 3 minutes pour le minuteur", "timer.extend", { durationMs: 3 * MIN }],
  ["prolonge le minuteur de 10 minutes", "timer.extend", { durationMs: 10 * MIN }],
  ["Ajoute 1 minute", "timer.extend", { durationMs: MIN }],
  ["rajoute 30 secondes au chrono", "timer.extend", { durationMs: 30 * 1000 }],
  ["Pause le minuteur", "timer.pause"],
  ["Mets le minuteur en pause", "timer.pause"],
  ["mets en pause le minuteur des pâtes", "timer.pause", { label: "pâtes" }],
  ["suspends le chrono", "timer.pause"],
  ["Reprends le minuteur", "timer.resume"],
  ["relance le minuteur", "timer.resume"],
  ["continue le chrono", "timer.resume"],
  ["reprends le minuteur des œufs", "timer.resume", { label: "œufs" }],
  ["Annule le minuteur des pâtes", "timer.cancel", { label: "pâtes" }],
  ["annule le minuteur", "timer.cancel", { label: undefined }],
  ["arrête le minuteur", "timer.cancel"],
  ["stop le chrono", "timer.cancel"],
  ["supprime le minuteur du four", "timer.cancel", { label: "four" }],
  ["coupe le minuteur", "timer.cancel"],
  ["Annule tous les minuteurs", "timer.cancel", { all: true }],
  ["supprime tous les chronos", "timer.cancel", { all: true }],
  ["Combien de temps reste-t-il ?", "timer.remaining"],
  ["combien de temps reste t il", "timer.remaining"],
  ["il reste combien de temps ?", "timer.remaining"],
  ["il reste combien sur le minuteur", "timer.remaining"],
  ["Combien de temps reste-t-il sur le minuteur des pâtes ?", "timer.remaining", { label: "pâtes" }],
  ["où en est le minuteur ?", "timer.remaining"],
  ["c'est bientôt prêt ?", "timer.remaining"],
  ["Quels minuteurs sont en cours ?", "timer.list"],
  ["liste les minuteurs", "timer.list"],
  ["montre les minuteurs", "timer.list"],
  ["euh annule le minuteur s'il te plaît", "timer.cancel"],
  ["tu peux mettre le chrono en pause stp", "timer.pause"],
];

describe(`timer control corpus (${CONTROL.length} phrasings)`, () => {
  it.each(CONTROL)("%s → %s", (phrase, intent, entities) => {
    const d = r(phrase);
    expect(d.best?.intent).toBe(intent);
    expect(d.execute).toBe(true);
    if (entities) for (const [k, v] of Object.entries(entities)) expect(d.best?.entities[k]).toEqual(v);
  });
});

// ------------------------------------------------------------------ negative cases (other domains)

const NOT_TIMERS = [
  "Pause",
  "Reprends",
  "Pause la musique",
  "Ajoute réunion lundi de 9h à 10h",
  "Réunion de 30 minutes demain",
  "Ajoute dentiste jeudi à 16h",
  "Combien de temps pour y aller ?",
  "Ajoute 6 œufs",
  "Il reste quoi ?",
  "Rappelle-moi d'appeler maman à 18h",
  "Mets ma playlist cuisine",
  "Mode cuisine",
  "Qu'est-ce que j'ai demain ?",
  "Ajoute du lait aux courses",
  "Mets CrossFit demain à 18h30",
  "Ajoute sport de 30 minutes samedi à 10h",
];

describe("not timers", () => {
  it.each(NOT_TIMERS)("%s", (phrase) => {
    const d = r(phrase);
    expect(d.best?.module.domain === "timers" && d.execute).toBe(false);
  });
});

// ------------------------------------------------------------------ end to end (no LLM)

describe("timers end-to-end", () => {
  it("create → remaining → extend → pause → resume → cancel, all without LLM and never contradicting", async () => {
    const a = makeAssistant();
    const say = (input: string) => handleUtterance({ ...a.base, input });

    const c = await say("8 minutes pour les pâtes");
    expect(c.fast).toBe(true);
    expect(c.text).toBe("✓ Minuteur « pâtes » lancé pour 8 min.");
    expect(a.timers).toHaveLength(1);

    const rem = await say("Combien de temps reste-t-il ?");
    expect(rem.text).toBe("Il reste 08:00 pour « pâtes ».");

    await say("Ajoute 2 minutes au minuteur");
    expect(a.timers[0].duration).toBe(10 * MIN);

    const p = await say("Pause le minuteur");
    expect(p.text).toMatch(/^✓ .*en pause\.$/);
    expect(a.timers[0].status).toBe("paused");

    await say("Reprends le minuteur");
    expect(a.timers[0].status).toBe("running");

    const x = await say("Annule le minuteur des pâtes");
    expect(x.text).toMatch(/^✓ Minuteur « pâtes » annulé\.$/);
    expect(a.timers).toHaveLength(0);
  });

  it("successful tool → text never claims failure (non-regression)", async () => {
    const a = makeAssistant();
    for (const [phrase] of LABELED) {
      const res = await handleUtterance({ ...a.base, input: phrase });
      expect(res.actions[0]?.result.ok).toBe(true);
      expect(res.text).not.toMatch(/je ne comprends pas|pas compris|aucun élément|n'ai pas pu/i);
      expect(res.metrics?.llmCalls ?? 0).toBe(0);
    }
  });

  it("controls without any timer answer clearly", async () => {
    const a = makeAssistant();
    expect((await handleUtterance({ ...a.base, input: "Annule le minuteur" })).text).toBe("Aucun minuteur en cours.");
    expect((await handleUtterance({ ...a.base, input: "Combien de temps reste-t-il ?" })).text).toBe("Aucun minuteur en cours.");
  });
});
