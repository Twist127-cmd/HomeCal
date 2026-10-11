"use client";

import { useEffect } from "react";
import { useApp } from "./AppProvider";
import { dayPeriod } from "@/lib/appearance";
import { inTimeWindow } from "@/lib/dates";
import { useDesign } from "@/theme/ThemeProvider";

/** A single appearance clock, including settings and full-screen scenes. */
export function Appearance() {
  const { household } = useApp();
  const { preset } = useDesign();
  const enabled = household?.settings.nightMode.enabled ?? false;
  const start = household?.settings.nightMode.start ?? "22:30";
  const end = household?.settings.nightMode.end ?? "06:30";
  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => {
      const now = new Date();
      root.dataset.period = dayPeriod(now.getHours());
      const night = enabled && inTimeWindow(now, start, end);
      root.classList.toggle("night", night);
      let theme = "auto";
      try { theme = localStorage.getItem("homecal.theme") ?? "auto"; } catch { /* storage unavailable */ }
      root.classList.toggle("dark", night || preset.dark || theme === "dark" || (theme === "auto" && media.matches));
    };
    sync();
    const clock = window.setInterval(sync, 60_000);
    media.addEventListener("change", sync);
    window.addEventListener("storage", sync);
    window.addEventListener("homecal:appearance", sync);
    return () => {
      clearInterval(clock);
      media.removeEventListener("change", sync);
      window.removeEventListener("storage", sync);
      window.removeEventListener("homecal:appearance", sync);
    };
  }, [enabled, start, end, preset.dark]);
  return null;
}
