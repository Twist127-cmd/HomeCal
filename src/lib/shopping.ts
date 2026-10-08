import { normalize } from "./profiles";
import type { ShoppingItem } from "./types";

/** Shopping list helpers: French parsing ("Ajoute du lait et six œufs aux courses") and matching. */

const NUMBER_WORDS: Record<string, string> = {
  un: "1", une: "1", deux: "2", trois: "3", quatre: "4", cinq: "5", six: "6", sept: "7", huit: "8", neuf: "9", dix: "10", douze: "12", vingt: "20",
};

export interface ParsedItem {
  name: string;
  quantity?: string;
}

const ARTICLE = /^(?:du|de la|de l'|des|de|d'|le|la|les|l'|un|une|quelques|encore)\s+/i;
const UNITS = String.raw`(?:kg|g|grammes?|kilos?|l|litres?|cl|ml|paquets?|boites?|boîtes?|bouteilles?|pots?|sachets?|tranches?|barquettes?|douzaines?)`;

/** "six œufs" → {name: "œufs", quantity: "6"}; "2 kg de pommes" → {name: "pommes", quantity: "2 kg"}. */
export function parseItem(raw: string): ParsedItem | null {
  let s = raw.trim().replace(/[.!?]+$/, "").trim();
  s = s.replace(ARTICLE, "");
  if (!s) return null;
  const words = s.split(/\s+/);
  let quantity: string | undefined;
  const first = normalize(words[0]);
  if (/^\d+([.,]\d+)?$/.test(first) || NUMBER_WORDS[first]) {
    quantity = NUMBER_WORDS[first] ?? words[0];
    words.shift();
    const unit = new RegExp(`^${UNITS}$`, "i");
    if (words[0] && unit.test(words[0])) quantity += ` ${words.shift()}`;
    if (words[0] && /^(de|d')$/i.test(words[0])) words.shift();
    s = words.join(" ").replace(/^d'/i, "");
  }
  s = s.replace(ARTICLE, "").trim();
  if (!s) return null;
  return { name: s.charAt(0).toUpperCase() + s.slice(1), quantity };
}

/** Split "des tomates, des œufs et du pain" into items. */
export function splitItems(list: string): ParsedItem[] {
  return list
    .split(/\s*,\s*|\s+et\s+|\s+plus\s+|\s*\+\s*/i)
    .map(parseItem)
    .filter((x): x is ParsedItem => !!x);
}

export type ShoppingCommand =
  | { op: "add"; items: ParsedItem[] }
  | { op: "remove"; names: string[] }
  | { op: "check"; names: string[] }
  | { op: "uncheck"; names: string[] }
  | { op: "list" }
  | { op: "clearChecked" };

const LIST = String.raw`(?:aux|a la|dans la|sur la|de la|des)\s+(?:liste(?:\s+de\s+courses)?|courses|commissions)`;

/** Deterministic shopping-list commands (no LLM). */
export function parseShoppingCommand(input: string): ShoppingCommand | null {
  const raw = input.trim().replace(/^homecal[,\s]+/i, "");
  const n = normalize(raw).replace(/[’]/g, "'");
  const mentions = /\b(courses|commissions|liste)\b/.test(n);
  if (!mentions) return null;

  if (/\b(qu'est-ce qu'il (?:me |nous )?reste|que reste-t-il|quoi acheter|qu'y a-t-il|lis|montre|affiche|il faut acheter quoi|reste a acheter)\b/.test(n)) return { op: "list" };
  if (/\b(vide|efface|supprime|enleve|retire)\b.*\b(coches|achetes|deja pris)\b/.test(n)) return { op: "clearChecked" };

  const body = (re: RegExp) => {
    const m = re.exec(raw);
    return m ? m[1] : null;
  };

  let part = body(new RegExp(String.raw`^(?:ajoute|ajouter|rajoute|mets|mettre|note|ecris|écris|il faut|il nous faut|il me faut)\s+(.+?)\s+${LIST.replace(/a la/g, "[aà] la")}\s*[.!?]?$`, "i"));
  if (part) return { op: "add", items: splitItems(part) };
  part = body(new RegExp(String.raw`^(?:ajoute|rajoute|mets|note)\s+(?:${LIST.replace(/a la/g, "[aà] la")})\s*:?\s+(.+)$`, "i"));
  if (part) return { op: "add", items: splitItems(part) };

  part = body(new RegExp(String.raw`^(?:enleve|enlève|retire|supprime|efface|oublie)\s+(.+?)\s+(?:de la liste(?: de courses)?|des courses|de mes courses)\s*[.!?]?$`, "i"));
  if (part) return { op: "remove", names: splitItems(part).map((i) => i.name) };

  part = body(/^(?:coche|j'ai (?:pris|achete|acheté)|c'est bon pour)\s+(.+?)(?:\s+(?:dans|sur|de) la liste.*)?$/i);
  if (part) return { op: "check", names: splitItems(part).map((i) => i.name) };

  part = body(/^(?:decoche|décoche|remets)\s+(.+?)(?:\s+(?:dans|sur) la liste.*)?$/i);
  if (part) return { op: "uncheck", names: splitItems(part).map((i) => i.name) };

  return null;
}

export function findItem(items: ShoppingItem[], name: string): ShoppingItem | undefined {
  const q = normalize(name).replace(/s$/, "");
  return (
    items.find((i) => normalize(i.name).replace(/s$/, "") === q) ??
    items.find((i) => normalize(i.name).includes(q) || q.includes(normalize(i.name).replace(/s$/, "")))
  );
}

export function describeList(items: ShoppingItem[]): string {
  const todo = items.filter((i) => !i.checked);
  if (!todo.length) return "La liste de courses est vide.";
  const names = todo.map((i) => (i.quantity ? `${i.quantity} ${i.name.toLowerCase()}` : i.name.toLowerCase()));
  return `Il reste ${todo.length} article${todo.length > 1 ? "s" : ""} : ${names.slice(0, -1).join(", ")}${names.length > 1 ? " et " : ""}${names[names.length - 1]}.`;
}
