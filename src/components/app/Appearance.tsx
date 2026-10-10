"use client";

import { useEffect } from "react";
import { dayPeriod } from "@/lib/appearance";

/** One lightweight clock and media listener for every screen, including settings. */
export function Appearance() {
  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => {
      root.dataset.period = dayPeriod(new Date().getHours());
      if (root.classList.contains("night")) return;
      let theme = "auto";
      try { theme = localStorage.getItem("homecal.theme") ?? "auto"; } catch { /* storage unavailable */ }
      root.classList.toggle("dark", theme === "dark" || (theme === "auto" && media.matches));
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
  }, []);
  return null;
}
