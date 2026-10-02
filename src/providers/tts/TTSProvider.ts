export interface TTSProvider {
  readonly id: string;
  isSupported(): boolean;
  speak(text: string, opts?: { lang?: string; rate?: number; onEnd?(): void }): void;
  stop(): void;
}

/** SpeechSynthesis Web API (free, offline voices on Windows / Android / ChromeOS). */
export class WebSpeechTTSProvider implements TTSProvider {
  readonly id = "speech-synthesis";
  private voice: SpeechSynthesisVoice | null = null;

  isSupported(): boolean {
    return typeof window !== "undefined" && "speechSynthesis" in window;
  }

  private pickVoice(lang: string): SpeechSynthesisVoice | null {
    if (this.voice && this.voice.lang.startsWith(lang.slice(0, 2))) return this.voice;
    const voices = window.speechSynthesis.getVoices();
    const base = lang.slice(0, 2).toLowerCase();
    const candidates = voices.filter((v) => v.lang.toLowerCase().startsWith(base));
    // prefer natural/online voices, then exact locale
    const score = (v: SpeechSynthesisVoice) =>
      (/natural|neural|online|google/i.test(v.name) ? 4 : 0) +
      (v.lang.toLowerCase() === lang.toLowerCase() ? 2 : 0) +
      (/denise|julie|hortense|amelie|thomas|audrey/i.test(v.name) ? 1 : 0);
    this.voice = candidates.sort((a, b) => score(b) - score(a))[0] ?? null;
    return this.voice;
  }

  speak(text: string, opts: { lang?: string; rate?: number; onEnd?(): void } = {}) {
    if (!this.isSupported() || !text.trim()) {
      opts.onEnd?.();
      return;
    }
    const lang = opts.lang ?? "fr-FR";
    const synth = window.speechSynthesis;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(cleanForSpeech(text));
    u.lang = lang;
    u.rate = opts.rate ?? 1.05;
    const v = this.pickVoice(lang);
    if (v) u.voice = v;
    u.onend = () => opts.onEnd?.();
    u.onerror = () => opts.onEnd?.();
    synth.speak(u);
  }

  stop() {
    if (this.isSupported()) window.speechSynthesis.cancel();
  }
}

/** Make text pleasant to hear: 16h30 → 16 heures 30, remove emojis/markdown. */
export function cleanForSpeech(text: string): string {
  return text
    .replace(/[*_#`>]/g, "")
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/\b(\d{1,2})h(\d{2})\b/g, "$1 heures $2")
    .replace(/\b(\d{1,2})h\b/g, "$1 heures")
    .replace(/\s+/g, " ")
    .trim();
}
