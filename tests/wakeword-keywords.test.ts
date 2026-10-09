import { describe, expect, it } from "vitest";
import { buildGrammar, matchWakeWord, normalizeHeard } from "@/providers/wakeword/keywords";
import { PorcupineWakeWordProvider } from "@/providers/wakeword/PorcupineWakeWordProvider";

describe("buildGrammar", () => {
  it("always ends with [unk] and has no duplicates", () => {
    for (const s of ["low", "normal", "high"] as const) {
      const g = buildGrammar("HomeCal", s);
      expect(g.at(-1)).toBe("[unk]");
      expect(new Set(g).size).toBe(g.length);
    }
  });
  it("widens with sensitivity", () => {
    const low = buildGrammar("HomeCal", "low");
    const normal = buildGrammar("HomeCal", "normal");
    const high = buildGrammar("HomeCal", "high");
    expect(low).toEqual(["homme cal", "home cal", "[unk]"]);
    expect(normal.length).toBeGreaterThan(low.length);
    expect(high.length).toBeGreaterThan(normal.length);
    expect(normal).toContain("homme calme");
  });
  it("is case/accent insensitive on the keyword and supports other names", () => {
    expect(buildGrammar("homecal")).toEqual(buildGrammar("HomeCal"));
    expect(buildGrammar("Nora")).toContain("nora");
    expect(buildGrammar("Nova")).toContain("no va");
    expect(buildGrammar("Jarvis")).toEqual(["jarvis", "[unk]"]);
  });
});

describe("matchWakeWord", () => {
  it.each([
    ["homme cal", "normal"],
    ["home cal", "low"],
    ["homme calme", "normal"],
    ["hommes cale", "normal"],
    ["[unk] homme cal", "normal"],
    ["Homme Cal", "normal"],
    ["homme quel", "high"],
    ["home car", "high"],
    ["hommes kal", "high"],
  ] as const)("matches %s (%s)", (text, s) => {
    expect(matchWakeWord(text, "HomeCal", s).matched).toBe(true);
  });

  it.each([
    ["comme ça", "high"],
    ["un homme calme", "low"],
    ["home", "high"],
    ["homme", "normal"],
    ["calme", "normal"],
    ["on commence", "high"],
    ["homme qui rit", "high"],
    ["", "normal"],
    ["[unk] [unk]", "normal"],
    ["homme quel", "normal"],
  ] as const)("does not match %s (%s)", (text, s) => {
    expect(matchWakeWord(text, "HomeCal", s).matched).toBe(false);
  });

  it("extracts the words following the wake word", () => {
    expect(matchWakeWord("homme cal ajoute du lait", "HomeCal")).toEqual({ matched: true, trailing: "ajoute du lait" });
    expect(matchWakeWord("homme calme minuteur dix minutes", "HomeCal")).toEqual({ matched: true, trailing: "minuteur dix minutes" });
    expect(matchWakeWord("homme cal [unk] [unk]", "HomeCal")).toEqual({ matched: true, trailing: "" });
    expect(matchWakeWord("hommes kal pause", "HomeCal", "high")).toEqual({ matched: true, trailing: "pause" });
  });

  it("prefers the longest variant", () => {
    expect(matchWakeWord("homme calme", "HomeCal", "normal").trailing).toBe("");
  });

  it("works for other keywords", () => {
    expect(matchWakeWord("nora", "Nora").matched).toBe(true);
    expect(matchWakeWord("no va mets la musique", "Nova")).toEqual({ matched: true, trailing: "mets la musique" });
    expect(matchWakeWord("bonjour", "Milo").matched).toBe(false);
  });

  it("normalizes heard text", () => {
    expect(normalizeHeard("  Homme  CAL [unk] ! ")).toBe("homme cal");
  });
});

describe("PorcupineWakeWordProvider (stub)", () => {
  it("is unsupported and not configured", async () => {
    const p = new PorcupineWakeWordProvider();
    expect(p.isSupported()).toBe(false);
    await expect(p.start()).rejects.toMatchObject({ code: "NOT_CONFIGURED" });
  });
});
