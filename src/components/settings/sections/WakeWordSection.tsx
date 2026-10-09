"use client";

import { Mic } from "lucide-react";
import { useState } from "react";
import { useVoice } from "@/components/voice/VoiceContext";
import { Button, Chip, Field, inputClass, Spinner, Toggle } from "@/components/ui/primitives";
import type { HouseholdSettings } from "@/lib/types";
import { isTunedKeyword, SUPPORTED_KEYWORDS } from "@/providers/wakeword/keywords";
import { Section, useHouseholdSettings } from "../shared";

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

export function WakeWordSection() {
  const { s, set } = useHouseholdSettings();
  const voice = useVoice();
  const w = s.wakeWord;
  const name = w.keyword || "HomeCal";
  const [busy, setBusy] = useState(false);
  const upd = (patch: Partial<HouseholdSettings["wakeWord"]>) => set({ wakeWord: { ...w, ...patch } });

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
