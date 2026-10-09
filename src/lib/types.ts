// Core domain types for HomeCal.
// Dates are stored as ISO 8601 strings (UTC) in Firestore.

export type LLMMode = "auto" | "proxy" | "direct";

export type ProfileType ="PERSON" | "COUPLE" | "GROUP" | "HOUSEHOLD";

export interface Profile {
  id: string;
  name: string;
  color: string;
  avatar: string; // emoji or initials
  type: ProfileType;
  /** For COUPLE / GROUP: ids of PERSON profiles. HOUSEHOLD implicitly includes every person. */
  memberIds: string[];
  /** Optional: Firebase uid linked to this person. */
  uid?: string;
  order: number;
}

export interface HouseholdSettings {
  timezone: string;
  /** Default margin added before departure, in minutes. */
  travelMarginMin: number;
  defaultTravelMode: TravelMode;
  nightMode: { enabled: boolean; start: string; end: string }; // "22:00" / "06:30"
  ambientAfterSec: number;
  dayStartHour: number;
  dayEndHour: number;
  /** auto = try the /api/llm proxy, then the browser → Ollama direct connection */
  llm: { mode: LLMMode; baseUrl: string; model: string };
  voice: { lang: string; autoSpeak: boolean };
  /** Preferred navigation app for "Pars maintenant" */
  navigationApp: NavigationApp;
  timers: { sound: boolean; voice: boolean; notifications: boolean };
  shopping: { hideChecked: boolean };
  wakeWord: WakeWordSettings;
}

export type WakeSensitivity = "low" | "normal" | "high";
export type SpokenReplyMode = "always" | "needed" | "never";

/** Hands-free activation ("HomeCal, ajoute du lait aux courses"). Per household; enabled per device. */
export interface WakeWordSettings {
  /** Wake word shown to the user */
  keyword: string;
  sensitivity: WakeSensitivity;
  /** Short beep when the wake word is detected */
  sound: boolean;
  /** Start listening to the command right after the wake word */
  autoListen: boolean;
  /** Seconds to wait for the command before going back to wake-word mode */
  timeoutSec: number;
  /** Spoken answer after a voice command */
  reply: SpokenReplyMode;
}

export type NavigationApp = "waze" | "google" | "apple" | "ask";

// ------------------------------------------------------------------ V1.5 modules

export type TimerStatus = "running" | "paused" | "done" | "cancelled";

export interface Timer {
  id: string;
  label: string;
  /** Total duration in ms */
  duration: number;
  createdAt: string;
  /** Source of truth while running (ISO) */
  expiresAt: string;
  status: TimerStatus;
  /** Remaining ms when paused */
  remainingMs?: number;
  createdBy?: string;
}

export interface ShoppingItem {
  id: string;
  name: string;
  quantity?: string;
  checked: boolean;
  createdAt: string;
  createdBy?: string;
  checkedAt?: string;
}

export type SceneWidget =
  | "clock"
  | "weather"
  | "agenda"
  | "nextDeparture"
  | "music"
  | "timers"
  | "shopping"
  | "tomorrow"
  | "conflicts";

export interface Scene {
  id: string;
  name: string;
  icon: string;
  /** Widgets shown, in order */
  widgets: SceneWidget[];
  /** Playlist started when the scene is activated (optional) */
  playlist?: { uri: string; name: string };
  autoPlay: boolean;
  /** Automatic activation window (optional) */
  schedule?: { enabled: boolean; start: string; end: string };
  /** Dim the screen (evening) */
  dim: boolean;
  /** Large touch controls (kitchen) */
  large: boolean;
  order: number;
}

export interface Household {
  id: string;
  name: string;
  ownerUid: string;
  memberUids: string[];
  inviteCode?: string;
  homePlaceId?: string;
  settings: HouseholdSettings;
  createdAt: string;
}

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface EventLocation {
  label: string;
  address?: string;
  lat?: number;
  lng?: number;
  placeId?: string; // favourite place id
}

export interface FavoritePlace {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  icon: string;
  profileIds: string[];
  order: number;
}

export type Frequency = "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";

export interface Recurrence {
  freq: Frequency;
  interval: number;
  /** 0 = Sunday … 6 = Saturday (JS convention) */
  byWeekday?: number[];
  count?: number;
  until?: string; // ISO
  /** Occurrence start ISO strings that were removed */
  exdates?: string[];
}

export type TravelMode = "driving" | "cycling" | "walking";

export interface EventTravel {
  mode: TravelMode;
  originPlaceId?: string;
  marginMin?: number;
  /** Cached last computation */
  durationMin?: number;
  distanceKm?: number;
  computedAt?: string;
}

export type EventType =
  | "appointment"
  | "sport"
  | "work"
  | "social"
  | "family"
  | "travel"
  | "chore"
  | "other";

export type EventSource = "local" | "quickadd" | "assistant" | "google";

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  start: string;
  end: string;
  allDay: boolean;
  profileIds: string[];
  type: EventType;
  location?: EventLocation;
  recurrence?: Recurrence;
  /** Minutes before start */
  reminders: number[];
  travel?: EventTravel;
  source: EventSource;
  externalId?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export type NewEvent = Omit<CalendarEvent, "id" | "createdAt" | "updatedAt">;

/** A concrete occurrence of an event (recurring events expand into several). */
export interface Occurrence {
  key: string;
  event: CalendarEvent;
  start: Date;
  end: Date;
}

export interface Reminder {
  id: string;
  text: string;
  at: string; // ISO
  profileIds: string[];
  eventId?: string;
  done: boolean;
  createdAt: string;
}

export interface AssistantMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  createdAt: string;
  toolCalls?: { name: string; ok: boolean }[];
}

export const EVENT_TYPES: { id: EventType; label: string; emoji: string }[] = [
  { id: "appointment", label: "Rendez-vous", emoji: "🩺" },
  { id: "sport", label: "Sport", emoji: "🏋️" },
  { id: "work", label: "Travail", emoji: "💼" },
  { id: "social", label: "Sortie", emoji: "🍽️" },
  { id: "family", label: "Famille", emoji: "👨‍👩‍👧" },
  { id: "travel", label: "Voyage", emoji: "✈️" },
  { id: "chore", label: "Maison", emoji: "🏠" },
  { id: "other", label: "Autre", emoji: "📌" },
];

export const PROFILE_COLORS = [
  "#6366f1", // indigo
  "#ec4899", // pink
  "#f59e0b", // amber
  "#10b981", // emerald
  "#0ea5e9", // sky
  "#8b5cf6", // violet
  "#ef4444", // red
  "#14b8a6", // teal
];

export const DEFAULT_SETTINGS: HouseholdSettings = {
  timezone: "Europe/Zurich",
  travelMarginMin: 10,
  defaultTravelMode: "driving",
  nightMode: { enabled: true, start: "22:30", end: "06:30" },
  ambientAfterSec: 180,
  dayStartHour: 7,
  dayEndHour: 23,
  llm: { mode: "auto", baseUrl: "http://localhost:11434", model: "qwen3:4b-instruct" },
  voice: { lang: "fr-FR", autoSpeak: true },
  navigationApp: "ask",
  timers: { sound: true, voice: true, notifications: true },
  shopping: { hideChecked: false },
  wakeWord: { keyword: "HomeCal", sensitivity: "normal", sound: true, autoListen: true, timeoutSec: 6, reply: "needed" },
};

export const SCENE_WIDGETS: { id: SceneWidget; label: string; icon: string }[] = [
  { id: "clock", label: "Heure", icon: "🕐" },
  { id: "weather", label: "Météo", icon: "🌤️" },
  { id: "agenda", label: "Programme du jour", icon: "📅" },
  { id: "nextDeparture", label: "Prochain départ", icon: "🚗" },
  { id: "music", label: "Musique", icon: "🎵" },
  { id: "timers", label: "Minuteurs", icon: "⏱️" },
  { id: "shopping", label: "Courses", icon: "🛒" },
  { id: "tomorrow", label: "Demain", icon: "🌙" },
  { id: "conflicts", label: "Conflits", icon: "⚠️" },
];

/** Default scenes created the first time (fully editable / deletable afterwards). */
export const DEFAULT_SCENES: Omit<Scene, "id">[] = [
  {
    name: "Matin",
    icon: "☀️",
    widgets: ["clock", "weather", "agenda", "nextDeparture", "conflicts", "music"],
    autoPlay: false,
    schedule: { enabled: false, start: "06:30", end: "09:00" },
    dim: false,
    large: false,
    order: 0,
  },
  {
    name: "Cuisine",
    icon: "🍳",
    widgets: ["music", "timers", "shopping", "agenda"],
    autoPlay: false,
    dim: false,
    large: true,
    order: 1,
  },
  {
    name: "Soir",
    icon: "🌙",
    widgets: ["clock", "tomorrow", "nextDeparture", "music"],
    autoPlay: false,
    schedule: { enabled: false, start: "20:00", end: "23:00" },
    dim: true,
    large: false,
    order: 2,
  },
];
