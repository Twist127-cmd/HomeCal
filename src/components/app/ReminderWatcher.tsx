"use client";

import { useEffect, useRef } from "react";
import { useApp } from "@/components/app/AppProvider";
import { toast } from "@/components/ui/toast";
import { updateReminder } from "@/lib/data/household";
import { departureTime, needsTravel, pickOrigin } from "@/lib/departure";
import { fmtTime } from "@/lib/dates";
import { firestore } from "@/lib/firebase/client";
import { hasCoords } from "@/lib/geo";
import { expandEvents } from "@/lib/recurrence";

const STORE_KEY = "homecal.notified";
const TICK_MS = 30_000;

function loadNotified(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(STORE_KEY) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

function saveNotified(s: Set<string>) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify([...s].slice(-300)));
  } catch {
    /* ignore */
  }
}

async function systemNotify(title: string, body: string, tag: string) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  const reg = await navigator.serviceWorker?.getRegistration();
  if (reg?.active) reg.active.postMessage({ type: "notify", title, body, tag });
  else new Notification(title, { body, tag, icon: "/icons/icon-192.png" });
}

/**
 * Checks every 30 s for due event reminders, standalone reminders and
 * "time to leave" alerts. Works while HomeCal is open (kiosk / tab).
 */
export function ReminderWatcher() {
  const app = useApp();
  const ref = useRef(app);
  useEffect(() => {
    ref.current = app;
  });

  useEffect(() => {
    let last = Date.now() - 60_000;
    const notified = loadNotified();

    const fire = (key: string, title: string, body: string) => {
      if (notified.has(key)) return;
      notified.add(key);
      saveNotified(notified);
      const { tts, household } = ref.current;
      toast({ text: `${title} — ${body}`, tone: "reminder", durationMs: 30_000 });
      if (household?.settings.voice.autoSpeak && document.visibilityState === "visible") tts.speak(`${title}. ${body}`);
      systemNotify(title, body, key).catch(() => {});
    };

    const tick = async () => {
      const { events, reminders, places, homePlace, routing, household, householdId, profiles, myProfileId } = ref.current;
      if (!household) return;
      const now = Date.now();
      const occ = expandEvents(events, new Date(now - 3600_000), new Date(now + 2 * 24 * 3600_000));

      // event reminders
      for (const o of occ) {
        if (o.event.allDay) continue;
        for (const m of o.event.reminders ?? []) {
          const t = o.start.getTime() - m * 60000;
          if (t > last && t <= now) {
            fire(`ev:${o.key}:${m}`, o.event.title, m === 0 ? "maintenant" : `à ${fmtTime(o.start)} (dans ${m >= 60 ? `${Math.round(m / 60)} h` : `${m} min`})`);
          }
        }
      }

      // standalone reminders
      for (const r of reminders) {
        if (r.done) continue;
        const t = new Date(r.at).getTime();
        if (t <= now && t > now - 6 * 3600_000) {
          fire(`rm:${r.id}`, "Rappel", r.text);
          if (householdId) updateReminder(firestore(), householdId, r.id, { done: true }).catch(() => {});
        }
      }

      // time to leave (next 3 hours, events concerning me or everyone)
      for (const o of occ) {
        if (o.start.getTime() < now || o.start.getTime() > now + 3 * 3600_000) continue;
        if (!hasCoords(o.event.location)) continue;
        const persons = o.event.profileIds;
        const me = profiles.find((p) => p.id === myProfileId);
        if (me && !persons.includes(me.id) && !profiles.some((p) => persons.includes(p.id) && p.type !== "PERSON")) continue;
        const sameDay = occ.filter((x) => x.start.toDateString() === o.start.toDateString());
        const origin = pickOrigin(o, sameDay, places, homePlace?.id);
        if (!needsTravel(o.event, origin)) continue;
        const mode = o.event.travel?.mode ?? household.settings.defaultTravelMode;
        try {
          const r = await routing.route(origin as { lat: number; lng: number }, o.event.location as { lat: number; lng: number }, mode);
          const depart = departureTime(o.start, r.durationMin, o.event.travel?.marginMin ?? household.settings.travelMarginMin).getTime();
          if (depart > last && depart <= now + 60_000) {
            fire(`go:${o.key}`, `Il est temps de partir`, `${o.event.title} à ${fmtTime(o.start)} — ${r.durationMin} min de trajet`);
          }
        } catch {
          /* routing unavailable */
        }
      }
      last = now;
    };

    tick();
    const id = setInterval(tick, TICK_MS);
    return () => clearInterval(id);
  }, []);

  return null;
}
