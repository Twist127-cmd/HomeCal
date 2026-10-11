export type RGB = [number, number, number];
export const rgb = (hex: string): RGB => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as RGB;
export const hex = (values: RGB) => "#" + values.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");
export function mix(a: string, b: string, amount: number): string {
  const x = rgb(a), y = rgb(b);
  return hex(x.map((v, i) => v * (1 - amount) + y[i] * amount) as RGB);
}
export function luminance(color: string): number {
  const v = rgb(color).map((n) => { const s = n / 255; return s <= .04045 ? s / 12.92 : ((s + .055) / 1.055) ** 2.4; });
  return .2126 * v[0] + .7152 * v[1] + .0722 * v[2];
}
export function contrast(a: string, b: string): number {
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
}
export function readable(color: string, background: string): string {
  const end = contrast("#000000", background) > contrast("#ffffff", background) ? "#000000" : "#ffffff";
  for (let i = 0; i <= 20; i++) { const c = mix(color, end, i / 20); if (contrast(c, background) >= 4.5) return c; }
  return end;
}

export interface ColorTokens { background: string; surface: string; text: string; muted: string; accent: string; secondary: string }
export interface DesignPreset {
  id: string; name: string; category: "classic" | "seasonal" | "extravagant"; dark: boolean;
  colors: ColorTokens; blur: number; radius: number; shadow: number; glass: number;
  typography: { tracking: string }; motion: { duration: number }; ambient: { landscape: boolean };
  artworkInfluence: number;
}
export function presetTokens(preset: DesignPreset, dark: boolean, night = false): Record<string, string> {
  const c = preset.colors;
  const effectiveDark = preset.dark || dark || night;
  const background = night ? mix(c.background, "#0b1016", .93) : effectiveDark && !preset.dark ? mix(c.accent, "#11161d", .93) : c.background;
  const surface = effectiveDark && !preset.dark ? mix(c.accent, "#22262c", .93) : c.surface;
  const text = effectiveDark ? "#f3f6fa" : c.text;
  const muted = readable(effectiveDark ? "#afbac7" : c.muted, surface);
  const accent = readable(c.accent, surface);
  return {
    "--color-bg": background, "--color-surface": surface,
    "--color-surface-2": mix(surface, accent, .08), "--color-surface-3": mix(surface, accent, .16),
    "--color-text": text, "--color-muted": muted, "--color-accent": accent,
    "--color-on-accent": readable("#ffffff", accent),
    "--color-accent-soft": mix(surface, accent, .1), "--color-border": mix(surface, muted, .3),
    "--color-danger": readable(effectiveDark ? "#ffaaa3" : "#b73936", surface),
    "--color-warn": readable(effectiveDark ? "#f7cc8b" : "#95530b", surface),
    "--color-ok": readable(effectiveDark ? "#a1d4b1" : "#356648", surface),
    "--glass": `color-mix(in srgb, ${surface} ${Math.round(preset.glass * 100)}%, transparent)`,
    "--glass-border": `color-mix(in srgb, ${muted} 22%, transparent)`,
    "--scene-light": mix(background, c.accent, .12), "--scene-sky": mix(background, c.secondary, .15), "--scene-ground": background,
    "--radius-card": preset.radius + "rem", "--preset-blur": preset.blur + "px",
    "--preset-secondary": c.secondary, "--preset-motion": preset.motion.duration + "ms",
    "--preset-tracking": preset.typography.tracking,
    "--widget-glow": `0 0 ${preset.shadow * 2}px -12px color-mix(in srgb, ${c.secondary} 25%, transparent)`,
    "--shadow-card": `0 8px ${preset.shadow}px -20px ${effectiveDark ? "#00000070" : "#26303a30"}`,
    "--shadow-pop": `0 20px 64px -24px ${effectiveDark ? "#00000090" : "#26303a50"}`,
    "--artwork-influence": String(preset.artworkInfluence),
    "--ambient-landscape": preset.ambient.landscape ? 'url("/ambience/lake.svg")' : "none",
  };
}
