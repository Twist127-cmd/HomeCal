"use client";

import { Toggle } from "@/components/ui/primitives";
import { Section, useHouseholdSettings } from "../shared";

export function TimersSection() {
  const { s, set } = useHouseholdSettings();
  return (
    <Section title="Minuteurs">
      <Toggle checked={s.timers.sound} onChange={(v) => set({ timers: { ...s.timers, sound: v } })} label="Sonnerie" />
      <Toggle checked={s.timers.voice} onChange={(v) => set({ timers: { ...s.timers, voice: v } })} label="Synthèse vocale" />
      <Toggle checked={s.timers.notifications} onChange={(v) => set({ timers: { ...s.timers, notifications: v } })} label="Notifications" />
    </Section>
  );
}
