import { contrast, hex, mix, readable, type RGB, type DesignPreset } from "./tokens";
export interface AlbumPalette { dominant: string; secondary: string; accent: string }
export const FALLBACK_PALETTE: AlbumPalette = { dominant: "#24332b", secondary: "#17251f", accent: "#9bc6aa" };
/** At most 1,024 pixels; quantization avoids a heavy clustering pass on a tablet. */
export function extractPalette(pixels: ArrayLike<number>): AlbumPalette {
  const buckets = new Map<string, { count: number; sum: RGB }>();
  for (let i = 0; i + 3 < pixels.length; i += 4) {
    if (pixels[i + 3] < 128) continue;
    const values: RGB = [pixels[i], pixels[i + 1], pixels[i + 2]];
    const key = values.map((v) => Math.floor(v / 32)).join(",");
    const bucket = buckets.get(key) ?? { count: 0, sum: [0, 0, 0] };
    bucket.count++; values.forEach((v, j) => bucket.sum[j] += v); buckets.set(key, bucket);
  }
  const colors = [...buckets.values()].sort((a, b) => b.count - a.count).map((b) => hex(b.sum.map((v) => v / b.count) as RGB));
  if (!colors.length) return FALLBACK_PALETTE;
  return { dominant: colors[0], secondary: colors[1] ?? mix(colors[0], "#101923", .4), accent: colors[2] ?? mix(colors[0], "#b7d7c3", .45) };
}
export function musicalTokens(palette: AlbumPalette, preset: DesignPreset, strength: "off" | "subtle" | "normal" | "immersive", immersive = false) {
  const amount = strength === "off" ? 0 : strength === "subtle" ? .12 : strength === "normal" ? .3 : .5;
  const base = immersive ? "#121918" : preset.colors.surface;
  const background = mix(base, palette.dominant, immersive ? amount * .6 : amount * preset.artworkInfluence);
  const text = readable(immersive || preset.dark ? "#f3f6fa" : preset.colors.text, background);
  const muted = readable(immersive || preset.dark ? "#b5c3bd" : preset.colors.muted, background);
  const accent = readable(mix(preset.colors.accent, palette.accent, strength === "off" ? 0 : .45), background);
  return { "--music-surface": background, "--music-text": text, "--music-muted": muted, "--music-accent": accent, "--color-on-accent": readable("#ffffff", accent),
    "--music-halo": strength === "off" ? background : mix(background, palette.secondary, immersive ? .36 : .15),
    // Opaque text surfaces keep contrast independent of artwork luminance.
    "--music-contrast": String(contrast(text, background)) };
}
