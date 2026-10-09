"use client";

import {
  arrayUnion,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  onSnapshot,
  setDoc,
  updateDoc,
  writeBatch,
  type Firestore,
} from "firebase/firestore";
import { stripUndefined } from "@/providers/calendar/LocalCalendarProvider";
import {
  DEFAULT_SETTINGS,
  PROFILE_COLORS,
  type AssistantMessage,
  type FavoritePlace,
  type Household,
  type HouseholdSettings,
  type Profile,
  type Reminder,
} from "../types";

export type SubCollection =
  | "profiles"
  | "places"
  | "reminders"
  | "assistantHistory"
  | "integrations"
  | "events"
  | "timers"
  | "shoppingItems"
  | "scenes";

const sub = (db: Firestore, hid: string, name: SubCollection) => collection(db, "households", hid, name);

export function withDefaults(h: Partial<Household> & { id: string }): Household {
  const s = (h.settings ?? {}) as Partial<HouseholdSettings>;
  return {
    name: "Maison",
    ownerUid: "",
    memberUids: [],
    createdAt: new Date().toISOString(),
    ...h,
    settings: {
      ...DEFAULT_SETTINGS,
      ...s,
      nightMode: { ...DEFAULT_SETTINGS.nightMode, ...s.nightMode },
      llm: { ...DEFAULT_SETTINGS.llm, ...s.llm },
      voice: { ...DEFAULT_SETTINGS.voice, ...s.voice },
      timers: { ...DEFAULT_SETTINGS.timers, ...s.timers },
      shopping: { ...DEFAULT_SETTINGS.shopping, ...s.shopping },
      wakeWord: { ...DEFAULT_SETTINGS.wakeWord, ...s.wakeWord },
    },
  } as Household;
}

// ------------------------------------------------------------------ user ↔ household

export async function getUserHouseholdId(db: Firestore, uid: string): Promise<string | null> {
  const snap = await getDoc(doc(db, "users", uid));
  return (snap.data()?.householdId as string | undefined) ?? null;
}

export interface OnboardingInput {
  householdName: string;
  myName: string;
  partnerName?: string;
  home?: { address: string; lat: number; lng: number };
}

/**
 * Create a household with its default profiles:
 *   Maison ├── <me> ├── <partner> ├── Couple └── Maison (household)
 */
export async function createHousehold(db: Firestore, uid: string, email: string | null, input: OnboardingInput): Promise<string> {
  const hRef = doc(collection(db, "households"));
  const now = new Date().toISOString();
  const homePlaceId = input.home ? "home" : undefined;

  const household: Omit<Household, "id"> = {
    name: input.householdName.trim() || "Maison",
    ownerUid: uid,
    memberUids: [uid],
    homePlaceId,
    settings: DEFAULT_SETTINGS,
    createdAt: now,
  };
  // household doc must exist before sub-collections (rules check membership)
  await setDoc(hRef, stripUndefined(household));

  const batch = writeBatch(db);
  const me: Profile = {
    id: "p-me",
    name: input.myName.trim() || "Moi",
    color: PROFILE_COLORS[0],
    avatar: initials(input.myName || "Moi"),
    type: "PERSON",
    memberIds: [],
    uid,
    order: 0,
  };
  const profiles: Profile[] = [me];
  if (input.partnerName?.trim()) {
    profiles.push({
      id: "p-partner",
      name: input.partnerName.trim(),
      color: PROFILE_COLORS[1],
      avatar: initials(input.partnerName),
      type: "PERSON",
      memberIds: [],
      order: 1,
    });
    profiles.push({
      id: "p-couple",
      name: "Couple",
      color: PROFILE_COLORS[5],
      avatar: "💞",
      type: "COUPLE",
      memberIds: ["p-me", "p-partner"],
      order: 2,
    });
  }
  profiles.push({
    id: "p-household",
    name: household.name,
    color: PROFILE_COLORS[3],
    avatar: "🏠",
    type: "HOUSEHOLD",
    memberIds: [],
    order: 3,
  });
  for (const p of profiles) batch.set(doc(sub(db, hRef.id, "profiles"), p.id), stripUndefined(p));

  if (input.home) {
    const home: FavoritePlace = {
      id: "home",
      name: "Maison",
      address: input.home.address,
      lat: input.home.lat,
      lng: input.home.lng,
      icon: "🏠",
      profileIds: [],
      order: 0,
    };
    batch.set(doc(sub(db, hRef.id, "places"), home.id), home);
  }
  batch.set(doc(db, "users", uid), { householdId: hRef.id, email, profileId: "p-me", updatedAt: now }, { merge: true });
  await batch.commit();
  return hRef.id;
}

function initials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?"
  );
}

// ------------------------------------------------------------------ invites

function randomCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return [...bytes].map((b) => alphabet[b % alphabet.length]).join("");
}

export async function createInvite(db: Firestore, hid: string, uid: string): Promise<string> {
  const code = randomCode();
  await setDoc(doc(db, "invites", code), { householdId: hid, createdBy: uid, createdAt: new Date().toISOString() });
  await updateDoc(doc(db, "households", hid), { inviteCode: code });
  return code;
}

export async function joinHousehold(db: Firestore, uid: string, email: string | null, rawCode: string): Promise<string> {
  const code = rawCode.trim().toUpperCase();
  const invite = await getDoc(doc(db, "invites", code));
  if (!invite.exists()) throw new Error("Code d'invitation invalide");
  const hid = invite.data().householdId as string;
  await updateDoc(doc(db, "households", hid), { memberUids: arrayUnion(uid), lastInvite: code });
  await setDoc(doc(db, "users", uid), { householdId: hid, email, updatedAt: new Date().toISOString() }, { merge: true });
  return hid;
}

export async function setMyProfile(db: Firestore, uid: string, profileId: string) {
  await setDoc(doc(db, "users", uid), { profileId }, { merge: true });
}

export interface UserDoc {
  householdId?: string;
  profileId?: string;
  /** Spotify connection — `cipher` is the refresh token encrypted by the server (unreadable client-side) */
  spotify?: { cipher: string; name?: string; product?: string; connectedAt?: string };
}

export function subscribeUser(db: Firestore, uid: string, cb: (u: UserDoc | null) => void) {
  return onSnapshot(doc(db, "users", uid), (s) => cb(s.exists() ? (s.data() as UserDoc) : null));
}

export async function saveSpotifyConnection(db: Firestore, uid: string, spotify: NonNullable<UserDoc["spotify"]>) {
  await setDoc(doc(db, "users", uid), { spotify: stripUndefined(spotify) }, { merge: true });
}

export async function updateSpotifyCipher(db: Firestore, uid: string, cipher: string) {
  await updateDoc(doc(db, "users", uid), { "spotify.cipher": cipher });
}

export async function clearSpotifyConnection(db: Firestore, uid: string) {
  await updateDoc(doc(db, "users", uid), { spotify: deleteField() });
}

// ------------------------------------------------------------------ subscriptions

export function subscribeHousehold(db: Firestore, hid: string, cb: (h: Household | null) => void, onError?: (e: Error) => void) {
  return onSnapshot(
    doc(db, "households", hid),
    (s) => cb(s.exists() ? withDefaults({ ...(s.data() as Household), id: s.id }) : null),
    (e) => onError?.(e),
  );
}

export function subscribeCollection<T extends { id: string }>(
  db: Firestore,
  hid: string,
  name: SubCollection,
  cb: (items: T[]) => void,
  onError?: (e: Error) => void,
) {
  return onSnapshot(
    sub(db, hid, name),
    (s) => cb(s.docs.map((d) => ({ ...(d.data() as T), id: d.id }))),
    (e) => onError?.(e),
  );
}

// ------------------------------------------------------------------ CRUD helpers

export async function updateHousehold(db: Firestore, hid: string, patch: Partial<Pick<Household, "name" | "homePlaceId">>) {
  await updateDoc(doc(db, "households", hid), stripUndefined(patch));
}

export async function updateSettings(db: Firestore, hid: string, settings: HouseholdSettings) {
  await updateDoc(doc(db, "households", hid), { settings: stripUndefined(settings) });
}

export async function saveProfile(db: Firestore, hid: string, p: Profile) {
  await setDoc(doc(sub(db, hid, "profiles"), p.id), stripUndefined(p));
}

export async function deleteProfile(db: Firestore, hid: string, id: string) {
  await deleteDoc(doc(sub(db, hid, "profiles"), id));
}

export function newId(db: Firestore, hid: string, name: SubCollection): string {
  return doc(sub(db, hid, name)).id;
}

export async function savePlace(db: Firestore, hid: string, p: FavoritePlace) {
  await setDoc(doc(sub(db, hid, "places"), p.id), stripUndefined(p));
}

export async function deletePlace(db: Firestore, hid: string, id: string) {
  await deleteDoc(doc(sub(db, hid, "places"), id));
}

export async function createReminder(db: Firestore, hid: string, r: Omit<Reminder, "id" | "createdAt">): Promise<Reminder> {
  const ref = doc(sub(db, hid, "reminders"));
  const full: Reminder = { ...r, id: ref.id, createdAt: new Date().toISOString() };
  await setDoc(ref, stripUndefined(full));
  return full;
}

export async function updateReminder(db: Firestore, hid: string, id: string, patch: Partial<Reminder>) {
  await updateDoc(doc(sub(db, hid, "reminders"), id), stripUndefined(patch));
}

export async function deleteReminder(db: Firestore, hid: string, id: string) {
  await deleteDoc(doc(sub(db, hid, "reminders"), id));
}

export async function addAssistantMessage(db: Firestore, hid: string, m: Omit<AssistantMessage, "id">) {
  const ref = doc(sub(db, hid, "assistantHistory"));
  await setDoc(ref, stripUndefined({ ...m, id: ref.id }));
}

export async function clearAssistantHistory(db: Firestore, hid: string, ids: string[]) {
  const batch = writeBatch(db);
  ids.forEach((id) => batch.delete(doc(sub(db, hid, "assistantHistory"), id)));
  await batch.commit();
}
