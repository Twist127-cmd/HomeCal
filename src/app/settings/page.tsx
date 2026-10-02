"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useApp } from "@/components/app/AppProvider";
import { SettingsScreen } from "@/components/settings/SettingsScreen";
import { Spinner } from "@/components/ui/primitives";

export default function SettingsPage() {
  const { status } = useApp();
  const router = useRouter();

  useEffect(() => {
    if (status === "signed-out" || status === "onboarding") router.replace("/");
  }, [status, router]);

  if (status !== "ready")
    return (
      <main className="flex h-full items-center justify-center text-muted">
        <Spinner size={28} />
      </main>
    );
  return (
    <div className="scroll-thin h-full overflow-y-auto">
      <SettingsScreen />
    </div>
  );
}
