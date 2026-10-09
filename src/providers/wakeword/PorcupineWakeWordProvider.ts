import { WakeWordError, type WakeEngineStatus, type WakeWordDetection, type WakeWordProvider } from "./WakeWordProvider";

/**
 * Picovoice Porcupine — NOT USED.
 * Picovoice discontinued its free tier on June 30 2026 (paid AccessKey only), which is
 * incompatible with HomeCal's 0 €/month goal. Kept as a stub so the engine can be swapped
 * later without touching the rest of the app.
 */
export class PorcupineWakeWordProvider implements WakeWordProvider {
  readonly id = "porcupine";
  isSupported(): boolean {
    return false;
  }
  async start(): Promise<void> {
    throw new WakeWordError("NOT_CONFIGURED", "Porcupine est payant depuis juin 2026 (non utilisé)");
  }
  async stop(): Promise<void> {}
  async pause(): Promise<void> {}
  async resume(): Promise<void> {}
  onDetected(_cb: (d: WakeWordDetection) => void) {
    void _cb;
    return () => {};
  }
  onStatus(_cb: (s: WakeEngineStatus, error?: WakeWordError) => void) {
    void _cb;
    return () => {};
  }
}
