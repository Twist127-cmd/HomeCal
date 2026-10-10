"use client";

import { AudioLines, Bell, Mic, Play } from "lucide-react";
import { useEffect, useState } from "react";
import { useApp } from "@/components/app/AppProvider";
import { Button, Chip, Field, inputClass, Toggle } from "@/components/ui/primitives";
import { toast } from "@/components/ui/toast";
import { DEFAULT_SETTINGS, type VoiceSettings } from "@/lib/types";
import { chooseVoice, voiceOptions, type VoiceOption } from "@/providers/tts/TTSProvider";
import { Section, useHouseholdSettings } from "../shared";

const RATES = [0.8, 0.9, 1, 1.1, 1.2];

export function VoiceSection() {
  const app = useApp();
  const { s, set } = useHouseholdSettings();
  const v: VoiceSettings = { ...DEFAULT_SETTINGS.voice, ...s.voice };
  const upd = (patch: Partial<VoiceSettings>) => set({ voice: { ...v, ...patch } });
  const name = s.wakeWord?.keyword || "HomeCal";

  return (
    <Section title="Voix et notifications">
      <Toggle checked={v.autoSpeak} onChange={(on) => upd({ autoSpeak: on })} label="Lire les réponses et rappels à voix haute" />
      <VoicePicker v={v} upd={upd} assistantName={name} />
      <div className="flex flex-wrap gap-2">
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
  );
}

/** Voice of HomeCal: device voices (French first), speed, pitch and preview. */
function VoicePicker({ v, upd, assistantName }: { v: VoiceSettings; upd(p: Partial<VoiceSettings>): void; assistantName: string }) {
  const { tts } = useApp();
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [effective, setEffective] = useState<string | null>(null);

  useEffect(() => {
    const refresh = () => {
      const list = tts.getVoices();
      setVoices(voiceOptions(list, v.lang));
      setEffective(chooseVoice(list, v.lang, v.voiceURI)?.voiceURI ?? null);
    };
    refresh();
    return tts.onVoicesChanged(refresh);
  }, [tts, v.lang, v.voiceURI]);

  if (!tts.isSupported()) {
    return <p className="rounded-2xl bg-surface-2 p-3 text-sm text-muted">La synthèse vocale n&apos;est pas disponible sur ce navigateur.</p>;
  }

  const missing = !!v.voiceURI && voices.length > 0 && !voices.some((o) => o.voiceURI === v.voiceURI);
  const fallbackName = voices.find((o) => o.voiceURI === effective);
  const groups = [
    { label: "Français", items: voices.filter((o) => o.lang.toLowerCase().startsWith("fr")) },
    { label: "Autres langues", items: voices.filter((o) => !o.lang.toLowerCase().startsWith("fr")) },
  ].filter((g) => g.items.length);

  return (
    <div className="space-y-4 rounded-2xl bg-surface-2 p-4">
      <div className="flex items-center gap-3"><span className="assistant-orb !h-12 !w-12"><AudioLines size={22} /></span><div><p className="font-medium">Voix de {assistantName}</p><p className="mt-1 text-xs text-muted">{fallbackName?.name || "Voix de l’appareil"}</p></div></div>
      <Field
        label="Voix"
        hint={
          missing
            ? `La voix choisie n'existe pas sur cet appareil : ${fallbackName ? `${fallbackName.name} est utilisée à la place` : "voix système par défaut"}.`
            : !v.voiceURI && fallbackName
              ? `Automatique : ${fallbackName.name} — ${fallbackName.langLabel}`
              : "Les voix disponibles dépendent de l'appareil et du navigateur."
        }
      >
        <select className={`${inputClass} bg-surface`} value={missing ? "" : v.voiceURI} onChange={(e) => upd({ voiceURI: e.target.value })}>
          <option value="">Automatique (meilleure voix française)</option>
          {groups.map((g) => (
            <optgroup key={g.label} label={g.label}>
              {g.items.map((o) => (
                <option key={o.voiceURI} value={o.voiceURI}>
                  {o.name} — {o.langLabel}
                  {o.local ? "" : " · en ligne"}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </Field>
      <Field label="Vitesse">
        <div className="flex flex-wrap gap-2">
          {RATES.map((r) => (
            <Chip key={r} active={Math.abs(v.rate - r) < 0.001} onClick={() => upd({ rate: r })}>
              {r.toFixed(1)}x
            </Chip>
          ))}
        </div>
      </Field>
      <Field label="Tonalité">
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted">Grave</span>
          <input
            type="range"
            min={0.5}
            max={1.5}
            step={0.1}
            value={v.pitch}
            onChange={(e) => upd({ pitch: Math.round(+e.target.value * 10) / 10 })}
            className="h-2 flex-1 cursor-pointer accent-[var(--color-accent)]"
            aria-label="Tonalité"
          />
          <span className="text-xs text-muted">Aigu</span>
        </div>
      </Field>
      <Button
        size="sm"
        variant="primary"
        onClick={() =>
          tts.speak(`Bonjour, je suis ${assistantName}. Voici un aperçu de ma voix.`, { lang: v.lang, voiceURI: v.voiceURI || undefined, rate: v.rate, pitch: v.pitch })
        }
      >
        <Play size={16} /> Tester la voix
      </Button>
    </div>
  );
}
