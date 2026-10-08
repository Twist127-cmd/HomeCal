"use client";

import { useMemo } from "react";
import { useApp } from "@/components/app/AppProvider";
import { sceneStore, shoppingStore, timerStore } from "@/lib/data/modules";
import { firestore } from "@/lib/firebase/client";

/** Firestore stores for the household's timers, shopping list and scenes. */
export function useModuleStores() {
  const { householdId } = useApp();
  return useMemo(() => {
    if (!householdId) return null;
    const db = firestore();
    return { timers: timerStore(db, householdId), shopping: shoppingStore(db, householdId), scenes: sceneStore(db, householdId) };
  }, [householdId]);
}
