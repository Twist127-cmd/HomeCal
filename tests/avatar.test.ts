import { describe, expect, it } from "vitest";
import { applyBreed, AVATAR_TYPES, CAT_BREEDS, DOG_BREEDS, isPet } from "@/avatar/catalog";
import { defaultAvatar, normalizeAvatar, quickPreset, randomAvatar, toggleAccessory } from "@/avatar/config";
import { avatarPeriod, avatarSeason, composeAvatar, DEFAULT_AVATAR_CONTEXT, specialDate } from "@/avatar/AvatarContextEngine";
import type { AvatarType } from "@/avatar/types";
describe("versioned family avatars", () => {
  it.each(AVATAR_TYPES)("round-trips $label and repairs invalid configuration", ({ id }) => {
    const config = defaultAvatar(id as AvatarType);
    expect(normalizeAvatar(JSON.parse(JSON.stringify(config)))).toEqual(config);
    expect(normalizeAvatar({ ...config, base: { skinTone: "url(evil)", faceShape: "unknown" }, accessories: ["unknown", "collar", "collar"] }).base).toEqual(config.base);
  });
  it("preserves legacy profiles without requiring an avatar config", () => {
    expect(normalizeAvatar(undefined)).toEqual(defaultAvatar());
    expect(normalizeAvatar({ type: "unknown" }).type).toBe("adult");
  });
  it("supports the requested breeds with distinct morphology", () => {
    expect(DOG_BREEDS).toHaveLength(15); expect(CAT_BREEDS).toHaveLength(11);
    for (const type of ["dog", "cat"] as const) for (const b of type === "dog" ? DOG_BREEDS : CAT_BREEDS) {
      const config = applyBreed(defaultAvatar(type), b.id);
      expect(config.pet).toMatchObject({ breed: b.id, ears: b.ears, muzzle: b.muzzle, fur: b.fur, markings: b.markings });
      expect(normalizeAvatar(config)).toEqual(config);
    }
    expect(applyBreed(defaultAvatar("dog"), "cocker").pet).not.toEqual(applyBreed(defaultAvatar("dog"), "labrador").pet);
    expect(applyBreed(defaultAvatar("cat"), "siamese").pet).not.toEqual(applyBreed(defaultAvatar("cat"), "bengal").pet);
  });
  it("generates coherent random avatars for every type", () => {
    for (const type of AVATAR_TYPES) for (const random of [() => 0, () => .5, () => .999]) {
      const c = randomAvatar(type.id as AvatarType, random);
      expect(c.type).toBe(type.id); expect(normalizeAvatar(c)).toEqual(c);
      if (type.id !== "adult") expect(c.face.beard).toBe("none");
      if (isPet(c.type)) expect(c.accessories).not.toContain("glasses");
      if (c.type === "baby") expect(["overalls", "pajamas", "tshirt"]).toContain(c.outfit.base);
    }
  });
  it("excludes conflicting glasses and hats", () => {
    expect(toggleAccessory(["glasses", "watch"], "sunglasses")).toEqual(["watch", "sunglasses"]);
    expect(toggleAccessory(["hat"], "cap")).toEqual(["cap"]);
    expect(toggleAccessory(["cap"], "cap")).toEqual([]);
  });
  it("keeps custom appearance when applying quick presets", () => {
    const c = defaultAvatar("child"), next = quickPreset(c, "winter");
    expect(next.base).toEqual(c.base); expect(next.face).toEqual(c.face); expect(next.hair).toEqual(c.hair);
    expect(next.accessories).toContain("scarf");
  });
});
describe("context layers never change identity", () => {
  it.each(AVATAR_TYPES)("composes music, winter, evening and kitchen for $label", ({ id }) => {
    const c = defaultAvatar(id as AvatarType), before = JSON.stringify(c);
    const p = composeAvatar(c, { ...DEFAULT_AVATAR_CONTEXT, season: "winter", dayPeriod: "evening", scene: "Cuisine", cooking: true, musicPlaying: true }, "lively");
    expect(p.animation).toBe("dance"); expect(p.accessories).toContain(isPet(c.type) ? "bandana" : "chef-hat");
    if (!isPet(c.type)) expect(p.outfit).toBe("kitchen");
    expect(JSON.stringify(c)).toBe(before);
  });
  it("prioritizes imminent departure and suppresses dancing in reduced or night mode", () => {
    const c = defaultAvatar();
    expect(composeAvatar(c, { ...DEFAULT_AVATAR_CONTEXT, musicPlaying: true, departureSoon: true }, "lively").animation).toBe("attention");
    expect(composeAvatar(c, { ...DEFAULT_AVATAR_CONTEXT, musicPlaying: true }, "reduced").animation).toBe("idle");
    expect(composeAvatar(c, { ...DEFAULT_AVATAR_CONTEXT, musicPlaying: true, dayPeriod: "night" }, "lively")).toMatchObject({ animation: "sleep", outfit: "pajamas" });
  });
  it.each([[4,"night"],[5,"morning"],[8,"morning"],[9,"day"],[17,"day"],[18,"evening"],[21,"evening"],[22,"night"]])("handles %i h", (hour, expected) => expect(avatarPeriod(Number(hour))).toBe(expected));
  it("handles seasons and special dates", () => {
    expect(avatarSeason(0)).toBe("winter"); expect(avatarSeason(3)).toBe("spring"); expect(avatarSeason(6)).toBe("summer"); expect(avatarSeason(9)).toBe("autumn");
    expect(specialDate(new Date(2026,11,25))).toBe("christmas"); expect(specialDate(new Date(2026,9,31))).toBe("halloween"); expect(specialDate(new Date(2027,0,1))).toBe("new-year");
  });
});
