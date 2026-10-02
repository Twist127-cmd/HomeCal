import type { ChatResponse, ToolCall } from "./LLMProvider";

/**
 * Robust parsing of Ollama /api/chat responses.
 * Small local models sometimes return tool calls as text instead of `tool_calls`:
 *   <tool_call>{"name": "...", "arguments": {...}}</tool_call>   (Qwen)
 *   ```json {"name": "...", "parameters": {...}} ```
 *   {"tool": "...", "args": {...}}
 * Arguments may also be a JSON string.
 */

interface OllamaMessage {
  role?: string;
  content?: string;
  thinking?: string;
  tool_calls?: { function?: { name?: string; arguments?: unknown } }[];
}

export function stripThinking(s: string): string {
  return s
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/^[\s\S]*?<\/think>/i, "") // unterminated opening
    .trim();
}

function toArgs(a: unknown): Record<string, unknown> {
  if (a && typeof a === "object" && !Array.isArray(a)) return a as Record<string, unknown>;
  if (typeof a === "string") {
    const parsed = safeJson(a);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
  }
  return {};
}

export function safeJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    // tolerate trailing commas and single quotes
    try {
      return JSON.parse(s.replace(/,\s*([}\]])/g, "$1").replace(/'/g, '"'));
    } catch {
      return undefined;
    }
  }
}

function asToolCall(o: unknown, known?: Set<string>): ToolCall | null {
  if (!o || typeof o !== "object") return null;
  const r = o as Record<string, unknown>;
  const fn = (r.function && typeof r.function === "object" ? r.function : r) as Record<string, unknown>;
  const name = (fn.name ?? fn.tool ?? fn.tool_name) as unknown;
  if (typeof name !== "string" || !name) return null;
  if (known && !known.has(name)) return null;
  return { name, arguments: toArgs(fn.arguments ?? fn.parameters ?? fn.args ?? fn.input ?? {}) };
}

/** Extract balanced {...} JSON objects from free text. */
export function extractJsonObjects(text: string): unknown[] {
  const out: unknown[] = [];
  let depth = 0;
  let start = -1;
  let inStr = false;
  let esc = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === "{") {
      if (depth === 0) start = i;
      depth++;
    } else if (c === "}" && depth > 0) {
      depth--;
      if (depth === 0 && start >= 0) {
        const v = safeJson(text.slice(start, i + 1));
        if (v !== undefined) out.push(v);
        start = -1;
      }
    }
  }
  return out;
}

export function parseToolCallsFromText(text: string, known?: Set<string>): ToolCall[] {
  const calls: ToolCall[] = [];
  const tagged = [...text.matchAll(/<tool_call>([\s\S]*?)<\/tool_call>/gi)].map((m) => m[1]);
  const sources = tagged.length ? tagged : [text];
  for (const src of sources) {
    for (const obj of extractJsonObjects(src)) {
      const list = Array.isArray((obj as { tool_calls?: unknown[] }).tool_calls)
        ? (obj as { tool_calls: unknown[] }).tool_calls
        : [obj];
      for (const item of list) {
        const call = asToolCall(item, known);
        if (call) calls.push(call);
      }
    }
  }
  return calls;
}

/** Remove tool-call JSON/tags from text meant for the user. */
export function cleanAssistantText(text: string): string {
  return stripThinking(text)
    .replace(/<tool_call>[\s\S]*?<\/tool_call>/gi, "")
    .replace(/```(?:json)?[\s\S]*?```/gi, "")
    .replace(/\*\*/g, "")
    .trim();
}

export function parseOllamaMessage(message: OllamaMessage | undefined, toolNames?: string[]): ChatResponse {
  const known = toolNames?.length ? new Set(toolNames) : undefined;
  const content = message?.content ?? "";
  let toolCalls: ToolCall[] = (message?.tool_calls ?? [])
    .map((tc) => asToolCall(tc.function ?? tc, known))
    .filter((c): c is ToolCall => !!c);

  if (!toolCalls.length && known && content) {
    toolCalls = parseToolCallsFromText(stripThinking(content), known);
  }
  return {
    content: toolCalls.length ? cleanAssistantText(content.replace(/\{[\s\S]*\}/, "")) : cleanAssistantText(content),
    toolCalls,
    raw: message,
  };
}
