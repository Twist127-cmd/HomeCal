"use client";

import clsx from "clsx";
import { ArrowDown, ArrowUp, Pencil, Play, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useMusic } from "@/components/music/MusicContext";
import { Button, Chip, Field, inputClass, Sheet, Toggle } from "@/components/ui/primitives";
import { toast } from "@/components/ui/toast";
import { useModuleStores } from "@/hooks/useModules";
import { SCENE_WIDGETS, type Scene, type SceneWidget } from "@/lib/types";
import { useScenes } from "./SceneContext";

const ICONS = ["☀️", "🍳", "🌙", "🎉", "🧘", "📚", "🎮", "🏋️", "🍽️", "🧹", "👶", "🎬", "💼", "🌿", "❤️", "🏠"];

/** List of scenes: activate, edit, create, delete. */
export function ScenesPanel() {
  const { scenes, active, activate } = useScenes();
  const stores = useModuleStores();
  const [editing, setEditing] = useState<Scene | null>(null);

  const blank = (): Scene => ({
    id: "",
    name: "",
    icon: "✨",
    widgets: ["clock", "weather", "agenda"],
    autoPlay: false,
    dim: false,
    large: false,
    order: scenes.length,
  });

  return (
    <div className="space-y-3 p-4">
      {scenes.length === 0 && <p className="rounded-2xl bg-surface-2 p-4 text-muted">Aucune scène. Créez-en une ci-dessous.</p>}
      {scenes.map((s) => (
        <div key={s.id} className={clsx("flex items-center gap-3 rounded-2xl border p-3", active?.id === s.id ? "border-accent bg-accent-soft" : "border-border")}>
          <span className="text-3xl">{s.icon}</span>
          <div className="min-w-0 flex-1">
            <div className="font-semibold">{s.name}</div>
            <div className="truncate text-xs text-muted">
              {s.widgets.length} élément(s)
              {s.schedule?.enabled && ` · auto ${s.schedule.start}–${s.schedule.end}`}
              {s.playlist && ` · 🎵 ${s.playlist.name}`}
            </div>
          </div>
          <Button size="icon" variant="ghost" onClick={() => setEditing(s)} aria-label={`Modifier ${s.name}`}>
            <Pencil size={18} />
          </Button>
          <Button size="sm" variant={active?.id === s.id ? "soft" : "primary"} onClick={() => activate(s.id)}>
            <Play size={16} /> {active?.id === s.id ? "Active" : "Activer"}
          </Button>
        </div>
      ))}
      <Button className="w-full" onClick={() => setEditing(blank())}>
        <Plus size={18} /> Nouvelle scène
      </Button>
      <p className="text-xs text-muted">Activez aussi une scène à la voix : « Mode cuisine ». Les scènes programmées s&apos;activent seules sur tablette et écran mural.</p>

      {editing && stores && (
        <SceneEditor
          scene={editing}
          onClose={() => setEditing(null)}
          onSave={(s) => {
            if (s.id) stores.scenes.put(s);
            else {
              const { id, ...rest } = s;
              void id;
              stores.scenes.add(rest);
            }
            toast({ text: `Scène « ${s.name} » enregistrée`, tone: "success" });
            setEditing(null);
          }}
          onDelete={
            editing.id
              ? () => {
                  const removed = editing;
                  stores.scenes.remove(removed.id);
                  toast({ text: `Scène « ${removed.name} » supprimée`, action: { label: "Annuler", run: () => stores.scenes.put(removed) } });
                  setEditing(null);
                }
              : undefined
          }
        />
      )}
    </div>
  );
}

function SceneEditor({ scene, onClose, onSave, onDelete }: { scene: Scene; onClose(): void; onSave(s: Scene): void; onDelete?: () => void }) {
  const [s, setS] = useState<Scene>(scene);
  const music = useMusic();
  const { connected, loadLibrary } = music;
  useEffect(() => {
    if (connected) loadLibrary();
  }, [connected, loadLibrary]);

  const toggleWidget = (w: SceneWidget) => setS((x) => ({ ...x, widgets: x.widgets.includes(w) ? x.widgets.filter((y) => y !== w) : [...x.widgets, w] }));
  const move = (i: number, dir: -1 | 1) =>
    setS((x) => {
      const ws = [...x.widgets];
      const j = i + dir;
      if (j < 0 || j >= ws.length) return x;
      [ws[i], ws[j]] = [ws[j], ws[i]];
      return { ...x, widgets: ws };
    });

  return (
    <Sheet
      open
      wide
      onClose={onClose}
      title={scene.id ? `Modifier « ${scene.name} »` : "Nouvelle scène"}
      footer={
        <>
          {onDelete && (
            <Button variant="danger" onClick={onDelete}>
              <Trash2 size={18} /> Supprimer
            </Button>
          )}
          <div className="flex-1" />
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="primary" disabled={!s.name.trim()} onClick={() => onSave({ ...s, name: s.name.trim() })}>
            Enregistrer
          </Button>
        </>
      }
    >
      <div className="space-y-5 pb-3">
        <div className="grid grid-cols-[1fr_auto] gap-3">
          <Field label="Nom">
            <input className={inputClass} value={s.name} onChange={(e) => setS({ ...s, name: e.target.value })} placeholder="ex. Apéro" autoFocus={!scene.id} />
          </Field>
          <Field label="Icône">
            <span className="flex h-12 w-14 items-center justify-center rounded-2xl bg-surface-2 text-2xl">{s.icon}</span>
          </Field>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {ICONS.map((i) => (
            <button key={i} onClick={() => setS({ ...s, icon: i })} className={clsx("h-11 w-11 rounded-xl text-xl", s.icon === i ? "bg-accent-soft ring-2 ring-accent" : "bg-surface-2")}>
              {i}
            </button>
          ))}
        </div>

        <Field label="Éléments affichés (dans l'ordre)">
          <div className="space-y-1.5">
            {s.widgets.map((w, i) => {
              const meta = SCENE_WIDGETS.find((x) => x.id === w)!;
              return (
                <div key={w} className="flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2">
                  <span>{meta.icon}</span>
                  <span className="flex-1">{meta.label}</span>
                  <button onClick={() => move(i, -1)} className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-surface-3" aria-label="Monter">
                    <ArrowUp size={16} />
                  </button>
                  <button onClick={() => move(i, 1)} className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-surface-3" aria-label="Descendre">
                    <ArrowDown size={16} />
                  </button>
                  <button onClick={() => toggleWidget(w)} className="flex h-9 w-9 items-center justify-center rounded-full text-danger hover:bg-danger/10" aria-label="Retirer">
                    <Trash2 size={16} />
                  </button>
                </div>
              );
            })}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {SCENE_WIDGETS.filter((w) => !s.widgets.includes(w.id)).map((w) => (
              <Chip key={w.id} onClick={() => toggleWidget(w.id)}>
                <Plus size={14} /> {w.icon} {w.label}
              </Chip>
            ))}
          </div>
        </Field>

        <Field label="Playlist de la scène">
          {music.connected ? (
            <select
              className={inputClass}
              value={s.playlist?.uri ?? ""}
              onChange={(e) => {
                const p = music.playlists.find((x) => x.uri === e.target.value);
                setS({ ...s, playlist: p ? { uri: p.uri, name: p.name } : undefined });
              }}
            >
              <option value="">Aucune</option>
              {s.playlist && !music.playlists.some((p) => p.uri === s.playlist!.uri) && <option value={s.playlist.uri}>{s.playlist.name}</option>}
              {music.playlists.map((p) => (
                <option key={p.uri} value={p.uri}>
                  {p.name}
                </option>
              ))}
            </select>
          ) : (
            <p className="text-sm text-muted">Connectez Spotify (Musique) pour choisir une playlist.</p>
          )}
        </Field>
        {s.playlist && <Toggle checked={s.autoPlay} onChange={(v) => setS({ ...s, autoPlay: v })} label="Lancer la playlist à l'activation" />}

        <Toggle
          checked={!!s.schedule?.enabled}
          onChange={(v) => setS({ ...s, schedule: { start: s.schedule?.start ?? "07:00", end: s.schedule?.end ?? "09:00", enabled: v } })}
          label="Activation automatique (tablette / écran mural)"
        />
        {s.schedule?.enabled && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="De">
              <input type="time" className={inputClass} value={s.schedule.start} onChange={(e) => setS({ ...s, schedule: { ...s.schedule!, start: e.target.value } })} />
            </Field>
            <Field label="À">
              <input type="time" className={inputClass} value={s.schedule.end} onChange={(e) => setS({ ...s, schedule: { ...s.schedule!, end: e.target.value } })} />
            </Field>
          </div>
        )}
        <Toggle checked={s.large} onChange={(v) => setS({ ...s, large: v })} label="Grands boutons (mains occupées)" />
        <Toggle checked={s.dim} onChange={(v) => setS({ ...s, dim: v })} label="Luminosité réduite" />
      </div>
    </Sheet>
  );
}
