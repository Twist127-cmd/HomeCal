/**
 * Local log of the sentences the deterministic router could NOT handle (sent to the LLM, or
 * refused when the LLM is offline). Debug mode only (`localStorage["homecal.debug"] = "1"`
 * or NEXT_PUBLIC_ASSISTANT_DEBUG=true). Stays in this browser — never sent anywhere; used to
 * grow `tests/everyday.corpus.ts` from real usage.
 */

export interface RouterMiss {
  input: string;
  at: string;
  /** router's best guess, if any */
  intent?: string;
  confidence?: number;
  domainHint?: string;
  /** "llm" = sent to the model, "offline" = no model available */
  via: "llm" | "offline";
}

const KEY = "homecal.routerMisses";
const MAX = 300;

export function assistantDebugEnabled(): boolean {
  if (process.env.NEXT_PUBLIC_ASSISTANT_DEBUG === "true") return true;
  try {
    return typeof localStorage !== "undefined" && localStorage.getItem("homecal.debug") === "1";
  } catch {
    return false;
  }
}

export function listMisses(): RouterMiss[] {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(KEY) : null;
    const v = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(v) ? (v as RouterMiss[]) : [];
  } catch {
    return [];
  }
}

export function recordMiss(miss: Omit<RouterMiss, "at">, now = new Date()) {
  if (!assistantDebugEnabled()) return;
  try {
    const list = listMisses().filter((m) => m.input.toLowerCase() !== miss.input.toLowerCase());
    list.push({ ...miss, at: now.toISOString() });
    localStorage.setItem(KEY, JSON.stringify(list.slice(-MAX)));
  } catch {
    /* storage full / blocked: ignore */
  }
}

export function clearMisses() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/** Misses grouped by the router's domain guess, ready to paste into tests/everyday.corpus.ts. */
export function missesAsCorpus(list = listMisses()): string {
  const groups = new Map<string, string[]>();
  for (const m of list) {
    const k = m.domainHint ?? "unknown";
    groups.set(k, [...(groups.get(k) ?? []), m.input]);
  }
  const body = [...groups].map(([k, v]) => `  ${/^\w+$/.test(k) ? k : JSON.stringify(k)}: [\n${v.map((s) => `    ${JSON.stringify(s)},`).join("\n")}\n  ],`).join("\n");
  return `// ${list.length} phrases envoyées au LLM (${new Date().toISOString().slice(0, 10)})\n{\n${body}\n}\n`;
}
