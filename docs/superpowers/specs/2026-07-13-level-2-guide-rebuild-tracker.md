# Level 2 Guide Rebuild — Design + Tracker

**Date:** 2026-07-13
**Source of truth:** `D:\_THE KINETIC ALPHABET\_GUIDE\exports\level-2.pdf` (37 pages, v0.5)
and the artboard exports under `D:\_THE KINETIC ALPHABET\_GUIDE\artboard-exports\` where available.
**Predecessor:** `2026-06-21-guide-rebuild-tracker.md` (Level 1 — architecture proven, complete).

## Decisions (brainstormed with Austen 2026-07-13)

1. **Separate Level 2 instance** under `src/routes/(public)/guide/level-2/` mirroring the
   Level 1 architecture: `_pages/` + `_data/guide-manifest.ts` + `_data/built-pages.ts` +
   `/print` + `/book` routes. Shared chrome (GuidePage, GuidePictograph,
   GuideSequencePlayer, guide-sequence-adapter, print CSS patterns) is IMPORTED from
   `../level-1/_components` / `_data` — no forking. If a shared component needs a
   level-2-only capability, extend it with a prop (chip-primitives playbook).
2. **Landscape codex pages reflow to portrait** using the original's own portrait
   precedents: p20 (1|1 Type 1, 6-col grid) and p22 (1|1 Type 4/5/6, stacked sections).
   Type 1 landscape codexes → 6-col portrait grids; Type 2+3 side-by-side landscape
   splits → stacked portrait sections. **Fallback (pre-approved):** if a specific grid
   can't reflow cleanly, add a `.guide-page--landscape` print variant for that page only.
3. **Back matter skipped** (p35 Let's Collaborate, p36 Taco Tuesday, p37 back cover) —
   same parking as Level 1's back matter. Revive together when Austen wants back matter.
4. **Reader integration deferred.** GuideReader is level-1-manifest-bound (hosted in the
   Learn tab). Level 2 ships print/book parity first; a reader level-switcher is its own
   later phase. Legacy `_sections/ch20|ch21` + `/turns` + `/double-turns` routes retire
   only at reader parity (guide single-source policy).

## Page recipe (inherited from Level 1, plus turns)

1. Downscale/crop source page from the PDF render (or artboard export if present).
2. Decode every pictograph cell; verify letters/variations via MCP
   (`list_letter_variations`); turned motions get explicit `turns` on the motion data.
3. TKA glyph adornments come from DATA, never hand-drawn: `TurnsColumn` (high/low
   turn numbers), `DirectionDot` (same/opp), `Dash`. Opening/closing labels are page
   text (no glyph support — matches original which renders them as subscript words).
4. Reversal dots (if any) derive via `bakeReversals` — never hand-authored.
5. Screenshot vs original before marking a page done. Theta is ALWAYS Θ.

## Domain cheat sheet (from the original, MCP-verify per page)

- Turn = 180° of extra prop rotation during a motion. High/low glyph slots order by
  PADS (Pro, Anti, Dash, Static); S/T use leading(high)/following(low); same-type
  pairs use left(high)/right(low).
- Turns on the second hand of a rotating pair create Same/Opp relationships →
  DirectionDot above (same) / below (opp).
- Λ (and Γ, Λ-) single-turn variants disambiguate by opening/closing.
- Notation: `C¹ = C(1,0)`, `C₁ = C(0,1)`, dots as `(s)`/`(o)` params, `op`/`cl` suffix.

## Ledger

### Phase 0 — Infrastructure ✅ 2026-07-13
- [x] `level-2/_data/guide-manifest.ts` — 33 body entries, groups 2.0 (1-Turns) / 2.1 (2-Turns)
- [x] `level-2/_data/built-pages.ts` — BUILT2 registry (empty; pages register as built)
- [x] `level-2/_components/Level2Document.svelte` — cover + body sequence (no L1-style
      front matter; original has none). Interim text cover until tracker p1 builds.
- [x] `level-2/print/+page@(public).svelte` — stacked sheets, shared L1 styles/print mode
- [x] `level-2/book/+page@(public).svelte` — compare (old v0.5 PDF via pdf.js, offset 0)
      + flip book; proof at `static/guides/_proof/level-2-v05.pdf`
- [x] Placeholder fallback (shared L1 PagePlaceholder)
- Verified: /print renders 34 sheets (cover + 33 body), manifest titles paint,
  selfTitled suppressed, 33 placeholders (headless Chrome DOM query).

### Phase 1 — Front + 1-turn pedagogy (original p1–16)
- [x] p1 cover — Level 1's locked cover design with a Level 2 badge (GuideCover gained a
      `level` prop; facelift supersedes the old pictograph-diamond cover, as Level 1's did)
- [x] p2 divider "2.0 — 1-Turns" — structure faithful (row · 2.0 · rule · 1-Turns · rule ·
      row); art facelift: SequenceMandala forms (iso/anti/dash/hybrid, cover family)
      instead of stroke-decoding the original hand-composited overlays. Screenshot-verified.
- [x] p3 Turns: shifts — pro/anti 1-turn strips. Pro = static E(in) → SE halfway pose
      (rotate 315) → static S(out) = PRO e→s cw turns=1; Anti = SE pose (rotate 45) →
      static S(in) = ANTI e→s ccw turns=1. Real pictographs + renderer turn arrows;
      halfway = bare grid + staff SVG (StaffMotionsPage technique, arrows-in-frames
      dropped per the level-1 facelift convention). Click-to-animate wired.
      Screenshot-verified vs original.
- [x] p4 Turns: dashes + static — dash = DASH s→n turns=1 in→in (halfway horizontal at
      grid center); static = STATIC E turns=1 in→out CCW (renderer draws the over-staff
      arrow; halfway vertical at E hand point). Static-vs-Shift arrow compare boxes are
      real pictographs. Screenshot-verified.
- [x] p5 Glyphs/PADS — high/low slots (big A), PADS priority arrow + Shifts brace, five
      hybrid example pictographs (all MCP-verified: Type1 C[11], S/T S[8], Type2 W[9],
      Type3 Σ-[9], Type4 Φ[4]) + left/right same-type example A[3]. Screenshot-verified.
- [x] p6 Type 1 Dual-Shift — A¹/B¹/C¹/C₁ breakdown strips; real start/end statics +
      engine-interpolated halfway staff poses (halfway-pose.ts) + combined variations
      with turns on the correct hand (renderer draws turn arrows). Coords calibrated to
      original PDF text layer. Screenshot-verified vs original.
- [x] p7 S and T — leading/following hybrids. S¹/S₁/T¹/T₁ strips from variation [6]
      (blue w→s leads, red s→e follows; S pro / T anti, MCP-verified). Leading strip
      turns blue, following turns red. Slot glyphs flip (high=red, low=blue); thin
      within-group rules + heavy S↔T divider; U/V carve-out note. Screenshot-verified.
- [x] p8 Type 2 Shift — W¹ (shift turn) + W-Same/W-Opp Low-One (static-hand turn, cw=same
      dot-above / ccw=opp dot-below). W variation [3] (blue w→w static, red n→e pro cw).
      Renderer draws opposite static-spin arrows so same/opp read distinctly. Θ uppercase.
      Screenshot-verified (incl. zoomed same-vs-opp arrow check).
- [x] p9 Type 3 Cross-Shift — Z-¹ (shift turn) + Z-Same/Opp Low-One (dash-hand turn,
      cw=same/ccw=opp). Z- variation [7] (blue s→n dash, red e→n anti cw). Dash through
      center = centric halfway. Θ- uppercase. Screenshot-verified.
- [x] p10 Type 4 Dash — Φ¹ (dash turn) + Φ₁ (static turn). Φ variation [3] (blue s→s
      static, red s→n dash). One prop rotates per strip → no same/opp, no dots.
      Screenshot-verified.
- [x] p11 Opening/Closing — Λ¹ open/close + Λ₁ open/close, with a right Continuation
      column (W=alpha opening, Y=beta closing) behind a vertical divider. Λ variation
      [14] (blue w→w static, red s→n dash). Λ¹ turns dash (cw=opening/ccw=closing),
      Λ₁ turns static. Screenshot-verified. (Accuracy pass TODO: confirm op/cl arc
      directions + Λ₁ static-spin rotation against original at zoom.)
      **Domain grounding (MCP `get_domain_topic("glyph-anatomy")`, gathered 2026-07-13):**
      Λ/Λ-/Γ use opening/closing INSTEAD of same/opp (gamma's right-angle geometry
      breaks the same/opp distinction). Opening = extrapolating the rotating hand's
      trajectory into a pro-shift resolves toward ALPHA (opposite pts, "open") →
      the page's continuation pictograph is **W**. Closing = resolves toward BETA
      (same pt, "closed") → continuation is **Y**. Op/cl is per-hand. Λ is Type 4
      (dash high, static low). 4 strips: Λ¹ opening + Λ¹ closing (turn on dash),
      Λ₁ opening + Λ₁ closing (turn on static). NEW structural element vs p6–p10: a
      right "Continuation" column (5th pictograph = W or Y) behind a VERTICAL divider
      rule. Λ variations (MCP list_letter_variations Λ): dash+static at gamma→gamma
      (e.g. [5] blue n→s dash, red e→e static). Opening vs closing = dash rotationDirection
      (cw vs ccw); renderer/PropRotationStateTracker resolves the op/cl arrow, so pick
      the variation + turn rotation and screenshot-verify continuation resolves to W/Y.
      HRULES: y=290.9 (heavy, top group), y=578.9 (heavy, mid), y=750.1 (footnote);
      vertical divider separates the continuation column (~x655 in the 1.4x render).
- [x] p12 Type 5 Dual-Dash — Ψ-¹ (var [1], both n→s, turn high/left blue) + Λ-¹
      opening/closing (var [7], blue w→e / red s→n, turn low/right red) with continuation
      column (opening→W alpha, closing→Y beta). Two column layouts. Screenshot-verified.
      (Accuracy pass TODO: confirm Λ-¹ dash arc rotation cw/ccw vs original.)
- [x] p13 Type 6 Static — α¹ (var [0], both static, turn red) + Γ¹ opening/closing
      (gamma static blue@S/red@W, turn red) with continuation (opening→W, closing→Y).
      Static-with-turn spins in place. Screenshot-verified.
- [x] p14 1|1 Turns Type 1 — D[3]/I[0]/N[2]/V[1] one-one strips, turns=1 both hands.
      Screenshot-verified. (Accuracy pass: N hand positions may be mirror of original.)
- [x] p15 1|1 Type 2+3 — X same/opp (X[3]), Θ- same/opp (Θ-[3]), Δ- same/opp (Δ-[3]);
      both hands turns=1, same-dot above / opp-dot below the letter, glyph slot
      order red-over-blue. `one-one-t23` → OneOneType23Page. Screenshot-verified.
      (Accuracy pass: confirm same/opp rotation-direction cw/ccw assignments and
      combined rotation-arrow prominence; Θ-/Δ- dash glyph is a short hyphen.)
- [x] p16 1|1 Type 4/5/6 — Φ same/opp (Φ[1]), Ψ- same/opp (Ψ-[1]), Γ open/close
      (γ[0]); both hands turns=1, glyph slot order BLUE-over-RED (reverse of p15,
      matches artboard). Gamma start orientation OUT for OPEN / IN for CLOSE.
      `one-one-t456` → OneOneType456Page. Screenshot-verified. (Accuracy pass:
      confirm Gamma OPEN-vs-CLOSE rotation directions against original halfway
      trajectory; Psi dual-dash end computes both-IN vs original "mixed" caption;
      omitted the stray small "Γ" annotation near the CLOSE row.)

**Phase 1 complete (p1–p16).** All 1-turn pedagogy pages built + screenshot-verified.

### Phase 2 — 1-turn codex (original p17–22, landscape→portrait reflow)

**Codex engine established (reusable across ALL codex pages, Phase 2 + 3):**
- `_data/codex-turns.ts` — turn-annotated cell data via the LIVE codex path:
  `codexData("<letter>-0")` (canonical 0-turn home orientation, same source as
  `/guide/codex`) → `applyPendingTurnsToOption(...)` (correct end orientation +
  correct `*_N.0.svg` turn arrows). Exports: `codexSlotData(letter, "high"|"low")`
  (1|0 pages), `codexTurnData(letter, hi, lo)`, `codexRelData(letter, hi, lo,
  "same"|"opp")` (steers turning hand's spin dir vs the shift). PADS decides
  high/low slot from motion types.
- `_components/CodexGridPage.svelte` — portrait-reflowed 8×4 grid. Two header
  modes: `subParts` (single centered, p17) or `leftHeader`+`rightHeader` (split
  with vertical divider, p18). Per-cell `dot: "same"|"opp"`, `names` row-0 captions.
- **Reflow decision: keep the original 8-col × 4-row structure, scale to portrait
  width (8×70pt = 560 fits 612). Preserves VTG/type row grouping; no awkward 4×8.**
- **Known accuracy-pass flags (ALL codex pages):** (1) cells use app-canonical `-0`
  orientation — differs from artboard per-letter rotation; ONE-LINE global switch
  in codex-turns.ts if artboard-exact wanted. (2) same/opp cw-ccw mapping assumes
  shift's stored `rotationDirection` is the reference sense. (3) header mandala
  rosette icons omitted. (4) S/T high slot treated as blue, not leader.

- [x] p17 Codex 1|0 Type 1 — 32 cells (12 pure ¹, 10 hybrid/quarter ¹+₁), portrait
      8×4, `codex-1-0-t1` → CodexOneZeroType1Page. selfTitled. Screenshot-verified.
- [x] p18 Codex 0/1 Type 2+3 same/opp — split-column (T2 shift | T3 cross-shift),
      vertical divider, low-slot ₁ turn, same-dot rows 1–2 / opp-dot rows 3–4.
      `codex-0-1-t23` → CodexZeroOneType23Page. Screenshot-verified.
- [x] p19 Codex 1/0 Type 2+3 + 1|0/0|1 Type 4/5/6 — 4-quadrant bespoke page,
      heavy H+V dividers. Added full-PADS `highSlotColor` (pro>anti>dash>static)
      and `codexOpenCloseData(letter, hi, lo, "open"|"close")` (CW=open/CCW=close
      convention). `codex-1-0-t23-456` → CodexOneZeroType23And456Page. Verified.
- [x] p20 Codex 1|1 Type 1 — 22-letter 6-col grid, both hands turn (`¹₁` stacked
      red/blue), NO same/opp dot (dual-shift relationship is intrinsic). Added
      variable `cols` + "both" slot to CodexGridPage. `codex-1-1-t1` (selfTitled).
- [x] p21 Codex 1/1 Type 2+3 same/opp — p18 split layout, `codexRelData(l,1,1,rel)`,
      `¹₁` labels. `codex-1-1-t23` → CodexOneOneType23Page. Verified.
- [x] p22 Codex 1|1 Type 4/5/6 — 3 stacked sections, Same/Opp rows + Λ/Γ Open/Close.
      `codex-1-1-t456` → CodexOneOneType456Page. Verified. (Accuracy: exact 1|1
      dual-hand open/close combos [op/op…cl/cl] approximated.)

**Phase 2 complete (p17–p22).** All 1-turn codex pages built + screenshot-verified,
portrait reflow confirmed by Austen.

### Phase 3 — 2-turn pedagogy + codex (original p23–34) ✅ 2026-07-13
- [x] p23 2-Turns: shifts — Pro halves + Anti thirds + Anti halves strips. `poseAt(m, t)`
      generalizes halfway-pose.ts to arbitrary fraction (¼/⅓/½/⅔/¾) for the double-turn
      breakdown frames. `two-turns-shifts` → TwoTurnsShiftsPage (selfTitled). Verified.
      (Accuracy: fractional pose positions are engine radius-150 approximations; bottom
      "broken in half" strip follows the proof's own in→out→in labeling — combined IN→IN
      turns=2 — vs the authoritative thirds strip's 3-switch in→out→in→out.)
- [x] p24 2-Turns: dashes + static — Dash quarters (5 frames + combined) + Dash halves +
      Static 360°. `two-turns-dash-static` → TwoTurnsDashStaticPage (selfTitled). Verified.
      (Accuracy: intermediate frames are bare staves — the small pinky/thumb-end direction
      arrows are omitted, matching the 1-turn pedagogy pages.)
- [x] p25 Codex 2|0 Type 1 (6-col portrait) — `codex-2-0-t1` → CodexTwoZeroType1Page. Verified.
- [x] p26 Codex 0/2 Type 2+3 same/opp — `codex-0-2-t23` → CodexZeroTwoType23Page. Verified.
- [x] p27 Codex 2/0 Type 2+3 + Type 4/5 + 0/2 + Type 6 — 4-quadrant. `codex-2-0-t23-456` →
      CodexTwoZeroType23And456Page. Verified.
- [x] p28 Codex 2|1 Type 1 (6-col portrait) — `codex-2-1-t1` → CodexTwoOneType1Page. Verified.
- [x] p29 Codex 1/2 Type 2+3 — `codex-1-2-t23` → CodexOneTwoType23Page. Verified.
- [x] p30 Codex 2/1 Type 2+3 — `codex-2-1-t23` → CodexTwoOneType23Page. Verified.
- [x] p31 Codex 2/1 + 1/2 Type 4/5/6 same/opp — 4-quadrant. `codex-21-12-t456` →
      CodexTwoOneOneTwoType456Page. Verified.
- [x] p32 Codex 2|2 Type 1 (portrait) — `codex-2-2-t1` → CodexTwoTwoType1Page. Verified.
- [x] p33 Codex 2|2 Type 2+3 same/opp — `codex-2-2-t23` → CodexTwoTwoType23Page. Verified.
- [x] p34 Codex 2|2 Type 4/5/6 (portrait) — `codex-2-2-t456` → CodexTwoTwoType456Page. Verified.

**Phase 3 complete (p23–p34).** All 2-turn pedagogy + codex pages built + screenshot-verified.

**Rebuild complete — all 33 manifest body pages built (Phases 0–3).** `npm run check`
clean. Remaining: Austen eyeball pass + the per-page accuracy-pass flags noted above; back
matter + reader integration stay parked (see Parked).

### Parked
- Back matter p35–37 (Let's Collaborate, Taco Tuesday, back cover) — with Level 1's.
- Reader (Learn tab) level-2 integration + legacy `_sections`/`turns`/`double-turns`
  retirement — after print/book parity.

## Verification gates (per page + per phase)

- Per page: headless screenshot of `/guide/level-2/print` sheet vs original PDF render.
- Per phase: `npm run check` clean on touched files; commit with explicit pathspec.
- Final: Austen eyeball pass (same gate as Level 1).
