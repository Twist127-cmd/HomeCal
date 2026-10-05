import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  setDoc,
  updateDoc,
  type Firestore,
} from "firebase/firestore";
import type { CalendarEvent, NewEvent } from "@/lib/types";
import { ProviderError, type ProviderStatus } from "../errors";
import type { CalendarProvider, ExternalCalendar, SyncResult } from "./CalendarProvider";

/**
 * Native HomeCal calendar stored in Firestore: households/{hid}/events/{id}. Source of truth in V1.
 *
 * Writes are applied to the local cache immediately (latency compensation) and are NOT awaited
 * until the server acknowledges them: offline, the server ack never comes and the UI would hang.
 * Server-side failures (e.g. security rules) are reported through `onWriteError`.
 */
export class LocalCalendarProvider implements CalendarProvider {
  readonly id = "local" as const;
  readonly label = "HomeCal";
  onWriteError?: (e: Error) => void;

  constructor(
    private readonly db: Firestore,
    private readonly householdId: string,
    private readonly uid?: string,
  ) {}

  private col() {
    return collection(this.db, "households", this.householdId, "events");
  }

  private write(p: Promise<unknown>) {
    p.catch((e: Error) => {
      if (this.onWriteError) this.onWriteError(e);
      else console.error("[HomeCal] write failed", e);
    });
  }

  status(): ProviderStatus {
    return "READY";
  }

  async connect() {}
  async disconnect() {}

  async listCalendars(): Promise<ExternalCalendar[]> {
    return [{ id: this.householdId, name: "HomeCal", primary: true }];
  }

  async getEvents(range?: { start: Date; end: Date }): Promise<CalendarEvent[]> {
    // Family volume is small: load everything, filter in memory (recurring events can start long before the range).
    const snap = await getDocs(this.col());
    const all = snap.docs.map((d) => ({ ...(d.data() as CalendarEvent), id: d.id }));
    if (!range) return all;
    return all.filter((e) => e.recurrence || (new Date(e.start) < range.end && new Date(e.end) > range.start));
  }

  async createEvent(event: NewEvent): Promise<CalendarEvent> {
    const ref = doc(this.col());
    const now = new Date().toISOString();
    const full: CalendarEvent = { ...event, id: ref.id, createdBy: event.createdBy ?? this.uid, createdAt: now, updatedAt: now };
    this.write(setDoc(ref, stripUndefined(full)));
    return full;
  }

  async updateEvent(id: string, patch: Partial<NewEvent>): Promise<CalendarEvent> {
    const ref = doc(this.col(), id);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new ProviderError("BAD_REQUEST", `Événement introuvable : ${id}`);
    const updated = { ...(snap.data() as CalendarEvent), ...patch, id, updatedAt: new Date().toISOString() };
    this.write(updateDoc(ref, stripUndefined({ ...patch, updatedAt: updated.updatedAt })));
    return updated;
  }

  /** Restore an event with a known id (undo of a delete). */
  async restoreEvent(event: CalendarEvent): Promise<void> {
    this.write(setDoc(doc(this.col(), event.id), stripUndefined({ ...event, updatedAt: new Date().toISOString() })));
  }

  async replaceEvent(event: CalendarEvent): Promise<void> {
    this.write(setDoc(doc(this.col(), event.id), stripUndefined({ ...event, updatedAt: new Date().toISOString() })));
  }

  async deleteEvent(id: string): Promise<void> {
    this.write(deleteDoc(doc(this.col(), id)));
  }

  async syncEvents(): Promise<SyncResult> {
    return { imported: 0, updated: 0, deleted: 0 };
  }

  subscribe(cb: (events: CalendarEvent[]) => void, onError?: (e: Error) => void) {
    return onSnapshot(
      this.col(),
      (snap) => cb(snap.docs.map((d) => ({ ...(d.data() as CalendarEvent), id: d.id }))),
      (e) => onError?.(e),
    );
  }
}

/** Firestore rejects `undefined`; remove such keys (shallow + nested plain objects). */
export function stripUndefined<T>(obj: T): T {
  if (Array.isArray(obj)) return obj.map(stripUndefined) as T;
  if (obj && typeof obj === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) if (v !== undefined) out[k] = stripUndefined(v);
    return out as T;
  }
  return obj;
}
