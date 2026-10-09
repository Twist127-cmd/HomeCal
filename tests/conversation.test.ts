import { beforeEach, describe, expect, it } from "vitest";
import { handleUtterance } from "@/assistant/agent";
import { matchConversation } from "@/assistant/conversation";
import { assistantSession } from "@/assistant/session";
import { makeAssistant } from "./helpers/assistant";

const failingLlm = {
  id: "ollama" as const,
  model: "fake",
  health: async () => ({ ok: true }),
  chat: async () => {
    throw new Error("LLM must not be called");
  },
};

beforeEach(() => assistantSession.reset());

describe("matchConversation", () => {
  it.each([
    ["Répète", "repeat"],
    ["Tu peux répéter ?", "repeat"],
    ["J'ai pas entendu", "repeat"],
    ["Je n'ai pas compris ce que tu as dit", "repeat"],
    ["Pardon ?", "repeat"],
    ["euh quoi ?", "repeat"],
    ["Plus lentement s'il te plaît", "slower"],
    ["Annule ce que tu viens de faire", "undo"],
    ["Quelle heure est-il ?", "time"],
    ["On est quel jour ?", "date"],
    ["Merci beaucoup", "thanks"],
    ["Bonjour", "greet"],
    ["Laisse tomber", "dismiss"],
    ["Tais-toi", "silence"],
  ])("%s → %s", (input, intent) => {
    expect(matchConversation(input)).toBe(intent);
  });

  it.each(["Le pain c'est bon", "Annule le dentiste", "Annule le minuteur des pâtes", "Répète le minuteur de 5 minutes", "Comment aller chez Marie ?", "Mets du lait"])(
    "ignores domain sentence: %s",
    (input) => {
      expect(matchConversation(input)).toBeNull();
    },
  );
});

describe("conversational layer in handleUtterance", () => {
  it("repeats the last answer without the LLM", async () => {
    const a = makeAssistant();
    const first = await handleUtterance({ ...a.base, input: "Ajoute du lait aux courses", llm: failingLlm });
    const again = await handleUtterance({ ...a.base, input: "J'ai pas entendu", llm: failingLlm });
    expect(again.text).toBe(first.text);
    expect(again.fast).toBe(true);
    expect(again.speech?.force).toBe(true);
    expect(a.shopping).toHaveLength(1); // nothing executed twice
  });

  it("repeats a pending question and keeps it alive", async () => {
    const a = makeAssistant();
    const pending = { domain: "calendar", kind: "time", data: { title: "Dentiste" } };
    assistantSession.setLastAnswer("À quelle heure ?");
    const r = await handleUtterance({ ...a.base, input: "Pardon ?", pending, llm: failingLlm });
    expect(r.text).toBe("À quelle heure ?");
    expect(r.pending).toEqual(pending);
  });

  it("falls back to the history when the session is empty", async () => {
    const a = makeAssistant();
    const r = await handleUtterance({ ...a.base, history: [{ role: "assistant", text: "Il fait 14 degrés." }], input: "Répète", llm: failingLlm });
    expect(r.text).toBe("Il fait 14 degrés.");
  });

  it("speaks slower on request", async () => {
    const a = makeAssistant();
    assistantSession.setLastAnswer("Demain : Dentiste à 16h.");
    const r = await handleUtterance({ ...a.base, input: "Plus lentement", llm: failingLlm });
    expect(r.text).toBe("Demain : Dentiste à 16h.");
    expect(r.speech?.rate).toBeLessThan(1);
  });

  it("undoes the previous command", async () => {
    const a = makeAssistant();
    await handleUtterance({ ...a.base, input: "Ajoute du lait aux courses", llm: failingLlm });
    expect(a.shopping).toHaveLength(1);
    const r = await handleUtterance({ ...a.base, input: "Annule ce que tu viens de faire", llm: failingLlm });
    expect(r.text).toMatch(/annulé/);
    expect(a.shopping).toHaveLength(0);
    const twice = await handleUtterance({ ...a.base, input: "Annule la dernière action", llm: failingLlm });
    expect(twice.text).toMatch(/rien à annuler/);
  });

  it("answers time and date deterministically", async () => {
    const a = makeAssistant();
    expect((await handleUtterance({ ...a.base, input: "Quelle heure est-il ?", llm: failingLlm })).text).toBe("Il est 18 heures.");
    expect((await handleUtterance({ ...a.base, input: "On est quel jour ?", llm: failingLlm })).text).toBe("Nous sommes le mercredi 7 octobre 2026.");
  });

  it("stays silent on « tais-toi » and keeps the previous answer for « répète »", async () => {
    const a = makeAssistant();
    assistantSession.setLastAnswer("Il fait 14 degrés.");
    const r = await handleUtterance({ ...a.base, input: "Tais-toi", llm: failingLlm });
    expect(r.speech?.silent).toBe(true);
    expect((await handleUtterance({ ...a.base, input: "Répète", llm: failingLlm })).text).toBe("Il fait 14 degrés.");
  });

  it("cancels a pending question on « laisse tomber »", async () => {
    const a = makeAssistant();
    const r = await handleUtterance({ ...a.base, input: "Laisse tomber", pending: { domain: "reminders", kind: "time", data: {} }, llm: failingLlm });
    expect(r.pending).toBeUndefined();
    expect(r.actions).toHaveLength(0);
  });
});
