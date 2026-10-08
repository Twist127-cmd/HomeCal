/**
 * Generic music provider. V1.5: Spotify (Spotify Connect remote control).
 * Deezer / Apple Music / YouTube Music can implement the same interface later
 * without touching the UI.
 */

export type MusicItemType = "track" | "playlist" | "album" | "artist" | "episode" | "show";

export interface MusicItem {
  uri: string;
  type: MusicItemType;
  name: string;
  subtitle?: string;
  image?: string;
}

export interface MusicDevice {
  id: string;
  name: string;
  type: string; // Computer, Smartphone, Speaker, TV…
  isActive: boolean;
  volume: number | null;
  supportsVolume: boolean;
}

export interface PlaybackState {
  isPlaying: boolean;
  item: MusicItem | null;
  album?: string;
  progressMs: number;
  durationMs: number;
  device: MusicDevice | null;
  shuffle: boolean;
  /** When this state was fetched (ms epoch) — used to extrapolate progress */
  fetchedAt: number;
}

export interface MusicProfile {
  id: string;
  name: string;
  product: string; // "premium" | "free" | …
}

export type MusicErrorCode =
  | "NOT_CONFIGURED"
  | "NOT_CONNECTED"
  | "AUTH_EXPIRED"
  | "PREMIUM_REQUIRED"
  | "NO_DEVICE"
  | "RATE_LIMITED"
  | "OFFLINE"
  | "UNKNOWN";

export class MusicError extends Error {
  constructor(
    readonly code: MusicErrorCode,
    message?: string,
  ) {
    super(message ?? MUSIC_ERROR_TEXT[code]);
    this.name = "MusicError";
  }
}

export const MUSIC_ERROR_TEXT: Record<MusicErrorCode, string> = {
  NOT_CONFIGURED: "Spotify n'est pas encore configuré sur HomeCal.",
  NOT_CONNECTED: "Connectez votre compte Spotify dans Musique.",
  AUTH_EXPIRED: "La connexion Spotify a expiré, reconnectez-vous.",
  PREMIUM_REQUIRED: "Spotify Premium est nécessaire pour contrôler la lecture.",
  NO_DEVICE: "Aucun appareil Spotify actif : ouvrez Spotify sur un téléphone, un ordinateur ou une enceinte.",
  RATE_LIMITED: "Spotify reçoit trop de demandes, réessayez dans un instant.",
  OFFLINE: "Connexion requise.",
  UNKNOWN: "Spotify ne répond pas.",
};

export interface MusicProvider {
  readonly id: "spotify";
  readonly label: string;
  isConnected(): boolean;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  getProfile(): Promise<MusicProfile>;
  getCurrentPlayback(): Promise<PlaybackState | null>;
  play(): Promise<void>;
  pause(): Promise<void>;
  next(): Promise<void>;
  previous(): Promise<void>;
  setVolume(volume: number): Promise<void>;
  getDevices(): Promise<MusicDevice[]>;
  transferPlayback(deviceId: string, play?: boolean): Promise<void>;
  /** Play a track/playlist/album/artist URI (on a device, else the active one) */
  playUri(uri: string, deviceId?: string): Promise<void>;
  search(query: string, types?: MusicItemType[]): Promise<MusicItem[]>;
  getPlaylists(): Promise<MusicItem[]>;
  getRecent(): Promise<MusicItem[]>;
  /** Native app / web player link for an item (or the app home) */
  openUrl(item?: MusicItem | null): { app: string; web: string };
}

/** Operations accepted by the server proxy (whitelist). */
export type MusicOp =
  | "profile"
  | "playback"
  | "devices"
  | "play"
  | "pause"
  | "next"
  | "previous"
  | "volume"
  | "transfer"
  | "playUri"
  | "search"
  | "playlists"
  | "recent";
