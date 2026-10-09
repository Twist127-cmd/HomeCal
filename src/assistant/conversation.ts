import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { stripAccents } from "./router/normalize";

/**
 * Conversational layer — meta / social turns answered instantly, without any domain parser
 * or LLM: "répète", "j'ai pas entendu", "merci", "quelle heure est-il ?", "annule ce que
 * tu viens de faire"…
 *
 * Works on its own light normalization (NOT `normalizeUtterance`, which strips "merci",
 * "ok", "salut" as fillers). Patterns are anchored on the whole sentence so that
 * "le pain c'est bon" or "annule le dentiste" never match here.
 */

export type ConversationIntent =
  | "repeat"
  | "slower"
  | "undo"
  | "time"
  | "date"
  | "identity"
  | "help"
  | "howareyou"
  | "greet"
  | "goodnight"
  | "thanks"
  | "ack"
  | "dismiss"
  | "silence";

/** Lower-case, no accents, unified apostrophes, no punctuation, no leading interjection. */
export function convNorm(raw: string): string {
  return stripAccents(raw)
    .toLowerCase()
    .replace(/[’`´]/g, "'")
    .replace(/[-]/g, " ")
    .replace(/[^a-z0-9' ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(?:(?:euh+|heu+|hum+|hmm+|ben|bah|alors|dis|hey|homecal|home cal|excuse moi|excusez moi|pardon|desole|oups|ah|oh)\s+)+/, "")
    .replace(/\s+(?:s'il te plait|s'il vous plait|stp|svp|s'te plait)$/, "")
    .trim();
}

const P = (s: string) => new RegExp(`^(?:${s})$`);

// Order matters: the first matching rule wins.
const RULES: [ConversationIntent, RegExp][] = [
  ["silence", P("tais toi|taisez vous|ferme la|la ferme|ca suffit|arrete de parler|arrete de causer|chut tais toi|silence homecal|tu peux te taire|tais toi homecal")],
  [
    "undo",
    P(
      "annule (?:ce que tu viens de faire|ca|la derniere (?:action|commande|modification)|ta derniere action)|" +
        "(?:reviens|retour) en arriere|defais (?:ca|tout ca)?|undo|" +
        "non (?:c'est pas ca|pas ca)(?: annule)?|c'est pas ce que j'ai demande|tu t'es trompe(?:e)?(?: annule)?",
    ),
  ],
  [
    "slower",
    P("(?:parle |repete |redis le |redis )?(?:plus lentement|moins vite)|parle (?:plus )?doucement|tu parles trop vite|trop vite"),
  ],
  [
    "repeat",
    P(
      "repete(?: ca| encore| s'il te plait| la phrase| ta reponse| moi ca)?|repeter|" +
        "(?:tu peux|peux tu|tu pourrais|pourrais tu|est ce que tu peux|vous pouvez|pouvez vous) (?:me )?(?:le )?(?:repeter|redire)(?: ca)?|" +
        "redis(?: moi)?(?: le| ca)?|redis moi ca|" +
        "(?:je n'ai|j'ai|j ai) (?:rien|pas tout|pas tres bien) (?:entendu|compris|saisi|capte|suivi)(?: tu peux repeter)?|" +
        "(?:je n'ai|j'ai|j ai) pas (?:bien )?(?:entendu|compris|saisi|capte|suivi)(?: ce que tu (?:as|a) dit| ta reponse)?(?: tu peux repeter)?|" +
        "je n'ai pas (?:bien )?(?:entendu|compris|saisi|capte|suivi)(?: ce que tu (?:as|a) dit| ta reponse)?(?: tu peux repeter)?|" +
        "quoi|pardon|comment|hein|plait il|excuse moi|" +
        "tu (?:as|a) dit quoi|qu'est ce que tu (?:as|a) dit|t'as dit quoi|qu'est ce que t'as dit|" +
        "encore une fois|une autre fois|encore|re dis|la derniere phrase",
    ),
  ],
  [
    "time",
    P(
      "(?:quelle heure (?:est il|il est|c'est)|il est quelle heure|quelle heure|l'heure|donne moi l'heure|c'est quelle heure|t'as l'heure|tu as l'heure|vous avez l'heure)(?: la| maintenant| actuellement| exactement)?",
    ),
  ],
  [
    "date",
    P(
      "(?:on est quel jour|quel jour (?:on est|sommes nous|est on|est ce|c'est)|on est le combien|nous sommes le combien|c'est quoi la date|quelle est la date|la date|" +
        "quelle date (?:on est|sommes nous|aujourd'hui)|on est quel jour aujourd'hui|c'est quel jour aujourd'hui|quel jour sommes nous aujourd'hui|quelle date)(?: aujourd'hui)?",
    ),
  ],
  [
    "identity",
    P("qui es tu|qui tu es|t'es qui|tu es qui|comment tu t'appelles|c'est quoi ton nom|quel est ton nom|tu t'appelles comment|qui est la|qui parle"),
  ],
  [
    "help",
    P(
      "aide(?: moi)?|help|au secours|qu'est ce que tu (?:sais|peux) faire|tu sais faire quoi|tu peux faire quoi|que sais tu faire|que peux tu faire|" +
        "comment (?:ca marche|tu marches|je fais|on fait)|qu'est ce que je peux (?:te )?dire|quelles sont tes fonctions",
    ),
  ],
  ["howareyou", P("(?:ca va|comment ca va|comment tu vas|comment vas tu|tu vas bien|la forme|ca roule)(?: homecal)?")],
  ["goodnight", P("bonne nuit|bonne soiree|a demain|bonne journee|au revoir|a plus|a plus tard|ciao|salut a plus")],
  ["greet", P("(?:bonjour|bonsoir|salut|coucou|hello|hey|yo|wesh|bon matin)(?: homecal| toi| ca va)?")],
  [
    "thanks",
    P("(?:super |ok |parfait |genial |top |nickel |)?(?:merci(?: beaucoup| bien| infiniment| mille fois| a toi| homecal)?|thanks|thank you|c'est gentil|t'es (?:gentil|gentille|au top|top)|tu es (?:gentil|gentille|top))"),
  ],
  [
    "ack",
    P(
      "ok|okay|d'accord|dac|parfait|super|genial|top|nickel|cool|tres bien|bien|entendu|compris|ca marche|impeccable|excellent|bravo|bien joue|ok merci|ok super|ah ok|ah d'accord|oui|ouais|c'est note|note",
    ),
  ],
  ["dismiss", P("laisse tomber|non rien|rien|oublie(?: ca)?|c'est bon|c'est rien|annule|non merci|pas grave|tant pis|non laisse|non c'est bon|rien du tout|ignore|nevermind|fausse alerte|je me suis trompe(?:e)?")],
];

export function matchConversation(raw: string): ConversationIntent | null {
  const n = convNorm(raw);
  if (!n || n.split(" ").length > 12) return null;
  for (const [intent, re] of RULES) if (re.test(n)) return intent;
  return null;
}

/** Intents that answer the meta-question itself → must run BEFORE a pending question is resumed. */
export const META_INTENTS = new Set<ConversationIntent>(["repeat", "slower", "undo", "time", "date", "identity", "help", "silence"]);

export interface ConversationEnv {
  now: Date;
  /** last thing the assistant said (for "répète") */
  lastAnswer?: string;
  assistantName?: string;
  speakerName?: string;
  /** undo the previous command; resolves to the number of actions undone */
  undoLast?: () => Promise<number>;
  /** a question is waiting for an answer */
  hasPending?: boolean;
}

export interface ConversationReply {
  text: string;
  /** multiplier of the configured speaking rate (slower = 0.8) */
  rateFactor?: number;
  /** keep the pending question alive (repeat / help) */
  keepPending?: boolean;
  /** the reply is a repetition: always speak it, even in "needed" voice mode */
  forceSpeak?: boolean;
  /** never speak this reply ("tais-toi") */
  silent?: boolean;
  changed?: boolean;
}

const HELP =
  "Je peux gérer l'agenda (« Ajoute dentiste jeudi à 16h », « J'ai quoi demain ? »), les courses, les minuteurs, les rappels, la musique, la météo, les trajets et les modes de la maison. Dites « répète » si vous n'avez pas entendu.";

function pick<T>(arr: T[], now: Date): T {
  return arr[now.getSeconds() % arr.length];
}

export async function runConversation(intent: ConversationIntent, env: ConversationEnv): Promise<ConversationReply> {
  const name = env.assistantName || "HomeCal";
  const h = env.now.getHours();
  switch (intent) {
    case "repeat":
      return env.lastAnswer
        ? { text: env.lastAnswer, keepPending: true, forceSpeak: true, rateFactor: 0.95 }
        : { text: "Je n'ai encore rien dit. Que puis-je faire pour vous ?", keepPending: true, forceSpeak: true };
    case "slower":
      return env.lastAnswer
        ? { text: env.lastAnswer, keepPending: true, forceSpeak: true, rateFactor: 0.8 }
        : { text: "D'accord, je parlerai plus lentement.", keepPending: true, forceSpeak: true, rateFactor: 0.8 };
    case "undo": {
      if (!env.undoLast) return { text: "Il n'y a rien à annuler.", forceSpeak: true };
      const n = await env.undoLast();
      return n > 0 ? { text: "✓ C'est annulé.", changed: true, forceSpeak: true } : { text: "Il n'y a rien à annuler.", forceSpeak: true };
    }
    case "time":
      return { text: `Il est ${format(env.now, "H'h'mm", { locale: fr }).replace(/h00$/, " heures")}.`, forceSpeak: true };
    case "date":
      return { text: `Nous sommes le ${format(env.now, "EEEE d MMMM yyyy", { locale: fr }).replace(/^(\S+) 1 /, "$1 1er ")}.`, forceSpeak: true };
    case "identity":
      return { text: `Je suis ${name}, l'assistant de la maison.`, forceSpeak: true };
    case "help":
      return { text: HELP, keepPending: true, forceSpeak: true };
    case "howareyou":
      return { text: pick(["Très bien, merci ! Et vous ?", "Ça roule ! Que puis-je faire pour vous ?", "En pleine forme. Je vous écoute."], env.now), forceSpeak: true };
    case "greet": {
      const hello = h >= 18 || h < 4 ? "Bonsoir" : "Bonjour";
      return { text: `${hello}${env.speakerName ? ` ${env.speakerName}` : ""} ! Que puis-je faire pour vous ?`, forceSpeak: true };
    }
    case "goodnight":
      return { text: h >= 20 || h < 4 ? "Bonne nuit !" : "À bientôt !", forceSpeak: true };
    case "thanks":
      return { text: pick(["Avec plaisir !", "De rien !", "Je vous en prie."], env.now) };
    case "ack":
      return { text: "Très bien." };
    case "dismiss":
      return { text: env.hasPending ? "D'accord, j'annule." : "D'accord." };
    case "silence":
      return { text: "(silence)", silent: true };
  }
}
