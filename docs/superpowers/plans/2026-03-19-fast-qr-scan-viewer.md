# Fast QR Scan Viewer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make QR code scans display the sequence as fast as possible — eliminate the redirect from `/p/[code]` to `/sequence/z:...`, make auth non-blocking, and ensure the viewer renders before Firebase resolves.

**Architecture:** The `/p/[code]` route currently resolves the short code, then performs a full page navigation to `/sequence/z:{encoded}`. This double-load is the primary bottleneck. Instead, `/p/[code]` will resolve the short code and render the SequenceViewerOrchestrator directly — no redirect. The `/sequence/[id]` route will stop blocking on `initializeAppServices()`. Both routes start as guest and upgrade controls when auth resolves in the background. Layout resets (`+layout@.svelte`) already exist for both routes.

**Tech Stack:** SvelteKit, Svelte 5, Firebase Auth (lazy), ITI DI container

**Spec:** `docs/superpowers/specs/2026-03-18-lightweight-shared-link-viewer-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/routes/p/[code]/+page.svelte` | **Major rewrite** | Resolve short code → render viewer inline (no redirect) |
| `src/routes/sequence/[id]/+page.svelte` | Modify | Make `initializeAppServices()` non-blocking, start as guest |
| `src/routes/sequence/[id]/+layout.svelte` | Verify | Already exists — background host, theme. No changes needed. |
| `src/routes/sequence/+layout@.svelte` | Verify | Already exists — layout reset. No changes needed. |
| `src/routes/p/+layout@.svelte` | Verify | Already exists — layout reset. No changes needed. |

**Already done (no work needed):**
- Layout reset files for `/sequence/` and `/p/` — already in place
- `?guest=1` debug mode — already implemented in `/sequence/[id]`
- ViewerFooter guest/auth states — already handled
- SequenceViewerOrchestrator `isLoggedIn` prop — already wired

---

### Task 1: Render viewer inline on `/p/[code]` (eliminate redirect)

This is the biggest performance win. Currently `/p/[code]` resolves the short code, encodes the sequence into a URL, then navigates to `/sequence/z:{encoded}` — a full page navigation that reloads JS and re-initializes. Instead, render the viewer directly on `/p/[code]`.

**Files:**
- Modify: `src/routes/p/[code]/+page.svelte` (major rewrite)

- [ ] **Step 1: Read current `/p/[code]` page to understand full structure**

Read `src/routes/p/[code]/+page.svelte` in its entirety. Note:
- It currently does `goto(routePath)` after resolving — this is what we're eliminating
- It imports `container` from the DI module
- It has loading/error states and a "Browse Sequences" fallback button
- The page layout has `+layout@.svelte` (bare layout, no auth gate)

- [ ] **Step 2: Add viewer imports and state**

Add to the `<script>` section — the same core imports used by `/sequence/[id]/+page.svelte`:

```typescript
import SequenceViewerOrchestrator from "$lib/shared/sequence-viewer/components/SequenceViewerOrchestrator.svelte";
import type { OrchestratorContext } from "$lib/shared/sequence-viewer/components/SequenceViewerOrchestrator.svelte";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import { authState } from "$lib/shared/auth/state/authState.svelte";
import { initializeAppServices } from "$lib/shared/application/state/services.svelte";
```

Add state for the resolved sequence and viewer:

```typescript
let sequence = $state<SequenceData | null>(null);
let isMobile = $state(false);

// Guest preview — forces unauthenticated view for debugging
const forceGuest = $derived($page.url.searchParams.get("guest") === "1");
```

- [ ] **Step 3: Rewrite onMount — resolve and render, no redirect**

Replace the current `onMount` that calls `goto()` with one that resolves and stays:

```typescript
onMount(async () => {
  // Mobile detection
  const checkMobile = () => { isMobile = window.innerWidth < 768; };
  checkMobile();
  window.addEventListener("resize", checkMobile);

  if (!shortCode) {
    error = "No short code provided";
    isLoading = false;
    return;
  }

  try {
    const shortCodeManager = container.items.shortCodeManager;
    const sequenceEncoder = container.items.sequenceEncoder;

    // Resolve short code to sequence data
    const resolved = await shortCodeManager.resolveShortCode(shortCode);

    if (!resolved) {
      error = "Sequence not found";
      isLoading = false;
      return;
    }

    sequence = resolved;
    isLoading = false;

    // Non-blocking: track scan count
    if (!sequenceEncoder.isInlineEncoded(shortCode)) {
      shortCodeManager.incrementScanCount(shortCode).catch(() => {});
    }

    // Non-blocking: update URL to the canonical /sequence/ path for bookmarking
    // This does NOT trigger navigation — just updates the address bar
    try {
      const routePath = sequenceEncoder.generateSequenceRoutePath(resolved);
      const currentSearch = window.location.search;
      history.replaceState(history.state, "", routePath + currentSearch);
    } catch {
      // URL update is cosmetic — don't break the viewer if it fails
    }

    // Non-blocking: initialize app services for settings sync
    initializeAppServices().catch(() => {});
  } catch (err: unknown) {
    console.error("Failed to resolve short code:", err);
    error = "Failed to load sequence";
    isLoading = false;
  }

  return () => {
    window.removeEventListener("resize", checkMobile);
  };
});
```

Key changes from the original:
- No `goto()` — sequence is stored in `sequence` state and rendered inline
- `history.replaceState()` updates the URL cosmetically (no navigation)
- `initializeAppServices()` called non-blocking (not awaited)
- Scan count tracking is fire-and-forget

- [ ] **Step 4: Add viewer template**

Replace the current template (which only has loading/error states) with the full viewer. After the `{:else if error}` block, add the viewer:

```svelte
{:else if sequence}
  <div class="viewer-page">
    <SequenceViewerOrchestrator
      {sequence}
      {isMobile}
      forceGuest={forceGuest}
      onBack={() => goto("/browse/gallery")}
    >
      {#snippet children(ctx)}
        <!-- Reuse the same viewer chrome as /sequence/[id] -->
        <!-- Import and render ViewerSplitPane, ViewerFooter, etc. -->
        <!-- See /sequence/[id]/+page.svelte for the full template -->
      {/snippet}
    </SequenceViewerOrchestrator>
  </div>
```

**Important:** The `/sequence/[id]/+page.svelte` has ~800 lines of template code (viewer chrome, export panels, settings modal, delete dialog, etc.). Rather than duplicating all of this, extract the viewer chrome into a shared component or — simpler — import and render the key pieces.

The pragmatic approach: copy the essential viewer template from `/sequence/[id]/+page.svelte` (the `{:else}` branch that renders SequenceViewerOrchestrator + its children snippet). The full export/settings/delete functionality can be deferred — the first priority is showing the sequence fast. Start with a minimal viewer (split pane + footer) and iterate.

- [ ] **Step 5: Add minimal styles**

Add `.viewer-page` styles matching the `/sequence/[id]` page:

```css
.viewer-page {
  position: relative;
  z-index: 2;
  min-height: 100vh;
  min-height: 100dvh;
  overflow: hidden;
  background: #0f0f1a;
}
```

- [ ] **Step 6: Verify — navigate to `/p/{code}` and confirm no redirect**

Open `http://localhost:5173/p/0yOSmG` in an isolated browser context. Verify:
1. The URL stays on `/p/0yOSmG` briefly, then updates to `/sequence/z:...` (cosmetic)
2. The sequence viewer renders WITHOUT a full page navigation
3. No flash of loading screen between pages
4. The viewer shows playback controls and the choreo card

- [ ] **Step 7: Commit**

```bash
git add src/routes/p/
git commit -m "feat: render sequence viewer inline on /p/[code] — no redirect"
```

---

### Task 2: Make `/sequence/[id]` non-blocking

The `/sequence/[id]` route currently `await`s `initializeAppServices()` before starting `initializeRoute()`. Since `initializeAppServices()` is lightweight (just settings sync), this is a small win — but the pattern should be non-blocking for consistency.

**Files:**
- Modify: `src/routes/sequence/[id]/+page.svelte` (lines 143-161)

- [ ] **Step 1: Make initializeAppServices non-blocking**

Change the `onMount` from:

```typescript
onMount(async () => {
  await initializeAppServices();
  // ... mobile detection ...
  void initializeRoute();
});
```

To:

```typescript
onMount(async () => {
  // Non-blocking: settings sync happens in background
  initializeAppServices().catch(() => {});

  // Mobile detection
  const checkMobile = () => { isMobile = window.innerWidth < 768; };
  checkMobile();
  window.addEventListener("resize", checkMobile);
  resizeCleanup = () => window.removeEventListener("resize", checkMobile);

  if (isMobile) {
    registerDrawer(drawerId, handleBack);
  }

  // Start sequence loading immediately — don't wait for services
  void initializeRoute();
});
```

- [ ] **Step 2: Ensure forceGuest defaults correctly**

Verify that the existing `forceGuest` prop is wired to the orchestrator:

```typescript
// In the template where SequenceViewerOrchestrator is rendered:
forceGuest={forceGuest}
```

And that the orchestrator passes it through to `isLoggedIn`:

```typescript
isLoggedIn: forceGuest ? false : authState.isAuthenticated,
```

Both of these already exist in the codebase. Just confirm they're present.

- [ ] **Step 3: Verify — open `/sequence/z:...` URL directly**

Navigate to a `z:` encoded sequence URL. Verify:
1. The viewer renders immediately (no blocking on auth)
2. Footer starts showing guest controls
3. If signed in, footer upgrades to full controls within 1-2 seconds
4. Playback works during the guest phase

- [ ] **Step 4: Commit**

```bash
git add src/routes/sequence/
git commit -m "feat: make initializeAppServices non-blocking on sequence route"
```

---

### Task 3: Verify auth upgrade flow

No code changes — this is a verification task to confirm the progressive auth upgrade works correctly across both routes.

- [ ] **Step 1: Test signed-in user on `/p/[code]`**

As a signed-in user, navigate to `http://localhost:5173/p/0yOSmG`. Verify:
1. Sequence renders immediately
2. Footer initially shows minimal controls (may briefly show "Get App")
3. Within 1-2 seconds, footer upgrades to full controls (save, favorite, etc.)
4. Back button works

- [ ] **Step 2: Test `?guest=1` debug mode**

Navigate to `http://localhost:5173/p/0yOSmG?guest=1`. Verify:
1. Footer stays in guest mode (shows "Get App")
2. No save/favorite/edit buttons appear even though signed in

- [ ] **Step 3: Test unsigned user (incognito)**

Open an incognito/private window. Navigate to `http://localhost:5173/p/0yOSmG`. Verify:
1. Sequence renders without auth
2. Footer shows "Get App" permanently
3. No errors in console about missing auth

- [ ] **Step 4: Test offline with `z:` URL**

Disconnect network. Navigate to a `z:` encoded URL. Verify:
1. Sequence decodes and renders (data is in the URL)
2. Auth fails silently (no blocking error)
3. Footer stays in guest mode

---

### Task 4: Clean up dead code

After Tasks 1-3 are verified, clean up the redirect artifacts.

**Files:**
- Modify: `src/routes/p/[code]/+page.svelte`

- [ ] **Step 1: Remove unused imports**

Remove `saveSequenceRouteHandoff` import and `sequence-handoff.svelte` dependency from `/p/[code]` — no longer needed since we don't redirect.

- [ ] **Step 2: Commit**

```bash
git add src/routes/p/
git commit -m "chore: remove redirect artifacts from /p/[code] route"
```
