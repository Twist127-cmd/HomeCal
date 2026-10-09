/**
 * Short in-memory session shared by every entry point (assistant panel AND hands-free voice):
 * what the assistant said last ("répète") and how to undo the last command
 * ("annule ce que tu viens de faire"). Per tab, never persisted.
 */

type Undo = () => Promise<void>;

const MAX_AGE_MS = 10 * 60_000;

let lastAnswer: { text: string; at: number } | null = null;
let lastUndo: { fns: Undo[]; at: number } | null = null;

export const assistantSession = {
  lastAnswer(now = Date.now()): string | undefined {
    return lastAnswer && now - lastAnswer.at < MAX_AGE_MS ? lastAnswer.text : undefined;
  },
  setLastAnswer(text: string, now = Date.now()) {
    if (text.trim()) lastAnswer = { text, at: now };
  },
  setLastUndo(fns: Undo[], now = Date.now()) {
    lastUndo = fns.length ? { fns, at: now } : null;
  },
  /** Run the undo of the previous command (most recent first). Returns how many actions were undone. */
  async undoLast(now = Date.now()): Promise<number> {
    const u = lastUndo;
    lastUndo = null;
    if (!u || now - u.at > MAX_AGE_MS) return 0;
    let n = 0;
    for (const fn of [...u.fns].reverse()) {
      try {
        await fn();
        n++;
      } catch {
        /* best effort */
      }
    }
    return n;
  },
  reset() {
    lastAnswer = null;
    lastUndo = null;
  },
};
