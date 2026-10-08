import { NextResponse, type NextRequest } from "next/server";
import { AuthError, requireUser } from "@/lib/server/firebaseAuth";
import { authorizeUrl, spotifyConfig } from "@/lib/server/spotify";
import { signState, vaultConfigured } from "@/lib/server/tokenVault";

/** Returns the Spotify consent URL for the signed-in HomeCal user. */
export async function POST(req: NextRequest) {
  if (!spotifyConfig.configured() || !vaultConfigured()) {
    // names only (never values) to help diagnose the configuration
    const missing = [
      !spotifyConfig.clientId() && "SPOTIFY_CLIENT_ID",
      !spotifyConfig.clientSecret() && "SPOTIFY_CLIENT_SECRET",
      !spotifyConfig.redirectUri() && "SPOTIFY_REDIRECT_URI",
      !vaultConfigured() && "HOMECAL_TOKEN_KEY",
    ].filter(Boolean);
    return NextResponse.json({ error: "NOT_CONFIGURED", missing }, { status: 503 });
  }
  try {
    const user = await requireUser(req.headers.get("authorization"));
    return NextResponse.json({ url: authorizeUrl(await signState(user.uid, "spotify")) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: e instanceof AuthError ? e.status : 500 });
  }
}
