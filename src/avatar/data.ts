"use client";
import { doc, updateDoc, type Firestore } from "firebase/firestore";
import { normalizeAvatar } from "./config";
import type { AvatarConfig } from "./types";
/** Patch just the avatar; do not overwrite profile changes made by another device. */
export async function saveAvatarConfig(db: Firestore, householdId: string, profileId: string, avatarConfig: AvatarConfig) {
  await updateDoc(doc(db, "households", householdId, "profiles", profileId), { avatarConfig: normalizeAvatar(avatarConfig) });
}
