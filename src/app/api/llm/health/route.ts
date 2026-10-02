import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const base = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
  try {
    const res = await fetch(`${base}/api/tags`, { signal: AbortSignal.timeout(3000), cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { models?: { name: string }[] };
    return NextResponse.json({ ok: true, via: "proxy", models: (data.models ?? []).map((m) => m.name) });
  } catch (e) {
    return NextResponse.json({ ok: false, via: "proxy", error: (e as Error).message }, { status: 503 });
  }
}
