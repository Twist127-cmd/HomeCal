import { addDays } from "date-fns";
import { departureTime, needsTravel, pickOrigin } from "@/lib/departure";
import { hasCoords } from "@/lib/geo";
import { navigationUrl } from "@/lib/navigation";
import { normalize } from "@/lib/profiles";
import { expandEvents } from "@/lib/recurrence";
import { describeList, findItem, splitItems } from "@/lib/shopping";
import { addTime, findTimer, formatDuration, formatRemaining, newTimer, parseDuration, pauseTimer, remainingMs, resumeTimer } from "@/lib/timers";
import type { NavigationApp, Reminder, Scene, ShoppingItem, Timer } from "@/lib/types";
import { findBestMatch, MusicError, type MusicItem, type MusicProvider } from "@/providers/music";
import type { ToolContext, ToolResult } from "./executor";

/** Optional V1.5 modules available to the assistant (UI passes them in the ToolContext). */
export interface ModuleContext {
  /** Standalone reminders of the household (for cancel / list) */
  reminders?: () => Reminder[];
  timers?: {
    list(): Timer[];
    create(t: Omit<Timer, "id">): Promise<Timer>;
    update(id: string, patch: Partial<Timer>): Promise<void>;
    remove(id: string): Promise<void>;
  };
  shopping?: {
    list(): ShoppingItem[];
    add(item: Omit<ShoppingItem, "id">): Promise<ShoppingItem>;
    update(id: string, patch: Partial<ShoppingItem>): Promise<void>;
    remove(id: string): Promise<void>;
  };
  music?: MusicProvider | null;
  scenes?: {
    list(): Scene[];
    active(): Scene | null;
    activate(id: string): void;
    exit(): void;
  };
  navigation?: {
    app(): NavigationApp;
    open(url: string): void;
  };
}

const ok = (data: unknown, summary: string, extra: Partial<ToolResult> = {}): ToolResult => ({ ok: true, data, summary, ...extra });
const fail = (summary: string): ToolResult => ({ ok: false, data: { error: summary }, summary });

const MODULE_TOOLS = new Set([
  "createTimer",
  "listTimers",
  "cancelTimer",
  "pauseTimer",
  "resumeTimer",
  "addTimeToTimer",
  "addShoppingItem",
  "removeShoppingItem",
  "completeShoppingItem",
  "uncompleteShoppingItem",
  "getShoppingList",
  "clearCompletedShoppingItems",
  "playMusic",
  "pauseMusic",
  "resumeMusic",
  "nextTrack",
  "previousTrack",
  "setMusicVolume",
  "changeMusicDevice",
  "playPlaylist",
  "searchMusic",
  "getCurrentTrack",
  "activateScene",
  "exitScene",
  "getNextDeparture",
  "openNavigation",
  "listReminders",
  "cancelReminder",
]);

export function isModuleTool(name: string) {
  return MODULE_TOOLS.has(name);
}

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);

function durationArg(a: Record<string, unknown>): number | undefined {
  const minutes = Number(a.minutes ?? a.durationMinutes);
  const seconds = Number(a.seconds ?? 0);
  if (Number.isFinite(minutes) && minutes > 0) return (minutes * 60 + (Number.isFinite(seconds) ? seconds : 0)) * 1000;
  if (Number.isFinite(seconds) && seconds > 0) return seconds * 1000;
  const d = str(a.duration);
  return d ? parseDuration(d)?.ms : undefined;
}

export async function runModuleTool(name: string, a: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
  try {
    if (name.endsWith("Timer") || name === "listTimers") return await timerTool(name, a, ctx);
    if (name.includes("Shopping")) return await shoppingTool(name, a, ctx);
    if (name.includes("Scene")) return sceneTool(name, a, ctx);
    if (name === "getNextDeparture" || name === "openNavigation") return await navigationTool(name, a, ctx);
    if (name === "listReminders" || name === "cancelReminder") return await reminderTool(name, a, ctx);
    return await musicTool(name, a, ctx);
  } catch (e) {
    if (e instanceof MusicError) return fail(e.message);
    return fail((e as Error).message);
  }
}

// ------------------------------------------------------------------ timers

async function timerTool(name: string, a: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
  const t = ctx.timers;
  if (!t) return fail("Les minuteurs ne sont pas disponibles");
  const now = ctx.now().getTime();
  const label = str(a.label);
  switch (name) {
    case "createTimer": {
      const ms = durationArg(a);
      if (!ms || ms < 1000 || ms > 24 * 3600_000) return fail("Durée du minuteur invalide");
      const created = await t.create(newTimer(label ?? "Minuteur", ms, now, ctx.currentProfileId));
      return ok({ timer: { label: created.label, duration: formatDuration(ms) } }, `Minuteur « ${created.label} » lancé pour ${formatDuration(ms)}`, {
        changed: true,
        undo: () => t.remove(created.id),
      });
    }
    case "listTimers": {
      const active = t.list().filter((x) => x.status === "running" || x.status === "paused");
      return ok(
        { timers: active.map((x) => ({ label: x.label, remaining: formatRemaining(remainingMs(x, now)), paused: x.status === "paused" || undefined })) },
        active.length
          ? active.map((x) => `${x.label} : ${formatRemaining(remainingMs(x, now))}${x.status === "paused" ? " (en pause)" : ""}`).join(", ")
          : "Aucun minuteur en cours",
      );
    }
    case "cancelTimer": {
      if (a.all === true) {
        const all = t.list().filter((x) => x.status === "running" || x.status === "paused");
        await Promise.all(all.map((x) => t.remove(x.id)));
        return ok({ cancelled: all.length }, all.length ? `${all.length} minuteur(s) annulé(s)` : "Aucun minuteur en cours", { changed: all.length > 0 });
      }
      const x = findTimer(t.list(), label, ["running", "paused", "done"]);
      if (!x) return fail(label ? `Aucun minuteur « ${label} »` : "Aucun minuteur en cours");
      await t.remove(x.id);
      const { id, ...rest } = x;
      return ok({ cancelled: x.label }, `Minuteur « ${x.label} » annulé`, {
        changed: true,
        undo: async () => {
          void id;
          await t.create(rest);
        },
      });
    }
    case "pauseTimer": {
      const x = findTimer(t.list(), label, ["running"]);
      if (!x) return fail("Aucun minuteur en cours");
      await t.update(x.id, pauseTimer(x, now));
      return ok({ paused: x.label }, `Minuteur « ${x.label} » en pause`, { changed: true, undo: () => t.update(x.id, { status: "running", expiresAt: x.expiresAt }) });
    }
    case "resumeTimer": {
      const x = findTimer(t.list(), label, ["paused"]);
      if (!x) return fail("Aucun minuteur en pause");
      await t.update(x.id, resumeTimer(x, now));
      return ok({ resumed: x.label }, `Minuteur « ${x.label} » relancé`, { changed: true });
    }
    case "addTimeToTimer": {
      const ms = durationArg(a) ?? 60000;
      const x = findTimer(t.list(), label, ["running", "paused", "done"]);
      if (!x) return fail("Aucun minuteur à prolonger");
      await t.update(x.id, addTime(x, ms, now));
      return ok({ timer: x.label, added: formatDuration(ms) }, `${formatDuration(ms)} ajoutée(s) au minuteur « ${x.label} »`, { changed: true });
    }
  }
  return fail(`Outil inconnu ${name}`);
}

// ------------------------------------------------------------------ shopping

async function shoppingTool(name: string, a: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
  const s = ctx.shopping;
  if (!s) return fail("La liste de courses n'est pas disponible");
  const names = (Array.isArray(a.items) ? a.items : str(a.items) ? [a.items] : str(a.name) ? [a.name] : []).map(String);
  switch (name) {
    case "addShoppingItem": {
      const parsed = names.flatMap((n) => splitItems(n));
      if (!parsed.length) return fail("Aucun article à ajouter");
      const created: ShoppingItem[] = [];
      const existing = s.list();
      for (const p of parsed) {
        const dup = findItem(existing.filter((e) => !e.checked), p.name);
        if (dup) continue;
        created.push(
          await s.add({ name: p.name, quantity: p.quantity ?? str(a.quantity), checked: false, createdAt: ctx.now().toISOString(), createdBy: ctx.currentProfileId }),
        );
      }
      const label = parsed.map((p) => (p.quantity ? `${p.quantity} ${p.name.toLowerCase()}` : p.name.toLowerCase())).join(", ");
      return ok({ added: created.map((c) => (c.quantity ? `${c.quantity} ${c.name}` : c.name)) }, created.length ? `${capital(label)} ajouté(s) aux courses` : `${capital(label)} déjà sur la liste`, {
        changed: created.length > 0,
        undo: async () => {
          await Promise.all(created.map((c) => s.remove(c.id)));
        },
      });
    }
    case "removeShoppingItem": {
      const removed: ShoppingItem[] = [];
      for (const n of names) {
        const it = findItem(s.list(), n);
        if (it) {
          await s.remove(it.id);
          removed.push(it);
        }
      }
      if (!removed.length) return fail(`${names.join(", ")} n'est pas sur la liste`);
      return ok({ removed: removed.map((r) => r.name) }, `${removed.map((r) => r.name).join(", ")} retiré(s) de la liste`, {
        changed: true,
        undo: async () => {
          for (const r of removed) {
            const { id, ...rest } = r;
            void id;
            await s.add(rest);
          }
        },
      });
    }
    case "completeShoppingItem":
    case "uncompleteShoppingItem": {
      const checked = name === "completeShoppingItem";
      const done: ShoppingItem[] = [];
      for (const n of names) {
        const it = findItem(s.list(), n);
        if (it) {
          await s.update(it.id, { checked, checkedAt: checked ? ctx.now().toISOString() : undefined });
          done.push(it);
        }
      }
      if (!done.length) return fail(`${names.join(", ")} n'est pas sur la liste`);
      return ok({ items: done.map((d) => d.name) }, `${done.map((d) => d.name).join(", ")} ${checked ? "coché(s)" : "décoché(s)"}`, {
        changed: true,
        undo: async () => {
          await Promise.all(done.map((d) => s.update(d.id, { checked: d.checked, checkedAt: d.checkedAt })));
        },
      });
    }
    case "getShoppingList": {
      const items = s.list();
      return ok({ items: items.filter((i) => !i.checked).map((i) => ({ name: i.name, quantity: i.quantity })) }, describeList(items));
    }
    case "clearCompletedShoppingItems": {
      const checked = s.list().filter((i) => i.checked);
      await Promise.all(checked.map((i) => s.remove(i.id)));
      return ok({ cleared: checked.length }, checked.length ? `${checked.length} article(s) acheté(s) retiré(s)` : "Aucun article coché", { changed: checked.length > 0 });
    }
  }
  return fail(`Outil inconnu ${name}`);
}

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// ------------------------------------------------------------------ music

async function musicTool(name: string, a: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
  const m = ctx.music;
  if (!m || !m.isConnected()) return fail(new MusicError("NOT_CONNECTED").message);
  switch (name) {
    case "pauseMusic":
      await m.pause();
      return ok({}, "Musique en pause", { changed: true, undo: () => m.play() });
    case "resumeMusic":
      await m.play();
      return ok({}, "Lecture reprise", { changed: true, undo: () => m.pause() });
    case "nextTrack":
      await m.next();
      return ok({}, "Morceau suivant", { changed: true });
    case "previousTrack":
      await m.previous();
      return ok({}, "Morceau précédent", { changed: true });
    case "setMusicVolume": {
      const cur = await m.getCurrentPlayback();
      const before = cur?.device?.volume ?? 50;
      let v = Number(a.volume);
      if (!Number.isFinite(v)) v = before + Number(a.delta ?? 0);
      v = Math.max(0, Math.min(100, Math.round(v)));
      await m.setVolume(v);
      return ok({ volume: v }, `Volume à ${v} %`, { changed: true, undo: () => m.setVolume(before) });
    }
    case "getCurrentTrack": {
      const p = await m.getCurrentPlayback();
      if (!p?.item) return ok({ playing: false }, "Rien n'est en lecture");
      return ok(
        { playing: p.isPlaying, track: p.item.name, artist: p.item.subtitle, device: p.device?.name },
        `${p.isPlaying ? "En lecture" : "En pause"} : ${p.item.name}${p.item.subtitle ? ` de ${p.item.subtitle}` : ""}${p.device ? ` sur ${p.device.name}` : ""}`,
      );
    }
    case "changeMusicDevice": {
      const want = str(a.device);
      const devices = await m.getDevices();
      if (!devices.length) return fail(new MusicError("NO_DEVICE").message);
      const dev = want
        ? (devices.find((d) => normalize(d.name) === normalize(want)) ?? devices.find((d) => normalize(d.name).includes(normalize(want))))
        : undefined;
      if (!dev) return { ok: false, data: { error: "Appareil introuvable", devices: devices.map((d) => d.name) }, summary: `Appareils disponibles : ${devices.map((d) => d.name).join(", ")}. Lequel ?` };
      await m.transferPlayback(dev.id, true);
      return ok({ device: dev.name }, `Musique sur ${dev.name}`, { changed: true });
    }
    case "playPlaylist":
    case "playMusic":
    case "searchMusic": {
      const query = str(a.name) ?? str(a.query);
      if (!query) {
        if (name === "playMusic") {
          await m.play();
          return ok({}, "Lecture reprise", { changed: true });
        }
        return fail("Que voulez-vous écouter ?");
      }
      let candidates: MusicItem[] = [];
      if (name === "playPlaylist" || a.type === "playlist") {
        const r = findBestMatch(query, await m.getPlaylists());
        if (r.item && name !== "searchMusic") {
          await m.playUri(r.item.uri);
          return ok({ playing: r.item.name }, `Playlist « ${r.item.name} » lancée`, { changed: true });
        }
        candidates = r.candidates;
      }
      if (!candidates.length) {
        const found = await m.search(query, name === "playPlaylist" ? ["playlist"] : ["track", "playlist", "artist", "album"]);
        if (name === "searchMusic") return ok({ results: found.slice(0, 6).map((f) => ({ name: f.name, type: f.type, by: f.subtitle })) }, `${found.length} résultat(s)`);
        // a clear top hit for generic requests ("mets du Daft Punk") is played directly
        if (found.length && (name === "playMusic" || found.length === 1)) {
          await m.playUri(found[0].uri);
          return ok({ playing: found[0].name }, `Lecture : ${found[0].name}${found[0].subtitle ? ` (${found[0].subtitle})` : ""}`, { changed: true });
        }
        candidates = found.slice(0, 4);
      }
      if (!candidates.length) return fail(`Rien trouvé pour « ${query} »`);
      return {
        ok: false,
        data: { choices: candidates.map((c) => c.name) },
        summary: `J'ai trouvé plusieurs résultats : ${candidates.map((c) => c.name).join(", ")}. Lequel voulez-vous ?`,
      };
    }
  }
  return fail(`Outil inconnu ${name}`);
}

// ------------------------------------------------------------------ scenes

function sceneTool(name: string, a: Record<string, unknown>, ctx: ToolContext): ToolResult {
  const sc = ctx.scenes;
  if (!sc) return fail("Les scènes ne sont pas disponibles");
  if (name === "exitScene") {
    const cur = sc.active();
    sc.exit();
    return ok({}, cur ? `Mode ${cur.name} désactivé` : "Retour au calendrier", { changed: true });
  }
  const want = normalize(str(a.name) ?? "");
  const list = sc.list();
  const scene = list.find((s) => normalize(s.name) === want) ?? list.find((s) => normalize(s.name).includes(want) || want.includes(normalize(s.name)));
  if (!scene) return fail(`Scène inconnue. Scènes disponibles : ${list.map((s) => s.name).join(", ")}`);
  const prev = sc.active();
  sc.activate(scene.id);
  return ok({ scene: scene.name }, `Mode ${scene.name} activé`, {
    changed: true,
    undo: async () => (prev ? sc.activate(prev.id) : sc.exit()),
  });
}

// ------------------------------------------------------------------ reminders

async function reminderTool(name: string, a: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
  const now = ctx.now().getTime();
  const upcoming = (ctx.reminders?.() ?? []).filter((r) => !r.done && new Date(r.at).getTime() > now - 60000).sort((x, y) => x.at.localeCompare(y.at));
  const hhmm = (iso: string) => {
    const d = new Date(iso);
    return `${d.getHours()}h${String(d.getMinutes()).padStart(2, "0")}`.replace(/h00$/, "h");
  };
  if (name === "listReminders") {
    return ok(
      { reminders: upcoming.map((r) => ({ text: r.text, at: r.at })) },
      upcoming.length ? upcoming.map((r) => `${r.text} à ${hhmm(r.at)}`).join(", ") : "Aucun rappel prévu",
    );
  }
  const q = str(a.text) ?? str(a.query);
  const target = q ? upcoming.find((r) => normalize(r.text).includes(normalize(q))) : upcoming.length === 1 ? upcoming[0] : a.latest === true ? upcoming[upcoming.length - 1] : undefined;
  if (!target) {
    if (!upcoming.length) return fail("Aucun rappel à annuler");
    return { ok: false, data: { choices: upcoming.map((r) => r.text) }, summary: `Quel rappel ? ${upcoming.map((r) => r.text).join(", ")}` };
  }
  await ctx.deleteReminder(target.id);
  const { id, createdAt, ...rest } = target;
  void id;
  void createdAt;
  return ok({ cancelled: target.text }, `Rappel « ${target.text} » annulé`, { changed: true, undo: async () => void (await ctx.createReminder(rest)) });
}

// ------------------------------------------------------------------ navigation

async function navigationTool(name: string, a: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
  const now = ctx.now();
  const occ = expandEvents(ctx.events(), now, addDays(now, 2)).filter((o) => !o.event.allDay && o.start > now && hasCoords(o.event.location));
  const query = str(a.query) ?? str(a.eventTitle);
  const target = query ? occ.find((o) => normalize(`${o.event.title} ${o.event.location?.label ?? ""}`).includes(normalize(query))) : occ[0];
  if (!target) return fail(query ? `Aucun événement « ${query} » avec un lieu dans les 2 prochains jours` : "Aucun prochain rendez-vous avec un lieu");

  const sameDay = occ.filter((o) => o.start.toDateString() === target.start.toDateString());
  const origin = pickOrigin(target, sameDay, ctx.places, ctx.homePlaceId);
  const mode = target.event.travel?.mode ?? ctx.settings.defaultTravelMode;
  let departAt: Date | null = null;
  let durationMin: number | null = null;
  if (needsTravel(target.event, origin) && origin) {
    const r = await ctx.routing.route(origin as { lat: number; lng: number }, target.event.location as { lat: number; lng: number }, mode);
    durationMin = r.durationMin;
    departAt = departureTime(target.start, r.durationMin, target.event.travel?.marginMin ?? ctx.settings.travelMarginMin);
  }
  const hhmm = (d: Date) => `${d.getHours()}h${String(d.getMinutes()).padStart(2, "0")}`.replace(/h00$/, "h");

  if (name === "getNextDeparture") {
    return ok(
      { event: target.event.title, start: hhmm(target.start), departAt: departAt ? hhmm(departAt) : null, travelMinutes: durationMin },
      departAt
        ? `Pour ${target.event.title} à ${hhmm(target.start)}, partez à ${hhmm(departAt)} (${durationMin} min de trajet)`
        : `${target.event.title} à ${hhmm(target.start)}, pas de trajet nécessaire`,
    );
  }

  const nav = ctx.navigation;
  if (!nav) return fail("Navigation indisponible");
  const pref = (str(a.app) as NavigationApp | undefined) ?? nav.app();
  const app = pref === "ask" ? "google" : pref;
  nav.open(navigationUrl(target.event.location!, app as "waze" | "google" | "apple", mode));
  return ok({ event: target.event.title, app }, `Itinéraire vers ${target.event.location!.label} ouvert`);
}
