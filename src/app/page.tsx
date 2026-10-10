"use client";

import { useApp } from "@/components/app/AppProvider";
import { HomeScreen } from "@/components/app/HomeScreen";
import { LoginScreen } from "@/components/auth/LoginScreen";
import { Onboarding } from "@/components/auth/Onboarding";
import { Skeleton } from "@/components/ui/primitives";

export default function Page() {
  const { status, error } = useApp();

  switch (status) {
    case "not-configured":
      return (
        <main className="flex h-full items-center justify-center p-8 text-center">
          <div>
            <h1 className="text-2xl font-semibold">Configuration manquante</h1>
            <p className="mt-2 text-muted">Les variables NEXT_PUBLIC_FIREBASE_* ne sont pas définies (voir .env.example).</p>
          </div>
        </main>
      );
    case "signed-out":
      return <LoginScreen />;
    case "onboarding":
      return <Onboarding />;
    case "ready":
      return <HomeScreen />;
    case "error":
      return (
        <main className="flex h-full items-center justify-center p-8 text-center">
          <div>
            <h1 className="text-2xl font-semibold">Impossible de charger le foyer</h1>
            <p className="mt-2 text-muted">{error}</p>
          </div>
        </main>
      );
    default:
      return (
        <main className="flex h-full items-center justify-center text-muted">
          <div className="w-full max-w-4xl space-y-6 px-6" role="status" aria-label="Chargement de HomeCal"><Skeleton className="h-12 w-48" /><Skeleton className="h-6 w-64" /><div className="grid gap-4 sm:grid-cols-2"><Skeleton className="h-48" /><Skeleton className="h-48" /></div></div>
        </main>
      );
  }
}
