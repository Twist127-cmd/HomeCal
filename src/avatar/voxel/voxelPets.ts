import assets from "./petAssets.json";
import type { HomeCalAvatarConfig } from "../types";
const sprites: Record<string, string> = assets;
const cache = new Map<string, string>();
export function renderVoxelPet(config: HomeCalAvatarConfig): string {
  const key = JSON.stringify([config.type, config.pet]);
  const cached = cache.get(key);
  if (cached) return cached;
  let svg = sprites[config.type + ":" + config.pet.breed] ?? sprites[config.type + ":mixed"];
  if (!svg) throw new Error("Unknown voxel pet");
  svg = svg.replaceAll("#d9b576", config.pet.color).replaceAll("#76804c", config.pet.eyeColor);
  const accessory = config.pet.accessory === "none" ? "" : config.pet.accessory === "bandana" ? '<path d="M40 88h42l-21 18Z" fill="#bd8067"/><path d="M40 88h42v5H40Z" fill="#e1ae8c"/>' : config.pet.accessory === "bow" ? '<path d="M60 91l-13-7v14l13-7 13 7V84Z" fill="#8d79a5"/><path d="M56 87h8v8h-8Z" fill="#b7a6c8"/>' : '<path d="M40 89h42v6H40Z" fill="#759c94"/><path d="M59 94h6v6h-6Z" fill="#e2c27e"/>';
  svg = svg.replace("</svg>", accessory + "</svg>");
  cache.set(key, svg);
  if (cache.size > 64) cache.delete(cache.keys().next().value!);
  return svg;
}
