import { describe, expect, it } from "vitest";
import { dayPeriod, DEFAULT_HOME_LAYOUT, greeting, parseHomeLayout, reorderWidget } from "@/lib/appearance";

describe("ambiance domestique", () => {
  it.each([[0, "night"], [5, "night"], [6, "morning"], [10, "morning"], [11, "day"], [17, "day"], [18, "evening"], [22, "evening"], [23, "night"]])("respecte la frontière de %i h", (hour, expected) => {
    expect(dayPeriod(Number(hour))).toBe(expected);
  });
  it("salue selon le moment", () => {
    expect(greeting(7)).toBe("Bonjour.");
    expect(greeting(14)).toBe("Bon après-midi.");
    expect(greeting(20)).toBe("Bonne soirée.");
    expect(greeting(2)).toBe("Bonne nuit.");
  });
});

describe("disposition locale de l’accueil", () => {
  it.each([null, "{", "null", "{}"])("restaure les valeurs par défaut pour %s", (raw) => {
    expect(parseHomeLayout(raw)).toEqual(DEFAULT_HOME_LAYOUT);
  });
  it("ignore les doublons et les identifiants inconnus, et complète les widgets manquants", () => {
    const result = parseHomeLayout(JSON.stringify([{ id: "music", visible: false, size: "large" }, { id: "music" }, { id: "unknown" }, { id: "next", size: "large" }]));
    expect(result).toHaveLength(6);
    expect(result[0]).toEqual({ id: "music", visible: false, size: "large" });
    expect(result[1].size).toBe("standard");
    expect(new Set(result.map((w) => w.id)).size).toBe(6);
  });
  it("déplace les cartes sans modifier les valeurs par défaut et conserve la disposition sauvegardée", () => {
    const result = reorderWidget(DEFAULT_HOME_LAYOUT, "house", "next");
    expect(result[0].id).toBe("house");
    expect(DEFAULT_HOME_LAYOUT[0].id).toBe("next");
    expect(parseHomeLayout(JSON.stringify(result))).toEqual(result);
    expect(reorderWidget(result, "next", "next")).toBe(result);
  });
});
