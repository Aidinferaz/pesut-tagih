/**
 * Matching what people type ("budi", "Trip derawan") to the names in a group.
 * Exact beats prefix beats substring; anything ambiguous comes back as
 * candidates so the caller can ask instead of guessing.
 */
export type NameMatch<T> = { found: T } | { found: null; candidates: T[] };

const normal = (s: string) =>
  s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

export function matchName<T>(
  items: readonly T[],
  query: string,
  nameOf: (item: T) => string,
): NameMatch<T> {
  const q = normal(query);
  if (!q) return { found: null, candidates: [...items] };
  for (const test of [
    (n: string) => n === q,
    (n: string) => n.startsWith(q),
    (n: string) => n.includes(q),
  ]) {
    const hits = items.filter((item) => test(normal(nameOf(item))));
    if (hits.length === 1) return { found: hits[0] };
    if (hits.length > 1) return { found: null, candidates: hits };
  }
  return { found: null, candidates: [] };
}
