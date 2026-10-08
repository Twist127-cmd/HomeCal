import { parseMusicCommand } from "@/lib/commands";
import { normalize } from "@/lib/profiles";
import { call, type DomainModule } from "../router/types";
import { musicResponse } from "../responses/music";

/** Music: music.play / pause / resume / next / previous / volume / device / current / playlist / search */
export const musicModule: DomainModule = {
  domain: "music",

  parse(u) {
    const c = parseMusicCommand(u.text);
    if (!c) return null;
    const base = { raw: u.raw, confidence: 0.94 };
    switch (c.op) {
      case "pause":
        return { ...base, intent: "music.pause", entities: {} };
      case "resume":
        return { ...base, intent: "music.resume", entities: {} };
      case "next":
        return { ...base, intent: "music.next", entities: {} };
      case "previous":
        return { ...base, intent: "music.previous", entities: {} };
      case "volume":
        return { ...base, intent: "music.volume", entities: { value: c.value, delta: c.delta } };
      case "current":
        return { ...base, intent: "music.current", entities: {} };
      case "playlist":
        return { ...base, intent: "music.playlist", entities: { name: c.name } };
      case "query":
        return { ...base, confidence: 0.85, intent: "music.play", entities: { query: c.query } };
      case "device":
        return { ...base, intent: "music.device", entities: { device: c.name } };
    }
  },

  async run(p, env) {
    const e = p.entities as { value?: number; delta?: number; name?: string; query?: string; device?: string };
    const map: Record<string, [string, Record<string, unknown>]> = {
      "music.pause": ["pauseMusic", {}],
      "music.resume": ["resumeMusic", {}],
      "music.next": ["nextTrack", {}],
      "music.previous": ["previousTrack", {}],
      "music.volume": ["setMusicVolume", { volume: e.value, delta: e.delta }],
      "music.current": ["getCurrentTrack", {}],
      "music.playlist": ["playPlaylist", { name: e.name }],
      "music.play": ["playMusic", { query: e.query }],
      "music.search": ["searchMusic", { query: e.query }],
      "music.device": ["changeMusicDevice", { device: e.device }],
    };
    const [name, args] = map[p.intent] ?? map["music.resume"];
    const a = await call(env, name, args, name === "playPlaylist" || name === "playMusic" ? "Je lance la musique…" : undefined);
    const choices = (a.result.data as { choices?: string[] } | undefined)?.choices;
    return {
      text: musicResponse(p.intent, a.result),
      actions: [a],
      changed: !!a.result.changed,
      pending: !a.result.ok && choices?.length ? { domain: "music", kind: "choice", data: { choices, tool: name === "playPlaylist" ? "playPlaylist" : "playMusic" } } : undefined,
    };
  },

  async resume(pending, u, env) {
    if (pending.kind !== "choice") return null;
    const choices = (pending.data.choices as string[]) ?? [];
    const ordinals = ["premier|premiere|1|un", "deuxieme|second|seconde|2|deux", "troisieme|3|trois", "quatrieme|4|quatre"];
    const idx = ordinals.findIndex((o) => new RegExp(`\\b(${o})\\b`).test(u.norm));
    const pick = idx >= 0 ? choices[idx] : choices.find((c) => u.norm.includes(normalize(c)) || normalize(c).includes(u.norm));
    if (!pick) return null;
    const tool = String(pending.data.tool);
    const a = await call(env, tool, tool === "playPlaylist" ? { name: pick } : { query: pick });
    return { text: musicResponse(tool === "playPlaylist" ? "music.playlist" : "music.play", a.result), actions: [a], changed: !!a.result.changed };
  },
};
