import type { ChatMessage, LLMProvider, ToolDefinition } from "@/providers/llm";
import type { FavoritePlace, Profile, Scene } from "@/lib/types";
import { type ToolExecutor, type ToolResult } from "./executor";
import { dateHints, detectIntent, type Intent } from "./hints";
import { sentence } from "./responses/common";
import { resumePending, route } from "./router/intentRouter";
import type { PendingState, RouteOutcome, RunEnv } from "./router/types";
import { toolsForDomain } from "./tools";

/**
 * HomeCal assistant — "Deterministic first, LLM second".
 *
 *   input → normalization → intent router → confident? → tool → deterministic answer (0 LLM call)
 *                                          → otherwise  → LLM (restricted tools, short history, ≤ 3 steps)
 *
 * The LLM never writes to Firestore and can never contradict a successful tool result.
 */

export interface AgentAction {
  name: string;
  args: Record<string, unknown>;
  result: ToolResult;
}

export interface AgentMetrics {
  totalMs: number;
  routerMs: number;
  toolMs: number;
  llmMs: number;
  llmCalls: number;
  fastPath: boolean;
  intent?: string;
  confidence?: number;
  toolCount: number;
}

export interface AgentResult {
  text: string;
  actions: AgentAction[];
  changed: boolean;
  /** true when handled without the LLM */
  fast?: boolean;
  /** question asked to the user, resolved deterministically on the next turn */
  pending?: PendingQuestion;
  metrics?: AgentMetrics;
}

export interface AgentHistoryItem {
  role: "user" | "assistant";
  text: string;
}

/** Short structured memory (kept as an alias for the UI). */
export type PendingQuestion = PendingState;

export const MAX_STEPS = 3;

export { sentence };

/** true when the assistant's answer is a question → the UI re-opens the microphone. */
export function isQuestion(text: string): boolean {
  return /\?\s*$/.test(text.trim());
}

const INTENT_TOOLS: Record<Exclude<Intent, "query">, string[]> = {
  create: ["createEvent", "createReminder", "createTimer", "addShoppingItem"],
  delete: ["deleteEvent", "removeShoppingItem", "cancelTimer", "cancelReminder"],
  move: ["moveEvent", "updateEvent"],
  update: ["updateEvent", "moveEvent"],
};

const CONTRADICTION_RE = /(pas compris|ne comprends|n'ai pas compris|aucun (element|élément|article|evenement|événement)|n'ai pas pu|impossible|desole|désolé|je ne peux pas)/i;

/** Keep only the history useful for this request (0 turn for an independent command). */
export function selectRelevantHistory(input: string, history: AgentHistoryItem[]): AgentHistoryItem[] {
  const n = input.trim().toLowerCase();
  const contextual =
    n.split(/\s+/).length <= 3 ||
    /^(et|oui|non|ok|d'accord|plutot|plutôt|celui|celle|le premier|la premiere|la première|le deuxieme|le deuxième|pareil|aussi|encore)\b/.test(n) ||
    /[-'](le|la|les|lui|y|en)\b|\b(celui-ci|celle-ci|ca|ça|cela|dessus|le meme|la meme|la même|le même)\b/.test(n);
  return contextual ? history.slice(-4) : [];
}

/**
 * Tool-calling loop (LLM fallback). At most MAX_STEPS model calls; stops right after a
 * successful action without asking the model to rephrase it.
 */
export async function runAgent(opts: {
  input: string;
  history: AgentHistoryItem[];
  systemPrompt: string;
  llm: LLMProvider;
  executor: ToolExecutor;
  /** tools exposed to the model (default: chosen from the sentence) */
  tools?: ToolDefinition[];
  now?: Date;
  signal?: AbortSignal;
  onStep?(label: string): void;
}): Promise<AgentResult> {
  const hints = dateHints(opts.input, opts.now ?? new Date());
  const userContent = hints.length ? `${opts.input}\n\n[Repères calculés : ${hints.join(" ; ")}]` : opts.input;
  const messages: ChatMessage[] = [
    { role: "system", content: opts.systemPrompt },
    ...opts.history.map((h) => ({ role: h.role, content: h.text }) as ChatMessage),
    { role: "user", content: userContent },
  ];
  const intent = detectIntent(opts.input);
  const actions: AgentAction[] = [];
  const done = new Set<string>();
  let nudged = false;

  for (let step = 0; step < MAX_STEPS; step++) {
    opts.onStep?.(step === 0 ? "Je réfléchis…" : "Je vérifie…");
    const res = await opts.llm.chat({ messages, tools: opts.tools ?? toolsForDomain(undefined, opts.input), signal: opts.signal });

    if (!res.toolCalls.length) {
      const succeeded = actions.some((a) => a.result.ok && a.result.changed);
      // Guard 1: the model claims an action it did not perform → one nudge
      if (intent !== "query" && !nudged && !succeeded && !isQuestion(res.content) && step < MAX_STEPS - 1) {
        nudged = true;
        messages.push({ role: "assistant", content: res.content });
        messages.push({ role: "user", content: `[Système] Aucune action n'a été exécutée. Appelle maintenant l'outil ${INTENT_TOOLS[intent][0]} avec les bons paramètres.` });
        continue;
      }
      // Guard 2: never contradict a successful tool result
      let text = res.content || fallbackText(actions);
      if (succeeded && CONTRADICTION_RE.test(text)) text = fallbackText(actions);
      return { text, actions, changed: succeeded };
    }

    messages.push({ role: "assistant", content: res.content, tool_calls: res.toolCalls.map((c) => ({ function: c })) });

    for (const call of res.toolCalls) {
      const sig = `${call.name}:${JSON.stringify(call.arguments)}`;
      let result: ToolResult;
      if (done.has(sig)) {
        // idempotence: the same modification is never applied twice in one request
        result = { ok: false, data: { error: "Action déjà effectuée, ne la répète pas." }, summary: "Doublon ignoré" };
      } else {
        opts.onStep?.(STEP_LABEL[call.name] ?? "J'agis…");
        result = await opts.executor.run(call.name, call.arguments);
        actions.push({ name: call.name, args: call.arguments, result });
        if (result.changed) done.add(sig);
      }
      messages.push({ role: "tool", tool_name: call.name, content: JSON.stringify({ ok: result.ok, ...(result.data as object) }) });
    }

    // Early exit: an action succeeded and nothing else is needed → deterministic confirmation
    const stepActions = actions.slice(-res.toolCalls.length);
    const allOk = stepActions.length > 0 && stepActions.every((a) => a.result.ok);
    const changed = stepActions.some((a) => a.result.changed);
    const needsChoice = stepActions.some((a) => (a.result.data as { choices?: unknown } | undefined)?.choices);
    if (intent !== "query" && allOk && changed && !needsChoice) {
      return { text: fallbackText(actions), actions, changed: true };
    }
  }
  return { text: fallbackText(actions), actions, changed: actions.some((a) => a.result.changed) };
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
  /** question asked in the previous turn */
  pending?: PendingQuestion | null;
  /** scenes, to recognise "mode cuisine" */
  scenesForParsing?: Scene[];
  signal?: AbortSignal;
  onStep?(label: string): void;
}

/** Entry point used by the UI. */
export async function handleUtterance(opts: UtteranceOptions): Promise<AgentResult> {
  const t0 = performance.now();
  const m: AgentMetrics = { totalMs: 0, routerMs: 0, toolMs: 0, llmMs: 0, llmCalls: 0, fastPath: true, toolCount: 0 };

  // instrumented executor / LLM (timings only, no content logged)
  const executor = {
    run: async (name: string, args: Record<string, unknown>) => {
      const s = performance.now();
      try {
        return await opts.executor.run(name, args);
      } finally {
        m.toolMs += performance.now() - s;
        m.toolCount++;
      }
    },
  } as ToolExecutor;
  const llm: LLMProvider | null = opts.llm
    ? {
        id: opts.llm.id,
        model: opts.llm.model,
        health: () => opts.llm!.health(),
        chat: async (req) => {
          const s = performance.now();
          m.llmCalls++;
          try {
            return await opts.llm!.chat(req);
          } finally {
            m.llmMs += performance.now() - s;
          }
        },
      }
    : null;

  const env: RunEnv = {
    executor,
    onStep: opts.onStep,
    ctx: { now: opts.now, profiles: opts.profiles, places: opts.places, scenes: opts.scenesForParsing ?? [], currentProfileId: opts.currentProfileId },
  };
  const finish = (r: RouteOutcome | AgentResult, extra: Partial<AgentMetrics> = {}): AgentResult => {
    Object.assign(m, extra);
    m.totalMs = Math.round(performance.now() - t0);
    m.toolMs = Math.round(m.toolMs);
    m.llmMs = Math.round(m.llmMs);
    const out: AgentResult = { ...r, fast: m.llmCalls === 0, metrics: m };
    logMetrics(m);
    return out;
  };

  // 1. answer to a pending question ("À quelle heure ?", "Lequel ?")
  if (opts.pending) {
    const r = await resumePending(opts.pending, opts.input, env);
    if (r) return finish(r, { intent: `${opts.pending.domain}.${opts.pending.kind}`, confidence: 1 });
  }

  // 2. deterministic router
  const decision = route(opts.input, env.ctx);
  m.routerMs = decision.routerMs;
  if (decision.best) {
    m.intent = decision.best.intent;
    m.confidence = decision.best.confidence;
  }
  if (decision.execute && decision.best) {
    const r = await decision.best.module.run(decision.best, env);
    return finish(r);
  }

  // 3. LLM fallback
  if (!llm) {
    return finish({
      text: "L'assistant local n'est pas disponible. Les commandes simples fonctionnent : « Ajoute dentiste jeudi à 16h », « Minuteur 10 minutes », « Ajoute du lait aux courses ».",
      actions: [],
      changed: false,
    });
  }
  m.fastPath = false;
  const r = await runAgent({
    input: opts.input,
    history: selectRelevantHistory(opts.input, opts.history),
    systemPrompt: opts.systemPrompt,
    llm,
    executor,
    tools: toolsForDomain(decision.domainHint, opts.input),
    now: opts.now,
    signal: opts.signal,
    onStep: opts.onStep,
  });
  return finish(r);
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
  if (done.length) return `✓ ${sentence(done.join(". "))}`;
  const failed = actions.find((a) => !a.result.ok);
  if (failed) return sentence(failed.result.summary);
  const read = actions.filter((a) => a.result.ok).map((a) => a.result.summary);
  if (read.length) return sentence(read.join(". "));
  return "D'accord.";
}

function logMetrics(m: AgentMetrics) {
  let debug = process.env.NEXT_PUBLIC_ASSISTANT_DEBUG === "true";
  try {
    if (typeof localStorage !== "undefined" && localStorage.getItem("homecal.debug") === "1") debug = true;
  } catch {
    /* ignore */
  }
  if (debug) console.info("[HomeCal assistant]", JSON.stringify(m));
}
