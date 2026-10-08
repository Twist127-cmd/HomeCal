import { calendarModule } from "../parsers/calendar";
import { musicModule } from "../parsers/music";
import { navigationModule } from "../parsers/navigation";
import { reminderModule } from "../parsers/reminders";
import { sceneModule } from "../parsers/scenes";
import { shoppingModule } from "../parsers/shopping";
import { timerModule } from "../parsers/timers";
import { weatherModule } from "../parsers/weather";
import { normalizeUtterance, type Utterance } from "./normalize";
import type { DomainModule, ParsedIntent, PendingState, RouteOutcome, RouterContext, RunEnv } from "./types";

/**
 * Deterministic-first intent router.
 *   confidence ≥ 0.90 → execute directly
 *   0.70 – 0.90      → execute only when unambiguous (no close competitor) and not destructive
 *   < 0.70           → LLM fallback
 * Destructive intents (delete, clear, move…) require ≥ 0.95.
 */

export const DOMAINS: DomainModule[] = [timerModule, shoppingModule, sceneModule, navigationModule, reminderModule, musicModule, weatherModule, calendarModule];

export const THRESHOLD_EXECUTE = 0.9;
export const THRESHOLD_VERIFY = 0.7;
export const THRESHOLD_DESTRUCTIVE = 0.95;

export interface RouteDecision {
  utterance: Utterance;
  best: (ParsedIntent & { module: DomainModule }) | null;
  candidates: (ParsedIntent & { module: DomainModule })[];
  execute: boolean;
  /** Domain to restrict the LLM tools to, when falling back */
  domainHint?: string;
  routerMs: number;
}

export function route(input: string, ctx: RouterContext): RouteDecision {
  const t0 = performance.now();
  const utterance = normalizeUtterance(input);
  const candidates: (ParsedIntent & { module: DomainModule })[] = [];
  for (const m of DOMAINS) {
    try {
      const p = m.parse(utterance, ctx);
      if (p) candidates.push({ ...p, module: m });
    } catch {
      /* a parser must never break the assistant */
    }
  }
  candidates.sort((a, b) => b.confidence - a.confidence);
  const best = candidates[0] ?? null;
  let execute = false;
  if (best) {
    const competitor = candidates[1];
    const needed = best.destructive ? THRESHOLD_DESTRUCTIVE : THRESHOLD_EXECUTE;
    if (best.confidence >= needed) execute = true;
    else if (!best.destructive && best.confidence >= THRESHOLD_VERIFY && (!competitor || competitor.confidence < best.confidence - 0.15)) execute = true;
  }
  return {
    utterance,
    best,
    candidates,
    execute,
    domainHint: best && best.confidence >= 0.4 ? best.module.domain : undefined,
    routerMs: Math.round((performance.now() - t0) * 10) / 10,
  };
}

/** Answer to a pending question (handled by the domain that asked it). */
export async function resumePending(pending: PendingState, input: string, env: RunEnv): Promise<RouteOutcome | null> {
  const m = DOMAINS.find((d) => d.domain === pending.domain);
  if (!m?.resume) return null;
  return m.resume(pending, normalizeUtterance(input), env);
}
