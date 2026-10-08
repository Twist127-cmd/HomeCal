import type { ToolResult } from "../executor";
import { capitalize, failure, fromResult, joinFr, sentence } from "./common";

/** Deterministic answers for the shopping list. */
export function shoppingResponse(intent: string, r: ToolResult): string {
  const d = (r.data ?? {}) as { added?: string[]; removed?: string[]; items?: (string | { name: string })[] };
  if (!r.ok) {
    if (intent === "shopping.add") return failure("ajouter aux courses", r);
    return fromResult(r);
  }
  switch (intent) {
    case "shopping.add": {
      const names = (d.added ?? []).map((n) => n.toLowerCase());
      if (!names.length) return sentence(r.summary); // already on the list
      return `✓ ${capitalize(joinFr(names))} ${names.length > 1 ? "ajoutés" : "ajouté"} aux courses.`;
    }
    case "shopping.remove": {
      const names = (d.removed ?? []).map((n) => n.toLowerCase());
      return `✓ ${capitalize(joinFr(names))} ${names.length > 1 ? "retirés" : "retiré"} de la liste.`;
    }
    case "shopping.complete": {
      const names = (d.items ?? []).map((n) => (typeof n === "string" ? n : n.name).toLowerCase());
      return `✓ ${capitalize(joinFr(names))} ${names.length > 1 ? "cochés" : "coché"}.`;
    }
    case "shopping.uncomplete": {
      const names = (d.items ?? []).map((n) => (typeof n === "string" ? n : n.name).toLowerCase());
      return `✓ ${capitalize(joinFr(names))} ${names.length > 1 ? "remis" : "remis"} sur la liste.`;
    }
    default:
      return sentence(r.summary);
  }
}
