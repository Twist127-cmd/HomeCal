import type { Firestore } from "firebase/firestore";
import type { CalendarProvider } from "./CalendarProvider";
import { GoogleCalendarProvider, googleCalendarEnabled } from "./GoogleCalendarProvider";
import { LocalCalendarProvider } from "./LocalCalendarProvider";

export type { CalendarProvider, ExternalCalendar, SyncResult } from "./CalendarProvider";
export { GoogleCalendarProvider, googleCalendarEnabled, LocalCalendarProvider };

/** Providers available for a household. V1: local = active, google = inactive. */
export function createCalendarProviders(db: Firestore, householdId: string, uid?: string) {
  const local = new LocalCalendarProvider(db, householdId, uid);
  const google: CalendarProvider = new GoogleCalendarProvider();
  return { active: local, local, google, googleEnabled: googleCalendarEnabled };
}
