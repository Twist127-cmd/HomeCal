import { parseTimerCommand } from "@/lib/timers";
import { call, type DomainModule } from "../router/types";
import { timerResponse } from "../responses/timers";

/** Timers: timer.create / cancel / pause / resume / extend / list / remaining */
export const timerModule: DomainModule = {
  domain: "timers",

  parse(u) {
    const c = parseTimerCommand(u.text);
    if (!c) return null;
    const base = { raw: u.raw, confidence: 0.95 };
    switch (c.op) {
      case "create":
        return { ...base, intent: "timer.create", entities: { durationMs: c.durationMs, label: c.label } };
      case "cancel":
        return { ...base, intent: "timer.cancel", entities: { label: c.label, all: c.all } };
      case "pause":
        return { ...base, intent: "timer.pause", entities: { label: c.label } };
      case "resume":
        return { ...base, intent: "timer.resume", entities: { label: c.label } };
      case "add":
        return { ...base, intent: "timer.extend", entities: { durationMs: c.durationMs, label: c.label } };
      case "list":
        return { ...base, intent: "timer.list", entities: {} };
    }
  },

  async run(p, env) {
    const e = p.entities as { durationMs?: number; label?: string; all?: boolean };
    const map: Record<string, [string, Record<string, unknown>]> = {
      "timer.create": ["createTimer", { seconds: (e.durationMs ?? 0) / 1000, label: e.label }],
      "timer.cancel": ["cancelTimer", { label: e.label, all: e.all }],
      "timer.pause": ["pauseTimer", { label: e.label }],
      "timer.resume": ["resumeTimer", { label: e.label }],
      "timer.extend": ["addTimeToTimer", { seconds: (e.durationMs ?? 60000) / 1000, label: e.label }],
      "timer.list": ["listTimers", {}],
      "timer.remaining": ["listTimers", {}],
    };
    const [name, args] = map[p.intent] ?? map["timer.list"];
    const a = await call(env, name, args, p.intent === "timer.create" ? "Je lance le minuteur…" : undefined);
    return { text: timerResponse(p.intent, a.result), actions: [a], changed: !!a.result.changed };
  },
};
