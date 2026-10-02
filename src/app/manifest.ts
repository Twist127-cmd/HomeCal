import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "HomeCal – Calendrier familial",
    short_name: "HomeCal",
    description: "Le calendrier familial tactile et intelligent",
    start_url: "/",
    scope: "/",
    display: "standalone",
    display_override: ["fullscreen", "standalone"],
    orientation: "any",
    background_color: "#0b0c0f",
    theme_color: "#0b0c0f",
    lang: "fr",
    categories: ["productivity", "lifestyle"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
