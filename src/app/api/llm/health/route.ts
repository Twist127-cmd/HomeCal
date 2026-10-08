import { NextResponse, type NextRequest } from "next/server";
import { AccessError, assertLLMAccess, ollamaTarget } from "@/lib/server/llmAccess";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const target = ollamaTarget();

  // ?probe=1 : network diagnostic without credentials (expects 401 from the relay)
  if (target.remote && req.nextUrl.searchParams.get("probe") === "1") {
    const t0 = Date.now();
    try {
      const r = await fetch(`${target.base}/health`, { signal: AbortSignal.timeout(15000), cache: "no-store" });
      // same request with the server's key: tells whether the relay accepts it (never returns the key)
      const k = await fetch(`${target.base}/health`, { headers: target.headers, signal: AbortSignal.timeout(15000), cache: "no-store" }).catch(() => null);
      return NextResponse.json({ reachable: r.status === 401 || r.ok, keyAccepted: k ? k.ok : null, status: r.status, ms: Date.now() - t0 });
    } catch (e) {
      const err = e as Error & { cause?: { code?: string; message?: string } };
      console.error("[llm probe]", err.message, err.cause);
      return NextResponse.json({ reachable: false, ms: Date.now() - t0, error: err.message, cause: err.cause?.code ?? err.cause?.message });
    }
  }

  if (target.remote) {
    try {
      await assertLLMAccess(req.headers.get("authorization"));
    } catch (e) {
      const status = e instanceof AccessError ? e.status : 401;
      return NextResponse.json({ ok: false, via: "proxy", error: (e as Error).message }, { status });
    }
  }
  try {
    const res = await fetch(`${target.base}/api/tags`, { headers: target.headers, signal: AbortSignal.timeout(5000), cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { models?: { name: string }[] };
    return NextResponse.json({ ok: true, via: "proxy", remote: target.remote, models: (data.models ?? []).map((m) => m.name) });
  } catch (e) {
    console.error("[llm health]", (e as Error).message, (e as Error & { cause?: unknown }).cause);
    const msg = target.remote ? `Le PC Ollama est éteint ou injoignable (${(e as Error).message})` : (e as Error).message;
    return NextResponse.json({ ok: false, via: "proxy", error: msg }, { status: 503 });
  }
}
