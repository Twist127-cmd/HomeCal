import { describe, expect, it } from "vitest";
import { detectConflicts } from "@/lib/conflicts";
import { d, ev, occ, places, profiles } from "./fixtures";

const loc = (id: string) => {
  const p = places.find((x) => x.id === id)!;
  return { label: p.name, lat: p.lat, lng: p.lng, placeId: p.id };
};

describe("detectConflicts", () => {
  it("detects overlaps for the same person", () => {
    const a = ev({ start: d(2026, 10, 1, 10).toISOString(), end: d(2026, 10, 1, 11).toISOString() });
    const b = ev({ start: d(2026, 10, 1, 10, 30).toISOString(), end: d(2026, 10, 1, 12).toISOString() });
    const c = detectConflicts([occ(a), occ(b)], profiles);
    expect(c).toHaveLength(1);
    expect(c[0].kind).toBe("overlap");
  });

  it("ignores overlaps between different persons", () => {
    const a = ev({ start: d(2026, 10, 1, 10).toISOString(), end: d(2026, 10, 1, 11).toISOString(), profileIds: ["clement"] });
    const b = ev({ start: d(2026, 10, 1, 10).toISOString(), end: d(2026, 10, 1, 11).toISOString(), profileIds: ["compagne"] });
    expect(detectConflicts([occ(a), occ(b)], profiles)).toHaveLength(0);
  });

  it("couple events conflict with each member", () => {
    const a = ev({ start: d(2026, 10, 1, 19).toISOString(), end: d(2026, 10, 1, 21).toISOString(), profileIds: ["couple"] });
    const b = ev({ start: d(2026, 10, 1, 20).toISOString(), end: d(2026, 10, 1, 21).toISOString(), profileIds: ["compagne"] });
    const c = detectConflicts([occ(a), occ(b)], profiles);
    expect(c).toHaveLength(1);
    expect(c[0].personIds).toEqual(["compagne"]);
  });

  it("household events concern everybody", () => {
    const a = ev({ start: d(2026, 10, 1, 19).toISOString(), end: d(2026, 10, 1, 21).toISOString(), profileIds: ["maison"] });
    const b = ev({ start: d(2026, 10, 1, 20).toISOString(), end: d(2026, 10, 1, 21).toISOString(), profileIds: ["clement"] });
    expect(detectConflicts([occ(a), occ(b)], profiles)).toHaveLength(1);
  });

  it("detects insufficient travel time (Lausanne → Genève in 15 min)", () => {
    const a = ev({ start: d(2026, 10, 1, 9).toISOString(), end: d(2026, 10, 1, 10).toISOString(), location: loc("crossfit") });
    const b = ev({ start: d(2026, 10, 1, 10, 15).toISOString(), end: d(2026, 10, 1, 11).toISOString(), location: loc("parents") });
    const c = detectConflicts([occ(a), occ(b)], profiles, { marginMin: 5 });
    expect(c).toHaveLength(1);
    expect(c[0].kind).toBe("travel");
    expect(c[0].missingMin).toBeGreaterThan(30);
  });

  it("enough travel time → no conflict", () => {
    const a = ev({ start: d(2026, 10, 1, 9).toISOString(), end: d(2026, 10, 1, 10).toISOString(), location: loc("crossfit") });
    const b = ev({ start: d(2026, 10, 1, 10, 30).toISOString(), end: d(2026, 10, 1, 11).toISOString(), location: loc("gare") });
    expect(detectConflicts([occ(a), occ(b)], profiles, { marginMin: 5 })).toHaveLength(0);
  });

  it("uses known travel durations when provided", () => {
    const a = ev({ start: d(2026, 10, 1, 9).toISOString(), end: d(2026, 10, 1, 10).toISOString(), location: loc("crossfit") });
    const b = ev({ start: d(2026, 10, 1, 10, 30).toISOString(), end: d(2026, 10, 1, 11).toISOString(), location: loc("gare") });
    const c = detectConflicts([occ(a), occ(b)], profiles, { travelMin: () => 45 });
    expect(c).toHaveLength(1);
  });

  it("ignores all-day events", () => {
    const a = ev({ start: d(2026, 10, 1).toISOString(), end: d(2026, 10, 2).toISOString(), allDay: true });
    const b = ev({ start: d(2026, 10, 1, 10).toISOString(), end: d(2026, 10, 1, 11).toISOString() });
    expect(detectConflicts([occ(a), occ(b)], profiles)).toHaveLength(0);
  });
});
