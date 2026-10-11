import type { AnimationLevel, AvatarContext, HomeCalAvatarConfig } from "./types";
import { isPet } from "./catalog";
export type VoxelAccessory = "chef-hat" | "beanie" | "cap" | "festive-hat" | "party-hat" | "flower" | "scarf" | "mug" | "pan" | "apron";
export interface VoxelPresentation { headwear: VoxelAccessory | null; accessories: VoxelAccessory[]; animation: "idle" | "dance" | "attention" | "sleep"; lighting: string; intensity: AnimationLevel }
export function composeVoxelAvatar(config: HomeCalAvatarConfig, context: AvatarContext, deviceLevel: AnimationLevel): VoxelPresentation {
  const rank = { reduced: 0, normal: 1, lively: 2 };
  const intensity = rank[deviceLevel] < rank[config.animationLevel] ? deviceLevel : config.animationLevel;
  const human = !isPet(config.type), accessories: VoxelAccessory[] = [];
  let headwear: VoxelAccessory | null = null;
  if (config.seasonalAccessoriesEnabled) {
    if (context.season === "spring" || context.theme === "spring") accessories.push("flower");
    if (context.season === "summer" || context.theme === "summer") headwear = "cap";
    if (context.season === "autumn" || context.theme === "autumn") accessories.push("scarf");
    if (context.season === "winter" || context.theme === "winter") { headwear = "beanie"; accessories.push("scarf"); }
    if (context.specialDate === "christmas") headwear = "festive-hat";
    if (["birthday", "new-year"].includes(context.specialDate)) headwear = "party-hat";
  }
  const scene = context.scene.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (config.contextualAccessoriesEnabled && human) {
    if ((context.dayPeriod === "morning" || scene.includes("matin")) && config.type !== "baby") accessories.push("mug");
    if (context.cooking || scene.includes("cuisine") || scene === "kitchen") {
      headwear = "chef-hat";
      accessories.splice(0, accessories.length, "pan", "apron");
    }
  }
  const animation = context.departureSoon || context.eventSoon ? "attention" : context.dayPeriod === "night" ? "sleep" : context.musicPlaying && intensity !== "reduced" ? "dance" : "idle";
  return { headwear, accessories, animation, intensity, lighting: context.dayPeriod };
}
