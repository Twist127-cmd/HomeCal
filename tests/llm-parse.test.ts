import { describe, expect, it } from "vitest";
import { cleanAssistantText, extractJsonObjects, parseOllamaMessage, stripThinking } from "@/providers/llm/parse";

const TOOLS = ["createEvent", "getEvents"];

describe("parseOllamaMessage", () => {
  it("reads native tool_calls with object arguments", () => {
    const r = parseOllamaMessage(
      { role: "assistant", content: "", tool_calls: [{ function: { name: "createEvent", arguments: { title: "Dentiste", start: "2026-10-01T16:00" } } }] },
      TOOLS,
    );
    expect(r.toolCalls).toEqual([{ name: "createEvent", arguments: { title: "Dentiste", start: "2026-10-01T16:00" } }]);
  });

  it("reads tool_calls with JSON-string arguments", () => {
    const r = parseOllamaMessage(
      { content: "", tool_calls: [{ function: { name: "getEvents", arguments: '{"from":"2026-10-01","to":"2026-10-02"}' } }] },
      TOOLS,
    );
    expect(r.toolCalls[0].arguments).toEqual({ from: "2026-10-01", to: "2026-10-02" });
  });

  it("falls back to Qwen <tool_call> tags in content", () => {
    const r = parseOllamaMessage(
      { content: '<tool_call>\n{"name": "createEvent", "arguments": {"title": "Yoga", "start": "2026-10-06T19:00"}}\n</tool_call>' },
      TOOLS,
    );
    expect(r.toolCalls).toHaveLength(1);
    expect(r.toolCalls[0].name).toBe("createEvent");
    expect(r.content).toBe("");
  });

  it("falls back to fenced JSON with 'parameters'", () => {
    const r = parseOllamaMessage({ content: '```json\n{"name":"getEvents","parameters":{"from":"2026-10-01","to":"2026-10-03"}}\n```' }, TOOLS);
    expect(r.toolCalls[0]).toEqual({ name: "getEvents", arguments: { from: "2026-10-01", to: "2026-10-03" } });
  });

  it("ignores unknown tool names in text", () => {
    const r = parseOllamaMessage({ content: '{"name": "rm_rf", "arguments": {}}' }, TOOLS);
    expect(r.toolCalls).toHaveLength(0);
  });

  it("plain answers stay text, thinking is stripped", () => {
    const r = parseOllamaMessage({ content: "<think>hmm</think>Vous avez 2 rendez-vous demain." }, TOOLS);
    expect(r.toolCalls).toHaveLength(0);
    expect(r.content).toBe("Vous avez 2 rendez-vous demain.");
  });

  it("handles a missing message", () => {
    expect(parseOllamaMessage(undefined, TOOLS)).toMatchObject({ content: "", toolCalls: [] });
  });
});

describe("helpers", () => {
  it("extracts balanced JSON objects with braces inside strings", () => {
    const objs = extractJsonObjects('a {"x": "{not}"} b {"y": {"z": 1}}');
    expect(objs).toEqual([{ x: "{not}" }, { y: { z: 1 } }]);
  });

  it("tolerates trailing commas", () => {
    expect(extractJsonObjects('{"a": 1,}')).toEqual([{ a: 1 }]);
  });

  it("stripThinking removes unterminated think blocks", () => {
    expect(stripThinking("raisonnement…</think>Réponse")).toBe("Réponse");
  });

  it("cleanAssistantText removes markdown bold", () => {
    expect(cleanAssistantText("C'est **noté**.")).toBe("C'est noté.");
  });
});
