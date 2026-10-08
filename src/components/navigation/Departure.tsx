"use client";

import clsx from "clsx";
import { Navigation } from "lucide-react";
import { useState } from "react";
import { useApp } from "@/components/app/AppProvider";
import { Sheet } from "@/components/ui/primitives";
import { fmtTime } from "@/lib/dates";
import { availableNavApps, navigationUrl, type DepartureStatus } from "@/lib/navigation";
import type { EventLocation, NavigationApp, TravelMode } from "@/lib/types";
import type { NextDeparture } from "@/hooks/useNextDeparture";

const LEVEL_CLASS: Record<DepartureStatus["level"], string> = {
  green: "bg-ok/12 text-ok",
  orange: "bg-warn/15 text-warn",
  red: "bg-danger text-white animate-pulse",
  late: "bg-danger text-white",
};

export function openNavigationUrl(url: string) {
  window.open(url, "_blank", "noopener");
}

/** Opens the preferred navigation app (or asks). */
export function useNavigationLauncher() {
  const { household } = useApp();
  const [pending, setPending] = useState<{ dest: EventLocation; mode: TravelMode } | null>(null);
  const pref: NavigationApp = household?.settings.navigationApp ?? "ask";

  const launch = (dest: EventLocation, mode: TravelMode = "driving") => {
    if (pref === "ask") setPending({ dest, mode });
    else openNavigationUrl(navigationUrl(dest, pref, mode));
  };

  const chooser = pending ? (
    <Sheet open onClose={() => setPending(null)} title="Ouvrir l'itinéraire avec…">
      <div className="grid gap-2 pb-4">
        {availableNavApps(typeof navigator === "undefined" ? "" : navigator.userAgent).map((a) => (
          <button
            key={a.id}
            onClick={() => {
              openNavigationUrl(navigationUrl(pending.dest, a.id, pending.mode));
              setPending(null);
            }}
            className="flex h-14 items-center gap-3 rounded-2xl bg-surface-2 px-4 text-left font-medium hover:bg-surface-3"
          >
            <Navigation size={20} /> {a.label}
          </button>
        ))}
        <p className="text-xs text-muted">Choisissez une application par défaut dans Réglages → Trajets.</p>
      </div>
    </Sheet>
  ) : null;

  return { launch, chooser };
}

/** 🟢 / 🟠 / 🔴 / ⚠️ departure pill — tap to open the itinerary. */
export function DeparturePill({ departure, className, large }: { departure: NextDeparture | null; className?: string; large?: boolean }) {
  const { launch, chooser } = useNavigationLauncher();
  if (!departure?.travel || !departure.status) return null;
  const { occ, travel, status } = departure;
  if (status.minutes > 180) return null;
  return (
    <>
      <button
        onClick={() => launch(occ.event.location!, travel.route.mode)}
        className={clsx("flex min-w-0 items-center gap-2 rounded-full font-medium shadow-card transition active:scale-95", large ? "px-5 py-3 text-lg" : "px-3 py-1.5 text-sm", LEVEL_CLASS[status.level], className)}
        title={`${occ.event.title} à ${fmtTime(occ.start)} — ${travel.route.durationMin} min de trajet`}
      >
        <span>{status.emoji}</span>
        <span className="truncate">{status.text}</span>
        <Navigation size={large ? 18 : 14} className="shrink-0" />
      </button>
      {chooser}
    </>
  );
}

/** Big "Pars maintenant" / "Itinéraire" button. */
export function RouteButton({ location, mode = "driving", label = "Itinéraire", className }: { location: EventLocation; mode?: TravelMode; label?: string; className?: string }) {
  const { launch, chooser } = useNavigationLauncher();
  return (
    <>
      <button
        onClick={() => launch(location, mode)}
        className={clsx("inline-flex h-11 items-center justify-center gap-2 rounded-full bg-accent px-4 font-medium text-white shadow-sm transition active:scale-95 dark:text-black", className)}
      >
        <Navigation size={18} /> {label}
      </button>
      {chooser}
    </>
  );
}
