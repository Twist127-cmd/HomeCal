import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handleUtterance } from "@/assistant/agent";
import { VoiceOrchestrator, type CommandOutcome, type VoiceSettings, type VoiceState } from "@/services/voice/VoiceOrchestrator";
import type { SpeechListenOptions, SpeechProvider } from "@/providers/speech/SpeechProvider";
import type { TTSProvider } from "@/providers/tts/TTSProvider";
import { WakeWordError, type WakeEngineStatus, type WakeWordDetection, type WakeWordProvider } from "@/providers/wakeword/WakeWordProvider";
import { makeAssistant } from "./helpers/assistant";

function fakeWake(opts: { failStart?: WakeWordError } = {}) {
  const log: string[] = [];
  let detect: ((d: WakeWordDetection) => void) | null = null;
  const w: WakeWordProvider = {
    id: "fake",
    isSupported: () => true,
    start: async () => {
      if (opts.failStart) throw opts.failStart;
      log.push("start");
    },
    stop: async () => void log.push("stop"),
    pause: async () => void log.push("pause"),
    resume: async () => void log.push("resume"),
    onDetected: (cb) => {
      detect = cb;
      return () => (detect = null);
    },
    onStatus: (cb: (s: WakeEngineStatus) => void) => (cb("ready"), () => {}),
  };
  return { w, log, fire: (trailing = "") => detect?.({ keyword: "HomeCal", trailing, at: Date.now() }) };
}

function fakeSpeech() {
  let current: SpeechListenOptions | null = null;
  let sessions = 0;
  const s: SpeechProvider = {
    id: "fake",
    isSupported: () => true,
    listen: (o) => {
      sessions++;
      current = o;
      return { stop: () => o.onEnd?.(), abort: () => (current = null) };
    },
  };
  return {
    s,
    sessions: () => sessions,
    say: (text: string) => {
      const o = current!;
      current = null;
      o.onFinal(text);
      o.onEnd?.();
    },
    silence: () => {
      const o = current!;
      current = null;
      o.onEnd?.();
    },
    active: () => !!current,
  };
}

function fakeTts() {
  const spoken: string[] = [];
  let pendingEnd: (() => void) | null = null;
  const t: TTSProvider = {
    id: "fake",
    isSupported: () => true,
    speak: (text, o) => {
      spoken.push(text);
      pendingEnd = o?.onEnd ?? null;
    },
    stop: () => {},
  };
  return { t, spoken, end: () => pendingEnd?.() };
}

const settings = (over: Partial<VoiceSettings> = {}): VoiceSettings => ({ lang: "fr-FR", sound: true, autoListen: true, timeoutSec: 6, reply: "needed", ...over });
const flush = () => new Promise((r) => setTimeout(r, 0));

describe("VoiceOrchestrator state machine", () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] }));
  afterEach(() => vi.useRealTimers());

  async function setup(over: Partial<VoiceSettings> = {}, outcome: (t: string) => CommandOutcome = (t) => ({ text: `ok:${t}`, isQuestion: false, spokenNeeded: false })) {
    const wake = fakeWake();
    const speech = fakeSpeech();
    const tts = fakeTts();
    const commands: string[] = [];
    const states: VoiceState[] = [];
    let beeps = 0;
    const o = new VoiceOrchestrator({
      wake: wake.w,
      speech: speech.s,
      tts: tts.t,
      settings: () => settings(over),
      beep: () => beeps++,
      handleCommand: async (t) => {
        commands.push(t);
        return outcome(t);
      },
    });
    o.subscribe((e) => e.type === "state" && states.push(e.state!));
    await o.startWakeMode();
    return { o, wake, speech, tts, commands, states, beeps: () => beeps };
  }

  it("wake → command listening → processing → back to wake word (no speech for a simple action)", async () => {
    const t = await setup();
    expect(t.o.getState()).toBe("wakeword-listening");
    t.wake.fire();
    await vi.advanceTimersByTimeAsync(0);
    expect(t.o.getState()).toBe("command-listening");
    expect(t.beeps()).toBe(1);
    expect(t.wake.log).toContain("pause");
    t.speech.say("Ajoute du lait aux courses");
    await vi.advanceTimersByTimeAsync(0);
    expect(t.commands).toEqual(["Ajoute du lait aux courses"]);
    expect(t.tts.spoken).toEqual([]); // "needed" mode: simple action is not spoken
    expect(t.o.getState()).toBe("wakeword-listening");
    expect(t.wake.log.at(-1)).toBe("resume");
    expect(t.states).toEqual(["wakeword-listening", "wakeword-detected", "command-listening", "processing", "wakeword-listening"]);
  });

  it("information answers are spoken with the wake word paused, then wake resumes after TTS", async () => {
    const t = await setup({}, (x) => ({ text: `Demain : Dentiste à 16h.`, isQuestion: false, spokenNeeded: x.includes("demain") }));
    t.wake.fire();
    await vi.advanceTimersByTimeAsync(0);
    t.speech.say("qu'est-ce que j'ai demain");
    await vi.advanceTimersByTimeAsync(0);
    expect(t.o.getState()).toBe("speaking");
    expect(t.tts.spoken).toEqual(["Demain : Dentiste à 16h."]);
    // HomeCal hears its own name while speaking → ignored
    t.wake.fire();
    await vi.advanceTimersByTimeAsync(0);
    expect(t.o.getState()).toBe("speaking");
    t.tts.end();
    await vi.advanceTimersByTimeAsync(0);
    expect(t.o.getState()).toBe("wakeword-listening");
    expect(t.wake.log.at(-1)).toBe("resume");
  });

  it("times out silently back to wake-word mode when nothing is said", async () => {
    const t = await setup({ timeoutSec: 6 });
    const notices: string[] = [];
    t.o.subscribe((e) => e.type === "notice" && notices.push(e.text!));
    t.wake.fire();
    await vi.advanceTimersByTimeAsync(0);
    expect(t.o.getState()).toBe("command-listening");
    await vi.advanceTimersByTimeAsync(6100);
    expect(t.o.getState()).toBe("wakeword-listening");
    expect(t.o.metrics.cancelled).toBe(1);
    expect(t.tts.spoken).toEqual([]); // HomeCal does not talk for nothing
    expect(notices).toContain("Je n'ai rien entendu.");
  });

  it("ignores double triggers (cooldown) and never opens two recognitions", async () => {
    const t = await setup();
    t.wake.fire();
    t.wake.fire();
    await vi.advanceTimersByTimeAsync(0);
    expect(t.speech.sessions()).toBe(1);
    expect(t.o.metrics.detections).toBe(1);
  });

  it("one-shot command after the wake word is processed directly", async () => {
    const t = await setup();
    t.wake.fire("ajoute du lait aux courses");
    await vi.advanceTimersByTimeAsync(0);
    expect(t.speech.sessions()).toBe(0);
    expect(t.commands).toEqual(["ajoute du lait aux courses"]);
    expect(t.o.getState()).toBe("wakeword-listening");
  });

  it("a question from the assistant re-opens the microphone for the answer (no wake word)", async () => {
    let n = 0;
    const t = await setup({ reply: "needed" }, () => (n++ === 0 ? { text: "À quelle heure ?", isQuestion: true, spokenNeeded: true } : { text: "✓ Dentiste ajouté.", isQuestion: false, spokenNeeded: false }));
    t.wake.fire();
    await vi.advanceTimersByTimeAsync(0);
    t.speech.say("ajoute dentiste vendredi");
    await vi.advanceTimersByTimeAsync(0);
    t.tts.end();
    await vi.advanceTimersByTimeAsync(0);
    expect(t.o.getState()).toBe("command-listening");
    t.speech.say("16h");
    await vi.advanceTimersByTimeAsync(0);
    expect(t.commands).toEqual(["ajoute dentiste vendredi", "16h"]);
    expect(t.o.getState()).toBe("wakeword-listening");
  });

  it("reply mode 'always' speaks every answer, 'never' none", async () => {
    const a = await setup({ reply: "always" });
    a.wake.fire();
    await vi.advanceTimersByTimeAsync(0);
    a.speech.say("pause la musique");
    await vi.advanceTimersByTimeAsync(0);
    expect(a.tts.spoken).toEqual(["ok:pause la musique"]);
    const b = await setup({ reply: "never" }, () => ({ text: "Demain : rien.", isQuestion: false, spokenNeeded: true }));
    b.wake.fire();
    await vi.advanceTimersByTimeAsync(0);
    b.speech.say("demain");
    await vi.advanceTimersByTimeAsync(0);
    expect(b.tts.spoken).toEqual([]);
  });

  it("suspend (manual mic / assistant panel) pauses the wake word, resume restores it", async () => {
    const t = await setup();
    await t.o.suspend();
    expect(t.o.getState()).toBe("idle");
    t.wake.fire();
    await vi.advanceTimersByTimeAsync(0);
    expect(t.speech.sessions()).toBe(0);
    await t.o.resumeFromSuspend();
    expect(t.o.getState()).toBe("wakeword-listening");
  });

  it("microphone refused → error state with a clear message", async () => {
    const wake = fakeWake({ failStart: new WakeWordError("MIC_DENIED") });
    const o = new VoiceOrchestrator({ wake: wake.w, speech: fakeSpeech().s, tts: fakeTts().t, settings: () => settings(), handleCommand: async () => ({ text: "", isQuestion: false, spokenNeeded: false }) });
    await expect(o.startWakeMode()).rejects.toMatchObject({ code: "MIC_DENIED" });
    expect(o.getState()).toBe("error");
  });

  it("stop releases everything", async () => {
    const t = await setup();
    await t.o.stopWakeMode();
    expect(t.o.getState()).toBe("idle");
    expect(t.wake.log.at(-1)).toBe("stop");
  });
});

describe("wake word + fast paths (real assistant pipeline, no LLM)", () => {
  it("HomeCal → 'Minuteur 8 minutes pour les pâtes' creates the timer with 0 LLM call", async () => {
    const a = makeAssistant();
    const wake = fakeWake();
    const speech = fakeSpeech();
    let llmCalls = 0;
    const o = new VoiceOrchestrator({
      wake: wake.w,
      speech: speech.s,
      tts: fakeTts().t,
      settings: () => settings(),
      handleCommand: async (text) => {
        const r = await handleUtterance({
          ...a.base,
          input: text,
          llm: { id: "ollama", model: "x", health: async () => ({ ok: true }), chat: async () => (llmCalls++, { content: "", toolCalls: [] }) },
        });
        return { text: r.text, isQuestion: r.text.trim().endsWith("?"), spokenNeeded: !r.changed };
      },
    });
    await o.startWakeMode();
    wake.fire();
    await flush();
    speech.say("Minuteur 8 minutes pour les pâtes");
    await flush();
    await flush();
    expect(a.timers).toHaveLength(1);
    expect(a.timers[0].label).toMatch(/pâtes/i);
    expect(llmCalls).toBe(0);
    expect(o.getState()).toBe("wakeword-listening");
  });
});
