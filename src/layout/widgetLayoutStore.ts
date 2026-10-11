"use client";
import { useCallback, useMemo } from "react";
import { useApp } from "@/components/app/AppProvider";
import { useLocalValue } from "@/theme/storage";
import { DEFAULT_HOME_LAYOUT, parseHomeLayout, type HomeWidget } from "./widgetRegistry";
import { LAYOUT_PRESETS, layoutPreset, type LayoutPresetId } from "./presets";
export const HOME_LAYOUT_KEY = "homecal.home-layout.v1";
export interface WidgetLayout { version: 2; preset: LayoutPresetId; widgets: HomeWidget[] }
export function parseWidgetLayout(raw: string): WidgetLayout {
  let preset: LayoutPresetId = "custom";
  try { const p = JSON.parse(raw)?.preset; if (p === "custom" || LAYOUT_PRESETS.some((x) => x.id === p)) preset = p; } catch { /* default */ }
  return { version: 2, preset, widgets: parseHomeLayout(raw) };
}
export function useWidgetLayout() {
  const { householdId } = useApp();
  const [raw, persist] = useLocalValue(HOME_LAYOUT_KEY + "." + (householdId ?? "guest"), JSON.stringify({ version: 2, preset: "custom", widgets: DEFAULT_HOME_LAYOUT }));
  const layout = useMemo(() => parseWidgetLayout(raw), [raw]);
  const save = useCallback((widgets: HomeWidget[], preset: LayoutPresetId = "custom") => persist(JSON.stringify({ version: 2, preset, widgets: parseHomeLayout(JSON.stringify(widgets)) })), [persist]);
  const apply = useCallback((id: LayoutPresetId) => save(layoutPreset(id), id), [save]);
  const reset = useCallback(() => save(DEFAULT_HOME_LAYOUT, "custom"), [save]);
  return { layout, save, apply, reset };
}
