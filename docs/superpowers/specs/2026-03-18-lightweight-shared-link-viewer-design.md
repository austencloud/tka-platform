# Lightweight Shared Link Viewer

**Date:** 2026-03-18
**Status:** Approved
**Problem:** When someone opens a shared sequence link (`/p/aBc123`), the root layout bootstraps the full DI container, Firebase, auth, and app infrastructure before the viewer renders. This adds unnecessary load time for someone who just wants to see a sequence.

---

## Solution

Give the `/sequence/[id]` route a separate SvelteKit layout group that bypasses the heavy app bootstrap. The viewer loads only what's needed for rendering: sequence decoder, pictograph renderer, animation engine, and minimal settings. Firebase and auth lazy-load in the background for enrichment (creator attribution) and the "Get App" CTA.

---

## Architecture

### Layout Group

SvelteKit layout groups allow routes to use different layouts without affecting URL structure. The sequence route moves into a `(viewer)` layout group with its own minimal `+layout.svelte` that skips the app bootstrap:

```
src/routes/
  (app)/          ← existing routes, full app bootstrap
    +layout.svelte  ← Firebase, DI, auth, MainApplication
    browse/
    create/
    ...
  (viewer)/       ← lightweight viewer routes
    +layout.svelte  ← minimal: background, basic styles, no DI/Firebase/auth
    sequence/[id]/
      +page.svelte
    p/[code]/
      +page.svelte
```

The `(viewer)` layout loads:
- BackgroundHost (for the starfield/theme background)
- Basic CSS variables and theme
- NO DI container, NO Firebase, NO auth gate

The route pages (`+page.svelte`) handle their own lightweight initialization.

### What Loads Immediately (First Paint)

1. **Sequence decoder** — `SequenceEncoder` class imported directly (not from DI container). Decodes the `z:` URL or resolves the short code.
2. **Pictograph renderer** — The choreo card SVG rendering pipeline.
3. **Animation engine** — For BPM playback.
4. **Minimal settings** — Default prop types, dark mode from URL or localStorage.

### What Loads Lazily (After First Paint)

1. **Firebase + Firestore** — For short code resolution (if `/p/` route), hash matching, analytics.
2. **Auth state** — To determine signed-in vs. guest footer.
3. **Creator attribution** — Background `encoderHash` match against `publicSequences`.
4. **Letter/position derivers** — For enriching the decoded sequence with derived data.

### Short Code Resolution Path

For `/p/[code]` URLs, the short code needs Firebase to resolve. The flow:

1. Show a loading skeleton immediately (sub-100ms).
2. Lazy-import Firebase and query the short code.
3. Once resolved, render the sequence.

For `/sequence/z:...` URLs (self-contained), no Firebase needed at all — decode and render immediately.

---

## Viewer UI

### Unauthenticated Footer

The existing `ViewerFooter.svelte` already shows a "Get App" button when `!isLoggedIn`. This stays as-is. The footer shows:
- Play/pause button
- BPM control
- "Get App" button (green CTA)

### Guest Preview Mode

A `?guest=1` query parameter forces the unauthenticated view even when signed in. For debugging and previewing the shared link experience.

```typescript
// In the viewer: check for guest override
const forceGuest = $page.url.searchParams.get("guest") === "1";
const isLoggedIn = forceGuest ? false : actualAuthState;
```

### "Get App" Destination

```typescript
// TODO: Once PWA is listed on Google Play Store via TWA, swap this
// to the Play Store URL for Android users. Chrome will show the store
// install banner automatically via assetlinks.json integration.
// For iOS, link to the App Store listing when available.
const GET_APP_URL = "/";
```

Tapping "Get App" navigates to `/` (the web app root), which shows the sign-up/login screen. After auth → onboarding → create module. Standard new user funnel.

---

## Background Enrichment

After the sequence renders (first paint complete), fire-and-forget:

1. Lazy-import Firebase + the `PublicSequenceHashMatcher`.
2. Compute `encoderHash` from the decoded sequence.
3. Query `publicSequences` for a match.
4. If found, update the viewer with creator name, intended props, etc.
5. If offline or error, viewer works fine without it.

This is the same progressive enhancement pattern from the content-addressable URLs spec, just deferred until after first paint.

---

## Migration: Moving Routes to Layout Groups

### Files Changed

| File | Change |
|------|--------|
| **Move:** `src/routes/sequence/` → `src/routes/(viewer)/sequence/` | Route moves to viewer group |
| **Move:** `src/routes/p/` → `src/routes/(viewer)/p/` | Short code resolver moves too |
| **New:** `src/routes/(viewer)/+layout.svelte` | Minimal viewer layout |
| **Move:** existing routes → `src/routes/(app)/` | All app routes move to app group |
| **Move:** `src/routes/+layout.svelte` → `src/routes/(app)/+layout.svelte` | App bootstrap moves |
| **New:** `src/routes/+layout.svelte` | Bare root layout (just the `<slot>`) |
| `src/routes/(viewer)/sequence/[id]/+page.svelte` | Remove DI dependency, use direct imports |
| `src/routes/(viewer)/p/[code]/+page.svelte` | Lazy Firebase for short code resolution |

### The Root Layout

The new root `+layout.svelte` is bare — just renders children:

```svelte
<slot />
```

Each layout group handles its own initialization:
- `(app)/+layout.svelte` — full app bootstrap (existing code)
- `(viewer)/+layout.svelte` — minimal background + theme

### What the Viewer Layout Provides

```svelte
<!-- (viewer)/+layout.svelte -->
<script>
  // Minimal: just background and theme variables
  import BackgroundHost from "$lib/shared/background/BackgroundHost.svelte";
</script>

<BackgroundHost />
<slot />
```

No DI container. No Firebase. No auth. No MainApplication. No module system.

---

## What Doesn't Change

- The `SequenceViewerOrchestrator` component stays the same — it already handles both auth and guest states.
- The animation engine and pictograph renderer are standalone (no DI dependency for core rendering).
- The "Get App" button behavior in `ViewerFooter.svelte` stays as-is.
- QR code generation and short code creation are unaffected.
- The drawer overlay flow (browse → viewer) is unaffected — that's in the `(app)` group.

---

## Edge Cases

### Signed-in user opens a shared link
They land in the `(viewer)` layout — lightweight, no app shell. The viewer detects auth state lazily and shows the full footer (save, favorite, etc.) instead of "Get App". If they tap back, they go to the previous page (not the app). If they want the full app, they navigate there explicitly.

### Offline
`z:` encoded URLs work fully offline (all data in URL). Short code URLs (`/p/`) need Firebase and will show an error state if offline.

### Mobile redirect
The current `/sequence/[id]` route redirects mobile users to the drawer overlay. In the `(viewer)` group, this redirect should NOT happen — there's no app shell to host the drawer. The viewer renders full-screen on all viewports.

### `?guest=1` parameter
Only affects footer state (shows "Get App" instead of save/favorite). Does not affect sequence loading or rendering.
