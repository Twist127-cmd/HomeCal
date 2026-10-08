import type { Occurrence } from "./types";

/**
 * Contextual quick actions — deterministic rules, no LLM. Returns 2 to 4 relevant
 * actions depending on time of day, upcoming events, departures, music, timers…
 */

export type ContextualActionId =
  | "myDay"
  | "music"
  | "firstDeparture"
  | "route"
  | "remindMe"
  | "viewPlace"
  | "findSlot"
  | "commonEvent"
  | "timer"
  | "shopping"
  | "tomorrow"
  | "relax"
  | "scene";

export interface ContextualAction {
  id: ContextualActionId;
  icon: string;
  label: string;
  /** related occurrence (route, remind, place) */
  occurrence?: Occurrence;
  /** scene id for "scene" actions */
  sceneId?: string;
  priority: number;
}

export interface ActionContext {
  now: Date;
  /** next timed occurrence that has not started yet (today or tomorrow) */
  next?: Occurrence | null;
  /** recommended departure for `next`, if travel is needed */
  nextDepartAt?: Date | null;
  todayCount: number;
  selectedPersons: number;
  musicEnabled: boolean;
  musicPlaying: boolean;
  timersRunning: number;
  timersEnabled: boolean;
  shoppingCount: number;
  shoppingEnabled: boolean;
  /** scene suggested by its schedule (not active yet) */
  suggestedScene?: { id: string; name: string; icon: string } | null;
}

export function getContextualActions(ctx: ActionContext, max = 4): ContextualAction[] {
  const h = ctx.now.getHours() + ctx.now.getMinutes() / 60;
  const morning = h >= 5 && h < 10.5;
  const evening = h >= 19 || h < 1;
  const mealTime = (h >= 11 && h < 13.5) || (h >= 17.5 && h < 20.5);
  const out: ContextualAction[] = [];
  const add = (a: ContextualAction) => out.push(a);

  // Before an appointment (within 3 h)
  const next = ctx.next;
  const minsToNext = next ? (next.start.getTime() - ctx.now.getTime()) / 60000 : Infinity;
  if (next && minsToNext > 0 && minsToNext <= 180) {
    if (ctx.nextDepartAt) add({ id: "route", icon: "🚗", label: "Itinéraire", occurrence: next, priority: 100 - minsToNext / 10 });
    add({ id: "remindMe", icon: "⏰", label: "Me rappeler", occurrence: next, priority: 60 });
    if (next.event.location) add({ id: "viewPlace", icon: "📍", label: "Voir le lieu", occurrence: next, priority: 55 });
  }

  if (ctx.suggestedScene) add({ id: "scene", icon: ctx.suggestedScene.icon, label: `Mode ${ctx.suggestedScene.name}`, sceneId: ctx.suggestedScene.id, priority: 90 });

  if (ctx.selectedPersons >= 2) {
    add({ id: "findSlot", icon: "🕐", label: "Trouver un créneau", priority: 85 });
    add({ id: "commonEvent", icon: "➕", label: "Événement commun", priority: 80 });
  }

  if (morning) {
    add({ id: "myDay", icon: "☀️", label: "Ma journée", priority: 75 });
    if (ctx.nextDepartAt && !out.some((a) => a.id === "route")) add({ id: "firstDeparture", icon: "🚗", label: "Premier départ", occurrence: next ?? undefined, priority: 70 });
  }

  if (mealTime) {
    if (ctx.timersEnabled) add({ id: "timer", icon: "⏱️", label: ctx.timersRunning ? `Minuteurs (${ctx.timersRunning})` : "Minuteur", priority: 65 });
    if (ctx.shoppingEnabled) add({ id: "shopping", icon: "🛒", label: ctx.shoppingCount ? `Courses (${ctx.shoppingCount})` : "Courses", priority: 50 });
  }

  if (evening) {
    add({ id: "tomorrow", icon: "🌙", label: "Demain", priority: 72 });
    if (ctx.musicEnabled && !ctx.musicPlaying) add({ id: "relax", icon: "🎵", label: "Relax", priority: 45 });
    if (ctx.shoppingEnabled && ctx.shoppingCount) add({ id: "shopping", icon: "🛒", label: `Courses (${ctx.shoppingCount})`, priority: 40 });
  }

  if (ctx.timersRunning && ctx.timersEnabled && !out.some((a) => a.id === "timer")) {
    add({ id: "timer", icon: "⏱️", label: `Minuteurs (${ctx.timersRunning})`, priority: 95 });
  }

  if (ctx.musicEnabled && !out.some((a) => a.id === "relax")) {
    add({ id: "music", icon: "🎵", label: ctx.musicPlaying ? "En lecture" : "Musique", priority: morning ? 68 : 30 });
  }

  // de-duplicate by id (keep highest priority) and limit
  const best = new Map<string, ContextualAction>();
  for (const a of out) {
    const prev = best.get(a.id);
    if (!prev || prev.priority < a.priority) best.set(a.id, a);
  }
  const list = [...best.values()].sort((a, b) => b.priority - a.priority).slice(0, max);
  return list.length >= 2 ? list : list.concat(fallback(ctx, list)).slice(0, Math.max(2, list.length));
}

function fallback(ctx: ActionContext, have: ContextualAction[]): ContextualAction[] {
  const f: ContextualAction[] = [
    { id: "myDay", icon: "☀️", label: "Ma journée", priority: 1 },
    { id: "tomorrow", icon: "🌙", label: "Demain", priority: 1 },
  ];
  if (ctx.musicEnabled) f.unshift({ id: "music", icon: "🎵", label: "Musique", priority: 1 });
  return f.filter((a) => !have.some((h) => h.id === a.id));
}
