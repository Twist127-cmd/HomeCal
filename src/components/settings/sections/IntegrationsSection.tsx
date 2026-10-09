"use client";

import { Button } from "@/components/ui/primitives";
import { toast } from "@/components/ui/toast";
import { googleCalendarEnabled, GoogleCalendarProvider } from "@/providers/calendar";
import { Section } from "../shared";

export function IntegrationsSection() {
  return (
    <Section title="Intégrations">
      <div className="flex items-center gap-4 rounded-2xl bg-surface-2 p-4">
        <span className="text-3xl">📅</span>
        <div className="flex-1">
          <div className="font-medium">Google Calendar</div>
          <div className="text-sm text-muted">{googleCalendarEnabled ? "Prêt à connecter" : "Prévu — désactivé en V1 (NEXT_PUBLIC_GOOGLE_CALENDAR_ENABLED=false)"}</div>
        </div>
        <Button
          size="sm"
          disabled={!googleCalendarEnabled}
          onClick={() =>
            new GoogleCalendarProvider()
              .connect()
              .then(() => toast({ text: "Google Calendar connecté", tone: "success" }))
              .catch((e) => toast({ text: `${e.code ?? ""} ${e.message}`, tone: "error" }))
          }
        >
          Connecter
        </Button>
      </div>
      <p className="text-xs text-muted">Le calendrier HomeCal (Firebase) reste la source de vérité. Outlook / Apple Calendar : non prévus en V1.</p>
    </Section>
  );
}
