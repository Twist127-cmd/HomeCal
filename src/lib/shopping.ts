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

const ARTICLE = /^(?:(?:du|de la|des|de|le|la|les|un|une|quelques|encore)\s+|(?:de l'|d'|l')\s*)/i;
const UNITS = String.raw`(?:kg|g|grammes?|kilos?|l|litres?|cl|ml|paquets?|boites?|boîtes?|bouteilles?|pots?|sachets?|tranches?|barquettes?|douzaines?)`;

/** "six œufs" → {name: "œufs", quantity: "6"}; "2 kg de pommes" → {name: "pommes", quantity: "2 kg"}. */
export function parseItem(raw: string): ParsedItem | null {
  let s = raw.trim().replace(/[.!?]+$/, "").trim();
  // "un kilo de pommes", "une bouteille de lait" → quantity "1 kilo"
  const one = new RegExp(String.raw`^(?:un|une)\s+(${UNITS})\s+(?:de\s+|d'\s*)`, "i").exec(s);
  if (one) {
    const name = s.slice(one[0].length).replace(ARTICLE, "").trim();
    return name ? { name: name.charAt(0).toUpperCase() + name.slice(1), quantity: `1 ${one[1]}` } : null;
  }
  s = s.replace(/^(?:un peu de|un peu d'|aussi|encore)\s*/i, "");
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

// ------------------------------------------------------------------ V2: scored parser on normalized utterances

/** Food / household lexicon (accent-free, singular) — used to score sentences without an explicit list marker. */
const LEXICON = [
  "lait", "pain", "oeuf", "beurre", "fromage", "cafe", "the", "sucre", "farine", "sel", "poivre", "huile", "vinaigre", "pate", "riz",
  "tomate", "pomme", "poire", "banane", "orange", "citron", "salade", "carotte", "oignon", "ail", "pomme de terre", "patate", "courgette",
  "poivron", "concombre", "avocat", "fraise", "raisin", "yaourt", "yogourt", "creme", "creme fraiche", "jambon", "poulet", "viande", "steak",
  "boeuf", "porc", "saucisse", "poisson", "saumon", "thon", "eau", "jus", "jus d'orange", "vin", "biere", "soda", "coca", "chocolat",
  "biscuit", "gateau", "cereale", "confiture", "miel", "nutella", "chips", "pizza", "glace", "legume", "fruit", "epice", "moutarde",
  "ketchup", "mayonnaise", "mayo", "sauce", "pq", "papier toilette", "essuie-tout", "sopalin", "mouchoir", "lessive", "liquide vaisselle",
  "produit vaisselle", "eponge", "savon", "shampoing", "shampooing", "gel douche", "dentifrice", "brosse a dent", "deodorant", "coton",
  "couche", "lingette", "sac poubelle", "ampoule", "pile", "croquette", "litiere", "baguette", "croissant", "brioche", "mozzarella",
  "parmesan", "gruyere", "emmental", "comte", "chevre", "lardon", "bacon", "dinde", "crevette", "moule", "haricot", "lentille",
  "pois chiche", "mais", "champignon", "epinard", "brocoli", "chou", "poireau", "aubergine", "melon", "pasteque", "peche", "abricot",
  "cerise", "kiwi", "mangue", "ananas", "noix", "amande", "cacahuete", "olive", "cornichon", "conserve", "soupe", "bouillon", "levure",
  "vanille", "cannelle", "tisane", "capsule", "dosette", "filtre", "aluminium", "film alimentaire", "papier cuisson", "allumette",
  "bougie", "baguettes", "lait d'avoine", "lait de soja", "compote", "ravioli", "lasagne", "quiche", "tarte", "pate a tarte",
  "pate feuilletee", "petit pois", "frite", "nugget", "yop", "fromage blanc", "pain de mie", "muesli", "granola", "sirop", "limonade",
  "eau gazeuse", "javel", "nettoyant", "sac", "sacs", "poivron rouge", "persil", "basilic", "coriandre", "menthe", "gingembre",
];

const strip = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/œ/g, "oe")
    .replace(/[’`]/g, "'");

/** true when every word group of the item belongs to the food/household lexicon. */
export function isKnownProduct(name: string): boolean {
  const n = strip(name)
    .replace(/[^a-z0-9' -]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!n) return false;
  const singular = n
    .split(" ")
    .map((w) => w.replace(/(?<=[a-z]{3})(s|x)$/, ""))
    .join(" ");
  return LEXICON.some((w) => new RegExp(`(^|\\s)${w.replace(/[-]/g, "[- ]?")}(s|x)?($|\\s)`).test(singular) || singular === w);
}

const LIST_MARKER = String.raw`(?:liste de courses|liste des courses|liste de commissions|courses|commissions|liste|caddie)`;
const LIST_PREP = String.raw`(?:a la|aux|au|dans la|dans les|dans le|dans mes|dans ma|sur la|sur ma|sur les|sur mes|pour les|pour la|en|a mes|a ma|de la|des|de mes|de ma)`;
const STRONG_ADD = String.raw`(?:pense a acheter|pense a prendre|pense a racheter|n'oublie pas d'acheter|n'oublie pas de prendre|achete|racheter|rachete|il faut racheter|il faut acheter|il nous faut|il me faut|il faut|faut|j'ai besoin d'|j'ai besoin de|on a besoin d'|on a besoin de|besoin d'|besoin de|on n'a plus de|on n'a plus d'|il n'y a plus de|il n'y a plus d'|il y a plus de|il y a plus d'|y a plus de|plus de)`;
const GENERIC_ADD = String.raw`(?:ajoute|rajoute|mets|note|prevois|ecris|inscris|prends aussi|prends|rajoute aussi|ajoute aussi|mets aussi)`;
const REMOVE = String.raw`(?:enleve|retire|supprime|efface|oublie|raye|vire|barre)`;
const NOT_NEEDED = String.raw`(?:finalement |en fait )?(?:pas besoin de|pas besoin d'|plus besoin de|plus besoin d'|on a deja du|on a deja de la|on a deja des|on a deja|j'ai deja du|j'ai deja de la|j'ai deja des|j'ai deja)`;
const COMPLETE_PRE = String.raw`(?:j'ai pris|j'ai achete|j'ai trouve|on a pris|on a achete|c'est bon pour|coche|marque|valide|c'est fait pour)`;
const COMPLETE_POST = String.raw`(?:c'est bon|c'est pris|c'est fait|c'est achete|est pris|sont pris|est achete|sont achetes|est prise|sont prises|pris|achete|achetes|achetee|achetees|ok)`;
const UNCOMPLETE = String.raw`(?:decoche|remets|en fait j'ai pas pris|j'ai pas pris|je n'ai pas pris|finalement j'ai pas pris)`;

const OTHER_DOMAIN =
  /\b(musique|spotify|playlist|chanson|morceau|titre|album|artiste|radio|volume|le son|minuteur|chrono|timer|rappel|rappelle|scene|mode|waze|itineraire|meteo|rendez-vous|rdv|reunion)\b/;
const TIME_WORDS =
  /\b(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|demain|apres-demain|aujourd'hui|ce soir|ce matin|cet apres-midi|midi|minuit|semaine|week-end|weekend|janvier|fevrier|mars|avril|mai|juin|juillet|aout|septembre|octobre|novembre|decembre|toute la journee)\b|\b\d{1,2}\s*h(\s*\d{2})?\b|\b\d{1,2}:\d{2}\b|\ble \d{1,2}\b/;
const DURATION = /\b\d+\s*(secondes?|sec|minutes?|min|mn|heures?)\b|\b(quart d'heure|demi-heure|demi heure)\b/;

export interface ShoppingIntent {
  intent: "shopping.add" | "shopping.remove" | "shopping.complete" | "shopping.uncomplete" | "shopping.list" | "shopping.clearCompleted";
  confidence: number;
  items?: ParsedItem[];
  names?: string[];
  destructive?: boolean;
}

/** Re-apply accents/case from the cleaned text to a phrase extracted from the normalized text. */
export function restoreAccents(phraseNorm: string, text: string): string {
  const map = new Map<string, string>();
  for (const w of text.split(/[\s,]+/)) {
    const k = strip(w).replace(/[^a-z0-9'-]/g, "");
    if (k && !map.has(k)) map.set(k, w.replace(/[.!?;:]+$/, ""));
  }
  return phraseNorm
    .split(/(\s+|,)/)
    .map((tok) => {
      const k = tok.replace(/[^a-z0-9'-]/g, "");
      return k && map.has(k) ? map.get(k)! : tok;
    })
    .join("");
}

const itemsOf = (phraseNorm: string, text: string) => splitItems(restoreAccents(phraseNorm.trim(), text));

/** Confidence of an "add" without explicit list marker, from the items themselves. */
function itemScore(items: ParsedItem[], phrase: string, strong: boolean): number {
  if (!items.length) return 0;
  const known = items.every((i) => isKnownProduct(i.name));
  const partitive = /^(du|de la|de l'|des|d'|un peu|\d|un |une |deux|trois|quatre|cinq|six|sept|huit|neuf|dix|douze)/.test(phrase.trim());
  if (known) return strong ? 0.95 : 0.92;
  if (partitive) return strong ? 0.88 : 0.75;
  return strong ? 0.6 : 0;
}

/**
 * Shopping intents from a normalized utterance (norm = lowercase, no accents, canonical verbs).
 * Explicit list markers ("aux courses", "sur la liste") give a very high confidence;
 * otherwise the items must look like products and the sentence must not contain a date,
 * a time, a duration or another domain's keyword (calendar, timers, music…).
 */
export function parseShoppingUtterance(norm: string, text: string, raw = text): ShoppingIntent | null {
  let n = norm
    .replace(/[?!.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(et |aussi |hop |allez )/, "")
    // "merci d'ajouter…" → the filler "merci" is removed upstream, leaving "d'ajoute…"
    .replace(/^(d'|de )(?=(ajoute|rajoute|mets|note|retire|enleve|supprime|coche)\b)/, "");
  // "c'est bon" is partly eaten by the filler list ("bon"): restore it from the raw sentence
  const rawPlain = strip(raw);
  if (/\bc'est bon\b/.test(rawPlain)) n = n.replace(/\bc'est\b(?! bon)/, "c'est bon");
  if (!n) return null;
  // "liste les minuteurs", "liste mes rappels", "liste des scènes" belong to other domains
  if (/\b(minuteurs?|minuterie|chronos?|timers?|rappels?|scenes?|modes?|ambiances?)\b/.test(n) && !/\b(courses|commissions)\b/.test(n)) return null;
  const hasMarker = new RegExp(`\\b${LIST_MARKER}\\b`).test(n);
  /** marker introduced by a preposition ("aux courses", "sur la liste") = explicit list target */
  const explicitTarget = new RegExp(`\\b${LIST_PREP}\\s+${LIST_MARKER}\\b`).test(n);
  const foreign = OTHER_DOMAIN.test(n) || DURATION.test(n);
  const timed = TIME_WORDS.test(n);
  let m: RegExpExecArray | null;

  // ---- list / read
  if (
    /\b(qu'est-ce qu'il (me |nous )?reste|qu'est ce qu'il (me |nous )?reste|que reste-t-il|il (me |nous )?reste quoi|reste quoi|il reste quoi|qu'est-ce qu'on doit acheter|qu'est-ce que je dois acheter|qu'est-ce qu'il faut acheter|qu'est ce qu'il faut acheter|on doit acheter quoi|il faut acheter quoi|quoi acheter|qu'y a-t-il (sur|dans) la liste|qu'est-ce qu'il y a (sur|dans) la liste|c'est quoi la liste|qu'est-ce qui reste a acheter|reste a acheter)\b/.test(n) &&
    !/\b(temps|minutes?|minuteur|secondes?)\b/.test(n)
  ) {
    return { intent: "shopping.list", confidence: 0.95 };
  }
  if (/^(lis|montre|affiche|donne|dis|ouvre|voir)\b.*\b(liste|courses|commissions)\b/.test(n) || /^(la )?(liste de courses|liste des courses|les courses|mes courses|ma liste)$/.test(n)) {
    return { intent: "shopping.list", confidence: 0.95 };
  }

  // ---- clear checked items
  if (/\b(vide|efface|supprime|enleve|retire|nettoie|vire)\b.*\b(coches?|cochees?|achetes?|achetees?|deja pris|pris|termines?)\b/.test(n) && !/\b(minuteur|rappel)\b/.test(n)) {
    return { intent: "shopping.clearCompleted", confidence: 0.96 };
  }

  // ---- uncomplete
  if ((m = new RegExp(`^${UNCOMPLETE}\\s+(.+?)(?:\\s+(?:sur|dans) (?:la |ma )?${LIST_MARKER})?$`).exec(n))) {
    if (foreign || timed) return null;
    const names = itemsOf(m[1], text).map((i) => i.name);
    if (!names.length) return null;
    return { intent: "shopping.uncomplete", names, confidence: hasMarker || names.every(isKnownProduct) || /^(decoche)/.test(n) ? 0.94 : 0.65 };
  }

  // ---- complete: "j'ai pris le lait", "coche les œufs", "marque le lait comme acheté"
  if ((m = new RegExp(`^${COMPLETE_PRE}\\s+(.+?)(?:\\s+comme (?:achetee?s?|prise?s?|faite?s?))?(?:\\s+(?:sur|dans|de) (?:la |ma )?${LIST_MARKER})?$`).exec(n))) {
    if (foreign || timed) return null;
    const names = itemsOf(m[1], text).map((i) => i.name);
    if (!names.length) return null;
    const verbSure = /^(coche|marque|valide)/.test(n);
    return { intent: "shopping.complete", names, confidence: hasMarker || names.every(isKnownProduct) ? 0.95 : verbSure ? 0.9 : 0.6 };
  }
  // "le pain c'est bon", "les œufs c'est pris"
  if ((m = new RegExp(`^(.+?)\\s+${COMPLETE_POST}$`).exec(n)) && !/^(c'est|ok|tout)/.test(n)) {
    if (foreign || timed) return null;
    const names = itemsOf(m[1], text).map((i) => i.name);
    if (names.length && names.every(isKnownProduct)) return { intent: "shopping.complete", names, confidence: 0.93 };
  }

  // ---- remove: "enlève le lait", "supprime le pain des courses", "finalement pas besoin de café"
  if ((m = new RegExp(`^${REMOVE}\\s+(.+?)(?:\\s+(?:${LIST_PREP}\\s+)?${LIST_MARKER})?$`).exec(n))) {
    if (!hasMarker && (foreign || timed)) return null;
    const names = itemsOf(m[1], text).map((i) => i.name);
    if (!names.length) return null;
    if (hasMarker) return { intent: "shopping.remove", names, confidence: 0.97, destructive: true };
    // known product: beats a calendar "delete" on an unknown title
    if (names.every(isKnownProduct)) return { intent: "shopping.remove", names, confidence: 0.97, destructive: true };
    return null;
  }
  if ((m = new RegExp(`^${NOT_NEEDED}\\s*(.+?)(?:\\s+(?:${LIST_PREP}\\s+)?${LIST_MARKER})?$`).exec(n))) {
    if (!hasMarker && (foreign || timed)) return null;
    const names = itemsOf(m[1], text).map((i) => i.name);
    if (names.length && (hasMarker || names.every(isKnownProduct))) return { intent: "shopping.remove", names, confidence: 0.95, destructive: true };
    return null;
  }

  // ---- add with the list marker first: "ajoute aux courses du lait", "courses : lait, pain"
  if ((m = new RegExp(`^(?:${GENERIC_ADD}\\s+)?(?:${LIST_PREP}\\s+)?${LIST_MARKER}\\s*:?\\s+(.+)$`).exec(n)) && !/^(lis|montre|affiche)\b/.test(n)) {
    const rest = m[1].replace(/^(:|ajoute|rajoute|mets)\s*/, "");
    if (!/^(de|du|a|pour)\s+(samedi|demain|lundi|mardi|mercredi|jeudi|vendredi|dimanche)/.test(rest) && !timed) {
      const items = itemsOf(rest, text);
      if (items.length) return { intent: "shopping.add", items, confidence: 0.97 };
    }
  }

  // ---- add: "<verb> <items> [prep] [marker]"
  const addRe = new RegExp(`^(${STRONG_ADD}|${GENERIC_ADD})\\s+(.+?)(?:\\s+(?:${LIST_PREP}\\s+)?${LIST_MARKER})?$`);
  if ((m = addRe.exec(n))) {
    const verb = m[1];
    const phrase = m[2].replace(/^(aussi|encore|moi)\s+/, "");
    const strong = new RegExp(`^${STRONG_ADD}$`).test(verb);
    if (hasMarker) {
      if (timed && !explicitTarget) return null; // "faire les courses samedi"
      const items = itemsOf(phrase, text);
      return items.length ? { intent: "shopping.add", items, confidence: 0.97 } : null;
    }
    if (foreign || timed) return null;
    if (/^(que |qu'|de partir|d'aller|aller|partir|y aller|le |la |les |l'|mon |ma |mes |ton |ta )/.test(phrase) && !itemsOf(phrase, text).every((i) => isKnownProduct(i.name))) {
      return null;
    }
    const items = itemsOf(phrase, text);
    const score = itemScore(items, phrase, strong);
    if (score <= 0) return null;
    return { intent: "shopping.add", items, confidence: score };
  }

  // ---- "<items> aux courses" (no verb)
  if ((m = new RegExp(`^(.+?)\\s+(?:${LIST_PREP})\\s+${LIST_MARKER}$`).exec(n)) && !timed && !foreign) {
    const items = itemsOf(m[1], text);
    if (items.length) return { intent: "shopping.add", items, confidence: 0.93 };
  }
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
