"use client";

import clsx from "clsx";
import { addDays, addMonths, addWeeks } from "date-fns";
import { AlertTriangle, CalendarSearch, ChevronLeft, ChevronRight, Moon, Settings, Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { AmbientScreen } from "@/components/app/AmbientScreen";
import { useApp } from "@/components/app/AppProvider";
import { ReminderWatcher } from "@/components/app/ReminderWatcher";
import { AssistantPanel } from "@/components/assistant/AssistantPanel";
import { AgendaRow, AgendaView } from "@/components/calendar/AgendaView";
import { AvailabilitySheet } from "@/components/calendar/AvailabilitySheet";
import { EventDetail } from "@/components/calendar/EventDetail";
import { EventEditor, type EditorRequest } from "@/components/calendar/EventEditor";
import { MonthView } from "@/components/calendar/MonthView";
import { QuickAdd } from "@/components/calendar/QuickAdd";
import { TimeGrid } from "@/components/calendar/TimeGrid";
import { Avatar, Button, Chip } from "@/components/ui/primitives";
import { Toaster } from "@/components/ui/toast";
import { useIdle } from "@/hooks/useIdle";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useNow } from "@/hooks/useNow";
import { useOccurrences } from "@/hooks/useOccurrences";
import { useForecast } from "@/hooks/useWeather";
import { capitalize, clampToDay, daysBetween, fmt, inTimeWindow, startOfDay, viewRange, type ViewMode } from "@/lib/dates";
import type { NewEvent, Occurrence } from "@/lib/types";
import { describeWeather } from "@/providers/weather/WeatherProvider";

const VIEWS: { id: ViewMode; label: string }[] = [
  { id: "day", label: "Jour" },
  { id: "week", label: "Semaine" },
  { id: "month", label: "Mois" },
  { id: "agenda", label: "Agenda" },
];

export function HomeScreen() {
  const { household, profiles } = useApp();
  const now = useNow(15_000);
  const isMobile = useMediaQuery("(max-width: 767px)");
  const isWide = useMediaQuery("(min-width: 1280px)");
  const [viewChoice, setView] = useState<ViewMode | null>(null);
  const view: ViewMode = viewChoice ?? (isMobile ? "agenda" : "week");
  const [anchor, setAnchor] = useState(() => startOfDay(new Date()));
  const [filter, setFilter] = useState<string | null>(null);
  const [editor, setEditor] = useState<EditorRequest | null>(null);
  const [detail, setDetail] = useState<Occurrence | null>(null);
  const [assistant, setAssistant] = useState<{ open: boolean; text?: string; listen?: boolean }>({ open: false });
  const [availability, setAvailability] = useState(false);
  const settings = household!.settings;
  const [idle, wake] = useIdle(isMobile ? 0 : settings.ambientAfterSec);
  const night = settings.nightMode.enabled && inTimeWindow(now, settings.nightMode.start, settings.nightMode.end);
  const ambient = idle && !editor && !assistant.open && !availability;

  // night mode: dark + dim
  useEffect(() => {
    const root = document.documentElement;
    if (night) root.classList.add("dark", "night");
    else {
      root.classList.remove("night");
      let theme = "auto";
      try {
        theme = localStorage.getItem("homecal.theme") ?? "auto";
      } catch {
        /* ignore */
      }
      const dark = theme === "dark" || (theme === "auto" && window.matchMedia("(prefers-color-scheme: dark)").matches);
      root.classList.toggle("dark", dark);
    }
  }, [night]);

  const range = useMemo(() => viewRange(view, anchor), [view, anchor]);
  const { occurrences, conflicts, conflictKeys } = useOccurrences(range.start, addDays(range.end, 1), filter);
  const today = useOccurrences(startOfDay(now), addDays(startOfDay(now), 1), filter);

  const move = (dir: -1 | 1) =>
    setAnchor((a) =>
      view === "day" ? addDays(a, dir) : view === "week" ? addWeeks(a, dir) : view === "month" ? addMonths(a, dir) : addDays(a, dir * 30),
    );

  const title =
    view === "day"
      ? capitalize(fmt(anchor, "EEEE d MMMM yyyy"))
      : view === "week"
        ? `${fmt(range.start, "d MMM")} – ${fmt(range.end, "d MMM yyyy")}`
        : view === "month"
          ? capitalize(fmt(anchor, "MMMM yyyy"))
          : `À partir du ${fmt(range.start, "d MMMM")}`;

  const openNew = (draft: Partial<NewEvent>) => setEditor({ draft });
  const dayOf = (o: Occurrence) => occurrences.filter((x) => clampToDay(x.start, x.end, o.start));

  // swipe navigation (touch)
  const swipe = useRef<{ x: number; y: number } | null>(null);

  const forecast = useForecast();
  const cur = forecast?.current;
  const curW = cur ? describeWeather(cur.weatherCode, cur.isDay) : null;

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      {/* ---------- header ---------- */}
      <header className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 px-3 pt-3 sm:px-5 sm:pt-4">
        <div className="flex min-w-0 items-baseline gap-3">
          <span className="tabular text-3xl font-semibold tracking-tight sm:text-4xl">{fmt(now, "HH:mm")}</span>
          <span className="truncate text-sm font-medium text-muted sm:text-base">{capitalize(fmt(now, "EEEE d MMMM"))}</span>
        </div>
        {curW && cur && (
          <span className="flex items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-sm shadow-card" title={curW.label}>
            <span className="text-lg leading-none">{curW.emoji}</span>
            <span className="tabular font-semibold">{Math.round(cur.temperature)}°</span>
            {forecast?.daily[0] && (
              <span className="hidden text-muted sm:inline">
                {Math.round(forecast.daily[0].tMin)}°/{Math.round(forecast.daily[0].tMax)}°
              </span>
            )}
          </span>
        )}
        {night && (
          <span className="flex items-center gap-1 text-sm text-muted">
            <Moon size={14} /> Mode nuit
          </span>
        )}
        <div className="flex-1" />
        <div className="order-last flex w-full items-center gap-2 md:order-none md:w-auto">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => move(-1)} aria-label="Précédent">
              <ChevronLeft size={22} />
            </Button>
            <Button size="sm" onClick={() => setAnchor(startOfDay(new Date()))} className="h-10 px-4">
              Aujourd&apos;hui
            </Button>
            <Button variant="ghost" size="icon" onClick={() => move(1)} aria-label="Suivant">
              <ChevronRight size={22} />
            </Button>
          </div>
          <span className="min-w-0 flex-1 truncate text-sm font-semibold md:w-52 md:flex-none">{title}</span>
          <div className="flex rounded-full bg-surface-2 p-1">
            {VIEWS.map((v) => (
              <button
                key={v.id}
                onClick={() => setView(v.id)}
                className={clsx(
                  "h-9 rounded-full px-3 text-sm font-medium transition sm:px-4",
                  view === v.id ? "bg-surface shadow-sm" : "text-muted hover:text-text",
                  v.id === "day" && "hidden sm:block",
                )}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => setAvailability(true)} title="Trouver un créneau libre">
            <CalendarSearch size={20} />
          </Button>
          <Link href="/settings" className="inline-flex h-11 w-11 items-center justify-center rounded-full hover:bg-surface-2" title="Réglages">
            <Settings size={20} />
          </Link>
        </div>
      </header>

      {/* ---------- filters + quick add ---------- */}
      <div className="flex shrink-0 flex-col gap-2 px-3 py-3 sm:px-5 lg:flex-row lg:items-center">
        <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 lg:max-w-[50%]">
          <Chip active={!filter} onClick={() => setFilter(null)}>
            Tous
          </Chip>
          {profiles.map((p) => (
            <Chip key={p.id} active={filter === p.id} color={p.color} onClick={() => setFilter(filter === p.id ? null : p.id)}>
              <Avatar profile={p} size={22} />
              {p.name}
            </Chip>
          ))}
        </div>
        <div className="hidden flex-1 md:block">
          <QuickAdd
            now={now}
            onOpenEditor={openNew}
            onAskAssistant={(text) => setAssistant({ open: true, text })}
            onMic={() => setAssistant({ open: true, listen: true })}
          />
        </div>
      </div>

      {/* ---------- main ---------- */}
      <main className="flex min-h-0 flex-1 gap-4 px-2 pb-2 sm:px-5 sm:pb-5">
        <section
          className="min-h-0 min-w-0 flex-1 overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface shadow-card"
          onPointerDown={(e) => e.pointerType === "touch" && (swipe.current = { x: e.clientX, y: e.clientY })}
          onPointerUp={(e) => {
            const s = swipe.current;
            swipe.current = null;
            if (!s || e.pointerType !== "touch") return;
            const dx = e.clientX - s.x;
            const dy = e.clientY - s.y;
            if (Math.abs(dx) > 90 && Math.abs(dx) > Math.abs(dy) * 1.5) move(dx < 0 ? 1 : -1);
          }}
        >
          {(view === "week" || view === "day") && (
            <div className={clsx("h-full", view === "week" && "overflow-x-auto")}>
              <div className={clsx("h-full", view === "week" && isMobile && "min-w-[720px]")}>
                <TimeGrid
                  days={view === "day" ? [anchor] : daysBetween(range.start, range.end)}
                  occurrences={occurrences}
                  conflictKeys={conflictKeys}
                  dayStartHour={settings.dayStartHour}
                  dayEndHour={settings.dayEndHour}
                  now={now}
                  onSlot={(start) => openNew({ start: start.toISOString(), end: new Date(start.getTime() + 3600_000).toISOString() })}
                  onEvent={setDetail}
                />
              </div>
            </div>
          )}
          {view === "month" && (
            <MonthView
              anchor={anchor}
              start={range.start}
              end={range.end}
              occurrences={occurrences}
              conflictKeys={conflictKeys}
              now={now}
              onDay={(d) => {
                setAnchor(d);
                setView("day");
              }}
              onEvent={setDetail}
            />
          )}
          {view === "agenda" && (
            <AgendaView
              start={range.start}
              end={range.end}
              occurrences={occurrences}
              conflictKeys={conflictKeys}
              now={now}
              onEvent={setDetail}
              onDay={(d) => {
                setAnchor(d);
                setView("day");
              }}
            />
          )}
        </section>

        {isWide && view !== "agenda" && (
          <aside className="scroll-thin flex w-[340px] shrink-0 flex-col gap-3 overflow-y-auto">
            <div className="flex items-baseline justify-between px-1">
              <h2 className="text-lg font-semibold">Aujourd&apos;hui</h2>
              <span className="text-sm text-muted">{today.occurrences.length} événement(s)</span>
            </div>
            {today.occurrences.length === 0 && <p className="rounded-2xl bg-surface px-4 py-6 text-center text-muted shadow-card">Journée libre ✨</p>}
            {today.occurrences.map((o) => (
              <AgendaRow key={o.key} occ={o} day={today.occurrences} conflict={today.conflictKeys.has(o.key)} now={now} onClick={() => setDetail(o)} />
            ))}
            {conflicts.length > 0 && (
              <div className="rounded-2xl border border-warn/30 bg-warn/10 p-4 text-sm">
                <div className="mb-2 flex items-center gap-2 font-semibold text-warn">
                  <AlertTriangle size={16} /> {conflicts.length} conflit(s) sur la période
                </div>
                <ul className="space-y-1.5 text-text/80">
                  {conflicts.slice(0, 5).map((c, i) => (
                    <li key={i}>
                      <button className="text-left hover:underline" onClick={() => setDetail(c.a)}>
                        {fmt(c.a.start, "EEE d")} · {c.message}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <button
              onClick={() => setAssistant({ open: true, listen: true })}
              className="mt-auto flex items-center gap-3 rounded-2xl bg-accent-soft p-4 text-left text-accent transition hover:opacity-90"
            >
              <Sparkles size={22} />
              <span>
                <span className="block font-semibold">Demander à HomeCal</span>
                <span className="text-sm opacity-80">« Quand sommes-nous libres samedi ? »</span>
              </span>
            </button>
          </aside>
        )}
      </main>

      {/* ---------- mobile bottom bar ---------- */}
      <div className="safe-bottom shrink-0 border-t border-border bg-bg/95 px-3 pt-2 backdrop-blur md:hidden">
        <QuickAdd
          compact
          now={now}
          onOpenEditor={openNew}
          onAskAssistant={(text) => setAssistant({ open: true, text })}
          onMic={() => setAssistant({ open: true, listen: true })}
        />
      </div>

      {/* ---------- overlays ---------- */}
      {detail && (
        <EventDetail
          occ={detail}
          dayOccurrences={dayOf(detail)}
          conflicts={conflicts}
          now={now}
          onClose={() => setDetail(null)}
          onEdit={() => {
            setEditor({ occurrence: detail });
            setDetail(null);
          }}
        />
      )}
      {editor && <EventEditor key={editor.occurrence?.key ?? "new"} request={editor} onClose={() => setEditor(null)} />}
      {availability && (
        <AvailabilitySheet
          now={now}
          onClose={() => setAvailability(false)}
          onCreate={(draft) => {
            setAvailability(false);
            openNew(draft);
          }}
        />
      )}
      <AssistantPanel
        open={assistant.open}
        initialText={assistant.text}
        startListening={assistant.listen}
        onClose={() => setAssistant({ open: false })}
      />
      {ambient && <AmbientScreen now={now} night={night} onWake={wake} />}
      <ReminderWatcher />
      <Toaster />
    </div>
  );
}
