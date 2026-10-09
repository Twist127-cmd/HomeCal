"use client";

import { signOut } from "firebase/auth";
import { ArrowLeft, Bell, Copy, Home, Mic, Plus, RefreshCw, Star, Trash2, Volume2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useApp } from "@/components/app/AppProvider";
import { useMusic } from "@/components/music/MusicContext";
import { PlaceSearch } from "@/components/places/PlaceSearch";
import { ScenesPanel } from "@/components/scenes/ScenesPanel";
import { useVoice } from "@/components/voice/VoiceContext";
import { features } from "@/lib/features";
import { availableNavApps } from "@/lib/navigation";
import { Avatar, Button, Card, Chip, Field, inputClass, Sheet, Spinner, Toggle } from "@/components/ui/primitives";
import { toast, Toaster } from "@/components/ui/toast";
import {
  createInvite,
  deletePlace,
  deleteProfile,
  newId,
  savePlace,
  saveProfile,
  setMyProfile,
  updateHousehold,
  updateSettings,
} from "@/lib/data/household";
import { auth, firestore } from "@/lib/firebase/client";
import { PROFILE_COLORS, type FavoritePlace, type HouseholdSettings, type Profile, type ProfileType } from "@/lib/types";
import { googleCalendarEnabled, GoogleCalendarProvider } from "@/providers/calendar";
import type { LLMHealth } from "@/providers/llm";
import { createLLMProvider } from "@/providers/llm";
import { isTunedKeyword, SUPPORTED_KEYWORDS } from "@/providers/wakeword/keywords";

const PLACE_SUGGESTIONS = ["Maison", "Travail", "CrossFit", "Parents", "Gare", "École", "Supermarché"];
const PLACE_ICONS = ["🏠", "💼", "🏋️", "👪", "🚉", "🏫", "🛒", "🏥", "☕", "⭐"];
const TYPE_LABEL: Record<ProfileType, string> = { PERSON: "Personne", COUPLE: "Couple", GROUP: "Groupe", HOUSEHOLD: "Foyer" };

export function SettingsScreen() {
  const app = useApp();
  const { household, householdId, profiles, places, myProfileId, user } = app;
  const db = firestore();
  const [editProfile, setEditProfile] = useState<Profile | null>(null);
  const [editPlace, setEditPlace] = useState<FavoritePlace | null>(null);
  const music = useMusic();

  if (!household || !householdId) return null;
  const navApps = availableNavApps(typeof navigator === "undefined" ? "" : navigator.userAgent);
  const s = household.settings;
  const set = (patch: Partial<HouseholdSettings>) => updateSettings(db, householdId, { ...s, ...patch }).catch((e) => toast({ text: e.message, tone: "error" }));

  return (
    <div className="safe-top mx-auto max-w-3xl px-4 pb-6 sm:pb-10">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/" className="inline-flex h-11 w-11 items-center justify-center rounded-full hover:bg-surface-2" aria-label="Retour">
          <ArrowLeft size={22} />
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">Réglages</h1>
      </div>

      <div className="space-y-6">
        {/* ---------------- household ---------------- */}
        <Section title="Foyer">
          <Field label="Nom du foyer">
            <input
              className={inputClass}
              defaultValue={household.name}
              onBlur={(e) => e.target.value.trim() && e.target.value !== household.name && updateHousehold(db, householdId, { name: e.target.value.trim() })}
            />
          </Field>
          <Field label="Je suis" hint="Utilisé pour « moi » dans l'assistant et l'ajout rapide sur cet appareil/compte.">
            <div className="flex flex-wrap gap-2">
              {profiles
                .filter((p) => p.type === "PERSON")
                .map((p) => (
                  <Chip key={p.id} active={myProfileId === p.id} color={p.color} onClick={() => user && setMyProfile(db, user.uid, p.id)}>
                    <Avatar profile={p} size={22} /> {p.name}
                  </Chip>
                ))}
            </div>
          </Field>
          <InviteBlock />
          <p className="text-xs text-muted">
            Identifiant du foyer : <span className="font-mono select-all">{householdId}</span>
          </p>
        </Section>

        {/* ---------------- profiles ---------------- */}
        <Section
          title="Profils"
          action={
            <Button
              size="sm"
              onClick={() =>
                setEditProfile({
                  id: newId(db, householdId, "profiles"),
                  name: "",
                  color: PROFILE_COLORS[profiles.length % PROFILE_COLORS.length],
                  avatar: "",
                  type: "PERSON",
                  memberIds: [],
                  order: profiles.length,
                })
              }
            >
              <Plus size={16} /> Ajouter
            </Button>
          }
        >
          <div className="divide-y divide-border">
            {profiles.map((p) => (
              <button key={p.id} onClick={() => setEditProfile(p)} className="flex w-full items-center gap-3 py-3 text-left">
                <Avatar profile={p} size={36} />
                <span className="flex-1">
                  <span className="block font-medium">{p.name}</span>
                  <span className="text-sm text-muted">
                    {TYPE_LABEL[p.type]}
                    {p.memberIds.length > 0 && ` · ${p.memberIds.map((id) => profiles.find((x) => x.id === id)?.name).filter(Boolean).join(" + ")}`}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </Section>

        {/* ---------------- places ---------------- */}
        <Section
          title="Lieux favoris"
          action={
            <Button size="sm" onClick={() => setEditPlace({ id: newId(db, householdId, "places"), name: "", address: "", lat: NaN, lng: NaN, icon: "⭐", profileIds: [], order: places.length })}>
              <Plus size={16} /> Ajouter
            </Button>
          }
        >
          {places.length === 0 && <p className="text-sm text-muted">Ajoutez au moins « Maison » pour la météo et les trajets.</p>}
          <div className="divide-y divide-border">
            {places.map((p) => (
              <div key={p.id} className="flex items-center gap-3 py-3">
                <span className="text-2xl">{p.icon}</span>
                <button className="min-w-0 flex-1 text-left" onClick={() => setEditPlace(p)}>
                  <span className="flex items-center gap-2 font-medium">
                    {p.name}
                    {household.homePlaceId === p.id && <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs text-accent">Domicile</span>}
                  </span>
                  <span className="block truncate text-sm text-muted">{p.address}</span>
                </button>
                {household.homePlaceId !== p.id && (
                  <Button variant="ghost" size="icon" title="Définir comme domicile" onClick={() => updateHousehold(db, householdId, { homePlaceId: p.id })}>
                    <Home size={18} />
                  </Button>
                )}
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            {PLACE_SUGGESTIONS.filter((n) => !places.some((p) => p.name.toLowerCase().startsWith(n.toLowerCase()))).map((n, i) => (
              <Chip
                key={n}
                onClick={() =>
                  setEditPlace({ id: newId(db, householdId, "places"), name: n, address: "", lat: NaN, lng: NaN, icon: PLACE_ICONS[i] ?? "⭐", profileIds: [], order: places.length })
                }
              >
                <Plus size={14} /> {n}
              </Chip>
            ))}
          </div>
        </Section>

        {/* ---------------- display ---------------- */}
        <Section title="Affichage">
          <ThemePicker />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Début de journée">
              <select className={inputClass} value={s.dayStartHour} onChange={(e) => set({ dayStartHour: +e.target.value })}>
                {Array.from({ length: 12 }, (_, h) => (
                  <option key={h} value={h}>
                    {h}:00
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Fin de journée">
              <select className={inputClass} value={s.dayEndHour} onChange={(e) => set({ dayEndHour: +e.target.value })}>
                {Array.from({ length: 10 }, (_, i) => 15 + i).map((h) => (
                  <option key={h} value={h}>
                    {h}:00
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Mode ambiant après inactivité" hint="Horloge plein écran + prochains événements (écran mural).">
            <select className={inputClass} value={s.ambientAfterSec} onChange={(e) => set({ ambientAfterSec: +e.target.value })}>
              <option value={0}>Désactivé</option>
              <option value={60}>1 minute</option>
              <option value={180}>3 minutes</option>
              <option value={300}>5 minutes</option>
              <option value={900}>15 minutes</option>
            </select>
          </Field>
          <Toggle checked={s.nightMode.enabled} onChange={(v) => set({ nightMode: { ...s.nightMode, enabled: v } })} label="Mode nuit (écran sombre et atténué)" />
          {s.nightMode.enabled && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="De">
                <input type="time" className={inputClass} value={s.nightMode.start} onChange={(e) => set({ nightMode: { ...s.nightMode, start: e.target.value } })} />
              </Field>
              <Field label="À">
                <input type="time" className={inputClass} value={s.nightMode.end} onChange={(e) => set({ nightMode: { ...s.nightMode, end: e.target.value } })} />
              </Field>
            </div>
          )}
        </Section>

        {/* ---------------- travel ---------------- */}
        <Section title="Trajets">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Mode par défaut">
              <select className={inputClass} value={s.defaultTravelMode} onChange={(e) => set({ defaultTravelMode: e.target.value as HouseholdSettings["defaultTravelMode"] })}>
                <option value="driving">Voiture</option>
                <option value="cycling">Vélo</option>
                <option value="walking">À pied</option>
              </select>
            </Field>
            <Field label="Marge avant départ">
              <select className={inputClass} value={s.travelMarginMin} onChange={(e) => set({ travelMarginMin: +e.target.value })}>
                {[0, 5, 10, 15, 20, 30].map((m) => (
                  <option key={m} value={m}>
                    {m} min
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Navigation préférée">
            <div className="flex flex-wrap gap-2">
              {navApps.map((a) => (
                <Chip key={a.id} active={s.navigationApp === a.id} onClick={() => set({ navigationApp: a.id })}>
                  {a.label}
                </Chip>
              ))}
              <Chip active={s.navigationApp === "ask"} onClick={() => set({ navigationApp: "ask" })}>
                Demander à chaque fois
              </Chip>
            </div>
          </Field>
          <p className="text-xs text-muted">Itinéraires : OpenStreetMap / OSRM (gratuit). Transports publics non pris en charge en V1.</p>
        </Section>

        {/* ---------------- assistant ---------------- */}
        {/* ---------------- music ---------------- */}
        {features.spotify && (
          <Section title="Musique">
            {music.connected ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-medium">Spotify — Connecté{music.accountName ? ` : ${music.accountName}` : ""}</div>
                  {music.premium === false && <div className="text-sm text-warn">Spotify Premium est nécessaire pour contrôler la lecture.</div>}
                </div>
                <Button variant="danger" size="sm" onClick={music.disconnect}>
                  Déconnecter Spotify
                </Button>
              </div>
            ) : (
              <Button variant="primary" onClick={music.connect}>
                Connecter Spotify
              </Button>
            )}
            <p className="text-xs text-muted">Les playlists de chaque scène (Matin, Cuisine, Soir…) se choisissent dans la section Scènes.</p>
          </Section>
        )}

        {/* ---------------- timers ---------------- */}
        {features.timers && (
          <Section title="Minuteurs">
            <Toggle checked={s.timers.sound} onChange={(v) => set({ timers: { ...s.timers, sound: v } })} label="Sonnerie" />
            <Toggle checked={s.timers.voice} onChange={(v) => set({ timers: { ...s.timers, voice: v } })} label="Synthèse vocale" />
            <Toggle checked={s.timers.notifications} onChange={(v) => set({ timers: { ...s.timers, notifications: v } })} label="Notifications" />
          </Section>
        )}

        {/* ---------------- scenes ---------------- */}
        {features.scenes && (
          <Section title="Scènes">
            <div className="-m-4">
              <ScenesPanel />
            </div>
          </Section>
        )}

        <AssistantSettings settings={s} onChange={(llm) => set({ llm })} />

        {/* ---------------- wake word ---------------- */}
        {features.wakeWord && <WakeWordSettingsSection settings={s} onChange={(wakeWord) => set({ wakeWord })} />}

        {/* ---------------- voice ---------------- */}
        <Section title="Voix et notifications">
          <Toggle checked={s.voice.autoSpeak} onChange={(v) => set({ voice: { ...s.voice, autoSpeak: v } })} label="Lire les réponses et rappels à voix haute" />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => app.tts.speak(`Bonjour, je suis ${s.wakeWord?.keyword || "HomeCal"}. Votre prochain rendez-vous est à 16 heures.`, { lang: s.voice.lang })}>
              <Volume2 size={16} /> Tester la voix
            </Button>
            <Button size="sm" onClick={() => toast({ text: app.speech.isSupported() ? "Reconnaissance vocale disponible ✓" : "Reconnaissance vocale indisponible sur ce navigateur", tone: app.speech.isSupported() ? "success" : "error" })}>
              <Mic size={16} /> Tester le micro
            </Button>
            <Button
              size="sm"
              onClick={async () => {
                if (typeof Notification === "undefined") return toast({ text: "Notifications non supportées", tone: "error" });
                const p = await Notification.requestPermission();
                toast({ text: p === "granted" ? "Notifications activées" : "Notifications refusées", tone: p === "granted" ? "success" : "error" });
              }}
            >
              <Bell size={16} /> Activer les notifications
            </Button>
          </div>
        </Section>

        {/* ---------------- integrations ---------------- */}
        <Section title="Intégrations">
          <div className="flex items-center gap-4 rounded-2xl bg-surface-2 p-4">
            <span className="text-3xl">📅</span>
            <div className="flex-1">
              <div className="font-medium">Google Calendar</div>
              <div className="text-sm text-muted">
                {googleCalendarEnabled ? "Prêt à connecter" : "Prévu — désactivé en V1 (NEXT_PUBLIC_GOOGLE_CALENDAR_ENABLED=false)"}
              </div>
            </div>
            <Button
              size="sm"
              disabled={!googleCalendarEnabled}
              onClick={() =>
                new GoogleCalendarProvider()
                  .connect()
                  .then(() => toast({ text: "Google Calendar connecté", tone: "success" }))
                  .catch((e) => toast({ text: `${e.code ?? ""} ${e.message}`, tone: "error" }))
              }
            >
              Connecter
            </Button>
          </div>
          <p className="text-xs text-muted">Le calendrier HomeCal (Firebase) reste la source de vérité. Outlook / Apple Calendar : non prévus en V1.</p>
        </Section>

        {/* ---------------- account ---------------- */}
        <Section title="Compte">
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted">{user?.email}</span>
            <Button variant="danger" size="sm" onClick={() => signOut(auth())}>
              Se déconnecter
            </Button>
          </div>
          <p className="text-xs text-muted">HomeCal V1 · données stockées dans Firebase (projet {process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}).</p>
        </Section>
      </div>

      {editProfile && <ProfileEditor profile={editProfile} onClose={() => setEditProfile(null)} />}
      {editPlace && <PlaceEditor place={editPlace} onClose={() => setEditPlace(null)} />}
      <Toaster />
    </div>
  );
}

function InviteBlock() {
    const { household, householdId, user } = useApp();
    const db = firestore();
    const [busy, setBusy] = useState(false);
    const code = household!.inviteCode;
    return (
      <Field label="Inviter un membre" hint={`${household!.memberUids.length} compte(s) dans ce foyer. Le code permet à un autre compte de rejoindre le foyer.`}>
        <div className="flex items-center gap-2">
          {code && <span className="rounded-2xl bg-surface-2 px-4 py-2.5 font-mono text-xl tracking-[0.3em]">{code}</span>}
          {code && (
            <Button variant="ghost" size="icon" onClick={() => navigator.clipboard?.writeText(code).then(() => toast({ text: "Code copié" }))}>
              <Copy size={18} />
            </Button>
          )}
          <Button
            size="sm"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await createInvite(db, householdId!, user!.uid);
              } catch (e) {
                toast({ text: (e as Error).message, tone: "error" });
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? <Spinner /> : <RefreshCw size={16} />} {code ? "Nouveau code" : "Générer un code"}
          </Button>
        </div>
      </Field>
    );
}

const voiceStateLabel = (state: string, name: string): string =>
  ({
    idle: "○ En veille",
    "wakeword-listening": `● À l'écoute de “${name}”`,
    "wakeword-detected": `✨ “${name}” détecté`,
    "command-listening": "🎙 Je t'écoute…",
    processing: "⏳ Je traite la commande…",
    speaking: "🔊 Je réponds…",
    error: "⚠️ Erreur",
  })[state] ?? state;

/** 2–20 letters, at most 2 words ("Jarvis", "Mamie Lou"). */
function cleanAssistantName(raw: string): string | null {
  const n = raw.replace(/\s+/g, " ").trim();
  if (n.length < 2 || n.length > 20 || n.split(" ").length > 2 || !/^[\p{L}' -]+$/u.test(n)) return null;
  return n.charAt(0).toUpperCase() + n.slice(1);
}

function AssistantNamePicker({ w, upd }: { w: HouseholdSettings["wakeWord"]; upd(p: Partial<HouseholdSettings["wakeWord"]>): void }) {
  const name = w.keyword || "HomeCal";
  const custom = !isTunedKeyword(name);
  const [editing, setEditing] = useState(custom);
  const [draft, setDraft] = useState(custom ? name : "");
  const [pron, setPron] = useState(w.pronunciation ?? "");
  const [err, setErr] = useState<string | null>(null);

  const commitName = () => {
    const n = cleanAssistantName(draft);
    if (!n) return setErr("2 à 20 lettres, deux mots au maximum.");
    setErr(null);
    if (n !== name) upd({ keyword: n, pronunciation: isTunedKeyword(n) ? "" : pron.trim() });
  };

  return (
    <Field label="Nom de l'assistant" hint="C'est aussi le mot de réveil : dites ce nom pour lui parler.">
      <div className="flex flex-wrap gap-2">
        {SUPPORTED_KEYWORDS.map((k) => (
          <Chip
            key={k}
            active={!editing && name === k}
            onClick={() => {
              setEditing(false);
              setErr(null);
              upd({ keyword: k, pronunciation: "" });
            }}
          >
            {k}
          </Chip>
        ))}
        <Chip active={editing} onClick={() => setEditing(true)}>
          Autre…
        </Chip>
      </div>
      {editing && (
        <div className="mt-3 space-y-2">
          <input
            className={inputClass}
            placeholder="Ex. Jarvis, Léon, Mamie Lou"
            value={draft}
            maxLength={20}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => e.key === "Enter" && commitName()}
          />
          <input
            className={inputClass}
            placeholder="Prononciation en mots français (facultatif) : jarre visse, jar vis"
            value={pron}
            onChange={(e) => setPron(e.target.value)}
            onBlur={() => custom && pron.trim() !== (w.pronunciation ?? "") && upd({ pronunciation: pron.trim() })}
          />
          {err && <p className="text-sm text-danger">{err}</p>}
          <p className="text-xs text-muted">
            La détection est locale et ne connaît que les mots français : un prénom courant (Léon, Margot…) marche directement. Pour un nom étranger, écrivez comment
            il se prononce avec des mots français. HomeCal, Nora, Milo et Nova sont les plus fiables.
          </p>
        </div>
      )}
    </Field>
  );
}

function WakeWordSettingsSection({ settings, onChange }: { settings: HouseholdSettings; onChange(w: HouseholdSettings["wakeWord"]): void }) {
  const voice = useVoice();
  const w = settings.wakeWord;
  const name = w.keyword || "HomeCal";
  const [busy, setBusy] = useState(false);
  const upd = (patch: Partial<HouseholdSettings["wakeWord"]>) => onChange({ ...w, ...patch });

  return (
    <Section title="Assistant vocal">
      <p className="text-sm text-muted">
        {name} a besoin d&apos;accéder au microphone pour détecter son nom. Le traitement du mot de réveil est effectué localement : aucun son n&apos;est enregistré ni
        envoyé.
      </p>
      {!voice.supported ? (
        <p className="rounded-2xl bg-surface-2 p-3 text-sm text-muted">Le mot de réveil n&apos;est pas disponible sur cet appareil. Vous pouvez toujours utiliser le bouton micro.</p>
      ) : (
        <Toggle
          checked={voice.enabled}
          onChange={async (v) => {
            if (busy) return;
            setBusy(true);
            try {
              await voice.setEnabled(v);
            } finally {
              setBusy(false);
            }
          }}
          label={
            <span className="flex items-center gap-2">
              Activer le mot de réveil sur cet appareil {busy && <Spinner size={14} />}
            </span>
          }
        />
      )}
      {voice.error && <p className="text-sm text-danger">{voice.error}</p>}

      <AssistantNamePicker w={w} upd={upd} />

      <Field label="Sensibilité">
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["low", "Faible"],
              ["normal", "Normale"],
              ["high", "Élevée"],
            ] as const
          ).map(([id, l]) => (
            <Chip key={id} active={w.sensitivity === id} onClick={() => upd({ sensitivity: id })}>
              {l}
            </Chip>
          ))}
        </div>
      </Field>

      <Toggle checked={w.sound} onChange={(v) => upd({ sound: v })} label="Son d'activation" />
      <Toggle checked={w.autoListen} onChange={(v) => upd({ autoListen: v })} label={`Écouter automatiquement après “${name}”`} />

      <Field label="Délai avant abandon">
        <select className={inputClass} value={w.timeoutSec} onChange={(e) => upd({ timeoutSec: +e.target.value })}>
          {[4, 6, 8, 10].map((n) => (
            <option key={n} value={n}>
              {n} secondes
            </option>
          ))}
        </select>
      </Field>

      <Field label="Réponse vocale après commande">
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["always", "Toujours"],
              ["needed", "Seulement si nécessaire"],
              ["never", "Jamais"],
            ] as const
          ).map(([id, l]) => (
            <Chip key={id} active={w.reply === id} onClick={() => upd({ reply: id })}>
              {l}
            </Chip>
          ))}
        </div>
      </Field>

      {voice.enabled && (
        <div className="space-y-2 rounded-2xl bg-surface-2 p-4 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="font-medium">{voiceStateLabel(voice.state, name)}</span>
            <Button size="sm" onClick={() => voice.test()}>
              <Mic size={16} /> Tester
            </Button>
          </div>
          <div className="text-muted">
            Dernière phrase entendue : <span className="text-text">{voice.lastHeard ? `« ${voice.lastHeard} »` : "—"}</span>
          </div>
          <div className="text-muted">
            Dernière détection : <span className="text-text">{voice.lastDetectionAt ? new Date(voice.lastDetectionAt).toLocaleTimeString("fr-CH") : "—"}</span>
          </div>
          <div className="text-muted">
            {voice.metrics.detections} détection(s) · {voice.metrics.cancelled} annulée(s) · {voice.metrics.commandsStarted} commande(s)
          </div>
          <p className="text-xs text-muted">Dites “{name}” : si la détection est difficile, augmentez la sensibilité.</p>
        </div>
      )}
    </Section>
  );
}

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card className="p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">{title}</h2>
        {action}
      </div>
      <div className="space-y-4">{children}</div>
    </Card>
  );
}

function ThemePicker() {
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem("homecal.theme") ?? "auto";
    } catch {
      return "auto";
    }
  });
  const apply = (t: string) => {
    setTheme(t);
    try {
      localStorage.setItem("homecal.theme", t);
    } catch {
      /* ignore */
    }
    const dark = t === "dark" || (t === "auto" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", dark);
  };
  return (
    <Field label="Thème (sur cet appareil)">
      <div className="flex gap-2">
        {(
          [
            ["auto", "Automatique"],
            ["light", "Clair"],
            ["dark", "Sombre"],
          ] as const
        ).map(([id, l]) => (
          <Chip key={id} active={theme === id} onClick={() => apply(id)}>
            {l}
          </Chip>
        ))}
      </div>
    </Field>
  );
}

function AssistantSettings({ settings, onChange }: { settings: HouseholdSettings; onChange(llm: HouseholdSettings["llm"]): void }) {
  const [health, setHealth] = useState<LLMHealth | null>(null);
  const [testing, setTesting] = useState(false);
  const llm = settings.llm;
  return (
    <Section title="Assistant (LLM local)">
      <Field label="Connexion à Ollama" hint="Auto : via le serveur HomeCal si disponible, sinon directement depuis le navigateur.">
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["auto", "Automatique"],
              ["proxy", "Via serveur"],
              ["direct", "Direct navigateur"],
            ] as const
          ).map(([id, l]) => (
            <Chip key={id} active={llm.mode === id} onClick={() => onChange({ ...llm, mode: id })}>
              {l}
            </Chip>
          ))}
        </div>
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="URL Ollama (mode direct)">
          <input className={inputClass} defaultValue={llm.baseUrl} onBlur={(e) => e.target.value !== llm.baseUrl && onChange({ ...llm, baseUrl: e.target.value.trim() })} />
        </Field>
        <Field label="Modèle">
          <input className={inputClass} defaultValue={llm.model} onBlur={(e) => e.target.value !== llm.model && onChange({ ...llm, model: e.target.value.trim() })} />
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          size="sm"
          disabled={testing}
          onClick={async () => {
            setTesting(true);
            setHealth(await createLLMProvider(llm, () => auth().currentUser?.getIdToken() ?? Promise.resolve(null)).health());
            setTesting(false);
          }}
        >
          {testing ? <Spinner /> : <RefreshCw size={16} />} Tester la connexion
        </Button>
        {health && (
          <span className={`text-sm ${health.ok ? "text-ok" : "text-danger"}`}>
            {health.ok
              ? `Connecté (${health.via}) · ${health.modelAvailable ? `modèle ${llm.model} disponible` : `modèle ${llm.model} absent : ollama pull ${llm.model}`}`
              : health.error}
          </span>
        )}
      </div>
      {health?.models && health.models.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {health.models.map((m) => (
            <Chip key={m} active={m === llm.model} onClick={() => onChange({ ...llm, model: m })}>
              {m === llm.model && <Star size={14} />} {m}
            </Chip>
          ))}
        </div>
      )}
      <p className="text-xs text-muted">
        Gratuit et local : les requêtes restent sur votre réseau. Pour le mode direct depuis la version en ligne, Ollama doit autoriser l&apos;origine (variable OLLAMA_ORIGINS).
      </p>
    </Section>
  );
}

function ProfileEditor({ profile, onClose }: { profile: Profile; onClose(): void }) {
  const { householdId, profiles, events } = useApp();
  const db = firestore();
  const [p, setP] = useState(profile);
  const isNew = !profiles.some((x) => x.id === profile.id);
  const persons = profiles.filter((x) => x.type === "PERSON" && x.id !== p.id);
  const used = events.some((e) => e.profileIds.includes(p.id));

  return (
    <Sheet
      open
      onClose={onClose}
      title={isNew ? "Nouveau profil" : "Modifier le profil"}
      footer={
        <>
          {!isNew && (
            <Button
              variant="danger"
              onClick={async () => {
                if (used && !confirm("Ce profil est utilisé par des événements. Supprimer quand même ?")) return;
                await deleteProfile(db, householdId!, p.id);
                onClose();
              }}
            >
              <Trash2 size={18} /> Supprimer
            </Button>
          )}
          <div className="flex-1" />
          <Button
            variant="primary"
            disabled={!p.name.trim()}
            onClick={async () => {
              await saveProfile(db, householdId!, { ...p, name: p.name.trim(), avatar: p.avatar.trim() || p.name.trim().slice(0, 2).toUpperCase() });
              onClose();
            }}
          >
            Enregistrer
          </Button>
        </>
      }
    >
      <div className="space-y-4 pb-2">
        <div className="flex justify-center">
          <Avatar profile={{ ...p, avatar: p.avatar || p.name.slice(0, 2).toUpperCase() }} size={72} />
        </div>
        <div className="grid grid-cols-[1fr_120px] gap-3">
          <Field label="Nom">
            <input className={inputClass} value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} autoFocus={isNew} />
          </Field>
          <Field label="Avatar">
            <input className={`${inputClass} text-center`} value={p.avatar} maxLength={4} placeholder="CL / 😀" onChange={(e) => setP({ ...p, avatar: e.target.value })} />
          </Field>
        </div>
        <Field label="Couleur">
          <div className="flex flex-wrap gap-2">
            {PROFILE_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setP({ ...p, color: c })}
                className={`h-10 w-10 rounded-full transition ${p.color === c ? "scale-110 ring-2 ring-text ring-offset-2 ring-offset-surface" : ""}`}
                style={{ backgroundColor: c }}
                aria-label={c}
              />
            ))}
          </div>
        </Field>
        <Field label="Type">
          <div className="flex flex-wrap gap-2">
            {(Object.keys(TYPE_LABEL) as ProfileType[]).map((t) => (
              <Chip key={t} active={p.type === t} onClick={() => setP({ ...p, type: t, memberIds: t === "COUPLE" || t === "GROUP" ? p.memberIds : [] })}>
                {TYPE_LABEL[t]}
              </Chip>
            ))}
          </div>
        </Field>
        {(p.type === "COUPLE" || p.type === "GROUP") && (
          <Field label="Membres">
            <div className="flex flex-wrap gap-2">
              {persons.map((x) => (
                <Chip
                  key={x.id}
                  active={p.memberIds.includes(x.id)}
                  color={x.color}
                  onClick={() => setP({ ...p, memberIds: p.memberIds.includes(x.id) ? p.memberIds.filter((m) => m !== x.id) : [...p.memberIds, x.id] })}
                >
                  <Avatar profile={x} size={22} /> {x.name}
                </Chip>
              ))}
            </div>
          </Field>
        )}
      </div>
    </Sheet>
  );
}

function PlaceEditor({ place, onClose }: { place: FavoritePlace; onClose(): void }) {
  const { householdId, places, household } = useApp();
  const db = firestore();
  const [p, setP] = useState(place);
  const isNew = !places.some((x) => x.id === place.id);
  const valid = p.name.trim() && Number.isFinite(p.lat) && Number.isFinite(p.lng);

  return (
    <Sheet
      open
      onClose={onClose}
      title={isNew ? "Nouveau lieu favori" : "Modifier le lieu"}
      footer={
        <>
          {!isNew && (
            <Button
              variant="danger"
              onClick={async () => {
                await deletePlace(db, householdId!, p.id);
                if (household?.homePlaceId === p.id) await updateHousehold(db, householdId!, { homePlaceId: undefined });
                onClose();
              }}
            >
              <Trash2 size={18} /> Supprimer
            </Button>
          )}
          <div className="flex-1" />
          <Button
            variant="primary"
            disabled={!valid}
            onClick={async () => {
              await savePlace(db, householdId!, { ...p, name: p.name.trim() });
              if (!household?.homePlaceId && /maison|domicile|home/i.test(p.name)) await updateHousehold(db, householdId!, { homePlaceId: p.id });
              onClose();
            }}
          >
            Enregistrer
          </Button>
        </>
      }
    >
      <div className="space-y-4 pb-2">
        <div className="grid grid-cols-[1fr_auto] gap-3">
          <Field label="Nom">
            <input className={inputClass} value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} placeholder="ex. Travail Clément" />
          </Field>
          <Field label="Icône">
            <select className={`${inputClass} w-20 text-center text-xl`} value={p.icon} onChange={(e) => setP({ ...p, icon: e.target.value })}>
              {PLACE_ICONS.map((i) => (
                <option key={i}>{i}</option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Adresse">
          <PlaceSearch initial={p.address} autoFocus={isNew && !!p.name} onPick={(r) => setP({ ...p, address: r.address, lat: r.lat, lng: r.lng })} />
        </Field>
        {Number.isFinite(p.lat) ? (
          <p className="text-xs text-muted">
            📍 {p.lat.toFixed(5)}, {p.lng.toFixed(5)}
          </p>
        ) : (
          <p className="text-xs text-warn">Choisissez une adresse dans la liste.</p>
        )}
      </div>
    </Sheet>
  );
}
