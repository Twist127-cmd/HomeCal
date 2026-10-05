import type { ChatMessage, LLMProvider } from "@/providers/llm";
import { localIso, type ToolExecutor, type ToolResult } from "./executor";
import { dateHints, detectIntent, parseWeatherQuestion, quickCreateFromCommand, type Intent, type WeatherQuestion } from "./hints";
import { TOOLS } from "./tools";
import { fmtRelativeDay, fmtTime } from "@/lib/dates";
import { normalize } from "@/lib/profiles";
import { parseQuickAdd, type QuickAddResult } from "@/lib/quickadd";
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
  /** set when the assistant asked a question it will resolve itself on the next turn */
  pending?: PendingQuestion;
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
/** A question the assistant asked and whose answer it is waiting for. */
export interface PendingQuestion {
  kind: "time";
  draft: QuickAddResult;
}

export interface UtteranceOptions {
  input: string;
  history: AgentHistoryItem[];
  systemPrompt: string;
  llm: LLMProvider | null;
  executor: ToolExecutor;
  now: Date;
  profiles: Profile[];
  places: FavoritePlace[];
  currentProfileId?: string;
  /** Question asked in the previous turn (e.g. "À quelle heure ?") */
  pending?: PendingQuestion | null;
  signal?: AbortSignal;
  onStep?(label: string): void;
}

const ALL_DAY_RE = /\b(toute la journee|journee entiere|journee complete|toute la jour|pas d'heure|sans heure|la journee)\b/;
const CANCEL_RE = /^(non|annule|annuler|laisse tomber|oublie|stop|rien|pas maintenant)\b/;

/** true when the assistant's answer is a question → the UI re-opens the microphone. */
export function isQuestion(text: string): boolean {
  return /\?\s*$/.test(text.trim());
}

export async function handleUtterance(opts: UtteranceOptions): Promise<AgentResult> {
  const qaOpts = { now: opts.now, profiles: opts.profiles, places: opts.places, currentProfileId: opts.currentProfileId };
  const norm = normalize(opts.input);

  // 1. Answer to a pending "À quelle heure ?" question
  if (opts.pending?.kind === "time") {
    const draft = opts.pending.draft;
    if (CANCEL_RE.test(norm)) return { text: "D'accord, je n'ajoute rien.", actions: [], changed: false, fast: true };
    if (ALL_DAY_RE.test(norm)) {
      const day = new Date(draft.start);
      day.setHours(0, 0, 0, 0);
      return createFromQuick({ ...draft, allDay: true, start: day, end: new Date(day.getTime() + 86_400_000) }, opts);
    }
    const reply = parseQuickAdd(opts.input, qaOpts);
    if (reply.hasExplicitTime) {
      // duration: from the reply when it is a range ("de 14h à 16h"), otherwise the default for this kind of event
      const combined = parseQuickAdd(`${draft.title} ${opts.input}`, qaOpts);
      const start = new Date(draft.start);
      start.setHours(reply.start.getHours(), reply.start.getMinutes(), 0, 0);
      const end = new Date(start.getTime() + (combined.end.getTime() - combined.start.getTime()));
      return createFromQuick({ ...draft, allDay: false, start, end, hasExplicitTime: true }, opts);
    }
    // not an answer to the question: handle as a new request
  }

  // 2. Weather questions: deterministic, fast, any city
  const wq = parseWeatherQuestion(opts.input, opts.now, opts.places);
  if (wq) {
    opts.onStep?.(STEP_LABEL.getWeather);
    const args: Record<string, unknown> = {
      location: wq.location,
      date: wq.dateOnly ? localIso(wq.at).slice(0, 10) : localIso(wq.at),
    };
    const result = await opts.executor.run("getWeather", args);
    return { text: weatherSentence(result, wq, opts.now), actions: [{ name: "getWeather", args, result }], changed: false, fast: true };
  }

  // 3. Simple "Ajoute …" commands
  const quick = quickCreateFromCommand(opts.input, qaOpts);
  if (quick) {
    if (!quick.hasExplicitTime && !ALL_DAY_RE.test(norm)) {
      const day = fmtRelativeDay(quick.start, opts.now).toLowerCase();
      return {
        text: `À quelle heure souhaitez-vous « ${quick.title} » ${day} ?`,
        actions: [],
        changed: false,
        fast: true,
        pending: { kind: "time", draft: quick },
      };
    }
    return createFromQuick(quick, opts);
  }

  if (!opts.llm) {
    return {
      text: "L'assistant local n'est pas disponible. Je peux seulement ajouter des événements simples, par exemple « Ajoute dentiste jeudi à 16h ».",
      actions: [],
      changed: false,
      fast: true,
    };
  }
  return runAgent({ ...opts, llm: opts.llm });
}

async function createFromQuick(quick: QuickAddResult, opts: UtteranceOptions): Promise<AgentResult> {
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
  const when = `${fmtRelativeDay(quick.start, opts.now).toLowerCase()}${quick.allDay ? ", toute la journée" : ` à ${fmtTime(quick.start)}`}`;
  const text = result.ok
    ? `C'est noté : ${quick.title} ${when}${who.length ? ` pour ${who.join(" et ")}` : ""}.`
    : `Je n'ai pas pu ajouter l'événement : ${result.summary}`;
  return { text, actions: [{ name: "createEvent", args, result }], changed: result.ok, fast: true };
}

function weatherSentence(result: ToolResult, wq: WeatherQuestion, now: Date): string {
  if (!result.ok) return `Je n'ai pas la météo : ${result.summary}.`;
  const d = result.data as {
    location: string;
    conditions: string;
    temperature?: number;
    tMin?: number;
    tMax?: number;
    precipitationProbability: number;
    windKmh?: number;
    windMaxKmh?: number;
  };
  const sameDay = wq.at.toDateString() === now.toDateString();
  const day = fmtRelativeDay(wq.at, now);
  const rain = `${d.precipitationProbability} % de risque de pluie`;
  if (wq.dateOnly) {
    return `${day} à ${d.location} : ${d.conditions.toLowerCase()}, entre ${d.tMin} et ${d.tMax} degrés, ${rain}.`;
  }
  const isNow = Math.abs(wq.at.getTime() - now.getTime()) < 30 * 60000;
  const when = isNow ? "En ce moment" : sameDay ? `Aujourd'hui à ${fmtTime(wq.at)}` : `${day} à ${fmtTime(wq.at)}`;
  const advice = d.precipitationProbability >= 60 ? " Prenez un parapluie." : "";
  return `${when} à ${d.location} : ${d.conditions.toLowerCase()}, ${d.temperature} degrés, ${rain}, vent ${d.windKmh} km/h.${advice}`;
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
