"use client";

import { onAuthStateChanged, type User } from "firebase/auth";
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { auth, firebaseConfigured, firestore } from "@/lib/firebase/client";
import {
  createReminder as createReminderDoc,
  deleteReminder as deleteReminderDoc,
  subscribeCollection,
  subscribeHousehold,
  subscribeUser,
} from "@/lib/data/household";
import type { AssistantMessage, CalendarEvent, FavoritePlace, Household, Profile, Reminder } from "@/lib/types";
import { createCalendarProviders, type LocalCalendarProvider } from "@/providers/calendar";
import { HttpGeocodingProvider } from "@/providers/geocoding/GeocodingProvider";
import { createLLMProvider, type LLMProvider } from "@/providers/llm";
import { HttpRoutingProvider } from "@/providers/routing/RoutingProvider";
import { WebSpeechProvider } from "@/providers/speech/SpeechProvider";
import { WebSpeechTTSProvider } from "@/providers/tts/TTSProvider";
import { OpenMeteoProvider } from "@/providers/weather/OpenMeteoProvider";
import type { ToolContext } from "@/assistant/executor";
import { toast } from "@/components/ui/toast";

// Singletons (stateless or caching providers)
const weather = new OpenMeteoProvider();
const geocoding = new HttpGeocodingProvider();
const routing = new HttpRoutingProvider();
const speech = new WebSpeechProvider();
const tts = new WebSpeechTTSProvider();

export type AppStatus = "loading" | "signed-out" | "onboarding" | "ready" | "error" | "not-configured";

export interface AppState {
  status: AppStatus;
  error?: string;
  user: User | null;
  householdId: string | null;
  household: Household | null;
  profiles: Profile[];
  places: FavoritePlace[];
  events: CalendarEvent[];
  reminders: Reminder[];
  history: AssistantMessage[];
  myProfileId?: string;
  homePlace?: FavoritePlace;
  calendar: LocalCalendarProvider | null;
  llm: LLMProvider | null;
  weather: OpenMeteoProvider;
  geocoding: HttpGeocodingProvider;
  routing: HttpRoutingProvider;
  speech: WebSpeechProvider;
  tts: WebSpeechTTSProvider;
  toolContext(): ToolContext | null;
}

const Ctx = createContext<AppState | null>(null);

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp must be used inside <AppProvider>");
  return v;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [userDoc, setUserDoc] = useState<{ householdId?: string; profileId?: string } | null | undefined>(undefined);
  const [household, setHousehold] = useState<Household | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [places, setPlaces] = useState<FavoritePlace[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [history, setHistory] = useState<AssistantMessage[]>([]);
  const [error, setError] = useState<string | undefined>();
  const eventsRef = useRef<CalendarEvent[]>([]);

  // auth
  useEffect(() => {
    if (!firebaseConfigured) return;
    return onAuthStateChanged(auth(), (u) => {
      setUser(u);
      setAuthReady(true);
      if (!u) {
        setUserDoc(undefined);
        setHousehold(null);
      }
    });
  }, []);

  // user doc → household id
  useEffect(() => {
    if (!user) return;
    return subscribeUser(firestore(), user.uid, (u) => setUserDoc(u));
  }, [user]);

  const householdId = userDoc?.householdId ?? null;

  // household + sub-collections
  useEffect(() => {
    if (!householdId) return;
    const db = firestore();
    const onErr = (e: Error) => setError(e.message);
    const unsubs = [
      subscribeHousehold(db, householdId, setHousehold, onErr),
      subscribeCollection<Profile>(db, householdId, "profiles", (p) => setProfiles([...p].sort((a, b) => a.order - b.order)), onErr),
      subscribeCollection<FavoritePlace>(db, householdId, "places", (p) => setPlaces([...p].sort((a, b) => a.order - b.order)), onErr),
      subscribeCollection<CalendarEvent>(
        db,
        householdId,
        "events",
        (e) => {
          eventsRef.current = e;
          setEvents(e);
        },
        onErr,
      ),
      subscribeCollection<Reminder>(db, householdId, "reminders", setReminders, onErr),
      subscribeCollection<AssistantMessage>(
        db,
        householdId,
        "assistantHistory",
        (h) => setHistory([...h].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).slice(-50)),
        onErr,
      ),
    ];
    return () => unsubs.forEach((u) => u());
  }, [householdId]);

  const calendar = useMemo(() => {
    if (!householdId || !user) return null;
    const local = createCalendarProviders(firestore(), householdId, user.uid).local;
    local.onWriteError = (e) => toast({ text: `Enregistrement refusé : ${e.message}`, tone: "error" });
    return local;
  }, [householdId, user]);

  const llmSettings = household?.settings.llm;
  const llm = useMemo(
    () => (llmSettings ? createLLMProvider(llmSettings, () => auth().currentUser?.getIdToken() ?? Promise.resolve(null)) : null),
    [llmSettings],
  );

  const myProfileId = useMemo(() => {
    if (userDoc?.profileId && profiles.some((p) => p.id === userDoc.profileId)) return userDoc.profileId;
    return profiles.find((p) => p.uid === user?.uid)?.id ?? profiles.find((p) => p.type === "PERSON")?.id;
  }, [userDoc, profiles, user]);

  const homePlace = useMemo(
    () => places.find((p) => p.id === household?.homePlaceId) ?? places.find((p) => /maison|home|domicile/i.test(p.name)),
    [places, household?.homePlaceId],
  );

  let status: AppStatus;
  if (!firebaseConfigured) status = "not-configured";
  else if (!authReady) status = "loading";
  else if (!user) status = "signed-out";
  else if (userDoc === undefined) status = "loading";
  else if (!householdId) status = "onboarding";
  else if (!household) status = error ? "error" : "loading";
  else status = "ready";

  const value: AppState = {
    status,
    error,
    user,
    householdId,
    household,
    profiles,
    places,
    events,
    reminders,
    history,
    myProfileId,
    homePlace,
    calendar,
    llm,
    weather,
    geocoding,
    routing,
    speech,
    tts,
    toolContext() {
      if (!calendar || !household || !householdId) return null;
      const db = firestore();
      return {
        now: () => new Date(),
        calendar,
        events: () => eventsRef.current,
        profiles,
        places,
        settings: household.settings,
        homePlaceId: homePlace?.id,
        currentProfileId: myProfileId,
        weather,
        geocoding,
        routing,
        createReminder: (r) => createReminderDoc(db, householdId, r),
        deleteReminder: (id) => deleteReminderDoc(db, householdId, id),
      };
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
