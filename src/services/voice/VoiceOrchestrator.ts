import type { SpokenReplyMode } from "@/lib/types";
import type { SpeechProvider, SpeechSession } from "@/providers/speech/SpeechProvider";
import type { TTSProvider } from "@/providers/tts/TTSProvider";
import type { WakeEngineStatus, WakeWordDetection, WakeWordProvider } from "@/providers/wakeword/WakeWordProvider";
import { WakeWordError } from "@/providers/wakeword/WakeWordProvider";

/**
 * Central voice state machine — the ONLY owner of the microphone.
 *
 *   wakeword-listening → wakeword-detected → command-listening → processing → (speaking) → wakeword-listening
 *
 * Audio exclusivity: the wake-word engine is paused while the command is being listened to
 * and while HomeCal speaks (it must never hear its own name), then resumed.
 * No audio is stored or sent; the LLM is never used to detect the wake word.
 */

export type VoiceState = "idle" | "wakeword-listening" | "wakeword-detected" | "command-listening" | "processing" | "speaking" | "error";

export interface CommandOutcome {
  text: string;
  /** the assistant asked a question → listen again for the answer (no wake word needed) */
  isQuestion: boolean;
  /** information answer (weather, agenda…) or failure → worth speaking in "needed" mode */
  spokenNeeded: boolean;
  /** explicit spoken request ("répète", "quelle heure est-il ?") → spoken whatever the reply mode */
  forceSpeak?: boolean;
  /** TTS rate hint ("plus lentement") */
  rate?: number;
  /** never spoken ("tais-toi") */
  silent?: boolean;
}

export interface VoiceSettings {
  lang: string;
  sound: boolean;
  autoListen: boolean;
  timeoutSec: number;
  reply: SpokenReplyMode;
}

export interface VoiceEvent {
  type: "state" | "partial" | "heard" | "result" | "notice" | "error";
  state?: VoiceState;
  text?: string;
}

export interface VoiceMetrics {
  detections: number;
  cancelled: number;
  commandsStarted: number;
  lastDetectionAt: number | null;
  /** ms between wake-word detection and command listening start */
  lastWakeLatencyMs: number | null;
}

export interface OrchestratorDeps {
  wake: WakeWordProvider;
  speech: SpeechProvider;
  tts: TTSProvider;
  handleCommand(text: string): Promise<CommandOutcome>;
  settings(): VoiceSettings;
  beep?(): void;
  vibrate?(): void;
  now?(): number;
}

const COOLDOWN_MS = 1500;
const MAX_FOLLOW_UPS = 2;

export class VoiceOrchestrator {
  private state: VoiceState = "idle";
  private listeners = new Set<(e: VoiceEvent) => void>();
  private session: SpeechSession | null = null;
  private timeout: ReturnType<typeof setTimeout> | null = null;
  private unsub: (() => void)[] = [];
  private wakeMode = false;
  private suspended = 0;
  private lastDetection = 0;
  private followUps = 0;
  private gotFinal = false;
  readonly metrics: VoiceMetrics = { detections: 0, cancelled: 0, commandsStarted: 0, lastDetectionAt: null, lastWakeLatencyMs: null };
  engineStatus: WakeEngineStatus = "unloaded";

  constructor(private readonly d: OrchestratorDeps) {}

  private now() {
    return this.d.now ? this.d.now() : Date.now();
  }

  getState(): VoiceState {
    return this.state;
  }

  subscribe(cb: (e: VoiceEvent) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private emit(e: VoiceEvent) {
    for (const l of this.listeners) l(e);
  }

  private set(state: VoiceState) {
    if (this.state === state) return;
    this.state = state;
    this.emit({ type: "state", state });
  }

  // ------------------------------------------------------------------ wake mode

  async startWakeMode(): Promise<void> {
    if (this.wakeMode) return;
    if (!this.d.wake.isSupported()) {
      this.set("error");
      throw new WakeWordError("UNSUPPORTED");
    }
    this.wakeMode = true;
    this.unsub.push(
      this.d.wake.onDetected((det) => void this.onWake(det)),
      this.d.wake.onStatus((s, err) => {
        this.engineStatus = s;
        if (s === "error" && err) {
          this.emit({ type: "error", text: err.message });
          if (this.state === "wakeword-listening") this.set("error");
        }
      }),
    );
    if (this.d.wake.onHeard) this.unsub.push(this.d.wake.onHeard((t) => this.emit({ type: "heard", text: t })));
    try {
      await this.d.wake.start();
      this.set(this.suspended ? "idle" : "wakeword-listening");
      if (this.suspended) await this.d.wake.pause();
    } catch (e) {
      this.wakeMode = false;
      this.unsub.forEach((u) => u());
      this.unsub = [];
      this.set("error");
      throw e instanceof WakeWordError ? e : new WakeWordError("LOAD_FAILED", (e as Error).message);
    }
  }

  async stopWakeMode(): Promise<void> {
    this.wakeMode = false;
    this.clearTimer();
    this.session?.abort();
    this.session = null;
    this.unsub.forEach((u) => u());
    this.unsub = [];
    await this.d.wake.stop().catch(() => {});
    this.set("idle");
  }

  isWakeMode() {
    return this.wakeMode;
  }

  /**
   * Another component needs the microphone (manual mic button / assistant panel open):
   * the wake word is paused until resume. Nested calls are counted.
   */
  async suspend(): Promise<void> {
    this.suspended++;
    if (this.suspended > 1) return;
    this.clearTimer();
    this.session?.abort();
    this.session = null;
    if (this.wakeMode) await this.d.wake.pause().catch(() => {});
    if (this.state !== "error") this.set("idle");
  }

  async resumeFromSuspend(): Promise<void> {
    if (this.suspended === 0) return;
    this.suspended--;
    if (this.suspended > 0) return;
    await this.backToWake();
  }

  /** Simulate a detection (settings "Tester", tests). */
  async simulateWake(trailing = ""): Promise<void> {
    await this.onWake({ keyword: "test", trailing, at: this.now() });
  }

  // ------------------------------------------------------------------ flow

  private async onWake(det: WakeWordDetection): Promise<void> {
    const t = this.now();
    // double triggers / not ready / busy → ignore
    if (this.suspended || (this.state !== "wakeword-listening" && this.state !== "idle" && this.state !== "error")) return;
    if (t - this.lastDetection < COOLDOWN_MS) return;
    this.lastDetection = t;
    this.metrics.detections++;
    this.metrics.lastDetectionAt = t;
    this.followUps = 0;
    this.set("wakeword-detected");
    if (this.wakeMode) await this.d.wake.pause().catch(() => {});
    if (this.d.settings().sound) this.d.beep?.();
    else this.d.vibrate?.();

    const trailing = det.trailing?.trim() ?? "";
    if (trailing.split(/\s+/).length >= 2) {
      // one-shot "HomeCal, ajoute du lait aux courses"
      await this.process(trailing);
      return;
    }
    if (this.d.settings().autoListen) await this.startCommandListening(t);
    else await this.backToWake();
  }

  async startCommandListening(detectedAt?: number): Promise<void> {
    if (this.session) return; // never two recognitions at once
    if (!this.d.speech.isSupported()) {
      this.emit({ type: "notice", text: "La reconnaissance vocale n'est pas disponible sur ce navigateur." });
      await this.backToWake();
      return;
    }
    if (this.wakeMode && this.state !== "wakeword-detected") await this.d.wake.pause().catch(() => {});
    this.set("command-listening");
    this.metrics.commandsStarted++;
    if (detectedAt !== undefined) this.metrics.lastWakeLatencyMs = this.now() - detectedAt;
    this.gotFinal = false;
    const s = this.d.settings();
    this.session = this.d.speech.listen({
      lang: s.lang,
      onPartial: (text) => this.emit({ type: "partial", text }),
      onFinal: (text) => {
        this.gotFinal = true;
        this.clearTimer();
        this.session = null;
        void this.process(text);
      },
      onError: (msg) => {
        if (msg) this.emit({ type: "notice", text: msg });
      },
      onEnd: () => {
        this.session = null;
        if (!this.gotFinal && this.state === "command-listening") void this.cancelCommand();
      },
    });
    this.clearTimer();
    this.timeout = setTimeout(() => void this.cancelCommand(true), Math.max(2, s.timeoutSec) * 1000);
  }

  async stopCommandListening(): Promise<void> {
    this.session?.stop();
  }

  private async cancelCommand(timedOut = false): Promise<void> {
    if (this.state !== "command-listening") return;
    this.clearTimer();
    const s = this.session;
    this.session = null;
    s?.abort();
    this.metrics.cancelled++;
    if (timedOut || !this.gotFinal) this.emit({ type: "notice", text: "Je n'ai rien entendu." });
    await this.backToWake();
  }

  private async process(text: string): Promise<void> {
    this.set("processing");
    let out: CommandOutcome;
    try {
      out = await this.d.handleCommand(text);
    } catch (e) {
      out = { text: `Je n'ai pas pu traiter la demande (${(e as Error).message}).`, isQuestion: false, spokenNeeded: true };
    }
    this.emit({ type: "result", text: out.text });
    const mode = this.d.settings().reply;
    const speakIt = !out.silent && (!!out.forceSpeak ||mode === "always" || (mode === "needed" && (out.spokenNeeded || out.isQuestion)));
    const followUp = out.isQuestion && this.d.settings().autoListen && this.followUps < MAX_FOLLOW_UPS;
    if (speakIt && this.d.tts.isSupported()) {
      await this.speak(out.text, out.rate);
    }
    if (followUp) {
      this.followUps++;
      await this.startCommandListening();
      return;
    }
    await this.backToWake();
  }

  /** Speak with the wake word paused (HomeCal must not hear its own name). */
  speak(text: string, rate?: number): Promise<void> {
    return new Promise((resolve) => {
      this.set("speaking");
      if (this.wakeMode) void this.d.wake.pause().catch(() => {});
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        resolve();
      };
      this.d.tts.speak(text, { lang: this.d.settings().lang, rate, onEnd: finish });
      // safety net if the TTS engine never fires onEnd (slower speech lasts longer)
      setTimeout(finish, Math.min(25000, 1500 + (text.length * 90) / Math.min(1, rate ?? 1)));
    });
  }

  private async backToWake(): Promise<void> {
    this.clearTimer();
    if (this.suspended) {
      this.set("idle");
      return;
    }
    if (this.wakeMode) {
      await this.d.wake.resume().catch(() => {});
      this.set("wakeword-listening");
    } else this.set("idle");
  }

  private clearTimer() {
    if (this.timeout) clearTimeout(this.timeout);
    this.timeout = null;
  }
}
