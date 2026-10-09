export interface SpeakOptions {
  lang?: string;
  /** absolute rate (overrides the configured one — used by the voice preview) */
  rate?: number;
  /** multiplier applied to the configured rate ("plus lentement" = 0.8) */
  rateFactor?: number;
  pitch?: number;
  /** voice override (preview) */
  voiceURI?: string;
  onEnd?(): void;
}

export interface TTSProvider {
  readonly id: string;
  isSupported(): boolean;
  speak(text: string, opts?: SpeakOptions): void;
  stop(): void;
}

/** Voice chosen in the settings (household-wide). */
export interface TTSVoiceConfig {
  voiceURI?: string;
  rate?: number;
  pitch?: number;
}

export interface VoiceOption {
  voiceURI: string;
  name: string;
  lang: string;
  /** "Français (France)" */
  langLabel: string;
  local: boolean;
}

const DEFAULT_RATE = 1;

/**
 * Best voice for `lang` among `voices`:
 *   1. the configured voice when this device has it,
 *   2. otherwise the best voice of the language (natural/online first, exact locale),
 *   3. otherwise null → the system default voice. Never blocks speech.
 */
export function chooseVoice<V extends Pick<SpeechSynthesisVoice, "voiceURI" | "name" | "lang">>(voices: V[], lang: string, preferredURI?: string): V | null {
  if (preferredURI) {
    const exact = voices.find((v) => v.voiceURI === preferredURI);
    if (exact) return exact;
  }
  const base = lang.slice(0, 2).toLowerCase();
  const candidates = voices.filter((v) => v.lang.toLowerCase().replace("_", "-").startsWith(base));
  const score = (v: V) =>
    (/natural|neural|online|google/i.test(v.name) ? 4 : 0) +
    (v.lang.toLowerCase().replace("_", "-") === lang.toLowerCase() ? 2 : 0) +
    (/denise|julie|hortense|amelie|thomas|audrey/i.test(v.name) ? 1 : 0);
  return [...candidates].sort((a, b) => score(b) - score(a))[0] ?? null;
}

const LANG_NAMES: Record<string, string> = { fr: "Français", en: "Anglais", de: "Allemand", it: "Italien", es: "Espagnol", pt: "Portugais", nl: "Néerlandais" };
const REGION_NAMES: Record<string, string> = { FR: "France", CH: "Suisse", BE: "Belgique", CA: "Canada", LU: "Luxembourg", US: "États-Unis", GB: "Royaume-Uni", DE: "Allemagne", AT: "Autriche", IT: "Italie", ES: "Espagne" };

export function langLabel(lang: string): string {
  const [l, r] = lang.replace("_", "-").split("-");
  const name = LANG_NAMES[l?.toLowerCase()] ?? l;
  const region = r ? (REGION_NAMES[r.toUpperCase()] ?? r.toUpperCase()) : "";
  return region ? `${name} (${region})` : name;
}

/** Device voices for the picker: the language's voices first (natural first), then the others. */
export function voiceOptions(voices: Pick<SpeechSynthesisVoice, "voiceURI" | "name" | "lang" | "localService">[], lang = "fr-FR"): VoiceOption[] {
  const base = lang.slice(0, 2).toLowerCase();
  const rank = (v: (typeof voices)[number]) => (v.lang.toLowerCase().startsWith(base) ? 0 : 1);
  return [...voices]
    .sort((a, b) => rank(a) - rank(b) || a.lang.localeCompare(b.lang) || a.name.localeCompare(b.name))
    .map((v) => ({
      voiceURI: v.voiceURI,
      name: v.name.replace(/^Microsoft\s+/i, "").replace(/\s+-\s+.*$/, "").replace(/\s+Online \(Natural\)$/i, " (naturelle)"),
      lang: v.lang,
      langLabel: langLabel(v.lang),
      local: v.localService,
    }));
}

/** SpeechSynthesis Web API (free, offline voices on Windows / Android / ChromeOS). */
export class WebSpeechTTSProvider implements TTSProvider {
  readonly id = "speech-synthesis";
  private config: TTSVoiceConfig = {};
  private listeners = new Set<() => void>();
  private watching = false;

  isSupported(): boolean {
    return typeof window !== "undefined" && "speechSynthesis" in window;
  }

  /** Apply the household voice settings (used by every existing speech: assistant, timers, reminders…). */
  configure(config: TTSVoiceConfig) {
    this.config = { ...config };
  }

  /** Voices of this device (may be empty until `voiceschanged` fires). */
  getVoices(): SpeechSynthesisVoice[] {
    return this.isSupported() ? window.speechSynthesis.getVoices() : [];
  }

  /** Subscribe to the device voice list (Chrome loads it asynchronously). */
  onVoicesChanged(cb: () => void): () => void {
    this.listeners.add(cb);
    if (this.isSupported() && !this.watching) {
      this.watching = true;
      window.speechSynthesis.addEventListener?.("voiceschanged", () => this.listeners.forEach((l) => l()));
    }
    return () => void this.listeners.delete(cb);
  }

  speak(text: string, opts: SpeakOptions = {}) {
    if (!this.isSupported() || !text.trim()) {
      opts.onEnd?.();
      return;
    }
    const lang = opts.lang ?? "fr-FR";
    const synth = window.speechSynthesis;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(cleanForSpeech(text));
    u.lang = lang;
    const rate = (opts.rate ?? this.config.rate ?? DEFAULT_RATE) * (opts.rateFactor ?? 1);
    u.rate = Math.min(2, Math.max(0.5, rate));
    u.pitch = Math.min(2, Math.max(0, opts.pitch ?? this.config.pitch ?? 1));
    const v = chooseVoice(synth.getVoices(), lang, opts.voiceURI ?? this.config.voiceURI);
    if (v) {
      u.voice = v;
      u.lang = v.lang;
    }
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
