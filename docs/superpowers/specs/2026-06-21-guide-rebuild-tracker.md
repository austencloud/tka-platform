# Level 1 Guide — Page-by-Page Rebuild Tracker

**Started:** 2026-06-21
**Goal:** Rebuild the Level 1 printable guide page by page using the *current*
in-app renderers (post-Choreo-card), today's styles, and proper level/LOOP/
Choreo-card iconography — faithful to the original guide's intent and layout, but
a real facelift. Slow, one page at a time, each verified against the old artboard
before moving on.

## Source-of-truth stack (per page)

1. **Old artboard** — `D:\_THE KINETIC ALPHABET\_GUIDE\artboard-exports\*.png`
   (12241×15841, ~1440dpi). Reference for content + layout + intent. NOT shipped.
   Per-page → folder map: `D:\…\_GUIDE\PAGE-IMAGE-MAPPING.md`.
   Per-concept source pictographs: `D:\…\_GUIDE\images\level-1\<concept>\`.
   Canonical old PDF: `D:\…\_GUIDE\exports\level-1.pdf`.
2. **MCP** (`generate_pictograph`, `generate_sequence`, domain tools) — ground
   truth for every letter / position / motion / VTG fact shown. Never assert
   domain facts from memory.
3. **Current renderer** — `PictographRenderer` via `GuidePictograph` /
   `GuidePictographGrid` (themeMode light, print-mode eager). Today's visual style.
   Choreo-card bake path for reference: `features/choreo-card/services/card-back/`.
4. **App component language** — level badges, LOOP/CAP markers, Choreo-card icons.
   The facelift layer (icons TBD per page — locate the real components, never
   hand-roll).

## Architecture

- `_components/GuidePage.svelte` — one real Letter-sized page (the unit). On
  screen: paper sheet w/ shadow (WYSIWYG). Print: one physical page + hard break.
  Replaces the old continuous-scroll-sliced-by-`@page` approach that caused the
  chaotic pagination.
- The print route (`print/+page@(public).svelte`) stacks `GuidePage`s.
- Pages are converted one at a time; un-converted chapters still flow below until
  their turn.

## Per-page recipe

1. Downscale + view the old artboard (`sharp(...).resize(720)` → /tmp → Read).
2. Enumerate every pictograph / sequence / diagram + the prose + the intent.
3. Confirm each pictograph/letter/position against MCP.
4. Rebuild as live current-style components inside a `GuidePage`.
5. Add proper level / LOOP / CAP / Choreo iconography where the concept calls for it.
6. Render the print route; screenshot the page; compare side-by-side to the artboard.
7. Austen signs off → mark ✅ → next page.

## Page inventory & status

Old guide = 47 pages. Mapping → our 3 chapters. Status: ⬜ todo · 🔧 in progress · ✅ done.

| # | Old page (artboard) | Our home | Status |
|---|---|---|---|
| 1 | Cover (Name / title ring) | print cover | ✅ |
| 2-3 | Drink water / Support author | front matter | ✅ |
| 4 | Read Me First | print cover pg2 | 🔧 |
| 5 | Table of Contents | front matter | ⬜ |
| 6 | 1.0 Positions & Motions (title) | positions-motions | ⬜ |
| 7 | The Grid | ch10/TheGrid | ⬜ |
| 8 | Hand Positions (α/β/Γ, 16 picto) | ch10/HandPositions | ⬜ |
| 9 | Hand Motions (shift/dash/static, 5) | ch10/HandMotions | ⬜ |
| 10 | Type 1 Dual-Shifts (matrices) | ch10/Type1AlphaBeta + Type1Gamma | ⬜ |
| 11 | Gamma (Quarter-Opp/Same intro) | ch10/Type1Gamma | ⬜ |
| 12 | Type 2 Shifts | ch10/Type2Shifts | ⬜ |
| 13 | Type 3 Cross-Shifts (β→γ) | ch10/Type3CrossShifts | ⬜ |
| 14 | Type 4/5/6 Dash/Dual-Dash/Static | ch10/Type4Dash..Type6Static | ⬜ |
| 15 | Staff Positions (12) | ch10/StaffPositions | ⬜ |
| 16 | Staff Motions | ch10/StaffMotions | ⬜ |
| 17 | Negative Space / Body Turns | ch10/NegativeSpace | ⬜ |
| 18 | 1.1 Letters (title) | letters | ⬜ |
| 19 | Double-Staff Codex Type 1-2 (30) | ch11/CodexType12 | ⬜ |
| 20 | Codex Type 3-6 (17) | ch11/CodexType36 | ⬜ |
| 21 | Type 1 Letters | ch11/Type1Letters | ⬜ |
| 22 | Basic Words ABC/GHI | ch11/AlphaBetaWords | ⬜ |
| 23 | Compound Letters (15) | ch11/CompoundLetters | ⬜ |
| 24 | Compound Words DJ/EK/FL | ch11/CompoundWords | ⬜ |
| 25 | Gamma Letters (13) | ch11/GammaLetters | ⬜ |
| 26 | Gamma Words MP/NQ/OR/STUV | ch11/GammaWords | ⬜ |
| 27-29 | Type 2/3 words + continuous | ch11/Type2ShiftLetters etc. | ⬜ |
| 30 | 1.2 Words / LOOPs / Reversals (title) | words | ⬜ |
| 31 | Complex words intro | ch12/WordsIntro | ⬜ |
| 32 | LOOPs (CAPs) | ch12/Caps + LoopsVsCaps | ⬜ |
| 33 | Full-reversal | ch12/Reversals + FullReversalCaps | ⬜ |
| 34-36 | Reversal/permutation practice (AABB etc.) | ch12/AABB*, ACAC* | ⬜ |
| 37-38 | Type 1 LOOPs / gamma connect | ch12/Type1Caps, GammaCaps | ⬜ |
| 39 | Type 2 LOOPs | ch12/Type2Caps | ⬜ |
| 40 | 16-Count Sequences | ch12/SixteenCount | ⬜ |
| 41 | 8-Letter Words | ch12/EightLetterWords | ⬜ |
| 42-43 | Prop-/Full-reversal LOOPs | ch12/PropReversalCaps, FullReversalCaps | ⬜ |
| 44-47 | Closing / festival / contact | front/back matter | ⬜ |

(Naming note: original used "CAPs"; current app uses "LOOPs" — facelift adopts
LOOP terminology, per existing section filenames already named Loops*.)

## Conventions (facelift — supersede the old guide)

- **gamma = lowercase γ** (NOT uppercase Γ). The old artboards + existing guide
  assets (`images/hand-positions/Γ*.png`, old captions) use uppercase Γ — that is
  stale. Use γ everywhere; find-and-fix the Γ usages during page work.
- "CAPs" (old) → "LOOPs" (current app term).

## Decisions log

- 2026-06-21: Rejected embedding old artboard PNGs directly — they carry the OLD
  pictograph style. Rebuild with current renderers instead (Austen's call).
- 2026-06-21: Each page = a `GuidePage` unit (fixes pagination structurally).
- 2026-06-21: Cover — title (text) is the hero; supporting visuals must be
  HONESTLY distinct (rejected element-tinting identical mandalas). Feature "the
  three variations of Level 1" (trio TBD: positions α/β/γ vs spins pro/anti/hybrid).
- 2026-06-21: COVER SHIPPED. Component `_components/GuideCover.svelte` (shared by
  cover-lab + print route). Design:
  - Three motions as deterministic MCP geometry: Iso=A dual-pro (circle),
    Anti=B dual-anti (lens rose), Dash=Λ- dual-dash (a +). Closed loops → radial
    symmetry. Path = ARC only (concave/linear NOT canonical TKA yet).
  - Combined emblem (all three overlaid) above an ARC trio (iso·dash·anti).
  - Colour = the two PROP HANDS (blue/red), never motion type (rejected
    motion→hue as a false mapping). Trio/emblem share the prop colours.
  - Title font = **Fraunces wonky italic** (OFL, embeddable+sellable). Monotype
    Corsiva rejected (proprietary, illegal to embed in a sold PDF). Companion
    text = Cormorant Garamond.
  - "Level 1" = canonical baby-blue difficulty badge (inlined from
    difficulty-styles so the bare (public) route stays light — do NOT import
    @tka/render-composition here, it hangs the route).
  - TWO editions, one component, `theme` prop: `navy` (matte navy + gold foil,
    glowing line-art — digital / pro / foil) and `light` (ivory + ink rule,
    dark line-art — cheap home printer). Print route selects via `?theme=home`.
  - Mandala sizes scale to container width (bind:clientWidth) so the same
    component fills the 540px lab preview and a full 8.5×11 print page.
- 2026-06-21: Home-print affordance — navy cover is ink-heavy on inkjet (full
  dark coverage warps plain paper, no real foil, usually no borderless). Ship
  navy for digital/pro; `?theme=home` light edition for home. Interior pages
  stay white regardless.
- 2026-06-22: SUPPORT PAGE (p3) finalized. Two methods only — PayPal + Venmo
  (Cash App dropped, Austen doesn't use it). Colour brand logos, not mono (the
  cropped PayPal/Venmo wordmarks have white backgrounds, so CSS ink-tinting
  produces grey boxes; true mono would need custom transparent wordmarks — not
  worth it). Layout = two centred columns, each QR → logo centred directly below
  → italic handle, matching Austen's original donation sheet. Copy rewritten to
  drop the banned em dash and avoid "The Kinetic Alphabet" mid-sentence (so it
  can't wrap two lines). Soft "Suggested $20–30 · any amount helps" kept small
  (anchors an amount without pressure). Assets in
  `static/guide/level-1/images/_shared/`: `qr-paypal.png` + `qr-venmo.png`
  (1200px, jsqr round-trip verified) and `logo-paypal.png` + `logo-venmo.png`
  (cropped from `D:\…\_GUIDE\source\QR Codes.png`). Compare view added at
  `(public)/guide/level-1/compare` (old v0.5 PDF vs live rebuild, navy/home
  toggle).
