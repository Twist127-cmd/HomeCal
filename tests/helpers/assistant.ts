import { ToolExecutor, type ToolContext } from "@/assistant/executor";
import { DEFAULT_SCENES, DEFAULT_SETTINGS, type Reminder, type Scene, type ShoppingItem, type Timer } from "@/lib/types";
import { MemoryCalendarProvider } from "@/providers/calendar/MemoryCalendarProvider";
import type { MusicItem, MusicProvider, PlaybackState } from "@/providers/music";
import { d, ev, places, profiles } from "../fixtures";

/** Wednesday 7 October 2026, 18:00 */
export const NOW = d(2026, 10, 7, 18, 0);

export function fakeMusic(connected = true) {
  const log: string[] = [];
  let volume = 40;
  const playlists: MusicItem[] = [
    { uri: "spotify:playlist:chill1", type: "playlist", name: "Chill Vibes" },
    { uri: "spotify:playlist:chill2", type: "playlist", name: "Chill Evening" },
    { uri: "spotify:playlist:kitchen", type: "playlist", name: "Cuisine" },
    { uri: "spotify:playlist:morning", type: "playlist", name: "Morning Chill" },
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
  const music: MusicProvider = {
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
    search: async (q) => [{ uri: `spotify:artist:${q.replace(/\W/g, "")}`, type: "artist", name: q }],
    getPlaylists: async () => playlists,
    getRecent: async () => [],
    openUrl: () => ({ app: "spotify:", web: "https://open.spotify.com" }),
  };
  return { music, log };
}

export function makeAssistant(opts: { music?: MusicProvider | null } = {}) {
  const cal = new MemoryCalendarProvider([
    ev({ id: "dent", title: "Dentiste", start: d(2026, 10, 8, 16).toISOString(), end: d(2026, 10, 8, 17).toISOString() }),
    ev({
      id: "cf",
      title: "CrossFit",
      start: d(2026, 10, 7, 18, 30).toISOString(),
      end: d(2026, 10, 7, 19, 30).toISOString(),
      location: { label: "CrossFit", lat: 46.5225, lng: 6.6165, placeId: "crossfit" },
    }),
    ev({ id: "reu", title: "Réunion", start: d(2026, 10, 9, 9).toISOString(), end: d(2026, 10, 9, 10).toISOString() }),
  ]);
  const timers: Timer[] = [];
  const shopping: ShoppingItem[] = [];
  const reminders: Reminder[] = [];
  const scenes: Scene[] = DEFAULT_SCENES.map((s, i) => ({ ...s, id: `s${i}` }));
  const state = { activeScene: null as Scene | null };
  const opened: string[] = [];
  const fm = fakeMusic();
  let seq = 0;
  const ctx: ToolContext = {
    now: () => NOW,
    calendar: cal,
    events: () => cal.events,
    profiles,
    places,
    settings: { ...DEFAULT_SETTINGS, navigationApp: "waze" },
    homePlaceId: "home",
    currentProfileId: "clement",
    weather: {
      id: "w",
      getForecast: async (lat, lng) => ({
        lat,
        lng,
        fetchedAt: 0,
        current: { time: NOW, temperature: 14, precipitationProbability: 0, precipitation: 0, windSpeed: 10, weatherCode: 3, isDay: true },
        hourly: [{ time: NOW, temperature: 14, precipitationProbability: 20, precipitation: 0, windSpeed: 10, weatherCode: 3, isDay: true }],
        daily: [0, 1, 2, 3, 4].map((i) => ({ date: d(2026, 10, 7 + i), tMin: 8, tMax: 16, precipitationProbability: 40, precipitation: 1, windMax: 20, weatherCode: 61 })),
      }),
      getAt: async () => ({ time: NOW, temperature: 14, precipitationProbability: 20, precipitation: 0, windSpeed: 10, weatherCode: 3, isDay: true }),
    },
    geocoding: { id: "g", search: async (q) => [{ label: q, address: q, lat: 45.9, lng: 6.12 }] },
    routing: { id: "r", route: async (_a, _b, mode) => ({ durationMin: 12, distanceKm: 3, mode, source: "osrm" }) },
    createReminder: async (r) => {
      const full = { ...r, id: `r${++seq}`, createdAt: NOW.toISOString() };
      reminders.push(full);
      return full;
    },
    deleteReminder: async (id) => {
      const i = reminders.findIndex((r) => r.id === id);
      if (i >= 0) reminders.splice(i, 1);
    },
    reminders: () => reminders,
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
    music: opts.music === undefined ? fm.music : opts.music,
    scenes: {
      list: () => scenes,
      active: () => state.activeScene,
      activate: (id) => (state.activeScene = scenes.find((s) => s.id === id) ?? null),
      exit: () => (state.activeScene = null),
    },
    navigation: { app: () => "waze", open: (url) => void opened.push(url) },
  };
  const base = {
    history: [],
    systemPrompt: "sys",
    llm: null,
    executor: new ToolExecutor(ctx),
    now: NOW,
    profiles,
    places,
    currentProfileId: "clement",
    scenesForParsing: scenes,
  };
  return { base, ctx, cal, timers, shopping, reminders, scenes, state, opened, musicLog: fm.log };
}
