# Lightweight Shared Link Viewer

**Date:** 2026-03-18
**Status:** Approved (v3 — simplified after review)
**Problem:** When someone opens a shared sequence link (`/p/aBc123`), the root layout's auth gate blocks rendering until Firebase auth resolves. The viewer should render immediately.

---

## Solution

Use SvelteKit's `@` layout reset to escape the root layout for sequence viewer routes. This skips the auth gate, loading spinners, and app shell UI. The viewer page still uses the full DI container (container creation is fast JS — the slow part is the auth gate blocking render). Auth state resolves lazily — the viewer starts as "guest" and upgrades if the user is signed in.

Same pattern already used by `(public)/+layout@.svelte` in this codebase.

---

## Architecture

### Layout Reset

```
src/routes/
  +layout.svelte          ← root layout (Firebase, auth gate, app shell) — UNCHANGED
  +layout.ts              ← ssr = false — UNCHANGED
  sequence/
    +layout@.svelte       ← NEW: resets to bare layout, skips auth gate
    +layout.ts            ← NEW: ssr = false (root's setting no longer inherited)
    [id]/
      +page.svelte        ← MODIFIED: remove mobile redirect, add ?guest=1, start as guest
  p/
    +layout@.svelte       ← NEW: same reset
    +layout.ts            ← NEW: ssr = false
    [code]/
      +page.svelte        ← MODIFIED: remove mobile redirect, start as guest
  browse/                 ← UNCHANGED
  ...all other routes     ← UNCHANGED
```

**No existing routes move. No relative imports break. No DI changes.**

### The Viewer Layout Reset

```svelte
<!-- src/routes/sequence/+layout@.svelte -->
<script lang="ts">
  import type { Snippet } from "svelte";
  import "../../app.css";

  let { children } = $props<{ children: Snippet }>();
</script>

<svelte:head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width" />
</svelte:head>

{@render children()}
```

Identical to `(public)/+layout@.svelte`. Imports `app.css` for theme variables. No auth gate, no loading spinner, no app shell.

### What This Skips

The root `+layout.svelte` does (among other things):
- Firebase initialization and auth state resolution
- Auth gate UI (loading spinner while checking if signed in)
- PostHog analytics initialization
- i18n initialization
- MainApplication component (module nav, sidebar, keyboard shortcuts)
- Warning banners, email verification prompts

The `@` reset skips ALL of this. The viewer page initializes only what it needs.

### What the Viewer Page Does

1. **Import DI container** — `import { container } from "$lib/shared/di"`. This is module-level JS that creates service instances. Fast.
2. **Decode sequence from URL** — using `sequenceEncoder` from the container. Immediate.
3. **Render SequenceViewerOrchestrator** — with the decoded sequence. Immediate.
4. **Auth state resolves in background** — `authState` listener fires when Firebase auth completes. Footer updates from "Get App" to full controls if signed in.
5. **Background hash match** — `encoderHash` lookup for creator attribution. Progressive enhancement.

### Why Not a Mini-Container?

The `SequenceViewerOrchestrator` has 15+ hard dependencies on `container.items.*` via `import { container } from "$lib/shared/di"`. Importing that module triggers full container creation. A separate mini-container would require either:
- Changing the orchestrator's import (touches 15+ call sites)
- A mutable container reference system (fragile, global state)
- Passing container via Svelte context (major refactor)

None of these are worth the complexity. Container creation is fast (just JS object instantiation). The actual bottleneck is the root layout's auth gate blocking render — which the `@` reset already solves.

---

## Viewer UI Changes

### Guest-First Footer

The viewer starts in guest mode (auth not yet resolved). The footer shows:
- Play/pause + BPM control
- "Get App" button (green CTA)

Once auth resolves (if signed in), the footer upgrades to full controls (save, favorite, delete, etc.).

### `?guest=1` Debug Mode

Forces the guest view even when signed in:

```typescript
const forceGuest = $page.url.searchParams.get("guest") === "1";
const effectiveLoggedIn = forceGuest ? false : actualAuthState;
```

### "Get App" Destination

```typescript
// TODO: Once PWA is listed on Google Play Store via TWA, swap this
// to the Play Store URL for Android users. Chrome will show the store
// install banner automatically via assetlinks.json integration.
// For iOS, link to the App Store listing when available.
const GET_APP_URL = "/";
```

Tap "Get App" → `/` → sign-up → onboarding → create module.

---

## Mobile Behavior Change

**Before:** `/sequence/[id]` on mobile redirects to app shell drawer overlay (`goto("/browse/gallery")` + `openSequenceOverlay()`).

**After:** The mobile redirect is removed. The viewer renders full-screen on all viewports. The existing swipe-to-dismiss, mobile header, and responsive layout all work without the drawer.

The drawer overlay flow remains for in-app navigation (browse → viewer uses `openSequenceViewer()`, not the route).

---

## Files Changed

| File | Change |
|------|--------|
| **New:** `src/routes/sequence/+layout@.svelte` | Layout reset — bare layout with app.css |
| **New:** `src/routes/sequence/+layout.ts` | `export const ssr = false; export const prerender = false;` |
| **New:** `src/routes/p/+layout@.svelte` | Same layout reset |
| **New:** `src/routes/p/+layout.ts` | Same ssr/prerender settings |
| `src/routes/sequence/[id]/+page.svelte` | Remove mobile redirect, add `?guest=1`, start as guest |
| `src/routes/p/[code]/+page.svelte` | Remove mobile redirect, start as guest |

### Existing files UNCHANGED:
- `src/routes/+layout.svelte` — root layout stays as-is
- `src/routes/+layout.ts` — ssr/prerender settings stay
- All other routes — untouched
- `SequenceViewerOrchestrator.svelte` — unchanged
- `ViewerFooter.svelte` — already handles guest/auth states
- DI container — unchanged

---

## Edge Cases

### First-time visitor opens shared link
Lands in lightweight viewer. No auth gate, no loading spinner. Sees sequence immediately with guest footer. "Get App" navigates to sign-up.

### Signed-in user opens shared link
Lands in lightweight viewer (no auth gate). Footer initially shows "Get App". Auth resolves in background (1-2 seconds). Footer upgrades to full controls.

### `?guest=1` while signed in
Forces guest footer. For debugging the shared link experience without signing out.

### Offline with `z:` URL
Works fully — sequence decoded from URL, rendered locally. No Firebase needed.

### Offline with `/p/` short code
Firebase unreachable. Shows error state — short codes require network.

### Background from root layout
The root layout renders a BackgroundHost. With `@` reset, this doesn't load. The viewer page needs its own background or a solid color fallback. The `+layout@.svelte` should include a minimal background.
