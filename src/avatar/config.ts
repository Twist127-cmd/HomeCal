import { ACCESSORIES, AVATAR_TYPES, BACKGROUNDS, BODY_TYPES, CAT_BREEDS, DOG_BREEDS, FACE_OPTIONS, FACE_SHAPES, HAIR_LENGTHS, HAIR_STYLES, HAIR_TEXTURES, HAIR_VOLUMES, OUTFITS, PET_ACCESSORIES, PET_OPTIONS, SKIN_COLORS, HAIR_COLORS, EYE_COLORS, OUTFIT_COLORS, FUR_COLORS, applyBreed, isPet, type Choice } from "./catalog";
import type { AvatarConfig, AvatarType } from "./types";
export function defaultAvatar(type: AvatarType = "adult"): AvatarConfig {
  const config: AvatarConfig = { version: 1, type, base: { skinTone: "#dca67d", faceShape: "oval", bodyType: "average" }, face: { cheeks: "none", ears: "normal", eyes: "almond", eyeColor: "#73513a", iris: "normal", brows: "soft", nose: "button", mouth: "smile", beard: "none" }, hair: { style: type === "baby" ? "very-short" : "short", color: "#4c3023", length: "short", volume: "normal", texture: "straight" }, outfit: { base: type === "baby" ? "overalls" : "casual", color: "#4e727c" }, accessories: [], pet: { breed: "mixed", size: "medium", silhouette: "average", ears: "pointed", muzzle: "short", fur: "smooth", color: "#d9b576", markings: "none", eyeColor: "#76804c", tail: "straight" }, background: "theme" };
  return isPet(type) ? applyBreed(config, type === "dog" ? "golden" : "european") : config;
}
const value = (input: unknown, choices: Choice[], fallback: string) => typeof input === "string" && choices.some((c) => c.id === input) ? input : fallback;
const color = (input: unknown, fallback: string) => typeof input === "string" && /^#[0-9a-f]{6}$/i.test(input) ? input : fallback;
export function normalizeAvatar(input: unknown): AvatarConfig {
  if (!input || typeof input !== "object") return defaultAvatar();
  const raw = input as Partial<AvatarConfig>;
  const type = value(raw.type, AVATAR_TYPES, "adult") as AvatarType;
  const d = defaultAvatar(type);
  const result = { ...d, base: { ...d.base }, face: { ...d.face }, hair: { ...d.hair }, outfit: { ...d.outfit }, pet: { ...d.pet } };
  result.base.skinTone = color(raw.base?.skinTone, d.base.skinTone); result.base.faceShape = value(raw.base?.faceShape, FACE_SHAPES, d.base.faceShape); result.base.bodyType = value(raw.base?.bodyType, BODY_TYPES, d.base.bodyType);
  for (const key of Object.keys(FACE_OPTIONS) as (keyof typeof FACE_OPTIONS)[]) result.face[key] = value(raw.face?.[key], FACE_OPTIONS[key], d.face[key]);
  result.face.eyeColor = color(raw.face?.eyeColor, d.face.eyeColor);
  result.hair = { style: value(raw.hair?.style, HAIR_STYLES, d.hair.style), color: color(raw.hair?.color, d.hair.color), length: value(raw.hair?.length, HAIR_LENGTHS, d.hair.length), volume: value(raw.hair?.volume, HAIR_VOLUMES, d.hair.volume), texture: value(raw.hair?.texture, HAIR_TEXTURES, d.hair.texture) };
  result.outfit = { base: value(raw.outfit?.base, OUTFITS, d.outfit.base), color: color(raw.outfit?.color, d.outfit.color) };
  for (const key of Object.keys(PET_OPTIONS) as (keyof typeof PET_OPTIONS)[]) result.pet[key] = value(raw.pet?.[key], PET_OPTIONS[key], d.pet[key]);
  result.pet.breed = value(raw.pet?.breed, type === "dog" ? DOG_BREEDS : CAT_BREEDS, d.pet.breed); result.pet.color = color(raw.pet?.color, d.pet.color); result.pet.eyeColor = color(raw.pet?.eyeColor, d.pet.eyeColor);
  result.accessories = [...new Set(Array.isArray(raw.accessories) ? raw.accessories.filter((a) => (isPet(type) ? PET_ACCESSORIES : ACCESSORIES).some((c) => c.id === a)) : [])].slice(0, 8);
  result.background = value(raw.background, BACKGROUNDS, d.background);
  if (type !== "adult") result.face.beard = "none";
  if (type === "baby" && !["very-short", "curly", "bald"].includes(result.hair.style)) result.hair.style = "very-short";
  return result;
}
export function changeAvatarType(config: AvatarConfig, type: AvatarType) { return isPet(type) !== isPet(config.type) || isPet(type) ? defaultAvatar(type) : normalizeAvatar({ ...config, type, outfit: { ...config.outfit, base: type === "baby" ? "overalls" : type === "child" && ["work", "chic"].includes(config.outfit.base) ? "tshirt" : config.outfit.base } }); }
const pick = <T,>(items: readonly T[], random: () => number) => items[Math.min(items.length - 1, Math.floor(Math.max(0, random()) * items.length))];
export function randomAvatar(type: AvatarType, random = Math.random): AvatarConfig {
  let c = defaultAvatar(type);
  c.base.skinTone = pick(SKIN_COLORS, random); c.base.faceShape = pick(FACE_SHAPES, random).id;
  c.hair.color = pick(HAIR_COLORS, random); c.hair.style = pick(type === "baby" ? HAIR_STYLES.filter((h) => ["very-short", "curly", "bald"].includes(h.id)) : HAIR_STYLES, random).id;
  c.face.eyeColor = pick(EYE_COLORS, random); c.outfit.color = pick(OUTFIT_COLORS, random);
  c.outfit.base = pick(type === "baby" ? ["overalls", "pajamas", "tshirt"] : type === "child" ? ["tshirt", "dress", "sweatshirt", "sport"] : ["casual", "sport", "chic", "home"], random);
  if (isPet(type)) { c = applyBreed(c, pick(type === "dog" ? DOG_BREEDS : CAT_BREEDS, random).id); c.pet.eyeColor = pick(EYE_COLORS, random); c.pet.color = pick(FUR_COLORS, random); c.accessories = [pick(["collar", "bandana", "bow"], random)]; }
  else if (type !== "baby" && random() > .6) c.accessories = ["glasses"];
  return normalizeAvatar(c);
}
export function quickPreset(c: AvatarConfig, id: string): AvatarConfig {
  if (isPet(c.type)) return { ...c, accessories: id === "natural" ? [] : id === "outdoor" ? ["harness", "tag"] : id === "chic" ? ["bow"] : [id === "bandana" ? "bandana" : "collar"] };
  return normalizeAvatar({ ...c, type: id === "child" ? "child" : c.type, outfit: { ...c.outfit, base: id === "cosy" ? "home" : id === "child" ? "tshirt" : id }, accessories: id === "winter" ? ["scarf", "beanie"] : id === "summer" ? ["sunglasses"] : [] });
}
export function toggleAccessory(list: string[], id: string) {
  if (list.includes(id)) return list.filter((x) => x !== id);
  const groups = [["glasses", "sunglasses"], ["hat", "cap", "beanie", "headband"], ["headphones", "earbuds"], ["bag", "schoolbag"]];
  const conflict = groups.find((g) => g.includes(id)) ?? [];
  return [...list.filter((x) => !conflict.includes(x)), id].slice(-8);
}
