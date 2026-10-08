import { parseShoppingUtterance } from "@/lib/shopping";
import { call, type DomainModule, type ParsedIntent } from "../router/types";
import { shoppingResponse } from "../responses/shopping";

/**
 * Shopping list: shopping.add / remove / complete / uncomplete / list / clearCompleted.
 *
 * Parsing is done on `u.norm` (synonym verbs + list markers + food/household lexicon,
 * scored), item names are restored with accents from `u.text`.
 * "Vider toute la liste" (clearAll) is deliberately NOT a fast path: it is destructive and
 * there is no dedicated tool, so it is left to the LLM / the UI.
 */
export const shoppingModule: DomainModule = {
  domain: "shopping",

  parse(u) {
    const s = parseShoppingUtterance(u.norm, u.text, u.raw);
    if (!s) return null;
    return {
      intent: s.intent,
      confidence: s.confidence,
      destructive: s.destructive,
      entities: { items: s.items, names: s.names },
      raw: u.raw,
    };
  },

  async run(p: ParsedIntent, env) {
    const e = p.entities as { items?: { name: string; quantity?: string }[]; names?: string[] };
    let a;
    switch (p.intent) {
      case "shopping.add":
        a = await call(env, "addShoppingItem", { items: (e.items ?? []).map((i) => (i.quantity ? `${i.quantity} ${i.name}` : i.name)) }, "J'ajoute aux courses…");
        break;
      case "shopping.remove":
        a = await call(env, "removeShoppingItem", { items: e.names ?? [] });
        break;
      case "shopping.complete":
        a = await call(env, "completeShoppingItem", { items: e.names ?? [] });
        break;
      case "shopping.uncomplete":
        a = await call(env, "uncompleteShoppingItem", { items: e.names ?? [] });
        break;
      case "shopping.clearCompleted":
        a = await call(env, "clearCompletedShoppingItems", {});
        break;
      default:
        a = await call(env, "getShoppingList", {});
    }
    return { text: shoppingResponse(p.intent, a.result), actions: [a], changed: !!a.result.changed };
  },
};
