"use client";

import clsx from "clsx";
import { addDays, addMonths, addWeeks } from "date-fns";
import { AlertTriangle, ChevronLeft, ChevronRight, Mic, Moon, Music2, Settings, ShoppingCart, Sparkles, Timer as TimerIcon, Wand2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { TodayDashboard } from "@/components/app/TodayDashboard";
import { WeatherIcon } from "@/components/ui/WeatherIcon";
import { AmbientScreen } from "@/components/app/AmbientScreen";
import { useApp } from "@/components/app/AppProvider";
import { ContextualActions } from "@/components/app/ContextualActions";
import { BottomNav, DesktopTools, MoreMenu, type MobileTab } from "@/components/app/Navigation";
import { SidePanel, type PanelId } from "@/components/app/Panels";
import { ReminderWatcher } from "@/components/app/ReminderWatcher";
import { AssistantPanel } from "@/components/assistant/AssistantPanel";
import { AgendaRow, AgendaView } from "@/components/calendar/AgendaView";
import { AvailabilitySheet } from "@/components/calendar/AvailabilitySheet";
import { EventDetail } from "@/components/calendar/EventDetail";
import { EventEditor, type EditorRequest } from "@/components/calendar/EventEditor";
import { MonthView } from "@/components/calendar/MonthView";
import { QuickAdd } from "@/components/calendar/QuickAdd";
import { TimeGrid } from "@/components/calendar/TimeGrid";
import { MiniPlayer } from "@/components/music/MiniPlayer";
import { useMusic } from "@/components/music/MusicContext";
import { MusicPanel } from "@/components/music/MusicPanel";
import { DeparturePill, useNavigationLauncher } from "@/components/navigation/Departure";
import { useScenes } from "@/components/scenes/SceneContext";
import { ScenesPanel } from "@/components/scenes/ScenesPanel";
import { SceneView } from "@/components/scenes/SceneView";
import { ShoppingPanel } from "@/components/shopping/ShoppingPanel";
import { TimerAlarm, TimerChips, TimersPanel } from "@/components/timers/Timers";
import { Avatar, Button, Chip, Sheet } from "@/components/ui/primitives";
import { toast, Toaster } from "@/components/ui/toast";
import { useIdle } from "@/hooks/useIdle";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useNextDeparture } from "@/hooks/useNextDeparture";
import { useNow } from "@/hooks/useNow";
import { useOccurrences } from "@/hooks/useOccurrences";
import { useForecast } from "@/hooks/useWeather";
import type { ContextualAction } from "@/lib/contextual";
import { createReminder } from "@/lib/data/household";
import { capitalize, clampToDay, daysBetween, fmt, fmtTime, inTimeWindow, startOfDay, viewRange, type ViewMode } from "@/lib/dates";
import { firestore } from "@/lib/firebase/client";
import { findBestMatch } from "@/providers/music";
import type { NewEvent, Occurrence } from "@/lib/types";
import { describeWeather } from "@/providers/weather/WeatherProvider";

const VIEWS: { id: ViewMode; label: string }[] = [
  { id: "day", label: "Jour" },
  { id: "week", label: "Semaine" },
  { id: "month", label: "Mois" },
  { id: "agenda", label: "Agenda" },
];

const PANEL_META: Record<Exclude<PanelId, "more">, { title: string; icon: React.ReactNode }> = {
  music: { title: "Musique", icon: <Music2 size={18} /> },
  timers: { title: "Minuteurs", icon: <TimerIcon size={18} /> },
  shopping: { title: "Courses", icon: <ShoppingCart size={18} /> },
  scenes: { title: "Scènes", icon: <Wand2 size={18} /> },
};

export function HomeScreen() {
  const { household, householdId, profiles, myProfileId } = useApp();
  const music = useMusic();
  const { active: scene, activate: activateScene } = useScenes();
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
  const [panel, setPanel] = useState<PanelId | null>(null);
  const [addSheet, setAddSheet] = useState(false);
  const [customizing, setCustomizing] = useState(false);
  const [mobileTab, setMobileTab] = useState<MobileTab>("today");
  const settings = household!.settings;
  const [idle, wake] = useIdle(isMobile ? 0 : settings.ambientAfterSec);
  const night = settings.nightMode.enabled && inTimeWindow(now, settings.nightMode.start, settings.nightMode.end);
  const overlayOpen = !!editor || assistant.open || availability || !!panel || addSheet || customizing;
  const ambient = idle && !overlayOpen && !scene;
  const { launch, chooser } = useNavigationLauncher();

  // Spotify OAuth return → show the music panel
  useEffect(() => {
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("spotify") === "connected") {
      const t = setTimeout(() => setPanel("music"), 300);
      return () => clearTimeout(t);
    }
  }, []);

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
  const { next, departure } = useNextDeparture(now);

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
  const swipe = useRef<{ x: number; y: number } | null>(null);

  const forecast = useForecast();
  const cur = forecast?.current;
  const curW = cur ? describeWeather(cur.weatherCode, cur.isDay) : null;

  const openPanel = (p: PanelId | null) => setPanel(p);

  const onAction = async (a: ContextualAction) => {
    switch (a.id) {
      case "myDay":
        setAnchor(startOfDay(new Date()));
        setView(isMobile ? "agenda" : "day");
        setMobileTab("calendar");
        break;
      case "tomorrow":
        setMobileTab("calendar");
        setAnchor(addDays(startOfDay(new Date()), 1));
        setView("day");
        break;
      case "music":
        openPanel("music");
        break;
      case "relax": {
        if (!music.connected) return openPanel("music");
        await music.loadLibrary();
        const r = findBestMatch("relax", music.playlists).item ?? findBestMatch("chill", music.playlists).item ?? findBestMatch("calme", music.playlists).item;
        if (r) {
          music.playItem(r);
          toast({ text: `✓ ${r.name} lancée`, tone: "success" });
        } else openPanel("music");
        break;
      }
      case "route":
      case "firstDeparture":
        if (a.occurrence?.event.location) launch(a.occurrence.event.location, departure?.travel?.route.mode);
        else if (a.occurrence) setDetail(a.occurrence);
        break;
      case "remindMe": {
        const o = a.occurrence;
        if (!o || !householdId) break;
        const at = departure?.occ.key === o.key && departure.travel ? new Date(departure.travel.departAt.getTime() - 5 * 60000) : new Date(o.start.getTime() - 30 * 60000);
        const when = at > new Date() ? at : new Date(Date.now() + 5 * 60000);
        const r = await createReminder(firestore(), householdId, {
          text: `${o.event.title} à ${fmtTime(o.start)}`,
          at: when.toISOString(),
          profileIds: myProfileId ? [myProfileId] : [],
          eventId: o.event.id,
          done: false,
        });
        toast({ text: `⏰ Rappel à ${fmtTime(when)}`, tone: "success", action: { label: "Annuler", run: () => import("@/lib/data/household").then((m) => m.deleteReminder(firestore(), householdId, r.id)) } });
        break;
      }
      case "viewPlace": {
        const l = a.occurrence?.event.location;
        if (l?.lat !== undefined) window.open(`https://www.openstreetmap.org/?mlat=${l.lat}&mlon=${l.lng}#map=16/${l.lat}/${l.lng}`, "_blank", "noopener");
        else if (a.occurrence) setDetail(a.occurrence);
        break;
      }
      case "findSlot":
        setAvailability(true);
        break;
      case "commonEvent":
        openNew({ profileIds: filter ? [filter] : [] });
        break;
      case "timer":
        openPanel("timers");
        break;
      case "shopping":
        openPanel("shopping");
        break;
      case "scene":
        if (a.sceneId) activateScene(a.sceneId);
        break;
    }
  };

  const panelContent = (p: Exclude<PanelId, "more">) =>
    p === "music" ? <MusicPanel compact /> : p === "timers" ? <TimersPanel /> : p === "shopping" ? <ShoppingPanel /> : <ScenesPanel onActivated={() => setPanel(null)} />;

  const showHome = mobileTab === "today";
  const dockPanel = !showHome && isWide && panel && panel !== "more";

  return (
    <div className="home-shell flex h-dvh flex-col overflow-hidden">
      {showHome ? (
        <main className="scroll-thin min-h-0 flex-1 overflow-y-auto">
          <TodayDashboard key={householdId} now={now} next={next} departure={departure} today={today.occurrences} editing={customizing} onEditing={setCustomizing} onEvent={setDetail} onPanel={openPanel} onAssistant={() => setAssistant({ open: true, listen: true })} onCalendar={() => { setMobileTab("calendar"); setCustomizing(false); }} />
        </main>
      ) : (
      <>
      {/* ---------- header ---------- */}
      <header className="safe-top flex shrink-0 flex-wrap items-center gap-x-2 gap-y-2 px-3 sm:gap-x-4 sm:px-5">
        <div className="flex min-w-0 items-baseline gap-2 sm:gap-3">
          <span className="tabular text-2xl font-semibold tracking-tight sm:text-4xl">{fmt(now, "HH:mm")}</span>
          <span className="truncate text-sm font-medium text-muted sm:hidden">{fmt(now, "EEE d MMM")}</span>
          <span className="hidden truncate text-base font-medium text-muted sm:inline">{capitalize(fmt(now, "EEEE d MMMM"))}</span>
        </div>
        {curW && cur && (
          <span className="flex items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-sm shadow-card" title={curW.label}>
            <WeatherIcon code={cur.weatherCode} isDay={cur.isDay} size={22} />
            <span className="tabular font-semibold">{Math.round(cur.temperature)}°</span>
            {forecast?.daily[0] && (
              <span className="hidden text-muted xl:inline">
                {Math.round(forecast.daily[0].tMin)}°/{Math.round(forecast.daily[0].tMax)}°
              </span>
            )}
          </span>
        )}
        {night && (
          <span className="hidden items-center gap-1 text-sm text-muted sm:flex">
            <Moon size={14} /> Mode nuit
          </span>
        )}
        <div className="flex-1" />
        <div className="order-last flex w-full flex-col gap-2 md:order-none md:w-auto md:flex-row md:items-center">
          <div className="flex min-w-0 items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => move(-1)} aria-label="Précédent">
              <ChevronLeft size={22} />
            </Button>
            <Button size="sm" onClick={() => setAnchor(startOfDay(new Date()))} className="h-10 px-4">
              Aujourd&apos;hui
            </Button>
            <Button variant="ghost" size="icon" onClick={() => move(1)} aria-label="Suivant">
              <ChevronRight size={22} />
            </Button>
            <span className="ml-1 min-w-0 flex-1 truncate text-sm font-semibold md:w-40 md:flex-none xl:w-48">{title}</span>
          </div>
          <div className="order-first grid w-full grid-cols-4 rounded-full bg-surface-2 p-1 md:order-none md:flex md:w-auto">
            {VIEWS.map((v) => (
              <button
                key={v.id}
                onClick={() => {
                  setView(v.id);
                  setMobileTab("calendar");
                }}
                className={clsx("h-9 min-w-0 rounded-full px-2 text-sm font-medium transition md:px-4", view === v.id ? "bg-surface shadow-sm" : "text-muted hover:text-text")}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>
        <Link href="/settings" className="inline-flex h-11 w-11 items-center justify-center rounded-full hover:bg-surface-2" title="Réglages" aria-label="Réglages">
          <Settings size={20} />
        </Link>
      </header>

      {/* ---------- filters + quick add + tools ---------- */}
      <div className="flex shrink-0 flex-col gap-2 px-3 pt-3 sm:px-5 lg:flex-row lg:items-center">
        <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 lg:max-w-[45%]">
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
        <div className="hidden min-w-0 flex-1 items-center gap-2 md:flex">
          <div className="min-w-0 flex-1">
            <QuickAdd now={now} onOpenEditor={openNew} onAskAssistant={(text) => setAssistant({ open: true, text })} onMic={() => setAssistant({ open: true, listen: true })} />
          </div>
          <DesktopTools panel={panel} onPanel={openPanel} onAvailability={() => setAvailability(true)} />
        </div>
      </div>

      {/* ---------- contextual row: departure, quick actions, timers ---------- */}
      <div className="flex shrink-0 items-center gap-2 overflow-hidden px-3 py-3 sm:px-5">
        <DeparturePill departure={departure} className="shrink-0" />
        <div className="min-w-0 flex-1">
          <ContextualActions now={now} next={next} departure={departure} filter={filter} todayCount={today.occurrences.length} onAction={onAction} />
        </div>
        <TimerChips onOpen={() => openPanel("timers")} className="hidden shrink-0 md:flex" />
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

        {dockPanel ? (
          <SidePanel docked title={PANEL_META[panel].title} icon={PANEL_META[panel].icon} onClose={() => setPanel(null)}>
            {panelContent(panel)}
          </SidePanel>
        ) : (
          isWide &&
          view !== "agenda" && (
            <aside className="scroll-thin flex w-[340px] shrink-0 flex-col gap-3 overflow-y-auto">
              <MiniPlayer onOpen={() => openPanel("music")} />
              <div className="flex items-baseline justify-between px-1">
                <h2 className="text-lg font-semibold">Aujourd&apos;hui</h2>
                <span className="text-sm text-muted">{today.occurrences.length} événement(s)</span>
              </div>
              {today.occurrences.length === 0 && <p className="rounded-2xl bg-surface px-4 py-6 text-center text-muted shadow-card">Journée libre</p>}
              {today.occurrences.slice(0, 3).map((o) => (
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
                  <span className="text-sm opacity-80">« Minuteur 10 minutes pour les pâtes »</span>
                </span>
              </button>
            </aside>
          )
        )}
      </main>

      </>
      )}
      {/* ---------- floating dock ---------- */}
      {isMobile && !showHome && (
        <div className="shrink-0 px-2 pb-1 empty:hidden">
          <MiniPlayer onOpen={() => openPanel("music")} variant="bar" className="border border-border shadow-card" />
        </div>
      )}
      <BottomNav
        tab={mobileTab}
        panel={panel}
        onTab={(t) => {
          setMobileTab(t);
          setCustomizing(false);
          if (t === "today") {
            setAnchor(startOfDay(new Date()));
            setView("agenda");
          } else setView(view === "agenda" ? "month" : view);
        }}
        onAdd={() => setAddSheet(true)}
        onPanel={openPanel}
      />

      {/* ---------- overlays ---------- */}
      {scene && <SceneView scene={scene} onOpenMusic={() => openPanel("music")} />}
      {scene && (
        <button
          onClick={() => setAssistant({ open: true, listen: true })}
          className="fixed right-5 bottom-5 z-[46] flex h-16 w-16 items-center justify-center rounded-full bg-accent text-white shadow-pop active:scale-95 dark:text-black"
          aria-label="Parler à HomeCal"
        >
          <Mic size={28} />
        </button>
      )}

      {panel && !dockPanel && (
        <SidePanel
          title={panel === "more" ? "Plus" : PANEL_META[panel].title}
          icon={panel === "more" ? undefined : PANEL_META[panel].icon}
          onClose={() => setPanel(null)}
        >
          {panel === "more" ? (
            <MoreMenu
              onPanel={openPanel}
              onAvailability={() => {
                setPanel(null);
                setAvailability(true);
              }}
            />
          ) : (
            panelContent(panel)
          )}
        </SidePanel>
      )}

      {addSheet && (
        <Sheet open onClose={() => setAddSheet(false)} title="Ajouter ou demander">
          <div className="space-y-4 pb-4">
            <QuickAdd
              now={now}
              onOpenEditor={(d) => {
                setAddSheet(false);
                openNew(d);
              }}
              onAskAssistant={(text) => {
                setAddSheet(false);
                setAssistant({ open: true, text });
              }}
              onMic={() => {
                setAddSheet(false);
                setAssistant({ open: true, listen: true });
              }}
            />
            <div className="grid grid-cols-2 gap-2">
              <Button
                size="lg"
                onClick={() => {
                  setAddSheet(false);
                  openNew({});
                }}
              >
                Nouvel événement
              </Button>
              <Button
                size="lg"
                variant="soft"
                onClick={() => {
                  setAddSheet(false);
                  setAssistant({ open: true, listen: true });
                }}
              >
                <Mic size={18} /> Parler
              </Button>
            </div>
            <p className="text-center text-xs text-muted">« Minuteur 8 minutes » · « Ajoute du lait aux courses » · « Mets ma playlist Chill »</p>
          </div>
        </Sheet>
      )}

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
      <AssistantPanel open={assistant.open} initialText={assistant.text} startListening={assistant.listen} onClose={() => setAssistant({ open: false })} />
      {ambient && <AmbientScreen now={now} night={night} onWake={wake} />}
      {chooser}
      <TimerAlarm />
      <ReminderWatcher />
      <Toaster />
    </div>
  );
}
