export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, unknown>;
      required?: string[];
    };
  };
}

export interface ToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

export type ChatMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string; tool_calls?: { function: ToolCall }[] }
  | { role: "tool"; content: string; tool_name: string };

export interface ChatRequest {
  messages: ChatMessage[];
  tools?: ToolDefinition[];
  temperature?: number;
  signal?: AbortSignal;
  /** Ask for a JSON object answer (no tools) */
  json?: boolean;
}

export interface ChatResponse {
  content: string;
  toolCalls: ToolCall[];
  raw?: unknown;
  stats?: { promptTokens: number; outputTokens: number; durationMs: number };
}

export interface LLMHealth {
  ok: boolean;
  via?: "proxy" | "direct";
  models?: string[];
  modelAvailable?: boolean;
  error?: string;
}

export interface LLMProvider {
  readonly id: "ollama" | "openai" | "anthropic";
  readonly model: string;
  chat(req: ChatRequest): Promise<ChatResponse>;
  health(): Promise<LLMHealth>;
  /** Optional: load the model ahead of the first request */
  warm?(): Promise<void>;
}
