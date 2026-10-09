import type { WakeSensitivity } from "@/lib/types";

/**
 * Wake-word variants and matching (pure, engine-agnostic).
 *
 * Vosk only recognises words of its (French) vocabulary. "HomeCal" is not a French word,
 * so it is detected through phonetic look-alikes ("homme cal", "home calme"…).
 * The grammar restricts the recogniser to these phrases + "[unk]" (everything else),
 * which keeps CPU low and false positives rare.
 */

interface KeywordProfile {
  /** strict variants (low sensitivity) */
  strict: string[];
  /** main variants (normal sensitivity) */
  normal: string[];
  /** extra phrases only added to the grammar for high sensitivity */
  loose: string[];
  /** high sensitivity: first word(s) of the wake word… */
  loosePrefix: string[];
  /** …followed by a word matching this pattern */
  looseNext: RegExp;
}

const PROFILES: Record<string, KeywordProfile> = {
  homecal: {
    strict: ["homme cal", "home cal"],
    normal: ["homme cal", "home cal", "homme calme", "home calme", "hommes cale", "homme cale", "home cale", "on cal", "ohm cal"],
    loose: ["homme quel", "home car", "homme car", "homme cale", "hommes calme", "om cal", "home kal"],
    loosePrefix: ["homme", "hommes", "home", "ohm", "om", "on"],
    // k-sound + "al": avoids "on commence", "homme qui"…
    looseNext: /^(cal|cale|cales|calme|kal|quel|qual|car|cals)$/,
  },
  nora: {
    strict: ["nora"],
    normal: ["nora", "norah", "nora a"],
    loose: ["no ra", "nor a"],
    loosePrefix: ["nor", "no"],
    looseNext: /^(a|ra)$/,
  },
  milo: {
    strict: ["milo"],
    normal: ["milo", "mi lo", "mylo"],
    loose: ["mi l'eau", "mille eau"],
    loosePrefix: ["mi", "mille"],
    looseNext: /^(lo|l'eau|eau)$/,
  },
  nova: {
    strict: ["nova"],
    normal: ["nova", "no va"],
    loose: ["nos va", "nova a"],
    loosePrefix: ["no", "nos"],
    looseNext: /^va$/,
  },
};

export const SUPPORTED_KEYWORDS = ["HomeCal", "Nora", "Milo", "Nova"];

export function normalizeHeard(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\[unk\]/g, " ")
    .replace(/[’]/g, "'")
    .replace(/[^a-z0-9' ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Pre-tuned names (reliable detection). Any other name works if it is (or sounds like) French words. */
export function isTunedKeyword(keyword: string): boolean {
  return !!PROFILES[normalizeHeard(keyword).replace(/\s+/g, "")];
}

/** Vosk vocabulary spelling: lower case, accents kept ("Élise" → "élise"). */
function grammarForm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[’]/g, "'")
    .replace(/[^\p{L}' ]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** "jarre visse, jar vis" → ["jarre visse", "jar vis"] */
export function parsePronunciation(text: string | undefined): string[] {
  return (text ?? "").split(/[,;\n]/).map(grammarForm).filter(Boolean);
}

function profileFor(keyword: string, extra: string[] = []): KeywordProfile {
  const key = normalizeHeard(keyword).replace(/\s+/g, "");
  const p = PROFILES[key];
  const own = grammarForm(keyword);
  // generic keyword: its own words + the user's pronunciation hints
  const base = p ?? { strict: [own], normal: [own], loose: [], loosePrefix: [], looseNext: /^$/ };
  if (!extra.length) return base;
  return { ...base, strict: [...base.strict, ...extra], normal: [...base.normal, ...extra] };
}

/** Vosk grammar (JSON array of phrases) for a keyword and sensitivity. */
export function buildGrammar(keyword: string, sensitivity: WakeSensitivity = "normal", extra: string[] = []): string[] {
  const p = profileFor(keyword, extra);
  const phrases = sensitivity === "low" ? p.strict : sensitivity === "high" ? [...p.normal, ...p.loose] : p.normal;
  return [...new Set(phrases), "[unk]"];
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Does the recognised text contain the wake word?
 * `trailing` = words heard right after it ("homme cal ajoute du lait" → "ajoute du lait").
 */
export function matchWakeWord(
  text: string,
  keyword: string,
  sensitivity: WakeSensitivity = "normal",
  extra: string[] = [],
): { matched: boolean; trailing: string } {
  const heard = normalizeHeard(text);
  if (!heard) return { matched: false, trailing: "" };
  const p = profileFor(keyword, extra);
  const variants = (sensitivity === "low" ? p.strict : sensitivity === "high" ? [...p.normal, ...p.loose] : p.normal)
    .map(normalizeHeard)
    .sort((a, b) => b.length - a.length);

  for (const v of variants) {
    const m = new RegExp(`(?:^|\\s)${escape(v)}(?=$|\\s)`).exec(heard);
    if (m) return { matched: true, trailing: heard.slice(m.index + m[0].length).trim() };
  }

  if (sensitivity === "high" && p.loosePrefix.length) {
    const words = heard.split(" ");
    for (let i = 0; i < words.length - 1; i++) {
      if (p.loosePrefix.includes(words[i]) && p.looseNext.test(words[i + 1])) {
        return { matched: true, trailing: words.slice(i + 2).join(" ") };
      }
    }
  }
  return { matched: false, trailing: "" };
}

/** "Nora, ajoute du lait" → "ajoute du lait" (the command recogniser may repeat the name). */
export function stripLeadingName(text: string, keyword: string, extra: string[] = []): string {
  const p = profileFor(keyword, extra);
  const variants = new Set([...p.normal, normalizeHeard(keyword).replace(/\s+/g, "")].map(normalizeHeard));
  const words = text.trim().split(/\s+/);
  // only when the name opens the sentence (1 to 3 words)
  for (let n = Math.min(3, words.length - 1); n >= 1; n--) {
    if (variants.has(normalizeHeard(words.slice(0, n).join(" ")))) return words.slice(n).join(" ").replace(/^[,.;:!\s]+/, "");
  }
  return text;
}
