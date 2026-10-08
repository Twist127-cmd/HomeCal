import { describe, expect, it } from "vitest";
import { handleUtterance } from "@/assistant/agent";
import { route } from "@/assistant/router/intentRouter";
import { DEFAULT_SCENES, type Scene } from "@/lib/types";
import { places, profiles } from "../fixtures";
import { makeAssistant, NOW } from "../helpers/assistant";

const scenes: Scene[] = [...DEFAULT_SCENES.map((s, i) => ({ ...s, id: `s${i}` })), { ...DEFAULT_SCENES[0], id: "s9", name: "Apéro", icon: "🍹", order: 9 }];
const ctx = { now: NOW, profiles, places, scenes, currentProfileId: "clement" };

type Row = [string, string, string?];

const CORPUS: Row[] = [
  // activate
  ["Mode cuisine", "scene.activate", "Cuisine"],
  ["mode cuisine", "scene.activate", "Cuisine"],
  ["HomeCal, mode cuisine", "scene.activate", "Cuisine"],
  ["Passe en mode cuisine", "scene.activate", "Cuisine"],
  ["Passe en cuisine", "scene.activate", "Cuisine"],
  ["Active la scène cuisine", "scene.activate", "Cuisine"],
  ["Active le mode cuisine", "scene.activate", "Cuisine"],
  ["Lance la scène cuisine", "scene.activate", "Cuisine"],
  ["Mets le mode cuisine", "scene.activate", "Cuisine"],
  ["Scène cuisine", "scene.activate", "Cuisine"],
  ["euh mode cuisine s'il te plaît", "scene.activate", "Cuisine"],
  ["Tu peux passer en mode cuisine ?", "scene.activate", "Cuisine"],
  ["Bascule en mode cuisine", "scene.activate", "Cuisine"],
  ["Mode repas", "scene.activate", "Cuisine"],
  ["Mets le mode matin", "scene.activate", "Matin"],
  ["Mode matin", "scene.activate", "Matin"],
  ["Passe en mode matin", "scene.activate", "Matin"],
  ["Active la scène du matin", "scene.activate", "Matin"],
  ["Mode matinée", "scene.activate", "Matin"],
  ["Passe en matin", "scene.activate", "Matin"],
  ["Mode réveil", "scene.activate", "Matin"],
  ["Mode soir", "scene.activate", "Soir"],
  ["Passe en mode soirée", "scene.activate", "Soir"],
  ["Mode soirée", "scene.activate", "Soir"],
  ["Active le mode soir", "scene.activate", "Soir"],
  ["Ambiance soirée", "scene.activate", "Soir"],
  ["Mets l'ambiance du soir", "scene.activate", "Soir"],
  ["Passe en soirée", "scene.activate", "Soir"],
  ["Mode apéro", "scene.activate", "Apéro"],
  ["Active la scène apéro", "scene.activate", "Apéro"],
  ["Mode apero", "scene.activate", "Apéro"],
  // exit
  ["Quitte le mode cuisine", "scene.exit"],
  ["Quitte le mode", "scene.exit"],
  ["Sors du mode cuisine", "scene.exit"],
  ["Sortir de la scène", "scene.exit"],
  ["Désactive le mode soir", "scene.exit"],
  ["Reviens au mode normal", "scene.exit"],
  ["Mode normal", "scene.exit"],
  ["Retour au calendrier", "scene.exit"],
  ["Reviens au calendrier", "scene.exit"],
  ["Ferme la scène", "scene.exit"],
  ["Arrête le mode cuisine", "scene.exit"],
  ["Fin du mode", "scene.exit"],
  ["Retourne à l'accueil", "scene.exit"],
  // list
  ["Quelles sont les scènes ?", "scene.list"],
  ["Liste des scènes", "scene.list"],
  ["Quels sont les modes ?", "scene.list"],
  // unknown
  ["Mode fête", "scene.unknown"],
  ["Passe en mode cinéma", "scene.unknown"],
];

const NEGATIVE = ["Passe à la suivante", "Passe la musique sur la cuisine", "Mets ma playlist cuisine", "Ajoute dentiste jeudi à 16h", "Mode avion", "Qu'est-ce que j'ai ce soir ?", "Mets 10 minutes pour le four"];

describe("scenes corpus (router)", () => {
  it("has ≥ 40 phrasings", () => expect(CORPUS.length).toBeGreaterThanOrEqual(40));

  it.each(CORPUS)("%s → %s %s", (phrase, intent, name) => {
    const d = route(phrase, ctx);
    expect(d.best?.intent).toBe(intent);
    expect(d.execute).toBe(true);
    if (name) expect(d.best?.entities.name).toBe(name);
  });

  it.each(NEGATIVE)("not a scene: %s", (phrase) => {
    const d = route(phrase, ctx);
    expect(d.execute && d.best?.module.domain === "scenes").toBe(false);
  });
});

describe("scenes end-to-end (no LLM)", () => {
  it("activates and exits a scene", async () => {
    const a = makeAssistant();
    const r = await handleUtterance({ ...a.base, input: "Passe en cuisine" });
    expect(r.text).toBe("✓ Mode Cuisine activé.");
    expect(a.state.activeScene?.name).toBe("Cuisine");
    expect(r.metrics?.llmCalls).toBe(0);
    const r2 = await handleUtterance({ ...a.base, input: "Reviens au mode normal" });
    expect(r2.text).toBe("✓ Mode Cuisine désactivé.");
    expect(a.state.activeScene).toBeNull();
  });

  it("unknown scene lists the available ones", async () => {
    const a = makeAssistant();
    const r = await handleUtterance({ ...a.base, input: "Mode fête" });
    expect(r.text).toMatch(/Je ne connais pas la scène « fete ».*Matin, Cuisine, Soir/);
  });

  it("lists the scenes", async () => {
    const a = makeAssistant();
    const r = await handleUtterance({ ...a.base, input: "Quelles sont les scènes ?" });
    expect(r.text).toBe("Scènes disponibles : Matin, Cuisine, Soir.");
  });
});
