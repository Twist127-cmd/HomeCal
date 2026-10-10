/** Presentation only: no household or provider data is changed. */
export type DayPeriod = "morning" | "day" | "evening" | "night";
export function dayPeriod(hour: number): DayPeriod {
  return hour < 6 || hour >= 23 ? "night" : hour < 11 ? "morning" : hour < 18 ? "day" : "evening";
}
export function greeting(hour: number): string {
  return hour < 6 || hour >= 23 ? "Bonne nuit." : hour < 12 ? "Bonjour." : hour < 18 ? "Bon après-midi." : "Bonne soirée.";
}

export type HomeWidgetId = "next" | "music" | "assistant" | "shopping" | "timers" | "house";
export type WidgetSize = "compact" | "standard" | "large";
export interface HomeWidget { id: HomeWidgetId; visible: boolean; size: WidgetSize }
export const HOME_LAYOUT_KEY = "homecal.home-layout.v1";
export const DEFAULT_HOME_LAYOUT: HomeWidget[] = [
  { id: "next", visible: true, size: "standard" },
  { id: "assistant", visible: true, size: "standard" },
  { id: "music", visible: true, size: "standard" },
  { id: "timers", visible: true, size: "standard" },
  { id: "shopping", visible: true, size: "standard" },
  { id: "house", visible: false, size: "standard" },
];
export function parseHomeLayout(raw: string | null): HomeWidget[] {
  try {
    const input: unknown = JSON.parse(raw ?? "null");
    if (!Array.isArray(input)) return DEFAULT_HOME_LAYOUT;
    const seen = new Set<string>();
    const valid: HomeWidget[] = [];
    for (const item of input) {
      if (!item || typeof item !== "object") continue;
      const base = DEFAULT_HOME_LAYOUT.find((w) => w.id === item.id);
      if (!base || seen.has(base.id)) continue;
      seen.add(base.id);
      valid.push({
        id: base.id,
        visible: typeof item.visible === "boolean" ? item.visible : base.visible,
        size: base.id === "music" && ["compact", "standard", "large"].includes(item.size) ? item.size : "standard",
      });
    }
    return [...valid, ...DEFAULT_HOME_LAYOUT.filter((w) => !seen.has(w.id))];
  } catch { return DEFAULT_HOME_LAYOUT; }
}
export function reorderWidget(layout: HomeWidget[], id: HomeWidgetId, target: HomeWidgetId): HomeWidget[] {
  const from = layout.findIndex((w) => w.id === id);
  const to = layout.findIndex((w) => w.id === target);
  if (from < 0 || to < 0 || from === to) return layout;
  const result = [...layout];
  result.splice(to, 0, ...result.splice(from, 1));
  return result;
}
