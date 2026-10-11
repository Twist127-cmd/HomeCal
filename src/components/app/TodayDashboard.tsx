"use client";

import { ArrowDown, ArrowUp, CalendarDays, Check, ChevronRight, Home, LayoutGrid, MapPin, Mic, Music2, Pause, Play, RotateCcw, ShoppingCart, SlidersHorizontal, Sparkles, Timer, X } from "lucide-react";
import { useRef, type ReactNode } from "react";
import { useApp } from "./AppProvider";
import type { PanelId } from "./Panels";
import { useMusic } from "@/components/music/MusicContext";
import { MiniPlayer } from "@/components/music/MiniPlayer";
import { DeparturePill } from "@/components/navigation/Departure";
import { useScenes } from "@/components/scenes/SceneContext";
import { Button } from "@/components/ui/primitives";
import { WeatherIcon } from "@/components/ui/WeatherIcon";
import { toast } from "@/components/ui/toast";
import { useVoice } from "@/components/voice/VoiceContext";
import { useModuleStores } from "@/hooks/useModules";
import { useNow } from "@/hooks/useNow";
import { useForecast } from "@/hooks/useWeather";
import type { NextDeparture } from "@/hooks/useNextDeparture";
import { DEFAULT_HOME_LAYOUT, greeting, reorderWidget, type HomeWidget, type HomeWidgetId } from "@/lib/appearance";
import { WIDGET_REGISTRY } from "@/layout/widgetRegistry";
import { useWidgetLayout } from "@/layout/widgetLayoutStore";
import Link from "next/link";
import { capitalize, fmt, fmtRelativeDay, fmtTime } from "@/lib/dates";
import { vibrate } from "@/lib/sound";
import { formatRemaining, nowMs, pauseTimer, remainingMs, resumeTimer } from "@/lib/timers";
import type { Occurrence } from "@/lib/types";
import { describeWeather } from "@/providers/weather/WeatherProvider";

const WIDGETS: Record<HomeWidgetId, { label: string; icon: ReactNode }> = {
  clock: { label: "Heure", icon: <Timer size={18} /> },
  weather: { label: "Météo", icon: <Sparkles size={18} /> },
  departure: { label: "Départ conseillé", icon: <MapPin size={18} /> },
  calendar: { label: "Agenda", icon: <CalendarDays size={18} /> },
  profiles: { label: "Profils", icon: <Home size={18} /> },
  availability: { label: "Disponibilités", icon: <CalendarDays size={18} /> },
  next: { label: "Prochain événement", icon: <CalendarDays size={18} /> },
  music: { label: "Musique", icon: <Music2 size={18} /> },
  assistant: { label: "Votre assistant", icon: <Sparkles size={18} /> },
  shopping: { label: "Courses", icon: <ShoppingCart size={18} /> },
  timers: { label: "Minuteurs", icon: <Timer size={18} /> },
  house: { label: "Maison", icon: <Home size={18} /> },
};

export function TodayDashboard({ now, next, departure, today, editing, onEditing, onEvent, onPanel, onAssistant, onCalendar, onAvailability, layoutOverride, preview }: {
  now: Date; next: Occurrence | null; departure: NextDeparture | null; today: Occurrence[];
  editing: boolean; onEditing(value: boolean): void;
  onEvent(o: Occurrence): void; onPanel(p: PanelId): void; onAssistant(): void; onCalendar(): void;
  onAvailability?(): void; layoutOverride?: HomeWidget[]; preview?: boolean;
}) {
  const { household, homePlace, timers, shopping, profiles } = useApp();
  const music = useMusic();
  const voice = useVoice();
  const forecast = useForecast();
  const cur = forecast?.current;
  const weather = cur ? describeWeather(cur.weatherCode, cur.isDay) : null;
  const stored = useWidgetLayout();
  const layout = layoutOverride ?? stored.layout.widgets;
  const drag = useRef<HomeWidgetId | null>(null);
  const activeTimers = timers.some((t) => t.status === "running" || t.status === "paused");
  const playing = music.enabled && music.connected && !!music.playback?.item;
  const enabled = (id: HomeWidgetId) => WIDGET_REGISTRY[id].enabled();
  const available = enabled;
  const save = (value: HomeWidget[]) => {
    if (!stored.save(value)) {
      toast({ text: "Cette disposition restera disponible jusqu’à la fermeture de l’écran." });
    }
    vibrate();
  };
  const voiceState = voice.state === "command-listening" || voice.state === "wakeword-detected" ? "command-listening" : voice.state === "wakeword-listening" ? "wakeword-listening" : voice.state === "processing" ? "processing" : voice.state === "speaking" ? "speaking" : "idle";
  const voiceLabel = voiceState === "command-listening" ? "J’écoute…" : voiceState === "processing" ? "Un instant…" : voiceState === "speaking" ? "Voici ma réponse." : "Un mot, et c’est fait.";
  const content = (id: HomeWidgetId, size: HomeWidget["size"]) => {
    switch (id) {
      case "clock": return <div><time className="widget-clock tabular" data-size={size} dateTime={now.toISOString()}>{fmt(now, "HH:mm")}</time>{size !== "compact" && <p className="mt-2 text-sm text-muted">{capitalize(fmt(now, "EEEE d MMMM"))}</p>}</div>;
      case "weather": return cur && weather ? <div><div className="flex items-center gap-3"><WeatherIcon code={cur.weatherCode} isDay={cur.isDay} size={size === "compact" ? 24 : 36} /><span className="tabular text-4xl font-medium">{Math.round(cur.temperature)}°</span></div>{size !== "compact" && <><p className="mt-3 text-sm text-muted">{weather.label}{forecast?.daily[0] && ` · ${Math.round(forecast.daily[0].tMin)}° / ${Math.round(forecast.daily[0].tMax)}°`}</p>{homePlace && <p className="mt-1 truncate text-xs text-muted">{homePlace.name}</p>}</>}{size === "large" && <><p className="mt-3 text-sm text-muted">Vent {Math.round(cur.windSpeed ?? 0)} km/h · Pluie {cur.precipitationProbability ?? 0}%</p><div className="mt-3 flex flex-wrap gap-3">{forecast?.daily.slice(1, 4).map((day) => <div key={String(day.date)} className="rounded-xl bg-surface-2 p-3 text-sm"><p>{fmt(day.date, "EEE")}</p><p className="tabular mt-1">{Math.round(day.tMin)}° / {Math.round(day.tMax)}°</p></div>)}</div></>}</div> : <p className="text-sm text-muted">{homePlace ? "La météo se charge…" : "Ajoutez un domicile dans les lieux favoris pour afficher la météo."}</p>;
      case "departure": return departure?.travel ? <div><p className="tabular text-3xl font-medium">{fmtTime(departure.travel.departAt)}</p>{size !== "compact" && <p className="mt-2 text-sm text-muted">{departure.occ.event.title} · {departure.travel.route.durationMin} min de trajet</p>}<div className="mt-3"><DeparturePill departure={departure} /></div></div> : <p className="text-sm text-muted">Pas de départ conseillé pour le moment.</p>;
      case "calendar": return <div><div className="space-y-2">{today.slice(0, size === "compact" ? 2 : size === "large" ? 10 : 4).map((o) => <button key={o.key} onClick={() => onEvent(o)} className="flex min-h-12 w-full items-center gap-3 rounded-xl bg-surface-2 px-3 text-left"><span className="tabular shrink-0 text-sm text-muted">{o.event.allDay ? "Journée" : fmtTime(o.start)}</span><span className="min-w-0 flex-1 truncate">{o.event.title}</span><ChevronRight size={16} /></button>)}</div>{!today.length && <p className="text-sm text-muted">Aucun événement prévu aujourd’hui.</p>}<Button className="mt-3" onClick={onCalendar}>Ouvrir le calendrier</Button></div>;
      case "profiles": return <div className="flex flex-wrap gap-2">{profiles.map((p) => <span key={p.id} className="flex min-h-11 items-center gap-2 rounded-full bg-surface-2 px-3"><span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color }} />{size !== "compact" && <span aria-hidden="true">{p.avatar}</span>}{p.name}</span>)}{!profiles.length && <p className="text-sm text-muted">Ajoutez vos profils dans les réglages.</p>}</div>;
      case "availability": return <div><p className="text-sm text-muted">Trouvez un créneau commun à partir des agendas du foyer.</p><Button className="mt-3" onClick={onAvailability ?? onCalendar}>Chercher une disponibilité</Button></div>;
      case "next": return next ? (
        <div>
          <p className="text-sm text-muted">{fmtRelativeDay(next.start, now)} · <span className="tabular">{next.event.allDay ? "Toute la journée" : fmtTime(next.start) + " – " + fmtTime(next.end)}</span></p>
          <button onClick={() => onEvent(next)} className="mt-2 flex min-h-11 w-full items-center gap-3 text-left">
            <span className="min-w-0 flex-1 break-words text-2xl font-medium tracking-tight sm:text-3xl">{next.event.title}</span><ChevronRight size={22} className="shrink-0 text-muted" />
          </button>
          {size !== "compact" && next.event.location && <p className="mt-3 flex items-start gap-2 text-sm text-muted"><MapPin size={16} className="mt-0.5 shrink-0" /><span>{next.event.location.address || next.event.location.label}</span></p>}
          {size !== "compact" && departure?.travel && <div className="mt-5 space-y-2"><p className="text-sm text-muted">Départ conseillé <span className="tabular font-medium text-text">{fmtTime(departure.travel.departAt)}</span> · {departure.travel.route.durationMin} min de trajet{departure.occ.key !== next.key && <span className="block mt-1">{departure.occ.event.title}</span>}</p><DeparturePill departure={departure} /></div>}
          {size === "large" && <ul className="mt-3 space-y-2">{today.filter((o) => o.key !== next.key).slice(0, 3).map((o) => <li key={o.key} className="text-sm text-muted">{fmtTime(o.start)} · {o.event.title}</li>)}</ul>}
          <button onClick={onCalendar} className="mt-5 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-accent">Voir le programme <ChevronRight size={16} /></button>
        </div>
      ) : (
        <div><p className="text-xl font-medium">Un peu de temps pour vous.</p><p className="mt-2 text-sm text-muted">Aucun prochain événement dans les 24 heures.</p><Button className="mt-4" onClick={onCalendar}>Ouvrir le calendrier</Button></div>
      );
      case "assistant": return (
        <button onClick={onAssistant} className={"flex w-full items-start gap-5 text-left " + (size === "compact" ? "flex-row flex-wrap" : "flex-col")}>
          <span className="assistant-orb" data-state={voiceState}><Mic size={27} strokeWidth={1.5} /></span>
          <span><span className="block text-xl font-medium">{voiceLabel}</span><span className="mt-2 block text-sm leading-relaxed text-muted">« Ajoute du lait aux courses »</span></span>
          <span className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-accent">Parler à HomeCal <ChevronRight size={16} /></span>
        </button>
      );
      case "music": return playing ? (
        <div className="space-y-3">
          <MiniPlayer onOpen={() => onPanel("music")} size={size} className="!border-0 !shadow-none" />
          {size === "large" && <Button onClick={() => onPanel("music")}><Music2 size={16} /> Playlists et appareils</Button>}
        </div>
      ) : <div className="spotify-empty rounded-2xl p-4"><p className="text-xs font-medium tracking-widest">Spotify</p><p className="mt-2 text-sm">{music.connected ? "Aucune lecture en cours." : "Connectez Spotify pour piloter votre musique."}</p><Button className="mt-3" onClick={() => onPanel("music")}>{music.connected ? "Choisir une playlist" : "Connecter Spotify"}</Button>{music.connected && <button className="mt-2 block min-h-11 text-sm" onClick={() => onPanel("music")}>Parcourir la musique et les écoutes récentes</button>}</div>;
      case "timers": return activeTimers ? <HomeTimers size={size} /> : <div><p className="text-sm text-muted">Aucun minuteur actif.</p><Button className="mt-3" onClick={() => onPanel("timers")}>Créer un minuteur</Button></div>;
      case "shopping": return <ShoppingPreview items={shopping} size={size} onOpen={() => onPanel("shopping")} />;
      case "house": return <HousePreview size={size} onOpen={() => onPanel("scenes")} />;
    }
  };
  return (
    <div className="home-content">
      <div className="flex items-center justify-between gap-3">
        <p className="home-eyebrow truncate">{household?.name || "HomeCal"} <span className="mx-2 opacity-40">/</span> Aujourd’hui</p>
        {!preview && <Link className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm text-muted" href="/settings#apparence"><SlidersHorizontal size={19} /><span className="hidden sm:inline">Personnaliser</span></Link>}
      </div>
      <header className="home-hero">
        <div className="min-w-0">
          <h1 className="home-greeting">{greeting(now.getHours())}</h1>
          <p className="home-date">{capitalize(fmt(now, "EEEE d MMMM"))}</p>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-muted">{today.length ? today.length + (today.length > 1 ? " moments prévus aujourd’hui." : " moment prévu aujourd’hui.") : "La maison prend le temps de vivre."}</p>
        </div>
      </header>

      {editing && <section className="glass-panel mb-5 p-4" aria-label="Personnalisation de l’accueil">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="font-medium">Votre accueil, à votre rythme.</h2><p className="mt-1 text-sm text-muted">Déplacez les cartes avec les flèches ou faites-les glisser.</p></div>
          <div className="flex gap-2"><Button onClick={() => save(DEFAULT_HOME_LAYOUT)} aria-label="Restaurer la disposition"><RotateCcw size={16} /> Restaurer</Button><Button variant="primary" onClick={() => onEditing(false)}><Check size={16} /> Terminer</Button></div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">{layout.filter((w) => enabled(w.id)).map((w) => <Button key={w.id} variant={w.visible ? "soft" : "default"} onClick={() => save(layout.map((x) => x.id === w.id ? { ...x, visible: !x.visible } : x))} aria-pressed={w.visible}>{WIDGETS[w.id].icon}{WIDGETS[w.id].label}</Button>)}</div>
      </section>}

      <div className="home-grid">
        {layout.filter((w) => w.visible && (editing ? enabled(w.id) : available(w.id))).map((w) => {
          const editableOrder = layout.filter((x) => x.visible && enabled(x.id));
          const index = editableOrder.findIndex((x) => x.id === w.id);
          const urgent = w.id === "departure" && departure?.travel && departure.travel.departAt.getTime() - now.getTime() < 15 * 60_000 || w.id === "timers" && timers.some((t) => t.status === "running" && remainingMs(t, now.getTime()) < 60_000) || w.id === "next" && next && next.start.getTime() - now.getTime() < 15 * 60_000;
          return <section key={w.id} className="home-widget glass-panel" data-widget={w.id} data-size={w.size} data-width={w.width} data-urgent={!!urgent} aria-label={WIDGETS[w.id].label}
            draggable={editing}
            onDragStart={(e) => { if (!editing) return; drag.current = w.id; e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", w.id); }}
            onDragOver={(e) => { if (editing && drag.current) e.preventDefault(); }}
            onDrop={(e) => { if (!editing || !drag.current) return; e.preventDefault(); save(reorderWidget(layout, drag.current, w.id)); drag.current = null; }}
            onDragEnd={() => { drag.current = null; }}>
            {editing && <div className="mb-3 flex items-center gap-1 border-b border-border pb-3">
              <LayoutGrid size={16} className="mr-auto text-muted" />
              <Button variant="ghost" size="icon" disabled={index === 0} onClick={() => save(reorderWidget(layout, w.id, editableOrder[index - 1].id))} aria-label={"Avancer " + WIDGETS[w.id].label}><ArrowUp size={16} /></Button>
              <Button variant="ghost" size="icon" disabled={index === editableOrder.length - 1} onClick={() => save(reorderWidget(layout, w.id, editableOrder[index + 1].id))} aria-label={"Reculer " + WIDGETS[w.id].label}><ArrowDown size={16} /></Button>
              <Button variant="ghost" size="icon" onClick={() => save(layout.map((x) => x.id === w.id ? { ...x, visible: false } : x))} aria-label={"Masquer " + WIDGETS[w.id].label}><X size={16} /></Button>
            </div>}
            <h2 className="home-widget-title">{WIDGETS[w.id].icon}{WIDGETS[w.id].label}</h2>
            {editing && WIDGET_REGISTRY[w.id].sizes.length > 1 && <label className="mb-4 block text-sm text-muted">Taille <select className="ml-2 min-h-11 rounded-xl border border-border bg-surface px-3" value={w.size} onChange={(e) => save(layout.map((x) => x.id === w.id ? { ...x, size: e.target.value as HomeWidget["size"] } : x))}>{WIDGET_REGISTRY[w.id].sizes.map((size) => <option key={size} value={size}>{size === "compact" ? "Compact" : size === "large" ? "Large" : "Standard"}</option>)}</select></label>}
            {content(w.id, w.size)}
          </section>;
        })}
      </div>
      {!editing && !layout.some((w) => w.visible && available(w.id)) && <Link href="/settings#apparence" className="inline-flex min-h-11 items-center rounded-xl bg-surface px-4 text-accent">Choisir les widgets</Link>}
    </div>
  );
}

function ShoppingPreview({ items, onOpen, size }: { items: ReturnType<typeof useApp>["shopping"]; onOpen(): void; size: HomeWidget["size"] }) {
  const stores = useModuleStores();
  const list = items.filter((s) => !s.checked).slice(0, size === "compact" ? 3 : size === "large" ? 10 : 5);
  return <div>
    <ul className="space-y-1">{list.map((s) => <li key={s.id}><button onClick={async () => {
      if (!stores) return;
      try { await stores.shopping.update(s.id, { checked: true, checkedAt: new Date().toISOString() }); vibrate(); toast({ text: s.name + " coché", tone: "success", action: { label: "Annuler", run: () => stores.shopping.update(s.id, { checked: false }) } }); }
      catch { toast({ text: "Impossible de modifier les courses.", tone: "error" }); }
    }} className="flex min-h-11 w-full items-center gap-3 text-left"><span className="h-5 w-5 shrink-0 rounded-full border border-border" /><span className="min-w-0 break-words">{s.quantity ? s.quantity + " " : ""}{s.name}</span></button></li>)}</ul>
    {!list.length && <p className="text-sm text-muted">Tout est prêt. Ajoutez vos prochaines envies.</p>}
    <button onClick={onOpen} className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-accent">Toute la liste <ChevronRight size={16} /></button>
  </div>;
}

function HomeTimers({ size }: { size: HomeWidget["size"] }) {
  const { timers } = useApp();
  const stores = useModuleStores();
  const tick = useNow(1000).getTime();
  return <div className="space-y-4">{timers.filter((t) => t.status === "running" || t.status === "paused").slice(0, size === "compact" ? 1 : size === "large" ? timers.length : 2).map((t) => <div key={t.id} className="flex items-center gap-2">
    <div className="min-w-0 flex-1"><p className="truncate text-sm text-muted">{t.label}</p><p className="tabular text-3xl font-medium tracking-tight">{formatRemaining(remainingMs(t, tick))}</p></div>
    <Button variant="ghost" size="icon" aria-label={(t.status === "paused" ? "Reprendre " : "Mettre en pause ") + t.label} onClick={() => {
      stores?.timers.update(t.id, t.status === "paused" ? resumeTimer(t, nowMs()) : pauseTimer(t, nowMs())).catch(() => toast({ text: "Impossible de modifier le minuteur.", tone: "error" })); vibrate();
    }}>{t.status === "paused" ? <Play size={18} /> : <Pause size={18} />}</Button>
    <Button variant="ghost" size="icon" aria-label={"Arrêter " + t.label} onClick={() => { stores?.timers.remove(t.id).catch(() => toast({ text: "Impossible d’arrêter le minuteur.", tone: "error" })); vibrate(); }}><X size={18} /></Button>
  </div>)}</div>;
}

function HousePreview({ onOpen, size }: { onOpen(): void; size: HomeWidget["size"] }) {
  const { scenes, active, activate } = useScenes();
  return <div className="space-y-2">
    {scenes.slice(0, size === "compact" ? 1 : size === "large" ? scenes.length : 3).map((s) => <button key={s.id} onClick={() => { activate(s.id); vibrate(); }} className="flex min-h-12 w-full items-center gap-3 rounded-xl bg-surface-2 px-3 text-left" aria-pressed={active?.id === s.id}><Home size={18} className="text-accent" /><span className="min-w-0 flex-1 truncate">{s.name}</span><ChevronRight size={16} className="text-muted" /></button>)}
    {!scenes.length && <p className="text-sm text-muted">Retrouvez vos ambiances de maison dans les scènes.</p>}
    <button onClick={onOpen} className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-accent">Toutes les scènes <ChevronRight size={16} /></button>
  </div>;
}
