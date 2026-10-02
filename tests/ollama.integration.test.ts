import { describe, expect, it } from "vitest";
import { handleUtterance } from "@/assistant/agent";
import type { LLMProvider } from "@/providers/llm";
import { ToolExecutor } from "@/assistant/executor";
import { buildSystemPrompt } from "@/assistant/prompt";
import { DEFAULT_SETTINGS } from "@/lib/types";
import { MemoryCalendarProvider } from "@/providers/calendar/MemoryCalendarProvider";
import { OllamaProvider } from "@/providers/llm";
import { d, ev, places, profiles } from "./fixtures";

/**
 * Real end-to-end test against a local Ollama server.
 * Run with:  $env:OLLAMA_IT="1"; npx vitest run tests/ollama.integration.test.ts
 */
const enabled = process.env.OLLAMA_IT === "1";
const model = process.env.OLLAMA_MODEL || "qwen3:4b";
const now = d(2026, 9, 30, 10, 0); // Wednesday 30 Sept 2026

function setup() {
  const cal = new MemoryCalendarProvider([
    ev({ id: "dent", title: "Dentiste", start: d(2026, 10, 1, 16).toISOString(), end: d(2026, 10, 1, 17).toISOString() }),
    ev({ id: "travail", title: "Réunion client", start: d(2026, 10, 3, 14).toISOString(), end: d(2026, 10, 3, 16).toISOString(), profileIds: ["compagne"] }),
  ]);
  const executor = new ToolExecutor({
    now: () => now,
    calendar: cal,
    events: () => cal.events,
    profiles,
    places,
    settings: DEFAULT_SETTINGS,
    homePlaceId: "home",
    currentProfileId: "clement",
    weather: {
      id: "fake",
      getForecast: async (lat, lng) => ({ lat, lng, fetchedAt: 0, hourly: [], daily: [{ date: d(2026, 10, 1), tMin: 9, tMax: 16, precipitationProbability: 70, precipitation: 3, windMax: 15, weatherCode: 61 }] }),
      getAt: async () => ({ time: d(2026, 10, 1, 16), temperature: 14, precipitationProbability: 70, precipitation: 1, windSpeed: 12, weatherCode: 61, isDay: true }),
    },
    geocoding: { id: "fake", search: async (q) => [{ label: q, address: q, lat: 46.5, lng: 6.6 }] },
    routing: { id: "fake", route: async (_a, _b, mode) => ({ durationMin: 18, distanceKm: 9, mode, source: "osrm" }) },
    createReminder: async (r) => ({ ...r, id: "r1", createdAt: "" }),
    deleteReminder: async () => {},
  });
  const llm = new OllamaProvider({ baseUrl: "http://localhost:11434", model, mode: "direct" });
  const systemPrompt = buildSystemPrompt({ now, householdName: "Maison", profiles, places, speaker: profiles[0], timezone: "Europe/Zurich" });
  return { cal, executor, llm, systemPrompt };
}

async function ask(input: string) {
  const s = setup();
  const t0 = Date.now();
  const stats: string[] = [];
  const llm: LLMProvider = {
    id: "ollama",
    model,
    health: () => s.llm.health(),
    chat: async (req) => {
      const r = await s.llm.chat(req);
      stats.push(`${r.stats?.promptTokens}→${r.stats?.outputTokens} tok/${r.stats?.durationMs}ms`);
      return r;
    },
  };
  const r = await handleUtterance({
    input,
    history: [],
    systemPrompt: s.systemPrompt,
    llm,
    executor: s.executor,
    now,
    profiles,
    places,
    currentProfileId: "clement",
  });
  console.log(
    `\n▶ ${input}\n  ${Date.now() - t0} ms${r.fast ? " (fast path)" : ""} [${stats.join(", ")}] | tools: ${r.actions.map((a) => `${a.name}(${JSON.stringify(a.args)}) → ${a.result.ok ? "ok" : a.result.summary}`).join(" ; ")}\n  « ${r.text} »`,
  );
  return { ...r, cal: s.cal };
}

describe.skipIf(!enabled)(`Ollama ${model} – real tool calling`, { timeout: 300_000 }, () => {
  it("creates: Dentiste jeudi 16h → existing at 16h, so new event 'Coiffeur vendredi 10h'", async () => {
    const r = await ask("Ajoute coiffeur vendredi à 10h");
    const e = r.cal.events.find((x) => /coiffeur/i.test(x.title));
    expect(e).toBeDefined();
    expect(new Date(e!.start)).toEqual(d(2026, 10, 2, 10));
  });

  it("creates for the couple", async () => {
    const r = await ask("Restaurant vendredi à 20h pour nous deux");
    const e = r.cal.events.find((x) => /restaurant/i.test(x.title));
    expect(e?.profileIds).toEqual(["couple"]);
    expect(new Date(e!.start)).toEqual(d(2026, 10, 2, 20));
  });

  it("moves an existing event", async () => {
    const r = await ask("Déplace le dentiste à vendredi 9h");
    const e = r.cal.events.find((x) => x.id === "dent")!;
    expect(new Date(e.start)).toEqual(d(2026, 10, 2, 9));
  });

  it("reads the agenda", async () => {
    const r = await ask("Qu'est-ce que j'ai demain ?");
    expect(r.actions.some((a) => a.name === "getEvents" || a.name === "searchEvents")).toBe(true);
    expect(r.text.toLowerCase()).toContain("dentiste");
  });

  it("finds availability", async () => {
    const r = await ask("Quand sommes-nous libres tous les deux samedi après-midi pour 2 heures ?");
    expect(r.actions.some((a) => a.name === "findAvailability")).toBe(true);
  });

  it("weather", async () => {
    const r = await ask("Est-ce qu'il va pleuvoir demain ?");
    expect(r.actions.some((a) => a.name === "getWeather")).toBe(true);
  });

  it("route & departure", async () => {
    const r = await ask("À quelle heure dois-je partir pour le dentiste ?");
    expect(r.actions.some((a) => a.name === "calculateRoute" || a.name === "searchEvents")).toBe(true);
  });

  it("deletes", async () => {
    const r = await ask("Supprime le rendez-vous chez le dentiste");
    expect(r.cal.events.find((x) => x.id === "dent")).toBeUndefined();
  });
});
