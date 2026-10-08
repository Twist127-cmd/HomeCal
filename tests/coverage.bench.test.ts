import { writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { handleUtterance } from "@/assistant/agent";
import { SIMPLE_COMMANDS } from "./baseline.corpus";
import { makeAssistant } from "./helpers/assistant";

/**
 * Coverage benchmark: share of simple commands answered without the LLM.
 * A fake LLM records every call; a command "falls into the LLM" when it is called.
 * Run: npx vitest run tests/coverage.bench.test.ts
 */
describe("fast-path coverage (no LLM)", () => {
  it("reports coverage per domain", async () => {
    const report: Record<string, { total: number; noLlm: number; misses: string[] }> = {};
    for (const [domain, phrases] of Object.entries(SIMPLE_COMMANDS)) {
      report[domain] = { total: phrases.length, noLlm: 0, misses: [] };
      for (const p of phrases) {
        const a = makeAssistant();
        let llmCalls = 0;
        await handleUtterance({
          ...a.base,
          input: p,
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
        if (llmCalls === 0) report[domain].noLlm++;
        else report[domain].misses.push(p);
      }
    }
    const lines = Object.entries(report).map(([d, r]) => `${d.padEnd(11)} ${String(Math.round((r.noLlm / r.total) * 100)).padStart(3)} %  (${r.noLlm}/${r.total})${r.misses.length ? `  misses: ${r.misses.join(" | ")}` : ""}`);
    const total = Object.values(report).reduce((s, r) => s + r.total, 0);
    const ok = Object.values(report).reduce((s, r) => s + r.noLlm, 0);
    const text = `FAST-PATH COVERAGE\n${lines.join("\n")}\nTOTAL       ${Math.round((ok / total) * 100)} % (${ok}/${total})\n`;
    console.log(text);
    if (process.env.COVERAGE_OUT) writeFileSync(process.env.COVERAGE_OUT, text, "utf8");
    expect(total).toBeGreaterThan(0);
  });
});
