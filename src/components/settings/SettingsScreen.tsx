"use client";

import clsx from "clsx";
import { ArrowLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/components/app/AppProvider";
import { Toaster } from "@/components/ui/toast";
import { visibleSections, type SettingsSectionDef } from "./sections";

/**
 * Settings, Windows-like: categories on the left, the active category on the right
 * (tablet / desktop, ≥ md). On phones: the category list first, then the section with a
 * back button. The active section lives in the URL hash (#voix) so it survives a refresh.
 */

const readHash = () => (typeof window === "undefined" ? "" : decodeURIComponent(window.location.hash.slice(1)));

export function SettingsScreen() {
  const { household, householdId } = useApp();
  const sections = visibleSections();
  const [hash, setHash] = useState(readHash);

  useEffect(() => {
    const onHash = () => setHash(readHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const open = useCallback((id: string) => {
    // replaceState: switching categories must not pile up history entries nor reload anything
    window.history.replaceState(null, "", id ? `#${id}` : window.location.pathname);
    setHash(id);
  }, []);

  if (!household || !householdId) return null;
  const selected = sections.find((s) => s.id === hash) ?? null;
  // desktop always shows a section (the first one by default)
  const active = selected ?? sections[0];

  return (
    <div className="safe-top flex h-full flex-col">
      <header className="mx-auto flex w-full max-w-6xl shrink-0 items-center gap-3 px-4 pb-4">
        {/* phone, inside a section: back to the category list */}
        {selected ? (
          <button onClick={() => open("")} className="inline-flex h-11 w-11 items-center justify-center rounded-full hover:bg-surface-2 md:hidden" aria-label="Retour aux réglages">
            <ArrowLeft size={22} />
          </button>
        ) : null}
        <Link
          href="/"
          className={clsx("h-11 w-11 items-center justify-center rounded-full hover:bg-surface-2", selected ? "hidden md:inline-flex" : "inline-flex")}
          aria-label="Retour"
        >
          <ArrowLeft size={22} />
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">
          <span className={clsx(selected && "hidden md:inline")}>Réglages</span>
          {selected && <span className="md:hidden">{selected.title}</span>}
        </h1>
      </header>

      <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 gap-6 px-4">
        {/* ---- sidebar (tablet / desktop) ---- */}
        <nav aria-label="Catégories de réglages" className="scroll-thin hidden w-60 shrink-0 overflow-y-auto pb-6 md:block lg:w-64">
          <ul className="space-y-1">
            {sections.map((s) => (
              <li key={s.id}>
                <SidebarItem section={s} active={s.id === active.id} onClick={() => open(s.id)} />
              </li>
            ))}
          </ul>
        </nav>

        {/* ---- phone: category list ---- */}
        {!selected && (
          <nav aria-label="Catégories de réglages" className="scroll-thin min-w-0 flex-1 overflow-y-auto pb-6 md:hidden">
            <ul className="divide-y divide-border overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface shadow-card">
              {sections.map((s) => (
                <li key={s.id}>
                  <button onClick={() => open(s.id)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left active:bg-surface-2">
                    <s.icon size={20} className="shrink-0 text-muted" />
                    <span className="flex-1 font-medium">{s.title}</span>
                    <ChevronRight size={18} className="text-muted" />
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        )}

        {/* ---- active section ---- */}
        <main className={clsx("scroll-thin min-w-0 flex-1 overflow-y-auto pb-6 sm:pb-10", !selected && "hidden md:block")}>
          <div className="mx-auto max-w-3xl">
            <active.Component key={active.id} />
          </div>
        </main>
      </div>
      <Toaster />
    </div>
  );
}

function SidebarItem({ section, active, onClick }: { section: SettingsSectionDef; active: boolean; onClick(): void }) {
  const Icon = section.icon;
  return (
    <button
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={clsx(
        "flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-[15px] transition",
        active ? "bg-accent-soft font-medium text-accent" : "text-text hover:bg-surface-2",
      )}
    >
      <Icon size={18} className={clsx("shrink-0", active ? "text-accent" : "text-muted")} />
      <span className="truncate">{section.title}</span>
    </button>
  );
}
