/** Presentation only: no household or provider data is changed. */
export type DayPeriod = "morning" | "day" | "evening" | "night";
export function dayPeriod(hour: number): DayPeriod {
  return hour < 6 || hour >= 23 ? "night" : hour < 11 ? "morning" : hour < 18 ? "day" : "evening";
}
export function greeting(hour: number): string {
  return hour < 6 || hour >= 23 ? "Bonne nuit." : hour < 12 ? "Bonjour." : hour < 18 ? "Bon après-midi." : "Bonne soirée.";
}

export { DEFAULT_HOME_LAYOUT, parseHomeLayout, reorderWidget } from "@/layout/widgetRegistry";
export type { HomeWidget, HomeWidgetId, WidgetSize } from "@/layout/widgetRegistry";
export const HOME_LAYOUT_KEY = "homecal.home-layout.v1";