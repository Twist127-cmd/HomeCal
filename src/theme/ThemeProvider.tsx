"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useApp } from "@/components/app/AppProvider";
import { DESIGN_PRESETS, designPreset } from "./presets";
import { presetTokens } from "./tokens";
import { useLocalValue } from "./storage";
import { musicalTokens, FALLBACK_PALETTE, type AlbumPalette } from "./albumPalette";
import { mix } from "./tokens";
export type Density = "compact" | "normal" | "comfort";
export type MusicAdaptation = "off" | "subtle" | "normal" | "immersive";
export interface DesignPreferences { version: 1; preset: string; density: Density; musicAdaptation: MusicAdaptation }
export const DEFAULT_DESIGN: DesignPreferences = { version: 1, preset: "warm", density: "normal", musicAdaptation: "subtle" };
export function parseDesign(raw: string): DesignPreferences {
  try {
    const p = JSON.parse(raw);
    return { version: 1, preset: DESIGN_PRESETS.some((x) => x.id === p?.preset) ? p.preset : "warm",
      density: ["compact", "normal", "comfort"].includes(p?.density) ? p.density : "normal",
      musicAdaptation: ["off", "subtle", "normal", "immersive"].includes(p?.musicAdaptation) ? p.musicAdaptation : "subtle" };
  } catch { return DEFAULT_DESIGN; }
}
interface ThemeState {
  preferences: DesignPreferences; preset: ReturnType<typeof designPreset>; preview: string | null;
  previewPreset(id: string | null): void; applyPreset(id: string): void;
  update(patch: Partial<DesignPreferences>): void; reset(): void;
  setSpotifyArtwork(value: { palette: AlbumPalette; image?: string } | null): void;
}
const Context = createContext<ThemeState | null>(null);
export function useDesign() { const value = useContext(Context); if (!value) throw new Error("ThemeProvider required"); return value; }
export function ThemeProvider({ children }: { children: ReactNode }) {
  const { householdId } = useApp();
  const [raw, save] = useLocalValue("homecal.design.v1." + (householdId ?? "guest"), JSON.stringify(DEFAULT_DESIGN));
  const preferences = useMemo(() => parseDesign(raw), [raw]);
  const [preview, previewPreset] = useState<string | null>(null);
  const [spotifyArtwork, setSpotifyArtwork] = useState<{ palette: AlbumPalette; image?: string } | null>(null);
  const preset = useMemo(() => {
    const base = designPreset(preview ?? preferences.preset);
    if (base.id !== "spotify") return base;
    const music = musicalTokens(spotifyArtwork?.palette ?? FALLBACK_PALETTE, base, "immersive", true);
    return { ...base, colors: { ...base.colors, background: music["--music-surface"],
      surface: mix(music["--music-surface"], "#ffffff", .06), text: music["--music-text"],
      muted: music["--music-muted"], accent: music["--music-accent"], secondary: music["--music-halo"] } };
  }, [preview, preferences.preset, spotifyArtwork]);
  const update = useCallback((patch: Partial<DesignPreferences>) => { save(JSON.stringify({ ...preferences, ...patch, version: 1 })); }, [preferences, save]);
  const applyPreset = useCallback((id: string) => { update({ preset: id }); previewPreset(null); }, [update]);
  const reset = useCallback(() => { save(JSON.stringify(DEFAULT_DESIGN)); previewPreset(null); }, [save]);
  useEffect(() => {
    const root = document.documentElement;
    const sync = () => {
      root.dataset.design = preset.id; root.dataset.density = preferences.density;
      root.dataset.designDark = String(preset.dark || root.classList.contains("dark"));
      const tokens = presetTokens(preset, root.classList.contains("dark"), root.classList.contains("night"));
      Object.entries(tokens).forEach(([key, value]) => root.style.setProperty(key, value));
      root.style.setProperty("--spotify-artwork", preset.id === "spotify" && spotifyArtwork?.image ? `url(${JSON.stringify(spotifyArtwork.image)})` : "none");
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, [preset, preferences.density, spotifyArtwork]);
  const value = useMemo(() => ({ preferences, preset, preview, previewPreset, applyPreset, update, reset, setSpotifyArtwork }), [preferences, preset, preview, applyPreset, update, reset]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
