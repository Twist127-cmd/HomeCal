import type { FavoritePlace, Profile, Scene } from "@/lib/types";
import type { ToolExecutor, ToolResult } from "../executor";
import type { Utterance } from "./normalize";

/** Result of a deterministic domain parser. */
export interface ParsedIntent {
  /** "shopping.add", "timer.create", "calendar.move"… */
  intent: string;
  /** 0..1 */
  confidence: number;
  entities: Record<string, unknown>;
  raw: string;
  /** destructive actions (delete, clear, move…) need a higher confidence */
  destructive?: boolean;
}

/** Short structured memory between two turns ("À quelle heure ?", "Lequel ?"). */
export interface PendingState {
  domain: string;
  kind: string;
  data: Record<string, unknown>;
}

export interface RouterContext {
  now: Date;
  profiles: Profile[];
  places: FavoritePlace[];
  scenes: Scene[];
  currentProfileId?: string;
}

export interface RouteAction {
  name: string;
  args: Record<string, unknown>;
  result: ToolResult;
}

export interface RouteOutcome {
  text: string;
  actions: RouteAction[];
  changed: boolean;
  pending?: PendingState;
}

export interface RunEnv {
  executor: ToolExecutor;
  ctx: RouterContext;
  onStep?(label: string): void;
}

/** One domain = parser + executor of its intents + deterministic responses. */
export interface DomainModule {
  domain: string;
  /** Parse an utterance; return null when the sentence is not for this domain. */
  parse(u: Utterance, ctx: RouterContext): ParsedIntent | null;
  /** Execute a parsed intent through the ToolExecutor and build the answer (no LLM). */
  run(intent: ParsedIntent, env: RunEnv): Promise<RouteOutcome>;
  /** Handle the answer to a question this domain asked (pending.domain === domain). Null = not an answer. */
  resume?(pending: PendingState, u: Utterance, env: RunEnv): Promise<RouteOutcome | null>;
}

/** Helper: run one tool and return the action. */
export async function call(env: RunEnv, name: string, args: Record<string, unknown>, step?: string): Promise<RouteAction> {
  if (step) env.onStep?.(step);
  const result = await env.executor.run(name, args);
  return { name, args, result };
}
