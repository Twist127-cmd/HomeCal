import type { WakeSensitivity } from "@/lib/types";

/**
 * Wake word engine abstraction ("HomeCal" → active listening).
 * Detection is LOCAL: no audio is stored or sent anywhere, no LLM, no network after load.
 * The rest of the app only talks to this interface (engine-agnostic).
 */

export type WakeWordErrorCode = "UNSUPPORTED" | "MIC_DENIED" | "NO_MIC" | "LOAD_FAILED" | "INTERRUPTED" | "NOT_CONFIGURED";

export class WakeWordError extends Error {
  constructor(
    readonly code: WakeWordErrorCode,
    message?: string,
  ) {
    super(message ?? WAKE_ERROR_TEXT[code]);
    this.name = "WakeWordError";
  }
}

export const WAKE_ERROR_TEXT: Record<WakeWordErrorCode, string> = {
  UNSUPPORTED: "Le mot de réveil n'est pas disponible sur cet appareil. Vous pouvez toujours utiliser le bouton micro.",
  MIC_DENIED: "Micro refusé : autorisez le microphone pour que HomeCal détecte son nom.",
  NO_MIC: "Aucun microphone détecté.",
  LOAD_FAILED: "Le moteur du mot de réveil n'a pas pu se charger. Vous pouvez toujours utiliser le bouton micro.",
  INTERRUPTED: "L'écoute du mot de réveil s'est interrompue.",
  NOT_CONFIGURED: "Le moteur du mot de réveil n'est pas configuré.",
};

export type WakeEngineStatus = "unloaded" | "loading" | "ready" | "listening" | "paused" | "error";

export interface WakeWordDetection {
  keyword: string;
  /** Words heard right after the wake word in the same utterance ("ajoute du lait") — may be empty */
  trailing?: string;
  at: number;
}

export interface WakeWordProvider {
  readonly id: string;
  isSupported(): boolean;
  /** Load the engine/model and open the microphone (asks permission). */
  start(): Promise<void>;
  /** Release the microphone and stop the engine. */
  stop(): Promise<void>;
  /** Temporarily ignore audio (TTS / command listening) without releasing the engine. */
  pause(): Promise<void>;
  resume(): Promise<void>;
  onDetected(cb: (d: WakeWordDetection) => void): () => void;
  onStatus(cb: (s: WakeEngineStatus, error?: WakeWordError) => void): () => void;
  /** Debug/calibration: what the engine heard (text only, never audio). */
  onHeard?(cb: (text: string) => void): () => void;
  setSensitivity?(value: WakeSensitivity): Promise<void>;
  setKeyword?(keyword: string): Promise<void>;
}
