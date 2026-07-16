# Hero Split Layout for Wide / 4K — Handoff Spec

**Date:** 2026-07-15
**Status:** SUPERSEDED by the 2026-07-16 continuation pass (§9 below). §5.1 fixed;
§5.2 still open (Austen's call). Whole landing page now has a ≥2200px 4K tier.
**Owner change file:** `src/routes/landing/components/HeroCarouselSection.svelte` (single file)
**Author of this pass:** Opus 4.8 session `5b1aff21`

---

## 1. Problem

On a wide / 4K monitor the landing hero (`src/routes/+page.svelte` → `HeroCarouselSection`)
rendered as a single narrow centered column: title, one portrait video, one CTA,
floating in a sea of empty cosmic background. It read as the mobile composition
stretched onto a billboard — "one tiny video and one button in the middle." Not
designed for wide viewports.

Root causes (verified in the CSS before the change):

- `.carousel-stage` width `min(34vw, 36dvh / 0.8)` — **height-capped**, so on a wide
  screen the `36dvh` term won and the video locked to ~45% of viewport height,
  never using horizontal space.
- `.hero-body` set `max-width: 1400px` but its only child (`.carousel-column`) was
  `flex: 0 1 auto`, so the 1400px was **never consumed** — everything collapsed to a
  narrow centered island.
- Single-column `align-items/justify-content: center` stack — fine at ~900px, lonely
  at 2560px+.

## 2. Decisions (locked with Austen)

Captured via interactive choice prompts, in order:

1. **Wide-screen direction:** *Split hero* — video on one side, copy + CTA on the other.
   (Rejected: bigger centered video, video wall / montage, cinematic full-bleed.)
2. **Left column content:** started at *value line + quick-link chips*, then Austen
   **rejected all 4 value-line drafts** ("keep it minimal"). Final: **no value line**;
   left column = title + tagline + CTA + quick-link chips.
3. **Quick-link chips:** **Guide · Notation · Shop** → `/guide` `/notation` `/shop`
   (routes verified against `SiteHeader.svelte` NAV). Reuse the existing `.hero-link`
   pill primitive (a `.hero-chip` size modifier), not a new component.

Constraint held throughout: **mobile + laptop (<1200px) stay byte-for-byte as before.**
The whole change is gated behind `@media (min-width: 1200px)`.

## 3. Implementation (what's in the tree now)

All in `src/routes/landing/components/HeroCarouselSection.svelte`.

### Markup
- Wrapped the left-column nodes in `<div class="hero-copy">`: `.title-block`, the
  primary-CTA `<nav class="hero-links">`, and a **new** `<nav class="hero-quicklinks">`
  holding the three chips. Icons match SiteHeader (`fa-book-open`, `fa-language`,
  `fa-bag-shopping`).
- `.hero-body` (video column) remains the **last** child of `.hero-carousel`.
- Removed the old bottom-of-section `.hero-links` nav (moved into `.hero-copy`).

### CSS — the safety net (why <1200px is untouched)
```css
.hero-copy { display: contents; }   /* wrapper dissolves below the split */
.title-block { order: 1; }
.hero-body   { order: 2; }
.hero-links  { order: 3; }
.hero-quicklinks { order: 4; }      /* hidden anyway via display:none */
.hero-quicklinks { display: none; } /* chips only exist in the split */
```
Below 1200px `.hero-copy` is `display:contents`, so title / CTA / chips behave as
direct flex children of `.hero-carousel` exactly as before, and `order` reproduces
the original mobile stack **title → video → CTA**. This is the mechanism that
guarantees no regression on phone/laptop.

### CSS — the split (≥1200px only)
```css
@media (min-width: 1200px) {
  .hero-carousel {
    display: grid;
    grid-template-columns: minmax(300px, 440px) auto;
    align-content: center; justify-content: center;
    column-gap: clamp(48px, 6vw, 96px);
    max-width: 1240px; margin-inline: auto;   /* anti-sprawl: bounded, centered */
    text-align: left;
  }
  .hero-copy {                 /* becomes the real left column */
    display: flex; flex-direction: column; align-items: flex-start;
    justify-content: center; gap: clamp(18px, 2vw, 30px);
    grid-column: 1; align-self: center; min-width: 0;
  }
  .hero-title { font-size: clamp(3rem, 3.2vw, 4.2rem); }  /* anchors left col */
  .hero-quicklinks { display: flex; flex-wrap: wrap; gap: 10px; }
  .hero-body { grid-column: 2; align-self: center; max-width: none; width: auto; }
  .carousel-stage {            /* height-driven now → real hero; width = h*0.8 */
    width: auto; height: min(62vh, 640px); max-height: none;
  }
}
```
`.hero-chip` = `padding: 12px 18px; font-size: 0.9rem;` — denser than the CTA but
kept ≥44px tall (design-system touch-target floor).

## 4. Verification (evidence)

Captured live via Chrome DevTools MCP against the running TKA dev server. Matrix:

| Width | Result |
|---|---|
| 2560×1440 (4K) | Split fires. Centered ~1240px block, balanced. Island gone. ✅ |
| 1920×1080 | Split, balanced, centered. ✅ |
| 1280×800 | Split, video not cramped, title one line. ✅ |
| 1199×800 | Split (breakpoint edge). Looks balanced. ✅ |
| 1000×820 | **Single-column centered fallback, no chips = unchanged.** ✅ |
| 390×844 (mobile) | **Identical to before** — title, video hero, single CTA. ✅ |

`npm run check:fast`: 14 errors exist, **none in this file** — all pre-existing in
`learn/quiz`, `playground`, `composer` demo files from other in-flight sessions.
This change compiles clean.

## 5. Open polish items (for the next agent to decide with Austen)

1. **Left copy sits a touch low** on 1920/2560 — the title→chips cluster is optically
   centered on the video but reads slightly below the video's midline (more headroom
   above the title than below the chips). Optional fix: nudge the left column up, or
   top-align the title with the video top. Subjective; get Austen's eye.
2. **Video pillarboxes on some clips** — the carousel stage is `#0a0a0f` with
   `object-fit: contain`; clips narrower than 4:5 show black side bars, amplified by
   the larger wide stage. **Pre-existing, not introduced here.** Switching the stage to
   `object-fit: cover` would fill the frame (crops edges) and affects **all** sizes —
   only do it if Austen wants that tradeoff.

## 6. Environment gotchas (cost this session real time — read before you start)

- **TKA dev server is on `:5176` (HTTPS), not `:5173`.** `:5173` was serving a
  **different app** — an "Austen Cloud" personal portfolio (Fire performer / projects
  grid), over plain HTTP. Don't assume `:5173` = TKA. Confirm the running port
  (`netstat -ano | grep 5176`) and that the tab title reads "TKA - The Kinetic
  Alphabet" before screenshotting.
- Dev servers here are HTTPS/2 — use `https://localhost:<port>/`. Navigating `https`
  to an `http` port throws `ERR_SSL_PROTOCOL_ERROR`.
- `resize_page` to 1199 rendered the split (chips visible) — the CSS viewport landed
  ≥1200 due to DPR/measurement. To exercise the <1200 fallback, resize to ~1000.

## 7. Rules honored

- `never-hand-roll` / `primitive-discovery`: chips reuse `.hero-link` pill; no new
  component. Routes grep-verified in `SiteHeader.svelte`.
- `no-checkboxes`, `no-ghostwriting-austen` (value line dropped, not invented),
  `no-layout-shift` (wide-only media query can't touch existing breakpoints),
  `commit-only-your-own-changes` (this pass commits only this file + this spec).
- `visualization-routing`: verified with the **real component** in the browser, not a
  mockup.

## 8. How to continue

1. Pull the branch/commit that contains this spec + the HeroCarouselSection change.
2. Start a scratch dev server if needed: `vite --port 5180` from the repo root
   (never touch `:5173`/`:5176` — Austen's). Load `https://localhost:5180/`.
3. If touching visuals, re-screenshot the matrix in §4 and diff against Austen's eye.
4. Decide items §5.1 / §5.2 with Austen, apply in this one file, keep the ≥1200px gate.
5. Do **not** widen scope beyond the hero. `+page.svelte` and other `git status` dirty
   files belong to other sessions — leave them.

---

## 9. Continuation pass — full landing page 4K tier (2026-07-16)

Austen widened scope: *"make sure the entire landing page experience is truly fully
optimized for 4K."* Findings and changes from that pass (Fable session):

### The finding

The ≥1200px split fixed 1080p–1440p, but at a true 4K CSS viewport (3840×2160)
the island returned: the 1240px hero bound + 640px stage cap left the whole
composition at ~27% of the screen width (measured: stage 512×640, content span
~1050px of 3840). Note the §4 matrix labels 2560×1440 as "4K" — Austen's monitor
likely presents ~2560 CSS px, so the new tier fires at **≥2200px** to catch both.

### What changed (all gated `@media (min-width: 2200px)`, nothing below moves)

| File | Change |
|---|---|
| `HeroCarouselSection.svelte` | Scale tier: hero bound 1240→1720px, stage `min(64vh, 960px)` (was 640 cap), title to clamp(4rem, 2.7vw, 5.8rem), CTA/chips/dots/credit one step up. **§5.1 fixed at all split widths**: `.hero-copy` gets `padding-bottom` = footer block height (56px; 66px at ≥2200) so the copy centres on the *stage*, not stage+dots+credit. Verified copy-center == stage-center at 1920/2560/3840. |
| `HowTkaWorksSection.svelte` | Tier: 1400→1960px, pictograph frames 200→280px, sequence frame cap 220→300px, card/type scale. |
| `PlayWithItSection.svelte` | Tier: heading/subtitle scale. Plus a **skeleton-parity fix at ≥920px** (see below). |
| `GuidesSection.svelte` | Tier: list 620→760px, cover 76→92px, heading/type scale. |
| `ShopCtaSection.svelte` | Tier: heading/intro/CTA scale. |
| `FaqAccordion.svelte` | Tier (`.faq.section` only — card variant on /about untouched): container 760→880px, item type up. |
| `LandingFooter.svelte` | Tier: link/credit type 0.875→1rem. |

### Skeleton-parity fix (pre-existing layout shift, all desktop widths)

PlayWithItInner renders the with-sidebar showcase at `min(1600px, 94vw)` from
920px up, but the section's loading skeleton was 800px wide — the lazy import
swap reflowed the page (`no-layout-shift` violation). The skeleton now mirrors
the desktop footprint (≥920px: full width + 380px `.sk-panel` placeholder +
`min(1100px, 70vh)` canvas cap). Measured after: width 1552 == 1552, height
delta 1198 vs 1102 (was ~500px).

### Also fixed in passing

`packages/sequence-engine/dist` was stale (missing `reduceToMinimalLoop`
export), which crashed the Infinite Spinner's lazy import — the landing spinner
showed a dead skeleton. `tsc -b` in the package fixed it. If the spinner is
ever skeleton-stuck, check the console for that import error first, and rebuild
packages.

### §5.2 pillarboxing — still open, deliberately

Kept `object-fit: contain`. Cropping to `cover` cuts prop tips out of flow
footage (worst-case crop for this content), and a blurred-video backdrop fill
would double video decodes for an aesthetic Austen hasn't asked for. The bigger
4K stage already makes the video dominate the frame. Decide with Austen if bars
still bother him.

### Verification (2026-07-16, Chrome DevTools MCP, scratch server :5190)

| Viewport | Result |
|---|---|
| 3840×2160 | Tier fires: stage 768×960, hero 1720px, title 92.8px, copy centred on stage (1081 vs 1080). All sections scaled. ✅ |
| 2560×1440 | Tier fires: stage 737×922, copy centre 721 vs stage 720. ✅ |
| 1920×1080 | Prior tier intact: stage 512×640, hero 1240, title 61.44px; §5.1 centring applied (546 == 546). ✅ |
| 1280×800 | Split intact, stage 397×496, chips visible. ✅ |
| 1000×820 | Single-column fallback: `.hero-copy` display:contents, chips hidden. ✅ |
| 390×844 | Mobile identical: title → video → single CTA. ✅ |
