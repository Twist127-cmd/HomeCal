"use client";

import { signOut } from "firebase/auth";
import { useApp } from "@/components/app/AppProvider";
import { Button } from "@/components/ui/primitives";
import { auth } from "@/lib/firebase/client";
import { Section } from "../shared";

export function AccountSection() {
  const { user } = useApp();
  return (
    <Section title="Compte">
      <div className="flex items-center justify-between gap-4">
        <span className="text-muted">{user?.email}</span>
        <Button variant="danger" size="sm" onClick={() => signOut(auth())}>
          Se déconnecter
        </Button>
      </div>
      <p className="text-xs text-muted">HomeCal V1 · données stockées dans Firebase (projet {process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}).</p>
    </Section>
  );
}
