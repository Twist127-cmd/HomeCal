import type { DesignPreset } from "../tokens";
const make = (id: string, name: string, category: DesignPreset["category"], background: string, surface: string, accent: string, secondary: string, options: Partial<DesignPreset> = {}): DesignPreset => ({
  id, name, category, dark: false,
  colors: { background, surface, text: "#252a30", muted: "#59616b", accent, secondary },
  blur: 8, radius: 1.25, shadow: 36, glass: .94,
  typography: { tracking: "-.025em" }, motion: { duration: 350 }, ambient: { landscape: false }, artworkInfluence: .25,
  ...options,
});
export const DESIGN_PRESETS: DesignPreset[] = [
  make("sober", "Sobre", "classic", "#f0f1f2", "#ffffff", "#454b52", "#a4aeb8", { blur: 0, radius: .9, motion: { duration: 120 } }),
  make("warm", "Warm", "classic", "#f4eee5", "#fffaf3", "#89581f", "#b68a72", { ambient: { landscape: true } }),
  make("night", "Nuit", "classic", "#10151a", "#1b232b", "#c2aa87", "#6d8199", { dark: true, blur: 2, glass: .98 }),
  make("light-premium", "Light Premium", "classic", "#f4f6f8", "#ffffff", "#47647f", "#b4c9db", { radius: 1.5, shadow: 28 }),
  make("summer", "Été", "seasonal", "#f5f0e3", "#fffdf5", "#33728d", "#dfbf6e", { radius: 1.6 }),
  make("winter", "Hiver", "seasonal", "#e9f0f6", "#f8fcff", "#416d91", "#b7c6d9", { blur: 12, glass: .9 }),
  make("autumn", "Automne", "seasonal", "#f1e5d8", "#fff6eb", "#91462c", "#bc904b", { ambient: { landscape: true } }),
  make("spring", "Printemps", "seasonal", "#edf1e7", "#fafdf5", "#52694b", "#c6a4b8", { radius: 1.6 }),
  make("neon-tokyo", "Neon Tokyo", "extravagant", "#0d1221", "#192236", "#55d9e5", "#e393db", { dark: true, radius: 1, shadow: 42, glass: .93, motion: { duration: 240 } }),
  make("cyber-glass", "Cyber Glass", "extravagant", "#151f30", "#243247", "#8ec1ff", "#a4b5d7", { dark: true, blur: 16, glass: .9 }),
  make("sunset-club", "Sunset Club", "extravagant", "#231727", "#362637", "#ffb495", "#c796da", { dark: true, radius: 1.6 }),
  make("aurora", "Aurora", "extravagant", "#10242c", "#1d353d", "#91dac8", "#a9a4e8", { dark: true, blur: 10, motion: { duration: 550 } }),
  make("space", "Space", "extravagant", "#0b1020", "#192037", "#b2baff", "#9277c2", { dark: true, shadow: 44, radius: 1.1 }),
  make("luxury-gold", "Luxury Gold", "extravagant", "#171716", "#252420", "#dbc99d", "#a58d68", { dark: true, blur: 0, glass: 1, radius: .85, artworkInfluence: .1, motion: { duration: 550 } }),
  make("retro-future", "Retro Future", "extravagant", "#eee5cf", "#fff5dd", "#944b2b", "#767944", { radius: 1.8, blur: 0, glass: 1 }),
  make("candy", "Candy", "extravagant", "#f5eaf2", "#fff8fd", "#964d80", "#96b8d8", { radius: 1.8 }),
  make("forest", "Forest", "extravagant", "#15271f", "#23382d", "#b3cf9e", "#b6a084", { dark: true, ambient: { landscape: true }, artworkInfluence: .18 }),
  make("ice", "Ice", "extravagant", "#e8f4f7", "#f7fdff", "#3a7285", "#b0c7e2", { blur: 14, glass: .9, radius: 1.35 }),
];
export const designPreset = (id: string) => DESIGN_PRESETS.find((p) => p.id === id) ?? DESIGN_PRESETS[1];
