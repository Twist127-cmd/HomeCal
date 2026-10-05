import { beforeEach, describe, expect, it } from "vitest";
import { handleUtterance, isQuestion, runAgent } from "@/assistant/agent";
import { parseDateArg, ToolExecutor, type ToolContext } from "@/assistant/executor";
import { DEFAULT_SETTINGS, type Reminder } from "@/lib/types";
import { MemoryCalendarProvider } from "@/providers/calendar/MemoryCalendarProvider";
import type { ChatRequest, ChatResponse, LLMProvider } from "@/providers/llm";
import type { WeatherProvider } from "@/providers/weather/WeatherProvider";
import { d, ev, places, profiles } from "./fixtures";

const now = d(2026, 9, 30, 10, 0); // Wednesday

const weather: WeatherProvider = {
  id: "fake",
  async getForecast(lat, lng) {
    return {
      lat,
      lng,
      fetchedAt: Date.now(),
      hourly: [{ time: d(2026, 10, 1, 16), temperature: 14, precipitationProbability: 80, precipitation: 2, windSpeed: 10, weatherCode: 61, isDay: true }],
      daily: [{ date: d(2026, 10, 1), tMin: 8, tMax: 15, precipitationProbability: 80, precipitation: 4, windMax: 20, weatherCode: 61 }],
    };
  },
  async getAt() {
    return { time: d(2026, 10, 1, 16), temperature: 14, precipitationProbability: 80, precipitation: 2, windSpeed: 10, weatherCode: 61, isDay: true };
  },
};

function context(cal: MemoryCalendarProvider, reminders: Reminder[] = []): ToolContext {
  return {
    now: () => now,
    calendar: cal,
    events: () => cal.events,
    profiles,
    places,
    settings: DEFAULT_SETTINGS,
    homePlaceId: "home",
    currentProfileId: "clement",
    weather,
    geocoding: { id: "fake", search: async (q) => [{ label: q, address: `${q}, Suisse`, lat: 46.6, lng: 6.7 }] },
    routing: { id: "fake", route: async (_f, _t, mode) => ({ durationMin: 20, distanceKm: 12, mode, source: "osrm" }) },
    createReminder: async (r) => {
      const full = { ...r, id: `r${reminders.length + 1}`, createdAt: now.toISOString() };
      reminders.push(full);
      return full;
    },
    deleteReminder: async (id) => {
      const i = reminders.findIndex((r) => r.id === id);
      if (i >= 0) reminders.splice(i, 1);
    },
  };
}

describe("parseDateArg", () => {
  it("parses local ISO without timezone as local time", () => {
    expect(parseDateArg("2026-10-01T16:00").date).toEqual(d(2026, 10, 1, 16));
    expect(parseDateArg("2026-10-01 16:00").date).toEqual(d(2026, 10, 1, 16));
    expect(parseDateArg("2026-10-01")).toEqual({ date: d(2026, 10, 1), dateOnly: true });
  });
  it("rejects garbage", () => {
    expect(() => parseDateArg("jeudi prochain")).toThrow();
  });
});

describe("ToolExecutor", () => {
  let cal: MemoryCalendarProvider;
  let ex: ToolExecutor;
  let reminders: Reminder[];

  beforeEach(() => {
    reminders = [];
    cal = new MemoryCalendarProvider([
      ev({ id: "dent", title: "Dentiste", start: d(2026, 10, 1, 16).toISOString(), end: d(2026, 10, 1, 17).toISOString() }),
      ev({
        id: "yoga",
        title: "Yoga",
        start: d(2026, 10, 6, 19).toISOString(),
        end: d(2026, 10, 6, 20).toISOString(),
        profileIds: ["compagne"],
        recurrence: { freq: "WEEKLY", interval: 1, byWeekday: [2] },
      }),
    ]);
    ex = new ToolExecutor(context(cal, reminders));
  });

  it("createEvent with couple, favourite place and default reminder", async () => {
    const r = await ex.run("createEvent", { title: "Restaurant", start: "2026-10-02T20:00", durationMinutes: 120, profiles: ["nous deux"], location: "CrossFit" });
    expect(r.ok).toBe(true);
    const created = cal.events.find((e) => e.title === "Restaurant")!;
    expect(created.profileIds).toEqual(["couple"]);
    expect(created.location?.placeId).toBe("crossfit");
    expect(new Date(created.end)).toEqual(d(2026, 10, 2, 22));
    expect(created.source).toBe("assistant");
    // undo
    await r.undo!();
    expect(cal.events.find((e) => e.title === "Restaurant")).toBeUndefined();
  });

  it("createEvent geocodes unknown locations", async () => {
    await ex.run("createEvent", { title: "Expo", start: "2026-10-03T14:00", location: "Musée Olympique" });
    expect(cal.events.find((e) => e.title === "Expo")?.location).toMatchObject({ label: "Musée Olympique", lat: 46.6 });
  });

  it("createEvent with date only → all-day; weekly recurrence with French weekdays", async () => {
    await ex.run("createEvent", { title: "Anniversaire", start: "2026-10-03" });
    const a = cal.events.find((e) => e.title === "Anniversaire")!;
    expect(a.allDay).toBe(true);
    await ex.run("createEvent", { title: "Piscine", start: "2026-10-05T07:00", recurrence: { freq: "WEEKLY", weekdays: ["lundi", "jeudi"] } });
    expect(cal.events.find((e) => e.title === "Piscine")?.recurrence?.byWeekday).toEqual([1, 4]);
  });

  it("rejects unknown profiles with the list of valid names", async () => {
    const r = await ex.run("createEvent", { title: "X", start: "2026-10-02T10:00", profiles: ["Batman"] });
    expect(r.ok).toBe(false);
    expect(String((r.data as { error: string }).error)).toContain("Clément");
  });

  it("getEvents expands recurrences and filters by profile", async () => {
    const r = await ex.run("getEvents", { from: "2026-10-01", to: "2026-10-14", profiles: ["Compagne"] });
    const data = r.data as { events: { id: string; occurrenceStart?: string }[] };
    expect(data.events.map((e) => e.id)).toEqual(["yoga", "yoga"]);
    expect(data.events[0].occurrenceStart).toBe("2026-10-06T19:00");
  });

  it("searchEvents finds by title", async () => {
    const r = await ex.run("searchEvents", { query: "dentiste" });
    expect((r.data as { events: { id: string }[] }).events[0].id).toBe("dent");
  });

  it("moveEvent keeps duration; undo restores", async () => {
    const r = await ex.run("moveEvent", { eventId: "dent", newStart: "2026-10-02T09:30" });
    expect(r.ok).toBe(true);
    const moved = cal.events.find((e) => e.id === "dent")!;
    expect(new Date(moved.start)).toEqual(d(2026, 10, 2, 9, 30));
    expect(new Date(moved.end)).toEqual(d(2026, 10, 2, 10, 30));
    await r.undo!();
    expect(new Date(cal.events.find((e) => e.id === "dent")!.start)).toEqual(d(2026, 10, 1, 16));
  });

  it("moveEvent resolves an event by title when the model passes a name", async () => {
    const r = await ex.run("moveEvent", { eventId: "Dentiste", newStart: "2026-10-02T09:30" });
    expect(r.ok).toBe(true);
  });

  it("moving one occurrence of a recurring event splits it", async () => {
    const r = await ex.run("moveEvent", { eventId: "yoga", occurrenceStart: "2026-10-13T19:00", newStart: "2026-10-14T19:00" });
    expect(r.ok).toBe(true);
    const series = cal.events.find((e) => e.id === "yoga")!;
    expect(series.recurrence?.exdates).toEqual([d(2026, 10, 13, 19).toISOString()]);
    expect(cal.events.filter((e) => e.title === "Yoga")).toHaveLength(2);
  });

  it("deleteEvent on a recurring event removes only the next occurrence by default", async () => {
    await ex.run("deleteEvent", { eventId: "yoga" });
    expect(cal.events.find((e) => e.id === "yoga")?.recurrence?.exdates).toHaveLength(1);
    await ex.run("deleteEvent", { eventId: "yoga", allOccurrences: true });
    expect(cal.events.find((e) => e.id === "yoga")).toBeUndefined();
  });

  it("deleteEvent + undo", async () => {
    const r = await ex.run("deleteEvent", { eventId: "dent" });
    expect(cal.events.find((e) => e.id === "dent")).toBeUndefined();
    await r.undo!();
    expect(cal.events.find((e) => e.id === "dent")).toBeDefined();
  });

  it("findAvailability for the couple avoids busy times", async () => {
    const r = await ex.run("findAvailability", { profiles: ["Couple"], from: "2026-10-01T15:00", to: "2026-10-01T19:00", durationMinutes: 60 });
    const slots = (r.data as { slots: { start: string; end: string }[] }).slots;
    expect(slots).toEqual([
      { start: "2026-10-01T15:00", end: "2026-10-01T16:00", weekday: "jeudi" },
      { start: "2026-10-01T17:00", end: "2026-10-01T19:00", weekday: "jeudi" },
    ]);
  });

  it("calculateRoute gives the recommended departure", async () => {
    const r = await ex.run("calculateRoute", { to: "Gare", arriveBy: "2026-10-01T16:00" });
    expect(r.data).toMatchObject({ durationMinutes: 20, departAt: "2026-10-01T15:30", from: "Maison", to: "Gare" });
  });

  it("getWeather for an event", async () => {
    const r = await ex.run("getWeather", { date: "2026-10-01T16:00" });
    expect(r.data).toMatchObject({ temperature: 14, conditions: "Pluie", precipitationProbability: 80 });
  });

  it("createReminder + undo", async () => {
    const r = await ex.run("createReminder", { text: "Sortir les poubelles", at: "2026-10-01T19:00" });
    expect(reminders).toHaveLength(1);
    await r.undo!();
    expect(reminders).toHaveLength(0);
  });

  it("unknown tool", async () => {
    expect((await ex.run("hack", {})).ok).toBe(false);
  });
});

describe("handleUtterance – fast paths", () => {
  function setup() {
    const cal = new MemoryCalendarProvider();
    const ctx = context(cal);
    const calls: { location?: unknown }[] = [];
    ctx.weather = {
      ...weather,
      getForecast: async (lat, lng) => {
        calls.push({ location: `${lat},${lng}` });
        return weather.getForecast(lat, lng);
      },
    };
    const base = {
      history: [],
      systemPrompt: "sys",
      llm: null,
      executor: new ToolExecutor(ctx),
      now,
      profiles,
      places,
      currentProfileId: "clement",
    };
    return { cal, base, calls };
  }

  it("weather for another city uses that city, not home", async () => {
    const { base, calls } = setup();
    const r = await handleUtterance({ ...base, input: "Quel temps fera-t-il à Genève demain ?" });
    expect(r.fast).toBe(true);
    expect(r.actions[0].args).toMatchObject({ location: "Genève", date: "2026-10-01" });
    expect(calls[0].location).toBe("46.6,6.7"); // fake geocoder result, not home (46.5197,6.6323)
    expect(r.text).toContain("Genève");
  });

  it("weather without place = home", async () => {
    const { base } = setup();
    const r = await handleUtterance({ ...base, input: "Est-ce qu'il va pleuvoir demain ?" });
    expect(r.actions[0].args.location).toBeUndefined();
    expect(r.text).toContain("Maison");
  });

  it("asks for the time when missing, then creates the event with the answer", async () => {
    const { cal, base } = setup();
    const q = await handleUtterance({ ...base, input: "Ajoute dentiste jeudi" });
    expect(isQuestion(q.text)).toBe(true);
    expect(q.pending?.kind).toBe("time");
    expect(cal.events).toHaveLength(0);

    const r = await handleUtterance({ ...base, input: "à 16h30", pending: q.pending });
    expect(r.changed).toBe(true);
    expect(new Date(cal.events[0].start)).toEqual(d(2026, 10, 1, 16, 30));
    expect(cal.events[0].title).toBe("Dentiste");
  });

  it("answer 'toute la journée' creates an all-day event; 'non' cancels", async () => {
    const { cal, base } = setup();
    const q = await handleUtterance({ ...base, input: "Ajoute anniversaire maman samedi" });
    await handleUtterance({ ...base, input: "toute la journée", pending: q.pending });
    expect(cal.events[0].allDay).toBe(true);

    const q2 = await handleUtterance({ ...base, input: "Ajoute coiffeur vendredi" });
    const r = await handleUtterance({ ...base, input: "non laisse tomber", pending: q2.pending });
    expect(r.changed).toBe(false);
    expect(cal.events).toHaveLength(1);
  });

  it("explicit all-day request does not ask", async () => {
    const { cal, base } = setup();
    const r = await handleUtterance({ ...base, input: "Ajoute vacances samedi toute la journée" });
    expect(r.changed).toBe(true);
    expect(cal.events[0].allDay).toBe(true);
  });
});

describe("runAgent", () => {
  it("runs the tool loop with a scripted LLM", async () => {
    const cal = new MemoryCalendarProvider();
    const ex = new ToolExecutor(context(cal));
    const script: ChatResponse[] = [
      { content: "", toolCalls: [{ name: "createEvent", arguments: { title: "Dentiste", start: "2026-10-01T16:00" } }] },
      { content: "C'est noté : dentiste jeudi à 16 heures.", toolCalls: [] },
    ];
    const seen: ChatRequest[] = [];
    const llm: LLMProvider = {
      id: "ollama",
      model: "fake",
      health: async () => ({ ok: true }),
      chat: async (req) => {
        seen.push(structuredClone({ messages: req.messages }));
        return script.shift()!;
      },
    };
    const r = await runAgent({ input: "Dentiste jeudi 16h", history: [], systemPrompt: "sys", llm, executor: ex });
    expect(r.text).toBe("C'est noté : dentiste jeudi à 16 heures.");
    expect(r.changed).toBe(true);
    expect(cal.events).toHaveLength(1);
    // the tool result was sent back to the model
    const last = seen[1].messages.at(-1)!;
    expect(last.role).toBe("tool");
  });

  it("does not apply the same modification twice", async () => {
    const cal = new MemoryCalendarProvider();
    const ex = new ToolExecutor(context(cal));
    const call = { name: "createEvent", arguments: { title: "Dentiste", start: "2026-10-01T16:00" } };
    const script: ChatResponse[] = [
      { content: "", toolCalls: [call] },
      { content: "", toolCalls: [call] },
      { content: "Fait.", toolCalls: [] },
    ];
    const llm: LLMProvider = { id: "ollama", model: "fake", health: async () => ({ ok: true }), chat: async () => script.shift()! };
    await runAgent({ input: "x", history: [], systemPrompt: "sys", llm, executor: ex });
    expect(cal.events).toHaveLength(1);
  });
});
