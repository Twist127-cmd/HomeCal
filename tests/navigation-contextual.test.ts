import { describe, expect, it } from "vitest";
import { getContextualActions, type ActionContext } from "@/lib/contextual";
import { availableNavApps, departureStatus, navigationUrl } from "@/lib/navigation";
import { d, ev, occ } from "./fixtures";

describe("navigation deep links", () => {
  const dest = { label: "CrossFit", address: "Av. de Sévelin 20, Lausanne", lat: 46.5225, lng: 6.6165 };
  it("uses coordinates when available", () => {
    expect(navigationUrl(dest, "waze")).toBe("https://waze.com/ul?ll=46.5225,6.6165&navigate=yes");
    expect(navigationUrl(dest, "google")).toBe("https://www.google.com/maps/dir/?api=1&destination=46.5225,6.6165&travelmode=driving");
    expect(navigationUrl(dest, "apple", "walking")).toBe("https://maps.apple.com/?daddr=46.5225,6.6165&dirflg=w");
  });
  it("falls back to the address", () => {
    const noLL = { label: "Gare", address: "Place de la Gare, Lausanne" };
    expect(navigationUrl(noLL, "waze")).toBe("https://waze.com/ul?q=Place%20de%20la%20Gare%2C%20Lausanne&navigate=yes");
    expect(navigationUrl(noLL, "google", "cycling")).toContain("destination=Place%20de%20la%20Gare%2C%20Lausanne&travelmode=bicycling");
  });
  it("hides Apple Plans on non-Apple devices", () => {
    expect(availableNavApps("Mozilla/5.0 (Windows NT 10.0)").map((a) => a.id)).toEqual(["waze", "google"]);
    expect(availableNavApps("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)").map((a) => a.id)).toContain("apple");
  });
});

describe("departureStatus", () => {
  const now = d(2026, 10, 8, 17, 0);
  it.each([
    [24, "green", "🟢 Départ conseillé dans 24 min"],
    [5, "orange", "🟠 Pars dans 5 min"],
    [0, "red", "🔴 Il est temps de partir"],
    [-7, "late", "⚠️ Tu devrais déjà être parti depuis 7 min"],
  ])("%i min → %s", (mins, level, text) => {
    const s = departureStatus(new Date(now.getTime() + Number(mins) * 60000), now);
    expect(s.level).toBe(level);
    expect(`${s.emoji} ${s.text}`).toBe(text);
  });
});

describe("getContextualActions", () => {
  const base: ActionContext = {
    now: d(2026, 10, 8, 7, 15),
    todayCount: 2,
    selectedPersons: 0,
    musicEnabled: true,
    musicPlaying: false,
    timersRunning: 0,
    timersEnabled: true,
    shoppingCount: 3,
    shoppingEnabled: true,
  };
  const work = occ(ev({ title: "Travail", start: d(2026, 10, 8, 8, 30).toISOString(), end: d(2026, 10, 8, 12).toISOString(), location: { label: "Bureau", lat: 46.5, lng: 6.6 } }));

  it("morning: my day, departure, music", () => {
    const a = getContextualActions({ ...base, next: work, nextDepartAt: d(2026, 10, 8, 7, 52) });
    expect(a.map((x) => x.id)).toEqual(["route", "myDay", "music", "remindMe"]);
    expect(a.length).toBeLessThanOrEqual(4);
  });

  it("several profiles selected: find a slot / common event first", () => {
    const a = getContextualActions({ ...base, now: d(2026, 10, 8, 15, 0), selectedPersons: 2 });
    expect(a.slice(0, 2).map((x) => x.id)).toEqual(["findSlot", "commonEvent"]);
  });

  it("dinner time: timer and shopping", () => {
    const a = getContextualActions({ ...base, now: d(2026, 10, 8, 18, 30) });
    expect(a.map((x) => x.id)).toEqual(expect.arrayContaining(["timer", "shopping"]));
  });

  it("evening: tomorrow and relax", () => {
    const a = getContextualActions({ ...base, now: d(2026, 10, 8, 21, 30) });
    expect(a.slice(0, 2).map((x) => x.id)).toEqual(["tomorrow", "relax"]);
  });

  it("running timers are always surfaced", () => {
    const a = getContextualActions({ ...base, now: d(2026, 10, 8, 15, 0), timersRunning: 2 });
    expect(a[0]).toMatchObject({ id: "timer", label: "Minuteurs (2)" });
  });

  it("always returns at least 2 actions", () => {
    const a = getContextualActions({ ...base, now: d(2026, 10, 8, 15, 0), musicEnabled: false, shoppingEnabled: false, timersEnabled: false });
    expect(a.length).toBeGreaterThanOrEqual(2);
  });
});
