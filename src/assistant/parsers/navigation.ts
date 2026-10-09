import type { Utterance } from "../router/normalize";
import { call, type DomainModule } from "../router/types";
import { navigationResponse } from "../responses/navigation";

/**
 * Navigation: navigation.open (Waze / Google Maps / Plans), navigation.nextDeparture,
 * navigation.travelTime.
 */

type App = "waze" | "google" | "apple";

function appOf(n: string): App | undefined {
  if (/\bwaze\b/.test(n)) return "waze";
  if (/\bgoogle\s*maps?\b|\bmaps\b|\bgoogle map\b/.test(n)) return "google";
  if (/\b(apple plans|apple maps|plans)\b/.test(n)) return "apple";
  return undefined;
}

/** "pour le dentiste", "vers le CrossFit", "au CrossFit" → "dentiste" / "CrossFit" (undefined = next appointment) */
function targetOf(text: string): string | undefined {
  const m =
    /\b(?:pour|vers|jusqu'à|jusqu'a|jusqu'au|jusque|à|a|au|aux|chez)\s+(?:mon |ma |mes |le |la |les |l'|l’)?(.+?)\s*[?.!]*$/i.exec(text.replace(/[’]/g, "'"));
  let q = m?.[1]?.trim();
  if (!q) return undefined;
  // "pour aller au CrossFit" → "CrossFit"
  q = q.replace(/^(?:aller|y aller|me rendre|se rendre|nous rendre)\s+(?:jusqu'au |jusqu'à |au |aux |à la |a la |à l'|a l'|à |a |chez )?/i, "").trim();
  if (!q) return undefined;
  const n = q
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  if (/^(prochain|prochaine)( (rendez-vous|rdv|evenement|truc|activite))?$|^(y aller|y|aller|la-bas|la bas|quelle heure.*|combien.*)$/.test(n)) return undefined;
  if (/^(rendez-vous|rdv)$/.test(n)) return undefined;
  return q;
}

export function parseNavigation(u: Utterance): { intent: string; confidence: number; entities: Record<string, unknown> } | null {
  const n = u.norm.replace(/[.,!?]+$/g, "").trim();
  if (/\bspotify\b|\bmusique\b/.test(n)) return null;
  const app = appOf(n);

  // ---- travel time: "combien de temps pour y aller ?"
  if (
    /\b(combien de temps|temps de (trajet|route|parcours)|il faut combien de temps|c'est a combien de temps|duree du trajet|combien de minutes)\b/.test(n) &&
    !/\b(minuteur|reste|restant|ca fait|depuis|pendant)\b/.test(n)
  ) {
    return { intent: "navigation.travelTime", confidence: 0.92, entities: { query: targetOf(u.text) } };
  }

  // ---- departure time
  if (
    /\b(quand|a quelle heure|vers quelle heure)\s+(est-ce que\s+)?(dois-je|je dois|faut-il|il faut|je pars|dois je|est-ce que je pars|je devrais|devrais-je|partir|on part|doit-on|on doit)\b/.test(n) ||
    /\b(heure de depart|je pars quand|on part quand|c'est quand que je pars|quand partir|depart conseille|faut que je parte quand)\b/.test(n) ||
    /\b(je dois|dois-je|faut-il|il faut|on doit|je devrais)\s+partir\s+(a|vers)\s+quelle heure\b/.test(n) ||
    /\b(je dois|dois-je|on doit|doit-on|il faut|faut)\s+(partir|y aller|decoller|bouger)\s+quand\b/.test(n) ||
    /\b(il faut que je|faut que je|il faut qu'on|faut qu'on)\s+(parte|partions|y aille|bouge)\s+(a quelle heure|vers quelle heure|quand)\b/.test(n)
  ) {
    return { intent: "navigation.nextDeparture", confidence: 0.94, entities: { query: targetOf(u.text) } };
  }

  // ---- open navigation app / itinerary
  if (app && (/^(ouvre|lance|demarre|mets|utilise|allume|active|go|vas sur)\b/.test(n) || n.split(" ").length <= 2 || /\b(itineraire|direction|emmene|guide|conduis|navigation)\b/.test(n))) {
    if (app === "apple" && !/^(ouvre|lance|demarre|utilise)\b|apple/.test(n)) return null; // "plans" alone is too vague
    return { intent: "navigation.open", confidence: 0.94, entities: { app, query: targetOf(u.text) } };
  }
  if (/\b(itineraire|lance la navigation|lance le gps|ouvre le gps|gps|emmene-moi|emmene moi|guide-moi|guide moi|conduis-moi|conduis moi|ramene-moi|ramene moi|ramene-nous|ramene nous|on y va|direction le|route vers)\b/.test(n)) {
    return { intent: "navigation.open", confidence: 0.92, entities: { app, query: targetOf(u.text) } };
  }
  return null;
}

export const navigationModule: DomainModule = {
  domain: "navigation",

  parse(u) {
    const p = parseNavigation(u);
    return p ? { ...p, raw: u.raw } : null;
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
