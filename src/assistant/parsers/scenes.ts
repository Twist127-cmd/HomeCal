import { normalize } from "@/lib/profiles";
import type { Scene } from "@/lib/types";
import type { Utterance } from "../router/normalize";
import { call, type DomainModule } from "../router/types";
import { fromResult } from "../responses/common";

/**
 * Scenes: scene.activate / exit / list (+ scene.unknown for "mode X" with an unknown X).
 * Scene names are matched fuzzily: accents, plural, "soirée" → "Soir", "matinée" → "Matin".
 */

const SYNONYMS: [RegExp, string][] = [
  [/\bsoiree\b/g, "soir"],
  [/\bmatinee\b/g, "matin"],
  [/\breveil\b/g, "matin"],
  [/\brepas\b/g, "cuisine"],
  [/\bcuisiner\b/g, "cuisine"],
];

function canon(s: string): string {
  let c = normalize(s).replace(/[^\p{L}\p{N} ]/gu, " ").replace(/\s+/g, " ").trim();
  for (const [re, v] of SYNONYMS) c = c.replace(re, v);
  return c.replace(/(?<=\w{3})s\b/g, "");
}

export function findScene(name: string, scenes: Scene[]): Scene | undefined {
  const want = canon(name.replace(/^(la |le |l'|les |du |de la |de l'|des )/, ""));
  if (!want) return undefined;
  const list = scenes.map((s) => ({ s, c: canon(s.name) }));
  return (
    list.find((x) => x.c === want)?.s ??
    list.find((x) => x.c.length >= 3 && want.length >= 3 && (x.c.startsWith(want) || want.startsWith(x.c)))?.s ??
    list.find((x) => x.c.length >= 3 && new RegExp(`\\b${x.c}\\b`).test(want))?.s
  );
}

export function parseScene(u: Utterance, scenes: Scene[]): { intent: string; confidence: number; entities: Record<string, unknown> } | null {
  const n = u.norm.replace(/[.,!?]+$/g, "").trim();

  // ---- exit
  if (
    /\b(quitte|quitter|sors|sortir|sort|desactive|ferme|arrete|stoppe|stop|termine|annule)\b.*\b(mode|scene|ambiance)\b/.test(n) ||
    /\b(reviens|revenir|retourne|retour|repasse|remets)\b.*\b(mode normal|calendrier|normal|accueil|ecran principal|agenda)\b/.test(n) ||
    /^(mode normal|mode calendrier|fin du mode|fin de la scene|plus de mode|retour|sortir)$/.test(n)
  ) {
    return { intent: "scene.exit", confidence: 0.95, entities: {} };
  }

  // ---- list
  if (/\b(quelles? (sont les |sont mes )?scenes|liste (des |les )?scenes|mes scenes|quels? (sont les )?modes|scenes disponibles)\b/.test(n)) {
    return { intent: "scene.list", confidence: 0.99, entities: {} }; // explicit wording (beats the "liste" shopping marker)
  }

  // ---- explicit "mode X" / "scène X" / "ambiance X"
  let m = /\b(?:mode|scene|ambiance)\s+(?:de |du |d')?(.+)$/.exec(n);
  if (m) {
    const target = m[1].trim();
    const scene = findScene(target, scenes);
    if (scene) return { intent: "scene.activate", confidence: 0.96, entities: { name: scene.name } };
    // "mode avion", "mode d'emploi"… only treat as a scene request with a scene verb or alone
    if (/^(?:(?:passe|mets|active|lance|bascule|enclenche|demarre)\s+(?:en |le |la |sur )?)?(?:mode|scene|ambiance)\s/.test(n) && !/\b(avion|emploi|silencieux|nuit)\b/.test(target)) {
      return { intent: "scene.unknown", confidence: 0.9, entities: { name: target } };
    }
    return null;
  }

  // ---- "passe en cuisine", "active cuisine", "bascule sur soir"
  m = /^(?:passe|bascule|active|enclenche|lance|mets|demarre)\s+(?:en |sur |le |la |l')?(.+)$/.exec(n);
  if (m) {
    const scene = findScene(m[1], scenes);
    if (scene && canon(m[1]).split(" ").length <= 2) return { intent: "scene.activate", confidence: 0.92, entities: { name: scene.name } };
  }
  return null;
}

export const sceneModule: DomainModule = {
  domain: "scenes",

  parse(u, ctx) {
    const p = parseScene(u, ctx.scenes);
    return p ? { ...p, raw: u.raw } : null;
  },

  async run(p, env) {
    const names = env.ctx.scenes.map((s) => s.name);
    if (p.intent === "scene.list") return { text: names.length ? `Scènes disponibles : ${names.join(", ")}.` : "Aucune scène configurée.", actions: [], changed: false };
    if (p.intent === "scene.unknown") {
      return { text: `Je ne connais pas la scène « ${p.entities.name} ». Scènes disponibles : ${names.join(", ") || "aucune"}.`, actions: [], changed: false };
    }
    const a = p.intent === "scene.exit" ? await call(env, "exitScene", {}) : await call(env, "activateScene", { name: p.entities.name });
    return { text: (a.result.ok ? "✓ " : "") + fromResult(a.result), actions: [a], changed: !!a.result.changed };
  },
};
