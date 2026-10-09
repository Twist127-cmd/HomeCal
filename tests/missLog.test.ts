import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { handleUtterance } from "@/assistant/agent";
import { clearMisses, listMisses, missesAsCorpus } from "@/assistant/missLog";
import { makeAssistant } from "./helpers/assistant";

/** Minimal localStorage for node. */
function installStorage() {
  const data = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
      removeItem: (k: string) => void data.delete(k),
    },
  });
  return data;
}

const fakeLlm = { id: "ollama" as const, model: "fake", health: async () => ({ ok: true }), chat: async () => ({ content: "ok", toolCalls: [] }) };

describe("router miss log", () => {
  beforeEach(() => installStorage());
  afterEach(() => clearMisses());

  it("records nothing outside debug mode", async () => {
    const a = makeAssistant();
    await handleUtterance({ ...a.base, input: "Explique-moi pourquoi le ciel est bleu", llm: fakeLlm });
    expect(listMisses()).toEqual([]);
  });

  it("records LLM fallbacks (not fast-path commands) in debug mode, deduplicated", async () => {
    localStorage.setItem("homecal.debug", "1");
    const a = makeAssistant();
    await handleUtterance({ ...a.base, input: "Ajoute du lait aux courses", llm: fakeLlm });
    await handleUtterance({ ...a.base, input: "Explique-moi pourquoi le ciel est bleu", llm: fakeLlm });
    await handleUtterance({ ...a.base, input: "explique-moi pourquoi le ciel est bleu", llm: null });
    const misses = listMisses();
    expect(misses).toHaveLength(1);
    expect(misses[0]).toMatchObject({ input: "explique-moi pourquoi le ciel est bleu", via: "offline" });
    expect(missesAsCorpus()).toContain('"explique-moi pourquoi le ciel est bleu",');
  });
});
