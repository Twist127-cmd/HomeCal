import { writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { handleUtterance } from "@/assistant/agent";
import { route } from "@/assistant/router/intentRouter";
import { SIMPLE_COMMANDS } from "./baseline.corpus";
import { makeAssistant, NOW } from "./helpers/assistant";
import { places, profiles } from "./fixtures";

/**
 * Latency benchmark of the deterministic path (no network: tools are in-memory).
 * Target (V2 §3): < 300 ms per simple command excluding external calls.
 * Write the report with: $env:LATENCY_OUT="…"; npx vitest run tests/latency.bench.test.ts
 */
describe("latency (deterministic path)", () => {
  it("routes and answers simple commands well under 300 ms", async () => {
    const ctx = { now: NOW, profiles, places, scenes: [], currentProfileId: "clement" };
    const routerTimes: number[] = [];
    const totals: number[] = [];
    for (const input of Object.values(SIMPLE_COMMANDS).flat()) {
      const t = performance.now();
      route(input, ctx);
      routerTimes.push(performance.now() - t);
      const a = makeAssistant();
      const r = await handleUtterance({ ...a.base, input });
      totals.push(r.metrics!.totalMs);
    }
    const p = (xs: number[], q: number) => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(xs.length * q))];
    const report = `LATENCY (n=${totals.length})\nrouter  p50 ${p(routerTimes, 0.5).toFixed(2)} ms  p95 ${p(routerTimes, 0.95).toFixed(2)} ms\ntotal   p50 ${p(totals, 0.5)} ms  p95 ${p(totals, 0.95)} ms  max ${Math.max(...totals)} ms\n`;
    console.log(report);
    if (process.env.LATENCY_OUT) writeFileSync(process.env.LATENCY_OUT, report, "utf8");
    expect(p(totals, 0.95)).toBeLessThan(300);
  });
});
