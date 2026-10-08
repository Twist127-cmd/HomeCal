import { describe, expect, it } from "vitest";
import { addTime, findTimer, formatRemaining, isExpired, newTimer, parseDuration, parseTimerCommand, pauseTimer, remainingMs, resumeTimer } from "@/lib/timers";
import type { Timer } from "@/lib/types";

const T0 = Date.UTC(2026, 9, 8, 7, 0, 0);
const mk = (over: Partial<Timer> = {}): Timer => ({ id: "t1", ...newTimer("Pâtes", 10 * 60000, T0), ...over });

describe("timer state", () => {
  it("computes remaining time from expiresAt (survives refresh)", () => {
    const t = mk();
    expect(remainingMs(t, T0 + 60000)).toBe(9 * 60000);
    expect(isExpired(t, T0 + 10 * 60000)).toBe(true);
    expect(remainingMs(t, T0 + 11 * 60000)).toBe(0);
  });

  it("pause / resume keeps the remaining time", () => {
    const t = mk();
    const paused = { ...t, ...pauseTimer(t, T0 + 4 * 60000) } as Timer;
    expect(paused.status).toBe("paused");
    expect(remainingMs(paused, T0 + 30 * 60000)).toBe(6 * 60000);
    const resumed = { ...paused, ...resumeTimer(paused, T0 + 20 * 60000) } as Timer;
    expect(new Date(resumed.expiresAt).getTime()).toBe(T0 + 26 * 60000);
  });

  it("adds time (+1 min) and restarts a finished timer", () => {
    const t = mk();
    expect(new Date((addTime(t, 60000, T0) as Timer).expiresAt).getTime()).toBe(T0 + 11 * 60000);
    const done = mk({ status: "done" });
    const restarted = addTime(done, 5 * 60000, T0 + 20 * 60000);
    expect(restarted.status).toBe("running");
    expect(new Date(restarted.expiresAt!).getTime()).toBe(T0 + 25 * 60000);
  });

  it("cancelled timers have no remaining time", () => {
    expect(remainingMs(mk({ status: "cancelled" }), T0)).toBe(0);
  });

  it("formats remaining time", () => {
    expect(formatRemaining(8 * 60000 + 42000)).toBe("08:42");
    expect(formatRemaining(3725000)).toBe("1:02:05");
  });

  it("finds a timer by label or the latest active one", () => {
    const a = mk({ id: "a", label: "Pâtes", createdAt: "2026-10-08T07:00:00Z" });
    const b = mk({ id: "b", label: "Four", createdAt: "2026-10-08T07:05:00Z" });
    expect(findTimer([a, b], "pates")?.id).toBe("a");
    expect(findTimer([a, b])?.id).toBe("b");
  });
});

describe("parseDuration", () => {
  it.each([
    ["12 minutes", 12 * 60000],
    ["5 min", 5 * 60000],
    ["1h30", 90 * 60000],
    ["1 heure et demie", 90 * 60000],
    ["2 heures", 120 * 60000],
    ["30 secondes", 30000],
    ["un quart d'heure", 15 * 60000],
    ["dix minutes", 10 * 60000],
    ["1 minute 30", 90000],
  ])("%s", (s, ms) => expect(parseDuration(s)?.ms).toBe(ms));
});

describe("parseTimerCommand", () => {
  it("creates timers from natural sentences", () => {
    expect(parseTimerCommand("HomeCal, minuteur 12 minutes pour les pâtes")).toEqual({ op: "create", durationMs: 12 * 60000, label: "pâtes" });
    expect(parseTimerCommand("Lance un minuteur de 5 minutes")).toEqual({ op: "create", durationMs: 5 * 60000, label: "Minuteur" });
    expect(parseTimerCommand("Minuteur de 8 minutes pour les œufs")).toEqual({ op: "create", durationMs: 8 * 60000, label: "œufs" });
    expect(parseTimerCommand("Réveille-moi dans 20 minutes")).toEqual({ op: "create", durationMs: 20 * 60000, label: "Réveil" });
    expect(parseTimerCommand("Dans 45 minutes rappelle-moi de sortir le linge")).toEqual({ op: "create", durationMs: 45 * 60000, label: "sortir le linge" });
  });

  it("controls existing timers", () => {
    expect(parseTimerCommand("Annule le minuteur des pâtes")).toEqual({ op: "cancel", label: "pâtes" });
    expect(parseTimerCommand("Annule tous les minuteurs")).toEqual({ op: "cancel", all: true });
    expect(parseTimerCommand("Mets le minuteur en pause")?.op).toBe("pause");
    expect(parseTimerCommand("Reprends le minuteur")?.op).toBe("resume");
    expect(parseTimerCommand("Ajoute 2 minutes au minuteur")).toEqual({ op: "add", durationMs: 2 * 60000, label: undefined });
    expect(parseTimerCommand("Combien de temps reste-t-il sur le minuteur ?")).toEqual({ op: "list" });
  });

  it("ignores unrelated sentences", () => {
    expect(parseTimerCommand("Ajoute dentiste jeudi à 16h")).toBeNull();
    expect(parseTimerCommand("Réunion de 30 minutes demain")).toBeNull();
  });
});
