import { parseMusicCommand, parseNavigationCommand, parseSceneCommand } from "@/lib/commands";
import { parseShoppingCommand } from "@/lib/shopping";
import { parseTimerCommand } from "@/lib/timers";
import type { Scene } from "@/lib/types";
import type { AgentAction, AgentResult, PendingQuestion } from "./agent";
import type { ToolExecutor } from "./executor";

export const sentence = (s: string) => (/[.?!]$/.test(s.trim()) ? s.trim() : `${s.trim()}.`);

const LABEL: Record<string, string> = {
  createTimer: "Je lance le minuteur…",
  addShoppingItem: "J'ajoute aux courses…",
  playPlaylist: "Je lance la playlist…",
  playMusic: "Je cherche la musique…",
  getNextDeparture: "Je calcule le trajet…",
  openNavigation: "J'ouvre l'itinéraire…",
};

/**
 * Timers, shopping list, scenes, navigation and music handled without the LLM:
 * instant, predictable, works even when Ollama is offline.
 */
export async function moduleFastPath(
  input: string,
  executor: ToolExecutor,
  scenes: Scene[],
  onStep?: (label: string) => void,
): Promise<AgentResult | null> {
  const calls: { name: string; args: Record<string, unknown> }[] = [];

  const timer = parseTimerCommand(input);
  if (timer) {
    if (timer.op === "create") calls.push({ name: "createTimer", args: { seconds: timer.durationMs / 1000, label: timer.label } });
    else if (timer.op === "cancel") calls.push({ name: "cancelTimer", args: { label: timer.label, all: timer.all } });
    else if (timer.op === "pause") calls.push({ name: "pauseTimer", args: { label: timer.label } });
    else if (timer.op === "resume") calls.push({ name: "resumeTimer", args: { label: timer.label } });
    else if (timer.op === "add") calls.push({ name: "addTimeToTimer", args: { seconds: timer.durationMs / 1000, label: timer.label } });
    else calls.push({ name: "listTimers", args: {} });
  }

  if (!calls.length) {
    const shop = parseShoppingCommand(input);
    if (shop) {
      if (shop.op === "add") calls.push({ name: "addShoppingItem", args: { items: shop.items.map((i) => (i.quantity ? `${i.quantity} ${i.name}` : i.name)) } });
      else if (shop.op === "remove") calls.push({ name: "removeShoppingItem", args: { items: shop.names } });
      else if (shop.op === "check") calls.push({ name: "completeShoppingItem", args: { items: shop.names } });
      else if (shop.op === "uncheck") calls.push({ name: "uncompleteShoppingItem", args: { items: shop.names } });
      else if (shop.op === "clearChecked") calls.push({ name: "clearCompletedShoppingItems", args: {} });
      else calls.push({ name: "getShoppingList", args: {} });
    }
  }

  if (!calls.length) {
    const sc = parseSceneCommand(input, scenes);
    if (sc?.op === "activate") calls.push({ name: "activateScene", args: { name: sc.scene.name } });
    else if (sc?.op === "exit") calls.push({ name: "exitScene", args: {} });
    else if (sc?.op === "unknown") {
      return {
        text: `Je ne connais pas la scène « ${sc.name} ». Scènes disponibles : ${scenes.map((s) => s.name).join(", ") || "aucune"}.`,
        actions: [],
        changed: false,
        fast: true,
      };
    }
  }

  if (!calls.length) {
    const nav = parseNavigationCommand(input);
    if (nav) calls.push({ name: nav.op === "route" ? "openNavigation" : "getNextDeparture", args: { query: nav.query, app: nav.op === "route" ? nav.app : undefined } });
  }

  if (!calls.length) {
    const mu = parseMusicCommand(input);
    if (mu) {
      if (mu.op === "pause") calls.push({ name: "pauseMusic", args: {} });
      else if (mu.op === "resume") calls.push({ name: "resumeMusic", args: {} });
      else if (mu.op === "next") calls.push({ name: "nextTrack", args: {} });
      else if (mu.op === "previous") calls.push({ name: "previousTrack", args: {} });
      else if (mu.op === "volume") calls.push({ name: "setMusicVolume", args: { volume: mu.value, delta: mu.delta } });
      else if (mu.op === "current") calls.push({ name: "getCurrentTrack", args: {} });
      else if (mu.op === "playlist") calls.push({ name: "playPlaylist", args: { name: mu.name } });
      else if (mu.op === "query") calls.push({ name: "playMusic", args: { query: mu.query } });
      else calls.push({ name: "changeMusicDevice", args: { device: mu.name } });
    }
  }

  if (!calls.length) return null;

  const actions: AgentAction[] = [];
  for (const c of calls) {
    onStep?.(LABEL[c.name] ?? "J'y vais…");
    const result = await executor.run(c.name, c.args);
    actions.push({ name: c.name, args: c.args, result });
  }
  const last = actions[actions.length - 1].result;
  let pending: PendingQuestion | undefined;
  const choices = (last.data as { choices?: string[] } | undefined)?.choices;
  if (!last.ok && choices?.length) {
    pending = { kind: "musicChoice", choices, tool: calls[calls.length - 1].name === "playPlaylist" ? "playPlaylist" : "playMusic" };
  }
  return {
    text: sentence(last.summary),
    actions,
    changed: actions.some((a) => a.result.changed),
    fast: true,
    pending,
  };
}
