// Lightweight fuzzy text similarity for duplicate detection.
// No deps, no AI calls — token Jaccard with stopword + punctuation stripping.

const STOPWORDS = new Set([
  "a","an","the","to","for","of","on","in","at","by","with","and","or","but",
  "is","are","be","do","my","i","we","you","it","this","that","need","needs",
  "should","please","plz","re","about","get","got","make","made","have","has",
]);

export function normalize(text: string): string[] {
  return (text || "")
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOPWORDS.has(w));
}

export function similarity(a: string, b: string): number {
  const ta = new Set(normalize(a));
  const tb = new Set(normalize(b));
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  ta.forEach((t) => { if (tb.has(t)) inter++; });
  const union = ta.size + tb.size - inter;
  return union === 0 ? 0 : inter / union;
}

export interface DuplicateMatch<T> {
  item: T;
  score: number;
}

export function findSimilar<T>(
  query: string,
  items: T[],
  getText: (item: T) => string,
  threshold = 0.45,
  limit = 3,
): DuplicateMatch<T>[] {
  if (!query || query.trim().length < 3) return [];
  return items
    .map((item) => ({ item, score: similarity(query, getText(item)) }))
    .filter((m) => m.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
