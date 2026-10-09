"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { isQuestion, type PendingQuestion } from "@/assistant/agent";
import { useApp } from "@/components/app/AppProvider";
import { useAssistantRunner } from "@/components/assistant/useAssistantRunner";
import { features } from "@/lib/features";
import { beep, vibrate } from "@/lib/sound";
import { DEFAULT_SETTINGS, type HouseholdSettings } from "@/lib/types";
import { createWakeWordProvider, parsePronunciation, stripLeadingName } from "@/providers/wakeword";
import { WakeWordError, type WakeEngineStatus } from "@/providers/wakeword/WakeWordProvider";
import { VoiceOrchestrator, type VoiceState } from "@/services/voice/VoiceOrchestrator";

export interface VoiceApi {
  supported: boolean;
  enabled: boolean;
  setEnabled(v: boolean): Promise<void>;
  state: VoiceState;
  engineStatus: WakeEngineStatus;
  error: string | null;
  lastHeard: string;
  lastDetectionAt: number | null;
  metrics: { detections: number; cancelled: number; commandsStarted: number };
  test(): Promise<void>;
  /** live transcript of the command being spoken */
  partial: string;
  /** last answer (shown briefly) */
  lastResult: string | null;
  notice: string | null;
  /** another component needs the mic (assistant panel) */
  suspend(): Promise<void>;
  resume(): Promise<void>;
}

const KEY = "homecal.wakeword.enabled";
const Ctx = createContext<VoiceApi | null>(null);

const NOOP: VoiceApi = {
  supported: false,
  enabled: false,
  setEnabled: async () => {},
  state: "idle",
  engineStatus: "unloaded",
  error: null,
  lastHeard: "",
  lastDetectionAt: null,
  metrics: { detections: 0, cancelled: 0, commandsStarted: 0 },
  test: async () => {},
  partial: "",
  lastResult: null,
  notice: null,
  suspend: async () => {},
  resume: async () => {},
};

export function useVoice(): VoiceApi {
  return useContext(Ctx) ?? NOOP;
}

function readEnabled(): boolean {
  try {
    return typeof localStorage !== "undefined" && localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

type Runner = ReturnType<typeof useAssistantRunner>;

/** Latest values read by the orchestrator callbacks (outside React render). */
class LiveDeps {
  settings: HouseholdSettings | undefined;
  pending: PendingQuestion | null = null;
  constructor(public run: Runner) {}
  update(settings: HouseholdSettings | undefined, run: Runner) {
    this.settings = settings;
    this.run = run;
  }
  setPending(p: PendingQuestion | null) {
    this.pending = p;
  }
}

/** Hands-free voice mode ("HomeCal…"). Wake word enabled per device (localStorage). */
export function VoiceProvider({ children }: { children: ReactNode }) {
  const app = useApp();
  const runCommand = useAssistantRunner();
  const [enabled, setEnabledState] = useState(readEnabled);
  const [state, setState] = useState<VoiceState>("idle");
  const [engineStatus, setEngineStatus] = useState<WakeEngineStatus>("unloaded");
  const [error, setError] = useState<string | null>(null);
  const [lastHeard, setLastHeard] = useState("");
  const [partial, setPartial] = useState("");
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  // latest values for the orchestrator callbacks
  const [live] = useState(() => new LiveDeps(runCommand));
  useEffect(() => {
    live.update(app.household?.settings, runCommand);
  }, [live, app.household?.settings, runCommand]);

  const [wake] = useState(() => (typeof window === "undefined" ? null : createWakeWordProvider()));
  const { speech, tts } = app;
  const supported = features.wakeWord && !!wake?.isSupported();

  const [orchestrator] = useState(() =>
    wake
      ? new VoiceOrchestrator({
          wake,
          speech,
          tts,
          beep: () => beep(1),
          vibrate: () => vibrate(30),
          settings: () => {
            const s = live.settings;
            const w = s?.wakeWord ?? DEFAULT_SETTINGS.wakeWord;
            return { lang: s?.voice.lang ?? "fr-FR", sound: w.sound, autoListen: w.autoListen, timeoutSec: w.timeoutSec, reply: w.reply };
          },
          handleCommand: async (text) => {
            const w = live.settings?.wakeWord;
            const command = stripLeadingName(text, w?.keyword || "HomeCal", parsePronunciation(w?.pronunciation));
            const r = await live.run(command, { pending: live.pending });
            live.setPending(r?.pending ?? null);
            const out = r?.text ?? `${w?.keyword || "HomeCal"} n'est pas prêt.`;
            return {
              text: out,
              isQuestion: isQuestion(out),
              spokenNeeded: !r || !r.changed || r.actions.some((a) => !a.result.ok),
              forceSpeak: r?.speech?.force,
              rateFactor: r?.speech?.rateFactor,
              silent: r?.speech?.silent,
            };
          },
        })
      : null,
  );

  useEffect(() => {
    if (!orchestrator) return;
    return orchestrator.subscribe((e) => {
      if (e.type === "state") {
        setState(e.state!);
        setEngineStatus(orchestrator.engineStatus);
        setTick((t) => t + 1);
        if (e.state === "command-listening") {
          setPartial("");
          setNotice(null);
        }
      } else if (e.type === "partial") setPartial(e.text ?? "");
      else if (e.type === "heard") setLastHeard(e.text ?? "");
      else if (e.type === "result") setLastResult(e.text ?? null);
      else if (e.type === "notice") setNotice(e.text ?? null);
      else if (e.type === "error") setError(e.text ?? null);
    });
  }, [orchestrator]);

  // clear transient texts
  useEffect(() => {
    if (!lastResult) return;
    const t = setTimeout(() => setLastResult(null), 5000);
    return () => clearTimeout(t);
  }, [lastResult]);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 2500);
    return () => clearTimeout(t);
  }, [notice]);

  // start / stop according to the per-device toggle (only once HomeCal is ready)
  const ready = app.status === "ready";
  useEffect(() => {
    if (!orchestrator || !supported || !ready) return;
    if (enabled && !orchestrator.isWakeMode()) {
      orchestrator.startWakeMode().catch((e) => {
        setError((e as Error).message);
        if (e instanceof WakeWordError && (e.code === "MIC_DENIED" || e.code === "UNSUPPORTED")) {
          setEnabledState(false);
          try {
            localStorage.removeItem(KEY);
          } catch {
            /* ignore */
          }
        }
      });
    }
    if (!enabled && orchestrator.isWakeMode()) void orchestrator.stopWakeMode();
  }, [orchestrator, supported, enabled, ready]);

  // stop on unmount
  useEffect(() => () => void orchestrator?.stopWakeMode(), [orchestrator]);

  // keep the engine in sync with the sensitivity and assistant name settings
  const sensitivity = app.household?.settings.wakeWord?.sensitivity;
  useEffect(() => {
    if (sensitivity && wake?.setSensitivity) void wake.setSensitivity(sensitivity);
  }, [sensitivity, wake]);
  const keyword = app.household?.settings.wakeWord?.keyword || "HomeCal";
  const pronunciation = app.household?.settings.wakeWord?.pronunciation;
  useEffect(() => {
    if (wake?.setKeyword) void wake.setKeyword(keyword, parsePronunciation(pronunciation));
  }, [keyword, pronunciation, wake]);

  const setEnabled = useCallback(
    async (v: boolean) => {
      setError(null);
      if (!orchestrator || !supported) {
        setError(new WakeWordError("UNSUPPORTED").message);
        return;
      }
      if (v) {
        try {
          await orchestrator.startWakeMode(); // asks the microphone permission (explicit user action)
          localStorage.setItem(KEY, "1");
          setEnabledState(true);
        } catch (e) {
          setError((e as Error).message);
          setEnabledState(false);
        }
      } else {
        await orchestrator.stopWakeMode();
        try {
          localStorage.removeItem(KEY);
        } catch {
          /* ignore */
        }
        setEnabledState(false);
      }
    },
    [orchestrator, supported],
  );

  const metrics = orchestrator?.metrics;
  const value = useMemo<VoiceApi>(
    () => ({
      supported,
      enabled,
      setEnabled,
      state,
      engineStatus,
      error,
      lastHeard,
      lastDetectionAt: metrics?.lastDetectionAt ?? null,
      metrics: { detections: metrics?.detections ?? 0, cancelled: metrics?.cancelled ?? 0, commandsStarted: metrics?.commandsStarted ?? 0 },
      test: async () => orchestrator?.simulateWake(),
      partial,
      lastResult,
      notice,
      suspend: async () => orchestrator?.suspend(),
      resume: async () => orchestrator?.resumeFromSuspend(),
    }),
    // tick: refresh metrics on every transition
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [supported, enabled, setEnabled, state, engineStatus, error, lastHeard, partial, lastResult, notice, orchestrator, tick],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
