"use client";
import { doc, updateDoc, type Firestore } from "firebase/firestore";
import { normalizeVoxelAvatar } from "./dicebear/dicebearConfig";
import type { StoredAvatarConfig } from "./types";
/** Patch just the avatar; do not overwrite profile changes made by another device. */
export async function saveAvatarConfig(db: Firestore, householdId: string, profileId: string, avatarConfig: StoredAvatarConfig) {
  const config = normalizeVoxelAvatar(avatarConfig, profileId);
  await updateDoc(doc(db, "households", householdId, "profiles", profileId), { avatarConfig: config, avatarSeed: config.seed });
}
