import { describe, expect, it } from "vitest";
import { parseQuickAdd } from "@/lib/quickadd";
import { d, places, profiles } from "./fixtures";

// Wednesday 30 September 2026, 10:00
const now = d(2026, 9, 30, 10, 0);
const opts = { now, profiles, places, currentProfileId: "clement" };

describe("parseQuickAdd", () => {
  it("Dentiste jeudi 16h", () => {
    const r = parseQuickAdd("Dentiste jeudi 16h", opts);
    expect(r.title).toBe("Dentiste");
    expect(r.start).toEqual(d(2026, 10, 1, 16, 0));
    expect(r.end).toEqual(d(2026, 10, 1, 17, 0));
    expect(r.allDay).toBe(false);
    expect(r.type).toBe("appointment");
    expect(r.profileIds).toEqual(["clement"]);
  });

  it("CrossFit mardi 18h30 keeps the title and attaches the favourite place", () => {
    const r = parseQuickAdd("CrossFit mardi 18h30", opts);
    expect(r.title).toBe("CrossFit");
    expect(r.start).toEqual(d(2026, 10, 6, 18, 30));
    expect(r.type).toBe("sport");
    expect(r.location?.placeId).toBe("crossfit");
  });

  it("Restaurant vendredi à 20h pour nous deux", () => {
    const r = parseQuickAdd("Restaurant vendredi à 20h pour nous deux", opts);
    expect(r.title).toBe("Restaurant");
    expect(r.start).toEqual(d(2026, 10, 2, 20, 0));
    expect(r.end).toEqual(d(2026, 10, 2, 22, 0));
    expect(r.profileIds).toEqual(["couple"]);
    expect(r.type).toBe("social");
  });

  it("time range: Réunion demain de 14h à 15h30", () => {
    const r = parseQuickAdd("Réunion demain de 14h à 15h30", opts);
    expect(r.title).toBe("Réunion");
    expect(r.start).toEqual(d(2026, 10, 1, 14, 0));
    expect(r.end).toEqual(d(2026, 10, 1, 15, 30));
  });

  it("no time → all-day event", () => {
    const r = parseQuickAdd("Anniversaire maman samedi", opts);
    expect(r.title).toBe("Anniversaire maman");
    expect(r.allDay).toBe(true);
    expect(r.start).toEqual(d(2026, 10, 3));
    expect(r.end).toEqual(d(2026, 10, 4));
  });

  it("weekly recurrence: Yoga tous les mardis 19h", () => {
    const r = parseQuickAdd("Yoga tous les mardis 19h", opts);
    expect(r.title).toBe("Yoga");
    expect(r.recurrence).toEqual({ freq: "WEEKLY", interval: 1, byWeekday: [2] });
    expect(r.start).toEqual(d(2026, 10, 6, 19, 0));
  });

  it("explicit date and person: Coiffeur le 12 octobre à 9h30 pour Compagne", () => {
    const r = parseQuickAdd("Coiffeur le 12 octobre à 9h30 pour Compagne", opts);
    expect(r.title).toBe("Coiffeur");
    expect(r.start).toEqual(d(2026, 10, 12, 9, 30));
    expect(r.profileIds).toEqual(["compagne"]);
  });

  it("ce soir defaults to 19h", () => {
    const r = parseQuickAdd("Cinéma ce soir", opts);
    expect(r.title).toBe("Cinéma");
    expect(r.start).toEqual(d(2026, 9, 30, 19, 0));
  });

  it("same weekday with time already passed → next week", () => {
    const thursdayEvening = d(2026, 10, 1, 18, 0);
    const r = parseQuickAdd("Dentiste jeudi 16h", { ...opts, now: thursdayEvening });
    expect(r.start).toEqual(d(2026, 10, 8, 16, 0));
  });

  it("time only, already passed today → tomorrow", () => {
    const r = parseQuickAdd("Appeler la banque 9h", opts);
    expect(r.start).toEqual(d(2026, 10, 1, 9, 0));
    expect(r.title).toBe("Appeler la banque");
  });

  it("numeric date 15/10 and duration", () => {
    const r = parseQuickAdd("Padel 15/10 18h pendant 1h30", opts);
    expect(r.start).toEqual(d(2026, 10, 15, 18, 0));
    expect(r.end).toEqual(d(2026, 10, 15, 19, 30));
    expect(r.title).toBe("Padel");
  });

  it("two persons → couple profile", () => {
    const r = parseQuickAdd("Cinéma samedi 20h avec Clément et Compagne", opts);
    expect(r.profileIds).toEqual(["couple"]);
    expect(r.title).toBe("Cinéma");
  });

  it("chez les parents attaches the place and strips it from the title", () => {
    const r = parseQuickAdd("Repas chez les parents dimanche midi", opts);
    expect(r.title).toBe("Repas");
    expect(r.location?.placeId).toBe("parents");
    expect(r.start).toEqual(d(2026, 10, 4, 12, 0));
  });
});
