import { Avatar } from "@dicebear/core";
import { VOXEL_STYLE } from "./dicebearStyle";
import type { HomeCalAvatarConfig } from "../types";
const cache = new Map<string, string>();
export function renderDiceBearSvg(config: HomeCalAvatarConfig, hideTop = false): string {
  const key = JSON.stringify([config.seed, config.options, hideTop]);
  const hit = cache.get(key);
  if (hit) { cache.delete(key); cache.set(key, hit); return hit; }
  const svg = new Avatar(VOXEL_STYLE, { ...config.options, seed: config.seed, backgroundColor: "#00000000", animationVariant: "none", ...(hideTop ? { topProbability: 0 } : {}) }).toString();
  cache.set(key, svg);
  if (cache.size > 128) cache.delete(cache.keys().next().value!);
  return svg;
}
export function isolateSvg(svg: string, id: string): string {
  return svg.replace(/(id="|href="#|url\(#)([\w-]+)/g, (_match, prefix: string, value: string) => prefix + id + "-" + value).replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "");
}
export const voxelCacheSize = () => cache.size;
