"use client";
import { useSyncExternalStore } from "react";
import { extractPalette, FALLBACK_PALETTE, type AlbumPalette } from "./albumPalette";
const cache = new Map<string, AlbumPalette>();
const pending = new Set<string>();
const listeners = new Set<() => void>();
function request(url: string) {
  if (cache.has(url) || pending.has(url)) return;
  pending.add(url);
  const image = new Image(); image.crossOrigin = "anonymous"; image.decoding = "async";
  const finish = (palette: AlbumPalette) => {
    pending.delete(url); cache.set(url, palette);
    if (cache.size > 64) cache.delete(cache.keys().next().value!);
    listeners.forEach((listener) => listener());
  };
  image.onload = () => {
    try {
      const canvas = document.createElement("canvas"); canvas.width = canvas.height = 32;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) return finish(FALLBACK_PALETTE);
      context.drawImage(image, 0, 0, 32, 32);
      finish(extractPalette(context.getImageData(0, 0, 32, 32).data));
    } catch { finish(FALLBACK_PALETTE); }
  };
  image.onerror = () => finish(FALLBACK_PALETTE); image.src = url;
}
export function useAlbumPalette(url?: string) {
  return useSyncExternalStore((listener) => {
    listeners.add(listener); if (url) request(url);
    return () => { listeners.delete(listener); };
  }, () => url ? cache.get(url) ?? FALLBACK_PALETTE : FALLBACK_PALETTE, () => FALLBACK_PALETTE);
}
