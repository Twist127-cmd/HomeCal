import { NextResponse, type NextRequest } from "next/server";
import { AccessError, assertLLMAccess, ollamaTarget } from "@/lib/server/llmAccess";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const target = ollamaTarget();
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
    const msg = target.remote ? `Le PC Ollama est éteint ou injoignable (${(e as Error).message})` : (e as Error).message;
    return NextResponse.json({ ok: false, via: "proxy", error: msg }, { status: 503 });
  }
}
