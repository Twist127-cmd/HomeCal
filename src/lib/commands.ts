import { normalize } from "./profiles";
import type { Scene } from "./types";

/**
 * Deterministic voice commands for music, scenes and navigation.
 * Fast (no LLM) and predictable; anything else goes to the assistant.
 */

export type MusicCommand =
  | { op: "pause" }
  | { op: "resume" }
  | { op: "next" }
  | { op: "previous" }
  | { op: "volume"; value?: number; delta?: number }
  | { op: "current" }
  | { op: "playlist"; name: string }
  | { op: "query"; query: string }
  | { op: "device"; name: string };

const MUSIC_WORDS = /\b(musique|spotify|chanson|morceau|titre|playlist|son|volume|album|artiste|radio)\b/;

export function parseMusicCommand(input: string): MusicCommand | null {
  const raw = input.trim().replace(/^homecal[,\s]+/i, "").replace(/[.!]+$/, "");
  const n = normalize(raw).replace(/[’]/g, "'");
  const music = MUSIC_WORDS.test(n);

  // device: "mets Spotify sur l'enceinte du salon", "passe la musique sur la télé"
  let m = /\b(?:mets|passe|bascule|transfere|lance|joue)\s+(?:la\s+)?(?:musique|spotify|le son|la lecture)\s+(?:sur|dans)\s+(?:l'|le |la |les |mon |ma )?(.+)$/i.exec(raw);
  if (m) return { op: "device", name: m[1].replace(/^(enceinte|appareil)\s+(du|de la|de l'|des)?\s*/i, "").trim() || m[1] };

  if (/\b(qu'est-ce qui (joue|passe)|c'est quoi (cette|ce) (chanson|musique|morceau|titre)|quelle (est cette )?(chanson|musique)|qui chante|quel (est ce )?(morceau|titre))\b/.test(n)) {
    return { op: "current" };
  }

  m = /\b(?:mets|monte|baisse|regle)\s+(?:le\s+)?(?:son|volume)\s+(?:a|au)\s+(\d{1,3})\s*(?:%|pour ?cent)?/.exec(n) ?? /\bvolume\s+(?:a\s+)?(\d{1,3})\b/.exec(n);
  if (m) return { op: "volume", value: Math.min(100, Number(m[1])) };
  if (/\b(monte|augmente)\s+(le\s+)?(son|volume)\b|\bplus fort\b/.test(n)) return { op: "volume", delta: 15 };
  if (/\b(baisse|diminue)\s+(le\s+)?(son|volume)\b|\bmoins fort\b/.test(n)) return { op: "volume", delta: -15 };

  if (/\b(passe a la suivante|(chanson|morceau|titre|piste) suivante?|suivant|suivante|next|zappe)\b/.test(n) && (music || /^(suivant|suivante|passe a la suivante|next|zappe)/.test(n))) {
    return { op: "next" };
  }
  if (/\b((chanson|morceau|titre|piste) precedente?|precedent|precedente|reviens en arriere)\b/.test(n) && (music || /^(precedent|precedente)/.test(n))) {
    return { op: "previous" };
  }
  if (/^(pause|stop)$/.test(n) || (/\b(pause|stop|arrete|coupe|eteins)\b/.test(n) && /\b(musique|spotify|son|chanson|lecture)\b/.test(n) && !/\bminuteur/.test(n))) {
    return { op: "pause" };
  }

  m = /\b(?:mets|lance|joue|demarre|ecoute(?:r)?)\s+(?:ma |mon |la |le )?playlist\s+(.+)$/i.exec(raw) ?? /\b(?:mets|lance|joue)\s+(?:ma|mon)\s+(.+?)\s*$/i.exec(raw);
  if (m && (/playlist/i.test(raw) || /^(mets|lance|joue)\s+(ma|mon)\s/i.test(raw))) {
    const name = m[1].replace(/^(playlist|liste)\s+/i, "").trim();
    if (name && !/\b(reveil|minuteur|alarme)\b/.test(normalize(name))) return { op: "playlist", name };
  }

  if (/\b(reprends|relance|remets|continue|lance|mets|joue|demarre)\s+(la\s+)?(musique|spotify|lecture)\s*$/.test(n) || /^(play|lecture|reprends)$/.test(n)) {
    return { op: "resume" };
  }

  // "mets quelque chose de calme", "mets du Daft Punk", "joue Bohemian Rhapsody"
  m = /^(?:mets|joue|lance|ecoute)\s+(?:moi\s+)?(?:quelque chose de |un truc |de la musique |une musique |une chanson |un morceau |du |de la |des |l'album |la chanson |le morceau )(.+)$/i.exec(raw);
  if (m) return { op: "query", query: m[1].trim() };
  m = /^joue\s+(.+)$/i.exec(raw);
  if (m) return { op: "query", query: m[1].trim() };
  return null;
}

export type SceneCommand = { op: "activate"; scene: Scene } | { op: "exit" } | { op: "unknown"; name: string };

export function parseSceneCommand(input: string, scenes: Scene[]): SceneCommand | null {
  const n = normalize(input.replace(/^homecal[,\s]+/i, "")).replace(/[’]/g, "'").replace(/[.!?]+$/, "");
  if (/\b(quitte|quitter|sors|sortir|desactive|ferme|arrete)\b.*\b(mode|scene)\b|\bmode normal\b|\bmode calendrier\b/.test(n)) return { op: "exit" };
  const m = /\b(?:mode|scene|ambiance)\s+(?:de\s+|du\s+)?(.+)$/.exec(n);
  if (!m || !/\b(mode|scene|ambiance|passe en|active|lance)\b/.test(n)) return null;
  const want = m[1].replace(/^(la|le|l')\s*/, "").replace(/\b(soiree)\b/, "soir").trim();
  const scene =
    scenes.find((s) => normalize(s.name) === want) ??
    scenes.find((s) => normalize(s.name).startsWith(want) || want.startsWith(normalize(s.name)));
  return scene ? { op: "activate", scene } : { op: "unknown", name: m[1] };
}

export type NavigationCommand = { op: "departure"; query?: string } | { op: "route"; query?: string; app?: "waze" | "google" | "apple" };

export function parseNavigationCommand(input: string): NavigationCommand | null {
  const raw = input.trim().replace(/^homecal[,\s]+/i, "").replace(/[?.!]+$/, "");
  const n = normalize(raw).replace(/[’]/g, "'");
  const app = /\bwaze\b/.test(n) ? "waze" : /\bgoogle\s*maps?\b/.test(n) ? "google" : /\b(plans|apple maps)\b/.test(n) ? "apple" : undefined;
  const target = (s: string) => {
    const m = /\b(?:pour|vers|jusqu'a|jusqu'au)\s+(?:mon |ma |le |la |l')?(.+)$/i.exec(s);
    const q = m?.[1]?.trim();
    return !q || /^prochain(e)? (rendez-vous|rdv|evenement|événement)$/i.test(normalize(q)) ? undefined : q;
  };
  if (app || /\b(itineraire|lance la navigation|guide-moi|emmene-moi|ouvre (le )?gps)\b/.test(n)) return { op: "route", app, query: target(raw) };
  if (/\b(quand|a quelle heure)\s+(dois-je|je dois|faut-il|il faut)\s+partir\b|\bheure de depart\b|\bje pars quand\b/.test(n)) return { op: "departure", query: target(raw) };
  return null;
}
