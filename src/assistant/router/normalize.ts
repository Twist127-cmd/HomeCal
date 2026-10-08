/**
 * French utterance normalization shared by every domain parser.
 *  - `text`: cleaned sentence (fillers / politeness removed, STT fixes) — accents and case kept,
 *    used to extract labels and titles ("Pâtes", "Dentiste").
 *  - `norm`: lower-case, no accents, unified apostrophes, no punctuation, canonical verbs —
 *    used for matching.
 */

export interface Utterance {
  raw: string;
  text: string;
  norm: string;
}

/** Small, configurable dictionary of frequent speech-to-text mistakes (applied on `norm`). */
export const VOICE_CORRECTIONS: Record<string, string> = {
  "oueze": "waze",
  "ouaze": "waze",
  "waise": "waze",
  "wase": "waze",
  "weize": "waze",
  "spotifaille": "spotify",
  "spoti fi": "spotify",
  "spotifie": "spotify",
  "google map": "google maps",
  "gogol maps": "google maps",
  "minuteurs de": "minuteur de",
  "minuterie": "minuteur",
  "home cal": "homecal",
  "homme cal": "homecal",
  "ome cal": "homecal",
  "p q": "pq",
};

// Fillers and politeness, removed anywhere (word boundaries)
const FILLERS = [
  "euh+",
  "heu+",
  "hum+",
  "hmm+",
  "ben",
  "bah",
  "alors",
  "voila",
  "ok",
  "okay",
  "dis",
  "hey",
  "salut",
  "homecal",
  "s'il te plait",
  "s'il vous plait",
  "stp",
  "svp",
  "merci beaucoup",
  "merci",
  "est-ce que tu peux",
  "est ce que tu peux",
  "est-ce que tu pourrais",
  "tu peux",
  "tu pourrais",
  "peux-tu",
  "peux tu",
  "pourrais-tu",
  "pourrais tu",
  "je voudrais que tu",
  "j'aimerais que tu",
  "je veux que tu",
  "je voudrais",
  "j'aimerais",
  "s'te plait",
];

// Infinitive / variants → canonical imperative used by the parsers
const VERBS: [RegExp, string][] = [
  [/\b(ajouter|ajoutes|ajoutez)\b/g, "ajoute"],
  [/\b(rajouter|rajoutes|rajoutez)\b/g, "rajoute"],
  [/\b(mettre|mettez|met)\b/g, "mets"],
  [/\b(lancer|lances|lancez)\b/g, "lance"],
  [/\b(enlever|enleves|enlevez)\b/g, "enleve"],
  [/\b(retirer|retires|retirez)\b/g, "retire"],
  [/\b(supprimer|supprimes|supprimez)\b/g, "supprime"],
  [/\b(annuler|annules|annulez)\b/g, "annule"],
  [/\b(afficher|affiches|affichez)\b/g, "affiche"],
  [/\b(montrer|montres|montrez)\b/g, "montre"],
  [/\b(lire|lisez)\b/g, "lis"],
  [/\b(noter|notes|notez)\b/g, "note"],
  [/\b(cocher|coches|cochez)\b/g, "coche"],
  [/\b(deplacer|deplaces|deplacez)\b/g, "deplace"],
  [/\b(decaler|decales|decalez)\b/g, "decale"],
  [/\b(ouvrir|ouvres|ouvrez)\b/g, "ouvre"],
  [/\b(jouer|joues|jouez)\b/g, "joue"],
  [/\b(passer|passez)\b/g, "passe"],
  [/\b(reprendre|reprenez)\b/g, "reprends"],
  [/\b(activer|actives|activez)\b/g, "active"],
  [/\b(quitter|quittes|quittez)\b/g, "quitte"],
  [/\b(rappeler|rappelez)\b/g, "rappelle"],
];

export function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function fillerRegex() {
  return new RegExp(`(^|[\\s,])(?:${FILLERS.map((f) => f.replace(/[-]/g, "[- ]?").replace(/'/g, "'?\\s?")).join("|")})(?=$|[\\s,.!?])`, "gi");
}
const FILLER_RE = fillerRegex();

/** Remove fillers/politeness from a sentence while keeping accents and case. */
function clean(raw: string): string {
  let t = raw
    .replace(/[’`´]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
  // remove fillers on an accent-insensitive copy, keeping the original characters
  for (let i = 0; i < 3; i++) {
    const plain = stripAccents(t).toLowerCase();
    const re = new RegExp(FILLER_RE.source, "gi");
    let out = "";
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(plain))) {
      out += t.slice(last, m.index) + (m[1] ? " " : "");
      last = m.index + m[0].length;
    }
    out += t.slice(last);
    const next = out.replace(/\s+/g, " ").replace(/^[\s,]+|[\s,]+$/g, "").trim();
    if (next === t) break;
    t = next;
  }
  return t.replace(/^[,.\s]+/, "").trim();
}

export function normalizeUtterance(raw: string): Utterance {
  const text = clean(raw);
  let norm = stripAccents(text)
    .toLowerCase()
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .replace(/[«»"“”]/g, " ")
    .replace(/[!?;]+/g, " ")
    .replace(/\.(?!\d)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  for (const [wrong, right] of Object.entries(VOICE_CORRECTIONS)) norm = norm.replace(new RegExp(`\\b${wrong}\\b`, "g"), right);
  for (const [re, v] of VERBS) norm = norm.replace(re, v);
  // "mets-moi", "ajoute-moi" → "mets", "ajoute"
  norm = norm.replace(/\b(ajoute|rajoute|mets|note|lance|joue|montre|lis|affiche|rappelle|dis)[- ]moi\b/g, (_, v) => (v === "rappelle" ? "rappelle-moi" : v));
  return { raw, text, norm: norm.replace(/\s+/g, " ").trim() };
}
