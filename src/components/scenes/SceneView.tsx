"use client";

import clsx from "clsx";
import { addDays } from "date-fns";
import { AlertTriangle, CalendarDays, Car, Home, Moon, Music2, Play, ShoppingCart, Timer, X } from "lucide-react";
import { useMemo, type ReactNode } from "react";
import { useApp } from "@/components/app/AppProvider";
import { MiniPlayer } from "@/components/music/MiniPlayer";
import { useMusic } from "@/components/music/MusicContext";
import { DeparturePill, RouteButton } from "@/components/navigation/Departure";
import { ShoppingPanel } from "@/components/shopping/ShoppingPanel";
import { TimersPanel } from "@/components/timers/Timers";
import { AvatarStack } from "@/components/ui/primitives";
import { useNextDeparture } from "@/hooks/useNextDeparture";
import { useNow } from "@/hooks/useNow";
import { useForecast } from "@/hooks/useWeather";
import { detectConflicts } from "@/lib/conflicts";
import { capitalize, fmt, fmtTime, startOfDay } from "@/lib/dates";
import { profileColor } from "@/lib/profiles";
import { expandEvents } from "@/lib/recurrence";
import type { Occurrence, Scene, SceneWidget } from "@/lib/types";
import { describeWeather } from "@/providers/weather/WeatherProvider";
import { WeatherIcon } from "@/components/ui/WeatherIcon";
import { useScenes } from "./SceneContext";

/** Full-screen scene ("Matin", "Cuisine", "Soir"…) built from the scene's widgets. */
export function SceneView({ scene, onOpenMusic }: { scene: Scene; onOpenMusic(): void }) {
  const { scenes, activate, exit } = useScenes();
  const now = useNow(15_000);
  const big = (w: SceneWidget) => scene.large && (w === "timers" || w === "shopping" || w === "music");

  return (
    <div className={clsx("scene-shell fixed inset-0 z-[45] flex animate-fade-in flex-col", scene.dim && "brightness-[0.82]")} data-scene={scene.large ? "kitchen" : scene.dim ? "evening" : "morning"}>
      <header className="safe-top flex shrink-0 items-center gap-3 px-4 pb-3 sm:px-6">
        <Home size={26} strokeWidth={1.5} className="text-accent" />
        <h1 className="text-2xl font-semibold tracking-tight">{scene.name}</h1>
        <span className="tabular ml-2 text-2xl text-muted">{fmt(now, "HH:mm")}</span>
        <div className="flex-1" />
        <div className="no-scrollbar hidden gap-1 overflow-x-auto sm:flex">
          {scenes
            .filter((s) => s.id !== scene.id)
            .map((s) => (
              <button key={s.id} onClick={() => activate(s.id)} className="flex h-10 items-center gap-1.5 rounded-full bg-surface px-3 text-sm shadow-card">
                <Home size={16} /> {s.name}
              </button>
            ))}
        </div>
        <button onClick={exit} className="flex h-12 items-center gap-2 rounded-full bg-text px-5 font-semibold text-bg active:scale-95" aria-label="Quitter la scène">
          <X size={20} /> <span className="hidden sm:inline">Accueil</span>
        </button>
      </header>

      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-4 pb-6 sm:px-6">
        <div className="grid auto-rows-min grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {scene.widgets.map((w) => (
            <Card key={w} className={clsx(big(w) && "md:row-span-2", (w === "agenda" || w === "tomorrow") && "xl:row-span-2")}>
              <Widget id={w} scene={scene} now={now} onOpenMusic={onOpenMusic} />
            </Card>
          ))}
        </div>
        {scene.widgets.length === 0 && <p className="py-20 text-center text-muted">Cette scène n&apos;a aucun élément. Modifiez-la dans Scènes.</p>}
      </div>
    </div>
  );
}

function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={clsx("glass-panel overflow-hidden", className)}>{children}</section>;
}

function Title({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <h2 className="flex items-center gap-2 px-5 pt-4 text-sm font-semibold tracking-wide text-muted uppercase">
      <span className="text-base">{icon}</span> {children}
    </h2>
  );
}

function Widget({ id, scene, now, onOpenMusic }: { id: SceneWidget; scene: Scene; now: Date; onOpenMusic(): void }) {
  switch (id) {
    case "clock":
      return (
        <div className="p-6">
          <div className="tabular text-7xl font-semibold tracking-tight">{fmt(now, "HH:mm")}</div>
          <div className="mt-1 text-xl text-muted">{capitalize(fmt(now, "EEEE d MMMM"))}</div>
        </div>
      );
    case "weather":
      return <WeatherWidget />;
    case "agenda":
      return <DayWidget day={now} now={now} title="Aujourd'hui" icon={<CalendarDays size={18} />} />;
    case "tomorrow":
      return <DayWidget day={addDays(now, 1)} now={now} title="Demain" icon={<Moon size={18} />} withWeather />;
    case "nextDeparture":
      return <DepartureWidget now={now} large={scene.large} />;
    case "music":
      return <MusicWidget scene={scene} onOpen={onOpenMusic} />;
    case "timers":
      return (
        <>
          <Title icon={<Timer size={18} />}>Minuteurs</Title>
          <TimersPanel large={scene.large} />
        </>
      );
    case "shopping":
      return <ShoppingWidget large={scene.large} />;
    case "conflicts":
      return <ConflictsWidget now={now} />;
  }
}

function WeatherWidget() {
  const f = useForecast();
  const c = f?.current;
  const d = f?.daily[0];
  if (!c) return <div className="p-6 text-muted">Météo indisponible (ajoutez « Maison » dans les lieux favoris).</div>;
  const w = describeWeather(c.weatherCode, c.isDay);
  return (
    <div className="flex items-center gap-5 p-6">
      <WeatherIcon code={c.weatherCode} isDay={c.isDay} size={64} className="shrink-0 text-accent" />
      <div>
        <div className="tabular text-5xl font-semibold">{Math.round(c.temperature)}°</div>
        <div className="text-muted">
          {w.label}
          {d && ` · ${Math.round(d.tMin)}° / ${Math.round(d.tMax)}° · pluie ${d.precipitationProbability} %`}
        </div>
      </div>
    </div>
  );
}

function DayWidget({ day, now, title, icon, withWeather }: { day: Date; now: Date; title: string; icon: ReactNode; withWeather?: boolean }) {
  const { events, profiles } = useApp();
  const f = useForecast();
  const list = useMemo(() => {
    const s = startOfDay(day);
    return expandEvents(events, s, addDays(s, 1)).filter((o) => o.end > now);
  }, [events, day, now]);
  const dw = withWeather ? f?.daily.find((x) => x.date.toDateString() === day.toDateString()) : null;
  return (
    <>
      <Title icon={icon}>
        {title}
        {dw && (
          <span className="ml-auto font-normal normal-case">
            <WeatherIcon code={dw.weatherCode} size={18} /> {Math.round(dw.tMin)}°/{Math.round(dw.tMax)}°
          </span>
        )}
      </Title>
      <div className="space-y-2 p-4">
        {list.length === 0 && <p className="px-1 py-3 text-muted">Rien de prévu</p>}
        {list.slice(0, 6).map((o) => (
          <OccRow key={o.key} o={o} color={profileColor(o.event.profileIds, profiles)} />
        ))}
      </div>
    </>
  );
}

function OccRow({ o, color }: { o: Occurrence; color: string }) {
  const { profiles } = useApp();
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-surface-2 px-3 py-2.5">
      <span className="h-8 w-1.5 rounded-full" style={{ backgroundColor: color }} />
      <span className="tabular w-14 shrink-0 font-semibold">{o.event.allDay ? "Jour" : fmtTime(o.start)}</span>
      <span className="min-w-0 flex-1 truncate">{o.event.title}</span>
      <AvatarStack profiles={profiles} ids={o.event.profileIds} size={22} />
    </div>
  );
}

function DepartureWidget({ now, large }: { now: Date; large?: boolean }) {
  const { departure, next } = useNextDeparture(now);
  if (!next) return <div className="p-6 text-muted">Aucun déplacement prévu.</div>;
  return (
    <>
      <Title icon={<Car size={18} />}>Prochain départ</Title>
      <div className="space-y-3 p-5">
        <div>
          <div className="text-2xl font-semibold">{next.event.title}</div>
          <div className="text-muted">
            {fmtTime(next.start)}
            {next.event.location && ` · ${next.event.location.label}`}
          </div>
        </div>
        {departure?.travel ? (
          <>
            <div className="text-lg">
              Départ conseillé <span className="tabular font-semibold">{fmtTime(departure.travel.departAt)}</span> · {departure.travel.route.durationMin} min
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <DeparturePill departure={departure} large={large} />
              <RouteButton location={next.event.location!} mode={departure.travel.route.mode} label="Pars maintenant" />
            </div>
          </>
        ) : (
          <p className="text-sm text-muted">Pas de trajet calculé (lieu sans adresse ou au même endroit).</p>
        )}
      </div>
    </>
  );
}

function MusicWidget({ scene, onOpen }: { scene: Scene; onOpen(): void }) {
  const m = useMusic();
  return (
    <>
      <Title icon={<Music2 size={18} />}>Musique</Title>
      <div className="space-y-3 p-4">
        {!m.connected ? (
          <button onClick={onOpen} className="flex w-full items-center gap-3 rounded-2xl bg-surface-2 p-4 text-left">
            <Music2 size={22} /> Connecter Spotify
          </button>
        ) : (
          <>
            {m.playback?.item ? <MiniPlayer onOpen={onOpen} variant="card" /> : <p className="px-1 text-muted">Rien en lecture.</p>}
            {scene.playlist && (
              <button
                onClick={() => m.playItem({ uri: scene.playlist!.uri, type: "playlist", name: scene.playlist!.name })}
                className={clsx("flex w-full items-center gap-3 rounded-2xl bg-accent-soft px-4 text-left font-medium text-accent active:scale-[0.99]", scene.large ? "h-16 text-lg" : "h-12")}
              >
                <Play size={20} fill="currentColor" /> {scene.playlist.name}
              </button>
            )}
            <button onClick={onOpen} className="text-sm text-accent">
              Toutes les playlists →
            </button>
          </>
        )}
      </div>
    </>
  );
}

function ShoppingWidget({ large }: { large?: boolean }) {
  const { shopping } = useApp();
  const n = shopping.filter((s) => !s.checked).length;
  return (
    <>
      <Title icon={<ShoppingCart size={18} />}>
        Courses <span className="ml-1 font-normal normal-case">· {n} article{n > 1 ? "s" : ""}</span>
      </Title>
      {large ? (
        <ShoppingPanel large />
      ) : (
        <div className="p-4">
          <ul className="space-y-1">
            {shopping
              .filter((s) => !s.checked)
              .slice(0, 6)
              .map((s) => (
                <li key={s.id} className="flex items-center gap-2 text-lg">
                  <ShoppingCart size={14} className="text-muted" /> {s.quantity ? `${s.quantity} ` : ""}
                  {s.name}
                </li>
              ))}
          </ul>
          {n === 0 && <p className="text-muted">Liste vide.</p>}
        </div>
      )}
    </>
  );
}

function ConflictsWidget({ now }: { now: Date }) {
  const { events, profiles, household } = useApp();
  const conflicts = useMemo(() => {
    const s = startOfDay(now);
    return detectConflicts(expandEvents(events, s, addDays(s, 1)), profiles, { marginMin: household?.settings.travelMarginMin ?? 10 });
  }, [events, profiles, household, now]);
  return (
    <>
      <Title icon={<AlertTriangle size={18} />}>Conflits du jour</Title>
      <div className="space-y-2 p-4">
        {conflicts.length === 0 ? (
          <p className="text-muted">Aucun conflit aujourd&apos;hui ✓</p>
        ) : (
          conflicts.map((c, i) => (
            <div key={i} className="flex gap-2 rounded-2xl bg-warn/10 p-3 text-warn">
              <AlertTriangle size={18} className="mt-0.5 shrink-0" /> {c.message}
            </div>
          ))
        )}
      </div>
    </>
  );
}
