"use client";

import { ArrowDown, ArrowUp, CalendarDays, Check, ChevronRight, Home, LayoutGrid, MapPin, Mic, Music2, Pause, Play, RotateCcw, ShoppingCart, SlidersHorizontal, Sparkles, Timer, X } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
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
import { DEFAULT_HOME_LAYOUT, greeting, HOME_LAYOUT_KEY, parseHomeLayout, reorderWidget, type HomeWidget, type HomeWidgetId } from "@/lib/appearance";
import { capitalize, fmt, fmtRelativeDay, fmtTime } from "@/lib/dates";
import { features } from "@/lib/features";
import { vibrate } from "@/lib/sound";
import { formatRemaining, nowMs, pauseTimer, remainingMs, resumeTimer } from "@/lib/timers";
import type { Occurrence } from "@/lib/types";
import { describeWeather } from "@/providers/weather/WeatherProvider";

const WIDGETS: Record<HomeWidgetId, { label: string; icon: ReactNode }> = {
  next: { label: "Prochain événement", icon: <CalendarDays size={18} /> },
  music: { label: "Musique", icon: <Music2 size={18} /> },
  assistant: { label: "Votre assistant", icon: <Sparkles size={18} /> },
  shopping: { label: "Courses", icon: <ShoppingCart size={18} /> },
  timers: { label: "Minuteurs", icon: <Timer size={18} /> },
  house: { label: "Maison", icon: <Home size={18} /> },
};

export function TodayDashboard({ now, next, departure, today, editing, onEditing, onEvent, onPanel, onAssistant, onCalendar }: {
  now: Date; next: Occurrence | null; departure: NextDeparture | null; today: Occurrence[];
  editing: boolean; onEditing(value: boolean): void;
  onEvent(o: Occurrence): void; onPanel(p: PanelId): void; onAssistant(): void; onCalendar(): void;
}) {
  const { household, householdId, homePlace, timers, shopping } = useApp();
  const music = useMusic();
  const voice = useVoice();
  const forecast = useForecast();
  const cur = forecast?.current;
  const weather = cur ? describeWeather(cur.weatherCode, cur.isDay) : null;
  const storageKey = HOME_LAYOUT_KEY + "." + householdId;
  const [layout, setLayout] = useState(() => {
    try { return parseHomeLayout(localStorage.getItem(storageKey)); } catch { return DEFAULT_HOME_LAYOUT; }
  });
  const drag = useRef<HomeWidgetId | null>(null);
  const activeTimers = timers.some((t) => t.status === "running" || t.status === "paused");
  const playing = music.enabled && music.connected && !!music.playback?.item;
  const enabled = (id: HomeWidgetId) => id === "music" ? features.spotify : id === "timers" ? features.timers : id === "shopping" ? features.shopping : id === "house" ? features.scenes : true;
  const available = (id: HomeWidgetId) => enabled(id) && (id === "music" ? playing : id === "timers" ? activeTimers : true);
  const save = (value: HomeWidget[]) => {
    setLayout(value);
    try { localStorage.setItem(storageKey, JSON.stringify(value)); } catch {
      toast({ text: "Cette disposition restera disponible jusqu’à la fermeture de l’écran." });
    }
    vibrate();
  };
  const voiceState = voice.state === "command-listening" || voice.state === "wakeword-detected" ? "listening" : voice.state === "processing" ? "processing" : voice.state === "speaking" ? "speaking" : "idle";
  const voiceLabel = voiceState === "listening" ? "J’écoute…" : voiceState === "processing" ? "Un instant…" : voiceState === "speaking" ? "Voici ma réponse." : "Un mot, et c’est fait.";
  const content = (id: HomeWidgetId, size: HomeWidget["size"]) => {
    switch (id) {
      case "next": return next ? (
        <div>
          <p className="text-sm text-muted">{fmtRelativeDay(next.start, now)} · <span className="tabular">{next.event.allDay ? "Toute la journée" : fmtTime(next.start) + " – " + fmtTime(next.end)}</span></p>
          <button onClick={() => onEvent(next)} className="mt-2 flex min-h-11 w-full items-center gap-3 text-left">
            <span className="min-w-0 flex-1 break-words text-2xl font-medium tracking-tight sm:text-3xl">{next.event.title}</span><ChevronRight size={22} className="shrink-0 text-muted" />
          </button>
          {next.event.location && <p className="mt-3 flex items-start gap-2 text-sm text-muted"><MapPin size={16} className="mt-0.5 shrink-0" /><span>{next.event.location.address || next.event.location.label}</span></p>}
          {departure?.travel && <div className="mt-5 space-y-2"><p className="text-sm text-muted">Départ conseillé <span className="tabular font-medium text-text">{fmtTime(departure.travel.departAt)}</span> · {departure.travel.route.durationMin} min de trajet{departure.occ.key !== next.key && <span className="block mt-1">{departure.occ.event.title}</span>}</p><DeparturePill departure={departure} /></div>}
          <button onClick={onCalendar} className="mt-5 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-accent">Voir le programme <ChevronRight size={16} /></button>
        </div>
      ) : (
        <div><p className="text-xl font-medium">Un peu de temps pour vous.</p><p className="mt-2 text-sm text-muted">Aucun prochain événement dans les 24 heures.</p><Button className="mt-4" onClick={onCalendar}>Ouvrir le calendrier</Button></div>
      );
      case "assistant": return (
        <button onClick={onAssistant} className="flex w-full flex-col items-start gap-5 text-left">
          <span className="assistant-orb" data-state={voiceState}><Mic size={27} strokeWidth={1.5} /></span>
          <span><span className="block text-xl font-medium">{voiceLabel}</span><span className="mt-2 block text-sm leading-relaxed text-muted">« Ajoute du lait aux courses »</span></span>
          <span className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-accent">Parler à HomeCal <ChevronRight size={16} /></span>
        </button>
      );
      case "music": return playing ? (
        <div className="space-y-3">
          <MiniPlayer onOpen={() => onPanel("music")} size={size} className="!border-0 !bg-transparent !p-0 !shadow-none" />
          {size === "large" && <Button onClick={() => onPanel("music")}><Music2 size={16} /> Playlists et appareils</Button>}
        </div>
      ) : <p className="text-sm text-muted">La musique apparaîtra pendant la lecture.</p>;
      case "timers": return activeTimers ? <HomeTimers /> : <p className="text-sm text-muted">Les minuteurs actifs apparaîtront ici.</p>;
      case "shopping": return <ShoppingPreview items={shopping} onOpen={() => onPanel("shopping")} />;
      case "house": return <HousePreview onOpen={() => onPanel("scenes")} />;
    }
  };
  return (
    <div className="home-content">
      <div className="flex items-center justify-between gap-3">
        <p className="home-eyebrow truncate">{household?.name || "HomeCal"} <span className="mx-2 opacity-40">/</span> Aujourd’hui</p>
        <Button variant="ghost" size="icon" onClick={() => onEditing(!editing)} aria-label={editing ? "Terminer la personnalisation" : "Personnaliser l’accueil"} aria-pressed={editing}><SlidersHorizontal size={19} /></Button>
      </div>
      <header className="home-hero">
        <div className="min-w-0">
          <h1 className="home-greeting">{greeting(now.getHours())}</h1>
          <p className="home-date">{capitalize(fmt(now, "EEEE d MMMM"))}</p>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-muted">{today.length ? today.length + (today.length > 1 ? " moments prévus aujourd’hui." : " moment prévu aujourd’hui.") : "La maison prend le temps de vivre."}</p>
        </div>
        <div className="home-weather">
          <time className="home-clock tabular" dateTime={now.toISOString()}>{fmt(now, "HH:mm")}</time>
          {cur && weather ? <div className="flex items-center gap-2"><WeatherIcon code={cur.weatherCode} isDay={cur.isDay} size={28} /><span className="tabular text-3xl font-medium">{Math.round(cur.temperature)}°</span></div> : homePlace ? <div className="skeleton h-8 w-20" aria-label="Chargement de la météo" /> : null}
          {weather && <p className="text-sm text-muted">{weather.label}</p>}
          {homePlace && <p className="max-w-full truncate text-xs text-muted" title={homePlace.address}>{homePlace.name}</p>}
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
          return <section key={w.id} className="home-widget glass-panel" data-widget={w.id} data-size={w.size} aria-label={WIDGETS[w.id].label}
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
            {editing && w.id === "music" && <label className="mb-4 block text-sm text-muted">Taille <select className="ml-2 min-h-11 rounded-xl border border-border bg-surface px-3" value={w.size} onChange={(e) => save(layout.map((x) => x.id === w.id ? { ...x, size: e.target.value as HomeWidget["size"] } : x))}><option value="compact">Compact</option><option value="standard">Standard</option><option value="large">Large</option></select></label>}
            {content(w.id, w.size)}
          </section>;
        })}
      </div>
      {!editing && !layout.some((w) => w.visible && available(w.id)) && <Button onClick={() => onEditing(true)}>Choisir les widgets</Button>}
    </div>
  );
}

function ShoppingPreview({ items, onOpen }: { items: ReturnType<typeof useApp>["shopping"]; onOpen(): void }) {
  const stores = useModuleStores();
  const list = items.filter((s) => !s.checked).slice(0, 5);
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

function HomeTimers() {
  const { timers } = useApp();
  const stores = useModuleStores();
  const tick = useNow(1000).getTime();
  return <div className="space-y-4">{timers.filter((t) => t.status === "running" || t.status === "paused").slice(0, 3).map((t) => <div key={t.id} className="flex items-center gap-2">
    <div className="min-w-0 flex-1"><p className="truncate text-sm text-muted">{t.label}</p><p className="tabular text-3xl font-medium tracking-tight">{formatRemaining(remainingMs(t, tick))}</p></div>
    <Button variant="ghost" size="icon" aria-label={(t.status === "paused" ? "Reprendre " : "Mettre en pause ") + t.label} onClick={() => {
      stores?.timers.update(t.id, t.status === "paused" ? resumeTimer(t, nowMs()) : pauseTimer(t, nowMs())).catch(() => toast({ text: "Impossible de modifier le minuteur.", tone: "error" })); vibrate();
    }}>{t.status === "paused" ? <Play size={18} /> : <Pause size={18} />}</Button>
    <Button variant="ghost" size="icon" aria-label={"Arrêter " + t.label} onClick={() => { stores?.timers.remove(t.id).catch(() => toast({ text: "Impossible d’arrêter le minuteur.", tone: "error" })); vibrate(); }}><X size={18} /></Button>
  </div>)}</div>;
}

function HousePreview({ onOpen }: { onOpen(): void }) {
  const { scenes, active, activate } = useScenes();
  return <div className="space-y-2">
    {scenes.slice(0, 3).map((s) => <button key={s.id} onClick={() => { activate(s.id); vibrate(); }} className="flex min-h-12 w-full items-center gap-3 rounded-xl bg-surface-2 px-3 text-left" aria-pressed={active?.id === s.id}><Home size={18} className="text-accent" /><span className="min-w-0 flex-1 truncate">{s.name}</span><ChevronRight size={16} className="text-muted" /></button>)}
    {!scenes.length && <p className="text-sm text-muted">Retrouvez vos ambiances de maison dans les scènes.</p>}
    <button onClick={onOpen} className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-accent">Toutes les scènes <ChevronRight size={16} /></button>
  </div>;
}
