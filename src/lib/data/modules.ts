"use client";

import { collection, deleteDoc, doc, setDoc, updateDoc, writeBatch, type Firestore } from "firebase/firestore";
import { stripUndefined } from "@/providers/calendar/LocalCalendarProvider";
import { toast } from "@/components/ui/toast";
import { DEFAULT_SCENES, type Scene, type ShoppingItem, type Timer } from "../types";

/**
 * Timers, shopping list and scenes (households/{hid}/…).
 * Writes go to the local cache immediately and are not awaited until the server
 * acknowledges them (offline-friendly); failures surface as a toast.
 */

type Coll = "timers" | "shoppingItems" | "scenes";

const report = (p: Promise<unknown>) => {
  p.catch((e: Error) => toast({ text: `Enregistrement refusé : ${e.message}`, tone: "error" }));
};

export function moduleStore<T extends { id: string }>(db: Firestore, hid: string, name: Coll) {
  const col = collection(db, "households", hid, name);
  return {
    async add(data: Omit<T, "id">): Promise<T> {
      const ref = doc(col);
      const full = { ...data, id: ref.id } as T;
      report(setDoc(ref, stripUndefined(full)));
      return full;
    },
    async put(item: T): Promise<void> {
      report(setDoc(doc(col, item.id), stripUndefined(item)));
    },
    async update(id: string, patch: Partial<T>): Promise<void> {
      // `undefined` values mean "remove": write null so the field is cleared
      const clean: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(patch)) clean[k] = v === undefined ? null : v;
      report(updateDoc(doc(col, id), clean));
    },
    async remove(id: string): Promise<void> {
      report(deleteDoc(doc(col, id)));
    },
  };
}

export const timerStore = (db: Firestore, hid: string) => moduleStore<Timer>(db, hid, "timers");
export const shoppingStore = (db: Firestore, hid: string) => moduleStore<ShoppingItem>(db, hid, "shoppingItems");
export const sceneStore = (db: Firestore, hid: string) => moduleStore<Scene>(db, hid, "scenes");

/** Create the default scenes (Matin, Cuisine, Soir) the first time — editable/deletable afterwards. */
export async function seedDefaultScenes(db: Firestore, hid: string): Promise<void> {
  const batch = writeBatch(db);
  const col = collection(db, "households", hid, "scenes");
  for (const s of DEFAULT_SCENES) {
    const ref = doc(col);
    batch.set(ref, stripUndefined({ ...s, id: ref.id }));
  }
  report(batch.commit());
}
