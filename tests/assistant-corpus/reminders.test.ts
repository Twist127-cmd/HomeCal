import { describe, expect, it } from "vitest";
import { handleUtterance } from "@/assistant/agent";
import { route } from "@/assistant/router/intentRouter";
import { DEFAULT_SCENES } from "@/lib/types";
import { d, places, profiles } from "../fixtures";
import { makeAssistant, NOW } from "../helpers/assistant";

/** NOW = Wednesday 7 October 2026, 18:00 */
const ctx = { now: NOW, profiles, places, scenes: DEFAULT_SCENES.map((s, i) => ({ ...s, id: `s${i}` })), currentProfileId: "clement" };
const r = (s: string) => route(s, ctx);

// phrase, expected text, expected date (local)
const CREATE: [string, string, Date][] = [
  ["Rappelle-moi d'appeler maman à 19h", "Appeler maman", d(2026, 10, 7, 19)],
  ["Rappelle-moi d'appeler maman à 18h", "Appeler maman", d(2026, 10, 8, 18)], // 18h already passed → tomorrow
  ["rappelle moi d'appeler maman a 19h", "Appeler maman", d(2026, 10, 7, 19)],
  ["Rappelle-moi à 19h d'appeler maman", "Appeler maman", d(2026, 10, 7, 19)],
  ["Rappelle-moi demain à 9h de prendre le dossier", "Prendre le dossier", d(2026, 10, 8, 9)],
  ["Rappelle-moi de prendre le dossier demain à 9h", "Prendre le dossier", d(2026, 10, 8, 9)],
  ["rappelle moi demain a 9h30 de prendre le dossier", "Prendre le dossier", d(2026, 10, 8, 9, 30)],
  ["Préviens-moi à 20h de sortir le chien", "Sortir le chien", d(2026, 10, 7, 20)],
  ["previens moi a 20h de sortir le chien", "Sortir le chien", d(2026, 10, 7, 20)],
  ["Préviens-moi à 17h de sortir le chien", "Sortir le chien", d(2026, 10, 8, 17)],
  ["Fais-moi penser à acheter du pain à 19h", "Acheter du pain", d(2026, 10, 7, 19)],
  ["fais moi penser a rappeler le garage demain a 10h", "Rappeler le garage", d(2026, 10, 8, 10)],
  ["Rappelle-moi vendredi à 14h d'appeler le notaire", "Appeler le notaire", d(2026, 10, 9, 14)],
  ["Rappelle-moi samedi à 10h de faire le plein", "Faire le plein", d(2026, 10, 10, 10)],
  ["Rappelle-moi lundi à 8h d'envoyer le dossier", "Envoyer le dossier", d(2026, 10, 12, 8)],
  ["Rappelle-moi le 12 octobre à 9h de payer la facture", "Payer la facture", d(2026, 10, 12, 9)],
  ["euh rappelle moi d'arroser les plantes à 21h s'il te plaît", "Arroser les plantes", d(2026, 10, 7, 21)],
  ["tu peux me rappeler de fermer les volets à 22h", "Fermer les volets", d(2026, 10, 7, 22)],
  ["Rappelle-nous de réserver le restaurant demain à 11h", "Réserver le restaurant", d(2026, 10, 8, 11)],
  ["Mets un rappel à 19h pour appeler maman", "Appeler maman", d(2026, 10, 7, 19)],
  ["Mets-moi un rappel demain à 8h pour le dentiste", "Dentiste", d(2026, 10, 8, 8)],
  ["Crée un rappel à 20h30 pour sortir les poubelles", "Sortir les poubelles", d(2026, 10, 7, 20, 30)],
  ["Ajoute un rappel demain à 7h pour prendre les médicaments", "Prendre les médicaments", d(2026, 10, 8, 7)],
  ["Rappelle-moi ce soir à 21h de lancer la machine", "Lancer la machine", d(2026, 10, 7, 21)],
  ["Rappelle-moi demain matin de prendre le dossier", "Prendre le dossier", d(2026, 10, 8, 9)],
  ["n'oublie pas de me rappeler d'appeler Paul à 19h", "Appeler Paul", d(2026, 10, 7, 19)],
  ["Rappelle-moi d'appeler maman à 19h stp", "Appeler maman", d(2026, 10, 7, 19)],
  ["Rappelle moi jeudi a 16h de récupérer les clés", "Récupérer les clés", d(2026, 10, 8, 16)],
  ["Préviens-moi demain à midi de commander le gâteau", "Commander le gâteau", d(2026, 10, 8, 12)],
  ["Rappelle-moi à 19h45 de regarder le match", "Regarder le match", d(2026, 10, 7, 19, 45)],
];

const ASK_TIME: [string, string][] = [
  ["Rappelle-moi demain de prendre le dossier", "Prendre le dossier"],
  ["Rappelle-moi d'appeler le garage", "Appeler le garage"],
  ["Rappelle-moi vendredi de payer le loyer", "Payer le loyer"],
  ["fais moi penser à acheter des timbres", "Acheter des timbres"],
  ["préviens moi demain de sortir les poubelles", "Sortir les poubelles"],
];

const CONTROL: [string, string, Record<string, unknown>?][] = [
  ["Annule mon rappel", "reminder.cancel", { text: undefined }],
  ["annule le rappel", "reminder.cancel", { text: undefined }],
  ["Annule le rappel de maman", "reminder.cancel", { text: "Maman" }],
  ["supprime le rappel du dentiste", "reminder.cancel", { text: "Dentiste" }],
  ["efface mon dernier rappel", "reminder.cancel", { text: undefined }],
  ["Quels sont mes rappels ?", "reminder.list"],
  ["mes rappels", "reminder.list"],
  ["liste mes rappels", "reminder.list"],
  ["j'ai des rappels ?", "reminder.list"],
  ["montre mes rappels", "reminder.list"],
];

describe(`reminder.create corpus (${CREATE.length})`, () => {
  it.each(CREATE)("%s", (phrase, text, at) => {
    const dd = r(phrase);
    expect(dd.best?.intent).toBe("reminder.create");
    expect(dd.execute).toBe(true);
    expect(dd.best?.entities.text).toBe(text);
    expect(new Date(String(dd.best?.entities.at))).toEqual(at);
  });
});

describe(`reminders asking for the time (${ASK_TIME.length})`, () => {
  it.each(ASK_TIME)("%s", (phrase, text) => {
    const dd = r(phrase);
    expect(dd.best?.intent).toBe("reminder.create");
    expect(dd.execute).toBe(true);
    expect(dd.best?.entities.text).toBe(text);
    expect(dd.best?.entities.at).toBeNull();
  });
});

describe(`reminder control corpus (${CONTROL.length})`, () => {
  it.each(CONTROL)("%s → %s", (phrase, intent, entities) => {
    const dd = r(phrase);
    expect(dd.best?.intent).toBe(intent);
    expect(dd.execute).toBe(true);
    if (entities) for (const [k, v] of Object.entries(entities)) expect(dd.best?.entities[k]).toEqual(v);
  });
});

describe("not reminders", () => {
  it.each([
    "Rappelle-moi dans 20 minutes de sortir le linge", // timer
    "Préviens-moi 30 minutes avant", // needs an event → LLM
    "Ajoute dentiste jeudi à 16h",
    "Pense à acheter du lait",
    "Rappelle maman",
  ])("%s", (phrase) => {
    const dd = r(phrase);
    expect(dd.best?.module.domain === "reminders" && dd.execute).toBe(false);
  });

  it("'Rappelle-moi dans 20 minutes…' is a timer", () => {
    expect(r("Rappelle-moi dans 20 minutes de sortir le linge").best?.intent).toBe("timer.create");
  });
});

describe("reminders end-to-end (no LLM)", () => {
  it("creates a reminder with a deterministic confirmation", async () => {
    const a = makeAssistant();
    const res = await handleUtterance({ ...a.base, input: "Rappelle-moi d'appeler maman à 19h" });
    expect(res.metrics?.llmCalls).toBe(0);
    expect(res.text).toBe("✓ Rappel « Appeler maman » à 19h.");
    expect(a.reminders).toHaveLength(1);
    expect(new Date(a.reminders[0].at)).toEqual(d(2026, 10, 7, 19));
  });

  it("asks the time, then completes the draft", async () => {
    const a = makeAssistant();
    const q = await handleUtterance({ ...a.base, input: "Rappelle-moi demain de prendre le dossier" });
    expect(q.text).toBe("À quelle heure pour « Prendre le dossier » ?");
    expect(q.pending).toMatchObject({ domain: "reminders", kind: "time" });
    const res = await handleUtterance({ ...a.base, input: "à 9h", pending: q.pending });
    expect(res.text).toBe("✓ Rappel « Prendre le dossier » demain à 9h.");
    expect(new Date(a.reminders[0].at)).toEqual(d(2026, 10, 8, 9));
    expect(res.metrics?.llmCalls).toBe(0);
  });

  it("time asked for today, answer already passed → tomorrow", async () => {
    const a = makeAssistant();
    const q = await handleUtterance({ ...a.base, input: "Rappelle-moi d'appeler le garage" });
    await handleUtterance({ ...a.base, input: "17h", pending: q.pending });
    expect(new Date(a.reminders[0].at)).toEqual(d(2026, 10, 8, 17));
  });

  it("cancel / list", async () => {
    const a = makeAssistant();
    await handleUtterance({ ...a.base, input: "Rappelle-moi d'appeler maman à 19h" });
    await handleUtterance({ ...a.base, input: "Rappelle-moi de sortir le chien à 20h" });
    const list = await handleUtterance({ ...a.base, input: "Quels sont mes rappels ?" });
    expect(list.text).toBe("Appeler maman à 19h, Sortir le chien à 20h.");
    const c = await handleUtterance({ ...a.base, input: "Annule le rappel de maman" });
    expect(c.text).toBe("✓ Rappel « Appeler maman » annulé.");
    expect(a.reminders.map((x) => x.text)).toEqual(["Sortir le chien"]);
    const c2 = await handleUtterance({ ...a.base, input: "Annule mon rappel" });
    expect(c2.text).toBe("✓ Rappel « Sortir le chien » annulé.");
    expect((await handleUtterance({ ...a.base, input: "Annule mon rappel" })).text).toBe("Aucun rappel à annuler.");
  });

  it("several reminders + vague cancel → asks which one", async () => {
    const a = makeAssistant();
    await handleUtterance({ ...a.base, input: "Rappelle-moi d'appeler maman à 19h" });
    await handleUtterance({ ...a.base, input: "Rappelle-moi de sortir le chien à 20h" });
    a.reminders.forEach(() => {}); // two reminders
    const q = await handleUtterance({ ...a.base, input: "Annule le rappel" });
    // latest=true cancels the last upcoming one deterministically
    expect(q.actions[0].result.ok).toBe(true);
    expect(q.text).not.toMatch(/pas compris|n'ai pas pu/i);
  });
});
