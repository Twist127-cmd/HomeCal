import { NextResponse, type NextRequest } from "next/server";
import { AccessError, assertLLMAccess, ollamaTarget } from "@/lib/server/llmAccess";

/**
 * LLM proxy.
 *  - Production: forwards to the Ollama "reference PC" through the Tailscale tunnel
 *    (OLLAMA_TUNNEL_URL + OLLAMA_TUNNEL_TOKEN), for signed-in household members only.
 *  - Development: forwards to OLLAMA_BASE_URL (local Ollama).
 */
export const maxDuration = 180;

export async function POST(req: NextRequest) {
  const target = ollamaTarget();
  if (target.remote) {
    try {
      await assertLLMAccess(req.headers.get("authorization"));
    } catch (e) {
      const status = e instanceof AccessError ? e.status : 401;
      return NextResponse.json({ error: (e as Error).message }, { status });
    }
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }
  body.model ||= process.env.OLLAMA_MODEL?.trim() || "qwen3:4b-instruct";
  body.stream = false;
  try {
    const res = await fetch(`${target.base}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...target.headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(175_000),
    });
    const text = await res.text();
    return new NextResponse(text, { status: res.status, headers: { "Content-Type": "application/json" } });
  } catch (e) {
    const where = target.remote ? "le PC Ollama (tunnel)" : target.base;
    return NextResponse.json({ error: `Ollama injoignable via ${where} : ${(e as Error).message}` }, { status: 503 });
  }
}
