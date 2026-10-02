export interface SpeechSession {
  stop(): void;
  abort(): void;
}

export interface SpeechListenOptions {
  lang: string;
  onPartial?(text: string): void;
  onFinal(text: string): void;
  onError?(error: string): void;
  onEnd?(): void;
}

export interface SpeechProvider {
  readonly id: string;
  isSupported(): boolean;
  listen(opts: SpeechListenOptions): SpeechSession;
}

// ---- minimal Web Speech API typings (not in lib.dom for all TS versions) ----
interface SRAlternative {
  transcript: string;
}
interface SRResult {
  isFinal: boolean;
  0: SRAlternative;
  length: number;
}
interface SREvent {
  resultIndex: number;
  results: { length: number; [i: number]: SRResult };
}
interface SRInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: SREvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type SRCtor = new () => SRInstance;

function ctor(): SRCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const ERRORS: Record<string, string> = {
  "not-allowed": "Micro refusé : autorisez le micro dans le navigateur.",
  "service-not-allowed": "Reconnaissance vocale non autorisée sur ce navigateur.",
  "no-speech": "Je n'ai rien entendu.",
  network: "Reconnaissance vocale indisponible (réseau).",
  "audio-capture": "Aucun micro détecté.",
  aborted: "",
};

/**
 * Web Speech API (free). Chrome/Edge on desktop & Android use the browser's
 * built-in service. Not available in Firefox; Chromium on Raspberry Pi may lack it
 * (a local Whisper provider can implement this same interface later).
 */
export class WebSpeechProvider implements SpeechProvider {
  readonly id = "web-speech";

  isSupported(): boolean {
    return !!ctor();
  }

  listen(opts: SpeechListenOptions): SpeechSession {
    const C = ctor();
    if (!C) {
      opts.onError?.("La reconnaissance vocale n'est pas disponible sur ce navigateur.");
      opts.onEnd?.();
      return { stop() {}, abort() {} };
    }
    const rec = new C();
    rec.lang = opts.lang;
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    let finalText = "";
    let delivered = false;

    rec.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interim += r[0].transcript;
      }
      opts.onPartial?.((finalText + " " + interim).trim());
    };
    rec.onerror = (e) => {
      const msg = ERRORS[e.error] ?? `Erreur micro : ${e.error}`;
      if (msg) opts.onError?.(msg);
    };
    rec.onend = () => {
      if (!delivered && finalText.trim()) {
        delivered = true;
        opts.onFinal(finalText.trim());
      }
      opts.onEnd?.();
    };
    rec.start();
    return { stop: () => rec.stop(), abort: () => rec.abort() };
  }
}
