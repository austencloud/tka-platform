# /notation/caps 4K Density Correction: One Spine, Constant Modules, Smooth Curves

**Date:** 2026-08-02
**Status:** PROPOSED governing correction. Authored by Claude Fable 5 at Austen's request
after his 4K review of the shipped 2026-08-01 implementation. Ready for Codex
implementation planning. **Awaiting Austen's explicit approval before any implementation.**
**Route:** `/notation/caps`
**Relationship to prior spec:** partially supersedes
`docs/superpowers/specs/2026-08-01-notation-caps-exhibit-redesign.md`. Section 14 of this
document lists exactly which parts of that spec are replaced and which remain in force.

---

## 1. What happened, in one paragraph

The 2026-08-01 redesign shipped with correct structure (atlas, focused construction,
fixed grids, clean attribution) and a wrong scale model. It read the 4K rule's
"fill the canvas" as permission to let every module inherit the width of a fluid
2,253 to 2,600px band while the root ramp, viewport-unit clamps, and square
aspect-ratio boxes multiplied on top. The result at Austen's desk: a page 12,061px
tall where single sections fill whole screens, related text sits 1,300 to 2,200px
apart, body lines run 165+ characters, and the three most important plots on the
page render as wobbling, faceted polylines because a byte-thrift setting quantized
their coordinates to a grid that is 1.6px wide at the size they actually display.
Austen's verdict is the design brief: massive and overwhelming, eyes travel too far,
blown up rather than composed, and the assembled curves look pencil-drawn.
This spec is the correction, not a defense. The prior spec's section 6 was my design
and it is the thing being corrected.

---

## 2. Evidence-led diagnosis

All numbers below were measured on 2026-08-02 against the running dev build with
Chrome DevTools device emulation (dpr 1), plus direct inspection of the committed
generated SVGs. Austen's three screenshots (4K desktop captures of the atlas,
credits/relationship sections, and a close crop of the three assembled plots) show
the same state.

### 2.1 What "4K" actually means here (three different numbers)

| Physical setup | CSS viewport | Root font (ramp) | What the page currently does |
|---|---|---|---|
| 4K panel, Windows 200% | 1920×1080 | 16.9px | Band 1720px. Page 9,886px tall (9.2 viewports) |
| 4K panel, Windows 150% (**Austen's desk**) | 2560×1440 | 19.3px | Band 2,253px. Page 12,061px tall (8.4 viewports) |
| 4K panel, Windows 100% / TV | 3840×2160 | 24.0px | Band 2,600px centered. Page 14,896px tall (6.9 viewports) |

The screenshots resolve to the 150% case: measured element widths in the captures
match the 2560-CSS layout at 1.5 device pixels per CSS pixel. **The primary 4K
canvas for this page is 2560×1440 CSS**, where the OS is already scaling by 1.5.
`4k-native-layout.md` centers the 200% case ("the most common one") and the 100%
case; the 150% middle tier is where this page is actually lived in, and it is the
tier where the current design over-scales worst, because the root ramp has already
added 20% on top of an OS that already added 50%.

**Definition this spec works to:** 4K-native means the composition at 2560 and 3840
holds every module at its comfortable reading size (the size it has around the 1680
seam, times the root ramp only) and spends all remaining width on adjacency: more
things beside each other, shorter trips between related things. It never means the
1680 composition photographed larger. "Blown up" is precisely the photographed-larger
failure.

### 2.2 Compound scaling: five multipliers stacked

Between the 1680 seam and Austen's 2560 desk, the same markup is scaled by all of
these at once:

1. **Root ramp** (`src/app.css`, scoped via `.mkt-shell`): 16px → 19.3px at 2560,
   24px at 3840. Every rem measure inflates by ×1.21 / ×1.50. This is the intended,
   sanctioned scale authority.
2. **Band growth** (`--shell-w` 88vw between floor and ceiling): 1720 → 2,253 →
   2,600px. ×1.31 / ×1.51. Also intended, but it feeds directly into module size
   because of items 3 and 4.
3. **Fixed column counts over fluid tracks:** `.elementary-grid` 4-up and
   `.assembly-grid` 3-up divide whatever the band provides. Track width rides the
   band: elementary cards 402 → 529 → 608px; assembly cards 543 → 714 → 822px.
4. **Width-driven square modules:** `.plot { aspect-ratio: 1 }` fills the track, so
   band width sets module *height*: assembly plots 499 → 665 → 760px square. The
   construction stage does the same with `inline-size: min(100%, 72dvh, 1040px)`:
   778 → 1,037 → 1,040px square. Height inflation is what makes sections fill whole
   screens.
5. **Viewport/container-unit clamp terms still growing above the seam:** dozens of
   `clamp(..., Xvw/Xcqi, ...)` terms (section gaps to 6rem, atlas group gap to
   4.5rem, `.editorial-section` margin `clamp(4rem, 1.6rem + 2.4vw, 7rem)` = 92px at
   2560, the what-is demo `min-height: clamp(24rem, 46vw, 42rem)` = 809px). These
   add growth *on top of* the ramped rem caps they sit inside.

Measured net effect at Austen's desk versus a standard 2026 content site at the same
150% scaling: body prose renders at 23.1px (cap 1.2rem × ramped root; standard is
16 to 18px), section titles at 44.3px, group subtitles at 36.8px, and a single
"atlas + construction" section is 3,659px tall (2.5 viewports). At 3840 the same
numbers are 28.8px prose, 55.2px titles, section 4,165px. Everything is large, so
nothing is prominent; that is the "massive and overwhelming" report, mechanized.

### 2.3 Scan distance: where the eyes are sent

Measured at 2560 (worse at 3840):

- **Atlas section header** (`.math-heading`, two columns 0.72fr/1.28fr, gap to
  6rem): title block at x=177 w=749; intro prose at x=1,042 w=1,331. Reading the
  header means a 2,196px round trip, and the intro that explains the section sits
  865px right of the title's left edge.
- **Group headings** (`.group-heading`, title left, caption right, `align-items:
  end`): "One equation, one uninterrupted curve" starts at x=177; its caption
  "Rosettes share equal radii..." starts at x=1,506. The sentence that interprets
  the grid is 1,329px away from the title it belongs to, right-aligned into empty
  sky (screenshot 1 shows exactly this).
- **Chronology** (`#origin`, year rail + text at ≥105rem): entry text column is
  1,945px wide at 2560 and 2,216px at 3840: 165 to 185 characters per line at 23 to
  29px type. Long-line re-acquisition failure on every wrapped line.
- **CAPs/LOOPs comparison** (`.relationship-grid`, two 1fr cards): each card
  1,085px wide (1,248px at 3840) holding ~40 words. Comparing the two definitions,
  which is the entire point of the section, is a ~1,100px saccade between two
  sparse boxes (screenshot 3).
- **Credits:** Damien primary card 735px wide beside a 2×2 support grid ending at
  x≈2,430; the "Also in the room" footnote hangs below the full spread. The section
  reads as five islands (screenshot 3).
- **Focused construction header:** title cluster left, notation pill flushed right
  by `justify-content: space-between` across the full panel (~2,200px at 2560), so
  the notation the title refers to sits at the far end of the panel.

The common defect: **claim and evidence never share a column.** Headers split into
two far columns; captions right-align to the band edge; comparisons stretch to
half-band cards. Every section invents its own header geometry, so the eye
re-learns the page at every scroll stop.

### 2.4 Page mass

12,061px at 2560×1440 is 8.4 screens of content for what is, by word count, about
two screens of prose plus seven small plots, one interactive model, six videos, and
six source cards. Section heights at 2560: hub 1,376 + what-is 1,317 + math 3,659 +
origin 720 + credits 709 + relationship 472 + watch 1,243 + sources 706, plus
~92px margins between each. Nothing except the construction panel earns a full
viewport; currently the atlas grids alone consume ~1.9 viewports.

### 2.5 The rough curves: measured cause, and no, it was not intentional

The three assembled plots (and the four elementary ones, less visibly) are rough for
three compounding, quantified reasons in
`scripts/generate-caps-trochoids.mjs`:

1. **Coordinate quantization at display scale.** Atlas SVGs are emitted with
   `precision 2` into a model-unit viewBox of ~4.2 units
   (`viewBox="-2.10 -1.38 4.20 4.20"` in the committed `_generated/yuta-cap.svg`).
   The rounding grid is 0.01 units = **1/420 of the drawing**. At the measured
   render sizes (665px plots at 2560, 760px at 3840) every vertex snaps to a
   1.58 to 1.81px grid. The stroke is 0.067 units ≈ 10.6px, so vertices wander by
   up to ~15% of the stroke width, decorrelated every few pixels along the path.
   That is the pencil wobble. It is visible directly in the path data:
   `L1.75 0.02 L1.75 0.05 L1.75 0.07` is a staircase.
2. **Uniform-parameter polyline sampling.** `ATLAS_SAMPLES_PER_TURN = 64`,
   `ATLAS_MIN_SAMPLES = 220` produce line segments every ~4 to 6 rendered px.
   Between quantized vertices the renderer draws straight chords, so high-curvature
   regions (antispin lobes, cusp approaches) show angular corners on top of the
   wobble. Cusped and tightly-lobed trochoids are exactly the curves where uniform
   parameter sampling is least adequate.
3. **UI enlargement of a thrift asset.** The atlas files were optimized as small
   thumbnails and then rendered as the page's primary 500 to 760px exhibits, which
   magnifies 1 and 2. (SVG is vector; there is no raster blur. The damage is baked
   into the geometry.)

**Was it intentional?** No. It is a payload-budget artifact of the 15KB-per-file /
120KB-total inline budget in the prior spec. The proof it was over-thrift: the
seven committed atlas files total **37.3KB (3.7 to 6.4KB each)**, a third of the
budget. Even precision 3 would have fit. The proof the mathematics is fine: the
`static/caps/` public set, emitted at precision 4 with 1,500+ points, is smooth,
and the live construction stage (480+ samples projected onto a 700-unit viewBox at
precision 2, an effective grid of 1/70,000) is smooth. Only the atlas serialization
path is broken.

### 2.6 Where the standing rules pushed the wrong way

Austen's direct feedback outranks the rules. Three specific rule texts contributed
and get constrained (section 13):

- `.claude/rules/4k-native-layout.md`, Rule 1 "Fill the canvas": "The content band
  grows with the viewport above its floor... Bands are fluid; only the *floor* is
  fixed." Nothing in the rule says modules must not grow with the band, and its
  framing ("dead rail... is the 'not at home' feeling") reads as a mandate to spend
  width on size. It also centers 4K@200% and 4K@100%, while the desk this page is
  reviewed on runs 150%.
- `src/lib/shared/landing/styles/public-editorial.css` `.prose p`: "No
  reading-measure cap: prose spans the same width as the content around it." Correct
  ban on mismatched narrow text ribbons; wrong result when "the content around it"
  is a 2,216px open band (the chronology). The fix is to make the *container* the
  right width through composition, which honors the ban's intent.
- `docs/superpowers/specs/2026-08-01-notation-caps-exhibit-redesign.md` section 6:
  "Composition from the 1680 tier holds; nothing here recomposes" above 2600. That
  sentence is the miss: at 2560+ this page needed recomposition (adjacency), not a
  held 1680 composition on wider tracks.

---

## 3. Target experience (the whole brief, five sentences)

Arriving at any section of `/notation/caps` at 2560 or 3840, the section's title,
its one-breath explanation, and its exhibit are one visual cluster entered at the
left rail and finished without a cross-screen saccade. All seven atlas curves and
their labels are comparable in a single glance-row band under 500px tall per group,
drawn with strokes as smooth as the construction stage. The page reads top to bottom
as one spine: every section starts at the same rail line, so scanning is vertical
and predictable, and the whole page is under six screens at Austen's desk. Type and
modules sit at standard 2026 content-site scale times the root ramp only; extra
width becomes calm margin at the zone's right edge, never bigger modules. Nothing
needs a second pass to find; nothing needs a step back to take in.

---

## 4. The layout model: one spine (label rail + exhibit zone)

One pattern, applied to every editorial section on this page, replacing the three
competing header geometries.

### 4.1 Structure

At wide container widths each section is a two-column grid:

```
[ rail: kicker, h2 title, intro/caption prose, section-level note ]  [ zone: the exhibit ]
```

- **Rail:** `minmax(0, 24rem)` fixed-cap column. Holds ALL of the section's framing
  text: kicker, `h2`, the intro paragraph(s), and the section's footnote where one
  exists (Ferréol credit, relationship note, media footnote, credit footnote).
  Text in the rail wraps at ~55 to 60 characters. Title and explanation share a left
  edge, zero horizontal offset, with the explanation starting within 2rem below the
  title.
- **Zone:** `minmax(0, 1fr)`. Holds the exhibit: grids, construction panel, cards.
  All zone grids are fixed-count with **capped tracks, left-packed**:
  `repeat(N, minmax(0, CAPrem)); justify-content: start;` so surplus width becomes
  right-edge whitespace instead of module growth.
- **Column gap** 4rem; when stacked, row gap 2rem.
- **Activation:** container query on the page band (`.caps-editorial` becomes a
  size container): spine active at **container ≥ 1600px** (px, deliberately not rem;
  see 6.5). Below 1600px the rail stacks above the zone, single column, and every
  in-rail element keeps its order (kicker, title, intro, note, then exhibit).

Sections using the spine: `#math`, `#origin`, `#credits`, `#relationship`,
`#watch`, `#sources`. `#what-is` keeps its existing `.section-duo demo-star` two-pane
(it already is a copy-beside-exhibit cluster) with one sizing fix (5.6). The CTA
section is unchanged.

The spine is implemented with page-scoped styles in `+page.svelte` (a shared
route-local class such as `.section-spine`), per the styling guide's
share-tokens-not-layout-classes rule. `public-editorial.css` is not modified.

### 4.2 Why this model

- It kills the measured scan defects at the root: claim and evidence share a column
  by construction (2.3).
- It satisfies "fill the canvas" structurally: at 2560 the band stays 2,253px wide
  and every pixel is assigned (rail 463 + gap 77 + zone 1,713), while modules stay
  at reading scale. Width buys adjacency, not magnification.
- One geometry for every section produces the single left rail line down the page:
  the anti-overwhelm spine. Section starts become predictable; vertical scanning
  replaces roaming.

### 4.3 Zone compositions per section

- **`#math`:** rail = "The curve atlas" kicker, title, both existing intro
  paragraphs including the Ferréol credit (copy relocated verbatim, zero wording
  changes). Zone = elementary group, assembled group, then the focused construction
  panel, full zone width. Group headings inside the zone become single-column
  stacks (label, `h3`, caption directly beneath, max-width 46rem): the caption
  leaves the right edge and rejoins its title.
- **`#origin`:** rail = kicker + title. Zone = the four chronology entries as a
  **2×2 grid** (`repeat(2, minmax(0, 44rem))`), each entry a stack of `time`,
  `h3`, paragraph. 4 % 2 = 0, no orphans, lines ≤ ~72ch. The ≥105rem year-rail
  layout is deleted.
- **`#credits`:** rail = kicker + title + the "Also in the room at Burning Man
  2007..." footnote. Zone = Damien primary banner (internal two-column grid
  `minmax(0, 18rem) minmax(0, 42rem)`: name/alias left, contribution text + link
  chips right), then the four supporting contributors in **one row of four**
  (`repeat(4, minmax(0, 22rem))`; 2×2 at mid widths, one column narrow). All
  attribution constraints of the prior spec's section 9 carry forward unchanged:
  Damien by mononym with the "posting as Zaltymbunk and French_Saltimbanque"
  phrasing only; no surname; no Forest Stearns or Sterns anywhere on the caps
  surface; no Spin Science material or credit; no Transition Theory or Jordan
  Campbell relationship claims. Copy text is relocated, never rewritten.
- **`#relationship`:** rail = kicker + title + the "Both answer the desire..."
  note (the note now sits directly under the claim it qualifies). Zone = the two
  comparison cards side by side, `repeat(2, minmax(0, 34rem))`. Heading-to-heading
  comparison distance drops from ~1,100px to ~36rem (~700px at 2560), and the cards
  stop being 60% dead space.
- **`#watch`:** rail = kicker + title + media footnote. Zone = fixed 3×2 video grid
  (`repeat(3, minmax(0, 30rem))`), 2-up at mid, 1-up narrow. `SourceVideoCard`
  itself is untouched; track caps bound it.
- **`#sources`:** rail = kicker + title. Zone = `repeat(3, minmax(0, 30rem))`,
  6 items in 2 rows (6 % 3 = 0), 2-up at mid (6 % 2 = 0), 1-up narrow.

### 4.4 Atlas card anatomy (revised)

Card content and accessibility contract are unchanged (one button, one accessible
name, decorative inline SVG). Sizing changes:

- `.plot` is **rem-sized, not track-sized**: `block-size: 12rem` (elementary) /
  `16rem` (assembled), `aspect-ratio: 1`, horizontally centered in the card. Track
  width no longer sets module height anywhere in the atlas.
- Elementary grid: `repeat(4, minmax(0, 22rem))` at zone ≥ 1,100px; `repeat(2,
  minmax(0, 22rem))` at zone ≥ 620px; one column below. Assembled grid:
  `repeat(3, minmax(0, 30rem))` at zone ≥ 1,100px; one column below (preserves the
  prior spec's no-three-small-plots rule at 960×412).
- Card padding cap 1rem; label row unchanged in structure (name, count/source fact,
  notation code), name capped at 1.05rem.

### 4.5 Focused construction (revised sizing only)

Interaction contract, layers, transport, rail content, provenance behavior:
unchanged. Sizing:

- **Stage cap (binding):** `.stage-shell { inline-size: min(100%, 56dvh, 38rem); }`
  replacing `min(100%, 72dvh, 1040px)`. Measured targets: 605px at 1920×1080,
  732px at 2560×1440, 912px at 3840×2160, 504px at 1440×900, 231px at 960×412.
- **Header re-cluster:** the notation `<code>` pill leaves the far right
  (`space-between` across the panel) and sits in the title flow, `width:
  fit-content`, directly under the description. Header text block max-width 46rem.
  Title cap 2.2rem (was 3rem cqi cap).
- Panel and stage cqi padding terms re-capped per section 6 so nothing keeps
  growing above the seam.
- The construction panel spans the zone width (aligned left with the atlas grids),
  not the full band.

---

## 5. Measurable targets

All rem values resolve against the ramped root (16.9 / 19.3 / 24.0px at
1920 / 2560 / 3840). "Current" values are the 2026-08-02 measurements.

### 5.1 Page band and page mass

| Metric | Current (1920 / 2560 / 3840) | Target |
|---|---|---|
| Content band | 1720 / 2,253 / 2,600px (`--shell-w`, unchanged) | unchanged |
| Page scroll height | 9,886 / 12,061 / 14,896px | **≤ 7,800 / ≤ 8,800 / ≤ 10,800px** (≥ 25% cut at each) |
| `#math` section height | ~3,100 / 3,659 / 4,165px | ≤ 2,100 / **≤ 2,400** / ≤ 2,950px |
| Sections fully visible per 2560×1440 viewport (excluding hub, math) | ~1 | ≥ 2 |

### 5.2 Reading and scan spans

| Metric | Current at 2560 | Target (all widths) |
|---|---|---|
| Section title → its intro paragraph, horizontal offset of left edges | 865px (`#math`) | **0px** (same rail column) |
| Section title → intro, vertical gap | n/a (opposite columns) | ≤ 2rem |
| Group title → group caption offset | 1,329px right, right-aligned | 0px (stacked, max-width 46rem) |
| Widest paragraph content box on the page | 1,945px (chronology; 2,216 at 3840) | **≤ 52rem** (~1,000px at 2560), achieved by composition (grid columns/rails), never by a `max-width` on a bare `.prose p` |
| CAP card heading → LOOP card heading distance | ~1,100px | ≤ 38rem (~730px at 2560) |
| Construction title → notation pill | ~1,400px | in-flow, ≤ 4rem below title |

### 5.3 Modules

| Module | Current (1920 / 2560 / 3840) | Target |
|---|---|---|
| Elementary plot | 371 / 480 / 552px square (track-driven) | `12rem` square: 203 / 231 / 288px |
| Assembled plot | 499 / 665 / 760px square | `16rem` square: 270 / 308 / 384px |
| Elementary card track | 402 / 529 / 608px | ≤ 22rem: ≤ 372 / 425 / 528px |
| Assembled card track | 543 / 714 / 822px | ≤ 30rem: ≤ 507 / 579 / 720px |
| Construction stage | 778 / 1,037 / 1,040px | `min(100%, 56dvh, 38rem)`: 605 / 732 / 912px |
| What-is demo min-height | clamp(24rem, 46vw, 42rem) → 809px at 2560 | `clamp(22rem, 40dvh, 30rem)` → ~576px at 2560 |
| Relationship card | 823 / 1,085 / 1,248px | ≤ 34rem: ≤ 575 / 656 / 816px |
| Video card track | ~543 / 700+ / 822px | ≤ 30rem |

### 5.4 Typography (page-scoped overrides inside `.caps-editorial` only)

| Role | Current cap → rendered at 2560 / 3840 | Target cap → rendered at 2560 / 3840 |
|---|---|---|
| `.section-title` | 2.3rem → 44.3 / 55.2px | **2rem** → 38.5 / 48px |
| `.prose` body on this page | 1.2rem → 23.1 / 28.8px | **1.05rem** → 20.2 / 25.2px (line-height 1.6) |
| Atlas group `h3` | 2rem → 36.8 / 44px | 1.5rem → 28.9 / 36px |
| Construction `h3` | 3rem cqi cap | 2.2rem |
| Credit primary `h3` (Damien) | 3.6rem → ~67 / 82px | 2.6rem → 50 / 62px |
| Kickers, count facts, notation, footnotes | 0.75 to 0.88rem | unchanged |

Every clamp above must be **at its cap by 1680px viewport**; above the seam only
the root ramp moves these numbers. 12px user-visible floor unchanged.

### 5.5 Gaps and section rhythm (page-scoped)

| Token | Current | Target |
|---|---|---|
| `.editorial-section` bottom margin (this page) | clamp(4rem, 1.6rem+2.4vw, 7rem) → 92 / 130px | flat **4rem** → 77 / 96px |
| Section top padding (this page) | clamp(2rem, 1rem+1vw, 3rem) → 45 / 62px | flat 2rem → 39 / 48px |
| Atlas group gap | clamp(2.25rem, 4cqi, 4.5rem) → 87px | flat 2.5rem |
| Card grid gaps | clamp → up to 26px | flat 1.25rem |
| Spine rail/zone gap | n/a | 4rem column / 2rem stacked |
| Construction top margin | clamp(2.25rem, 4vw, 4.5rem) | flat 2.5rem |

---

## 6. Rules preventing double scaling (binding for this page, additive to the 4K rule)

1. **One scale authority above the seam.** The root ramp is the only thing that
   grows type or spacing above 1680px viewport. Every `clamp()` in the caps route
   must reach its cap at ≤ 1680px viewport width: no `vw`, `cqi`, `cqw`, or `vh`
   growth term may remain unsaturated above the seam. (Audit every clamp in
   `+page.svelte`, `CurveAtlas.svelte`, `FocusedConstruction.svelte`,
   `construction/*.svelte` against this rule; the offenders are enumerated in 2.2
   item 5 and 5.5.)
2. **No width-driven module heights.** An `aspect-ratio` box may not take its
   inline size from a fluid grid track or the band. Plot and stage boxes size from
   rem (with a `dvh` guard for short windows). This is the single rule that ends
   the "one section per screen" effect.
3. **Fixed counts, capped tracks, left-packed.** Zone grids are
   `repeat(N, minmax(0, CAPrem))` + `justify-content: start`. Surplus width beyond
   the caps becomes whitespace at the zone's right edge. Column-count changes are
   the only response to more width.
4. **dvh guards on tall modules.** Stage `56dvh`, what-is demo `40dvh`, so a
   960×412 or squashed window never overflows vertically.
5. **Container thresholds in px, documented.** `rem` inside `@container`/`@media`
   conditions resolves against the (ramped) root, so rem thresholds silently slide
   as the ramp grows: the current `105rem` page query and `44/64/90rem` atlas
   queries all shift meaning across the ramp. New thresholds on this page are in px
   (spine 1600px; atlas/zone grids 1100px and 620px; chronology 900px). Existing
   rem thresholds in touched files are converted in the same pass.

---

## 7. Curve-rendering correction (exact)

### 7.1 The method: analytic cubic Bézier emission (chosen, no alternatives)

Replace polyline serialization for **both** output sets with piecewise cubic
Béziers computed from the exact parametric derivative (Hermite endpoints). No new
dependencies; this is ~60 lines in the generator plus one exported helper.

1. **Velocity export.** Add to `packages/caps-domain`
   (`src/mathematics/trochoid.ts`): `evaluateTrochoidVelocity(parameters, t)`
   returning dE/dt in model units:
   `E'(t) = 2π·θ₁·ρ₁·(−sin a₁, cos a₁) + 2π·(θ₁+θ₂)·ρ₂·(−sin a₂, cos a₂)` with
   `a₁ = 2π·θ₁·t`, `a₂ = 2π·(θ₁+θ₂)·t`. Add the resolved-assembly-segment variant
   beside `evaluateResolvedCAPSegment` (same formula with the segment's resolved
   phase offsets). Export both from the package index. Unit test: matches a central
   finite difference within 1e-6 across sampled t for all ten registry curves.
2. **Knot placement (deterministic).** Per segment, subdivide `[0, d]` into
   `n = max(12, ceil(16 · f · d))` uniform spans, `f = max(|θ₁|, |θ₁+θ₂|, 1)`:
   16 cubics per turn of the fastest harmonic. For zero-phase elementary segments
   classified cycloid by `isCycloidTrochoid` with integer frequencies, round `n` up
   to a multiple of `2·|θ₂|` so every cusp parameter `t = (2j+1)/(2·θ₂)` lands
   exactly on a knot: cusps render as true sharp points where the incoming and
   outgoing tangents meet, never as a rounded or malformed interior of one cubic.
   (The three assembled sources contain no cycloid-classified segments; the rule
   binds where cusps actually occur, the two elementary cycloid cards.)
3. **Control points.** For span `[t₀, t₁]`, `h = t₁ − t₀`:
   `C1 = P(t₀) + (h/3)·E'(t₀)`, `C2 = P(t₁) − (h/3)·E'(t₁)`. Emit
   `M x₀ y₀ C c1 c2 p1 C ... Z` (all atlas and public curves close; the generator's
   existing closure assertion below 1e-9 gates the `Z`).
4. **Coordinate frame.** Keep the existing bbox + 10% padding logic, then affinely
   map the padded box to a fixed **`viewBox="0 0 1000 1000"`** (same scale both
   axes, orientation preserved exactly as today; this is a pure rescale of the
   current coordinate space, no visual flip). Round all path coordinates to
   **1 decimal**: quantization is 1/10,000 of the drawing (0.03px at a 300px
   render, 0.08px at 800px). Stroke widths become absolute: 16 (atlas, = 1.6%) and
   12 (public, = 1.2%); `stroke-linejoin: round`, `stroke-linecap: round` kept.
5. **Animation unchanged.** `pathLength="1"` stays on the path; dash values, the
   3.5s once-through atlas draw with `pre-draw`/`drawing` class gating, the 12s
   public loop, and both reduced-motion static rules are byte-for-byte the same
   behavior. Cubic paths animate `stroke-dashoffset` identically to polylines.
6. **Dedup both sets.** The atlas already uses `<defs><path>` + two `<use>`;
   switch the public wrapper to the same pattern (today it embeds the full `d`
   twice, underlay + draw). Drop the invalid `path-length: 1` CSS declaration in
   the public style block (the `pathLength` attribute does the work).
7. **Accuracy gate in the generator.** After emitting each curve, sample every
   cubic at 8 interior parameters and measure distance to a 4,096-point analytic
   polyline of the same segment; fail the build if any distance exceeds
   **1 viewBox unit (0.1%)**. Expected actual error with 16/turn is orders below.
   The existing junction/closure continuity report stays.
8. **Delete** `ATLAS_SAMPLES_PER_TURN`, `ATLAS_MIN_SAMPLES`,
   `FULL_SAMPLES_PER_TURN`, `FULL_MIN_SAMPLES`, and `buildPathData`'s polyline
   loop. One geometry builder serves both sets; the sets differ only in wrapper
   (role/aria vs aria-hidden, loop vs once animation, stroke 12 vs 16).

Why this method over the alternatives considered: raising polyline density plus
precision (e.g. 512/turn at precision 3) would also look smooth but triples point
counts, keeps chord corners at extreme zoom, and leaves two density knobs to
mis-tune again. Catmull-Rom through samples approximates tangents it does not need
to approximate: the derivative is closed-form. Analytic Hermite cubics are exact in
tangent, C¹ smooth everywhere except true cusps (which must be sharp and land on
knots by construction), resolution-independent at any future display size, and
smaller than today's files.

### 7.2 Segment-count and byte expectations (informative)

| Curve | Cubic segments (est.) | Est. path bytes |
|---|---|---|
| rosette-1-4 (f=5) | 80 | ~2.7KB |
| rosette-1-neg6 (f=5) | 80 | ~2.7KB |
| cycloid-1-4 (f=5, cusp-aligned to 8) | 80 | ~2.7KB |
| cycloid-1-neg3 (f=2, cusp-aligned to 6) | 36 | ~1.2KB |
| yuta-cap (12 + 24) | 36 | ~1.2KB |
| yuta-cap-three-quarter (12 + 36) | 48 | ~1.6KB |
| cap-1-3-composition (43 + 43) | 86 | ~2.9KB |

### 7.3 Revised byte budgets (binding)

| Budget | Old (prior spec §10) | New |
|---|---|---|
| Per atlas file | ≤ 15KB | **≤ 8KB** |
| Atlas total (7 files, inline in prerendered HTML) | ≤ 120KB | **≤ 48KB** (current polylines: 37.3KB; cubics land near ~20KB) |
| Per public file (`static/caps/`) | none (currently 58 to 143KB) | **≤ 12KB** |

The generator's existing size assertions update to these numbers.

---

## 8. What remains unchanged

- **CapsHub hero**: untouched this round (Austen's screenshots and complaints
  address the exhibit below it). Its own vw-scaled type is noted as a candidate for
  a later pass, not licensed here.
- **All copy and attribution**: prior spec section 9 remains the copy contract in
  full. This correction relocates text between containers verbatim; zero wording
  changes, zero new claims. Damien mononym/aliases only; no Forest Stearns/Sterns;
  no Spin Science; no Transition Theory or Jordan Campbell relationship; quotes
  only verbatim from the transcript.
- **Information architecture and anchors**: section order and every anchor id
  (`what-is`, `breakdown`, `math`, `math-assembled`, `origin`, `credits`,
  `relationship`, `watch`, `sources`) unchanged.
- **Interaction contract**: atlas selection updates the construction in place;
  selection moves focus to the construction heading; `aria-pressed` state; layer
  switcher via the shared `SegmentedControl`; transport including reduced-motion
  behavior; Custom-state detach semantics; draw-once-on-entry policy with the 3.5s
  pinned duration; provenance `<details>` behavior.
- **Accessibility contract**: one accessible name per card button, decorative card
  SVGs, labeled stage `role="img"`, 44px targets, focus-visible treatment,
  `tabular-nums` readouts, DOM order = visual order.
- **Mathematics**: `@caps/domain` assembly solver, registry, count helper, and all
  existing tests. The only package delta is the additive velocity export (7.1).
- **Shared files**: `public-editorial.css`, `src/app.css` (`--shell-w` and the root
  ramp), `SegmentedControl`, `SourceVideoCard`, `CapsAssembly`, `YutaCapLiveDemo`:
  all read-only. Every override in this spec is page-scoped.

---

## 9. Affected files and ownership boundaries

### In scope (the only files implementation may touch)

| File | Change |
|---|---|
| `src/routes/(public)/notation/caps/+page.svelte` | Spine sections, zone grids (chronology 2×2, credits banner+row, relationship pair, watch, sources), page-scoped type/rhythm overrides, deletion of `.math-heading` and the ≥105rem tier |
| `src/routes/(public)/notation/caps/_components/CurveAtlas.svelte` | rem-sized plots, capped left-packed tracks, stacked group headings, px container thresholds |
| `src/routes/(public)/notation/caps/_components/FocusedConstruction.svelte` | Header re-cluster, clamp re-caps, panel width = zone |
| `src/routes/(public)/notation/caps/_components/construction/ConstructionStage.svelte` | Stage cap `min(100%, 56dvh, 38rem)`, clamp re-caps |
| `src/routes/(public)/notation/caps/_components/construction/ConstructionRail.svelte`, `ConstructionTransport.svelte`, `ConstructionProvenance.svelte` | Clamp re-caps only, if any term violates rule 6.1 |
| `scripts/generate-caps-trochoids.mjs` | Section 7: Bézier builder, 1000 viewBox, budgets, accuracy gate, public `<use>` dedup |
| `packages/caps-domain/src/mathematics/trochoid.ts`, `src/mathematics/assembly.ts` (velocity variant), `src/index.ts` | Additive velocity exports only |
| `src/routes/(public)/notation/caps/_generated/*.svg`, `static/caps/*.svg` | Regenerated outputs (script-emitted only) |
| `tests/unit/caps-trochoid-model.test.ts` or sibling | Velocity + Bézier accuracy tests |
| `.claude/rules/4k-native-layout.md` | Additive "Density discipline" subsection (section 13) |

### Out of scope (must not change)

`src/lib/shared/landing/styles/public-editorial.css`; `src/app.css`;
`CapsHub.svelte`, `CapsAssembly.svelte`, `YutaCapLiveDemo.svelte`;
`SegmentedControl.svelte`, `SourceVideoCard.svelte`, `LaunchpadTile.svelte`; the
notation archive components; `svelte.config.js` and prerender config; archived
research files; all copy wording; every route and package not listed above.

---

## 10. Implementation phases (ordered for Codex)

- **Phase 1: curve smoothness.** 7.1 velocity exports + unit tests; generator
  Bézier builder, 1000-unit frame, budgets, accuracy gate, public dedup;
  regenerate both sets; verify the generator report (continuity + accuracy + bytes).
  Independent of layout; ships the most visible fix first.
- **Phase 2: spine and page recomposition.** `+page.svelte`: spine grid + rail
  content moves (verbatim), chronology 2×2, credits banner+row, relationship pair,
  watch, sources, page-scoped typography/rhythm overrides (5.4, 5.5), what-is demo
  height (5.3), px thresholds.
- **Phase 3: atlas and construction sizing.** `CurveAtlas` rem plots + capped
  tracks + stacked group headings; `FocusedConstruction`/`ConstructionStage` stage
  cap, header re-cluster, clamp audit per 6.1 across the construction
  subcomponents.
- **Phase 4: rule amendment.** Apply section 13's subsection to
  `.claude/rules/4k-native-layout.md` verbatim.
- **Phase 5: verification.** Full section 12 sweep; fix and re-shoot until every
  criterion passes.

Standing constraints every phase: explicit-pathspec commits only
(`commit-only-your-own-changes.md`); work on `main`, no branches or worktrees
without Austen's explicit request; one full `pnpm run check` at the gate, not in
the inner loop; no push to `main` without Austen's explicit go (pushes auto-deploy).
One approval gate: Austen approves this spec, then all phases proceed without
further stops.

---

## 11. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Regenerated cubic paths shift a curve's apparent weight or orientation versus the shipped polylines | The 1000-unit frame is a pure affine rescale of today's coordinate space (7.1 item 4, orientation preserved); stroke stays at the same ratios (1.6% / 1.2%); the generator accuracy gate (7.1 item 7) bounds geometric deviation at 0.1%; acceptance 12.4(d) requires a before/after crop comparison |
| Cusp lands inside one cubic span and renders rounded or kinked (the one place Hermite cubics can fail) | Cusp-knot alignment rule (7.1 item 2) puts every cusp of the zero-phase elementary cycloids exactly on a knot; the assembled sources contain no cycloid-classified segments (verified against the registry); the accuracy gate catches any residual |
| Byte budgets misjudged and the generator fails its own assertions | Budgets are ~3x the segment-count estimates in 7.2; a failure is loud (build error), and the correct response is a spec amendment, never silently loosening the gate |
| Spine activates at container 1600px, slightly below the 1680 type seam, creating an 80px window where the rail runs at base type scale | Benign by construction (clamps are at their caps from 1680 down to their floors); verified explicitly at 1440 (stacked) and 1920 (spine) in the acceptance sweep |
| Page-scoped type overrides drift the caps page's voice from other editorial pages | All overrides live inside `.caps-editorial`; `public-editorial.css` and `app.css` are grep-proven untouched (12.10); the shared caps question is flagged for a separate Austen-commissioned review (13), not smuggled in |
| DOM recomposition breaks the focus/keyboard contract that already shipped | The contract is unchanged by design (8) and fully re-verified (12.7) because the surrounding DOM moves |
| Silent prerender failure hides a broken atlas (`/notation/*` errors are swallowed) | Built-HTML inspection is mandatory (12.8); a green build alone is defined as insufficient |
| Short-window overflow (960×412) from the dvh-guarded stage interacting with in-panel rail minimums | The clamp audit (6.1) covers the construction subcomponents' min-heights; 12.5 tests 960×412 explicitly |
| Parallel in-flight work in the repo swept into commits | Only the files in section 9; explicit-pathspec commits; no push without Austen's go |
| Height targets miss because the hub (unchanged, 1,376px at 2560) anchors a floor | Targets in 5.1 already include the unchanged hub; if a target is missed by composition reality, the miss is reported with measurements, not absorbed by shrinking modules below the 5.3 floors |

---

## 12. Verification and screenshot acceptance criteria

Chrome DevTools MCP, device emulation at dpr 1, against the dev or built route.
Viewports: 1920×1080, 2560×1440, 3840×2160, 1440×900, 820×1180, 960×412, 375×667.
Screenshots `format: "webp", quality: 70`; measurements via `evaluate_script`.

1. **Overwhelm (mass).** `document.scrollHeight` ≤ 7,800 (1920), ≤ 8,800 (2560),
   ≤ 10,800 (3840). `#math` height ≤ 2,400px at 2560. At 2560×1440, one screenshot
   shows the assembled group heading, all three assembled cards with labels, and
   the construction panel's header simultaneously.
2. **Scan distance.** At 2560 and 3840, for each spine section: measured left-edge
   x of the `h2` equals the left-edge x of its intro/caption text (Δ ≤ 1px) and the
   intro's top is ≤ 2rem below the title's bottom; no paragraph content box
   measures wider than 52rem; the two relationship card headings' left edges are
   ≤ 38rem apart; the construction notation pill's top is ≤ 4rem below the
   construction title's bottom.
3. **Module caps.** Measured at 2560: assembled plots 300 to 316px square,
   elementary plots 225 to 237px, stage ≤ 740px, relationship cards ≤ 660px,
   chronology entry text ≤ 1,010px. Measured at 3840: stage ≤ 920px, assembled
   plots ≤ 390px.
4. **Smoothness.** (a) Every regenerated path's `d` contains `C` commands and no
   `L` commands. (b) Coordinates carry at most 1 decimal in a `0 0 1000 1000`
   viewBox. (c) The generator's accuracy gate reports max deviation ≤ 1 unit for
   all ten curves. (d) Screenshot proof: a cropped screenshot of the yuta-cap card
   at 3840 emulation (element-scoped via `uid`), visually free of staircase wobble
   and chord corners; compare against Austen's close-crop screenshot as the
   before. (e) Cusps on the two cycloid cards render as sharp points, not rounded
   knobs.
5. **Overflow.** No horizontal scrollbar and no clipped content at 375×667 and
   960×412 (`document.documentElement.scrollWidth ≤ innerWidth`). At 960×412 the
   assembled group is one column and the stage fits the viewport height
   (≤ 56dvh ≈ 231px).
6. **Reduced motion.** With `prefers-reduced-motion: reduce` emulated: every atlas
   card shows its complete static trace with no animation (computed
   `animation-name: none` on `.cap-atlas-draw`); the construction does not
   autoplay; the scrubber still updates the frame. Without it: an off-screen card
   draws exactly once on first entry, measured `animation-duration` 3.5s.
7. **Keyboard.** Tab reaches every atlas card in DOM order; Enter and Space
   select; selection moves focus to the construction heading (verified via
   `document.activeElement`); visible focus indicators on cards, layer switcher,
   transport, sliders, disclosure. (Contract unchanged from the prior spec;
   re-verified because the DOM around it recomposes.)
8. **Payload.** Prerendered `/notation/caps` HTML contains all seven inline atlas
   SVGs; per-file source ≤ 8KB, atlas total ≤ 48KB, each `static/caps/*.svg`
   ≤ 12KB. Built-HTML inspection is mandatory (the `/notation/*` prerender-error
   swallowing hazard from the prior spec still applies; a green build proves
   nothing by itself).
9. **Composition screenshots.** Full-page screenshots at all seven viewports:
   no stranded grid tracks or orphan rows anywhere (chronology 2×2, supports 4/2×2/1,
   sources 3+2+1 tiers, videos 3/2/1); the spine rail line is continuous down the
   page at 1920+; zone whitespace sits at the right edge only.
10. **Greps.** Over the diff and caps route tree: zero matches for `Stearns`,
    `Sterns`, `Forest`, `Jordan Campbell`, `Transition Theory`, `Spin Science`,
    `type="checkbox"`, `auto-fill`; no new `package.json` dependencies; zero diff
    in `public-editorial.css` and `src/app.css`.
11. **Console.** Zero console errors on load at 2560 and 375.

---

## 13. Amendment to `.claude/rules/4k-native-layout.md` (exact text, additive)

Append this subsection after "The Rules" (implementation applies it verbatim):

```markdown
## Density discipline (editorial and educational pages)

Learned from the 2026-08-02 /notation/caps correction: the caps exhibit obeyed
every rule above and still shipped a page Austen rejected as "massive...
blown up, not a genuinely good 4K composition", because filling the canvas was
implemented as module growth. For prose- and diagram-led pages (exhibits,
guides, editorial, comparison pages):

1. **Composition, never magnification.** Above the 1680 seam, extra width buys
   adjacency (label rails beside content, more columns, side-by-side
   comparisons), never bigger modules. If a tier does not change what sits
   beside what, it changes nothing.
2. **One scale authority.** The root ramp is the only thing that grows type or
   spacing above the seam. Every component clamp() must reach its cap by
   1680px viewport; vw/cqi/cqw terms that keep growing past the seam stack a
   second ramp on the first and are the "blown up" failure.
3. **No width-driven module heights.** aspect-ratio boxes must not take their
   inline size from a fluid track or band. Diagram/stage/plot boxes size from
   rem with a dvh guard. Fixed-count grids use capped tracks
   (repeat(N, minmax(0, CAPrem)) + justify-content: start): surplus width is
   calm margin, not growth.
4. **Claim and evidence share a column.** A heading and the sentence that
   explains it, or two things the reader must compare, may not be separated by
   more than ~40rem horizontally. Split-header grids that right-align captions
   across the band are banned.
5. **The 150% tier is real.** 4K at Windows 150% = 2560 CSS px is a primary
   composition target alongside 1920 and 3840, not an in-between. Verify it
   explicitly; it is where compounding over-scale shows first.
6. Line length on these pages is bounded by composition (the column the text
   lives in), which satisfies both this rule and the no-narrow-ribbons ban:
   never a bare max-width on prose inside an open band, never a paragraph box
   wider than ~52rem.
```

`feedback_no_text_max_width` and the `public-editorial.css` `.prose p` comment stay
in force as written: the ban is on mismatched narrow text ribbons inside wide
bands, and the mechanism here is container composition, not prose caps. The shared
`public-editorial.css` type caps (2.3rem titles, 1.2rem prose) and their
interaction with the early-firing ramp on OTHER marketing pages are flagged for a
separate review that Austen can commission; this spec does not touch them.

---

## 14. Supersession of the 2026-08-01 spec

**Replaced by this spec:**

- **Section 6 (Responsive composition contract) in its entirety**, including the
  "2600 shell / native 3840" subsection, the stage sizing rule
  `min(100%, 72dvh, 1040px)`, the `.math-heading` two-column header implied by its
  1680-tier layout, the chronology year-rail tier, the credits left/right split,
  and its rem-based container thresholds.
- **Section 7.5's atlas serialization parameters** (precision 2, polyline M/L
  output, the sampling constants) and **section 10's payload numbers** (15KB /
  120KB), replaced by section 7 here (cubic Béziers, 1000-unit frame, 8KB / 48KB /
  12KB).
- **Acceptance 12.4's stage measurement** (72dvh / 1040px) and **12.8's payload
  numbers**, replaced by sections 12.3 and 12.8 here.

**Remains in force from the 2026-08-01 spec:** sections 1 through 5 (decision,
goals, source-of-truth hierarchy, page sequence and anchor contract, atlas
inventory/grouping/provenance, interaction contract including draw-once and the
CapsHub tile change), section 7 except the 7.5 serialization parameters
(mathematics, registry, join algorithm, count helper), section 8 (ownership map
and prohibitions, as amended by section 9 here), section 9 (attribution and copy
contract, unchanged and re-affirmed), section 10's accessibility/motion/SSR
contracts except the payload numbers, and the acceptance criteria not named above.

---

*Authored by Claude Fable 5, 2026-08-02, from direct measurement of the shipped
implementation and Austen's 4K review. Implementation blocked until Austen approves
this document.*
