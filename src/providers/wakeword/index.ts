import { VoskWakeWordProvider } from "./VoskWakeWordProvider";
import type { WakeWordProvider } from "./WakeWordProvider";

export * from "./WakeWordProvider";
export { buildGrammar, matchWakeWord, normalizeHeard, SUPPORTED_KEYWORDS } from "./keywords";
export { VoskWakeWordProvider, VOSK_MODEL_URL } from "./VoskWakeWordProvider";
export { PorcupineWakeWordProvider } from "./PorcupineWakeWordProvider";

let instance: WakeWordProvider | null = null;

/** Wake-word engine used by HomeCal (Vosk, local & free). Singleton: one microphone owner. */
export function createWakeWordProvider(): WakeWordProvider {
  instance ??= new VoskWakeWordProvider();
  return instance;
}
