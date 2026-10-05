import { describe, expect, it } from "vitest";
import { clampToDay, fmtDuration, fmtRange, fmtRelativeDay, fmtTime, inTimeWindow, viewRange } from "@/lib/dates";
import { layoutDay } from "@/lib/layout";
import { dateHints, detectIntent, parseWeatherQuestion, quickCreateFromCommand } from "@/assistant/hints";
import { d, places, profiles } from "./fixtures";

describe("dates", () => {
  it("formats French times", () => {
    expect(fmtTime(d(2026, 10, 1, 16, 0))).toBe("16h");
    expect(fmtTime(d(2026, 10, 1, 9, 5))).toBe("9h05");
    expect(fmtRange(d(2026, 10, 1, 16), d(2026, 10, 1, 17, 30))).toBe("16h – 17h30");
    expect(fmtDuration(95)).toBe("1 h 35");
    expect(fmtDuration(40)).toBe("40 min");
  });

  it("relative days", () => {
    const now = d(2026, 10, 1, 10);
    expect(fmtRelativeDay(d(2026, 10, 1, 18), now)).toBe("Aujourd'hui");
    expect(fmtRelativeDay(d(2026, 10, 2), now)).toBe("Demain");
    expect(fmtRelativeDay(d(2026, 10, 5), now)).toBe("Lundi 5 octobre");
  });

  it("week range starts on Monday", () => {
    const r = viewRange("week", d(2026, 10, 1));
    expect(r.start).toEqual(d(2026, 9, 28));
    expect(r.end.getDate()).toBe(4);
  });

  it("night window wrapping midnight", () => {
    expect(inTimeWindow(d(2026, 10, 1, 23, 0), "22:30", "06:30")).toBe(true);
    expect(inTimeWindow(d(2026, 10, 1, 5, 0), "22:30", "06:30")).toBe(true);
    expect(inTimeWindow(d(2026, 10, 1, 12, 0), "22:30", "06:30")).toBe(false);
    expect(inTimeWindow(d(2026, 10, 1, 13, 0), "12:00", "14:00")).toBe(true);
  });

  it("clamps multi-day events to a day", () => {
    const c = clampToDay(d(2026, 10, 1, 22), d(2026, 10, 2, 2), d(2026, 10, 2));
    expect(c).toEqual({ start: d(2026, 10, 2), end: d(2026, 10, 2, 2) });
    expect(clampToDay(d(2026, 10, 1, 9), d(2026, 10, 1, 10), d(2026, 10, 2))).toBeNull();
  });
});

describe("layoutDay", () => {
  const h = (x: number) => d(2026, 10, 1, x).getTime();
  it("puts overlapping events side by side", () => {
    const l = layoutDay([
      { item: "a", start: h(9), end: h(11) },
      { item: "b", start: h(10), end: h(12) },
      { item: "c", start: h(13), end: h(14) },
    ]);
    const by = Object.fromEntries(l.map((x) => [x.item, x]));
    expect(by.a.cols).toBe(2);
    expect(by.b.col).toBe(1);
    expect(by.c.cols).toBe(1);
    expect(by.c.col).toBe(0);
  });
  it("reuses free columns", () => {
    const l = layoutDay([
      { item: "a", start: h(9), end: h(12) },
      { item: "b", start: h(9), end: h(10) },
      { item: "c", start: h(10), end: h(11) },
    ]);
    const by = Object.fromEntries(l.map((x) => [x.item, x]));
    expect(by.c.col).toBe(1);
    expect(by.a.cols).toBe(2);
  });
});

describe("assistant hints", () => {
  const now = d(2026, 9, 30, 10); // Wednesday
  it("resolves weekdays, demain and times", () => {
    const h = dateHints("Déplace le dentiste de jeudi à vendredi 9h", now);
    expect(h).toContain("« jeudi » = jeudi 2026-10-01");
    expect(h).toContain("« vendredi » = vendredi 2026-10-02");
    expect(h).toContain("« 9h » = 09:00");
    expect(dateHints("demain soir", now)).toEqual(["« demain soir » = jeudi 2026-10-01 (18:00–23:00)"]);
    expect(dateHints("après-demain", now)).toEqual(["« apres-demain » = vendredi 2026-10-02"]);
  });

  it("resolves week-end and samedi après-midi", () => {
    expect(dateHints("ce week-end", now)[0]).toContain("samedi 2026-10-03");
    expect(dateHints("samedi après-midi", now)[0]).toBe("« samedi apres-midi » = samedi 2026-10-03 (13:00–18:00)");
  });

  it("parses weather questions with any city", () => {
    expect(parseWeatherQuestion("Quel temps fera-t-il à Genève demain ?", now)).toEqual({ location: "Genève", at: d(2026, 10, 1), dateOnly: true });
    expect(parseWeatherQuestion("Météo sur Saint-Maurice samedi après-midi", now)).toMatchObject({ location: "Saint-Maurice", at: d(2026, 10, 3, 14), dateOnly: false });
    expect(parseWeatherQuestion("Va-t-il pleuvoir à La Chaux-de-Fonds ?", now)?.location).toBe("La Chaux-de-Fonds");
    expect(parseWeatherQuestion("Il fera beau au crossfit jeudi ?", now, places)?.location).toBe("CrossFit");
    expect(parseWeatherQuestion("Quelle météo demain ?", now)).toEqual({ location: undefined, at: d(2026, 10, 1), dateOnly: true });
    expect(parseWeatherQuestion("Quel temps fait-il ?", now)?.at).toEqual(now);
    expect(parseWeatherQuestion("Ajoute pique-nique samedi s'il fait beau", now)).toBeNull();
    expect(parseWeatherQuestion("Qu'est-ce que j'ai demain ?", now)).toBeNull();
  });

  it("detects intents", () => {
    expect(detectIntent("Supprime le dentiste")).toBe("delete");
    expect(detectIntent("Décale le yoga à 20h")).toBe("move");
    expect(detectIntent("Ajoute piscine samedi")).toBe("create");
    expect(detectIntent("Qu'est-ce que j'ai demain ?")).toBe("query");
  });

  it("fast path handles simple create commands", () => {
    const r = quickCreateFromCommand("Ajoute coiffeur vendredi à 10h", { now, profiles, places, currentProfileId: "clement" });
    expect(r?.title).toBe("Coiffeur");
    expect(r?.start).toEqual(d(2026, 10, 2, 10));
    const r2 = quickCreateFromCommand("Ajoute un rendez-vous chez le dentiste jeudi à 16h", { now, profiles, places });
    expect(r2?.title).toBe("Dentiste");
    expect(quickCreateFromCommand("Qu'est-ce que j'ai demain ?", { now, profiles, places })).toBeNull();
    expect(quickCreateFromCommand("Ajoute quelque chose", { now, profiles, places })).toBeNull();
  });
});
