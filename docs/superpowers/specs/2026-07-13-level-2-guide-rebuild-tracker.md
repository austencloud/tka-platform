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
- [ ] p6 Type 1 Dual-Shift — A¹/B¹ breakdowns, C¹ vs C₁ (pro-high/anti-low)
- [ ] p7 S and T — leading/following, S¹/S₁/T¹/T₁ breakdowns
- [ ] p8 Type 2 Shift — W¹, Ẇ₁ (same) vs W̥₁ (opp), same/opp dots introduced
- [ ] p9 Type 3 Cross-Shift — Z-¹, Ż-₁ same, Z-₁ opp, halfway-position teaching
- [ ] p10 Type 4 Dash — Φ¹, Φ₁
- [ ] p11 Opening/Closing — Λ¹ open/close, Λ₁ open/close, continuation panels
- [ ] p12 Type 5 Dual-Dash — Ψ-¹, Λ-₁ open/close
- [ ] p13 Type 6 Static — α₁, Γ₁ open/close, continuation panels
- [ ] p14 1|1 Turns Type 1 — D/I/N/V one-one breakdowns
- [ ] p15 1|1 Type 2+3 — Ẋ/X̥, Θ- same/opp, Δ- same/opp
- [ ] p16 1|1 Type 4/5/6 — Φ, Ψ-, Γ same/opp one-one

### Phase 2 — 1-turn codex (original p17–22, landscape→portrait reflow)
- [ ] p17 Codex 1|0 Type 1 (landscape → 6-col portrait)
- [ ] p18 Codex 0/1 Type 2+3 same/opp (landscape → stacked portrait)
- [ ] p19 Codex 1/0 Type 2+3 + 1|0/0|1 Type 4/5/6 (landscape → stacked portrait)
- [ ] p20 Codex 1|1 Type 1 (already portrait)
- [ ] p21 Codex 1/1 Type 2+3 same/opp (landscape → stacked portrait)
- [ ] p22 Codex 1|1 Type 4/5/6 (already portrait)

### Phase 3 — 2-turn pedagogy + codex (original p23–34)
- [ ] p23 2-Turns: shifts — pro/anti double-turn breakdowns (thirds decomposition)
- [ ] p24 2-Turns: dashes + static — four-part dash breakdown, 360° static turn
- [ ] p25 Codex 2|0 Type 1 (landscape → 6-col portrait)
- [ ] p26 Codex 0/2 Type 2+3 same/opp (landscape → stacked portrait)
- [ ] p27 Codex 2/0 Type 2+3 + Type 4/5 + 0/2 + Type 6 (landscape → stacked portrait)
- [ ] p28 Codex 2|1 Type 1 (landscape → 6-col portrait)
- [ ] p29 Codex 1/2 Type 2+3 (landscape → stacked portrait)
- [ ] p30 Codex 2/1 Type 2+3 (landscape → stacked portrait)
- [ ] p31 Codex 2/1 + 1/2 Type 4/5/6 same/opp (landscape → stacked portrait)
- [ ] p32 Codex 2|2 Type 1 (already portrait)
- [ ] p33 Codex 2|2 Type 2+3 same/opp (landscape → stacked portrait)
- [ ] p34 Codex 2|2 Type 4/5/6 (already portrait)

### Parked
- Back matter p35–37 (Let's Collaborate, Taco Tuesday, back cover) — with Level 1's.
- Reader (Learn tab) level-2 integration + legacy `_sections`/`turns`/`double-turns`
  retirement — after print/book parity.

## Verification gates (per page + per phase)

- Per page: headless screenshot of `/guide/level-2/print` sheet vs original PDF render.
- Per phase: `npm run check` clean on touched files; commit with explicit pathspec.
- Final: Austen eyeball pass (same gate as Level 1).
