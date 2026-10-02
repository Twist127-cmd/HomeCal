import type { CalendarEvent, NewEvent } from "@/lib/types";
import { ProviderError, type ProviderStatus } from "../errors";
import type { CalendarProvider, ExternalCalendar, SyncResult } from "./CalendarProvider";

/** In-memory provider — used by tests and as an offline fallback. */
export class MemoryCalendarProvider implements CalendarProvider {
  readonly id = "local" as const;
  readonly label = "Mémoire";
  events: CalendarEvent[] = [];
  private seq = 0;

  constructor(initial: CalendarEvent[] = []) {
    this.events = [...initial];
  }

  status(): ProviderStatus {
    return "READY";
  }
  async connect() {}
  async disconnect() {}
  async listCalendars(): Promise<ExternalCalendar[]> {
    return [{ id: "memory", name: "Mémoire", primary: true }];
  }
  async getEvents() {
    return [...this.events];
  }
  async createEvent(e: NewEvent): Promise<CalendarEvent> {
    const now = new Date().toISOString();
    const full = { ...e, id: `m${++this.seq}`, createdAt: now, updatedAt: now };
    this.events.push(full);
    return full;
  }
  async updateEvent(id: string, patch: Partial<NewEvent>): Promise<CalendarEvent> {
    const i = this.events.findIndex((e) => e.id === id);
    if (i < 0) throw new ProviderError("BAD_REQUEST", `Événement introuvable : ${id}`);
    this.events[i] = { ...this.events[i], ...patch, updatedAt: new Date().toISOString() };
    return this.events[i];
  }
  async restoreEvent(e: CalendarEvent) {
    this.events = [...this.events.filter((x) => x.id !== e.id), e];
  }
  async deleteEvent(id: string) {
    this.events = this.events.filter((e) => e.id !== id);
  }
  async syncEvents(): Promise<SyncResult> {
    return { imported: 0, updated: 0, deleted: 0 };
  }
}
