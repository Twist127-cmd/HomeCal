import { describe, expect, it } from "vitest";
import { handleUtterance } from "@/assistant/agent";
import { ToolExecutor, type ToolContext } from "@/assistant/executor";
import { DEFAULT_SCENES, DEFAULT_SETTINGS, type Scene, type ShoppingItem, type Timer } from "@/lib/types";
import { MemoryCalendarProvider } from "@/providers/calendar/MemoryCalendarProvider";
import { MusicError, SpotifyProvider, type MusicItem, type MusicProvider, type PlaybackState } from "@/providers/music";
import { d, ev, places, profiles } from "./fixtures";

const now = d(2026, 10, 8, 18, 0);

function fakeMusic(connected = true) {
  const log: string[] = [];
  let volume = 40;
  const playlists: MusicItem[] = [
    { uri: "spotify:playlist:chill1", type: "playlist", name: "Chill Vibes" },
    { uri: "spotify:playlist:chill2", type: "playlist", name: "Chill Evening" },
    { uri: "spotify:playlist:kitchen", type: "playlist", name: "Cuisine" },
  ];
  const playback = (): PlaybackState => ({
    isPlaying: true,
    item: { uri: "spotify:track:1", type: "track", name: "Instant Crush", subtitle: "Daft Punk" },
    progressMs: 0,
    durationMs: 1000,
    device: { id: "d1", name: "Salon", type: "Speaker", isActive: true, volume, supportsVolume: true },
    shuffle: false,
    fetchedAt: 0,
  });
  const m: MusicProvider = {
    id: "spotify",
    label: "Spotify",
    isConnected: () => connected,
    connect: async () => {},
    disconnect: async () => {},
    getProfile: async () => ({ id: "u", name: "Clément", product: "premium" }),
    getCurrentPlayback: async () => playback(),
    play: async () => void log.push("play"),
    pause: async () => void log.push("pause"),
    next: async () => void log.push("next"),
    previous: async () => void log.push("previous"),
    setVolume: async (v) => {
      volume = v;
      log.push(`volume:${v}`);
    },
    getDevices: async () => [
      { id: "d1", name: "Salon", type: "Speaker", isActive: true, volume, supportsVolume: true },
      { id: "d2", name: "iPhone de Clément", type: "Smartphone", isActive: false, volume: 50, supportsVolume: true },
    ],
    transferPlayback: async (id) => void log.push(`transfer:${id}`),
    playUri: async (uri) => void log.push(`playUri:${uri}`),
    search: async (q) => [{ uri: "spotify:artist:daft", type: "artist", name: q }],
    getPlaylists: async () => playlists,
    getRecent: async () => [],
    openUrl: () => ({ app: "spotify:", web: "https://open.spotify.com" }),
  };
  return { m, log };
}

function setup(opts: { music?: MusicProvider | null } = {}) {
  const cal = new MemoryCalendarProvider([
    ev({
      id: "cf",
      title: "CrossFit",
      start: d(2026, 10, 8, 18, 30).toISOString(),
      end: d(2026, 10, 8, 19, 30).toISOString(),
      location: { label: "CrossFit", lat: 46.5225, lng: 6.6165, placeId: "crossfit" },
    }),
  ]);
  const timers: Timer[] = [];
  const shopping: ShoppingItem[] = [];
  const scenes: Scene[] = DEFAULT_SCENES.map((s, i) => ({ ...s, id: `s${i}` }));
  let activeScene: Scene | null = null;
  const opened: string[] = [];
  let seq = 0;
  const ctx: ToolContext = {
    now: () => now,
    calendar: cal,
    events: () => cal.events,
    profiles,
    places,
    settings: { ...DEFAULT_SETTINGS, navigationApp: "waze" },
    homePlaceId: "home",
    currentProfileId: "clement",
    weather: { id: "w", getForecast: async () => ({ lat: 0, lng: 0, hourly: [], daily: [], fetchedAt: 0 }), getAt: async () => null },
    geocoding: { id: "g", search: async () => [] },
    routing: { id: "r", route: async (_a, _b, mode) => ({ durationMin: 12, distanceKm: 3, mode, source: "osrm" }) },
    createReminder: async (r) => ({ ...r, id: "r1", createdAt: "" }),
    deleteReminder: async () => {},
    timers: {
      list: () => timers,
      create: async (t) => {
        const full = { ...t, id: `t${++seq}` };
        timers.push(full);
        return full;
      },
      update: async (id, patch) => {
        const i = timers.findIndex((t) => t.id === id);
        timers[i] = { ...timers[i], ...patch };
      },
      remove: async (id) => {
        const i = timers.findIndex((t) => t.id === id);
        if (i >= 0) timers.splice(i, 1);
      },
    },
    shopping: {
      list: () => shopping,
      add: async (it) => {
        const full = { ...it, id: `i${++seq}` };
        shopping.push(full);
        return full;
      },
      update: async (id, patch) => {
        const i = shopping.findIndex((t) => t.id === id);
        shopping[i] = { ...shopping[i], ...patch };
      },
      remove: async (id) => {
        const i = shopping.findIndex((t) => t.id === id);
        if (i >= 0) shopping.splice(i, 1);
      },
    },
    music: opts.music === undefined ? fakeMusic().m : opts.music,
    scenes: {
      list: () => scenes,
      active: () => activeScene,
      activate: (id) => (activeScene = scenes.find((s) => s.id === id) ?? null),
      exit: () => (activeScene = null),
    },
    navigation: { app: () => "waze", open: (url) => void opened.push(url) },
  };
  const base = { history: [], systemPrompt: "sys", llm: null, executor: new ToolExecutor(ctx), now, profiles, places, currentProfileId: "clement", scenesForParsing: scenes };
  const say = (input: string, pending?: Parameters<typeof handleUtterance>[0]["pending"]) => handleUtterance({ ...base, input, pending });
  return { say, timers, shopping, opened, get activeScene() { return activeScene; } };
}

describe("voice commands without LLM", () => {
  it("timers: create, list, +time, cancel, undo", async () => {
    const s = setup();
    const r = await s.say("Minuteur 8 minutes pour les œufs");
    expect(r.text).toBe("✓ Minuteur « œufs » lancé pour 8 min.");
    expect(s.timers).toHaveLength(1);
    expect(new Date(s.timers[0].expiresAt).getTime()).toBe(now.getTime() + 8 * 60000);
    expect((await s.say("Combien de temps reste-t-il sur le minuteur ?")).text).toBe("Il reste 08:00 pour « œufs ».");
    await s.say("Ajoute 2 minutes au minuteur");
    expect(s.timers[0].duration).toBe(10 * 60000);
    const c = await s.say("Annule le minuteur des œufs");
    expect(s.timers).toHaveLength(0);
    await c.actions[0].result.undo!();
    expect(s.timers).toHaveLength(1);
  });

  it("shopping: add with quantities, list, remove, check, undo", async () => {
    const s = setup();
    const r = await s.say("Ajoute du lait et six œufs aux courses");
    expect(s.shopping.map((i) => [i.name, i.quantity])).toEqual([
      ["Lait", undefined],
      ["Œufs", "6"],
    ]);
    expect(r.text).toBe("✓ Lait et 6 œufs ajoutés aux courses.");
    await s.say("Ajoute du lait aux courses"); // duplicate ignored
    expect(s.shopping).toHaveLength(2);
    expect((await s.say("Qu'est-ce qu'il reste à acheter dans les courses ?")).text).toBe("Il reste 2 articles : lait et 6 œufs.");
    const rm = await s.say("Enlève le lait de la liste");
    expect(s.shopping.map((i) => i.name)).toEqual(["Œufs"]);
    await rm.actions[0].result.undo!();
    expect(s.shopping).toHaveLength(2);
  });

  it("scenes: activate by voice and exit", async () => {
    const s = setup();
    expect((await s.say("HomeCal, mode cuisine")).text).toBe("✓ Mode Cuisine activé.");
    expect(s.activeScene?.name).toBe("Cuisine");
    await s.say("Quitte le mode cuisine");
    expect(s.activeScene).toBeNull();
  });

  it("navigation: departure time and Waze link", async () => {
    const s = setup();
    const r = await s.say("Quand dois-je partir ?");
    expect(r.text).toBe("Pour CrossFit à 18h30, partez à 18h08 (12 min de trajet).");
    await s.say("Lance Waze pour mon prochain rendez-vous");
    expect(s.opened[0]).toBe("https://waze.com/ul?ll=46.5225,6.6165&navigate=yes");
  });

  it("music: controls, volume, device, playlist choice", async () => {
    const fm = fakeMusic();
    const s = setup({ music: fm.m });
    await s.say("Pause la musique");
    await s.say("Passe à la suivante");
    await s.say("Mets le son à 30 %");
    expect(fm.log).toEqual(["pause", "next", "volume:30"]);
    expect((await s.say("Qu'est-ce qui joue ?")).text).toBe("En lecture : Instant Crush de Daft Punk sur Salon.");
    await s.say("Mets Spotify sur l'iPhone de Clément");
    expect(fm.log).toContain("transfer:d2");

    const q = await s.say("Mets ma playlist chill");
    expect(q.text).toContain("Lequel voulez-vous ?");
    expect(q.pending).toMatchObject({ domain: "music", kind: "choice" });
    await s.say("la deuxième", q.pending);
    expect(fm.log.at(-1)).toBe("playUri:spotify:playlist:chill2");

    await s.say("Mets ma playlist Cuisine");
    expect(fm.log.at(-1)).toBe("playUri:spotify:playlist:kitchen");
  });

  it("music: clear message when Spotify is not connected", async () => {
    const s = setup({ music: fakeMusic(false).m });
    expect((await s.say("Pause la musique")).text).toBe(new MusicError("NOT_CONNECTED").message);
  });
});

describe("SpotifyProvider (client)", () => {
  it("refuses calls when not connected and never calls the server", async () => {
    let called = 0;
    const p = new SpotifyProvider({
      getIdToken: async () => "id",
      getCipher: () => null,
      onCipherRotated: () => {},
      onDisconnect: async () => {},
      fetchImpl: (async () => {
        called++;
        return new Response("{}");
      }) as typeof fetch,
    });
    expect(p.isConnected()).toBe(false);
    await expect(p.pause()).rejects.toMatchObject({ code: "NOT_CONNECTED" });
    expect(called).toBe(0);
  });

  it("sends the cipher + Firebase token, maps errors and persists rotated tokens", async () => {
    const rotated: string[] = [];
    const bodies: unknown[] = [];
    const p = new SpotifyProvider({
      getIdToken: async () => "firebase-id",
      getCipher: () => "enc-1",
      onCipherRotated: (c) => rotated.push(c),
      onDisconnect: async () => {},
      fetchImpl: (async (_url: string, init: RequestInit) => {
        bodies.push({ auth: (init.headers as Record<string, string>).Authorization, body: JSON.parse(String(init.body)) });
        return new Response(JSON.stringify({ code: "PREMIUM_REQUIRED", cipher: "enc-2" }), { status: 403 });
      }) as unknown as typeof fetch,
    });
    await expect(p.play()).rejects.toMatchObject({ code: "PREMIUM_REQUIRED" });
    expect(bodies[0]).toEqual({ auth: "Bearer firebase-id", body: { cipher: "enc-1", op: "play" } });
    expect(rotated).toEqual(["enc-2"]);
  });

  it("builds app and web links", () => {
    const p = new SpotifyProvider({ getIdToken: async () => null, getCipher: () => null, onCipherRotated: () => {}, onDisconnect: async () => {} });
    expect(p.openUrl({ uri: "spotify:playlist:abc", type: "playlist", name: "x" })).toEqual({ app: "spotify:playlist:abc", web: "https://open.spotify.com/playlist/abc" });
  });
});
