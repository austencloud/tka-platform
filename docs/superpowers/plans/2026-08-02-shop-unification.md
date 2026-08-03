# Shop Unification — Implementation Plan

- **Spec:** `docs/superpowers/specs/2026-08-02-shop-unification-design.md` (authority for WHAT/WHY)
- **Recon digests (executors: read both before your phase):**
  - `C:\Users\Austen\AppData\Local\Temp\claude\E--tka-platform\fffb2d07-0068-401d-8de0-8d2c70437a92\scratchpad\digest-store-module-inventory.md`
  - `C:\Users\Austen\AppData\Local\Temp\claude\E--tka-platform\fffb2d07-0068-401d-8de0-8d2c70437a92\scratchpad\digest-smart-collections-strategy.md`
- **Orchestration:** Fable dispatches one Opus 5 executor per phase; Fable reviews diffs and owns all
  visual judgment. Executors: re-read this plan at phase start; prove completion with tool output;
  commit with explicit pathspec only (`commit-only-your-own-changes.md`); do not delegate further.

## Standing constraints (every phase)

- ONE width system for all `/shop/*`: `max-width: var(--shell-w, min(1720px, 92vw))`, fluid above
  the floor, 1680px big-screen seam (`4k-native-layout.md`). Kill the three coexisting systems
  (config-page.css shell-w / StorePage `min(2400px,94vw)` / flat rem caps) as pages are touched.
- Sizes in `rem` (ride the root ramp); px only for touch floors, hairlines, source-capped media.
- Container queries for component-internal recomposition; viewport tiers for page chrome
  (smart-collections strategy). `clamp()` with `cqi` inside cards, `vw` in page chrome.
- Reuse primitives: `FilterChipBase`/`SegmentedControl` for any filter/tab row, `Crossfade` for
  state swaps, existing `BuyButton`/cart spine untouched. No checkboxes. No layout shift
  (tabular-nums on prices, reserved boxes for async art).
- Analytics: existing `shop-funnel.ts` events must keep firing unchanged (product_viewed,
  variant_selected, add_to_cart, checkout_started, purchase_completed, cart_opened).
- Copy: `docs/reference/ai-writing-guide.md` voice. State what it does. No superlatives,
  no em dashes, no "Whether you're…".
- Svelte 5 runes; check `code-style`/`styling`/`state-management` skills' conventions.

## Phase 1 — Shell + purchase-state foundation

**Goal:** the chrome every product page shares, plus honest CTA states.

1. `src/lib/features/store/components/shell/ShopProductShell.svelte`:
   - Slots/props: catalog context strip (back to `/shop` + family breadcrumb), hero band
     (media / title / price block / CTA cluster), `howItWorks` snippet slot, `details` snippet
     slot, cross-sell rail (data-driven, excludes current product), optional configurator region
     (LOOP/Architect embed their dial UIs here).
   - Absorb the shared chrome currently in `config-page.css` (root padding/bg, back button, h1,
     `.price`, `.assurance`, `.checkout-error`, loading/error states) so hosts stop hand-rolling
     copies. The copy-pasted mobile checkout dock (LoopDeckConfiguratorPage + DeckArchitectPage)
     moves into the shell as an opt-in slot.
2. Purchase-state resolver in `src/lib/features/store/domain/` (pure fn, follows existing
   `preorder-pricing.ts` patterns): `(product, salesLive) → 'buy' | 'preorder' | 'notify'`.
   `salesLive` is a single config constant (file-level, default `false` until Austen clears
   Stripe payout + tax). CTA cluster renders from this. `notify` reuses the existing
   `WaitlistForm` capture, tagged with product id.
3. Cross-sell rail data: derive "more from the line" from the existing product catalog
   (`loadActiveProducts()`); no new backend.

**Verify:** `npm run check:fast` clean; shell renders in isolation on a test route.
**Commit pathspec:** the new shell files + touched domain files only.

## Phase 2 — `/shop` catalog front door (DIRECTION CHOSEN: hybrid — C hero + B grid)

Reference sketches: `static/sketches/2026-08-02-shop-front-door-c.html` (hero) and
`...-b.html` (grid). Composition top to bottom:

1. **Teaching hero, ~60% viewport** (from C): serif-italic headline "Every card is a
   sequence." + "Scan it and it moves.", the glowing card visual with a real QR (use a real
   short-code QR asset, not a fake pattern), 3 numbered steps, one CTA scrolling to the grid.
2. **Chip row** (from B): All · Decks · Books · Bundles with counts — use the canonical
   single-select primitive per `chip-primitives.md` (SegmentedControl or FilterChipBase per
   the routing rule), sticky below the hero.
3. **Uniform tile grid** (from B): cover art area, shelf kicker, name, one-liner, price
   (tabular-nums), status chip, one CTA. 3 cols ≥1400, 2 cols ≥768, 1 col below. Products
   from live catalog data (`loadActiveProducts()`).
4. **Waitlist band** (subdued) + **free-composer onward band** (from all three sketches).

Replace the gated index: `ShopComingSoon` retires for everyone; the admin/non-admin fork and
`tka_shop_admin` cookie gate are removed from `/shop/+page*`. SSR/SEO: keep the existing
`+page.server.ts` product loading; page is indexable; schema.org ItemList of products.
Sketch copy is placeholder: verify the "printed in Chicago" claim and the guide-book price
against seed data / Austen before shipping copy.

**Verify:** `check:fast` + Fable's visual pass.
**Commit pathspec:** shop index route files + new front-door components.

## Phase 3 — Re-seat the five purchase surfaces

Order: `tnd-trilogy` → `starter-pack` → `[productId]` → `loop-deck` → `loop-deck/architect`
(simplest first, configurators last). Each: host keeps data + product-specific sections; shell
owns chrome. Then `/shop/success`: re-seat `OrderConfirmation` in page flow + add the cross-sell
rail ("while it ships, more from the line") and a real "Back to the shop" that now lands
somewhere alive. Delete per-page dead chrome as it migrates. Do NOT unify the `PropPicker` /
`ShopPropPicker` fork in this pass (note it in the ledger as follow-up; no gold-plating).

**Verify:** `check:fast` per page; funnel events still fire (grep + one manual add-to-cart
smoke in dev if feasible).
**Commit pathspec:** per-page, as each re-seat completes.

## Phase 4 — Absorption + wayfinding rewire

1. `/shop/choreography-cards`: content home found for every section (anatomy explainer +
   scannable QR → LOOP Deck + Trilogy PDP `howItWorks` slots; brand story → front-door hero;
   guide/notation outlinks → front-door onward band), then route becomes a 301 → `/shop`
   (follow the `/store` redirect shim pattern).
2. Nav lockstep edit: `SiteHeader.svelte` dropdown, `SiteFooter.svelte` column,
   `launchpad-tiles.ts` tile, landing `ShopCtaSection.svelte` — all per spec IA. Grep the repo
   for remaining `/shop/choreography-cards` hrefs; zero must remain outside the redirect.

**Verify:** grep proof (no stale hrefs), redirect returns 301, `check:fast`.
**Commit pathspec:** the touched nav/route files.

## Phase 5 — Review harness + Fable visual loop

1. Executor builds `src/routes/test/shop-review/+page.svelte` copying the
   `/test/smart-collections` harness pattern: side-by-side fixed device viewports (375×667,
   960×412, 820×1180, 1440×900, 1920×1080, 2560×1440, 3840×2160) of the key shop surfaces
   (front door, one simple PDP, LOOP configurator, success) via iframes.
2. Fable (not an executor) runs the DevTools MCP loop per `visual-verification-mandatory.md`
   on every route × every viewport; files defects back as fix batches until frames pass.

## Phase 6 — Ship gate

Codex second-view review of the full diff; one full `npm run check` (capture-once, grep the
log); scoped commits already made per phase; spec updated with chosen direction + shipped state;
ledger boxes checked.

## Follow-ups deliberately out of scope

- `PropPicker`/`ShopPropPicker` unification
- Merch/Digital shelves (arrive with real products)
- Flipping `salesLive` to true (Austen's Stripe payout + tax registration)
- `2026-07-10-loop-deck-configurator-v2-design.md` (dial restructure — separate effort)
