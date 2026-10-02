import type { CalendarEvent, NewEvent } from "@/lib/types";
import type { ProviderStatus } from "../errors";

export interface ExternalCalendar {
  id: string;
  name: string;
  color?: string;
  primary?: boolean;
  readOnly?: boolean;
}

export interface SyncResult {
  imported: number;
  updated: number;
  deleted: number;
}

/**
 * Abstraction over a calendar backend.
 * V1: LocalCalendarProvider (Firestore) is the source of truth.
 *     GoogleCalendarProvider exists but is disabled (feature flag).
 */
export interface CalendarProvider {
  readonly id: "local" | "google";
  readonly label: string;
  status(): ProviderStatus;

  connect(): Promise<void>;
  disconnect(): Promise<void>;

  listCalendars(): Promise<ExternalCalendar[]>;

  /** Raw events (recurring events are returned once, use expandEvents to get occurrences). */
  getEvents(range?: { start: Date; end: Date }): Promise<CalendarEvent[]>;
  createEvent(event: NewEvent): Promise<CalendarEvent>;
  updateEvent(id: string, patch: Partial<NewEvent>): Promise<CalendarEvent>;
  deleteEvent(id: string): Promise<void>;

  syncEvents(): Promise<SyncResult>;

  /** Realtime updates (optional). Returns an unsubscribe function. */
  subscribe?(cb: (events: CalendarEvent[]) => void, onError?: (e: Error) => void): () => void;
}
