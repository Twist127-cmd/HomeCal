"use client";

import { useCallback, useEffect, useRef } from "react";
import { handleUtterance, type AgentResult, type PendingQuestion } from "@/assistant/agent";
import { ToolExecutor, type ToolContext } from "@/assistant/executor";
import { buildSystemPrompt } from "@/assistant/prompt";
import { useApp } from "@/components/app/AppProvider";
import { useScenes } from "@/components/scenes/SceneContext";
import { useModuleStores } from "@/hooks/useModules";
import { addAssistantMessage } from "@/lib/data/household";
import { features } from "@/lib/features";
import { firestore } from "@/lib/firebase/client";

export interface RunOptions {
  pending?: PendingQuestion | null;
  signal?: AbortSignal;
  onStep?(label: string): void;
  /** set false when the LLM is known to be unreachable */
  llmAvailable?: boolean;
}

/**
 * Single entry point to run an assistant command (used by the assistant panel AND the
 * hands-free voice mode): builds the tool context, calls the deterministic-first pipeline
 * and stores the conversation.
 */
export function useAssistantRunner() {
  const app = useApp();
  const stores = useModuleStores();
  const scenes = useScenes();
  const timersRef = useRef(app.timers);
  const shoppingRef = useRef(app.shopping);
  useEffect(() => {
    timersRef.current = app.timers;
    shoppingRef.current = app.shopping;
  }, [app.timers, app.shopping]);

  return useCallback(
    async (text: string, opts: RunOptions = {}): Promise<AgentResult | null> => {
      const { household, householdId, profiles, places, myProfileId, history, llm } = app;
      const t = text.trim();
      const base = app.toolContext();
      if (!t || !base || !householdId || !household) return null;
      const ctx: ToolContext = {
        ...base,
        timers: stores && features.timers ? { list: () => timersRef.current, create: stores.timers.add, update: stores.timers.update, remove: stores.timers.remove } : undefined,
        shopping:
          stores && features.shopping ? { list: () => shoppingRef.current, add: stores.shopping.add, update: stores.shopping.update, remove: stores.shopping.remove } : undefined,
        music: features.spotify ? app.music : null,
        scenes: features.scenes ? { list: () => scenes.scenes, active: () => scenes.active, activate: scenes.activate, exit: scenes.exit } : undefined,
        navigation: { app: () => household.settings.navigationApp ?? "ask", open: (url) => window.open(url, "_blank", "noopener") },
        reminders: () => app.reminders,
      };
      const now = new Date();
      const speaker = profiles.find((p) => p.id === myProfileId);
      let result: AgentResult;
      try {
        result = await handleUtterance({
          input: t,
          history: history.slice(-6).map((h) => ({ role: h.role, text: h.text })),
          systemPrompt: buildSystemPrompt({ now, householdName: household.name, profiles, places, speaker, timezone: household.settings.timezone }),
          llm: opts.llmAvailable === false ? null : llm,
          executor: new ToolExecutor(ctx),
          now,
          profiles,
          places,
          currentProfileId: myProfileId,
          pending: opts.pending,
          scenesForParsing: scenes.scenes,
          signal: opts.signal,
          onStep: opts.onStep,
        });
      } catch (e) {
        const msg = (e as Error).name === "AbortError" ? "Interrompu." : `L'assistant local ne répond pas (${(e as Error).message}).`;
        result = { text: msg, actions: [], changed: false };
      }

      // persist conversation (best effort, text only)
      const db = firestore();
      const ts = new Date().toISOString();
      addAssistantMessage(db, householdId, { role: "user", text: t, createdAt: ts }).catch(() => {});
      addAssistantMessage(db, householdId, {
        role: "assistant",
        text: result.text,
        createdAt: new Date(Date.now() + 1).toISOString(),
        toolCalls: result.actions.map((a) => ({ name: a.name, ok: a.result.ok })),
      }).catch(() => {});
      return result;
    },
    [app, stores, scenes],
  );
}
