"use client";
import { useMemo, useSyncExternalStore } from "react";
import { useDesign } from "./ThemeProvider";
import { presetTokens } from "./tokens";
function subscribe(listener: () => void) { const observer = new MutationObserver(listener); observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] }); return () => observer.disconnect(); }
export function useEffectivePreset() {
  const { preset } = useDesign();
  const dark = useSyncExternalStore(subscribe, () => document.documentElement.classList.contains("dark"), () => preset.dark);
  const night = useSyncExternalStore(subscribe, () => document.documentElement.classList.contains("night"), () => false);
  return useMemo(() => {
    const colors = presetTokens(preset, dark, night);
    return { ...preset, dark: preset.dark || dark || night, colors: { ...preset.colors, background: colors["--color-bg"], surface: colors["--color-surface"], text: colors["--color-text"], muted: colors["--color-muted"], accent: colors["--color-accent"] } };
  }, [preset, dark, night]);
}
