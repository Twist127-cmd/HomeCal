import { describe, expect, it } from "vitest";
import { handleUtterance } from "@/assistant/agent";
import { SIMPLE_COMMANDS } from "./baseline.corpus";
import { makeAssistant } from "./helpers/assistant";

const FAILURE_WORDING = /(je ne comprends pas|pas compris|aucun (élément|article)|n'ai pas pu|impossible)/i;
const ALL = Object.values(SIMPLE_COMMANDS).flat();

describe("assistant quality (fast paths)", () => {
  it.each(ALL)("never contradicts a successful action: %s", async (input) => {
    const a = makeAssistant();
    const r = await handleUtterance({ ...a.base, input });
    const succeeded = r.actions.some((x) => x.result.ok && x.result.changed);
    if (succeeded) expect(r.text).not.toMatch(FAILURE_WORDING);
    // a modification is never applied twice in one request
    const sigs = r.actions.filter((x) => x.result.changed).map((x) => `${x.name}:${JSON.stringify(x.args)}`);
    expect(new Set(sigs).size).toBe(sigs.length);
  });

  it("the critical V2 example: shopping add answers success with 0 LLM call", async () => {
    const a = makeAssistant();
    let llmCalls = 0;
    const r = await handleUtterance({
      ...a.base,
      input: "Ajoute du lait aux courses",
      llm: { id: "ollama", model: "x", health: async () => ({ ok: true }), chat: async () => (llmCalls++, { content: "Je n'ai pas compris", toolCalls: [] }) },
    });
    expect(llmCalls).toBe(0);
    expect(a.shopping.map((s) => s.name)).toEqual(["Lait"]);
    expect(r.actions[0].result.ok).toBe(true);
    expect(r.text).not.toMatch(FAILURE_WORDING);
    expect(r.metrics).toMatchObject({ fastPath: true, llmCalls: 0, intent: "shopping.add" });
  });

  it("LLM path: a successful tool is confirmed deterministically (no 2nd LLM call, no contradiction)", async () => {
    const a = makeAssistant();
    const script = [
      { content: "", toolCalls: [{ name: "createEvent", arguments: { title: "Pique-nique", start: "2026-10-10T12:00" } }] },
      { content: "Je n'ai pas compris votre demande.", toolCalls: [] },
    ];
    let calls = 0;
    const r = await handleUtterance({
      ...a.base,
      input: "Organise un pique-nique samedi midi avec tout le monde au bord du lac si possible",
      llm: { id: "ollama", model: "x", health: async () => ({ ok: true }), chat: async () => (calls++, script.shift()!) },
    });
    expect(calls).toBe(1);
    expect(r.text).toMatch(/^✓/);
    expect(r.text).not.toMatch(FAILURE_WORDING);
    expect(a.cal.events.some((e) => e.title === "Pique-nique")).toBe(true);
  });
});
