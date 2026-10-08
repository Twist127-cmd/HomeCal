import { parseNavigationCommand } from "@/lib/commands";
import { call, type DomainModule } from "../router/types";
import { navigationResponse } from "../responses/navigation";

/** Navigation: navigation.open / nextDeparture / travelTime */
export const navigationModule: DomainModule = {
  domain: "navigation",

  parse(u) {
    const c = parseNavigationCommand(u.text);
    if (!c) return null;
    if (c.op === "route") return { intent: "navigation.open", confidence: 0.94, entities: { app: c.app, query: c.query }, raw: u.raw };
    return { intent: "navigation.nextDeparture", confidence: 0.94, entities: { query: c.query }, raw: u.raw };
  },

  async run(p, env) {
    const e = p.entities as { app?: string; query?: string };
    const a =
      p.intent === "navigation.open"
        ? await call(env, "openNavigation", { app: e.app, query: e.query }, "J'ouvre l'itinéraire…")
        : await call(env, "getNextDeparture", { query: e.query }, "Je calcule le trajet…");
    return { text: navigationResponse(p.intent, a.result), actions: [a], changed: false };
  },
};
