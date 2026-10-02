"use client";

import clsx from "clsx";
import { useSyncExternalStore } from "react";

export interface Toast {
  id: number;
  text: string;
  tone?: "default" | "error" | "success" | "reminder";
  action?: { label: string; run(): void | Promise<void> };
  durationMs?: number;
}

let toasts: Toast[] = [];
let seq = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function toast(t: Omit<Toast, "id">): number {
  const id = ++seq;
  toasts = [...toasts.slice(-3), { ...t, id }];
  emit();
  const ms = t.durationMs ?? (t.action ? 8000 : 4000);
  if (ms > 0) setTimeout(() => dismiss(id), ms);
  return id;
}

export function dismiss(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function Toaster() {
  const list = useSyncExternalStore(
    subscribe,
    () => toasts,
    () => toasts,
  );
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex flex-col items-center gap-2 px-4 sm:bottom-6">
      {list.map((t) => (
        <div
          key={t.id}
          className={clsx(
            "pointer-events-auto flex max-w-lg animate-slide-up items-center gap-3 rounded-2xl px-4 py-3 text-[15px] shadow-pop",
            t.tone === "error" ? "bg-danger text-white" : t.tone === "reminder" ? "bg-accent text-white dark:text-black" : "bg-text text-bg",
          )}
        >
          <span className="flex-1">{t.text}</span>
          {t.action && (
            <button
              className="rounded-full bg-white/15 px-3 py-1.5 text-sm font-semibold hover:bg-white/25"
              onClick={async () => {
                dismiss(t.id);
                await t.action!.run();
              }}
            >
              {t.action.label}
            </button>
          )}
          <button className="text-lg leading-none opacity-60 hover:opacity-100" onClick={() => dismiss(t.id)} aria-label="Fermer">
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
