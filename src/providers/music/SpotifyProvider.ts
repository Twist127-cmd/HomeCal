import { features } from "@/lib/features";
import {
  MusicError,
  type MusicDevice,
  type MusicErrorCode,
  type MusicItem,
  type MusicItemType,
  type MusicOp,
  type MusicProfile,
  type MusicProvider,
  type PlaybackState,
} from "./MusicProvider";

export interface SpotifyProviderOptions {
  /** Firebase ID token of the current user */
  getIdToken(): Promise<string | null | undefined>;
  /** Encrypted refresh token stored in the user's Firestore doc (null = not connected) */
  getCipher(): string | null | undefined;
  /** Spotify rotated the refresh token: persist the new encrypted blob */
  onCipherRotated(cipher: string): void;
  /** Remove the connection from the user's doc */
  onDisconnect(): Promise<void>;
  fetchImpl?: typeof fetch;
}

/**
 * Spotify Connect remote control. All calls go through /api/spotify (server holds the
 * client secret and decrypts the refresh token). Playback happens on the user's
 * Spotify devices (phone, computer, speaker…), HomeCal pilots them.
 */
export class SpotifyProvider implements MusicProvider {
  readonly id = "spotify" as const;
  readonly label = "Spotify";

  constructor(private readonly opts: SpotifyProviderOptions) {}

  isConnected(): boolean {
    return features.spotify && !!this.opts.getCipher();
  }

  private async call<T>(op: MusicOp, args?: Record<string, unknown>): Promise<T> {
    if (!features.spotify) throw new MusicError("NOT_CONFIGURED");
    const cipher = this.opts.getCipher();
    if (!cipher) throw new MusicError("NOT_CONNECTED");
    if (typeof navigator !== "undefined" && navigator.onLine === false) throw new MusicError("OFFLINE");
    const idToken = await this.opts.getIdToken();
    if (!idToken) throw new MusicError("NOT_CONNECTED", "Connexion HomeCal requise");
    let res: Response;
    try {
      res = await (this.opts.fetchImpl ?? fetch)("/api/spotify", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ cipher, op, args }),
      });
    } catch {
      throw new MusicError("OFFLINE");
    }
    const json = (await res.json().catch(() => ({}))) as { data?: T; cipher?: string; code?: MusicErrorCode | "UNAUTHORIZED"; error?: string };
    if (json.cipher) this.opts.onCipherRotated(json.cipher);
    if (!res.ok) {
      const code = json.code === "UNAUTHORIZED" ? "NOT_CONNECTED" : (json.code ?? "UNKNOWN");
      throw new MusicError(code as MusicErrorCode);
    }
    return json.data as T;
  }

  async connect(): Promise<void> {
    if (!features.spotify) throw new MusicError("NOT_CONFIGURED");
    const idToken = await this.opts.getIdToken();
    const res = await (this.opts.fetchImpl ?? fetch)("/api/spotify/authorize", {
      method: "POST",
      headers: { Authorization: `Bearer ${idToken}` },
    });
    const json = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
    if (!res.ok || !json.url) throw new MusicError(json.error === "NOT_CONFIGURED" ? "NOT_CONFIGURED" : "UNKNOWN", json.error);
    window.location.assign(json.url);
  }

  async disconnect(): Promise<void> {
    await this.opts.onDisconnect();
  }

  getProfile() {
    return this.call<MusicProfile>("profile");
  }
  getCurrentPlayback() {
    return this.call<PlaybackState | null>("playback");
  }
  async play() {
    await this.call("play");
  }
  async pause() {
    await this.call("pause");
  }
  async next() {
    await this.call("next");
  }
  async previous() {
    await this.call("previous");
  }
  async setVolume(volume: number) {
    await this.call("volume", { volume });
  }
  getDevices() {
    return this.call<MusicDevice[]>("devices");
  }
  async transferPlayback(deviceId: string, play = true) {
    await this.call("transfer", { deviceId, play });
  }
  async playUri(uri: string, deviceId?: string) {
    await this.call("playUri", { uri, deviceId });
  }
  search(query: string, types?: MusicItemType[]) {
    return this.call<MusicItem[]>("search", { query, types });
  }
  getPlaylists() {
    return this.call<MusicItem[]>("playlists");
  }
  getRecent() {
    return this.call<MusicItem[]>("recent");
  }

  openUrl(item?: MusicItem | null) {
    if (!item) return { app: "spotify:", web: "https://open.spotify.com/" };
    const m = /^spotify:(track|playlist|album|artist|episode|show):(\w+)$/.exec(item.uri);
    if (m) return { app: item.uri, web: `https://open.spotify.com/${m[1]}/${m[2]}` };
    return { app: "spotify:", web: "https://open.spotify.com/collection/tracks" };
  }
}
