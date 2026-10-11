import { features } from "@/lib/features";
export type HomeWidgetId = "clock" | "weather" | "next" | "departure" | "calendar" | "profiles" | "availability" | "music" | "timers" | "shopping" | "house" | "assistant";
export type WidgetSize = "compact" | "standard" | "large";
export type WidgetWidth = 1 | 2 | "full";
export interface HomeWidget { id: HomeWidgetId; visible: boolean; size: WidgetSize; width: WidgetWidth }
export const WIDGET_REGISTRY: Record<HomeWidgetId, { label: string; sizes: WidgetSize[]; enabled: () => boolean }> = {
  clock: { label: "Heure", sizes: ["compact", "standard", "large"], enabled: () => true },
  weather: { label: "Météo", sizes: ["compact", "standard", "large"], enabled: () => true },
  next: { label: "Prochain événement", sizes: ["compact", "standard", "large"], enabled: () => true },
  departure: { label: "Départ conseillé", sizes: ["compact", "standard"], enabled: () => true },
  calendar: { label: "Agenda", sizes: ["compact", "standard", "large"], enabled: () => true },
  profiles: { label: "Profils", sizes: ["compact", "standard"], enabled: () => true },
  availability: { label: "Disponibilités", sizes: ["standard"], enabled: () => true },
  music: { label: "Musique", sizes: ["compact", "standard", "large"], enabled: () => features.spotify },
  timers: { label: "Minuteurs", sizes: ["compact", "standard", "large"], enabled: () => features.timers },
  shopping: { label: "Courses", sizes: ["compact", "standard", "large"], enabled: () => features.shopping },
  house: { label: "Maison", sizes: ["compact", "standard"], enabled: () => features.scenes },
  assistant: { label: "Votre assistant", sizes: ["compact", "standard"], enabled: () => true },
};
export const WIDGET_IDS = Object.keys(WIDGET_REGISTRY) as HomeWidgetId[];
export const DEFAULT_HOME_LAYOUT: HomeWidget[] = WIDGET_IDS.map((id) => ({ id, visible: ["clock", "weather", "next", "assistant", "music", "timers", "shopping"].includes(id), size: "standard", width: id === "next" ? 2 : 1 }));
export function parseHomeLayout(raw: string | null): HomeWidget[] {
  try {
    const value = JSON.parse(raw ?? "null");
    const input = Array.isArray(value) ? value : value?.widgets;
    if (!Array.isArray(input)) return DEFAULT_HOME_LAYOUT;
    const seen = new Set<HomeWidgetId>();
    const valid: HomeWidget[] = [];
    for (const item of input) {
      const base = DEFAULT_HOME_LAYOUT.find((w) => w.id === item?.id);
      if (!base || seen.has(base.id)) continue;
      seen.add(base.id);
      valid.push({ id: base.id, visible: typeof item.visible === "boolean" ? item.visible : base.visible,
        size: WIDGET_REGISTRY[base.id].sizes.includes(item.size) ? item.size : base.size,
        width: [1, 2, "full"].includes(item.width) ? item.width : base.width });
    }
    return [...valid, ...DEFAULT_HOME_LAYOUT.filter((w) => !seen.has(w.id))];
  } catch { return DEFAULT_HOME_LAYOUT; }
}
export function reorderWidget(layout: HomeWidget[], id: HomeWidgetId, target: HomeWidgetId): HomeWidget[] {
  const from = layout.findIndex((w) => w.id === id), to = layout.findIndex((w) => w.id === target);
  if (from < 0 || to < 0 || from === to) return layout;
  const result = [...layout]; result.splice(to, 0, ...result.splice(from, 1)); return result;
}
