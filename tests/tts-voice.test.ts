import { describe, expect, it } from "vitest";
import { chooseVoice, langLabel, voiceOptions } from "@/providers/tts/TTSProvider";

const V = (name: string, lang: string, localService = true) => ({ voiceURI: name, name, lang, localService, default: false });

const voices = [
  V("Microsoft David - English (United States)", "en-US"),
  V("Microsoft Paul - French (France)", "fr-FR"),
  V("Microsoft Denise Online (Natural) - French (France)", "fr-FR", false),
  V("Google français", "fr-FR", false),
  V("Microsoft Ariane - French (Switzerland)", "fr-CH"),
];

describe("chooseVoice (fallback chain)", () => {
  it("uses the configured voice when the device has it", () => {
    expect(chooseVoice(voices, "fr-FR", "Microsoft Paul - French (France)")?.name).toBe("Microsoft Paul - French (France)");
  });

  it("falls back to the best French voice when the chosen one is missing on this device", () => {
    expect(chooseVoice(voices, "fr-FR", "Voix d'un autre appareil")?.lang).toBe("fr-FR");
    expect(chooseVoice(voices, "fr-FR", "Voix d'un autre appareil")?.name).toMatch(/Natural|Google/);
  });

  it("automatic mode picks a French voice", () => {
    expect(chooseVoice(voices, "fr-FR", "")?.lang.startsWith("fr")).toBe(true);
  });

  it("returns null (system default voice) when nothing matches — never blocks speech", () => {
    expect(chooseVoice([V("David", "en-US")], "fr-FR", "missing")).toBeNull();
    expect(chooseVoice([], "fr-FR")).toBeNull();
  });
});

describe("voiceOptions", () => {
  it("lists French voices first with a readable label", () => {
    const opts = voiceOptions(voices, "fr-FR");
    expect(opts.slice(0, 4).every((o) => o.lang.startsWith("fr"))).toBe(true);
    expect(opts[opts.length - 1].lang).toBe("en-US");
    expect(opts.find((o) => o.voiceURI.startsWith("Microsoft Ariane"))?.name).toBe("Ariane");
    expect(opts.find((o) => o.voiceURI.startsWith("Microsoft Denise"))?.local).toBe(false);
  });

  it("langLabel", () => {
    expect(langLabel("fr-FR")).toBe("Français (France)");
    expect(langLabel("fr-CH")).toBe("Français (Suisse)");
    expect(langLabel("en_US")).toBe("Anglais (États-Unis)");
  });
});
