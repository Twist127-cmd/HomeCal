"use client";

import { ScenesPanel } from "@/components/scenes/ScenesPanel";
import { Section } from "../shared";

export function ScenesSection() {
  return (
    <Section title="Scènes">
      <div className="-m-4">
        <ScenesPanel />
      </div>
    </Section>
  );
}
