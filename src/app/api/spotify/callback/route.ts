import { NextResponse, type NextRequest } from "next/server";
import { exchangeCode, spotifyConfig } from "@/lib/server/spotify";
import { seal, verifyState } from "@/lib/server/tokenVault";

/**
 * OAuth redirect target. Exchanges the code, encrypts the refresh token and hands the
 * encrypted blob back to the app in the URL fragment (never sent to any server).
 * The app then stores it in the user's own Firestore document.
 */
export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const fail = (reason: string) => NextResponse.redirect(`${origin}/?spotify=error&reason=${encodeURIComponent(reason)}`);

  const error = req.nextUrl.searchParams.get("error");
  if (error) return fail(error === "access_denied" ? "refusé" : error);
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  if (!code || !state || !spotifyConfig.configured()) return fail("paramètres manquants");

  try {
    const uid = await verifyState(state, "spotify");
    const t = await exchangeCode(code);
    if (!t.refresh_token) return fail("jeton manquant");
    const cipher = await seal({ uid, provider: "spotify", refreshToken: t.refresh_token });
    const res = NextResponse.redirect(`${origin}/?spotify=connected#spotify=${encodeURIComponent(cipher)}`);
    res.headers.set("Cache-Control", "no-store");
    res.headers.set("Referrer-Policy", "no-referrer");
    return res;
  } catch (e) {
    return fail((e as Error).message);
  }
}
