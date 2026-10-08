"use client";

import clsx from "clsx";
import { CalendarDays, CalendarSearch, Ellipsis, Music2, Plus, Settings, ShoppingCart, Sparkles, Sun, Timer as TimerIcon, Wand2 } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { useApp } from "@/components/app/AppProvider";
import { features } from "@/lib/features";
import type { PanelId } from "./Panels";

function Badge({ n }: { n: number }) {
  if (!n) return null;
  return (
    <span className="tabular absolute -top-0.5 -right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[11px] font-bold text-white dark:text-black">
      {n}
    </span>
  );
}

function ToolButton({ active, onClick, label, children, badge = 0 }: { active?: boolean; onClick(): void; label: string; children: ReactNode; badge?: number }) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={clsx(
        "relative flex h-11 w-11 items-center justify-center rounded-full transition active:scale-95",
        active ? "bg-accent-soft text-accent" : "hover:bg-surface-2",
      )}
    >
      {children}
      <Badge n={badge} />
    </button>
  );
}

/** Tablet / desktop: compact toolbar next to the quick-add field. */
export function DesktopTools({ panel, onPanel, onAvailability }: { panel: PanelId | null; onPanel(p: PanelId | null): void; onAvailability(): void }) {
  const { timers, shopping } = useApp();
  const runningTimers = timers.filter((t) => t.status === "running" || t.status === "paused").length;
  const toBuy = shopping.filter((s) => !s.checked).length;
  const toggle = (p: PanelId) => onPanel(panel === p ? null : p);
  return (
    <div className="flex shrink-0 items-center gap-0.5 rounded-full border border-border bg-surface p-1 shadow-card">
      {features.spotify && (
        <ToolButton active={panel === "music"} onClick={() => toggle("music")} label="Musique">
          <Music2 size={20} />
        </ToolButton>
      )}
      {features.timers && (
        <ToolButton active={panel === "timers"} onClick={() => toggle("timers")} label="Minuteurs" badge={runningTimers}>
          <TimerIcon size={20} />
        </ToolButton>
      )}
      {features.shopping && (
        <ToolButton active={panel === "shopping"} onClick={() => toggle("shopping")} label="Courses" badge={toBuy}>
          <ShoppingCart size={20} />
        </ToolButton>
      )}
      {features.scenes && (
        <ToolButton active={panel === "scenes"} onClick={() => toggle("scenes")} label="Scènes">
          <Wand2 size={20} />
        </ToolButton>
      )}
      <ToolButton onClick={onAvailability} label="Trouver un créneau libre">
        <CalendarSearch size={20} />
      </ToolButton>
    </div>
  );
}

export type MobileTab = "today" | "calendar";

/** Phone: bottom navigation (max two taps to any main feature). */
export function BottomNav({
  tab,
  panel,
  onTab,
  onAdd,
  onPanel,
}: {
  tab: MobileTab;
  panel: PanelId | null;
  onTab(t: MobileTab): void;
  onAdd(): void;
  onPanel(p: PanelId | null): void;
}) {
  const { timers, shopping } = useApp();
  const badge = timers.filter((t) => t.status === "running").length + shopping.filter((s) => !s.checked).length;
  const item = (active: boolean, label: string, icon: ReactNode, onClick: () => void, extra?: ReactNode) => (
    <button
      onClick={onClick}
      className={clsx("relative flex min-w-0 flex-1 flex-col items-center gap-0.5 py-1.5 text-[11px] font-medium", active ? "text-accent" : "text-muted")}
    >
      {icon}
      <span className="truncate">{label}</span>
      {extra}
    </button>
  );
  return (
    <nav className="safe-bottom flex shrink-0 items-end border-t border-border bg-bg/95 px-2 pt-1 backdrop-blur md:hidden">
      {item(tab === "today" && !panel, "Aujourd'hui", <Sun size={22} />, () => {
        onPanel(null);
        onTab("today");
      })}
      {item(tab === "calendar" && !panel, "Calendrier", <CalendarDays size={22} />, () => {
        onPanel(null);
        onTab("calendar");
      })}
      <div className="flex flex-1 justify-center">
        <button
          onClick={onAdd}
          className="-mt-5 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-white shadow-pop transition active:scale-95 dark:text-black"
          aria-label="Ajouter ou demander"
        >
          <Plus size={28} />
        </button>
      </div>
      {features.spotify
        ? item(panel === "music", "Musique", <Music2 size={22} />, () => onPanel(panel === "music" ? null : "music"))
        : item(false, "Assistant", <Sparkles size={22} />, onAdd)}
      {item(panel === "more", "Plus", <Ellipsis size={22} />, () => onPanel(panel === "more" ? null : "more"), badge ? <span className="absolute top-1 right-[30%] h-2 w-2 rounded-full bg-accent" /> : null)}
    </nav>
  );
}

/** "Plus" menu content (phone). */
export function MoreMenu({ onPanel, onAvailability }: { onPanel(p: PanelId): void; onAvailability(): void }) {
  const { timers, shopping } = useApp();
  const rows: { show: boolean; icon: ReactNode; label: string; hint?: string; onClick?: () => void; href?: string }[] = [
    {
      show: features.timers,
      icon: <TimerIcon size={22} />,
      label: "Minuteurs",
      hint: `${timers.filter((t) => t.status === "running").length || "Aucun"} en cours`,
      onClick: () => onPanel("timers"),
    },
    {
      show: features.shopping,
      icon: <ShoppingCart size={22} />,
      label: "Courses",
      hint: `${shopping.filter((s) => !s.checked).length} article(s)`,
      onClick: () => onPanel("shopping"),
    },
    { show: features.scenes, icon: <Wand2 size={22} />, label: "Scènes", hint: "Matin, Cuisine, Soir…", onClick: () => onPanel("scenes") },
    { show: true, icon: <CalendarSearch size={22} />, label: "Trouver un créneau libre", onClick: onAvailability },
    { show: true, icon: <Settings size={22} />, label: "Réglages", href: "/settings" },
  ];
  return (
    <div className="space-y-1 p-3">
      {rows
        .filter((r) => r.show)
        .map((r) => {
          const inner = (
            <>
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-surface-2">{r.icon}</span>
              <span className="min-w-0 flex-1 text-left">
                <span className="block font-medium">{r.label}</span>
                {r.hint && <span className="block text-sm text-muted">{r.hint}</span>}
              </span>
            </>
          );
          return r.href ? (
            <Link key={r.label} href={r.href} className="flex items-center gap-3 rounded-2xl p-2 hover:bg-surface-2">
              {inner}
            </Link>
          ) : (
            <button key={r.label} onClick={r.onClick} className="flex w-full items-center gap-3 rounded-2xl p-2 hover:bg-surface-2">
              {inner}
            </button>
          );
        })}
    </div>
  );
}
