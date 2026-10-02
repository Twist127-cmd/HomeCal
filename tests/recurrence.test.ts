import { describe, expect, it } from "vitest";
import { describeRecurrence, expandEvent } from "@/lib/recurrence";
import { d, ev } from "./fixtures";

describe("expandEvent", () => {
  it("returns a single occurrence for a non-recurring event in range", () => {
    const e = ev({ start: d(2026, 10, 1, 10).toISOString(), end: d(2026, 10, 1, 11).toISOString() });
    expect(expandEvent(e, d(2026, 10, 1), d(2026, 10, 2))).toHaveLength(1);
    expect(expandEvent(e, d(2026, 10, 2), d(2026, 10, 3))).toHaveLength(0);
  });

  it("includes events that started before the range but end inside", () => {
    const e = ev({ start: d(2026, 9, 30, 22).toISOString(), end: d(2026, 10, 1, 2).toISOString() });
    expect(expandEvent(e, d(2026, 10, 1), d(2026, 10, 2))).toHaveLength(1);
  });

  it("expands weekly on several weekdays", () => {
    const e = ev({
      start: d(2026, 10, 5, 18, 30).toISOString(), // Monday
      end: d(2026, 10, 5, 19, 30).toISOString(),
      recurrence: { freq: "WEEKLY", interval: 1, byWeekday: [1, 3] },
    });
    const occ = expandEvent(e, d(2026, 10, 5), d(2026, 10, 19));
    expect(occ.map((o) => o.start)).toEqual([
      d(2026, 10, 5, 18, 30),
      d(2026, 10, 7, 18, 30),
      d(2026, 10, 12, 18, 30),
      d(2026, 10, 14, 18, 30),
    ]);
  });

  it("keeps wall-clock time across DST (25 Oct 2026)", () => {
    const e = ev({
      start: d(2026, 10, 20, 18, 30).toISOString(),
      end: d(2026, 10, 20, 19, 30).toISOString(),
      recurrence: { freq: "WEEKLY", interval: 1 },
    });
    const occ = expandEvent(e, d(2026, 10, 26), d(2026, 11, 2));
    expect(occ).toHaveLength(1);
    expect(occ[0].start.getHours()).toBe(18);
    expect(occ[0].start.getMinutes()).toBe(30);
  });

  it("respects interval, count and exdates", () => {
    const start = d(2026, 10, 1, 9);
    const e = ev({
      start: start.toISOString(),
      end: d(2026, 10, 1, 10).toISOString(),
      recurrence: { freq: "DAILY", interval: 2, count: 4, exdates: [d(2026, 10, 3, 9).toISOString()] },
    });
    const occ = expandEvent(e, d(2026, 9, 1), d(2026, 12, 1));
    expect(occ.map((o) => o.start.getDate())).toEqual([1, 5, 7]);
  });

  it("respects until", () => {
    const e = ev({
      start: d(2026, 10, 1, 9).toISOString(),
      end: d(2026, 10, 1, 10).toISOString(),
      recurrence: { freq: "DAILY", interval: 1, until: d(2026, 10, 3, 23).toISOString() },
    });
    expect(expandEvent(e, d(2026, 9, 1), d(2026, 12, 1))).toHaveLength(3);
  });

  it("monthly skips months without that day", () => {
    const e = ev({
      start: d(2026, 1, 31, 9).toISOString(),
      end: d(2026, 1, 31, 10).toISOString(),
      recurrence: { freq: "MONTHLY", interval: 1 },
    });
    const occ = expandEvent(e, d(2026, 1, 1), d(2026, 6, 1));
    expect(occ.map((o) => o.start.getMonth() + 1)).toEqual([1, 3, 5]);
  });

  it("yearly birthdays", () => {
    const e = ev({
      start: d(2020, 10, 12).toISOString(),
      end: d(2020, 10, 13).toISOString(),
      allDay: true,
      recurrence: { freq: "YEARLY", interval: 1 },
    });
    const occ = expandEvent(e, d(2026, 10, 1), d(2026, 11, 1));
    expect(occ).toHaveLength(1);
    expect(occ[0].start).toEqual(d(2026, 10, 12));
  });
});

describe("describeRecurrence", () => {
  it("describes weekly rules in French", () => {
    expect(describeRecurrence({ freq: "WEEKLY", interval: 1, byWeekday: [2, 4] })).toBe("Chaque semaine le mardi, jeudi");
    expect(describeRecurrence(undefined)).toBe("Ne se répète pas");
  });
});
