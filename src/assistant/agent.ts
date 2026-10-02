import type { ChatMessage, LLMProvider } from "@/providers/llm";
import { localIso, type ToolExecutor, type ToolResult } from "./executor";
import { dateHints, detectIntent, quickCreateFromCommand, type Intent } from "./hints";
import { TOOLS } from "./tools";
import { fmtRelativeDay, fmtTime } from "@/lib/dates";
import type { FavoritePlace, Profile } from "@/lib/types";

export interface AgentAction {
  name: string;
  args: Record<string, unknown>;
  result: ToolResult;
}

export interface AgentResult {
  text: string;
  actions: AgentAction[];
  changed: boolean;
  /** true when handled by the deterministic fast path (no LLM) */
  fast?: boolean;
}

export interface AgentHistoryItem {
  role: "user" | "assistant";
  text: string;
}

const MAX_STEPS = 6;

const INTENT_TOOLS: Record<Exclude<Intent, "query">, string[]> = {
  create: ["createEvent", "createReminder"],
  delete: ["deleteEvent"],
  move: ["moveEvent", "updateEvent"],
  update: ["updateEvent", "moveEvent"],
};

/**
 * Tool-calling loop: LLM → tool calls → HomeCal executor → LLM … → final answer.
 * The LLM never writes to Firestore itself; only ToolExecutor does, with validation.
 */
export async function runAgent(opts: {
  input: string;
  history: AgentHistoryItem[];
  systemPrompt: string;
  llm: LLMProvider;
  executor: ToolExecutor;
  now?: Date;
  signal?: AbortSignal;
  onStep?(label: string): void;
}): Promise<AgentResult> {
  const hints = dateHints(opts.input, opts.now ?? new Date());
  const userContent = hints.length ? `${opts.input}\n\n[Repères calculés : ${hints.join(" ; ")}]` : opts.input;
  const messages: ChatMessage[] = [
    { role: "system", content: opts.systemPrompt },
    ...opts.history.slice(-6).map((h) => ({ role: h.role, content: h.text }) as ChatMessage),
    { role: "user", content: userContent },
  ];
  const intent = detectIntent(opts.input);
  const actions: AgentAction[] = [];
  const seen = new Map<string, number>();
  let nudged = false;

  for (let step = 0; step < MAX_STEPS; step++) {
    opts.onStep?.(step === 0 ? "Je réfléchis…" : "Je vérifie…");
    const res = await opts.llm.chat({ messages, tools: TOOLS, signal: opts.signal });

    if (!res.toolCalls.length) {
      // Guard: the model claims an action without having called the tool.
      if (intent !== "query" && !nudged && !res.content.trim().endsWith("?")) {
        const expected = INTENT_TOOLS[intent];
        const done = actions.some((a) => a.result.ok && a.result.changed && expected.includes(a.name));
        if (!done) {
          nudged = true;
          messages.push({ role: "assistant", content: res.content });
          messages.push({
            role: "user",
            content: `[Système] Aucune action n'a été exécutée. Appelle maintenant l'outil ${expected[0]} avec les bons paramètres (id obtenu par searchEvents si besoin). Ne réponds pas avant.`,
          });
          continue;
        }
      }
      const text = res.content || fallbackText(actions);
      return { text, actions, changed: actions.some((a) => a.result.changed) };
    }

    messages.push({ role: "assistant", content: res.content, tool_calls: res.toolCalls.map((c) => ({ function: c })) });

    for (const call of res.toolCalls) {
      const sig = `${call.name}:${JSON.stringify(call.arguments)}`;
      const repeats = (seen.get(sig) ?? 0) + 1;
      seen.set(sig, repeats);
      let result: ToolResult;
      if (repeats > 1 && actions.some((a) => a.result.changed && `${a.name}:${JSON.stringify(a.args)}` === sig)) {
        // never apply the same modification twice
        result = { ok: false, data: { error: "Action déjà effectuée, ne la répète pas." }, summary: "Doublon ignoré" };
      } else {
        opts.onStep?.(STEP_LABEL[call.name] ?? "J'agis…");
        result = await opts.executor.run(call.name, call.arguments);
        actions.push({ name: call.name, args: call.arguments, result });
      }
      messages.push({ role: "tool", tool_name: call.name, content: JSON.stringify({ ok: result.ok, ...(result.data as object) }) });
    }
  }
  return { text: fallbackText(actions), actions, changed: actions.some((a) => a.result.changed) };
}

/**
 * Entry point used by the UI: deterministic fast path for simple "Ajoute …" commands,
 * LLM agent for everything else.
 */
export async function handleUtterance(opts: {
  input: string;
  history: AgentHistoryItem[];
  systemPrompt: string;
  llm: LLMProvider | null;
  executor: ToolExecutor;
  now: Date;
  profiles: Profile[];
  places: FavoritePlace[];
  currentProfileId?: string;
  signal?: AbortSignal;
  onStep?(label: string): void;
}): Promise<AgentResult> {
  const quick = quickCreateFromCommand(opts.input, {
    now: opts.now,
    profiles: opts.profiles,
    places: opts.places,
    currentProfileId: opts.currentProfileId,
  });
  if (quick || !opts.llm) {
    if (!quick) {
      return {
        text: "L'assistant local n'est pas disponible. Je peux seulement ajouter des événements simples, par exemple « Ajoute dentiste jeudi à 16h ».",
        actions: [],
        changed: false,
        fast: true,
      };
    }
    const args: Record<string, unknown> = {
      title: quick.title,
      start: quick.allDay ? localIso(quick.start).slice(0, 10) : localIso(quick.start),
      end: quick.allDay ? undefined : localIso(quick.end),
      allDay: quick.allDay,
      profiles: quick.profileIds,
      location: quick.location?.label,
      type: quick.type,
      recurrence: quick.recurrence
        ? { freq: quick.recurrence.freq, interval: quick.recurrence.interval, weekdays: quick.recurrence.byWeekday?.map(String) }
        : undefined,
    };
    opts.onStep?.(STEP_LABEL.createEvent);
    const result = await opts.executor.run("createEvent", args);
    const who = quick.profileIds
      .map((id) => opts.profiles.find((p) => p.id === id))
      .filter((p) => p && p.id !== opts.currentProfileId)
      .map((p) => p!.name);
    const when = `${fmtRelativeDay(quick.start, opts.now).toLowerCase()}${quick.allDay ? "" : ` à ${fmtTime(quick.start)}`}`;
    const text = result.ok
      ? `C'est noté : ${quick.title} ${when}${who.length ? ` pour ${who.join(" et ")}` : ""}.`
      : `Je n'ai pas pu ajouter l'événement : ${result.summary}`;
    return { text, actions: [{ name: "createEvent", args, result }], changed: result.ok, fast: true };
  }
  return runAgent({ ...opts, llm: opts.llm });
}

const STEP_LABEL: Record<string, string> = {
  createEvent: "J'ajoute l'événement…",
  updateEvent: "Je modifie…",
  moveEvent: "Je déplace…",
  deleteEvent: "Je supprime…",
  getEvents: "Je consulte le calendrier…",
  searchEvents: "Je cherche…",
  findAvailability: "Je cherche des créneaux libres…",
  getWeather: "Je regarde la météo…",
  calculateRoute: "Je calcule le trajet…",
  createReminder: "Je crée le rappel…",
};

function fallbackText(actions: AgentAction[]): string {
  const done = actions.filter((a) => a.result.ok && a.result.changed).map((a) => a.result.summary);
  if (done.length) return done.join(". ") + ".";
  const failed = actions.find((a) => !a.result.ok);
  if (failed) return `Je n'ai pas pu terminer : ${failed.result.summary}`;
  return "D'accord.";
}
