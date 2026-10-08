import { describe, expect, it } from "vitest";
import { handleUtterance } from "@/assistant/agent";
import { route } from "@/assistant/router/intentRouter";
import { places, profiles } from "../fixtures";
import { makeAssistant, NOW } from "../helpers/assistant";
import { DEFAULT_SCENES, type Scene } from "@/lib/types";

const scenes: Scene[] = DEFAULT_SCENES.map((s, i) => ({ ...s, id: `s${i}` }));
const ctx = { now: NOW, profiles, places, scenes, currentProfileId: "clement" };

type Row = [string, string, Record<string, unknown>?];

/** phrase → expected intent (+ entities subset). Clean, familiar, voice-like, short, polite. */
const CORPUS: Row[] = [
  // pause
  ["Pause", "music.pause"],
  ["pause", "music.pause"],
  ["Stop", "music.pause"],
  ["Pause la musique", "music.pause"],
  ["Mets la musique en pause", "music.pause"],
  ["Mets en pause", "music.pause"],
  ["Arrête la musique", "music.pause"],
  ["arrete la musique stp", "music.pause"],
  ["Coupe la musique", "music.pause"],
  ["Stop Spotify", "music.pause"],
  ["Mets Spotify en pause", "music.pause"],
  ["euh pause la musique s'il te plaît", "music.pause"],
  ["Tu peux mettre la musique en pause ?", "music.pause"],
  ["Éteins la musique", "music.pause"],
  ["Coupe Spotify", "music.pause"],
  ["Arrête la chanson", "music.pause"],
  // resume
  ["Reprends", "music.resume"],
  ["Reprends la musique", "music.resume"],
  ["Relance la musique", "music.resume"],
  ["Remets la musique", "music.resume"],
  ["Continue la musique", "music.resume"],
  ["Lance Spotify", "music.resume"],
  ["Mets Spotify", "music.resume"],
  ["Ouvre Spotify", "music.resume"],
  ["Mets de la musique", "music.resume"],
  ["Lance de la musique", "music.resume"],
  ["Joue de la musique", "music.resume"],
  ["Mets un peu de musique", "music.resume"],
  ["Play", "music.resume"],
  ["Musique", "music.resume"],
  ["De la musique s'il te plaît", "music.resume"],
  ["HomeCal, mets de la musique", "music.resume"],
  ["Reprends la lecture", "music.resume"],
  // next
  ["Suivante", "music.next"],
  ["Suivant", "music.next"],
  ["Passe à la suivante", "music.next"],
  ["Passe à la chanson suivante", "music.next"],
  ["Chanson suivante", "music.next"],
  ["Morceau suivant", "music.next"],
  ["Titre suivant", "music.next"],
  ["Next", "music.next"],
  ["Zappe", "music.next"],
  ["Zappe cette chanson", "music.next"],
  ["Change de chanson", "music.next"],
  ["La suivante", "music.next"],
  ["Passe au morceau suivant", "music.next"],
  ["euh suivante stp", "music.next"],
  ["Skip", "music.next"],
  // previous
  ["Précédente", "music.previous"],
  ["Précédent", "music.previous"],
  ["Chanson précédente", "music.previous"],
  ["Morceau précédent", "music.previous"],
  ["Reviens à la chanson précédente", "music.previous"],
  ["Remets la précédente", "music.previous"],
  ["La précédente", "music.previous"],
  ["Reviens en arrière", "music.previous"],
  // volume
  ["Mets le son à 30 %", "music.volume", { value: 30 }],
  ["Mets le son à 30", "music.volume", { value: 30 }],
  ["Mets le volume à 50 %", "music.volume", { value: 50 }],
  ["Volume à 20", "music.volume", { value: 20 }],
  ["Volume 70", "music.volume", { value: 70 }],
  ["Règle le volume à 40 pour cent", "music.volume", { value: 40 }],
  ["Baisse le son à 10", "music.volume", { value: 10 }],
  ["Monte le son", "music.volume", { delta: 15 }],
  ["Monte un peu le son", "music.volume", { delta: 10 }],
  ["Augmente le volume", "music.volume", { delta: 15 }],
  ["Plus fort", "music.volume", { delta: 15 }],
  ["Baisse le son", "music.volume", { delta: -15 }],
  ["Baisse un peu le volume", "music.volume", { delta: -10 }],
  ["Diminue le son", "music.volume", { delta: -15 }],
  ["Moins fort", "music.volume", { delta: -15 }],
  ["Moins fort s'il te plaît", "music.volume", { delta: -15 }],
  ["Coupe le son", "music.volume", { value: 0 }],
  ["Mets en sourdine", "music.volume", { value: 0 }],
  // current
  ["Qu'est-ce qui joue ?", "music.current"],
  ["Qu'est-ce qui passe ?", "music.current"],
  ["C'est quoi cette musique ?", "music.current"],
  ["C'est quoi cette chanson ?", "music.current"],
  ["C'est quoi ce morceau ?", "music.current"],
  ["Quelle est cette chanson ?", "music.current"],
  ["Qui chante ?", "music.current"],
  ["Quel est ce titre ?", "music.current"],
  ["On écoute quoi ?", "music.current"],
  ["Ça joue quoi ?", "music.current"],
  // device
  ["Mets Spotify sur le salon", "music.device", { device: "salon" }],
  ["Mets la musique sur l'enceinte du salon", "music.device", { device: "salon" }],
  ["Passe la musique sur la cuisine", "music.device", { device: "cuisine" }],
  ["Mets le son sur l'iPhone de Clément", "music.device", { device: "iphone de clement" }],
  ["Bascule la musique sur la chambre", "music.device", { device: "chambre" }],
  ["Transfère Spotify sur mon ordinateur", "music.device", { device: "ordinateur" }],
  ["Envoie la musique sur le salon", "music.device", { device: "salon" }],
  // playlists
  ["Mets ma playlist cuisine", "music.playlist", { name: "cuisine" }],
  ["Mets ma playlist Chill", "music.playlist", { name: "chill" }],
  ["Lance la playlist Morning Chill", "music.playlist", { name: "morning chill" }],
  ["Lance ma playlist du matin", "music.playlist", { name: "matin" }],
  ["Joue la playlist Relax", "music.playlist", { name: "relax" }],
  ["Playlist cuisine", "music.playlist", { name: "cuisine" }],
  ["Mets ma musique de cuisine", "music.playlist"],
  ["Lance mes titres likés", "music.playlist", { name: "titres likes" }],
  ["Mets ma playlist sport", "music.playlist", { name: "sport" }],
  ["Remets la playlist Chill Vibes", "music.playlist", { name: "chill vibes" }],
  // play / search
  ["Lance Chill", "music.play", { query: "chill" }],
  ["Mets Daft Punk", "music.play", { query: "daft punk" }],
  ["Mets Instant Crush", "music.play", { query: "instant crush" }],
  ["Joue Bohemian Rhapsody", "music.play", { query: "bohemian rhapsody" }],
  ["Mets du Daft Punk", "music.play", { query: "daft punk" }],
  ["Mets quelque chose de calme", "music.play", { query: "calme" }],
  ["Mets de la musique calme", "music.play", { query: "calme" }],
  ["Joue du jazz", "music.play", { query: "jazz" }],
  ["Mets du rock", "music.play", { query: "rock" }],
  ["Mets l'album Random Access Memories", "music.play", { query: "random access memories" }],
  ["Écoute Stromae", "music.play", { query: "stromae" }],
  ["Mets une chanson de Céline Dion", "music.play", { query: "de celine dion" }],
  ["Lance Angèle", "music.play", { query: "angele" }],
  ["Mets un truc qui bouge", "music.play", { query: "qui bouge" }],
];

/** Not music: must route elsewhere (or not execute as music). */
const NEGATIVE: string[] = [
  "Mets le CrossFit à 19h",
  "Mets CrossFit demain à 18h30",
  "Mets 10 minutes pour le four",
  "Mets du lait dans la liste",
  "Mets du lait sur la liste",
  "Mets 2 bouteilles de lait",
  "Mets le mode matin",
  "Passe en cuisine",
  "Pause le minuteur",
  "Reprends le minuteur",
  "Ajoute dentiste jeudi à 16h",
  "Lance un minuteur de 8 minutes",
  "Lance l'itinéraire",
  "Ouvre Waze",
  "Mets un rappel à 18h",
  "Qu'est-ce que j'ai demain ?",
  "Quel temps fait-il ?",
  "Mode cuisine",
  "Passe en mode soirée",
  "Mets des œufs dans la liste",
];

describe("music corpus (router)", () => {
  it(`has ≥ 100 phrasings`, () => expect(CORPUS.length).toBeGreaterThanOrEqual(100));

  it.each(CORPUS)("%s → %s", (phrase, intent, entities) => {
    const d = route(phrase, ctx);
    expect(d.best?.intent).toBe(intent);
    expect(d.execute).toBe(true);
    if (entities) expect(d.best?.entities).toMatchObject(entities);
  });

  it("≥ 95 % of control commands are executed without the LLM", () => {
    const control = CORPUS.filter(([, i]) => /pause|resume|next|previous|volume|current|device/.test(i));
    const ok = control.filter(([p, i]) => {
      const d = route(p, ctx);
      return d.execute && d.best?.intent === i;
    });
    expect(ok.length / control.length).toBeGreaterThanOrEqual(0.95);
  });

  it.each(NEGATIVE)("not music: %s", (phrase) => {
    const d = route(phrase, ctx);
    const musicExecuted = d.execute && d.best?.module.domain === "music";
    expect(musicExecuted).toBe(false);
  });
});

describe("music end-to-end (no LLM)", () => {
  const say = async (input: string, a = makeAssistant(), pending?: Parameters<typeof handleUtterance>[0]["pending"]) => ({
    a,
    r: await handleUtterance({ ...a.base, input, pending }),
  });

  it("controls the player with short deterministic answers", async () => {
    const a = makeAssistant();
    expect((await say("Pause la musique", a)).r.text).toBe("⏸ Musique en pause.");
    expect((await say("Reprends", a)).r.text).toBe("▶ Lecture reprise.");
    expect((await say("Passe à la suivante", a)).r.text).toBe("⏭ Morceau suivant.");
    expect((await say("Précédente", a)).r.text).toBe("⏮ Morceau précédent.");
    expect((await say("Mets le son à 30 %", a)).r.text).toBe("🔊 Volume à 30 %.");
    expect(a.musicLog).toEqual(["pause", "play", "next", "previous", "volume:30"]);
  });

  it("relative volume uses the current device volume", async () => {
    const a = makeAssistant();
    await say("Monte le son", a);
    expect(a.musicLog).toEqual(["volume:55"]);
  });

  it("answers what is playing", async () => {
    const { r } = await say("C'est quoi cette musique ?");
    expect(r.text).toBe("En lecture : Instant Crush de Daft Punk sur Salon.");
    expect(r.metrics?.llmCalls).toBe(0);
  });

  it("moves playback to a device", async () => {
    const a = makeAssistant();
    const { r } = await say("Mets Spotify sur l'iPhone de Clément", a);
    expect(r.text).toBe("✓ Musique sur iPhone de Clément.");
    expect(a.musicLog).toContain("transfer:d2");
  });

  it("plays a user playlist by name", async () => {
    const a = makeAssistant();
    const { r } = await say("Mets ma playlist cuisine", a);
    expect(a.musicLog.at(-1)).toBe("playUri:spotify:playlist:kitchen");
    expect(r.text).toBe("▶ Playlist « Cuisine » lancée.");
  });

  it("'Lance Chill' looks at user playlists first and asks when ambiguous, then plays the choice", async () => {
    const a = makeAssistant();
    const { r } = await say("Lance Chill", a);
    expect(r.text).toMatch(/Lequel/);
    expect(r.pending).toMatchObject({ domain: "music", kind: "choice" });
    const { r: r2 } = await say("la deuxième", a, r.pending);
    expect(a.musicLog.at(-1)).toBe("playUri:spotify:playlist:chill2");
    expect(r2.metrics?.llmCalls).toBe(0);
  });

  it("choice can also be given by name", async () => {
    const a = makeAssistant();
    const { r } = await say("Mets ma playlist chill", a);
    await say("Chill Vibes", a, r.pending);
    expect(a.musicLog.at(-1)).toBe("playUri:spotify:playlist:chill1");
  });

  it("multi-word queries go to Spotify search and play the top hit", async () => {
    const a = makeAssistant();
    await say("Mets Daft Punk", a);
    expect(a.musicLog.at(-1)).toBe("playUri:spotify:artist:daftpunk");
    await say("Mets Instant Crush", a);
    expect(a.musicLog.at(-1)).toBe("playUri:spotify:artist:instantcrush");
  });

  it("never contradicts a successful tool and never calls the LLM for control commands", async () => {
    for (const p of ["Pause", "Suivante", "Baisse le son", "Mets de la musique", "Qu'est-ce qui joue ?"]) {
      const { r } = await say(p);
      expect(r.actions[0]?.result.ok).toBe(true);
      expect(r.text).not.toMatch(/pas compris|ne comprends|aucun élément/i);
      expect(r.metrics?.llmCalls).toBe(0);
    }
  });

  it("clear message when Spotify is not connected", async () => {
    const a = makeAssistant({ music: null });
    const { r } = await say("Pause la musique", a);
    expect(r.text).toMatch(/Spotify/);
  });
});
