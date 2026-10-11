"use client";
import { useCallback, useSyncExternalStore } from "react";
const volatile = new Map<string, string>();
const EVENT = "homecal:customization";
export function readLocal(key: string): string | null {
  if (volatile.has(key)) return volatile.get(key)!;
  try { return typeof window === "undefined" ? null : localStorage.getItem(key); } catch { return null; }
}
export function writeLocal(key: string, value: string): boolean {
  let persisted = true;
  try { localStorage.setItem(key, value); volatile.delete(key); } catch { volatile.set(key, value); persisted = false; }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: key }));
  return persisted;
}
export function useLocalValue(key: string, fallback: string): [string, (value: string) => boolean] {
  const subscribe = useCallback((callback: () => void) => {
    const changed = () => callback();
    window.addEventListener(EVENT, changed); window.addEventListener("storage", changed);
    return () => { window.removeEventListener(EVENT, changed); window.removeEventListener("storage", changed); };
  }, []);
  const value = useSyncExternalStore(subscribe, useCallback(() => readLocal(key) ?? fallback, [key, fallback]), () => fallback);
  const save = useCallback((next: string) => writeLocal(key, next), [key]);
  return [value, save];
}
