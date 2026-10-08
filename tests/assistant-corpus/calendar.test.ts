import { describe, expect, it } from "vitest";
import { handleUtterance } from "@/assistant/agent";
import { route } from "@/assistant/router/intentRouter";
import { d } from "../fixtures";
import { makeAssistant, NOW } from "../helpers/assistant";

/** Calendar corpus: each base phrase is tested clean, lower-case without accents (voice), with fillers and politeness. */

const strip = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[?!.]/g, "");
const variants = (p: string) => [p, strip(p), `euh ${strip(p)}`, `HomeCal, ${p} s'il te plaît`];

const a0 = makeAssistant();
const ctx = { now: NOW, profiles: a0.base.profiles, places: a0.base.places, scenes: a0.scenes, currentProfileId: "clement" };

const CASES: [string, string][] = [
  // create
  ["Ajoute dentiste jeudi à 16h", "calendar.create"],
  ["Mets CrossFit demain à 18h30", "calendar.create"],
  ["Restaurant vendredi 20h", "calendar.create"],
  ["Ajoute réunion lundi de 9h à 10h", "calendar.create"],
  ["Note congé vendredi toute la journée", "calendar.create"],
  ["Ajoute un rendez-vous chez le dentiste jeudi à 16h", "calendar.create"],
  ["Rajoute coiffeur samedi à 10h", "calendar.create"],
  ["Planifie réunion lundi à 9h", "calendar.create"],
  ["Prévois piscine dimanche à 11h", "calendar.create"],
  ["Ajoute yoga tous les mardis à 19h", "calendar.create"],
  ["Inscris cours de piano mercredi 17h", "calendar.create"],
  ["Dentiste jeudi 16h", "calendar.create"],
  ["Coiffeur samedi à 10h30", "calendar.create"],
  ["Ajoute dentiste demain", "calendar.create"],
  ["Ajoute apéro vendredi à 19h pour nous deux", "calendar.create"],
  // reads
  ["J'ai quoi aujourd'hui ?", "calendar.today"],
  ["Qu'est-ce que j'ai aujourd'hui ?", "calendar.today"],
  ["C'est quoi le programme aujourd'hui ?", "calendar.today"],
  ["Qu'est-ce qui est prévu aujourd'hui ?", "calendar.today"],
  ["Montre-moi ma journée", "calendar.today"],
  ["Qu'est-ce que j'ai demain ?", "calendar.tomorrow"],
  ["On a quoi demain ?", "calendar.tomorrow"],
  ["Qu'est-ce qu'on fait demain ?", "calendar.tomorrow"],
  ["Il y a quoi demain ?", "calendar.tomorrow"],
  ["J'ai des rendez-vous demain ?", "calendar.tomorrow"],
  ["Que fait-on samedi ?", "calendar.day"],
  ["Qu'est-ce que j'ai vendredi ?", "calendar.day"],
  ["Qu'est-ce qui est prévu le 12 octobre ?", "calendar.day"],
  ["On a quoi ce week-end ?", "calendar.range"],
  ["Qu'est-ce qu'on fait ce week-end ?", "calendar.range"],
  ["Qu'est-ce que j'ai la semaine prochaine ?", "calendar.range"],
  ["C'est quoi mon prochain rendez-vous ?", "calendar.next"],
  ["Quel est mon prochain rendez-vous ?", "calendar.next"],
  ["C'est quand mon prochain rendez-vous ?", "calendar.next"],
  // search
  ["C'est quand le dentiste ?", "calendar.search"],
  ["À quelle heure est la réunion ?", "calendar.search"],
  ["Quand est mon rendez-vous chez le dentiste ?", "calendar.search"],
  // move
  ["Décale le dentiste à 17h", "calendar.move"],
  ["Mets le CrossFit à 19h", "calendar.move"],
  ["Déplace la réunion à demain", "calendar.move"],
  ["Repousse le dentiste d'une heure", "calendar.move"],
  ["Avance la réunion de 30 minutes", "calendar.move"],
  ["Décale le rendez-vous chez le dentiste à vendredi 10h", "calendar.move"],
  ["Reporte la réunion à lundi", "calendar.move"],
  // delete / update
  ["Supprime le dentiste", "calendar.delete"],
  ["Annule le rendez-vous chez le dentiste", "calendar.delete"],
  ["Efface la réunion de vendredi", "calendar.delete"],
  ["Annule le CrossFit", "calendar.delete"],
  ["Renomme le dentiste en orthodontiste", "calendar.update"],
  // availability
  ["Quand sommes-nous libres samedi ?", "calendar.availability"],
  ["Est-ce qu'on est libres demain soir ?", "calendar.availability"],
  ["Quand suis-je libre jeudi ?", "calendar.availability"],
  ["Trouve un créneau libre samedi", "calendar.availability"],
];

describe("calendar corpus (route, no LLM)", () => {
  const all = CASES.flatMap(([p, intent]) => variants(p).map((v) => [v, intent] as const));
  it(`has ≥ 120 phrasings (${all.length})`, () => expect(all.length).toBeGreaterThanOrEqual(120));
  it.each(all)("%s → %s", (phrase, intent) => {
    const r = route(phrase, ctx);
    expect(r.best?.intent).toBe(intent);
    expect(r.execute).toBe(true);
  });
});

describe("calendar entities", () => {
  it("create: title, date, time, all-day, couple", () => {
    const q = route("Ajoute dentiste jeudi à 16h", ctx).best!.entities.quick as { title: string; start: Date; allDay: boolean };
    expect(q.title).toBe("Dentiste");
    expect(new Date(q.start)).toEqual(d(2026, 10, 8, 16));
    const c = route("Note congé vendredi toute la journée", ctx).best!.entities.quick as { title: string; allDay: boolean };
    expect(c.title).toBe("Congé");
    expect(c.allDay).toBe(true);
    const r = route("Restaurant vendredi 20h", ctx).best!;
    expect(r.confidence).toBeLessThan(0.9);
    expect((r.entities.quick as { title: string }).title).toBe("Restaurant");
  });

  it("move: query + time / relative shift", () => {
    expect(route("Décale le dentiste à 17h", ctx).best!.entities).toMatchObject({ query: "dentiste", hasTime: true, hasDate: false });
    expect(route("Repousse le dentiste d'une heure", ctx).best!.entities).toMatchObject({ query: "dentiste", shiftMin: 60 });
    expect(route("Avance la réunion de 30 minutes", ctx).best!.entities).toMatchObject({ query: "reunion", shiftMin: -30 });
    expect(route("Décale le rendez-vous chez le dentiste à vendredi 10h", ctx).best!.entities).toMatchObject({ query: "dentiste", hasDate: true, hasTime: true });
  });

  it("delete: query cleaned and marked destructive", () => {
    const r = route("Annule le rendez-vous chez le dentiste", ctx).best!;
    expect(r.entities.query).toBe("dentiste");
    expect(r.destructive).toBe(true);
    expect(r.confidence).toBeGreaterThanOrEqual(0.95);
  });
});

describe("not calendar", () => {
  it.each([
    "Mets 10 minutes pour le four",
    "Mets Daft Punk",
    "Ajoute du lait aux courses",
    "Mode cuisine",
    "Pause la musique",
    "Minuteur 8 minutes",
    "Rappelle-moi d'appeler maman à 18h",
    "Quand dois-je partir ?",
    "Mets le son à 30 %",
    "Mets 2 bouteilles de lait",
    "Supprime le pain des courses",
    "Annule le minuteur des pâtes",
    "Annule mon rappel",
    "Mets le réveil à 7h",
    "Quel temps fait-il ?",
  ])("%s", (phrase) => {
    const r = route(phrase, ctx);
    expect(r.candidates.find((c) => c.module.domain === "calendar")).toBeUndefined();
  });

  it.each([
    "Organise-moi samedi pour que je puisse faire les courses avant le restaurant",
    "Trouve un moment cette semaine où nous sommes tous libres au moins deux heures",
    "Décale mes rendez-vous de demain pour que j'aie une pause entre midi et deux",
  ])("complex → LLM: %s", (phrase) => {
    expect(route(phrase, ctx).execute).toBe(false);
  });
});

describe("calendar end-to-end (no LLM)", () => {
  it("creates an event and confirms without contradiction", async () => {
    const a = makeAssistant();
    const r = await handleUtterance({ ...a.base, input: "Ajoute coiffeur samedi à 10h" });
    expect(r.actions[0].result.ok).toBe(true);
    expect(r.text).toBe("✓ Coiffeur ajouté samedi 10 octobre à 10h.");
    expect(r.metrics?.llmCalls).toBe(0);
    expect(a.cal.events.some((e) => e.title === "Coiffeur")).toBe(true);
  });

  it("asks the time, then creates with the answer", async () => {
    const a = makeAssistant();
    const q = await handleUtterance({ ...a.base, input: "Ajoute un rendez-vous dentiste demain" });
    expect(q.text).toBe("À quelle heure pour « Dentiste » demain ?");
    const r = await handleUtterance({ ...a.base, input: "16h", pending: q.pending });
    expect(r.text).toBe("✓ Dentiste ajouté demain à 16h.");
  });

  it("all-day without a question", async () => {
    const a = makeAssistant();
    const r = await handleUtterance({ ...a.base, input: "Note congé vendredi toute la journée" });
    expect(r.text).toBe("✓ Congé ajouté vendredi 9 octobre, toute la journée.");
    expect(a.cal.events.find((e) => e.title === "Congé")?.allDay).toBe(true);
  });

  it("moves the dentist to 17h", async () => {
    const a = makeAssistant();
    const r = await handleUtterance({ ...a.base, input: "Décale le dentiste à 17h" });
    expect(r.text).toBe("✓ Dentiste déplacé demain à 17h.");
    expect(new Date(a.cal.events.find((e) => e.id === "dent")!.start)).toEqual(d(2026, 10, 8, 17));
  });

  it("moves with a relative shift and with 'mets le … à'", async () => {
    const a = makeAssistant();
    await handleUtterance({ ...a.base, input: "Repousse la réunion d'une heure" });
    expect(new Date(a.cal.events.find((e) => e.id === "reu")!.start)).toEqual(d(2026, 10, 9, 10));
    const r = await handleUtterance({ ...a.base, input: "Mets le CrossFit à 19h" });
    expect(r.text).toBe("✓ CrossFit déplacé aujourd'hui à 19h.");
  });

  it("unknown event → clear message, nothing created", async () => {
    const a = makeAssistant();
    const n = a.cal.events.length;
    const r = await handleUtterance({ ...a.base, input: "Mets le dîner à 20h" });
    expect(r.text).toMatch(/^Je ne trouve pas d'événement « diner »/);
    expect(a.cal.events.length).toBe(n);
  });

  it("reads tomorrow and the next appointment", async () => {
    const a = makeAssistant();
    expect((await handleUtterance({ ...a.base, input: "Qu'est-ce que j'ai demain ?" })).text).toBe("Demain : Dentiste à 16h.");
    expect((await handleUtterance({ ...a.base, input: "C'est quoi mon prochain rendez-vous ?" })).text).toBe("Prochain rendez-vous : CrossFit, aujourd'hui à 18h30 (CrossFit).");
    expect((await handleUtterance({ ...a.base, input: "C'est quand le dentiste ?" })).text).toBe("Dentiste demain à 16h.");
  });

  it("deletes a unique match directly (undoable)", async () => {
    const a = makeAssistant();
    const r = await handleUtterance({ ...a.base, input: "Supprime le dentiste" });
    expect(r.text).toBe("✓ Dentiste demain à 16h supprimé.");
    expect(a.cal.events.find((e) => e.id === "dent")).toBeUndefined();
    await r.actions.at(-1)!.result.undo!();
    expect(a.cal.events.find((e) => e.id === "dent")).toBeDefined();
  });

  it("several matches → asks which one, then acts on the answer", async () => {
    const a = makeAssistant();
    await a.cal.createEvent({
      title: "Dentiste",
      start: d(2026, 10, 12, 9).toISOString(),
      end: d(2026, 10, 12, 10).toISOString(),
      allDay: false,
      profileIds: ["clement"],
      type: "appointment",
      reminders: [],
      source: "local",
    });
    const q = await handleUtterance({ ...a.base, input: "Supprime le dentiste" });
    expect(q.text).toMatch(/^Lequel \? 1\) Dentiste demain à 16h, 2\) Dentiste lundi 12 octobre à 9h\.$/);
    expect(q.changed).toBe(false);
    expect(a.cal.events.filter((e) => e.title === "Dentiste")).toHaveLength(2);
    const r = await handleUtterance({ ...a.base, input: "le deuxième", pending: q.pending });
    expect(r.changed).toBe(true);
    expect(a.cal.events.filter((e) => e.title === "Dentiste").map((e) => e.id)).toEqual(["dent"]);
  });

  it("availability for the couple, deterministic answer", async () => {
    const a = makeAssistant();
    const r = await handleUtterance({ ...a.base, input: "Quand sommes-nous libres samedi ?" });
    expect(r.actions[0].name).toBe("findAvailability");
    expect(r.text).toMatch(/^Samedi 10 octobre, vous êtes libres de 8h à 22h\.$/);
  });
});
