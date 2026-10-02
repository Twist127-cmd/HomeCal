import type { LLMMode } from "@/lib/types";
import type { ChatRequest, ChatResponse, LLMHealth, LLMProvider } from "./LLMProvider";
import { parseOllamaMessage } from "./parse";

export interface OllamaOptions {
  /** Ollama URL as seen by the browser (direct mode) */
  baseUrl: string;
  model: string;
  mode: LLMMode;
  /** Context window. Smaller = more of the model fits in VRAM (faster). */
  numCtx?: number;
}

/**
 * Local LLM through Ollama.
 *  - proxy:  browser → /api/llm/chat (Next.js server) → OLLAMA_BASE_URL   (local dev / next start)
 *  - direct: browser → http://localhost:11434 (requires OLLAMA_ORIGINS to allow the site origin; used on Vercel)
 *  - auto:   proxy first, then direct; the working route is remembered.
 */
export class OllamaProvider implements LLMProvider {
  readonly id = "ollama" as const;
  private resolved: "proxy" | "direct" | null = null;

  constructor(private readonly opts: OllamaOptions) {
    if (opts.mode !== "auto") this.resolved = opts.mode;
  }

  get model() {
    return this.opts.model;
  }

  private endpoint(route: "proxy" | "direct") {
    return route === "proxy" ? "/api/llm/chat" : `${this.opts.baseUrl.replace(/\/$/, "")}/api/chat`;
  }

  async health(): Promise<LLMHealth> {
    const tryProxy = async (): Promise<LLMHealth> => {
      const r = await fetch("/api/llm/health", { cache: "no-store", signal: AbortSignal.timeout(4000) });
      const j = (await r.json()) as LLMHealth;
      return { ...j, via: "proxy" };
    };
    const tryDirect = async (): Promise<LLMHealth> => {
      const r = await fetch(`${this.opts.baseUrl.replace(/\/$/, "")}/api/tags`, { signal: AbortSignal.timeout(4000) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = (await r.json()) as { models?: { name: string }[] };
      return { ok: true, via: "direct", models: (j.models ?? []).map((m) => m.name) };
    };
    const order: ("proxy" | "direct")[] =
      this.opts.mode === "auto" ? (this.resolved === "direct" ? ["direct", "proxy"] : ["proxy", "direct"]) : [this.opts.mode];
    let last: LLMHealth = { ok: false, error: "Ollama injoignable" };
    for (const route of order) {
      try {
        const h = route === "proxy" ? await tryProxy() : await tryDirect();
        if (h.ok) {
          this.resolved = route;
          const modelAvailable = !!h.models?.some((m) => m === this.opts.model || m.split(":")[0] === this.opts.model);
          return { ...h, modelAvailable };
        }
        last = h;
      } catch (e) {
        last = {
          ok: false,
          via: route,
          error:
            route === "direct"
              ? `Connexion directe à ${this.opts.baseUrl} impossible (Ollama lancé ? OLLAMA_ORIGINS ?) : ${(e as Error).message}`
              : (e as Error).message,
        };
      }
    }
    return last;
  }

  async chat(req: ChatRequest): Promise<ChatResponse> {
    if (!this.resolved) {
      const h = await this.health();
      if (!h.ok) throw new Error(h.error ?? "Ollama injoignable");
    }
    const body = {
      model: this.opts.model,
      messages: req.messages,
      tools: req.tools,
      stream: false,
      think: false,
      keep_alive: "30m",
      format: req.json ? "json" : undefined,
      // num_predict caps runaway generations (small models sometimes loop)
      options: { temperature: req.temperature ?? 0.1, num_ctx: this.opts.numCtx ?? 6144, num_predict: 400 },
    };
    const res = await fetch(this.endpoint(this.resolved!), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: req.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Ollama HTTP ${res.status} ${text.slice(0, 200)}`);
    }
    const data = (await res.json()) as {
      message?: Parameters<typeof parseOllamaMessage>[0];
      prompt_eval_count?: number;
      eval_count?: number;
      total_duration?: number;
    };
    const parsed = parseOllamaMessage(
      data.message,
      req.tools?.map((t) => t.function.name),
    );
    return {
      ...parsed,
      stats: {
        promptTokens: data.prompt_eval_count ?? 0,
        outputTokens: data.eval_count ?? 0,
        durationMs: Math.round((data.total_duration ?? 0) / 1e6),
      },
    };
  }
}
