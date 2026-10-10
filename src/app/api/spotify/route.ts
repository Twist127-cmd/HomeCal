import { NextResponse, type NextRequest } from "next/server";
import { AuthError, requireUser } from "@/lib/server/firebaseAuth";
import { accessToken, runOp, spotifyConfig, SpotifyApiError } from "@/lib/server/spotify";
import { seal, unseal, vaultConfigured } from "@/lib/server/tokenVault";
import type { MusicOp } from "@/providers/music/MusicProvider";

/**
 * Spotify proxy. Body: { cipher, op, args }.
 *  - the Firebase user is verified,
 *  - the encrypted refresh token must belong to that user,
 *  - only whitelisted operations are allowed.
 * Response: { data, cipher? } — `cipher` is returned when Spotify rotated the refresh token.
 */

const OPS: MusicOp[] = ["profile", "playback", "devices", "play", "pause", "next", "previous", "volume", "transfer", "playUri", "search", "playlists", "recent"];

export async function POST(req: NextRequest) {
  if (!spotifyConfig.configured() || !vaultConfigured()) return NextResponse.json({ code: "NOT_CONFIGURED" }, { status: 503 });

  let user;
  try {
    user = await requireUser(req.headers.get("authorization"));
  } catch (e) {
    return NextResponse.json({ code: "UNAUTHORIZED", error: (e as Error).message }, { status: e instanceof AuthError ? e.status : 401 });
  }

  let body: { cipher?: string; op?: MusicOp; args?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ code: "BAD_REQUEST" }, { status: 400 });
  }
  if (!body.op || !OPS.includes(body.op)) return NextResponse.json({ code: "BAD_REQUEST", error: "opération inconnue" }, { status: 400 });
  if (!body.cipher) return NextResponse.json({ code: "NOT_CONNECTED" }, { status: 401 });

  try {
    const sealed = await unseal(body.cipher, { uid: user.uid, provider: "spotify" }).catch(() => {
      throw new SpotifyApiError("AUTH_EXPIRED", "Jeton Spotify illisible", 401);
    });
    const { token, rotated } = await accessToken(user.uid, sealed.refreshToken);
    const data = await runOp(token, body.op, body.args ?? {});
    const cipher = rotated ? await seal({ uid: user.uid, provider: "spotify", refreshToken: rotated }) : undefined;
    return NextResponse.json({ data, cipher });
  } catch (e) {
    if (e instanceof SpotifyApiError) return NextResponse.json({ code: e.code, error: e.message }, {
      status: e.status,
      headers: e.retryAfter ? { "Retry-After": String(e.retryAfter) } : undefined,
    });
    console.error("[spotify]", body.op, e);
    return NextResponse.json({ code: "UNKNOWN", error: (e as Error).message }, { status: 502 });
  }
}
