/**
 * The three reader views and the hash that names each one. Pure, so the routing rules are tested without a browser.
 *
 *   #week            This week: what changed since the last visit or check-in
 *   #odds            Odds: every line in one table
 *   #book            The book: the scroll, from where the reader left it
 *   #line-<id>       Odds with that line's drawer open
 *
 * Older links keep working: #story-<id>, #chapter-<id>, #opening, #explore and the evidence sections open the book at that
 * anchor; #m-<id> opens the book at the line's page with its drawer; a bare #<line id> (the old "copy link") opens Odds with the drawer.
 */
export type View = "week" | "odds" | "book";
export const VIEWS: readonly View[] = ["week", "odds", "book"];
export const VIEW_LABEL: Record<View, string> = { week: "This week", odds: "Odds", book: "The book" };

export interface Route {
  view: View;
  /** A line whose drawer opens with the view. */
  line?: string;
  /** An element in the book to scroll to. */
  anchor?: string;
}

export function parseHash(hash: string, lineIds: ReadonlySet<string>, fallback: View): Route {
  const h = decodeURIComponent(hash.replace(/^#/, ""));
  if (!h) return { view: fallback };
  if (h === "week" || h === "odds" || h === "book") return { view: h };
  if (h.startsWith("line-") && lineIds.has(h.slice(5))) return { view: "odds", line: h.slice(5) };
  if (h.startsWith("m-") && lineIds.has(h.slice(2))) return { view: "book", anchor: `story-${h.slice(2)}`, line: h.slice(2) };
  if (lineIds.has(h)) return { view: "odds", line: h };
  return { view: "book", anchor: h };
}

/** The hash a route is shared as. */
export function hashFor(r: Route): string {
  if (r.line && r.view === "odds") return `#line-${r.line}`;
  if (r.view === "book" && r.anchor) return `#${r.anchor}`;
  return `#${r.view}`;
}

/** A first visit opens the book; a returning reader (one who has a stored edition) opens This week. */
export const defaultView = (lastSeen: string | null): View => (lastSeen ? "week" : "book");

const EDITION_KEY = "next100-edition";

/** The check-in date the reader last saw, or null on a first visit or when storage is unavailable. */
export function readEdition(): string | null {
  try { const v = localStorage.getItem(EDITION_KEY); return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null; } catch { return null; }
}

export function writeEdition(edition: string): void {
  try { localStorage.setItem(EDITION_KEY, edition); } catch { /* Storage can be disabled. */ }
}
