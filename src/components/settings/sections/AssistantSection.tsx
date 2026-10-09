"use client";

import { RefreshCw, Star } from "lucide-react";
import { useState } from "react";
import { Button, Chip, Field, inputClass, Spinner } from "@/components/ui/primitives";
import { auth } from "@/lib/firebase/client";
import type { LLMHealth } from "@/providers/llm";
import { createLLMProvider } from "@/providers/llm";
import { Section, useHouseholdSettings } from "../shared";

export function AssistantSection() {
  const { s, set } = useHouseholdSettings();
  const [health, setHealth] = useState<LLMHealth | null>(null);
  const [testing, setTesting] = useState(false);
  const llm = s.llm;
  const onChange = (next: typeof llm) => set({ llm: next });
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
