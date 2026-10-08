import { parseSceneCommand } from "@/lib/commands";
import { call, type DomainModule } from "../router/types";
import { fromResult } from "../responses/common";

/** Scenes: scene.activate / exit / list */
export const sceneModule: DomainModule = {
  domain: "scenes",

  parse(u, ctx) {
    if (/\b(quelles? (sont les )?scenes|liste des scenes|mes scenes)\b/.test(u.norm)) return { intent: "scene.list", confidence: 0.93, entities: {}, raw: u.raw };
    const c = parseSceneCommand(u.text, ctx.scenes);
    if (!c) return null;
    if (c.op === "activate") return { intent: "scene.activate", confidence: 0.96, entities: { name: c.scene.name }, raw: u.raw };
    if (c.op === "exit") return { intent: "scene.exit", confidence: 0.95, entities: {}, raw: u.raw };
    return { intent: "scene.unknown", confidence: 0.9, entities: { name: c.name }, raw: u.raw };
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
