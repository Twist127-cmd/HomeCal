"use client";
import { useEffect } from "react";
import { Check, RotateCcw } from "lucide-react";
import { DESIGN_PRESETS } from "@/theme/presets";
import { useDesign } from "@/theme/ThemeProvider";
import { presetTokens } from "@/theme/tokens";
import { Button } from "@/components/ui/primitives";
export function PresetGallery() {
  const { preferences, preset, preview, previewPreset, applyPreset } = useDesign();
  useEffect(() => () => previewPreset(null), [previewPreset]);
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-lg font-medium">Preset visuel</h3><p className="text-sm text-muted">Touchez un style pour l’essayer. Votre disposition reste en place.</p></div><Button onClick={() => applyPreset("warm")}><RotateCcw size={16} /> Réinitialiser le preset</Button></div>
    {([["classic", "Classiques"], ["seasonal", "Saisonniers"], ["extravagant", "Extravagants"]] as const).map(([category, label]) => <fieldset key={category}><legend className="mb-3 text-sm font-medium text-muted">{label}</legend>
      <div className="preset-gallery">{DESIGN_PRESETS.filter((p) => p.category === category).map((p) => {
        const tokens = presetTokens(p, p.dark);
        return <button key={p.id} type="button" className="preset-choice" onClick={() => previewPreset(p.id)} aria-label={"Aperçu " + p.name} aria-pressed={preset.id === p.id}>
          <span className="preset-thumbnail" style={{ background: `radial-gradient(ellipse at top right, ${p.colors.secondary}55, transparent), ${p.colors.background}`, color: tokens["--color-text"] }} aria-hidden="true">
            <span className="preset-thumbnail-clock">08:42</span><span className="preset-thumbnail-grid"><i style={{ background: tokens["--color-surface"], borderRadius: p.radius * 5 }} /><i style={{ background: p.colors.accent, borderRadius: p.radius * 5 }} /><i style={{ background: tokens["--color-surface"], borderRadius: p.radius * 5 }} /></span>
          </span>
          <span className="flex min-h-11 items-center justify-between gap-2 px-3 text-sm font-medium">{p.name}{preferences.preset === p.id && <Check size={16} aria-label="Appliqué" />}</span>
        </button>;
      })}</div></fieldset>)}
    {preset.id === "spotify" && <p className="text-sm text-muted">Le fond de toutes les pages suit les couleurs et la pochette du morceau Spotify, comme en mode immersif. Sans morceau, il garde une ambiance sombre et verte.</p>}
    {preview && <div className="preset-preview-actions glass-panel" role="status"><span className="min-w-0 flex-1 text-sm">Aperçu : <strong>{preset.name}</strong></span><Button onClick={() => previewPreset(null)}>Annuler</Button><Button variant="primary" onClick={() => applyPreset(preview)}>Appliquer</Button></div>}
  </div>;
}
