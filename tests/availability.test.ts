import { describe, expect, it } from "vitest";
import { findAvailability, mergeSlots } from "@/lib/availability";
import { departureTime, pickOrigin } from "@/lib/departure";
import { estimateTravel, haversineKm } from "@/lib/geo";
import { d, ev, occ, places, profiles } from "./fixtures";

describe("findAvailability", () => {
  const busy = [
    occ(ev({ start: d(2026, 10, 1, 9).toISOString(), end: d(2026, 10, 1, 12).toISOString(), profileIds: ["clement"] })),
    occ(ev({ start: d(2026, 10, 1, 14).toISOString(), end: d(2026, 10, 1, 18).toISOString(), profileIds: ["compagne"] })),
  ];

  it("finds common free slots for a couple", () => {
    const slots = findAvailability({
      occurrences: busy,
      profiles,
      profileIds: ["couple"],
      from: d(2026, 10, 1),
      to: d(2026, 10, 2),
      durationMin: 60,
      dayStartHour: 8,
      dayEndHour: 22,
    });
    expect(slots).toEqual([
      { start: d(2026, 10, 1, 8), end: d(2026, 10, 1, 9) },
      { start: d(2026, 10, 1, 12), end: d(2026, 10, 1, 14) },
      { start: d(2026, 10, 1, 18), end: d(2026, 10, 1, 22) },
    ]);
  });

  it("only considers the requested person", () => {
    const slots = findAvailability({
      occurrences: busy,
      profiles,
      profileIds: ["compagne"],
      from: d(2026, 10, 1),
      to: d(2026, 10, 2),
      durationMin: 120,
      dayStartHour: 8,
      dayEndHour: 22,
    });
    expect(slots).toEqual([
      { start: d(2026, 10, 1, 8), end: d(2026, 10, 1, 14) },
      { start: d(2026, 10, 1, 18), end: d(2026, 10, 1, 22) },
    ]);
  });

  it("respects the minimum duration and from-time", () => {
    const slots = findAvailability({
      occurrences: busy,
      profiles,
      profileIds: ["couple"],
      from: d(2026, 10, 1, 13),
      to: d(2026, 10, 2),
      durationMin: 180,
      dayStartHour: 8,
      dayEndHour: 22,
    });
    expect(slots).toEqual([{ start: d(2026, 10, 1, 18), end: d(2026, 10, 1, 22) }]);
  });

  it("spans multiple days and limits results", () => {
    const slots = findAvailability({
      occurrences: [],
      profiles,
      profileIds: ["maison"],
      from: d(2026, 10, 1),
      to: d(2026, 10, 8),
      durationMin: 60,
      maxResults: 3,
    });
    expect(slots).toHaveLength(3);
    expect(slots[2].start).toEqual(d(2026, 10, 3, 8));
  });

  it("merges overlapping busy slots", () => {
    const m = mergeSlots([
      { start: d(2026, 1, 1, 9), end: d(2026, 1, 1, 11) },
      { start: d(2026, 1, 1, 10), end: d(2026, 1, 1, 12) },
      { start: d(2026, 1, 1, 13), end: d(2026, 1, 1, 14) },
    ]);
    expect(m).toHaveLength(2);
    expect(m[0].end).toEqual(d(2026, 1, 1, 12));
  });
});

describe("departure & travel", () => {
  it("départ = début − trajet − marge", () => {
    expect(departureTime(d(2026, 10, 1, 16), 25, 10)).toEqual(d(2026, 10, 1, 15, 25));
  });

  it("haversine Lausanne → Genève ≈ 51 km", () => {
    const km = haversineKm(places[0], places[3]);
    expect(km).toBeGreaterThan(48);
    expect(km).toBeLessThan(55);
  });

  it("estimates driving faster than walking", () => {
    const car = estimateTravel(places[0], places[3], "driving");
    const walk = estimateTravel(places[0], places[3], "walking");
    expect(car.durationMin).toBeLessThan(walk.durationMin);
  });

  it("origin is the previous event location when close in time, else home", () => {
    const loc = (id: string) => {
      const p = places.find((x) => x.id === id)!;
      return { label: p.name, lat: p.lat, lng: p.lng, placeId: p.id };
    };
    const first = occ(ev({ start: d(2026, 10, 1, 9).toISOString(), end: d(2026, 10, 1, 10).toISOString(), location: loc("crossfit") }));
    const target = occ(ev({ start: d(2026, 10, 1, 11).toISOString(), end: d(2026, 10, 1, 12).toISOString(), location: loc("gare") }));
    expect(pickOrigin(target, [first, target], places, "home")?.placeId).toBe("crossfit");

    const late = occ(ev({ start: d(2026, 10, 1, 18).toISOString(), end: d(2026, 10, 1, 19).toISOString(), location: loc("gare") }));
    expect(pickOrigin(late, [first, late], places, "home")?.placeId).toBe("home");
  });
});
