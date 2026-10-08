"use client";

import clsx from "clsx";
import { X } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { Button } from "@/components/ui/primitives";

export type PanelId = "music" | "timers" | "shopping" | "scenes" | "more";

/**
 * Feature panel: docked in the right column on wide screens, full-height drawer on
 * tablets, full-screen sheet on phones.
 */
export function SidePanel({
  title,
  icon,
  onClose,
  docked,
  children,
  actions,
}: {
  title: string;
  icon?: ReactNode;
  onClose(): void;
  docked?: boolean;
  children: ReactNode;
  actions?: ReactNode;
}) {
  useEffect(() => {
    if (docked) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [docked, onClose]);

  const header = (
    <header className={clsx("flex items-center gap-2 border-b border-border px-4 pb-3", docked ? "pt-3" : "safe-top")}>
      {icon && <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-soft text-accent">{icon}</span>}
      <h2 className="min-w-0 flex-1 truncate text-lg font-semibold">{title}</h2>
      {actions}
      <Button variant="ghost" size="icon" onClick={onClose} aria-label="Fermer">
        <X size={20} />
      </Button>
    </header>
  );

  if (docked)
    return (
      <aside className="flex min-h-0 w-[380px] shrink-0 animate-fade-in flex-col overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface shadow-card">
        {header}
        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">{children}</div>
      </aside>
    );

  return (
    <div className="fixed inset-0 z-[55] flex justify-end">
      <div className="absolute inset-0 animate-fade-in bg-black/30" onClick={onClose} />
      <aside className="relative flex h-full w-full max-w-md animate-slide-left flex-col bg-surface shadow-pop">
        {header}
        <div className="scroll-thin safe-bottom min-h-0 flex-1 overflow-y-auto">{children}</div>
      </aside>
    </div>
  );
}
