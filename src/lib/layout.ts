/** Column layout for overlapping timed events in a day column. */
export interface LayoutItem<T> {
  item: T;
  start: number; // ms
  end: number; // ms
  col: number;
  cols: number;
}

export function layoutDay<T>(items: { item: T; start: number; end: number }[]): LayoutItem<T>[] {
  const sorted = [...items].sort((a, b) => a.start - b.start || b.end - a.end);
  const out: LayoutItem<T>[] = [];
  let cluster: LayoutItem<T>[] = [];
  let clusterEnd = -Infinity;

  const flush = () => {
    const cols = Math.max(1, ...cluster.map((c) => c.col + 1));
    cluster.forEach((c) => (c.cols = cols));
    out.push(...cluster);
    cluster = [];
  };

  for (const it of sorted) {
    // minimum visual height: 20 minutes
    const end = Math.max(it.end, it.start + 20 * 60000);
    if (it.start >= clusterEnd && cluster.length) flush();
    const used = new Set(cluster.filter((c) => c.end > it.start).map((c) => c.col));
    let col = 0;
    while (used.has(col)) col++;
    cluster.push({ ...it, end, col, cols: 1 });
    clusterEnd = Math.max(clusterEnd === -Infinity ? end : clusterEnd, end);
  }
  if (cluster.length) flush();
  return out;
}
