"use client";
import { useEffect } from "react";
import { useMusic } from "./MusicContext";
import { useDesign } from "@/theme/ThemeProvider";
import { useAlbumPalette } from "@/theme/useAlbumPalette";

/** Shares the immersive player's lightweight palette with the whole application. */
export function SpotifyAppearance() {
  const { playback } = useMusic();
  const { preset, setSpotifyArtwork } = useDesign();
  const active = preset.id === "spotify";
  const image = active ? playback?.item?.image : undefined;
  const palette = useAlbumPalette(image);
  useEffect(() => {
    setSpotifyArtwork(active ? { palette, image } : null);
  }, [active, palette, image, setSpotifyArtwork]);
  return null;
}
