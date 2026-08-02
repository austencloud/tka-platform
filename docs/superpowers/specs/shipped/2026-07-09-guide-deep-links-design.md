# Guide Page Deep Links — Design

**Date:** 2026-07-09 · **Status:** approved (Austen picked path-segment URLs + live sync)

## Goal

Every user (and Claude in chat) can link to a specific page inside the Level 1
guide reader: `https://tkaflowarts.com/learn/guide/<slug>` opens the reader
already parked on that page, and the address bar always shows the current
page's link as you read.

## Why this shape

- **Path segment** (`/learn/guide/staff-positions`) — reads like a book chapter
  link. Safe: the app-shell nav parser (`navigation-state.svelte.ts`) reads only
  path parts 0–1 (`learn` / `guide`); a third segment is ignored by routing and
  free for the reader to consume. The `[...appPath]` catch-all matches any depth.
- **Live sync** — `replaceState` (no history spam) keeps the URL on the active
  page as you scroll; copying the address bar IS the share affordance. Same
  philosophy as the sequence `?open=` URLSyncer ("share by simply copying the
  URL bar at any time").

## Slugs

- **Body pages:** the manifest id verbatim (`guide-manifest.ts` — stable,
  unique, kebab-case): `the-grid`, `staff-positions`, `hm-type1`,
  `bl-double-staff-36`, … New manifest entries get links automatically.
- **Front matter** (5 unnumbered pages before body page 1): fixed slugs
  `cover`, `drink-water`, `support`, `read-me`, `contents` (reader indexes 0–4).

## Components

1. **`_data/guide-page-links.ts`** (new, pure, unit-tested) — the slug↔reader-index
   map derived from `GUIDE_BODY_PAGES` + `FRONT_MATTER_COUNT`:
   - `slugForIndex(i): string | null`
   - `indexForSlug(slug): number | null` (unknown → null)
   - `hrefForIndex(i): string | null` → `/learn/guide/<slug>`
   - `slugFromPath(pathname): string | null` — third segment of
     `/learn/guide/<slug>` paths only (null elsewhere, so /print, /book, and the
     test harness never engage).

2. **GuideReader landing** — on init, `indexForSlug(slugFromPath(location.pathname))`.
   A valid deep link takes precedence over the saved sessionStorage offset and
   parks pre-paint through the existing `restoring` + `park()` machinery
   (element-measured target, retried via rAF while layout settles), so the
   reader reveals already on the page — no visible scroll.

3. **GuideReader live sync** — `$effect` on `activeIndex` (already tracked by
   the scroll handler): when not `restoring` and the path is under
   `/learn/guide`, debounced (200ms) `replaceState` to
   `/learn/guide/<slugForIndex(activeIndex)>` preserving search + hash.

4. **GuidePageNav rows become real `<a href>`** — right-click → Copy Link
   Address and middle-click → new tab work natively; left click is intercepted
   (preventDefault) and smooth-scrolls in-pane exactly as today.

## Out of scope

- /print + /book anchors (the reader is THE online guide).
- Numeric page aliases, level-2 guide (same seam will extend when it exists).

## Verification

- Unit: slug↔index round-trip for every manifest + front-matter page; unknown
  slug → null; `slugFromPath` ignores non-reader paths.
- DevTools: load `/learn/guide/negative-space` → reveals parked on that page;
  scroll to another page → address bar updates; nav row exposes href.
