"use client";
import { useRef, useState } from "react";
import { ArrowDown, ArrowUp, Check, GripVertical, RotateCcw } from "lucide-react";
import { Button, Toggle, inputClass } from "@/components/ui/primitives";
import { toast } from "@/components/ui/toast";
import { useApp } from "@/components/app/AppProvider";
import { TodayDashboard } from "@/components/app/TodayDashboard";
import { useNow } from "@/hooks/useNow";
import { useNextDeparture } from "@/hooks/useNextDeparture";
import { expandEvents } from "@/lib/recurrence";
import { addDays, startOfDay } from "@/lib/dates";
import { vibrate } from "@/lib/sound";
import { DEFAULT_HOME_LAYOUT, reorderWidget, WIDGET_REGISTRY, type HomeWidget, type HomeWidgetId } from "@/layout/widgetRegistry";
import { useWidgetLayout } from "@/layout/widgetLayoutStore";
export function LayoutEditor({ onClose }: { onClose(): void }) {
  const { layout, save } = useWidgetLayout();
  const [draft, setDraft] = useState(layout.widgets);
  const [target, setTarget] = useState<HomeWidgetId | null>(null);
  const dragged = useRef<HomeWidgetId | null>(null);
  const { events } = useApp();
  const now = useNow(15_000);
  const { next, departure } = useNextDeparture(now);
  const today = expandEvents(events, startOfDay(now), addDays(startOfDay(now), 1));
  const patch = (id: HomeWidgetId, changes: Partial<HomeWidget>) => setDraft((list) => list.map((w) => w.id === id ? { ...w, ...changes } : w));
  const move = (id: HomeWidgetId, to: HomeWidgetId) => { setDraft((list) => reorderWidget(list, id, to)); vibrate(); };
  const sizeLabels = { compact: "Compact", standard: "Standard", large: "Large" };
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-xl font-medium">Personnaliser l’accueil</h3><p className="mt-1 text-sm text-muted">Faites glisser les poignées ou utilisez les flèches. Les changements restent en aperçu jusqu’à l’enregistrement.</p></div><Button onClick={onClose}>Retour à l’apparence</Button></div>
    <div className="layout-live-preview" aria-label="Aperçu de la disposition"><div inert><TodayDashboard now={now} next={next} departure={departure} today={today} editing={false} onEditing={() => {}} onEvent={() => {}} onPanel={() => {}} onAssistant={() => {}} onCalendar={() => {}} onAvailability={() => {}} layoutOverride={draft} preview /></div></div>
    <div className="space-y-3">{draft.map((w, index) => {
      const definition = WIDGET_REGISTRY[w.id];
      if (!definition.enabled()) return null;
      return <section key={w.id} data-layout-row={w.id} data-drag-target={target === w.id} className="widget-editor-row glass-panel p-4" aria-label={definition.label}>
        <div className="flex items-center gap-2">
          <button type="button" className="widget-drag-handle" aria-label={"Déplacer " + definition.label}
            onPointerDown={(e) => { if (e.button !== 0) return; dragged.current = w.id; e.currentTarget.setPointerCapture(e.pointerId); vibrate(); }}
            onPointerMove={(e) => { if (!dragged.current) return; const row = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>("[data-layout-row]"); setTarget((row?.dataset.layoutRow as HomeWidgetId) ?? null); }}
            onPointerUp={(e) => { const row = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>("[data-layout-row]"); if (dragged.current && row?.dataset.layoutRow) move(dragged.current, row.dataset.layoutRow as HomeWidgetId); dragged.current = null; setTarget(null); }}
            onPointerCancel={() => { dragged.current = null; setTarget(null); }}><GripVertical size={20} /></button>
          <h4 className="min-w-0 flex-1 font-medium">{definition.label}</h4>
          <Button variant="ghost" size="icon" disabled={index === 0} aria-label={"Avancer " + definition.label} onClick={() => move(w.id, draft[index - 1].id)}><ArrowUp size={17} /></Button>
          <Button variant="ghost" size="icon" disabled={index === draft.length - 1} aria-label={"Reculer " + definition.label} onClick={() => move(w.id, draft[index + 1].id)}><ArrowDown size={17} /></Button>
        </div>
        <div className="widget-editor-controls mt-3">
          <Toggle checked={w.visible} onChange={(visible) => patch(w.id, { visible })} label="Visible" />
          {definition.sizes.length > 1 && <label className="text-sm text-muted">Taille<select aria-label={"Taille " + definition.label} className={inputClass + " mt-1"} value={w.size} onChange={(e) => patch(w.id, { size: e.target.value as HomeWidget["size"] })}>{definition.sizes.map((size) => <option key={size} value={size}>{sizeLabels[size]}</option>)}</select></label>}
          <label className="text-sm text-muted">Largeur<select aria-label={"Largeur " + definition.label} className={inputClass + " mt-1"} value={w.width} onChange={(e) => patch(w.id, { width: e.target.value === "full" ? "full" : Number(e.target.value) as 1 | 2 })}><option value="1">1 colonne</option><option value="2">2 colonnes</option><option value="full">Pleine largeur</option></select></label>
        </div>
      </section>;
    })}</div>
    <div className="flex flex-wrap justify-between gap-3"><Button onClick={() => setDraft(DEFAULT_HOME_LAYOUT)}><RotateCcw size={16} /> Réinitialiser la disposition</Button><div className="flex gap-2"><Button onClick={onClose}>Annuler</Button><Button variant="primary" onClick={() => { const persisted = save(draft); toast({ text: persisted ? "Disposition enregistrée" : "Disposition appliquée pour cette session", tone: "success" }); onClose(); }}><Check size={16} /> Enregistrer</Button></div></div>
  </div>;
}
