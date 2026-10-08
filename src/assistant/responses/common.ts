import type { ToolResult } from "../executor";

/** Deterministic answers: short, natural, built from the ToolResult (never from the LLM). */

export const sentence = (s: string) => (/[.?!]$/.test(s.trim()) ? s.trim() : `${s.trim()}.`);
export const capitalize = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** "lait", "lait et pain", "lait, pain et œufs" */
export function joinFr(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} et ${items[items.length - 1]}`;
}

/** Plural helper: plural(2, "article") → "2 articles" */
export function plural(n: number, word: string, pluralWord = `${word}s`): string {
  return `${n} ${n > 1 ? pluralWord : word}`;
}

/** Generic success / failure answer from a tool result. */
export function fromResult(r: ToolResult, okText?: string): string {
  if (r.ok) return sentence(okText ?? r.summary);
  return sentence(r.summary || "Je n'ai pas pu le faire");
}

/** Error wording when the network / a service is unavailable. */
export function failure(action: string, r: ToolResult): string {
  const why = r.summary && !/^outil inconnu/i.test(r.summary) ? r.summary : "Vérifiez la connexion";
  return sentence(`Je n'ai pas pu ${action}. ${why}`);
}
