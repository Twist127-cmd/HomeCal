import type { HouseholdSettings } from "@/lib/types";
import type { LLMProvider } from "./LLMProvider";
import { OllamaProvider } from "./OllamaProvider";

export * from "./LLMProvider";
export { OllamaProvider } from "./OllamaProvider";
export { OpenAIProvider, AnthropicProvider } from "./CloudProviders";

export function createLLMProvider(settings: HouseholdSettings["llm"]): LLMProvider {
  return new OllamaProvider({
    baseUrl: settings.baseUrl || process.env.NEXT_PUBLIC_OLLAMA_URL || "http://localhost:11434",
    model: settings.model || process.env.NEXT_PUBLIC_OLLAMA_MODEL || "qwen3:4b-instruct",
    mode: settings.mode || "auto",
  });
}
