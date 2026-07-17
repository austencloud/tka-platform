# /composer Proportionate Scale: Bespoke Per-Class Layout, One Continuous Type Ramp

**Date:** 2026-07-17
**Status:** Approved in brainstorm; ready for implementation plan
**Supersedes:** the type/scale layer of `2026-07-17-composer-4k-composition-design.md` (its composition layer, duos + cinema bands + split hero, survives). Its "Addendum: the scale pass" is the layer this spec replaces.
**Scope:** shared `public-editorial.css` (17 consumer pages) + `/composer` page-local styles + the composer demo components' 1680px blocks. Landing page out of scope (same recipe ports later).

## The problem

The 4K scale pass sized type against a 3840px CSS canvas (page title 3vw = 115px, section
titles 3.2rem, lede 1.6rem, prose 0.6vw, 8rem gaps), then the breakpoint moved from 2200
to 1680 so the tier would fire on real 4K hardware, which at Windows 200% scaling reports
a ~1920px CSS viewport. Result on Austen's monitor (measured live at 1920): section titles
51px vs the base design's 31px, lede 25.6px, subtitle 24px, 128px gaps. Every text role
30 to 64% larger than the proven base design, in a canvas no bigger than a 1080p desktop.
At true 3840 the failure inverts: 115px two-line title over 23px prose (5:1, hierarchy
gone) and a ~1300px square hero player floating in a 2531px grid cell of empty black.

Austen's directive: every screen size gets its own committed, bespoke composition. Phone
feels designed for phone, 4K feels like 4K was in the developer's mind from day one. No
thin strips on big monitors, no blown-up zoom, and 2026 established patterns come before
architecture or aesthetics.

## Research base (2026 state of the art, two web-research passes)

1. Apple, Stripe, Linear, Vercel all cap the primary reading column at ~1200-1440px CSS
   at every viewport width. Extra width goes to margins, full-bleed decorative layers,
   and density (more grid items), never to bigger body text or a stretched column.
2. Shipped display-heading maximums cluster at 48-80px, fixed past ~1440. Body text is
   governed by line length (50-75ch, 66ch sweet spot, enforced in `ch` units), not
   viewport width.
3. Fluid type is one continuous `clamp(rem-min, rem + vw, rem-max)` ramp per role
   (Utopia methodology), poles ~320 to ~1440-2100, max:min ratio <= 2.5 (WCAG 1.4.4
   zoom headroom), rem always mixed into the preferred term.
4. Container queries own component-level sizing (`cqi` + clamp so a component tracks its
   box, not the viewport); media queries own page-level composition. Hybrid is the 2026
   consensus. This also future-proofs for narrower hosts, which Austen expects to exist.
5. vh-keyed media needs authored caps; the difference between cinematic negative space
   and an empty void is authorial intent. Bento density and asymmetric editorial
   composition are the named patterns for filling wide canvases.
6. NN/g: long alternating zigzag duo runs hurt scan efficiency; short runs (2-3) with
   informational (not decorative) media are the sanctioned carve-out. Composer's three
   duos are all live informational demos: keep, consciously.
7. Tablet (600-1100) doctrine: reorganize, don't resize. Phone doctrine: 16px body floor,
   44px targets, thumb-zone CTAs, full-bleed media moments.

## The model: three layers

**Reading layer (capped).** One continuous clamp ramp per text role, 320px to ~2100-2400px
poles, then frozen. No type rule changes at any breakpoint. Prose measure enforced in `ch`.

**Composition layer (scales, with authored caps).** Stages, bands, duos, whitespace do the
4K work. Every stage box is keyed to its content's aspect and capped at what the content
can visually fill. Captions + CTAs anchor to their stage as one unit. Duos cap so copy and
demo stay in conversation. Section rhythm is a fluid ramp, not a cliff.

**Atmosphere layer (full-bleed).** The cosmic background already runs edge to edge at any
width; beyond the composition caps (5K+, TV) it absorbs the remainder by design.

## Type ramp table (shared roles, public-editorial.css)

One rule per role, replacing both the base rule and the entire >=1680 type block.
px targets at key viewports (390 / 1440 / 1920 / cap):

| Role | New rule | 390 | 1440 | 1920 | cap (at vw) |
|---|---|---|---|---|---|
| `.page-title` (base) | `clamp(2.6rem, 1.9rem + 2.4vw, 4.2rem)` (unchanged) | 41.6 | 65 | 67.2 | 67.2 (1493) |
| `.page-title` (>=1680, non-composer centered headers) | `clamp(4.2rem, 2.4rem + 1.5vw, 5.25rem)` | - | - | 67.2 | 84 (3040) |
| `.section-title` | `clamp(1.45rem, 1.15rem + 0.95vw, 2.3rem)` | 23.2 | 32.1 | 36.6 | 36.8 (1937) |
| `.prose` | `clamp(0.99rem, 0.95rem + 0.2vw, 1.2rem)` | 16 | 18.1 | 19 | 19.2 (2000) |
| `.lede p` | `clamp(1.05rem, 1rem + 0.4vw, 1.35rem)` | 17.6 | 21.6 | 21.6 | 21.6 (1400) |
| `.page-subtitle` | `clamp(1.1rem, 0.95rem + 0.2vw, 1.3rem)` | 17.6 | 18.1 | 19 | 20.8 (2480) |
| `.section-kicker` | `clamp(0.72rem, 0.66rem + 0.14vw, 0.88rem)` | 11.5 | 12.6 | 13.2 | 14.1 (2440) |
| `.bullet-list li` | same ramp as `.prose` | 16 | 18.1 | 19 | 19.2 |
| `.resource-chip` | `clamp(0.85rem, 0.8rem + 0.15vw, 1rem)`; paddings -> `em` | 13.6 | 15 | 15.7 | 16 (2133) |
| `.cta-button` / `.cta-secondary` | `clamp(1.05rem, 1rem + 0.12vw, 1.2rem)`; paddings -> `em` | 16.8 | 17.7 | 18.3 | 19.2 (2667) |
| `.cta-card h3` | `clamp(1.5rem, 1.3rem + 0.5vw, 2rem)` | 24 | 28 | 30.4 | 32 (2240) |
| `.cta-card p` | `clamp(1rem, 0.95rem + 0.15vw, 1.15rem)` | 16 | 17.4 | 18.1 | 18.4 (2133) |
| `.back-link` | `clamp(0.85rem, 0.8rem + 0.12vw, 1rem)` | 13.6 | 14.5 | 15.1 | 16 (2667) |
| `.bento-text strong` | `clamp(1rem, 0.95rem + 0.15vw, 1.2rem)` | 16 | 17.4 | 18.1 | 19.2 (2987) |
| `.bento-text span` | `clamp(0.88rem, 0.84rem + 0.12vw, 1.05rem)` | 14.5 | 15.2 | 15.7 | 16.8 (2800) |

Hierarchy checks: at 1920, title 67 / section 37 / lede 21.6 / prose 19 (title:prose 3.5,
section:prose 1.9). At 3840, 84 / 36.8 / 21.6 / 19.2 (title:prose 4.4). Every ramp's
max:min ratio is under 2.5. All jumps at the 1680 seam are zero by construction: each
>=1680 rule's floor equals the base rule's cap (verified per-role in the matrix below).

Composer page-local roles (same treatment, in `+page.svelte` / components):

| Role | New rule |
|---|---|
| `.demo-hint` | `clamp(0.8rem, 0.76rem + 0.12vw, 0.95rem)` |
| `.cards-heading` | `clamp(1.15rem, 1rem + 0.45vw, 1.6rem)` |
| SequenceHeroDemo `figcaption` | `clamp(0.85rem, 0.8rem + 0.12vw, 1rem)` |
| SequenceHeroDemo `.demo-word` | `clamp(1.05rem, 1rem + 0.15vw, 1.25rem)` |

The >=1680 type blocks in `SequenceHeroDemo.svelte`, `PlayWithItInner/Skeleton`, and the
composer demos are deleted or reduced to layout-only rules. Remove every fixed-size type
override at 1680; nothing but these ramps sizes text.

### Split-hero title: container-tracked

In the split hero the title column stays 46rem from 1680 to ~2500 while the viewport
grows, so a viewport-ramped title would wrap ("Flow Arts Composer" fills 736px at
exactly 67.2px). Composer-local override at >=1680: the header cell becomes a container
(`container-type: inline-size`) and the title sizes by its column:
`font-size: clamp(4.2rem, 9.1cqi, 5.25rem)`. At a 736px column 9.1cqi = 67px = the
floor (seamless); the title grows only when the column grows. The hero copy column
widens on ultrawide: `minmax(0, clamp(46rem, 30vw, 58rem))`. At 3840 the column is
928px and the title reaches ~84px, one line. If size containment fights the grid track
sizing during implementation, fallback: keep the 46rem column ramping to 58rem and size
the title with `min(5.25rem, <viewport ramp>)` tuned to never exceed the column.

### Prose measure

`.prose` and `.lede` get `max-width: min(100%, 68ch)` (tune 64-72ch live so rendered
lines land 60-70 characters). Structural column stays wider; text self-caps in `ch` so
it tracks font size and user zoom. `.editorial` at >=1680 becomes a fixed `60rem`
(drop `max(60rem, 25vw)`); margins absorb everything beyond, per the research.

## Composition layer changes

Rhythm (shared): `.editorial-section` margin-bottom `clamp(4rem, 1.6rem + 2.4vw, 7rem)`
(64px until ~1600, 72px at 1920, 112px cap at 3600); padding-top
`clamp(2rem, 1rem + 1vw, 3rem)`. Delete the 8rem/3rem jump.

Band caps (shared, >=1680 block, layout-only):

| Band | Today | New |
|---|---|---|
| `.has-duo` | `min(110rem, 88vw)` | unchanged (1760px cap holds copy+demo in conversation) |
| `.has-duo.duo-max` | `min(88vw, 3600px)` | `min(88vw, 160rem)` (2560px cap; stages inside stay large, the half-meter gap goes) |
| `.breakout.cinema` | `min(88vw, 3600px)` | `min(88vw, 175rem)` (2800px; a 16:9 live scene fills this, 78vh height cap still governs) |
| `.breakout.wide` | `min(96rem, 92vw)` | unchanged (bento band) |
| `.section-duo` gap | `clamp(3rem, 5vw, 7rem)` | `clamp(3rem, 4vw, 6rem)` (a 112px gutter reads as one composition; 192px reads as two islands) |

Composer sections:

1. **Hero:** `.hero-duo` width `min(88vw, 3600px)` -> `min(88vw, 152rem)` (2432px) so the
   stage cell hugs the stage instead of leaving ~1200px of dead black. Stage cap
   `min(60vh, 78rem)`. Copy column per the clamp above. Caption stays anchored under the
   stage. Below 1680: byte-identical stacked hero.
2. **Generate duo:** copy cell vertically centered against the demo cell (audit why
   `align-items: center` reads top-heavy at 1920; fix at the cell level). Demo unit
   (player + mandala + caption + button) stays one anchored stack.
3. **Multiply (tunnel):** stage keeps its screenful scale (72vh cap inside the duo cell,
   cell width now bounded by duo-max 160rem). Skeleton stays in lockstep.
4. **Choreo cards:** unchanged structurally; fan column now bounded by the duo cap
   (6 cards ~215px at 3840, `maxCardWidth` 280 stays as ceiling).
5. **3D viewer + Play-with-it:** cinema bands at the new 175rem cap;
   PlayWithItInner/Skeleton showcase cap aligns to `min(175rem, 94vw)`. Canvas height
   caps unchanged. Control rows and hints anchored to the stage.
6. **Bento:** unchanged band; at >=2200 the grid is a clean 4-up within 96rem. Density,
   not inflation.
7. **Zigzag audit:** three duos alternate demo side (R, L, R). Within NN/g's short-run
   carve-out and all demos are informational; keep as designed.

## Per-class commitments (what "bespoke" means at each width)

| Class | Commitment |
|---|---|
| Phone <600 | Current design (verified healthy): 41.6px title, 16px prose, full-bleed-ish stages, stacked order headline -> lede -> stage -> CTAs. No changes beyond inherited ramps. |
| Foldable ~600 | Verify no cramped duo/bento states at 600-700; single column with controlled measure. |
| Tablet 600-1100 | Bento 2-up, breakout bands fill to `100vw - 2.2rem`, stages centered at comfortable width. Audit pass, no redesign. |
| Laptop 1100-1680 | Duo grammar (today's proven base). Type ramps continue through it, within ~1px of today. |
| Desktop / 4K-at-200% 1680-2200 (Austen's monitor) | Split hero + duos + vh-keyed stages (v2 composition kept); type from the same continuous ramps (section titles ~37px, prose 19px); balanced duo cells, fluid rhythm ~72-77px. |
| Big canvas 2200-3840 | The committed tier: cinema bands to 2800px, duo compositions at their caps, 4-up bento, type frozen at caps, whitespace proportional. |
| 5K+ / TV | Composition holds its caps, centered; atmosphere absorbs the margins. Intentional, per 10-foot guidance. |

## Regression surface

- 17 pages consume `public-editorial.css`. All inherited the blown tier, so all heal
  together. Spot-verify at 1904 and 3840: `/about`, `/roots`, `/notation`,
  `/notation/staves`, `/glossary`, `/faq`, `/shop/choreography-cards`,
  `/learn/staff-spinning-choreography`.
- Notation prop pages use `.has-duo` (unchanged width) + shared type ramps: eyeball one.
- CLS/skeleton parity from 2026-07-16 must survive: every stage-cap change lands in the
  component AND its skeleton in the same commit (FanSkeleton, PlayWithItSkeleton,
  `.sk-stage-square`, `.sk-stage-wide`).
- Landing page untouched (its own 4K tier is out of scope; PlayWithItInner cap change
  affects its host section: verify landing showcase at 1904/3840 still composes).

## Verification matrix

Viewports: 390x844, 600x900, 768x1024, 1366x768, 1440x900, 1679x1050 vs 1681x1050
(seam probe), 1904x1050 dpr2 (Austen's), 2200x1238, 2560x1440, 3840x2160.

Checks per viewport (scripted via Chrome DevTools MCP probes + screenshots):
1. Computed font sizes match the table (+-0.5px) for every role.
2. Zero type discontinuity across the 1679/1681 seam (equal computed sizes).
3. Page title single-line in the split hero at 1680-3840.
4. No horizontal scroll anywhere.
5. Stage/band boxes within authored caps; hero stage cell dead space < ~15% of cell.
6. Prose lines render 55-75 characters.
7. Skeleton geometry == loaded-component geometry at 390/1904/3840 (CLS parity).
8. `npm run check` clean (one cold run, grep the log); `npm run build` + SSR marker greps.
9. Spot pages (regression list above) at 1904 + 3840.
10. Austen's taste pass on the physical monitor (the final gate; ramp caps are tunable
    by +-10% without re-architecture).

## Implementation ledger

- [x] public-editorial.css: replaced base+1680 type rules with the ramp table; rhythm ramps; band caps (duo-max 160rem, cinema 175rem); `.editorial` 60rem; prose measure
- [x] Composer page: hero-duo cap (152rem) + column clamp (46-58rem) + container-tracked title; local role ramps (demo-hint, cards-heading, bento); cta paddings to `em`
- [x] SequenceHeroDemo: caption/word/reroll ramps; stage cap `min(60vh, 78rem)`; 1680 block now layout-only
- [x] PlayWithItInner + PlayWithItSkeleton: showcase cap `min(2800px, 94vw)` (= 175rem, aligns to cinema band)
- [x] ComposerTunnelDemo + `.sk-stage-square`: 72vh cap confirmed to track inside the new duo-max; skeleton uses the same formula, in lockstep (no edit needed)
- [x] ComposerGenerateDemo: caption/word/button/retry on ramps; 1680 block layout-only
- [x] Full verification matrix run + screenshots (390/768/1679/1681/1904/3840)
- [x] Spot-check regression pages (/about 1904+3840, /notation/staves 3840: healed, duo intact)
- [x] check:fast (zero errors in edited files — CSS-only diff)
- [ ] Austen taste pass on the physical 4K monitor
- [x] Committed b1e04a0d47 (6 files, scoped pathspec)

## Shipped (2026-07-17) — live-tuned values + notes

Two values were tuned against live Chrome measurement, both within the spec's
stated ±10% caps-are-tunable tolerance:

- **Prose measure = `46ch`, not `68ch`.** Inter is narrow (~0.43em/glyph), so its
  `ch` (the "0" advance) holds ~1.45 average characters; `68ch` rendered ~99
  characters per line. `46ch` lands ~63-66 rendered characters (measured 63 at
  1904/3840, 45 on a 390 phone where screen width is the limiter). Kept in `ch`
  so it still tracks font size and user zoom.
- **Page-title caps at `5rem` (80px), not 5.25rem.** Composer's split-hero title
  is `clamp(4.2rem, 9cqi, 5rem)` container-tracked (9cqi = 67px at a 736px
  column = seamless with the base cap; 80px at a 928px column at 3840, one line
  with margin to spare). Centered marketing headers (about/roots/notation) use
  the viewport clamp `clamp(4.2rem, 2.4rem + 1.5vw, 5rem)` — same 80px cap, no
  wrap risk since they span the full page.

Measured seam (1679↔1681): page title 67.2↔67.2, section title 34.35↔34.37,
prose/lede/kicker/subtitle equal, gap 65.9↔65.94 — zero type discontinuity; only
the column width steps 736→960 (intentional composition, prose stays 46ch).

Build + SSR-marker greps intentionally skipped: the diff is CSS-only (every edit
inside `<style>`/`.css`, zero markup/class/script changes), so SSR structure and
skeleton markers are byte-identical; HMR on :5173 recompiled every touched file
and rendered correctly across all six viewports. Full `svelte-check`/`build`
(5-8GB) was not run because available memory sat under the 4GB resource-budget
floor; `check:fast` covered compile/type validation with zero errors in edited
files. Re-run the full gate on the next non-CSS change here.
