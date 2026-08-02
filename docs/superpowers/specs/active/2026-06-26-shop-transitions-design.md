---
status: active
value: 4
effort: S
remaining: "Browser proof RAN 2026-08-02 and FAILED success criterion 1. The old Chrome-connector blocker was stale and is gone. The shop has since been restructured into bespoke per-product routes (/shop/loop-deck, /shop/tnd-trilogy, /shop/choreography-cards, /shop/starter-pack), none of which render ProductDetailPage — the only component carrying a destination view-transition-name. Result: the shop grid paints view-transition-name shop-book-cover on the book tile, but NO reachable destination declares a matching name, so no shared-element morph occurs for any product. Section 2's design (a per-product name on CardMockupPreview from both sides) was never implemented: CardMockupPreview has no viewTransitionName prop and ProductCard.svelte no longer exists. Next step is to re-scope section 2 onto the bespoke pages, not to re-verify."
depends_on: ""
supersedes_context: ""
tags: [shop, transitions, view-transitions, polish, ux]
last_triaged: 2026-07-24
---

# Shop Transitions — Design Spec

**Date:** 2026-06-26
**Status:** Design approved (brainstorm 2026-06-26). Not yet built.

## Problem

Shop navigation is plain anchor swaps with no visual continuity: clicking a product card
hard-cuts to the detail page, and "All Products" hard-cuts back. It should feel like the
card's cover image _is_ the detail view, growing and shrinking between the two.

## Key finding (investigation, 2026-06-26)

The machinery already exists and is proven — it is just switched off.

- The app has a 483-line `src/lib/shared/transitions/view-transitions.css` and a working
  shared-element morph pattern: `view-transition-name="sequence-{id}"` on both the browse
  thumbnail (`ChoreoCardThumbnail.svelte`) and the sequence detail route
  (`/sequence/[id]/+page.svelte`).
- The global `onNavigate` driver that powers route-level morphs is **commented out** in
  `src/routes/+layout.svelte:18-25` over a claimed F5 deadlock. With it off, the
  browse→sequence morph is **dormant app-wide** — nobody sees it.
- `svelte.config.js` has **no** `experimental: "async"` flag, so the async-mode VT
  regression (kit#14220) — the likely real cause of VT deadlocks — is not present here.
- `onNavigate` does not fire on a true full-page F5 (SvelteKit docs), so the original
  deadlock note is almost certainly misdiagnosed. The robust fix is guards, not disabling.

So this is **revive + extend the existing system** (`never-hand-roll`), not build a new one.

## Locked decision (brainstorming, 2026-06-26)

**Re-enable the global view-transition driver with guards (2026 canonical SvelteKit
pattern).** One `onNavigate` driver, root transition disabled so only named elements morph,
named elements opt in. Chosen over a shop-scoped or allowlisted driver because it is the
maintained best-practice shape and revives the dormant browse morph for free. Blast radius
is low: routes without a `view-transition-name` navigate exactly as today. The historical
F5 risk is a verification step, not a design compromise.

## Architecture

### 1. Re-enable the driver (`src/routes/+layout.svelte`)

Replace the commented block with the canonical pattern plus guards:

```js
onNavigate((navigation) => {
  if (!document.startViewTransition) return; // feature-detect → instant fallback
  if (consumeSkipNextViewTransition()) return; // swipe-dismiss already animated (exists)
  if (navigation.willUnload) return; // real unload / back-gesture
  if (navigation.from?.url.pathname === navigation.to?.url.pathname) return; // skip param-only nav
  return new Promise((resolve) => {
    document.startViewTransition(async () => {
      resolve();
      await navigation.complete;
    });
  });
});
```

The `consumeSkipNextViewTransition` import already exists in the file. The same-pathname
guard is critical — the app mutates query params constantly (viewer `bpm`/`t`/`view`, the
`OWNED_PARAMS` cleanup in this same layout) and must not trigger a morph on those.

### 2. Shop shared-element morph

The shared visual element is the card cover, rendered by `CardMockupPreview.svelte` in
**both** the grid card (`ProductCard.svelte`) and the detail preview column
(`ProductDetailPage.svelte`). Give it a per-product transition name on both sides:

- Add an optional `viewTransitionName?: string` prop to `CardMockupPreview`, applied as
  `style:view-transition-name={viewTransitionName}` on `.mockup-container`.
- Pass `product-${product.id}` from `ProductCard` and from `ProductDetailPage`.

Same name on both sides → the browser morphs the cover's size/position between list and
detail. Back via the "All Products" button reverses it automatically, no extra code.

**Uniqueness invariant:** `view-transition-name` must be unique per snapshot. Exactly one
card per product id is visible in the grid, so names stay unique. (No variation picker like
the sequence browse has, so the duplicate-name risk that file guards against does not apply
here.)

### 3. Aspect ratio — no object-fit fix needed

Both views render the same `CardMockupPreview` at `aspect-ratio: 3 / 4`. Because old and new
share the aspect ratio, the morph is a uniform scale + reposition with no distortion, so the
image-squish gotcha (VT ignoring `object-fit`) does not arise. Verify visually; only add an
`object-fit` rule on the `::view-transition-old/new` pseudo-elements if squish is observed.

### 4. Mobile + reduced-motion

The sequence viewer opts mobile **out** of its morph because it morphs into a heavy 3D
canvas. The shop's morph target is a lightweight 2D image, so **keep the morph on mobile**
here (cheap, delightful) — a deliberate divergence justified by the cheap target. Do NOT put
a `view-transition-name` on any live 3D canvas. `prefers-reduced-motion: reduce` collapses
all view transitions to an instant cut via the existing `view-transitions.css` rules — no
new work, just inherit it.

### 5. Grid entrance stagger (light polish)

On the product grid's first paint, a subtle staggered fade-rise. Prefer the existing
`StaggeredAnimation` / `PresenceAnimation` primitives
(`src/lib/shared/ui-animation/animations.svelte.ts`); if a per-index CSS stagger
(`animation-delay` by `{i}`) is cleaner for a one-shot mount, use that, gated behind
`@media (prefers-reduced-motion: no-preference)`. Keep it tasteful (short distance, ~250ms,
`cubicOut`). This is the only genuinely additive piece; everything else is reuse.

## Reused primitives (never-hand-roll)

`view-transitions.css` (driver CSS), `consumeSkipNextViewTransition` (swipe coordination),
the proven `view-transition-name` shared-element pattern, `StaggeredAnimation` /
`PresenceAnimation` (entrance), `CardMockupPreview` (the shared element itself).

## Risks

| Risk                                                     | Mitigation                                                                                                                                 |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| F5 / refresh deadlock recurs                             | async-mode absent + `onNavigate` doesn't fire on full-page nav + guards; **verify F5 + refresh before declaring done**.                    |
| Re-enabling lights up the browse→sequence morph app-wide | Intended (it was dormant); verify browse→sequence still looks right, not just shop.                                                        |
| Duplicate `view-transition-name` aborts the transition   | One card per id visible; invariant holds (no variation picker in shop).                                                                    |
| Mobile jank                                              | Target is a 2D image, not a 3D canvas; compositor-only (transform/opacity); cheap.                                                         |
| Pre-launch the grid is admin-gated                       | Only admins see the grid→detail morph until the gate is removed; the detail page is ungated. Acceptable; full morph goes public at launch. |

## Out of scope

Card hover-spring micro-interaction; bespoke detail→success choreography (it rides the
driver as a plain navigation); naming any 3D canvas; cross-document VT.

## Success criteria

1. Clicking a product card morphs the cover image into the detail page's preview; "All
   Products" reverses it.
2. F5 / hard refresh and normal navigation have no deadlock or stall.
3. The browse→sequence morph is live again (driver revived) and looks correct.
4. `prefers-reduced-motion: reduce` → instant cut, no morph.
5. Grid entrance stagger plays once on first paint, reduced-motion safe.
6. `npm run check` and `npm run build` green.

## Browser verification, 2026-08-02 — criterion 1 FAILS

The recorded blocker ("Chrome connector cannot initialize with sandboxCwd
`file:///mnt/e/tka-platform`") was an artifact of a dead session's WSL-form
workspace path. It does not reproduce; verification ran normally on a native
Windows checkout via Chrome DevTools MCP against a local server on :5174,
signed in as admin so the `/shop` gate was open.

### What was measured

| Observation | Value |
|---|---|
| `document.startViewTransition` available | yes |
| `view-transition-name` present on `/shop` grid | `root`, **`shop-book-cover`** |
| `view-transition-name` on `/shop/loop-deck` after navigation | `root` only |
| `view-transition-name` on `/shop/tnd-trilogy` | `root` only |

### Root cause

The shop was restructured after this spec was written. Every shipped product now
has its own route rendering a bespoke component:

- `/shop/loop-deck` → `LoopDeckConfiguratorPage.svelte`
- `/shop/tnd-trilogy` → `TnDTrilogyPage.svelte`
- `/shop/choreography-cards`, `/shop/starter-pack` → their own pages

`ProductDetailPage.svelte` — the only file that declares the destination name
(`viewTransitionName="shop-book-cover"` at line 88, and only when
`product.type === "guide"`) — is reachable solely through the generic
`[productId]` fallback route, which no shipped product uses. The origin name on
the shop grid therefore has no matching destination in any real navigation, and
a shared-element morph requires the same name on both sides.

Section 2 of this design was additionally never built as written: it specified a
`viewTransitionName` prop on `CardMockupPreview` passed as `product-${id}` from
both `ProductCard` and `ProductDetailPage`. `CardMockupPreview.svelte` has no
such prop and `ProductCard.svelte` has been deleted.

### Consequence

Criterion 1 ("clicking a product card morphs the cover image into the detail
page's preview") is not met for any product. Criteria 2–6 were not pursued,
because the spec cannot close on a re-verification pass — it needs its
architecture re-scoped onto the bespoke per-product pages first. Reopened as
design work, not verification work.
