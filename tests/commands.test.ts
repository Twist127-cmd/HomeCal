import { describe, expect, it } from "vitest";
import { parseMusicCommand, parseNavigationCommand, parseSceneCommand } from "@/lib/commands";
import { DEFAULT_SCENES, type Scene } from "@/lib/types";

const scenes: Scene[] = DEFAULT_SCENES.map((s, i) => ({ ...s, id: `s${i}` }));

describe("parseMusicCommand", () => {
  it.each([
    ["Pause la musique", { op: "pause" }],
    ["Mets Spotify", { op: "resume" }],
    ["Passe à la suivante", { op: "next" }],
    ["Chanson précédente", { op: "previous" }],
    ["Mets le son à 30 %", { op: "volume", value: 30 }],
    ["Baisse le son", { op: "volume", delta: -15 }],
    ["Qu'est-ce qui joue ?", { op: "current" }],
    ["Mets ma playlist Chill", { op: "playlist", name: "Chill" }],
    ["Lance la playlist Morning Chill", { op: "playlist", name: "Morning Chill" }],
    ["Mets quelque chose de calme", { op: "query", query: "calme" }],
    ["Mets du Daft Punk", { op: "query", query: "Daft Punk" }],
    ["Mets Spotify sur l'enceinte du salon", { op: "device", name: "salon" }],
  ])("%s", (input, expected) => expect(parseMusicCommand(input)).toEqual(expected));

  it("ignores calendar, timer and shopping sentences", () => {
    expect(parseMusicCommand("Ajoute dentiste jeudi à 16h")).toBeNull();
    expect(parseMusicCommand("Annule le minuteur")).toBeNull();
    expect(parseMusicCommand("Qu'est-ce que j'ai demain ?")).toBeNull();
  });
});

describe("parseSceneCommand", () => {
  it("activates scenes by name", () => {
    expect(parseSceneCommand("HomeCal, mode cuisine", scenes)).toMatchObject({ op: "activate", scene: { name: "Cuisine" } });
    expect(parseSceneCommand("Passe en mode soirée", scenes)).toMatchObject({ op: "activate", scene: { name: "Soir" } });
    expect(parseSceneCommand("Mode matin", scenes)).toMatchObject({ op: "activate", scene: { name: "Matin" } });
  });
  it("exits and reports unknown scenes", () => {
    expect(parseSceneCommand("Quitte le mode cuisine", scenes)).toEqual({ op: "exit" });
    expect(parseSceneCommand("Mode fête", scenes)).toEqual({ op: "unknown", name: "fete" });
    expect(parseSceneCommand("Ajoute dentiste jeudi", scenes)).toBeNull();
  });
});

describe("parseNavigationCommand", () => {
  it("detects departure questions and route requests", () => {
    expect(parseNavigationCommand("Quand dois-je partir ?")).toEqual({ op: "departure", query: undefined });
    expect(parseNavigationCommand("À quelle heure dois-je partir pour le dentiste ?")).toEqual({ op: "departure", query: "dentiste" });
    expect(parseNavigationCommand("Lance Waze pour mon prochain rendez-vous")).toEqual({ op: "route", app: "waze", query: undefined });
    expect(parseNavigationCommand("Itinéraire vers le CrossFit")).toEqual({ op: "route", app: undefined, query: "CrossFit" });
    expect(parseNavigationCommand("Qu'est-ce que j'ai demain ?")).toBeNull();
  });
});
