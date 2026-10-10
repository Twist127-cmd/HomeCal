import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/features", () => ({ features: { spotify: true } }));
import { spotifyFetch } from "@/lib/server/spotify";
import { SpotifyProvider } from "@/providers/music/SpotifyProvider";

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("Spotify throttling", () => {
  it("preserves Retry-After even for a non-JSON Spotify response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Too many requests", { status: 429, headers: { "Retry-After": "90" } })));
    await expect(spotifyFetch("test", "PUT", "/me/player/play")).rejects.toMatchObject({ code: "RATE_LIMITED", status: 429, retryAfter: 90 });
  });

  it("blocks all client operations until Spotify's retry window expires", async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response("{}", { status: 429, headers: { "Retry-After": "60" } }))
      .mockResolvedValue(new Response('{"data":null}'));
    const provider = new SpotifyProvider({ getIdToken: async () => "test", getCipher: () => "sealed", onCipherRotated: vi.fn(), onDisconnect: async () => {}, fetchImpl });
    await expect(provider.play()).rejects.toMatchObject({ code: "RATE_LIMITED" });
    await expect(provider.getCurrentPlayback()).rejects.toMatchObject({ code: "RATE_LIMITED" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(60_000);
    await provider.play();
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("keeps the server's actionable error instead of hiding it", async () => {
    const provider = new SpotifyProvider({ getIdToken: async () => "test", getCipher: () => "sealed", onCipherRotated: vi.fn(), onDisconnect: async () => {}, fetchImpl: vi.fn().mockResolvedValue(new Response('{"code":"UNKNOWN","error":"Insufficient client scope"}', { status: 502 })) });
    await expect(provider.play()).rejects.toMatchObject({ message: "Insufficient client scope" });
  });
});
