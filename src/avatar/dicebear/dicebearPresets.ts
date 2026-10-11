import type { HomeCalAvatarConfig } from "../types";
export const VOXEL_PRESETS = [{ id: "casual", label: "Casual", outfit: "plain" }, { id: "sport", label: "Sport", outfit: "stripes" }, { id: "chic", label: "Chic", outfit: "suit" }, { id: "cosy", label: "Cosy", outfit: "hoodie" }, { id: "summer", label: "Été", outfit: "plain" }, { id: "winter", label: "Hiver", outfit: "coat" }] as const;
export function applyVoxelPreset(config: HomeCalAvatarConfig, id: string): HomeCalAvatarConfig {
  const preset = VOXEL_PRESETS.find(p => p.id === id);
  if (!preset) return config;
  return { ...config, options: { ...config.options, outfitVariant: preset.outfit, topVariant: id === "winter" ? "beanie" : config.options.topVariant, glassesVariant: "shades", glassesProbability: id === "summer" ? 100 : 0 } };
}
