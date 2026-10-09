"use client";

import { onAuthStateChanged, type User } from "firebase/auth";
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { auth, firebaseConfigured, firestore } from "@/lib/firebase/client";
import {
  clearSpotifyConnection,
  createReminder as createReminderDoc,
  deleteReminder as deleteReminderDoc,
  saveSpotifyConnection,
  subscribeCollection,
  subscribeHousehold,
  subscribeUser,
  updateSpotifyCipher,
  type UserDoc,
} from "@/lib/data/household";
import type { AssistantMessage, CalendarEvent, FavoritePlace, Household, Profile, Reminder, Scene, ShoppingItem, Timer } from "@/lib/types";
import { SpotifyProvider, type MusicProvider } from "@/providers/music";
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
  timers: Timer[];
  shopping: ShoppingItem[];
  scenes: Scene[];
  /** Spotify account info when connected */
  spotify: UserDoc["spotify"] | null;
  music: MusicProvider | null;
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
  const [userDoc, setUserDoc] = useState<UserDoc | null | undefined>(undefined);
  const [household, setHousehold] = useState<Household | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [places, setPlaces] = useState<FavoritePlace[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [history, setHistory] = useState<AssistantMessage[]>([]);
  const [timers, setTimers] = useState<Timer[]>([]);
  const [shopping, setShopping] = useState<ShoppingItem[]>([]);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [error, setError] = useState<string | undefined>();
  const eventsRef = useRef<CalendarEvent[]>([]);
  // holder read by the Spotify provider callbacks (latest encrypted token)
  const [cipherHolder] = useState(() => ({ value: undefined as string | undefined }));

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
    return subscribeUser(firestore(), user.uid, (u) => {
      cipherHolder.value = u?.spotify?.cipher;
      setUserDoc(u);
    });
  }, [user, cipherHolder]);

  // Spotify OAuth return: the encrypted refresh token arrives in the URL fragment
  useEffect(() => {
    if (!user || typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const status = params.get("spotify");
    if (!status) return;
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const cipher = hash.get("spotify");
    window.history.replaceState(null, "", window.location.pathname); // never keep the blob in the URL/history
    if (status === "connected" && cipher) {
      const db = firestore();
      saveSpotifyConnection(db, user.uid, { cipher, connectedAt: new Date().toISOString() })
        .then(async () => {
          toast({ text: "Spotify connecté ✓", tone: "success" });
        })
        .catch((e) => toast({ text: `Spotify : ${(e as Error).message}`, tone: "error" }));
    } else if (status === "error") {
      toast({ text: `Connexion Spotify impossible (${params.get("reason") ?? "erreur"})`, tone: "error" });
    }
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
      subscribeCollection<Timer>(db, householdId, "timers", setTimers, onErr),
      subscribeCollection<ShoppingItem>(db, householdId, "shoppingItems", (s) => setShopping([...s].sort((a, b) => a.createdAt.localeCompare(b.createdAt))), onErr),
      subscribeCollection<Scene>(db, householdId, "scenes", (s) => setScenes([...s].sort((a, b) => a.order - b.order)), onErr),
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

  // HomeCal's voice (settings → every existing speech: assistant, voice mode, timers, reminders)
  const voiceSettings = household?.settings.voice;
  useEffect(() => {
    if (voiceSettings) tts.configure({ voiceURI: voiceSettings.voiceURI, rate: voiceSettings.rate, pitch: voiceSettings.pitch });
  }, [voiceSettings]);

  const uid = user?.uid;
  const music = useMemo<MusicProvider | null>(() => {
    if (!uid) return null;
    const db = firestore();
    return new SpotifyProvider({
      getIdToken: () => auth().currentUser?.getIdToken() ?? Promise.resolve(null),
      getCipher: () => cipherHolder.value,
      onCipherRotated: (cipher) => {
        updateSpotifyCipher(db, uid, cipher).catch(() => {});
      },
      onDisconnect: () => clearSpotifyConnection(db, uid),
    });
  }, [uid, cipherHolder]);

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
    timers,
    shopping,
    scenes,
    spotify: userDoc?.spotify ?? null,
    music,
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
