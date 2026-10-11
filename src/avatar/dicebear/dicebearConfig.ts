import type { StyleOptions } from "@dicebear/core";
import type definition from "@dicebear/styles/voxel-art.json";
import { AVATAR_TYPES, DOG_BREEDS, CAT_BREEDS, isPet } from "../catalog";
import { normalizeAvatar } from "../config";
import type { AvatarType, HomeCalAvatarConfig } from "../types";
import { VOXEL_COLORS, VOXEL_VARIANTS } from "./dicebearOptions";
import { Avatar } from "@dicebear/core";
import { VOXEL_STYLE } from "./dicebearStyle";

export type VoxelOptions = Pick<StyleOptions<typeof definition>, "topVariant" | "topProbability" | "eyesVariant" | "eyebrowsVariant" | "eyebrowsProbability" | "noseVariant" | "mouthVariant" | "beardVariant" | "beardProbability" | "cheeksVariant" | "cheeksProbability" | "glassesVariant" | "glassesProbability" | "outfitVariant" | "skinColor" | "hairColor" | "hatColor" | "shirtColor" | "pantsColor" | "shoesColor" | "jacketColor" | "backgroundColor">;
const hash = (text: string) => { let value = 2166136261; for (let i = 0; i < text.length; i++) value = Math.imul(value ^ text.charCodeAt(i), 16777619); return (value >>> 0).toString(36); };
export const profileSeed = (id: string) => "hc-" + hash("homecal-avatar-v2:" + id);
export const newAvatarSeed = () => "hc-" + crypto.randomUUID();
const hex = (value: unknown, fallback: string) => typeof value === "string" && /^#[a-f\d]{6}(?:[a-f\d]{2})?$/i.test(value) ? value.toLowerCase() : fallback;
const typeOf = (value: unknown): AvatarType => AVATAR_TYPES.some(t => t.id === value) ? value as AvatarType : "adult";

export function defaultVoxelAvatar(type: AvatarType = "adult", seed = profileSeed("preview")): HomeCalAvatarConfig {
  return { version: 2, engine: "dicebear", style: "voxel-art", type, seed, options: { topVariant: type === "baby" ? "short" : "sideSwept", topProbability: 100, eyesVariant: "open", eyebrowsVariant: "soft", eyebrowsProbability: 100, noseVariant: "small", mouthVariant: "smile", beardProbability: 0, cheeksProbability: 0, glassesProbability: 0, outfitVariant: type === "baby" ? "overalls" : "plain", skinColor: "#eab890", hairColor: "#5a3825", hatColor: "#5ba8a0", shirtColor: "#5ba8a0", pantsColor: "#2f4160", shoesColor: "#f1f3f5", jacketColor: "#5ba8a0", backgroundColor: "#00000000" }, animationLevel: "normal", seasonalAccessoriesEnabled: true, contextualAccessoriesEnabled: true, pet: { breed: type === "dog" ? "golden" : "european", color: type === "cat" ? "#9d9489" : "#d9b576", eyeColor: "#76804c", accessory: "none" } };
}
export function normalizeVoxelAvatar(input: unknown, identity = "preview", storedSeed?: string): HomeCalAvatarConfig {
  const raw = input && typeof input === "object" ? input as Partial<HomeCalAvatarConfig> : {};
  const type = typeOf(raw.type), seed = typeof raw.seed === "string" && /^[\w-]{1,100}$/.test(raw.seed) ? raw.seed : storedSeed && /^[\w-]{1,100}$/.test(storedSeed) ? storedSeed : profileSeed(identity);
  const defaults = defaultVoxelAvatar(type, seed);
  if (raw.version !== 2 || raw.engine !== "dicebear" || raw.style !== "voxel-art") {
    if (!input) return defaults;
    const old = normalizeAvatar(input);
    const tops: Record<string, string> = { "very-short": "short", medium: "shoulderLength", long: "longStraight", wavy: "longWavy", bun: "buns", locks: "braids", shaved: "halfShaved" };
    const outfits: Record<string, string> = { casual: "plain", tshirt: "plain", sport: "stripes", chic: "suit", work: "tie", home: "hoodie", sweatshirt: "hoodie", winter: "coat", summer: "plain", pajamas: "checker", kitchen: "overalls" };
    return normalizeVoxelAvatar({ ...defaults, options: { ...defaults.options, skinColor: old.base.skinTone, hairColor: old.hair.color, shirtColor: old.outfit.color, jacketColor: old.outfit.color, topVariant: tops[old.hair.style] ?? (VOXEL_VARIANTS.top.includes(old.hair.style) ? old.hair.style : "short"), topProbability: old.hair.style === "bald" ? 0 : 100, outfitVariant: outfits[old.outfit.base] ?? old.outfit.base, cheeksVariant: old.face.cheeks === "freckles" ? "freckles" : "blush", cheeksProbability: old.face.cheeks === "none" ? 0 : 100, beardVariant: old.face.beard === "mustache" || old.face.beard === "goatee" ? old.face.beard : "stubble", beardProbability: old.face.beard === "none" ? 0 : 100, glassesVariant: old.accessories.includes("sunglasses") ? "shades" : "round", glassesProbability: old.accessories.some(a => a === "glasses" || a === "sunglasses") ? 100 : 0 }, pet: { breed: old.pet.breed, color: old.pet.color, eyeColor: old.pet.eyeColor, accessory: old.accessories.includes("bandana") ? "bandana" : old.accessories.includes("collar") ? "collar" : old.accessories.includes("bow") ? "bow" : "none" } }, identity);
  }
  const options: Record<string, unknown> = { ...defaults.options };
  const source = raw.options && typeof raw.options === "object" ? raw.options as Record<string, unknown> : {};
  for (const [component, variants] of Object.entries(VOXEL_VARIANTS)) {
    const key = component + "Variant", candidate = source[key];
    if (typeof candidate === "string" && variants.includes(candidate)) options[key] = candidate;
    const probability = component + "Probability";
    if (probability in defaults.options && typeof source[probability] === "number") options[probability] = Math.max(0, Math.min(100, source[probability] as number));
  }
  for (const color of Object.keys(VOXEL_COLORS)) options[color + "Color"] = hex(source[color + "Color"], String(options[color + "Color"]));
  if (type !== "adult") options.beardProbability = 0;
  const breeds = type === "dog" ? DOG_BREEDS : CAT_BREEDS;
  return { ...defaults, options: options as VoxelOptions, animationLevel: raw.animationLevel === "reduced" || raw.animationLevel === "lively" ? raw.animationLevel : "normal", seasonalAccessoriesEnabled: raw.seasonalAccessoriesEnabled !== false, contextualAccessoriesEnabled: raw.contextualAccessoriesEnabled !== false, pet: { breed: breeds.some(b => b.id === raw.pet?.breed) ? raw.pet!.breed : defaults.pet.breed, color: hex(raw.pet?.color, defaults.pet.color), eyeColor: hex(raw.pet?.eyeColor, defaults.pet.eyeColor), accessory: ["collar", "bandana", "bow"].includes(raw.pet?.accessory ?? "") ? raw.pet!.accessory : "none" } };
}
export function randomVoxelAvatar(type: AvatarType, seed = newAvatarSeed()): HomeCalAvatarConfig {
  const config = defaultVoxelAvatar(type, seed);
  const resolved = new Avatar(VOXEL_STYLE, { seed, animationVariant: "none", backgroundColor: "#00000000", beardProbability: type === "adult" ? 20 : 0, glassesProbability: type === "baby" ? 0 : 15 }).toJSON().options as Record<string, unknown>;
  const options: Record<string, unknown> = { ...config.options };
  for (const component of Object.keys(VOXEL_VARIANTS)) {
    const key = component + "Variant", probability = component + "Probability";
    if (resolved[key]) options[key] = resolved[key];
    if (probability in options) options[probability] = resolved[key] ? 100 : 0;
  }
  for (const color of Object.keys(VOXEL_COLORS)) options[color + "Color"] = (resolved[color + "Color"] as string[] | undefined)?.[0] ?? options[color + "Color"];
  config.options = options as VoxelOptions;
  return { ...config, pet: { ...config.pet, breed: (isPet(type) ? (type === "dog" ? DOG_BREEDS : CAT_BREEDS) : CAT_BREEDS)[parseInt(hash(seed), 36) % (type === "dog" ? DOG_BREEDS.length : CAT_BREEDS.length)].id } };
}
