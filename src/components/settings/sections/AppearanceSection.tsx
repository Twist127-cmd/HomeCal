"use client";
import { useState, useSyncExternalStore, type ReactNode } from "react";
import { Button, Chip } from "@/components/ui/primitives";
import { PresetGallery } from "@/components/customization/PresetGallery";
import { LayoutEditor } from "@/components/customization/LayoutEditor";
import { LAYOUT_PRESETS } from "@/layout/presets";
import { useWidgetLayout } from "@/layout/widgetLayoutStore";
import { useDesign, type Density, type MusicAdaptation } from "@/theme/ThemeProvider";
import { Section } from "../shared";
import { useAvatarContext } from "@/avatar/AvatarProvider";
import type { AnimationLevel } from "@/avatar/types";
const reducedMotionQuery = "(prefers-reduced-motion: reduce)";
function subscribeReducedMotion(callback: () => void) {
  const media = window.matchMedia(reducedMotionQuery);
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}
const readReducedMotion = () => window.matchMedia(reducedMotionQuery).matches;
const serverReducedMotion = () => false;
export function AppearanceSection() {
  const systemReducedMotion = useSyncExternalStore(subscribeReducedMotion, readReducedMotion, serverReducedMotion);
  const { preferences, update, reset } = useDesign();
  const { intensity, setIntensity, visible, setVisible, walking, setWalking } = useAvatarContext();
  const { layout, apply, reset: resetLayout } = useWidgetLayout();
  const [editing, setEditing] = useState(false);
  return <Section title="Apparence">{editing ? <LayoutEditor onClose={() => setEditing(false)} /> : <>
    <PresetGallery />
    <div className="my-3 border-t border-border" />
    {layout.preset === "custom" && <p className="text-sm text-muted">Disposition actuelle : personnalisée.</p>}
    <Group label="Disposition" hint="La disposition change les widgets, pas le style visuel."><div className="layout-preset-list">{LAYOUT_PRESETS.map((p) => <button key={p.id} className="layout-preset-choice" aria-pressed={layout.preset === p.id} onClick={() => apply(p.id)}><strong>{p.name}</strong><span>{p.description}</span></button>)}</div></Group>
    <Group label="Densité" hint="Sur cet appareil. Les commandes tactiles restent faciles à atteindre."><div className="flex flex-wrap gap-2">{([["compact", "Compact"], ["normal", "Normal"], ["comfort", "Confort"]] as [Density, string][]).map(([id, name]) => <Chip key={id} active={preferences.density === id} aria-pressed={preferences.density === id} onClick={() => update({ density: id })}>{name}</Chip>)}</div></Group>
    <Group label="Adaptation Spotify"><div className="flex flex-wrap gap-2">{([["off", "Désactivée"], ["subtle", "Subtile"], ["normal", "Normale"], ["immersive", "Immersive"]] as [MusicAdaptation, string][]).map(([id, name]) => <Chip key={id} active={preferences.musicAdaptation === id} aria-pressed={preferences.musicAdaptation === id} onClick={() => update({ musicAdaptation: id })}>{name}</Chip>)}</div></Group>
    <Button variant="primary" onClick={() => setEditing(true)}>Personnaliser l’accueil</Button>
    <Group label="Affichage des avatars" hint="La promenade alterne marche et pauses. En animations Réduites et la nuit, les avatars restent au repos. La réduction des mouvements du système reste prioritaire. Options mémorisées sur cet appareil.">
      <label className="flex min-h-11 items-center gap-3"><input type="checkbox" className="h-5 w-5 accent-accent" checked={visible} onChange={e => setVisible(e.target.checked)} />Afficher les avatars</label>
      <label className="flex min-h-11 items-center gap-3"><input type="checkbox" className="h-5 w-5 accent-accent" checked={walking} onChange={e => setWalking(e.target.checked)} />Activer la promenade dans le bandeau</label>
      {systemReducedMotion && visible && walking && <p className="mt-2 text-sm text-muted" role="status">La promenade est arrêtée par la réduction des mouvements de cet appareil. Désactive ce réglage dans les paramètres d’accessibilité de l’appareil pour voir le déplacement.</p>}
    </Group>
    <Group label="Animations avatars" hint="Sur cet appareil. Le réglage système de réduction des mouvements reste prioritaire."><div className="flex flex-wrap gap-2">{([["reduced", "Réduit"], ["normal", "Normal"], ["lively", "Vivant"]] as [AnimationLevel, string][]).map(([id, name]) => <Chip key={id} active={intensity === id} aria-pressed={intensity === id} onClick={() => setIntensity(id)}>{name}</Chip>)}</div></Group>
    <p className="text-xs text-muted">Style et disposition sont mémorisés pour ce foyer sur cet appareil. Les fonctions restent accessibles dans les menus, même avec un widget masqué.</p>
    <div className="flex flex-wrap gap-2"><Button onClick={resetLayout}>Réinitialiser le layout</Button><Button onClick={() => { reset(); resetLayout(); setIntensity("normal"); setVisible(true); setWalking(true); }}>Réinitialiser toute la personnalisation</Button></div>
  </>}</Section>;
}
function Group({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return <fieldset><legend className="mb-2 text-sm font-medium text-muted">{label}</legend>{children}{hint && <p className="mt-2 text-xs text-muted">{hint}</p>}</fieldset>;
}
