"use client";

import clsx from "clsx";
import { Mic, MicOff, Send, Sparkles, Trash2, Undo2, Volume2, VolumeX, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { handleUtterance, isQuestion, type AgentResult, type PendingQuestion } from "@/assistant/agent";
import { ToolExecutor } from "@/assistant/executor";
import { buildSystemPrompt } from "@/assistant/prompt";
import { useApp } from "@/components/app/AppProvider";
import { Button, Spinner } from "@/components/ui/primitives";
import { toast } from "@/components/ui/toast";
import { addAssistantMessage, clearAssistantHistory } from "@/lib/data/household";
import { firestore } from "@/lib/firebase/client";
import type { LLMHealth } from "@/providers/llm";
import type { SpeechSession } from "@/providers/speech/SpeechProvider";

type Phase = "idle" | "listening" | "thinking" | "speaking";

interface LocalMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  undo?: (() => Promise<void>)[];
  actions?: { name: string; ok: boolean; summary: string }[];
  pending?: boolean;
}

const SUGGESTIONS = [
  "Qu'est-ce qu'on a demain ?",
  "Quand sommes-nous libres samedi ?",
  "Ajoute dentiste jeudi à 16h",
  "Va-t-il pleuvoir ce week-end ?",
  "À quelle heure dois-je partir pour mon prochain rendez-vous ?",
];

export function AssistantPanel({
  open,
  onClose,
  initialText,
  startListening,
}: {
  open: boolean;
  onClose(): void;
  initialText?: string;
  startListening?: boolean;
}) {
  const app = useApp();
  const { llm, speech, tts, household, householdId, profiles, places, myProfileId, history } = app;
  const [phase, setPhase] = useState<Phase>("idle");
  const [step, setStep] = useState("");
  const [partial, setPartial] = useState("");
  const [input, setInput] = useState("");
  const [local, setLocal] = useState<LocalMessage[]>([]);
  const [health, setHealth] = useState<LLMHealth | null>(null);
  const [muted, setMuted] = useState(!household?.settings.voice.autoSpeak);
  const sessionRef = useRef<SpeechSession | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const handledInitial = useRef<string | null>(null);
  const pendingRef = useRef<PendingQuestion | null>(null);
  const listenRef = useRef<() => void>(() => {});

  // LLM health check when opening
  useEffect(() => {
    if (!open || !llm) return;
    let cancelled = false;
    llm.health().then((h) => !cancelled && setHealth(h));
    return () => {
      cancelled = true;
    };
  }, [open, llm]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [local, history.length, phase]);

  /** Speak `text`, then call `onDone` (immediately when the voice is muted). */
  const speak = useCallback(
    (text: string, onDone?: () => void) => {
      if (muted || !tts.isSupported()) {
        onDone?.();
        return;
      }
      setPhase("speaking");
      tts.speak(text, {
        lang: household?.settings.voice.lang ?? "fr-FR",
        onEnd: () => {
          setPhase((p) => (p === "speaking" ? "idle" : p));
          onDone?.();
        },
      });
    },
    [muted, tts, household?.settings.voice.lang],
  );

  const send = useCallback(
    async (text: string, fromVoice = false) => {
      const t = text.trim();
      const ctx = app.toolContext();
      if (!t || !ctx || !householdId || !household) return;
      tts.stop();
      const db = firestore();
      const userMsg: LocalMessage = { id: `u${Date.now()}`, role: "user", text: t };
      const pendingId = `a${Date.now()}`;
      setLocal((l) => [...l, userMsg, { id: pendingId, role: "assistant", text: "", pending: true }]);
      setInput("");
      setPartial("");
      setPhase("thinking");
      setStep("Je réfléchis…");
      abortRef.current = new AbortController();

      const now = new Date();
      const speaker = profiles.find((p) => p.id === myProfileId);
      const recent = [...history.slice(-6).map((h) => ({ role: h.role, text: h.text }))];
      let result: AgentResult;
      try {
        const llmOk = !!llm && (health?.ok ?? true);
        result = await handleUtterance({
          input: t,
          history: recent,
          systemPrompt: buildSystemPrompt({ now, householdName: household.name, profiles, places, speaker, timezone: household.settings.timezone }),
          llm: llmOk ? llm : null,
          executor: new ToolExecutor(ctx),
          now,
          profiles,
          places,
          currentProfileId: myProfileId,
          pending: pendingRef.current,
          signal: abortRef.current.signal,
          onStep: setStep,
        });
      } catch (e) {
        const msg = (e as Error).name === "AbortError" ? "Interrompu." : `L'assistant local ne répond pas (${(e as Error).message}).`;
        result = { text: msg, actions: [], changed: false };
      }
      pendingRef.current = result.pending ?? null;

      const undo = result.actions.filter((a) => a.result.undo).map((a) => a.result.undo!);
      setLocal((l) =>
        l.map((m) =>
          m.id === pendingId
            ? {
                ...m,
                text: result.text,
                pending: false,
                undo: undo.length ? undo : undefined,
                actions: result.actions.map((a) => ({ name: a.name, ok: a.result.ok, summary: a.result.summary })),
              }
            : m,
        ),
      );
      setPhase("idle");
      setStep("");
      // When the assistant asks a question, re-open the microphone for the answer
      const reopenMic = isQuestion(result.text) ? () => listenRef.current() : undefined;
      if (fromVoice || !muted) speak(result.text, reopenMic);
      else reopenMic?.();

      // persist conversation (best effort)
      const ts = new Date().toISOString();
      addAssistantMessage(db, householdId, { role: "user", text: t, createdAt: ts }).catch(() => {});
      addAssistantMessage(db, householdId, {
        role: "assistant",
        text: result.text,
        createdAt: new Date(Date.now() + 1).toISOString(),
        toolCalls: result.actions.map((a) => ({ name: a.name, ok: a.result.ok })),
      }).catch(() => {});
    },
    [app, householdId, household, profiles, places, myProfileId, history, llm, health, muted, speak, tts],
  );

  const listen = useCallback(() => {
    if (!speech.isSupported()) {
      toast({ text: "La reconnaissance vocale n'est pas disponible sur ce navigateur (utilisez Chrome ou Edge).", tone: "error" });
      return;
    }
    tts.stop();
    setPartial("");
    setPhase("listening");
    sessionRef.current = speech.listen({
      lang: household?.settings.voice.lang ?? "fr-FR",
      onPartial: setPartial,
      onFinal: (text) => send(text, true),
      onError: (msg) => toast({ text: msg, tone: "error" }),
      onEnd: () => setPhase((p) => (p === "listening" ? "idle" : p)),
    });
  }, [speech, tts, household?.settings.voice.lang, send]);

  useEffect(() => {
    listenRef.current = listen;
  }, [listen]);

  // initial text / listening when opened
  useEffect(() => {
    if (!open) return;
    const key = `${initialText ?? ""}|${startListening ? 1 : 0}`;
    if (handledInitial.current === key) return;
    handledInitial.current = key;
    const t = setTimeout(() => {
      if (initialText) send(initialText);
      else if (startListening) listen();
    }, 50);
    return () => clearTimeout(t);
  }, [open, initialText, startListening, send, listen]);

  useEffect(() => {
    if (!open) {
      sessionRef.current?.abort();
      tts.stop();
      handledInitial.current = null;
    }
  }, [open, tts]);

  if (!open) return null;

  const persisted: LocalMessage[] = history
    .filter((h) => !local.some((l) => l.text === h.text && l.role === h.role))
    .slice(-10)
    .map((h) => ({ id: h.id, role: h.role, text: h.text }));
  const messages = [...persisted, ...local];

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 animate-fade-in bg-black/30" onClick={onClose} />
      <aside className="relative flex h-full w-full max-w-md animate-slide-left flex-col bg-surface shadow-pop">
        <header className="flex items-center gap-2 border-b border-border px-4 py-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-soft text-accent">
            <Sparkles size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="font-semibold">Assistant</div>
            <div className="truncate text-xs text-muted">
              {!health ? (
                "Connexion à Ollama…"
              ) : health.ok ? (
                <span className="text-ok">
                  ● {llm?.model} {health.via === "direct" ? "(direct)" : ""}
                  {health.modelAvailable === false ? " — modèle absent, lancez « ollama pull »" : ""}
                </span>
              ) : (
                <span className="text-warn">● LLM local indisponible — mode commandes simples</span>
              )}
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setMuted((m) => !m)} title={muted ? "Activer la voix" : "Couper la voix"}>
            {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </Button>
          {history.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              title="Effacer l'historique"
              onClick={() => {
                if (householdId) clearAssistantHistory(firestore(), householdId, history.map((h) => h.id)).catch(() => {});
                setLocal([]);
              }}
            >
              <Trash2 size={18} />
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Fermer">
            <X size={20} />
          </Button>
        </header>

        <div ref={listRef} className="scroll-thin flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {messages.length === 0 && phase === "idle" && (
            <div className="py-6 text-center">
              <p className="mb-4 text-muted">Demandez-moi d&apos;ajouter, déplacer ou retrouver un événement, la météo ou un trajet.</p>
              <div className="flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => send(s)} className="rounded-full border border-border bg-surface-2 px-3 py-2 text-sm hover:bg-surface-3">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m) => (
            <div key={m.id} className={clsx("flex", m.role === "user" ? "justify-end" : "justify-start")}>
              <div
                className={clsx(
                  "max-w-[85%] rounded-2xl px-4 py-2.5 text-[15px] leading-snug",
                  m.role === "user" ? "rounded-br-md bg-accent text-white dark:text-black" : "rounded-bl-md bg-surface-2",
                )}
              >
                {m.pending ? (
                  <span className="flex items-center gap-2 text-muted">
                    <Spinner size={14} /> {step}
                  </span>
                ) : (
                  m.text
                )}
                {m.actions && m.actions.some((a) => a.name !== "getEvents" && a.name !== "searchEvents") && (
                  <div className="mt-2 space-y-0.5 border-t border-border/60 pt-2 text-xs text-muted">
                    {m.actions
                      .filter((a) => !["getEvents", "searchEvents", "getFavoritePlaces"].includes(a.name))
                      .map((a, i) => (
                        <div key={i} className={a.ok ? "" : "text-danger"}>
                          {a.ok ? "✓" : "✗"} {a.summary}
                        </div>
                      ))}
                  </div>
                )}
                {m.undo && (
                  <button
                    className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-accent"
                    onClick={async () => {
                      for (const u of [...m.undo!].reverse()) await u();
                      setLocal((l) => l.map((x) => (x.id === m.id ? { ...x, undo: undefined, text: `${x.text} (annulé)` } : x)));
                      toast({ text: "Action annulée" });
                    }}
                  >
                    <Undo2 size={14} /> Annuler
                  </button>
                )}
              </div>
            </div>
          ))}
          {phase === "listening" && (
            <div className="flex justify-end">
              <div className="max-w-[85%] rounded-2xl rounded-br-md border border-dashed border-accent px-4 py-2.5 text-[15px] text-muted italic">
                {partial || "Je vous écoute…"}
              </div>
            </div>
          )}
        </div>

        <footer className="safe-bottom border-t border-border px-4 pt-3">
          <div className="mb-3 flex justify-center">
            <button
              onClick={() => (phase === "listening" ? sessionRef.current?.stop() : phase === "thinking" ? abortRef.current?.abort() : listen())}
              className={clsx(
                "flex h-20 w-20 items-center justify-center rounded-full text-white shadow-pop transition active:scale-95",
                phase === "listening" ? "animate-pulse-ring bg-danger" : "bg-accent dark:text-black",
              )}
              aria-label={phase === "listening" ? "Arrêter l'écoute" : "Parler"}
            >
              {phase === "thinking" ? <Spinner size={28} /> : phase === "listening" ? <MicOff size={30} /> : <Mic size={32} />}
            </button>
          </div>
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Écrire à l'assistant…"
              className="h-12 min-w-0 flex-1 rounded-full border border-border bg-surface-2 px-4 outline-none focus:border-accent"
            />
            <Button type="submit" variant="primary" size="icon" disabled={!input.trim() || phase === "thinking"}>
              <Send size={18} />
            </Button>
          </form>
        </footer>
      </aside>
    </div>
  );
}
