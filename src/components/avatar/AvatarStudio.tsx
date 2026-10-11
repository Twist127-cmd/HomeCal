"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, RotateCcw, Shuffle } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import type { Profile } from "@/lib/types";
import { AvatarRenderer } from "@/avatar/AvatarRenderer";
import { useAvatarContext } from "@/avatar/AvatarProvider";
import { DEFAULT_AVATAR_CONTEXT } from "@/avatar/AvatarContextEngine";
import { defaultVoxelAvatar, normalizeVoxelAvatar, profileSeed, randomVoxelAvatar, type VoxelOptions } from "@/avatar/dicebear/dicebearConfig";
import { VOXEL_VARIANTS, VOXEL_COLORS, VARIANT_LABELS } from "@/avatar/dicebear/dicebearOptions";
import { applyVoxelPreset, VOXEL_PRESETS } from "@/avatar/dicebear/dicebearPresets";
import { AVATAR_TYPES, DOG_BREEDS, CAT_BREEDS, FUR_COLORS, EYE_COLORS, isPet, type Choice } from "@/avatar/catalog";
import type { HomeCalAvatarConfig, AvatarContext, AvatarType, AnimationLevel } from "@/avatar/types";

export function AvatarStudio({ profile, onClose, onSave, draftOnly = false }: { profile: Profile; onClose(): void; onSave(config: HomeCalAvatarConfig): Promise<void> | void; draftOnly?: boolean }) {
  const [config, setConfig] = useState(() => normalizeVoxelAvatar(profile.avatarConfig, profile.id, profile.avatarSeed));
  const [tab, setTab] = useState("Type"), [busy, setBusy] = useState(false), [demo, setDemo] = useState("base");
  const [resetting, setResetting] = useState(false), [jump, setJump] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null), shared = useAvatarContext();
  const pet = isPet(config.type);
  const tabs = pet ? ["Type", "Race", "Pelage", "Accessoires", "Fond", "Comportement"] : ["Type", "Cheveux", "Visage", "Couleurs", "Tenue", "Accessoires", "Fond", "Comportement"];
  const currentTab = tabs.includes(tab) ? tab : "Type";
  const previewContext: AvatarContext = demo === "live" ? shared.context : { ...DEFAULT_AVATAR_CONTEXT, theme: shared.context.theme, season: demo === "winter" ? "winter" : demo === "spring" ? "spring" : "summer", dayPeriod: demo === "night" ? "night" : demo === "evening" ? "evening" : "day", scene: demo === "kitchen" ? "Cuisine" : "", musicPlaying: demo === "music", cooking: demo === "kitchen" };
  const previewConfig = demo === "base" ? { ...config, seasonalAccessoriesEnabled: false, contextualAccessoriesEnabled: false } : config;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    root.current?.querySelector<HTMLButtonElement>("button")?.focus();
    return () => previous?.focus();
  }, []);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) { e.stopImmediatePropagation(); if (resetting) setResetting(false); else onClose(); }
      if (e.key !== "Tab") return;
      const focusable = [...(root.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled)') ?? [])].filter(el => !el.closest("[inert]"));
      if (!focusable.length) return;
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", key, true);
    return () => document.removeEventListener("keydown", key, true);
  }, [onClose, busy, resetting]);
  const patchOptions = (patch: Partial<VoxelOptions>) => setConfig(c => ({ ...c, options: { ...c.options, ...patch } }));
  const option = (key: string) => String((config.options as Record<string, unknown>)[key] ?? "");
  const variants = (component: string, title: string, optional = false) => {
    const key = component + "Variant", probability = component + "Probability";
    const selected = optional && option(probability) === "0" ? "none" : option(key);
    return <OptionGrid title={title} choices={[...(optional ? [{ id: "none", label: "Aucun" }] : []), ...VOXEL_VARIANTS[component].map(id => ({ id, label: VARIANT_LABELS[id] ?? id }))]} selected={selected} onChoose={id => patchOptions(id === "none" ? { [probability]: 0 } : { [key]: id, ...(optional ? { [probability]: 100 } : {}) })} thumbnail={id => ({ ...config, options: { ...config.options, ...(id === "none" ? { [probability]: 0 } : { [key]: id, ...(optional ? { [probability]: 100 } : {}) }) } })} />;
  };
  const color = (name: string, title: string) => <ColorGrid title={title} values={VOXEL_COLORS[name]} selected={option(name + "Color")} onChoose={value => patchOptions({ [name + "Color"]: value })} />;
  const controls = () => {
    switch (currentTab) {
      case "Type": return <><OptionGrid title="Qui représente cet avatar ?" choices={AVATAR_TYPES} selected={config.type} onChoose={id => setConfig(c => isPet(id as AvatarType) !== isPet(c.type) || isPet(id as AvatarType) ? defaultVoxelAvatar(id as AvatarType, c.seed) : normalizeVoxelAvatar({ ...c, type: id, options: { ...c.options, beardProbability: id === "adult" ? c.options.beardProbability : 0, outfitVariant: id === "baby" ? "overalls" : c.options.outfitVariant } }, profile.id))} thumbnail={id => defaultVoxelAvatar(id as AvatarType, config.seed)} />{!pet && <OptionGrid title="Presets rapides" choices={VOXEL_PRESETS} selected="" onChoose={id => setConfig(c => applyVoxelPreset(c, id))} />}</>;
      case "Cheveux": return <>{variants("top", "Coiffure ou couvre-chef", true)}{color("hair", "Couleur des cheveux")}{color("hat", "Couleur du couvre-chef")}</>;
      case "Visage": return <>{variants("eyes", "Regard")}{variants("eyebrows", "Sourcils", true)}{variants("nose", "Nez")}{variants("mouth", "Expression")}{variants("cheeks", "Joues", true)}{config.type === "adult" && variants("beard", "Barbe", true)}</>;
      case "Couleurs": return <>{color("skin", "Teinte de peau")}{color("hair", "Couleur des cheveux")}{color("shirt", "Couleur du haut")}{color("pants", "Couleur du pantalon")}{color("shoes", "Couleur des chaussures")}{color("jacket", "Couleur de la veste")}{color("hat", "Couleur des accessoires")}</>;
      case "Tenue": return <>{variants("outfit", "Tenue principale")}{color("shirt", "Couleur du haut")}{color("jacket", "Couleur de la veste")}{color("pants", "Couleur du pantalon")}{color("shoes", "Couleur des chaussures")}</>;
      case "Accessoires": return pet ? <OptionGrid title="Accessoire de l’animal" choices={[{ id: "none", label: "Aucun" }, { id: "collar", label: "Collier" }, { id: "bandana", label: "Bandana" }, { id: "bow", label: "Nœud" }]} selected={config.pet.accessory} onChoose={id => setConfig(c => ({ ...c, pet: { ...c.pet, accessory: id as HomeCalAvatarConfig["pet"]["accessory"] } }))} /> : <>{variants("glasses", "Lunettes", true)}{color("hat", "Couleur des accessoires")}</>;
      case "Fond": return <ColorGrid title="Fond de l’avatar" values={["#00000000", ...VOXEL_COLORS.background, "#e8d6bc", "#d5dfce", "#263041"]} selected={option("backgroundColor")} onChoose={backgroundColor => patchOptions({ backgroundColor })} />;
      case "Race": return <OptionGrid title="Race ou type" choices={config.type === "dog" ? DOG_BREEDS : CAT_BREEDS} selected={config.pet.breed} onChoose={id => { const breed = (config.type === "dog" ? DOG_BREEDS : CAT_BREEDS).find(b => b.id === id)!; setConfig(c => ({ ...c, pet: { ...c.pet, breed: id, color: breed.color } })); }} thumbnail={id => ({ ...config, pet: { ...config.pet, breed: id, color: (config.type === "dog" ? DOG_BREEDS : CAT_BREEDS).find(b => b.id === id)!.color } })} />;
      case "Pelage": return <><ColorGrid title="Couleur du pelage" values={FUR_COLORS} selected={config.pet.color} onChoose={value => setConfig(c => ({ ...c, pet: { ...c.pet, color: value } }))} /><ColorGrid title="Couleur des yeux" values={EYE_COLORS} selected={config.pet.eyeColor} onChoose={value => setConfig(c => ({ ...c, pet: { ...c.pet, eyeColor: value } }))} /></>;
      case "Comportement": return <><OptionGrid title="Animations de cet avatar" choices={[{ id: "reduced", label: "Réduites" }, { id: "normal", label: "Normales" }, { id: "lively", label: "Vivantes" }]} selected={config.animationLevel} onChoose={id => setConfig(c => ({ ...c, animationLevel: id as AnimationLevel }))} /><label className="flex min-h-11 items-center gap-3"><input type="checkbox" checked={config.seasonalAccessoriesEnabled} onChange={e => setConfig(c => ({ ...c, seasonalAccessoriesEnabled: e.target.checked }))} />Accessoires saisonniers et fêtes</label><label className="flex min-h-11 items-center gap-3"><input type="checkbox" checked={config.contextualAccessoriesEnabled} onChange={e => setConfig(c => ({ ...c, contextualAccessoriesEnabled: e.target.checked }))} />Accessoires des scènes et de la journée</label><p className="text-sm text-muted">Le réglage d’animation de cet appareil et la réduction des mouvements restent prioritaires.</p></>;
    }
  };
  return <div ref={root} className="avatar-studio" role="dialog" aria-modal="true" aria-label="Avatar Studio">
    <header inert={resetting} className="avatar-studio-header"><Button disabled={busy} variant="ghost" onClick={onClose} aria-label="Retour au profil"><ArrowLeft size={20} /></Button><div className="min-w-0 flex-1"><h1 className="text-xl font-medium">Avatar Studio</h1><p className="truncate text-sm text-muted">{profile.name || "Nouveau profil"}</p></div><Button disabled={busy} variant="primary" onClick={async () => { setBusy(true); setError(null); try { await onSave(normalizeVoxelAvatar(config, profile.id)); onClose(); } catch { setError("Impossible d’enregistrer l’avatar. Réessayez."); } finally { setBusy(false); } }}><Check size={17} />{busy ? "Enregistrement…" : "Terminé"}</Button></header>
    {error && <p role="alert" className="px-6 py-3 text-sm text-danger">{error}</p>}
    <div inert={resetting} className="avatar-studio-layout">
      <nav aria-label="Catégories de l’avatar" className="avatar-category-tabs">{tabs.map(name => <button key={name} aria-pressed={currentTab === name} onClick={() => setTab(name)}>{name}</button>)}</nav>
      <section className="avatar-preview" aria-label="Aperçu de l’avatar"><AvatarRenderer config={previewConfig} profileId={profile.id} size={320} context={previewContext} intensity={config.animationLevel} reaction={jump} stage decorative={false} label={"Avatar de " + (profile.name || "votre profil")} /><div className="flex flex-wrap justify-center gap-2"><Button onClick={() => setConfig(c => ({ ...randomVoxelAvatar(c.type), animationLevel: c.animationLevel, seasonalAccessoriesEnabled: c.seasonalAccessoriesEnabled, contextualAccessoriesEnabled: c.contextualAccessoriesEnabled }))}><Shuffle size={16} />Aléatoire</Button><Button onClick={() => setResetting(true)}><RotateCcw size={16} />Réinitialiser</Button><Button onClick={() => setJump(n => n + 1)}>Tester le saut</Button></div><label className="mt-4 text-sm text-muted">Voir en contexte<select className="ml-2 min-h-11 rounded-xl border border-border bg-surface px-3" value={demo} onChange={e => setDemo(e.target.value)}><option value="base">Identité de base</option><option value="live">En ce moment</option><option value="kitchen">Cuisine</option><option value="music">Musique</option><option value="spring">Printemps</option><option value="summer">Été</option><option value="evening">Soirée</option><option value="winter">Hiver</option><option value="night">Nuit</option></select></label><p className="mt-3 max-w-sm text-center text-xs text-muted">{draftOnly ? "Votre avatar sera enregistré avec le profil." : "Les accessoires contextuels ne changent pas votre identité enregistrée."}</p></section>
      <section className="avatar-options" aria-label={currentTab}>{controls()}</section>
    </div>
    {resetting && <div className="avatar-reset-confirm glass-panel" role="alertdialog" aria-modal="true" aria-label="Réinitialiser cet avatar ?"><h2 className="font-medium">Réinitialiser cet avatar ?</h2><p className="mt-2 text-sm text-muted">L’aperçu revient au preset HomeCal. Le profil enregistré reste intact jusqu’à la validation.</p><div className="mt-4 flex justify-end gap-2"><Button autoFocus onClick={() => setResetting(false)}>Annuler</Button><Button variant="primary" onClick={() => { setConfig(defaultVoxelAvatar(config.type, profileSeed(profile.id))); setResetting(false); }}>Confirmer la réinitialisation</Button></div></div>}
  </div>;
}
function OptionGrid({ title, choices, selected, onChoose, thumbnail }: { title: string; choices: readonly Choice[]; selected: string; onChoose(id: string): void; thumbnail?(id: string): HomeCalAvatarConfig }) { return <fieldset className="space-y-3"><legend className="mb-3 text-sm font-medium text-muted">{title}</legend><div className="avatar-option-grid">{choices.map(choice => <button key={choice.id} aria-pressed={selected === choice.id} onClick={() => onChoose(choice.id)}>{thumbnail ? <AvatarRenderer config={thumbnail(choice.id)} size={40} context={DEFAULT_AVATAR_CONTEXT} intensity="reduced" stage /> : <span className="avatar-option-dot" aria-hidden="true" />}<span>{choice.label}</span></button>)}</div></fieldset>; }
function ColorGrid({ title, values, selected, onChoose }: { title: string; values: string[]; selected: string; onChoose(value: string): void }) { return <fieldset><legend className="mb-3 text-sm font-medium text-muted">{title}</legend><div className="flex flex-wrap gap-3">{values.map((value, index) => <button key={value} className="avatar-color-choice" style={{ backgroundColor: value }} aria-label={value === "#00000000" ? "Fond transparent" : title + " " + (index + 1)} aria-pressed={selected === value} onClick={() => onChoose(value)} />)}</div></fieldset>; }

