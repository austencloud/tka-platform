# Landing Page Split Tier at 920px (Z Fold / Mini-Tablet Class)

**Date:** 2026-07-16
**Status:** Approved (Austen, in conversation)
**Scope:** Landing page only (`src/routes/landing/components/`)

## Problem

The Z Fold 6 unfolded reports ~928x1080 CSS px. That lands in a gap where the
landing page half-commits to desktop:

- Hero split (`HeroCarouselSection.svelte`) requires >=1200px, so the fold gets
  the centered single column with the video below the copy.
- Six-step row (`HowTkaWorksSection.svelte`) wraps to 3x2 at <=1100px.
- PlayWithIt already splits at >=920px, so one section goes desktop while its
  neighbors stay in tablet mode. Inconsistent and awkward on wide-tall devices.

The fold does NOT need the 4K tier (>=2200px is a scale-up of the split tier
for huge monitors). It needs the >=1200 split tier, which fits at 928px:
copy 300px + gap + height-driven video ~512px.

## Decision

Lower and unify the desktop-split threshold to **920px** across the landing
page, aligning with PlayWithIt. Resulting tier story:

| Band | Layout |
|---|---|
| <640px | Phone: stacked, six-card 2x3 |
| 640-919px | Tablet: centered hero, six-card 3x2 |
| >=920px | Desktop split: side-by-side hero, six cards in one row |
| >=2200px | 4K: same split, scaled up (unchanged) |

No device sniffing, no aspect-ratio queries. Width alone distinguishes the
class (fold unfolded 928, fold landscape 1080, iPad landscape 1024+, snapped
desktop windows).

## Changes

### HeroCarouselSection.svelte
1. Split media query `min-width: 1200px` -> `920px`. The quick-links
   `display:flex` lives inside this block (default `display:none`), so
   secondary nav chips appear with the split automatically.
2. New in-band tuning for `920-1199px` (nested or sibling query):
   - `.carousel-stage` height cap `min(62vh, 560px)` instead of 640px. At
     920px the 640px stage (512px wide) plus 300px copy plus 48px gap leaves
     ~10px slack; a classic desktop scrollbar would overflow it. 560px tall
     (448px wide) restores comfortable margin.
   - `.hero-carousel` column-gap `clamp(32px, 4vw, 56px)`.
   - `.hero-title` font-size `clamp(2.5rem, 3.9vw, 3rem)` so the title does
     not hit 48px inside a 300px column.

### HowTkaWorksSection.svelte
1. Tablet wrap `max-width: 1100px` -> `919px`, so 3x2 holds right up to the
   920px split and both layouts flip in the same move (no 900-919 sliver
   where six-in-a-row pairs with a still-centered hero).
2. `.cards-row` gap `16px` -> `clamp(10px, 1.3vw, 16px)` (12px at 920,
   16px by ~1230).
3. `.step-card` horizontal padding `16px` -> `clamp(10px, 1.3vw, 16px)`.
   Per-card media lands ~111px at 920px, scaling up from there.

### LazyHowTkaWorksSection.svelte (skeleton must mirror the real grid)
1. Skeleton fallback query `max-width: 1100px` -> `919px`.
2. `.sk-grid` gap mirrors the clamp.

### Unchanged
- PlayWithIt sections (already 920).
- All >=2200px 4K rules.
- <640px phone rules.
- GuidesSection / ShopCta (content-width sections, no split concept).

## Known seam (accepted)

`SiteHeader.svelte` collapses to the hamburger nav at <=1024px, so the fold
gets mobile header + desktop-split body. Verified visually during this work;
aligning the header is out of scope unless it looks broken.

## Verification plan

Chrome DevTools emulation against the live dev server, screenshots at:
- 928x1080 (fold unfolded portrait): split hero, six cards one row, no
  horizontal overflow
- 1080x928 (fold landscape) and 1024x768 (iPad landscape): same
- 1440x900 and 3840x2160: regression, desktop and 4K tiers unchanged
- 393x852 (phone): regression, mobile layout unchanged
