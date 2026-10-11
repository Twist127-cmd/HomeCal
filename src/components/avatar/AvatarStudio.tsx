"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, RotateCcw, Shuffle } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import type { Profile } from "@/lib/types";
import { AvatarRenderer } from "@/avatar/AvatarRenderer";
import { useAvatarContext } from "@/avatar/AvatarProvider";
import { DEFAULT_AVATAR_CONTEXT } from "@/avatar/AvatarContextEngine";
import { defaultAvatar, normalizeAvatar, changeAvatarType, quickPreset, randomAvatar, toggleAccessory } from "@/avatar/config";
import * as catalog from "@/avatar/catalog";
import type { AvatarConfig, AvatarContext } from "@/avatar/types";
const humanTabs = ["Type", "Visage", "Peau", "Cheveux", "Yeux", "Sourcils", "Nez", "Bouche", "Barbe", "Tenue", "Accessoires", "Fond"];
const petTabs = ["Type", "Race", "Morphologie", "Pelage", "Yeux", "Accessoires", "Fond"];
export function AvatarStudio({ profile, onClose, onSave, draftOnly = false }: { profile: Profile; onClose(): void; onSave(config: AvatarConfig): Promise<void> | void; draftOnly?: boolean }) {
  const [config, setConfig] = useState(() => normalizeAvatar(profile.avatarConfig));
  const [tab, setTab] = useState("Type"), [busy, setBusy] = useState(false), [demo, setDemo] = useState("base");
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const shared = useAvatarContext();
  const pet = catalog.isPet(config.type);
  const tabs = (pet ? petTabs : humanTabs).filter((t) => t !== "Barbe" || config.type === "adult");
  const currentTab = tabs.includes(tab) ? tab : "Type";
  const previewContext: AvatarContext = demo === "live" ? shared.context : { ...DEFAULT_AVATAR_CONTEXT, theme: shared.context.theme, season: demo === "winter" ? "winter" : "summer", dayPeriod: demo === "night" ? "night" : "day", scene: demo === "kitchen" ? "Cuisine" : demo === "evening" ? "Soir" : "", musicPlaying: demo === "music", cooking: demo === "kitchen" };
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    root.current?.querySelector<HTMLButtonElement>("button")?.focus();
    return () => previous?.focus();
  }, []);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) { e.stopImmediatePropagation(); if (resetting) setResetting(false); else onClose(); }
      if (e.key !== "Tab") return;
      const focusable = [...(root.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled)') ?? [])].filter((el) => !el.closest("[inert]"));
      if (!focusable?.length) return;
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", key, true);
    return () => { document.removeEventListener("keydown", key, true); };
  }, [onClose, busy, resetting]);
  const group = <K extends "base" | "face" | "hair" | "outfit" | "pet",>(name: K, patch: Partial<AvatarConfig[K]>) => setConfig((c) => ({ ...c, [name]: { ...c[name], ...patch } }));
  const thumbnail = (title: string, id: string) => title === "Qui représente cet avatar ?" ? defaultAvatar(id as AvatarConfig["type"]) : title === "Race ou type" ? catalog.applyBreed(config, id) : title === "Coupe" ? { ...config, hair: { ...config.hair, style: id } } : null;
  const options = (title: string, items: catalog.Choice[], selected: string, choose: (id: string) => void) => <OptionGrid title={title} choices={items} selected={[selected]} onChoose={choose} thumbnail={(id) => thumbnail(title, id)} />;
  const swatches = (title: string, values: string[], selected: string, choose: (id: string) => void) => <ColorGrid title={title} values={values} selected={selected} onChoose={choose} />;
  const controls = () => {
    switch (currentTab) {
      case "Type": return <>{options("Qui représente cet avatar ?", catalog.AVATAR_TYPES, config.type, (id) => setConfig((c) => changeAvatarType(c, id as AvatarConfig["type"])))}<OptionGrid title="Presets rapides" choices={(pet ? ["natural:Naturel", "collar:Collier classique", "bandana:Bandana", "chic:Chic", "outdoor:Outdoor"] : ["casual:Casual", "sport:Sport", "chic:Chic", "cosy:Cosy", "child:Enfant", "summer:Été", "winter:Hiver"]).map((s) => { const [id, label] = s.split(":"); return { id, label }; })} selected={[]} onChoose={(id) => setConfig((c) => quickPreset(c, id))} /></>;
      case "Visage": return <>{options("Forme du visage", catalog.FACE_SHAPES, config.base.faceShape, (faceShape) => group("base", { faceShape }))}{options("Morphologie", catalog.BODY_TYPES, config.base.bodyType, (bodyType) => group("base", { bodyType }))}{options("Joues", catalog.FACE_OPTIONS.cheeks, config.face.cheeks, (cheeks) => group("face", { cheeks }))}{options("Oreilles", catalog.FACE_OPTIONS.ears, config.face.ears, (ears) => group("face", { ears }))}</>;
      case "Peau": return swatches("Teinte de peau", catalog.SKIN_COLORS, config.base.skinTone, (skinTone) => group("base", { skinTone }));
      case "Cheveux": return <>{options("Coupe", config.type === "baby" ? catalog.HAIR_STYLES.filter((c) => ["very-short", "curly", "bald"].includes(c.id)) : catalog.HAIR_STYLES, config.hair.style, (style) => group("hair", { style, length: ["long", "braids", "locks", "ponytail"].includes(style) ? "long" : style === "medium" ? "medium" : "short" }))}{swatches("Couleur des cheveux", catalog.HAIR_COLORS, config.hair.color, (color) => group("hair", { color }))}{config.type !== "baby" && <>{options("Longueur", catalog.HAIR_LENGTHS, config.hair.length, (length) => group("hair", { length }))}{options("Volume", catalog.HAIR_VOLUMES, config.hair.volume, (volume) => group("hair", { volume }))}{options("Texture", catalog.HAIR_TEXTURES, config.hair.texture, (texture) => group("hair", { texture }))}</>}</>;
      case "Yeux": return <>{!pet && <>{options("Forme des yeux", catalog.FACE_OPTIONS.eyes, config.face.eyes, (eyes) => group("face", { eyes }))}{options("Iris", catalog.FACE_OPTIONS.iris, config.face.iris, (iris) => group("face", { iris }))}</>}{swatches("Couleur des yeux", catalog.EYE_COLORS, pet ? config.pet.eyeColor : config.face.eyeColor, (eyeColor) => pet ? group("pet", { eyeColor }) : group("face", { eyeColor }))}</>;
      case "Sourcils": return options("Sourcils", catalog.FACE_OPTIONS.brows, config.face.brows, (brows) => group("face", { brows }));
      case "Nez": return options("Nez", catalog.FACE_OPTIONS.nose, config.face.nose, (nose) => group("face", { nose }));
      case "Bouche": return options("Bouche", catalog.FACE_OPTIONS.mouth, config.face.mouth, (mouth) => group("face", { mouth }));
      case "Barbe": return options("Barbe et pilosité", catalog.FACE_OPTIONS.beard, config.face.beard, (beard) => group("face", { beard }));
      case "Tenue": return <>{options("Tenue principale", config.type === "baby" ? catalog.OUTFITS.filter((o) => ["overalls", "pajamas", "tshirt", "dress", "home"].includes(o.id)) : catalog.OUTFITS, config.outfit.base, (base) => group("outfit", { base }))}{swatches("Couleur de la tenue", catalog.OUTFIT_COLORS, config.outfit.color, (color) => group("outfit", { color }))}</>;
      case "Accessoires": return <OptionGrid title="Accessoires" choices={pet ? catalog.PET_ACCESSORIES : config.type === "baby" ? catalog.ACCESSORIES.filter((a) => ["headband", "teddy", "toy", "scarf"].includes(a.id)) : catalog.ACCESSORIES} selected={config.accessories} onChoose={(id) => setConfig((c) => ({ ...c, accessories: toggleAccessory(c.accessories, id) }))} />;
      case "Fond": return options("Fond de l’avatar", catalog.BACKGROUNDS, config.background, (background) => setConfig((c) => ({ ...c, background })));
      case "Race": return options("Race ou type", config.type === "dog" ? catalog.DOG_BREEDS : catalog.CAT_BREEDS, config.pet.breed, (id) => setConfig((c) => catalog.applyBreed(c, id)));
      case "Morphologie": return <>{(["size", "silhouette", "ears", "muzzle", "tail"] as const).map((key) => <div key={key}>{options(({ size: "Taille", silhouette: "Silhouette", ears: "Oreilles", muzzle: "Museau", tail: "Queue" })[key], catalog.PET_OPTIONS[key], config.pet[key], (id) => group("pet", { [key]: id }))}</div>)}</>;
      case "Pelage": return <>{options("Longueur et texture", catalog.PET_OPTIONS.fur, config.pet.fur, (fur) => group("pet", { fur }))}{swatches("Couleur du pelage", catalog.FUR_COLORS, config.pet.color, (color) => group("pet", { color }))}{options("Motifs", catalog.PET_OPTIONS.markings, config.pet.markings, (markings) => group("pet", { markings }))}</>;
    }
  };
  return <div ref={root} className="avatar-studio" role="dialog" aria-modal="true" aria-label="Avatar Studio">
    <header inert={resetting} className="avatar-studio-header"><Button disabled={busy} variant="ghost" onClick={onClose} aria-label="Retour au profil"><ArrowLeft size={20} /></Button><div className="min-w-0 flex-1"><h1 className="text-xl font-medium">Avatar Studio</h1><p className="truncate text-sm text-muted">{profile.name || "Nouveau profil"}</p></div><Button disabled={busy} variant="primary" onClick={async () => { setBusy(true); setError(null); try { await onSave(normalizeAvatar(config)); onClose(); } catch { setError("Impossible d’enregistrer l’avatar. Réessayez."); } finally { setBusy(false); } }}><Check size={17} /> {busy ? "Enregistrement…" : "Terminé"}</Button></header>
    {error && <p role="alert" className="px-6 py-3 text-sm text-danger">{error}</p>}
    <div inert={resetting} className="avatar-studio-layout">
      <nav aria-label="Catégories de l’avatar" className="avatar-category-tabs">{tabs.map((name) => <button key={name} aria-pressed={currentTab === name} onClick={() => setTab(name)}>{name}</button>)}</nav>
      <section className="avatar-preview" aria-label="Aperçu de l’avatar"><AvatarRenderer config={config} size={320} context={previewContext} stage decorative={false} label={"Avatar de " + (profile.name || "votre profil")} /><div className="flex flex-wrap justify-center gap-2"><Button onClick={() => setConfig(randomAvatar(config.type))}><Shuffle size={16} /> Aléatoire</Button><Button onClick={() => setResetting(true)}><RotateCcw size={16} /> Réinitialiser</Button></div><label className="mt-4 text-sm text-muted">Voir en contexte<select className="ml-2 min-h-11 rounded-xl border border-border bg-surface px-3" value={demo} onChange={(e) => setDemo(e.target.value)}><option value="base">Identité de base</option><option value="live">En ce moment</option><option value="kitchen">Cuisine</option><option value="music">Musique</option><option value="evening">Soirée</option><option value="winter">Hiver</option><option value="night">Nuit</option></select></label><p className="mt-3 max-w-sm text-center text-xs text-muted">{draftOnly ? "Votre avatar sera enregistré avec le profil." : "Les accessoires contextuels ne changent pas votre identité enregistrée."}</p></section>
      <section className="avatar-options" aria-label={currentTab}>{controls()}</section>
    </div>
    {resetting && <div className="avatar-reset-confirm glass-panel" role="alertdialog" aria-modal="true" aria-label="Réinitialiser cet avatar ?"><h2 className="font-medium">Réinitialiser cet avatar ?</h2><p className="mt-2 text-sm text-muted">Les personnalisations de cet aperçu seront remplacées. Le profil enregistré restera intact jusqu’à la validation.</p><div className="mt-4 flex justify-end gap-2"><Button autoFocus onClick={() => setResetting(false)}>Annuler</Button><Button variant="primary" onClick={() => { setConfig(defaultAvatar(config.type)); setResetting(false); }}>Confirmer la réinitialisation</Button></div></div>}
  </div>;
}
function OptionGrid({ title, choices, selected, onChoose, thumbnail }: { title: string; choices: catalog.Choice[]; selected: string[]; onChoose(id: string): void; thumbnail?(id: string): AvatarConfig | null }) { return <fieldset className="space-y-3"><legend className="mb-3 text-sm font-medium text-muted">{title}</legend><div className="avatar-option-grid">{choices.map((c) => { const preview = thumbnail?.(c.id); return <button key={c.id} aria-pressed={selected.includes(c.id)} onClick={() => onChoose(c.id)}>{preview ? <AvatarRenderer config={preview} size={40} context={DEFAULT_AVATAR_CONTEXT} /> : <span className="avatar-option-dot" aria-hidden="true" />}<span>{c.label}</span></button>; })}</div></fieldset>; }
function ColorGrid({ title, values, selected, onChoose }: { title: string; values: string[]; selected: string; onChoose(id: string): void }) { return <fieldset><legend className="mb-3 text-sm font-medium text-muted">{title}</legend><div className="flex flex-wrap gap-3">{values.map((c, i) => <button key={c} className="avatar-color-choice" style={{ backgroundColor: c }} aria-label={title + " " + (i + 1)} aria-pressed={selected === c} onClick={() => onChoose(c)} />)}</div></fieldset>; }
