import { ProviderError } from "../errors";
import type { ChatRequest, ChatResponse, LLMHealth, LLMProvider } from "./LLMProvider";

/**
 * Cloud LLM providers — PLANNED, NOT ACTIVE IN V1 (pay-per-use).
 * They will go through a server route holding OPENAI_API_KEY / ANTHROPIC_API_KEY.
 * Activating one of them generates costs: confirm with the household first.
 */

export class OpenAIProvider implements LLMProvider {
  readonly id = "openai" as const;
  constructor(readonly model = "gpt-5-mini") {}
  async health(): Promise<LLMHealth> {
    return { ok: false, error: "NOT_CONFIGURED" };
  }
  async chat(_req: ChatRequest): Promise<ChatResponse> {
    void _req;
    throw new ProviderError("NOT_CONFIGURED", "OpenAIProvider non activé en V1");
  }
}

export class AnthropicProvider implements LLMProvider {
  readonly id = "anthropic" as const;
  constructor(readonly model = "claude-haiku-4-5") {}
  async health(): Promise<LLMHealth> {
    return { ok: false, error: "NOT_CONFIGURED" };
  }
  async chat(_req: ChatRequest): Promise<ChatResponse> {
    void _req;
    throw new ProviderError("NOT_CONFIGURED", "AnthropicProvider non activé en V1");
  }
}
