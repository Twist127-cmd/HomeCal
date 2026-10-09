"use client";

import { Chip, Field, inputClass } from "@/components/ui/primitives";
import { availableNavApps } from "@/lib/navigation";
import type { HouseholdSettings } from "@/lib/types";
import { Section, useHouseholdSettings } from "../shared";

export function TravelSection() {
  const { s, set } = useHouseholdSettings();
  const navApps = availableNavApps(typeof navigator === "undefined" ? "" : navigator.userAgent);
  return (
    <Section title="Trajets">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Mode par défaut">
          <select className={inputClass} value={s.defaultTravelMode} onChange={(e) => set({ defaultTravelMode: e.target.value as HouseholdSettings["defaultTravelMode"] })}>
            <option value="driving">Voiture</option>
            <option value="cycling">Vélo</option>
            <option value="walking">À pied</option>
          </select>
        </Field>
        <Field label="Marge avant départ">
          <select className={inputClass} value={s.travelMarginMin} onChange={(e) => set({ travelMarginMin: +e.target.value })}>
            {[0, 5, 10, 15, 20, 30].map((m) => (
              <option key={m} value={m}>
                {m} min
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Navigation préférée">
        <div className="flex flex-wrap gap-2">
          {navApps.map((a) => (
            <Chip key={a.id} active={s.navigationApp === a.id} onClick={() => set({ navigationApp: a.id })}>
              {a.label}
            </Chip>
          ))}
          <Chip active={s.navigationApp === "ask"} onClick={() => set({ navigationApp: "ask" })}>
            Demander à chaque fois
          </Chip>
        </div>
      </Field>
      <p className="text-xs text-muted">Itinéraires : OpenStreetMap / OSRM (gratuit). Transports publics non pris en charge en V1.</p>
    </Section>
  );
}
