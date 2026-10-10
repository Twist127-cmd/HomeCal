"use client";

import { useState } from "react";
import { Chip, Field, inputClass, Toggle } from "@/components/ui/primitives";
import { Section, useHouseholdSettings } from "../shared";

export function DisplaySection() {
  const { s, set } = useHouseholdSettings();
  return (
    <Section title="Affichage">
      <ThemePicker />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Début de journée">
          <select className={inputClass} value={s.dayStartHour} onChange={(e) => set({ dayStartHour: +e.target.value })}>
            {Array.from({ length: 12 }, (_, h) => (
              <option key={h} value={h}>
                {h}:00
              </option>
            ))}
          </select>
        </Field>
        <Field label="Fin de journée">
          <select className={inputClass} value={s.dayEndHour} onChange={(e) => set({ dayEndHour: +e.target.value })}>
            {Array.from({ length: 10 }, (_, i) => 15 + i).map((h) => (
              <option key={h} value={h}>
                {h}:00
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Mode ambiant après inactivité" hint="Horloge plein écran + prochains événements (écran mural).">
        <select className={inputClass} value={s.ambientAfterSec} onChange={(e) => set({ ambientAfterSec: +e.target.value })}>
          <option value={0}>Désactivé</option>
          <option value={60}>1 minute</option>
          <option value={180}>3 minutes</option>
          <option value={300}>5 minutes</option>
          <option value={900}>15 minutes</option>
        </select>
      </Field>
      <Toggle checked={s.nightMode.enabled} onChange={(v) => set({ nightMode: { ...s.nightMode, enabled: v } })} label="Mode nuit (écran sombre et atténué)" />
      {s.nightMode.enabled && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="De">
            <input type="time" className={inputClass} value={s.nightMode.start} onChange={(e) => set({ nightMode: { ...s.nightMode, start: e.target.value } })} />
          </Field>
          <Field label="À">
            <input type="time" className={inputClass} value={s.nightMode.end} onChange={(e) => set({ nightMode: { ...s.nightMode, end: e.target.value } })} />
          </Field>
        </div>
      )}
    </Section>
  );
}

function ThemePicker() {
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem("homecal.theme") ?? "auto";
    } catch {
      return "auto";
    }
  });
  const apply = (t: string) => {
    setTheme(t);
    try {
      localStorage.setItem("homecal.theme", t);
    } catch {
      /* ignore */
    }
    const dark = t === "dark" || (t === "auto" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", dark);
    window.dispatchEvent(new Event("homecal:appearance"));
  };
  return (
    <Field label="Thème (sur cet appareil)">
      <div className="flex gap-2">
        {(
          [
            ["auto", "Automatique"],
            ["light", "Clair"],
            ["dark", "Sombre"],
          ] as const
        ).map(([id, l]) => (
          <Chip key={id} active={theme === id} onClick={() => apply(id)}>
            {l}
          </Chip>
        ))}
      </div>
    </Field>
  );
}
