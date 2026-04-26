# Lightweight Shared Link Viewer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Shared sequence links render immediately by skipping the root layout's auth gate and app bootstrap via SvelteKit `@` layout reset.

**Architecture:** Add `+layout@.svelte` files to `/sequence/` and `/p/` route directories, resetting to a bare layout with only `app.css`. The existing `[id]/+layout.svelte` (background/theme) inherits from this reset instead of the root. Remove mobile-to-drawer redirects. Add `?guest=1` debug mode.

**Tech Stack:** SvelteKit layout resets (`@` syntax), Svelte 5

**Spec:** `docs/superpowers/specs/2026-03-18-lightweight-shared-link-viewer-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/routes/sequence/+layout@.svelte` | Create | Reset root layout — bare shell with app.css |
| `src/routes/sequence/+layout.ts` | Create | `ssr = false, prerender = false` |
| `src/routes/p/+layout@.svelte` | Create | Same reset for short code route |
| `src/routes/p/+layout.ts` | Create | Same ssr/prerender settings |
| `src/routes/sequence/[id]/+page.svelte` | Modify | Remove mobile redirect, add `?guest=1`, call `initializeAppServices()` defensively |
| `src/routes/p/[code]/+page.svelte` | Modify | Remove mobile redirect, render viewer inline instead of always redirecting |

---

### Task 1: Layout Reset for `/sequence/`

**Files:**
- Create: `src/routes/sequence/+layout@.svelte`
- Create: `src/routes/sequence/+layout.ts`

- [ ] **Step 1: Create the layout reset file**

Create `src/routes/sequence/+layout@.svelte` — identical pattern to `src/routes/(public)/+layout@.svelte`:

```svelte
<script lang="ts">
  import type { Snippet } from "svelte";
  import "../../app.css";

  let { children } = $props<{
    children: Snippet;
  }>();
</script>

<svelte:head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width" />
</svelte:head>

{@render children()}
```

- [ ] **Step 2: Create the layout settings file**

Create `src/routes/sequence/+layout.ts`:

```typescript
// The root +layout.ts sets ssr=false, but the @ reset escapes it.
// Re-declare here so the viewer route doesn't attempt SSR
// (the DI container and browser APIs don't work server-side).
export const ssr = false;
export const prerender = false;
```

- [ ] **Step 3: Verify build**

Run: `npm run check`
Expected: No new errors. The existing `[id]/+layout.svelte` (background) should inherit from the `@` reset instead of the root layout.

- [ ] **Step 4: Commit**

```bash
git add src/routes/sequence/+layout@.svelte src/routes/sequence/+layout.ts
git commit -m "feat: layout reset for /sequence/ — skip root auth gate"
```

---

### Task 2: Layout Reset for `/p/`

**Files:**
- Create: `src/routes/p/+layout@.svelte`
- Create: `src/routes/p/+layout.ts`

- [ ] **Step 1: Create the layout reset file**

Create `src/routes/p/+layout@.svelte` — same as the sequence one:

```svelte
<script lang="ts">
  import type { Snippet } from "svelte";
  import "../../app.css";

  let { children } = $props<{
    children: Snippet;
  }>();
</script>

<svelte:head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width" />
</svelte:head>

{@render children()}
```

- [ ] **Step 2: Create the layout settings file**

Create `src/routes/p/+layout.ts`:

```typescript
export const ssr = false;
export const prerender = false;
```

- [ ] **Step 3: Commit**

```bash
git add src/routes/p/+layout@.svelte src/routes/p/+layout.ts
git commit -m "feat: layout reset for /p/ — skip root auth gate for short codes"
```

---

### Task 3: Remove Mobile Redirect from `/sequence/[id]`

**Files:**
- Modify: `src/routes/sequence/[id]/+page.svelte`

- [ ] **Step 1: Remove the mobile-to-drawer redirect**

In `initializeRoute()`, find the block (around lines 327-352) that starts with:

```typescript
    // Mobile: redirect to app shell with drawer overlay
```

Remove the entire `if (isMobile && sequence)` block that calls `openSequenceOverlay()`, `setSkipNextViewTransition()`, `goto(returnPath)`, and `pushState()`.

The viewer should render full-screen on all viewports when accessed via the route. The drawer overlay is only for in-app navigation (browse → viewer).

- [ ] **Step 2: Remove unused imports**

After removing the redirect, these imports may become unused:
- `openSequenceOverlay` from `sequence-viewer-overlay-state.svelte`
- `setSkipNextViewTransition` from `sequence-drawer-state.svelte`
- `pushState` from `$app/navigation` (check if used elsewhere in the file)

Remove any that are no longer referenced.

- [ ] **Step 3: Verify build**

Run: `npm run check`
Expected: No new errors

- [ ] **Step 4: Commit**

```bash
git add src/routes/sequence/[id]/+page.svelte
git commit -m "feat: sequence viewer renders full-screen on all viewports"
```

---

### Task 4: Add `?guest=1` Debug Mode

**Files:**
- Modify: `src/routes/sequence/[id]/+page.svelte`

- [ ] **Step 1: Add guest override param**

In the URL params section (around line 70-87), add:

```typescript
  const forceGuest = $derived($page.url.searchParams.get("guest") === "1");
```

- [ ] **Step 2: Find where `isLoggedIn` is passed to the orchestrator**

Search for where `isLoggedIn` or auth state is passed to `SequenceViewerOrchestrator` or determined. The orchestrator likely reads auth state internally. Find the auth state source and apply the override.

If the orchestrator reads auth from `authState` directly (imported module), the `?guest=1` override needs to be passed as a prop to the orchestrator or to the footer. Check how `isLoggedIn` flows through and apply the override at the right level.

The most likely approach: pass `forceGuest` as a prop to the orchestrator, which forwards it to the footer. The footer already has an `isLoggedIn` prop — override it:

```typescript
// In the orchestrator or wherever isLoggedIn is determined:
const effectiveLoggedIn = forceGuest ? false : actualIsLoggedIn;
```

- [ ] **Step 3: Add the "Get App" URL constant with Play Store migration comment**

In `+page.svelte` or the appropriate component that handles the "Get App" action, add:

```typescript
// TODO: Once PWA is listed on Google Play Store via TWA, swap this
// to the Play Store URL for Android users. Chrome will show the store
// install banner automatically via assetlinks.json integration.
// For iOS, link to the App Store listing when available.
const GET_APP_URL = "/";
```

- [ ] **Step 4: Verify build**

Run: `npm run check`
Expected: No new errors

- [ ] **Step 5: Commit**

```bash
git add src/routes/sequence/[id]/+page.svelte
git commit -m "feat: add ?guest=1 debug mode for shared link viewer"
```

---

### Task 5: Remove Mobile Redirect from `/p/[code]`

**Files:**
- Modify: `src/routes/p/[code]/+page.svelte`

- [ ] **Step 1: Remove the mobile-to-drawer redirect**

In the `onMount` handler, find the block (around lines 65-76) that starts with:

```typescript
      // Mobile: go directly to app shell with drawer overlay
      const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
      if (isMobile) {
```

Remove this entire `if (isMobile)` block. The `/p/` resolver should always redirect to `/sequence/{encoded}` regardless of viewport.

- [ ] **Step 2: Remove unused imports**

After removing the redirect, `openSequenceOverlay` and `pushState` may be unused. Remove if so.

- [ ] **Step 3: Verify build**

Run: `npm run check`
Expected: No new errors

- [ ] **Step 4: Commit**

```bash
git add src/routes/p/[code]/+page.svelte
git commit -m "feat: /p/ resolver always redirects to /sequence/ on all viewports"
```

---

### Task 6: Defensive `initializeAppServices()` Call

**Files:**
- Modify: `src/routes/sequence/[id]/+page.svelte`

- [ ] **Step 1: Ensure `initializeAppServices()` is called early and defensively**

The `@` layout reset means the root layout's initialization doesn't run. The viewer page already calls `initializeAppServices()` on mount (line 143). Verify this still works:

1. Check that `initializeAppServices()` doesn't depend on anything the root layout sets up
2. If it does, wrap it in a try/catch so the viewer still renders if it fails
3. The sequence loading should not be blocked by service initialization — decode and render first, initialize services in parallel

If `initializeAppServices()` is already defensive (returns early if already initialized), no changes needed. Just verify.

- [ ] **Step 2: Verify build**

Run: `npm run check`

- [ ] **Step 3: Commit (if changes needed)**

```bash
git add src/routes/sequence/[id]/+page.svelte
git commit -m "fix: defensive service initialization for standalone viewer"
```

---

### Task 7: End-to-End Verification

- [ ] **Step 1: Run TypeScript check**

Run: `npm run check`
Expected: No new errors

- [ ] **Step 2: Run build**

Run: `npm run build`
Expected: Clean build

- [ ] **Step 3: Test shared link flow**

1. Open a sequence from browse gallery
2. Click copy-link button → get `/p/aBc123` URL
3. Open that URL in incognito window (unauthenticated)
4. Verify: sequence renders immediately (no auth gate loading spinner)
5. Verify: footer shows "Get App" button
6. Verify: animation playback works (play/pause, BPM)
7. Verify: "Get App" navigates to `/`

- [ ] **Step 4: Test `?guest=1` debug mode**

1. While signed in, open a sequence viewer URL with `?guest=1` appended
2. Verify: footer shows "Get App" instead of save/favorite

- [ ] **Step 5: Test mobile viewport**

1. Open a shared link at mobile width
2. Verify: viewer renders full-screen (NOT redirected to drawer overlay)
3. Verify: swipe-to-dismiss and mobile header work

- [ ] **Step 6: Provide debug URLs to user**

Share the specific localhost URLs for testing:
- Shared link (incognito): `http://localhost:5173/p/{code}`
- Guest mode (signed in): `http://localhost:5173/sequence/{id}?guest=1`
