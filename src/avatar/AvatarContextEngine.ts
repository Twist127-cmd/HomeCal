import { isPet } from "./catalog";
import type { AvatarConfig, AvatarContext, AvatarPresentation, AnimationLevel } from "./types";
export function avatarPeriod(hour: number): AvatarContext["dayPeriod"] { return hour >= 5 && hour < 9 ? "morning" : hour < 18 && hour >= 9 ? "day" : hour >= 18 && hour < 22 ? "evening" : "night"; }
export function avatarSeason(month: number): AvatarContext["season"] { return month >= 2 && month <= 4 ? "spring" : month >= 5 && month <= 7 ? "summer" : month >= 8 && month <= 10 ? "autumn" : "winter"; }
export function specialDate(date: Date) { const m = date.getMonth(), d = date.getDate(); return m === 11 && d >= 24 && d <= 26 ? "christmas" : m === 0 && d === 1 || m === 11 && d === 31 ? "new-year" : m === 9 && d === 31 ? "halloween" : m === 8 && d <= 7 ? "back-to-school" : ""; }
export const DEFAULT_AVATAR_CONTEXT: AvatarContext = { theme: "warm", scene: "", dayPeriod: "day", season: "autumn", specialDate: "", musicPlaying: false, cooking: false, departureSoon: false, eventSoon: false };
/** Layered visual overrides never mutate face, hair, morphology or the stored outfit. */
export function composeAvatar(c: AvatarConfig, context: AvatarContext, intensity: AnimationLevel): AvatarPresentation {
  let outfit = c.outfit.base;
  const accessories = new Set(c.accessories);
  const human = !isPet(c.type);
  if (context.season === "winter" && human) accessories.add("scarf");
  if (context.specialDate === "christmas") accessories.add("festive-hat");
  if (context.specialDate === "new-year") accessories.add("party-hat");
  if (context.specialDate === "halloween") accessories.add("pumpkin");
  if (context.specialDate === "birthday") accessories.add("party-hat");
  if (context.specialDate === "back-to-school" && (c.type === "child" || c.type === "teen")) accessories.add("schoolbag");
  if (context.dayPeriod === "morning" && human && c.type !== "baby") accessories.add("mug");
  if (context.dayPeriod === "evening" && human) { outfit = "home"; if (c.type !== "baby") accessories.add("mug"); }
  if (context.dayPeriod === "night" && human) outfit = "pajamas";
  const scene = context.scene.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (scene.includes("matin")) { if (human && c.type !== "baby") accessories.add("mug"); }
  if (scene.includes("soir")) { if (human) outfit = "home"; }
  if (scene.includes("travail")) { if (human) { outfit = "work"; accessories.add("notebook"); } }
  if (scene.includes("vacances")) { if (human) { outfit = "summer"; accessories.add("sunglasses"); } else accessories.add("bandana"); }
  if (context.cooking || scene.includes("cuisine")) { accessories.delete("mug"); if (human) { outfit = "kitchen"; accessories.add("chef-hat"); accessories.add("spoon"); } else accessories.add("bandana"); }
  const animation = context.departureSoon || context.eventSoon ? "attention" : context.dayPeriod === "night" ? "sleep" : context.musicPlaying && intensity !== "reduced" ? "dance" : "idle";
  return { outfit, accessories: [...accessories], animation, lighting: context.dayPeriod === "night" ? "night" : context.dayPeriod === "morning" ? "morning" : context.dayPeriod === "evening" ? "evening" : context.theme };
}
