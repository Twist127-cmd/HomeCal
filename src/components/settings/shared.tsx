"use client";

import { useApp } from "@/components/app/AppProvider";
import { Card } from "@/components/ui/primitives";
import { toast } from "@/components/ui/toast";
import { updateSettings } from "@/lib/data/household";
import { firestore } from "@/lib/firebase/client";
import type { HouseholdSettings } from "@/lib/types";

/** Household settings + the existing patch-and-save helper (same behaviour as before the split). */
export function useHouseholdSettings() {
  const { household, householdId } = useApp();
  const db = firestore();
  const s = household!.settings;
  const set = (patch: Partial<HouseholdSettings>) => updateSettings(db, householdId!, { ...s, ...patch }).catch((e) => toast({ text: e.message, tone: "error" }));
  return { s, set, db, household: household!, householdId: householdId! };
}

export function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card className="p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">{title}</h2>
        {action}
      </div>
      <div className="space-y-4">{children}</div>
    </Card>
  );
}
