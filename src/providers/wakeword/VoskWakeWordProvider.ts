import type { KaldiRecognizer, Model } from "vosk-browser";
import type { WakeSensitivity } from "@/lib/types";
import { buildGrammar, matchWakeWord } from "./keywords";
import {
  WakeWordError,
  type WakeEngineStatus,
  type WakeWordDetection,
  type WakeWordProvider,
} from "./WakeWordProvider";

/**
 * Local wake-word engine: Vosk (Kaldi compiled to WebAssembly, runs in a Web Worker).
 *  - French small model served from /models (cached by the service worker → works offline).
 *  - Recogniser restricted to a grammar of wake-word variants + "[unk]".
 *  - Audio stays in the browser: never recorded, stored or sent anywhere.
 */

export const VOSK_MODEL_URL = "/models/vosk-model-small-fr-0.22.tar.gz";
const COOLDOWN_MS = 1500;
const MAX_RESTARTS = 3;

let modelPromise: Promise<Model> | null = null;

function loadModel(): Promise<Model> {
  modelPromise ??= import("vosk-browser")
    .then((vosk) => vosk.createModel(VOSK_MODEL_URL, 0))
    .catch((e) => {
      modelPromise = null;
      throw new WakeWordError("LOAD_FAILED", `${new WakeWordError("LOAD_FAILED").message} (${(e as Error)?.message ?? e})`);
    });
  return modelPromise;
}

type Listener<T extends unknown[]> = (...args: T) => void;

export class VoskWakeWordProvider implements WakeWordProvider {
  readonly id = "vosk";
  private keyword = "HomeCal";
  private sensitivity: WakeSensitivity = "normal";
  private model: Model | null = null;
  private recognizer: KaldiRecognizer | null = null;
  private stream: MediaStream | null = null;
  private ctx: AudioContext | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private node: ScriptProcessorNode | null = null;
  private paused = false;
  private running = false;
  private cooldownUntil = 0;
  private restarts = 0;
  private status: WakeEngineStatus = "unloaded";
  private detected = new Set<Listener<[WakeWordDetection]>>();
  private statusL = new Set<Listener<[WakeEngineStatus, WakeWordError | undefined]>>();
  private heard = new Set<Listener<[string]>>();

  isSupported(): boolean {
    if (typeof window === "undefined") return false;
    const w = window as unknown as { AudioContext?: unknown; webkitAudioContext?: unknown };
    return !!(
      (w.AudioContext || w.webkitAudioContext) &&
      typeof navigator.mediaDevices?.getUserMedia === "function" &&
      typeof WebAssembly !== "undefined" &&
      typeof Worker !== "undefined"
    );
  }

  onDetected(cb: Listener<[WakeWordDetection]>) {
    this.detected.add(cb);
    return () => void this.detected.delete(cb);
  }
  onStatus(cb: Listener<[WakeEngineStatus, WakeWordError | undefined]>) {
    this.statusL.add(cb);
    return () => void this.statusL.delete(cb);
  }
  onHeard(cb: Listener<[string]>) {
    this.heard.add(cb);
    return () => void this.heard.delete(cb);
  }

  private setStatus(s: WakeEngineStatus, err?: WakeWordError) {
    this.status = s;
    this.statusL.forEach((l) => l(s, err));
  }

  async start(): Promise<void> {
    if (!this.isSupported()) {
      const e = new WakeWordError("UNSUPPORTED");
      this.setStatus("error", e);
      throw e;
    }
    if (this.running) return;
    this.setStatus("loading");
    try {
      // microphone first: the permission prompt must follow the user's gesture
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: false,
        audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
      });
      this.model = await loadModel();
      this.model.on("error", (m) => {
        const err = new WakeWordError("INTERRUPTED", "error" in m ? String(m.error) : undefined);
        this.setStatus("error", err);
      });
      this.openAudio();
      this.running = true;
      this.paused = false;
      this.restarts = 0;
      this.setStatus("listening");
    } catch (e) {
      await this.releaseAudio();
      const err = toWakeError(e);
      this.setStatus("error", err);
      throw err;
    }
  }

  private openAudio() {
    if (!this.stream || !this.model) return;
    const C = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new C();
    this.createRecognizer();
    this.source = this.ctx.createMediaStreamSource(this.stream);
    // ScriptProcessor: simple and widely supported (AudioWorklet would need a separate module file)
    this.node = this.ctx.createScriptProcessor(4096, 1, 1);
    this.node.onaudioprocess = (ev) => {
      if (this.paused || !this.recognizer || Date.now() < this.cooldownUntil) return;
      try {
        this.recognizer.acceptWaveform(ev.inputBuffer);
      } catch {
        /* a dropped chunk is harmless */
      }
    };
    this.source.connect(this.node);
    // must be connected to the destination for onaudioprocess to fire (outputs silence)
    this.node.connect(this.ctx.destination);
    for (const track of this.stream.getAudioTracks()) track.onended = () => void this.handleTrackEnded();
    if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
  }

  private createRecognizer() {
    if (!this.model || !this.ctx) return;
    this.recognizer?.remove();
    const rec = new this.model.KaldiRecognizer(this.ctx.sampleRate, JSON.stringify(buildGrammar(this.keyword, this.sensitivity)));
    const handle = (text: string) => {
      if (!text) return;
      this.heard.forEach((l) => l(text));
      if (this.paused || Date.now() < this.cooldownUntil) return;
      const m = matchWakeWord(text, this.keyword, this.sensitivity);
      if (!m.matched) return;
      this.cooldownUntil = Date.now() + COOLDOWN_MS;
      // fresh recogniser: the partial that matched must not trigger again
      this.createRecognizer();
      const d: WakeWordDetection = { keyword: this.keyword, trailing: m.trailing, at: Date.now() };
      this.detected.forEach((l) => l(d));
    };
    rec.on("partialresult", (msg) => {
      if (msg.event === "partialresult") handle(msg.result.partial);
    });
    rec.on("result", (msg) => {
      if (msg.event === "result") handle(msg.result.text);
    });
    this.recognizer = rec;
  }

  private async handleTrackEnded() {
    if (!this.running) return;
    if (this.restarts >= MAX_RESTARTS) {
      this.running = false;
      await this.releaseAudio();
      this.setStatus("error", new WakeWordError("INTERRUPTED"));
      return;
    }
    this.restarts++;
    await this.releaseAudio();
    this.running = false;
    await new Promise((r) => setTimeout(r, 500 * 2 ** this.restarts));
    try {
      await this.start();
    } catch {
      /* status already set to error */
    }
  }

  private async releaseAudio() {
    try {
      this.node?.disconnect();
      this.source?.disconnect();
    } catch {
      /* ignore */
    }
    if (this.node) this.node.onaudioprocess = null;
    this.node = null;
    this.source = null;
    this.recognizer?.remove();
    this.recognizer = null;
    this.stream?.getTracks().forEach((t) => {
      t.onended = null;
      t.stop();
    });
    this.stream = null;
    if (this.ctx && this.ctx.state !== "closed") await this.ctx.close().catch(() => {});
    this.ctx = null;
  }

  async stop(): Promise<void> {
    this.running = false;
    this.paused = false;
    await this.releaseAudio();
    this.setStatus(this.model ? "ready" : "unloaded");
  }

  async pause(): Promise<void> {
    if (!this.running || this.paused) return;
    this.paused = true;
    this.setStatus("paused");
  }

  async resume(): Promise<void> {
    if (!this.running || !this.paused) return;
    this.createRecognizer(); // reset decoder state (ignore audio heard while paused)
    this.paused = false;
    if (this.ctx?.state === "suspended") await this.ctx.resume().catch(() => {});
    this.setStatus("listening");
  }

  async setSensitivity(value: WakeSensitivity): Promise<void> {
    this.sensitivity = value;
    if (this.running) this.createRecognizer();
  }

  async setKeyword(keyword: string): Promise<void> {
    this.keyword = keyword || "HomeCal";
    if (this.running) this.createRecognizer();
  }

  getStatus(): WakeEngineStatus {
    return this.status;
  }
}

function toWakeError(e: unknown): WakeWordError {
  if (e instanceof WakeWordError) return e;
  const name = (e as { name?: string })?.name;
  if (name === "NotAllowedError" || name === "SecurityError") return new WakeWordError("MIC_DENIED");
  if (name === "NotFoundError" || name === "OverconstrainedError") return new WakeWordError("NO_MIC");
  return new WakeWordError("LOAD_FAILED", `${new WakeWordError("LOAD_FAILED").message} (${(e as Error)?.message ?? e})`);
}
