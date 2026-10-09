import { writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { handleUtterance } from "@/assistant/agent";
import { assistantSession } from "@/assistant/session";
import { SIMPLE_COMMANDS } from "./baseline.corpus";
import { BLIND_COMMANDS, EVERYDAY_COMMANDS, LLM_EXPECTED, type CorpusEntry } from "./everyday.corpus";
import { makeAssistant } from "./helpers/assistant";

/**
 * Coverage benchmark: share of commands answered without the LLM, and with the RIGHT intent.
 * A fake LLM records every call; a command "falls into the LLM" when it is called.
 * Run: npx vitest run tests/coverage.bench.test.ts   (COVERAGE_OUT=file to save the report)
 */

async function runOne(input: string) {
  assistantSession.reset();
  const a = makeAssistant();
  let llmCalls = 0;
  const r = await handleUtterance({
    ...a.base,
    input,
    llm: {
      id: "ollama",
      model: "fake",
      health: async () => ({ ok: true }),
      chat: async () => {
        llmCalls++;
        return { content: "ok", toolCalls: [] };
      },
    },
  });
  return { llmCalls, intent: r.metrics?.intent };
}

const intentOk = (got: string | undefined, want: string) => !!got && (want.endsWith(".") ? got.startsWith(want) : got === want);

describe("fast-path coverage (no LLM)", () => {
  it("reports coverage per domain", async () => {
    const report: Record<string, { total: number; noLlm: number; misses: string[]; wrong: string[] }> = {};
    const all: Record<string, CorpusEntry[]> = { ...SIMPLE_COMMANDS, ...EVERYDAY_COMMANDS, ...BLIND_COMMANDS };
    for (const [domain, entries] of Object.entries(all)) {
      const r = (report[domain] = { total: entries.length, noLlm: 0, misses: [] as string[], wrong: [] as string[] });
      for (const e of entries) {
        const [p, want] = typeof e === "string" ? [e, undefined] : e;
        const { llmCalls, intent } = await runOne(p);
        if (llmCalls > 0) r.misses.push(p);
        else if (want && !intentOk(intent, want)) r.wrong.push(`${p} → ${intent ?? "?"} (attendu ${want})`);
        else r.noLlm++;
      }
    }
    const overreach: string[] = [];
    for (const p of LLM_EXPECTED) {
      const { llmCalls, intent } = await runOne(p);
      if (llmCalls === 0) overreach.push(`${p} → ${intent ?? "?"}`);
    }
    const lines = Object.entries(report).map(
      ([d, r]) =>
        `${d.padEnd(13)} ${String(Math.round((r.noLlm / r.total) * 100)).padStart(3)} %  (${r.noLlm}/${r.total})` +
        (r.misses.length ? `\n    LLM: ${r.misses.join(" | ")}` : "") +
        (r.wrong.length ? `\n    FAUX: ${r.wrong.join(" | ")}` : ""),
    );
    const total = Object.values(report).reduce((s, r) => s + r.total, 0);
    const ok = Object.values(report).reduce((s, r) => s + r.noLlm, 0);
    const text =
      `FAST-PATH COVERAGE (sans LLM et bonne intention)\n${lines.join("\n")}\nTOTAL         ${Math.round((ok / total) * 100)} % (${ok}/${total})\n` +
      `COMPLEXES gardés pour le LLM: ${LLM_EXPECTED.length - overreach.length}/${LLM_EXPECTED.length}${overreach.length ? `\n    DÉBORDEMENT: ${overreach.join(" | ")}` : ""}\n`;
    console.log(text);
    if (process.env.COVERAGE_OUT) writeFileSync(process.env.COVERAGE_OUT, text, "utf8");
    expect(total).toBeGreaterThan(0);
    // falling back to the LLM is acceptable; executing the WRONG intent is not
    expect(Object.values(report).flatMap((r) => r.wrong)).toEqual([]);
    expect(overreach).toEqual([]);
  });
});
