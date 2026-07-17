# /composer 4K Composition — Design Spec

**Date:** 2026-07-17
**Status:** Implemented 2026-07-17 (direction approved in-session); awaiting Austen's taste pass on a real 4K monitor
**Direction (chosen in brainstorm):** Hybrid duo + cinema, upgraded at the editorial-system level
**Prereq:** Builds on the uncommitted CLS/skeleton work (LazyMount placeholders, FanSkeleton, PlayWithItSkeleton) already on this branch.

## Diagnosis

At 3840px, /composer renders 960px of content (25% of the viewport). The composition
never changes with width: single stacked column, prose above demo, breakouts capped
at 66rem (1056px). The shared editorial CSS's ≥2200px block only inflates type and
widens the essay measure. The page is a mobile layout scaled up.

The codebase already owns both fixes:

- `.has-duo` (public-editorial.css) puts prose BESIDE the demo from 1100px up,
  section widening to `min(76rem, 92vw)`. Used by the four notation prop pages.
  /composer, the most demo-heavy page on the site, uses it zero times.
- The landing's ≥2200px scale-up pattern (`HowTkaWorksSection`: `max(1960px, 51vw)`)
  keeps sections claiming real estate fluidly past 4K.

## System changes (public-editorial.css)

These are shared-CSS additions; every editorial page can adopt them.

1. **`.breakout` moves from composer-local CSS into public-editorial.css** as the
   shared visual-band primitive. Same rule as today:
   `--breakout-width: min(66rem, calc(100vw - 2.2rem))`, centered via margin-inline.
   Composer's local copy is deleted; behavior identical below 2200px.

2. **New `.breakout.cinema` modifier** — the full-stage band. Identical to
   `.breakout` below 2200px. At ≥2200px:
   `--breakout-width: min(max(66rem, 50vw), 1960px)` → 1920px at 3840, capped at
   1960 on 5K+ (matches HowTkaWorks's ceiling).

3. **New `.breakout.wide` modifier** — the moderate band for content that wants
   more room but not a full stage. At ≥2200px: `--breakout-width: min(80rem, 92vw)`
   (1280px). Below 2200px: identical to `.breakout`.

4. **`.has-duo` gains a ≥2200px step**: `width: min(110rem, 88vw)` (1760px at
   3840), `gap: clamp(3rem, 5vw, 7rem)`. Below 2200px: unchanged, so the four
   notation pages only ever gain width on 4K monitors.

5. **New `.has-duo.duo-uw` modifier** — duo that engages ONLY at ≥2200px and
   stays a stacked column below. For sections (like Generate) whose demo would be
   cramped by a 1100px duo but shines beside prose at 4K widths.

## /composer section-by-section

| Section | Today | New |
|---|---|---|
| Hero (SequenceHeroDemo) | square capped 26rem always | ≥2200px: cap raised to 34rem (inside the shared component, same pattern as its existing clamps) |
| Construct (prose only) | 46→60rem column | unchanged |
| **Generate** | stacked, breakout 66rem, two 1:1 stages ~510px each | `.has-duo.duo-uw` + `flip`: below 2200px identical to today; at ≥2200px prose (46rem) sits left, demo right (~60rem → stages ~460px each, caption + button under them) |
| **Multiply (tunnel)** | stacked, square stage capped 30rem | standard `.has-duo` from 1100px, demo left / prose right (flip). Stage cap 30rem below 2200px (fits the duo column), 40rem at ≥2200px |
| Learn / Choreo Cards | fan capped 40rem (5 cards @ ~142px) | standard `.has-duo`: copy+CTAs beside the fan from 1100px. Fan max-width removed inside the duo column; at ≥2200px the column reaches ~60rem → **6 cards @ ~179px** (fit math: n=6 needs boxW ≥ 686px; 210px max card needs 1124px) |
| **3D viewer** | breakout 66rem → 1056×594 stage | `.breakout.cinema` → **1920×1080 stage at 3840** (16:9 fills the band; control rows stay centered at 30rem) |
| Features bento | 3-across at 66rem | `.breakout.wide` → 1280px at ≥2200px = clean 4×2 grid (auto-fit does it; no grid changes) |
| Roadmap / Foundation | prose column | unchanged |
| **Play with it** | slot breakout 66rem; Inner showcase caps at min(1600px, 94vw) | slot becomes `.breakout.cinema`; Inner's showcase cap (and PlayWithItSkeleton's) raised to `min(1960px, 94vw)` at ≥2200px. Canvas height already capped at min(1100px, 70vh), so 2160px-tall screens are safe |
| CTA card | 60rem column | unchanged |

Alternating rhythm at 4K, top to bottom: centered hero → duo (prose|demo) →
duo flipped (demo|prose) → duo (copy|fan) → cinema stage → wide bento →
prose → prose → cinema stage → centered CTA.

## Skeleton / CLS parity (must ship in the same change)

Every geometry change above has a skeleton that must mirror it, by construction:

- **FanSkeleton**: add the n=6 container-query band (threshold 686.25px, card
  width as cqw for the 6-card fit: `boxW/5.355`) plus the 210px max-card ceiling
  band. Tilt/nth-child rules extended to 6 cards.
- **Tunnel placeholder** (`.sk-stage-square`): cap follows the 30rem→40rem step
  at ≥2200px; the sk-pill stays 22rem.
- **3D placeholder**: no change needed (16:9 + fixed pills track the band width).
- **PlayWithItSkeleton**: showcase cap gets the same ≥2200px `min(1960px, 94vw)`
  step as PlayWithItInner.
- **Duo wrappers**: placeholders render inside the same `.duo-demo` cell as the
  loaded component, so the swap stays pixel-identical at every width.

## Regression surface

- Notation prop pages (staves/fans/clubs/buugeng): gain the wider duo at ≥2200px
  only. Eyeball each at 3840 and 1920.
- /about, /roots, /support, /glossary: consume public-editorial.css but none use
  `.breakout`/`.has-duo` modifiers being added — additive classes, no behavior
  change. Verify with a grep + spot-check.
- Landing: untouched except PlayWithItInner/Skeleton cap step (landing host
  benefits identically; its section already allows 1600px).
- CLS work from 2026-07-16 must survive: re-verify SSR skeleton markers and
  skeleton parity at 1280 / 1920 / 2560 / 3840.

## Verification plan

1. `npm run check` (one cold run, grep the log).
2. `npm run build` + SSR curl greps: skeleton markers still present; duo/cinema
   classes present in prerendered HTML.
3. Chrome DevTools MCP (with Austen's go-ahead): `resize_page` to 3840×2160,
   screenshot each section; repeat at 1920×1080 to prove no sub-4K regression;
   layout-shift trace on load.
4. Austen's eyes on the real monitor for the taste call.

## Implementation ledger

- [x] public-editorial.css: move `.breakout` in; add `.cinema`, `.wide`, duo ≥2200 step, `.duo-uw`, `.demo-star`
- [x] Composer page: section wrappers reclassed (duo/flip/duo-uw/cinema/wide), local `.breakout` CSS removed
- [x] Generate section duo-uw markup (copy cell / demo cell)
- [x] Tunnel section duo + 40rem stage step (component + placeholder)
- [x] Cards section duo (demo-star: fan right, 6fr) + fan uncapped in duo column from 1100px
- [x] FanSkeleton n=6 band (686.25px) + 210px max-card ceiling band (1124.55px)
- [x] 3D + PlayWithIt slots → `.breakout.cinema`
- [x] PlayWithItInner + PlayWithItSkeleton ≥2200 cap step (min(1960px, 94vw))
- [x] SequenceHeroDemo ≥2200 cap step (34rem)
- [x] Bento slot → `.breakout.wide`
- [x] check (0 errors, 0 warnings) + SSR greps (duo/cinema/skeleton markers in prerendered HTML)
- [x] Chrome verification: 3840×2160 emulated (hero 544, gen duo 687/961, tunnel stage 638,
      fan col 899 @ 6 cards ×168px, cinema bands 1920, bento 4-across, no h-scroll) +
      1924 real window (all sub-2200 geometry unchanged) + 390 phone (stack order + widths hold)
- [ ] Austen's taste pass on the physical 4K monitor

## Addendum: the scale pass (same day)

Austen's verdict on v1: "not nearly what I was hoping." Diagnosis on screenshots:
the layout moved but the SCALE didn't — 471-638px stages and 38px titles on a
3840px screen still read as a laptop page with air around it. Fix: everything
keyed to the viewport, not rem.

- Stages height-keyed: tunnel 72vh (1553px), 3D stage capped 78vh (2993x1683),
  Play-with-it canvas 72vh (panel 440px, showcase cap 2600), hero 52vh
  (column-capped at 912px), Generate stages ~940px each.
- Composer duos get `.duo-max` (88vw, cap 3600px); generic `.has-duo` keeps
  110rem so notation pages don't inflate. `.cinema` now 88vw; `.wide` 96rem.
- Type: page title 3vw (115px @ 3840), section titles 3.2rem, kicker 0.95rem,
  prose 0.6vw, lede 1.6rem; component captions/buttons step at 2200 too.
- Cards: maxCardWidth 210 -> 280 (FanSkeleton ceiling band 1499.4px).
- Rhythm: section margin 8rem + padding-top 3rem at 2200.
- CSS gotcha fixed twice: an @media (min-width: 2200px) block adds NO
  specificity — it must sit AFTER the base rules it overrides or the base
  wins by source order (bit PlayWithIt panel/canvas, hero captions, page
  demo-hint/cards-heading).

Verified: svelte-check 0/0; 3840 emulation (numbers below); 1920 unchanged
from v1 (hero 416, tunnel 478, fan 621/138, 3D 1054, margins 64px).

| 3840 v2 | hero 912; gen stages 939; tunnel 1553; fan col 1782, cards 280;
3D 2993x1683; showcase 2598; title 115px; section titles 51px; prose 23px |

## Measured results (2026-07-17, Chrome emulation, v1 layout pass)

| Width | Result |
|---|---|
| 3840 | Generate duo 687/961 (stages 471px each); tunnel demo col 899 (stage 638); cards copy 749 / fan 899 (6 cards @168px); cinema bands 1920; bento 4×2; showcase 1918 |
| 1924 | duo-uw stacked at 1056 (= old breakout); tunnel duo 621/518; fan 621 (5 cards); 3D stage 1054; bento 3-across |
| 390 | duo-uw 355 (= old breakout); duo sections 359 (92vw, +4px vs old); stack order preserved |
