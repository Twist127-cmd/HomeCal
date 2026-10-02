import { NextResponse, type NextRequest } from "next/server";

/**
 * Proxy to the local Ollama server (OLLAMA_BASE_URL). Works when HomeCal runs on the
 * same machine/network as Ollama (npm run dev / next start). On Vercel the browser
 * talks to Ollama directly instead (see OllamaProvider "direct" mode).
 */
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const base = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }
  body.model ||= process.env.OLLAMA_MODEL || "qwen3:4b-instruct";
  body.stream = false;
  try {
    const res = await fetch(`${base}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(115_000),
    });
    const text = await res.text();
    return new NextResponse(text, { status: res.status, headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return NextResponse.json({ error: `Ollama injoignable via ${base} : ${(e as Error).message}` }, { status: 503 });
  }
}
