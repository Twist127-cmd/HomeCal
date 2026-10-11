"use client";
import { createContext, useContext, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { SpotifyAppearance } from "./SpotifyAppearance";
const MusicImmersive = dynamic(() => import("./MusicImmersive"), { ssr: false });
const Context = createContext({ openImmersive: () => {} });
export const useMusicPresentation = () => useContext(Context);
export function MusicPresentation({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return <Context.Provider value={{ openImmersive: () => setOpen(true) }}><SpotifyAppearance />{children}{open && <MusicImmersive onClose={() => setOpen(false)} />}</Context.Provider>;
}
