import { parseShoppingCommand } from "@/lib/shopping";
import { call, type DomainModule, type ParsedIntent } from "../router/types";
import { shoppingResponse } from "../responses/shopping";

/** Shopping list: shopping.add / remove / complete / uncomplete / list / clearCompleted / clearAll */
export const shoppingModule: DomainModule = {
  domain: "shopping",

  parse(u) {
    const c = parseShoppingCommand(u.text);
    if (!c) return null;
    const base = { raw: u.raw, confidence: 0.95 };
    switch (c.op) {
      case "add":
        return { ...base, intent: "shopping.add", entities: { items: c.items } };
      case "remove":
        return { ...base, intent: "shopping.remove", entities: { names: c.names } };
      case "check":
        return { ...base, intent: "shopping.complete", entities: { names: c.names } };
      case "uncheck":
        return { ...base, intent: "shopping.uncomplete", entities: { names: c.names } };
      case "clearChecked":
        return { ...base, intent: "shopping.clearCompleted", entities: {} };
      case "list":
        return { ...base, intent: "shopping.list", entities: {} };
    }
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
