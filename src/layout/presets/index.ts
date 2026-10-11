import { DEFAULT_HOME_LAYOUT, type HomeWidget, type HomeWidgetId } from "../widgetRegistry";
export type LayoutPresetId = "minimal" | "home" | "kitchen" | "calendar" | "family" | "custom";
export const LAYOUT_PRESETS: { id: Exclude<LayoutPresetId, "custom">; name: string; description: string; ids: HomeWidgetId[] }[] = [
  { id: "minimal", name: "Minimal", description: "L’essentiel, en un regard.", ids: ["clock", "weather", "next", "departure"] },
  { id: "home", name: "Maison", description: "Le rythme de la maison.", ids: ["house", "shopping", "timers", "music", "assistant"] },
  { id: "kitchen", name: "Cuisine", description: "Musique, minuteurs et courses.", ids: ["music", "timers", "shopping", "assistant", "next"] },
  { id: "calendar", name: "Calendrier", description: "Votre programme au premier plan.", ids: ["calendar", "next", "availability", "departure"] },
  { id: "family", name: "Famille", description: "Les moments de chacun.", ids: ["calendar", "profiles", "shopping", "availability", "house"] },
];
export function layoutPreset(id: LayoutPresetId): HomeWidget[] {
  const preset = LAYOUT_PRESETS.find((p) => p.id === id) ?? LAYOUT_PRESETS[1];
  return [...preset.ids, ...DEFAULT_HOME_LAYOUT.map((w) => w.id).filter((w) => !preset.ids.includes(w))].map((widgetId) => ({
    ...DEFAULT_HOME_LAYOUT.find((w) => w.id === widgetId)!, visible: preset.ids.includes(widgetId),
    size: widgetId === "calendar" || (id === "kitchen" && widgetId === "timers") ? "large" : "standard",
    width: widgetId === "calendar" ? "full" : widgetId === "next" || (id === "kitchen" && widgetId === "music") ? 2 : 1,
  }));
}
