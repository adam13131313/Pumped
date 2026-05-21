// Display helpers for URLs. Used by chips (notes-area) and cards
// (Documents section) so multiple links to the same host don't all
// collapse to the same label.

export function hostnameFor(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/**
 * Render a URL as `host/path` truncated to a sensible width. Keeps enough
 * of the path to distinguish two URLs on the same host (e.g. two Google
 * Docs) while staying short enough to fit in a chip.
 */
export function shortUrl(url: string, maxLen = 60): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url.length > maxLen ? url.slice(0, maxLen - 1) + "…" : url;
  }
  const host = parsed.hostname.replace(/^www\./, "");
  const path = parsed.pathname.replace(/\/$/, "");
  if (!path || path === "/") return host;
  const combined = `${host}${path}`;
  if (combined.length <= maxLen) return combined;
  return combined.slice(0, maxLen - 1) + "…";
}
