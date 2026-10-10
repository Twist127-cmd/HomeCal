import "server-only";
import type { MusicDevice, MusicItem, MusicItemType, MusicOp, MusicProfile, PlaybackState } from "@/providers/music/MusicProvider";

/**
 * Spotify Web API (server side). Client secret and refresh tokens never leave the server
 * in clear text. Player endpoints require Spotify Premium.
 */

const clean = (v?: string) => (v ?? "").replace(/^﻿/, "").trim();
const API = "https://api.spotify.com/v1";

export const SPOTIFY_SCOPES = [
  "user-read-private",
  "user-read-playback-state",
  "user-modify-playback-state",
  "user-read-currently-playing",
  "user-read-recently-played",
  "playlist-read-private",
  "playlist-read-collaborative",
  "user-library-read",
].join(" ");

export const spotifyConfig = {
  clientId: () => clean(process.env.SPOTIFY_CLIENT_ID),
  clientSecret: () => clean(process.env.SPOTIFY_CLIENT_SECRET),
  redirectUri: () => clean(process.env.SPOTIFY_REDIRECT_URI),
  configured: () => !!(clean(process.env.SPOTIFY_CLIENT_ID) && clean(process.env.SPOTIFY_CLIENT_SECRET) && clean(process.env.SPOTIFY_REDIRECT_URI)),
};

export class SpotifyApiError extends Error {
  constructor(
    readonly code: "NOT_CONFIGURED" | "AUTH_EXPIRED" | "PREMIUM_REQUIRED" | "NO_DEVICE" | "RATE_LIMITED" | "ACCESS_DENIED" | "SCOPE_REQUIRED" | "UNKNOWN",
    message: string,
    readonly status = 400,
    readonly retryAfter?: number,
  ) {
    super(message);
  }
}

export function authorizeUrl(state: string): string {
  const p = new URLSearchParams({
    client_id: spotifyConfig.clientId(),
    response_type: "code",
    redirect_uri: spotifyConfig.redirectUri(),
    scope: SPOTIFY_SCOPES,
    state,
    show_dialog: "true",
  });
  return `https://accounts.spotify.com/authorize?${p}`;
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  error?: string;
  error_description?: string;
}

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const basic = Buffer.from(`${spotifyConfig.clientId()}:${spotifyConfig.clientSecret()}`).toString("base64");
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
    signal: AbortSignal.timeout(10000),
  });
  const data = (await res.json()) as TokenResponse;
  if (!res.ok) {
    if (data.error === "invalid_grant") throw new SpotifyApiError("AUTH_EXPIRED", "Connexion Spotify expirée", 401);
    throw new SpotifyApiError("UNKNOWN", data.error_description ?? data.error ?? `HTTP ${res.status}`, 502);
  }
  return data;
}

export function exchangeCode(code: string) {
  return tokenRequest({ grant_type: "authorization_code", code, redirect_uri: spotifyConfig.redirectUri() });
}

// Access tokens cached per serverless instance (they last 1 h)
const cache = new Map<string, { token: string; exp: number }>();

/** Returns a valid access token, and a rotated refresh token when Spotify issues one. */
export async function accessToken(uid: string, refreshToken: string): Promise<{ token: string; rotated?: string }> {
  const key = `${uid}:${refreshToken.slice(-12)}`;
  const hit = cache.get(key);
  if (hit && hit.exp > Date.now() + 60_000) return { token: hit.token };
  const t = await tokenRequest({ grant_type: "refresh_token", refresh_token: refreshToken });
  cache.set(t.refresh_token ? `${uid}:${t.refresh_token.slice(-12)}` : key, { token: t.access_token, exp: Date.now() + t.expires_in * 1000 });
  return { token: t.access_token, rotated: t.refresh_token && t.refresh_token !== refreshToken ? t.refresh_token : undefined };
}

export async function spotifyFetch<T>(token: string, method: string, path: string, body?: unknown): Promise<T | null> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body !== undefined ? { "Content-Type": "application/json" } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(10000),
    cache: "no-store",
  });
  if (res.status === 204 || res.status === 202) return null;
  const text = await res.text();
  let json: Record<string, unknown> | null = null;
  try { json = text ? JSON.parse(text) as Record<string, unknown> : null; } catch { /* Some Spotify errors return plain text. */ }
  if (res.ok) return json as T;

  const rawError = json?.error;
  const err = (rawError && typeof rawError === "object" ? rawError : {}) as { message?: string; reason?: string };
  const detail = typeof err.message === "string" ? err.message
    : typeof rawError === "string" ? rawError
    : typeof json === "string" ? json
    : !json && !/^\s*</.test(text) ? text.trim() : "";
  // Spotify can return plain text (notably account-access refusals). Never echo credentials.
  const safeDetail = detail.split(token).join("[redacted]").slice(0, 400);
  const accountDenied = /not registered|not authorized|not authorised|developer dashboard|user.*not.*(allow|register)/i.test(safeDetail);
  // Log only public application metadata and status; never tokens, headers or user data.
  console.warn("[spotify:upstream]", JSON.stringify({
    method, endpoint: path.split("?")[0], status: res.status,
    reason: typeof err.reason === "string" ? err.reason.slice(0, 80) : null,
    accountDenied,
    responseFormat: json ? "json" : text.trim() ? "text" : "empty",
    insufficientScope: /insufficient.*scope/i.test(`${safeDetail} ${res.headers.get("www-authenticate") ?? ""}`),
    clientId: spotifyConfig.clientId(),
  }));
  if (res.status === 401) throw new SpotifyApiError("AUTH_EXPIRED", err.message ?? "Token expiré", 401);
  if (res.status === 429) {
    const seconds = Number(res.headers.get("Retry-After"));
    throw new SpotifyApiError("RATE_LIMITED", "Trop de demandes", 429, Number.isFinite(seconds) && seconds > 0 ? seconds : 30);
  }
  if (res.status === 403 && (err.reason === "PREMIUM_REQUIRED" || /premium/i.test(safeDetail))) {
    throw new SpotifyApiError("PREMIUM_REQUIRED", "Spotify Premium requis", 403);
  }
  if (res.status === 403) {
    const scope = /insufficient.*scope/i.test(`${safeDetail} ${res.headers.get("www-authenticate") ?? ""}`);
    throw new SpotifyApiError(scope ? "SCOPE_REQUIRED" : "ACCESS_DENIED", scope
      ? "Spotify refuse les permissions : reconnectez Spotify pour les accorder."
      : `Spotify refuse l’accès (403, ${path.split("?")[0]}).${safeDetail ? ` ${safeDetail}` : ""}`, 403);
  }
  if (res.status === 404 && (err.reason === "NO_ACTIVE_DEVICE" || /device/i.test(err.message ?? ""))) {
    throw new SpotifyApiError("NO_DEVICE", "Aucun appareil actif", 404);
  }
  throw new SpotifyApiError("UNKNOWN", err.message ?? `Spotify HTTP ${res.status}`, 502);
}

// ------------------------------------------------------------------ mapping

interface SImage {
  url: string;
  width?: number;
}
interface SObject {
  uri: string;
  type: string;
  name: string;
  images?: SImage[];
  album?: { name: string; images?: SImage[] };
  artists?: { name: string }[];
  owner?: { display_name?: string };
  show?: { name: string; images?: SImage[] };
  duration_ms?: number;
}

const pickImage = (imgs?: SImage[]) => (imgs?.length ? [...imgs].sort((a, b) => (a.width ?? 0) - (b.width ?? 0)).find((i) => (i.width ?? 300) >= 200)?.url ?? imgs[0].url : undefined);

export function toItem(o: SObject | null | undefined): MusicItem | null {
  if (!o?.uri) return null;
  const type = o.type as MusicItemType;
  const subtitle =
    type === "track"
      ? o.artists?.map((a) => a.name).join(", ")
      : type === "playlist"
        ? o.owner?.display_name
        : type === "album"
          ? o.artists?.map((a) => a.name).join(", ")
          : type === "episode"
            ? o.show?.name
            : undefined;
  return { uri: o.uri, type, name: o.name, subtitle, image: pickImage(o.images ?? o.album?.images ?? o.show?.images) };
}

interface SDevice {
  id: string;
  name: string;
  type: string;
  is_active: boolean;
  volume_percent: number | null;
  supports_volume?: boolean;
}

const toDevice = (d: SDevice | null | undefined): MusicDevice | null =>
  d ? { id: d.id, name: d.name, type: d.type, isActive: d.is_active, volume: d.volume_percent, supportsVolume: d.supports_volume ?? true } : null;

// ------------------------------------------------------------------ operations

export async function runOp(token: string, op: MusicOp, args: Record<string, unknown> = {}): Promise<unknown> {
  const deviceQ = typeof args.deviceId === "string" && args.deviceId ? `?device_id=${encodeURIComponent(args.deviceId)}` : "";
  switch (op) {
    case "profile": {
      const me = await spotifyFetch<{ id: string; display_name?: string; product?: string }>(token, "GET", "/me");
      return { id: me!.id, name: me!.display_name ?? me!.id, product: me!.product ?? "unknown" } satisfies MusicProfile;
    }
    case "playback": {
      const p = await spotifyFetch<{
        is_playing: boolean;
        progress_ms: number | null;
        item: SObject | null;
        device: SDevice | null;
        shuffle_state: boolean;
      }>(token, "GET", "/me/player?additional_types=episode");
      if (!p) return null;
      return {
        isPlaying: p.is_playing,
        item: toItem(p.item),
        album: p.item?.album?.name,
        progressMs: p.progress_ms ?? 0,
        durationMs: p.item?.duration_ms ?? 0,
        device: toDevice(p.device),
        shuffle: p.shuffle_state,
        fetchedAt: Date.now(),
      } satisfies PlaybackState;
    }
    case "devices": {
      const d = await spotifyFetch<{ devices: SDevice[] }>(token, "GET", "/me/player/devices");
      return (d?.devices ?? []).map(toDevice);
    }
    case "play":
      await spotifyFetch(token, "PUT", `/me/player/play${deviceQ}`);
      return null;
    case "pause":
      await spotifyFetch(token, "PUT", "/me/player/pause");
      return null;
    case "next":
      await spotifyFetch(token, "POST", "/me/player/next");
      return null;
    case "previous":
      await spotifyFetch(token, "POST", "/me/player/previous");
      return null;
    case "volume": {
      const v = Math.max(0, Math.min(100, Math.round(Number(args.volume))));
      await spotifyFetch(token, "PUT", `/me/player/volume?volume_percent=${v}`);
      return null;
    }
    case "transfer":
      await spotifyFetch(token, "PUT", "/me/player", { device_ids: [String(args.deviceId)], play: args.play !== false });
      return null;
    case "playUri": {
      const uri = String(args.uri ?? "");
      if (!/^spotify:(track|playlist|album|artist|episode|show):[A-Za-z0-9]+$/.test(uri) && !/^spotify:user:[^:]+:collection$/.test(uri)) {
        throw new SpotifyApiError("UNKNOWN", "URI Spotify invalide", 400);
      }
      const body = uri.includes(":track:") || uri.includes(":episode:") ? { uris: [uri] } : { context_uri: uri };
      await spotifyFetch(token, "PUT", `/me/player/play${deviceQ}`, body);
      return null;
    }
    case "search": {
      const q = String(args.query ?? "").slice(0, 100);
      const allowed = ["track", "playlist", "album", "artist"];
      const types = (Array.isArray(args.types) ? args.types : ["track", "playlist", "album", "artist"]).filter((t) => allowed.includes(String(t)));
      const r = await spotifyFetch<Record<string, { items: (SObject | null)[] }>>(
        token,
        "GET",
        `/search?${new URLSearchParams({ q, type: types.join(","), limit: "6", market: "from_token" })}`,
      );
      const out: MusicItem[] = [];
      for (const t of types) for (const it of r?.[`${t}s`]?.items ?? []) {
        const m = toItem(it);
        if (m) out.push(m);
      }
      return out;
    }
    case "playlists": {
      const r = await spotifyFetch<{ items: SObject[] }>(token, "GET", "/me/playlists?limit=50");
      return (r?.items ?? []).map(toItem).filter(Boolean);
    }
    case "recent": {
      const r = await spotifyFetch<{ items: { track: SObject; context: { uri: string; type: string } | null }[] }>(
        token,
        "GET",
        "/me/player/recently-played?limit=20",
      );
      const seen = new Set<string>();
      const out: MusicItem[] = [];
      for (const it of r?.items ?? []) {
        const m = toItem(it.track);
        if (m && !seen.has(m.uri)) {
          seen.add(m.uri);
          out.push(m);
        }
      }
      return out.slice(0, 10);
    }
  }
}
