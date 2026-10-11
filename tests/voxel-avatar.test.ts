import { describe, expect, it } from "vitest";
import { defaultAvatar } from "@/avatar/config";
import { AVATAR_TYPES, CAT_BREEDS, DOG_BREEDS, type Choice } from "@/avatar/catalog";
import { defaultVoxelAvatar, normalizeVoxelAvatar, profileSeed, randomVoxelAvatar } from "@/avatar/dicebear/dicebearConfig";
import { renderDiceBearSvg, isolateSvg, voxelCacheSize } from "@/avatar/dicebear/dicebearRender";
import { VOXEL_VARIANTS } from "@/avatar/dicebear/dicebearOptions";
import { composeVoxelAvatar } from "@/avatar/VoxelContextEngine";
import { DEFAULT_AVATAR_CONTEXT } from "@/avatar/AvatarContextEngine";
import { renderVoxelPet } from "@/avatar/voxel/voxelPets";
import type { AvatarType } from "@/avatar/types";

describe("DiceBear voxel identity and migration", () => {
  it.each(AVATAR_TYPES)("migrates $label without mutating legacy identity", ({ id }: Choice) => {
    const old = defaultAvatar(id as AvatarType), before = JSON.stringify(old);
    const config = normalizeVoxelAvatar(old, "internal-id");
    expect(config.version).toBe(2); expect(config.engine).toBe("dicebear"); expect(config.style).toBe("voxel-art");
    expect(config.type).toBe(id); expect(config.options.skinColor).toBe(old.base.skinTone);
    expect(config.seed).toBe(profileSeed("internal-id")); expect(JSON.stringify(old)).toBe(before);
    expect(normalizeVoxelAvatar(config, "other-id")).toEqual(config);
  });
  it("uses opaque stable seeds without a personal name", () => {
    expect(profileSeed("internal-id")).toBe(profileSeed("internal-id"));
    expect(profileSeed("internal-id")).not.toBe(profileSeed("other-id"));
    expect(profileSeed("private@example.test")).not.toContain("private");
    expect(normalizeVoxelAvatar(undefined, "id").seed).toBe(profileSeed("id"));
  });
  it("generates identical SVG for identical identity and meaningful option changes", () => {
    const config = defaultVoxelAvatar("adult", "opaque-fixed");
    const svg = renderDiceBearSvg(config);
    expect(renderDiceBearSvg(JSON.parse(JSON.stringify(config)))).toBe(svg);
    expect(renderDiceBearSvg({ ...config, options: { ...config.options, topVariant: "afro" } })).not.toBe(svg);
    expect(svg).toContain("Voxel Art"); expect(svg).toContain("avatar-leg-left"); expect(svg).not.toContain("<style>");
  });
  it("isolates identical seeded SVG ids across previews", () => {
    const svg = renderDiceBearSvg(defaultVoxelAvatar());
    const first = isolateSvg(svg, "preview-a"), second = isolateSvg(svg, "preview-b");
    expect(first).toContain('id="preview-a-'); expect(first).toContain('href="#preview-a-');
    expect(second).not.toContain("preview-a-");
  });
  it("resolves seeded random choices into editable supported options", () => {
    const first = randomVoxelAvatar("adult", "opaque-a"), second = randomVoxelAvatar("adult", "opaque-b");
    expect(randomVoxelAvatar("adult", "opaque-a")).toEqual(first);
    expect(renderDiceBearSvg(first)).not.toBe(renderDiceBearSvg(second));
    expect(normalizeVoxelAvatar(first)).toEqual(first);
  });
  it("audits every native variant against the installed renderer", () => {
    for (const [component, variants] of Object.entries(VOXEL_VARIANTS)) for (const variant of variants) {
      const config = defaultVoxelAvatar();
      const candidate = normalizeVoxelAvatar({ ...config, options: { ...config.options, [component + "Variant"]: variant, [component + "Probability"]: 100 } });
      expect(() => renderDiceBearSvg(candidate)).not.toThrow();
    }
  });
  it("rejects arbitrary option keys, colors, unsupported choices and child beards", () => {
    const config = normalizeVoxelAvatar({ ...defaultVoxelAvatar("child"), options: { topVariant: "not-real", skinColor: "url(evil)", title: "<script>", beardProbability: 100 } });
    expect(config.options.topVariant).toBe("sideSwept"); expect(config.options.skinColor).toBe("#eab890");
    expect(config.options.beardProbability).toBe(0); expect(config.options).not.toHaveProperty("title");
  });
  it("bounds the SVG cache", () => {
    for (let i = 0; i < 140; i++) renderDiceBearSvg(defaultVoxelAvatar("adult", "cache-" + i));
    expect(voxelCacheSize()).toBeLessThanOrEqual(128);
  });
  it.each([...DOG_BREEDS.map(b => ({ ...b, type: "dog" })), ...CAT_BREEDS.map(b => ({ ...b, type: "cat" }))])("renders the local voxel asset for $label", breed => {
    const config = defaultVoxelAvatar(breed.type as AvatarType);
    config.pet.breed = breed.id;
    expect(renderVoxelPet(config)).toContain("avatar-leg"); expect(renderVoxelPet(config)).toContain("<svg");
  });
});
describe("HomeCal voxel context remains separate from identity", () => {
  it("gives cooking headwear priority over winter and Christmas", () => {
    const config = defaultVoxelAvatar(), before = JSON.stringify(config);
    const result = composeVoxelAvatar(config, { ...DEFAULT_AVATAR_CONTEXT, season: "winter", specialDate: "christmas", cooking: true, musicPlaying: true }, "normal");
    expect(result.headwear).toBe("chef-hat"); expect(result.accessories).toEqual(["pan", "apron"]); expect(result.animation).toBe("dance");
    expect(JSON.stringify(config)).toBe(before);
  });
  it("supports kitchen scene id, theme winter and seasonal/context switches", () => {
    const config = defaultVoxelAvatar();
    expect(composeVoxelAvatar(config, { ...DEFAULT_AVATAR_CONTEXT, scene: "kitchen" }, "normal").headwear).toBe("chef-hat");
    expect(composeVoxelAvatar(config, { ...DEFAULT_AVATAR_CONTEXT, theme: "winter" }, "normal").headwear).toBe("beanie");
    const disabled = { ...config, seasonalAccessoriesEnabled: false, contextualAccessoriesEnabled: false };
    expect(composeVoxelAvatar(disabled, { ...DEFAULT_AVATAR_CONTEXT, scene: "Cuisine", season: "winter" }, "normal").headwear).toBeNull();
  });
  it("honors reduced motion, night and live alert priority", () => {
    const config = defaultVoxelAvatar();
    expect(composeVoxelAvatar(config, { ...DEFAULT_AVATAR_CONTEXT, musicPlaying: true }, "reduced").animation).toBe("idle");
    expect(composeVoxelAvatar(config, { ...DEFAULT_AVATAR_CONTEXT, musicPlaying: true, dayPeriod: "night" }, "normal").animation).toBe("sleep");
    expect(composeVoxelAvatar(config, { ...DEFAULT_AVATAR_CONTEXT, musicPlaying: true, eventSoon: true }, "normal").animation).toBe("attention");
    expect(composeVoxelAvatar({ ...config, animationLevel: "reduced" }, DEFAULT_AVATAR_CONTEXT, "lively").intensity).toBe("reduced");
  });
});
