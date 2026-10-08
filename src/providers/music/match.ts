import type { MusicItem } from "./MusicProvider";

export function normalizeMusicQuery(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\b(ma|mon|mes|la|le|les|une|un|des|du|de|playlist|liste de lecture|musique|morceau|chanson|album)\b/g, " ")
    .replace(/[^\p{L}\p{N} ]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Match a spoken name ("ma playlist chill") against the user's playlists.
 * Returns a single item when unambiguous, otherwise the candidates (to ask the user).
 */
export function findBestMatch(query: string, items: MusicItem[]): { item?: MusicItem; candidates: MusicItem[] } {
  const q = normalizeMusicQuery(query);
  if (!q) return { candidates: [] };
  const scored = items
    .map((it) => {
      const n = normalizeMusicQuery(it.name);
      let score = 0;
      if (n === q) score = 100;
      else if (n.startsWith(q) || q.startsWith(n)) score = 80;
      else if (n.includes(q)) score = 60;
      else {
        const words = q.split(" ");
        const hit = words.filter((w) => w.length > 1 && n.includes(w)).length;
        score = hit ? (hit / words.length) * 50 : 0;
      }
      return { it, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  if (!scored.length) return { candidates: [] };
  const top = scored[0];
  const close = scored.filter((s) => s.score >= top.score - 5);
  if (top.score === 100 || close.length === 1) return { item: top.it, candidates: [top.it] };
  return { candidates: close.slice(0, 4).map((s) => s.it) };
}
