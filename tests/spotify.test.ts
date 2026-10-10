import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/features", () => ({ features: { spotify: true } }));
import { authorizeUrl, runOp, spotifyFetch } from "@/lib/server/spotify";
import { SpotifyProvider } from "@/providers/music/SpotifyProvider";

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("Spotify throttling", () => {
  it("requests explicit consent with playback and private playlist permissions", () => {
    const params = new URL(authorizeUrl("state")).searchParams;
    expect(params.get("show_dialog")).toBe("true");
    expect(params.get("scope")).toContain("user-modify-playback-state");
    expect(params.get("scope")).toContain("playlist-read-private");
  });

  it("returns real playlists without depending on the profile endpoint", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ items: [{ uri: "spotify:playlist:abc", type: "playlist", name: "Ma playlist" }] })));
    vi.stubGlobal("fetch", fetchImpl);
    await expect(runOp("test", "playlists")).resolves.toEqual([expect.objectContaining({ name: "Ma playlist" })]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0][0]).toContain("/me/playlists");
  });

  it("identifies insufficient scope from Spotify's authentication header", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Forbidden", { status: 403, headers: { "WWW-Authenticate": 'Bearer error="insufficient_scope"' } })));
    await expect(spotifyFetch("test", "PUT", "/me/player/play")).rejects.toMatchObject({ code: "SCOPE_REQUIRED", status: 403 });
  });

  it("keeps a generic Spotify denial as 403 with the failing endpoint", async () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Forbidden", { status: 403 })));
    await expect(spotifyFetch("secret-token", "GET", "/me/playlists?limit=50")).rejects.toMatchObject({ code: "ACCESS_DENIED", status: 403, message: expect.stringContaining("/me/playlists") });
    expect(JSON.stringify(warning.mock.calls)).not.toContain("secret-token");
  });

  it("preserves Spotify's plain-text account refusal without exposing the token", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("User not registered in the Developer Dashboard secret-token", { status: 403 })));
    await expect(spotifyFetch("secret-token", "GET", "/me")).rejects.toMatchObject({ message: "Spotify refuse l’accès (403, /me). User not registered in the Developer Dashboard [redacted]" });
  });
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
