import { normalize } from "@/lib/profiles";
import type { Utterance } from "../router/normalize";
import { call, type DomainModule, type ParsedIntent } from "../router/types";
import { musicResponse } from "../responses/music";

/**
 * Music (Spotify Connect remote):
 *   music.play / pause / resume / next / previous / volume / device / current / playlist / search
 *
 * Built on `u.norm` (lower-case, no accents, canonical verbs: mettre→mets, lancer→lance…).
 * Sentences carrying a date, time or duration, or shopping / timer / scene markers are left
 * to their own domains (calendar, timers, shopping, scenes).
 */

const MUSIC_WORDS = /\b(musique|spotify|chanson|morceau|titre|playlist|playlists|son|volume|album|artiste|zik|music|lecture|piste)\b/;
const PLAY_VERBS = "mets|lance|joue|ecoute|demarre|passe|envoie|balance|remets|relance";

const WEEKDAYS = "lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche";
/** date / time / duration → calendar, reminders or timers, never music */
const TEMPORAL = new RegExp(
  String.raw`\b\d{1,2}\s*h(\s*\d{2})?\b|\b\d{1,2}:\d{2}\b|\b\d+\s*(minutes?|min|mn|secondes?|sec|heures?)\b|\b(demain|apres-demain|aujourd'hui|ce soir|ce matin|cet apres-midi|midi|minuit|${WEEKDAYS})\b|\b\d{1,2}\s+(janvier|fevrier|mars|avril|mai|juin|juillet|aout|septembre|octobre|novembre|decembre)\b|\b(une|un|deux|trois|quatre|cinq|dix|quinze|vingt|trente)\s+(minutes?|heures?|secondes?)\b`,
);
/** other domains' markers */
const OTHER_DOMAIN = /\b(courses|commissions|liste|minuteurs?|minuterie|chrono|timer|mode|scene|ambiance|rappel|rappelle|rendez-vous|rdv|reunion|itineraire|waze|maps|gps|meteo|pleuvoir|pluie|temps qu'il)\b/;
/** shopping-like objects ("mets 2 bouteilles de lait") */
const SHOPPING_LIKE = /^(\d+|un|une|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|douze)\b|\b(bouteilles?|kilos?|kg|grammes?|litres?|paquets?|boites?|sachets?|douzaines?|tranches?|pots?)\b/;

const DEVICE_RE = new RegExp(
  String.raw`\b(?:${PLAY_VERBS}|bascule|transfere|deplace)\s+(?:la |le |l'|de la )?(?:musique|spotify|son|lecture|chanson|morceau|ca)\s+(?:sur|dans|vers)\s+(.+)$`,
);

const GENRES =
  /^(rock|jazz|pop|rap|hip-hop|hip hop|rnb|r&b|classique|musique classique|electro|electronique|reggae|blues|funk|soul|metal|techno|house|disco|country|variete|chanson francaise|lofi|lo-fi|ambient|piano|opera|salsa|kpop|k-pop|punk|folk|gospel|zouk|afro|latino|annees 80|annees 90|années 80|années 90)\b/;

/** "Mets du Daft Punk", "Mets de la Céline Dion": the object starts with a capital → artist. */
function properNoun(text: string): boolean {
  const m = /\b(?:du|de la|des|de l'|d')\s+(\p{Lu})/u.exec(text);
  return !!m;
}

export interface MusicParse {
  intent: string;
  confidence: number;
  entities: Record<string, unknown>;
}

function cleanDevice(s: string): string {
  return s
    .replace(/^(l'|le |la |les |mon |ma |mes )/, "")
    .replace(/^(enceinte|enceintes|appareil|haut-parleur|haut parleur|tele|tv|television)\s+(du |de la |de l'|des |de )?/, (m, w) => (/tele|tv|television/.test(w) ? `${w} ` : ""))
    .replace(/^(du |de la |de l'|des )/, "")
    .trim();
}

function cleanQuery(s: string): string {
  return s
    .replace(/^(moi |nous )/, "")
    .replace(/\s+(sur spotify|stp|svp|s'il te plait)$/, "")
    .trim();
}

/** Pure parsing on the normalized sentence (exported for tests). */
export function parseMusic(u: Utterance): MusicParse | null {
  const n = u.norm.replace(/[.,!?]+$/g, "").trim();
  if (!n) return null;
  const music = MUSIC_WORDS.test(n);

  // ---- device: "mets Spotify sur le salon", "passe la musique sur l'enceinte du salon"
  const dev = DEVICE_RE.exec(n) ?? (music ? /\b(?:sur|dans)\s+(?:l'|le |la )?(enceinte|enceintes)\s+(?:du |de la |de l'|des )?(.+)$/.exec(n) : null);
  if (dev) {
    const name = cleanDevice(dev.length > 2 && dev[2] ? dev[2] : dev[1]);
    if (name) return { intent: "music.device", confidence: 0.93, entities: { device: name } };
  }

  // ---- what is playing
  if (
    /\b(qu'est-ce qui (joue|passe)|qu'est ce qui (joue|passe)|qui joue|ca joue quoi|c'est quoi (cette|ce|la) (chanson|musique|morceau|titre|son)|quelle (est cette |est la )?(chanson|musique)|qui chante|quel (est ce |est le )?(morceau|titre|artiste)|c'est quoi qui passe|on ecoute quoi|qu'est-ce qu'on ecoute|tu joues quoi)\b/.test(
      n,
    )
  ) {
    return { intent: "music.current", confidence: 0.95, entities: {} };
  }
  if (/^(c'est quoi|qu'est-ce que c'est)$/.test(n)) return null;

  // ---- volume
  let m = /\b(?:mets|monte|baisse|regle|passe|ajuste)\s+(?:le\s+|la\s+)?(?:son|volume|musique)\s+(?:a|au|sur)\s+(\d{1,3})\s*(?:%|pour ?cent|pourcent)?/.exec(n) ?? /\b(?:volume|son)\s+(?:a|au)?\s*(\d{1,3})\s*(?:%|pour ?cent|pourcent)?\b/.exec(n);
  if (m) return { intent: "music.volume", confidence: 0.95, entities: { value: Math.min(100, Number(m[1])) } };
  if (/\b(monte|augmente|hausse)\s+(un peu\s+)?(le\s+|la\s+)?(son|volume|musique)\b|\b(plus fort|un peu plus fort|monte le|plus de son)\b/.test(n)) {
    return { intent: "music.volume", confidence: 0.94, entities: { delta: /un peu/.test(n) ? 10 : 15 } };
  }
  if (/\b(baisse|diminue|reduis)\s+(un peu\s+)?(le\s+|la\s+)?(son|volume|musique)\b|\b(moins fort|un peu moins fort|baisse le|moins de son)\b/.test(n)) {
    return { intent: "music.volume", confidence: 0.94, entities: { delta: /un peu/.test(n) ? -10 : -15 } };
  }
  if (/\b(coupe le son|mets en sourdine|sourdine|mute)\b/.test(n)) return { intent: "music.volume", confidence: 0.92, entities: { value: 0 } };

  // ---- other domains first (after the explicit music checks above)
  const otherDomain = OTHER_DOMAIN.test(n) && !/\bplaylist\b/.test(n);

  // ---- next / previous
  if (
    !otherDomain &&
    /^(suivante?|next|zappe|skip|passe|change)$|\b(passe a la (chanson |musique |piste )?suivante|passe au (morceau |titre )?suivant|(chanson|morceau|titre|piste|musique) suivante?|chanson d'apres|morceau d'apres|change de (chanson|morceau|musique|titre)|zappe (cette |la )?(chanson|musique)?|skip|la suivante|le suivant|suivant stp)\b/.test(
      n,
    )
  ) {
    return { intent: "music.next", confidence: 0.95, entities: {} };
  }
  if (
    !otherDomain &&
    /^(precedente?|previous)$|\b((chanson|morceau|titre|piste|musique) precedente?|reviens (a la |au )?(chanson |morceau )?precedente?|reviens en arriere|remets la (chanson )?precedente|la precedente|le precedent|retour en arriere|chanson d'avant|morceau d'avant)\b/.test(
      n,
    )
  ) {
    return { intent: "music.previous", confidence: 0.95, entities: {} };
  }

  // ---- pause
  if (/^(pause|stop|chut|silence)$/.test(n) || /^(mets en pause|met pause|pause stp)$/.test(n)) return { intent: "music.pause", confidence: 0.95, entities: {} };
  if (
    !/\b(minuteurs?|chrono|timer)\b/.test(n) &&
    (/\b(pause|stop|stoppe|arrete|coupe|eteins|suspends?)\b.*\b(musique|spotify|son|chanson|lecture|morceau|zik)\b/.test(n) || /\b(musique|spotify|lecture)\b.*\ben pause\b/.test(n) || /^mets (la musique )?en pause$/.test(n))
  ) {
    return { intent: "music.pause", confidence: 0.95, entities: {} };
  }

  // ---- resume / play something unspecified
  if (/^(reprends?|play|lecture|relance|continue|joue|vas-y|remets|mets la musique)$/.test(n)) return { intent: "music.resume", confidence: 0.92, entities: {} };
  if (
    !/\b(minuteurs?|chrono|timer)\b/.test(n) &&
    (new RegExp(String.raw`^(?:${PLAY_VERBS}|reprends|ouvre|allume)\s+(?:la |le |de la |du |un peu de |un peu |une )?(?:musique|spotify|lecture|son|zik|music)$`).test(n) ||
      /^(reprends|relance|continue|remets) (la |le )?(musique|lecture|spotify|son|chanson|morceau)\b/.test(n) ||
      /^(de la musique|musique|spotify)$/.test(n))
  ) {
    return { intent: "music.resume", confidence: 0.94, entities: {} };
  }

  // ---- explicit playlist: "mets ma playlist cuisine", "lance la playlist Morning Chill"
  m = new RegExp(String.raw`\b(?:${PLAY_VERBS}|reprends)?\s*(?:moi |nous )?(?:ma |mon |la |une |notre |nos |mes )?playlists?\s+(?:de |du |des |d')?(.+)$`).exec(n);
  if (m) {
    const name = cleanQuery(m[1]);
    if (name && !TEMPORAL.test(name)) return { intent: "music.playlist", confidence: 0.94, entities: { name } };
  }

  if (otherDomain || TEMPORAL.test(n)) return null;

  // ---- "mets ma/mon X" → user playlist
  m = new RegExp(String.raw`^(?:${PLAY_VERBS})\s+(?:moi |nous )?(?:ma|mon|notre|mes)\s+(.+)$`).exec(n);
  if (m) {
    const name = cleanQuery(m[1]);
    if (name && !SHOPPING_LIKE.test(name)) return { intent: "music.playlist", confidence: 0.88, entities: { name } };
  }

  // ---- "mets quelque chose de calme", "mets de la musique calme", "joue du jazz"
  m = new RegExp(
    String.raw`^(?:${PLAY_VERBS})\s+(?:moi |nous )?(?:quelque chose de |un truc |un son |une ambiance |de la musique |une musique |de la zik |une chanson |un morceau |un titre |l'album |la chanson |le morceau |le titre |les chansons de |des chansons de |du |de la |des |de l'|d')(.+)$`,
  ).exec(n);
  if (m) {
    const query = cleanQuery(m[1]);
    if (query && !SHOPPING_LIKE.test(query)) {
      const strong =
        /^(?:\S+)\s+(?:moi |nous )?(quelque chose|de la musique|une musique|une chanson|un morceau|l'album|la chanson|le morceau|un son|un truc|une ambiance|les chansons|des chansons)/.test(n) ||
        GENRES.test(query) ||
        properNoun(u.text);
      return { intent: "music.play", confidence: strong ? 0.93 : 0.85, entities: { query } };
    }
  }

  // ---- "mets de la musique calme" (no other word) / "musique de film"
  m = /^(?:musique|chanson|playlist)\s+(.+)$/.exec(n);
  if (m && !/\b(suivante?|precedente?)\b/.test(m[1])) return { intent: "music.play", confidence: 0.85, entities: { query: cleanQuery(m[1]) } };

  // ---- generic "mets X" / "lance X" / "joue X" / "écoute X"
  m = new RegExp(String.raw`^(?:${PLAY_VERBS})\s+(?:moi |nous )?(?:le |la |les |l'|un |une )?(.+)$`).exec(n);
  if (m) {
    const query = cleanQuery(m[1]);
    if (!query || SHOPPING_LIKE.test(query) || query.split(" ").length > 6) return null;
    if (/^(en|a|au|sur|dans|pour|de)\b/.test(query)) return null; // "passe en cuisine", "mets à jour"
    const verb = n.split(" ")[0];
    const confidence = verb === "joue" || verb === "ecoute" ? 0.88 : music ? 0.88 : 0.8;
    return { intent: "music.play", confidence, entities: { query } };
  }
  return null;
}

/** Generic one-word queries are probably playlist names ("Lance Chill"); the others go to search. */
function looksLikePlaylistName(q: string): boolean {
  return q.trim().split(/\s+/).length === 1 && q.length >= 3;
}

export const musicModule: DomainModule = {
  domain: "music",

  parse(u) {
    const p = parseMusic(u);
    return p ? { ...p, raw: u.raw } : null;
  },

  async run(p: ParsedIntent, env) {
    const e = p.entities as { value?: number; delta?: number; name?: string; query?: string; device?: string };
    let name: string;
    let args: Record<string, unknown>;
    switch (p.intent) {
      case "music.pause":
        [name, args] = ["pauseMusic", {}];
        break;
      case "music.resume":
        [name, args] = ["resumeMusic", {}];
        break;
      case "music.next":
        [name, args] = ["nextTrack", {}];
        break;
      case "music.previous":
        [name, args] = ["previousTrack", {}];
        break;
      case "music.volume":
        [name, args] = ["setMusicVolume", { volume: e.value, delta: e.delta }];
        break;
      case "music.current":
        [name, args] = ["getCurrentTrack", {}];
        break;
      case "music.device":
        [name, args] = ["changeMusicDevice", { device: e.device }];
        break;
      case "music.playlist":
        [name, args] = ["playPlaylist", { name: e.name }];
        break;
      case "music.search":
        [name, args] = ["searchMusic", { query: e.query }];
        break;
      default: {
        // music.play: one-word query → user playlists first, otherwise Spotify search
        const q = e.query ?? "";
        [name, args] = q && looksLikePlaylistName(q) ? ["playPlaylist", { name: q }] : ["playMusic", { query: q || undefined }];
      }
    }
    const a = await call(env, name, args, name === "playPlaylist" || name === "playMusic" ? "Je lance la musique…" : undefined);
    const choices = (a.result.data as { choices?: string[] } | undefined)?.choices;
    const intentForText = name === "playPlaylist" ? "music.playlist" : p.intent;
    return {
      text: musicResponse(intentForText, a.result),
      actions: [a],
      changed: !!a.result.changed,
      pending: !a.result.ok && choices?.length ? { domain: "music", kind: "choice", data: { choices, tool: name === "playPlaylist" ? "playPlaylist" : "playMusic" } } : undefined,
    };
  },

  async resume(pending, u, env) {
    if (pending.kind !== "choice") return null;
    const choices = (pending.data.choices as string[]) ?? [];
    const ordinals = ["premier|premiere|1|un|une", "deuxieme|second|seconde|2|deux", "troisieme|3|trois", "quatrieme|4|quatre"];
    const idx = ordinals.findIndex((o) => new RegExp(`\\b(${o})\\b`).test(u.norm));
    const pick =
      idx >= 0 && idx < choices.length
        ? choices[idx]
        : choices.find((c) => {
            const nc = normalize(c);
            return u.norm.includes(nc) || nc.includes(u.norm) || u.norm.split(" ").some((w) => w.length > 3 && nc.split(" ").includes(w) && !choices.every((o) => normalize(o).split(" ").includes(w)));
          });
    if (!pick) return null;
    const tool = String(pending.data.tool);
    const a = await call(env, tool, tool === "playPlaylist" ? { name: pick } : { query: pick }, "Je lance la musique…");
    return { text: musicResponse(tool === "playPlaylist" ? "music.playlist" : "music.play", a.result), actions: [a], changed: !!a.result.changed };
  },
};
