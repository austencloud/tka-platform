# Unified Pattern Strip Editor — Turns / Reversals / Duration

**Date:** 2026-05-30
**Status:** Design (approved in brainstorm, pending spec review)
**Prototype:** `static/sketches/2026-05-30-turn-strip-editor.html` → [localhost](http://localhost:5173/sketches/2026-05-30-turn-strip-editor.html)

---

## Problem

The Sequence Actions drawers for **Turn Patterns** and **Duration Patterns** are
the old "save / browse / apply" model:

- **TurnPatternDrawer** — Uniform row + complexity-filtered Templates
  (`turn-pattern-templates.ts`, hardcoded, **8 & 16 beats only** — returns `[]`
  at any other length) + saved Firebase patterns. It has no awareness of the
  richer named pattern ecosystem built for choreo-card deck variation.
- **DurationPatternDrawer** — over-built: save/apply tabs, an
  accent/meter/feel/world **category browser**, grouped desktop display, a
  preview/confirm flow, a `PatternItemCard` grid, container queries. Austen:
  *"it's trying way too hard and it should just be for applying some presets."*

Meanwhile the deck-variation pipeline already encodes a far richer vocabulary
that never reaches the create UI:

- **Turn presets** — `TURN_PATTERNS` in `deck-variation.ts:109` (`hold-1`,
  `pulse-1`, `trade-1`, `half-trade`, `wave-21`), a tiled `blue|red-…` string
  format that works at any length divisible by its period.
- **Reversal patterns** — `REVERSAL_PATTERNS` in
  `choreo-card/domain/reversal-patterns.ts` (book, red-book, blue-book,
  long-book, alternating, + solo / dense-weave / sparse-weave families).

A key correction surfaced during the brainstorm: **reversals are a wholly
separate concept from turns** (prop spin flips vs rotation amounts) and must not
share a drawer. But all three pattern types share one deeper structure.

## The Core Insight — one primitive, three bindings

Every pattern is the same primitive:

> **Period (length) × Rhythm (which beats are active) × Value (on active beats) → an editable strip.**

| Drawer | Lanes | Rhythm catalog | Value on active beat | Inactive beat | Apply engine |
|---|---|---|---|---|---|
| **Turns** | 2 (blue / red) | per-hand (shared) | turn amount per hand (0, 0.5, 1, 1.5, 2, 2.5, 3, fl) | 0 turns | `turn-pattern-manager.applyPattern` |
| **Reversals** | 2 (blue / red) | per-hand (shared) | — boolean — flip spin | continuous | `reversal-seed-service.transformSequence` |
| **Duration** | 1 (per step) | single-lane (accent) | hold multiplier (1.25, 1.5, 2, 4×) | 1× (square) | `duration-pattern-manager.applyPattern` |

The **period logic, rhythm-mask engine, strip-editor component, and chip
primitives are shared**, bound three ways. Turns and reversals literally share
the per-hand rhythm catalog (the simple family of `REVERSAL_PATTERNS`). Duration
is step-level, so it is single-lane and reuses the same engine with its own
small accent-rhythm set.

Emergent recipes (the old flat turn presets fall out for free):
Hold 1 = Book + amount 1 · Pulse 1 = Long Book + 1 · Trade 1 = Alternating + 1 ·
½/1 Trade = Alternating, Blue 0.5 / Red 1.

## Interaction Model — editing is primary, chips are derived highlights

The strip is the **single source of truth**. There is no "selected preset" mode
and no lock-in.

- **Chips stamp, they don't lock.** Clicking a Rhythm chip writes that mask into
  the strip (reusing the current per-hand amount if the active beats already
  share one). Clicking an Amount sets the value on currently-active beats.
- **Chips auto-highlight by derivation.** On every render, a Rhythm chip lights
  iff the strip's active-mask equals that rhythm tiled to the period; an Amount
  chip lights iff all active beats of that lane share that value. Navigate to a
  value manually and its chip lights on its own.
- **Edit a cell → the strip stops matching → the chip quietly un-lights.** No
  "edited inline / reset" tag (the previous design's clunk, removed).
- **Cell editing:** left third = decrement, right third = increment (cycling the
  value list), center third = popover for an exact value. Touch targets ≥ 44px.
- **Reversal cells** are plain on/off toggles, two lanes; both lanes lit in a
  column = both flip (P), blue-only = B, red-only = R, neither = continuous.

## Length / Period semantics

`period ∈ divisors(sequenceLength) capped at 8`. Default 4. The strip renders
**only the period** (fewest columns) and tiles to fill the sequence; a "repeats
×N" readout makes the tiling explicit. Changing the period resizes the arrays,
tiling existing values to preserve the feel.

## Component Architecture

Reuse first (per `never-hand-roll` / `chip-primitives`):

- **Length** selector → `SegmentedControl`
  (`shared/3d/components/controls/SegmentedControl.svelte`). Single-select,
  mutually exclusive. `size="sm"`.
- **Amount** selectors → `SegmentedControl` (one per lane: Blue, Red, or Hold),
  colored per lane via its `color` prop.
- **Rhythm** chips → `FilterChipBase`
  (`shared/browse/components/filter-chips/FilterChipBase.svelte`) in
  `mode="toggle"`, with the twin-dot rhythm glyph supplied through `iconSnippet`.
  (Rhythm is "at most one, clears when the strip diverges" — the toggle mode with
  derived `active` matches this; we drive `active` from the strip, not from
  internal chip state.)

New primitives (grep confirmed nothing editable exists — `DurationPreviewGrid`
is display-only):

- **`PatternBeatStrip.svelte`** — the editable per-beat strip. Props: `lanes`
  (1 or 2), per-lane values array, a `valueList` for cycling, a `format(value)`
  fn, a `cellKind` (`"number" | "toggle"`), and `onEdit(lane, index, value)`.
  Emits left/right/center zone interactions and the exact-value popover. This is
  the one genuinely new, reusable piece; both drawers and the choreo-card
  rendering preview can consume it.
- **`RhythmGlyph.svelte`** — the twin-dot (or single-dot) mask preview rendered
  inside each rhythm chip and usable wherever a rhythm needs an inline glyph.

Shared domain (hoist, see below):

- **`PatternStripEditor.svelte`** — composes Length + Rhythm + Amount +
  `PatternBeatStrip` for a given binding config. The three drawers are thin
  wrappers that pass a binding (lane count, value list, catalogs, apply fn).

## Shared rhythm domain (the hoist)

The rhythm catalog + mask engine currently live inside the `choreo-card`
feature. The create drawers must not import across features. Hoist to a shared
home both consume:

- **`src/lib/shared/create/domain/rhythm/`**
  - `rhythm-catalog.ts` — `RhythmDef { id, label, sym }`, the **per-hand**
    catalog (book / long-book / alternating / red-book / blue-book + continuous),
    and the **single-lane** duration accent catalog (every / every-other /
    downbeat / last). Solo / dense-weave / sparse-weave stay in `reversal-patterns.ts`
    as reversal-only extras for now (out of scope; see Non-goals).
  - `rhythm-mask.ts` — `maskAt(sym, i)` (per-hand), `activeAt(sym, i)`
    (single-lane), period tiling, and the **match** predicates used for derived
    highlighting.

`choreo-card/services/deck-variation.ts` and `reversal-patterns.ts` are
refactored to re-export / consume the shared catalog so there is exactly one
source of truth. The existing `parseTurnUnit` / tiling in `deck-variation.ts`
(which already builds a `TurnPattern` and calls `applyPattern`) is the proven
bridge and is preserved.

## Data model & apply paths

The strip's in-memory state is per-binding; conversion to the existing apply
engines happens at apply time (the conversions already exist or are trivial):

- **Turns** — period-length `blue[] / red[]` of `TurnValue` → tile to sequence
  length → `TurnPatternEntry[]` → `turn-pattern-manager.applyPattern(pattern,
  seq, "both")`. (Exactly the `deck-variation.ts:296-314` path.) Canonical turn
  value list is `TURN_VALUES` in `turn-pattern-parser.ts`
  (`[0,0.5,1,1.5,2,2.5,3]`) plus `"fl"`.
- **Duration** — single-lane `dur[]` of multiplier (≥ 1) → tile →
  `DurationPatternEntry[]` → `duration-pattern-manager.applyPattern(pattern,
  seq)`. Duration is step-level (no target hand).
- **Reversals** — `revBlue[] / revRed[]` booleans → reversal symbol string
  (P/R/B/-) → `ResolvedReversalPattern` → `reversal-seed-service.transformSequence(seq,
  resolved, edges)`. Requires the diamond CSV edge graph
  (`loadDiamondEdges` from `pictograph-letter-lookup.ts`); load once and cache in
  the create module.

## Phasing

- **Phase 1 — Turns + Duration.** No edge graph needed; both reuse existing
  apply managers. Build the shared engine, `PatternBeatStrip`, `RhythmGlyph`,
  `PatternStripEditor`, hoist the rhythm domain, rebuild `TurnPatternDrawer` and
  `DurationPatternDrawer` as thin wrappers. Direction **B** for the turn library
  (named presets/rhythms replace the 8/16-only Templates browser; Uniform folds
  into period-1 + amount).
- **Phase 2 — Reversals.** New Reversals drawer in the create module. Wire the
  diamond-edge load + `transformSequence` apply path; reuse the same
  `PatternStripEditor` with the boolean binding.

## Saved patterns

Secondary, retained but de-emphasized: a "Save current strip" affordance and a
"Your patterns" list can persist/restore a strip (existing Firebase
`turnPatterns` / `durationPatterns` collections). It is no longer the primary UI
and lives below the compositional controls. Reversal saved patterns are Phase 2.

## Non-goals (v1)

- Solo / dense-weave / sparse-weave rhythms in the create UI (reversal-only for
  now; the shared engine can adopt them later without API change).
- Per-beat-varying amounts beyond inline editing (e.g. Wave 2·1 as a named
  preset) — expressible by editing the strip; not a first-class chip in v1.
- Mobile horizontal-scroll polish for long strips (cells flex-shrink with a
  min-width floor; ≥ 8 visible columns at narrow widths may scroll — refine in
  implementation).
- Migrating choreo-card deck rendering onto `PatternBeatStrip` (optional later
  reuse; not required for these drawers).

## Success criteria

1. Turn, Reversal, and Duration drawers all render from one
   `PatternStripEditor` + `PatternBeatStrip`, differing only by binding config.
2. The rhythm catalog + mask engine have a single shared source; `choreo-card`
   consumes it (no duplicate definitions; deck-variation output unchanged).
3. Turn presets tile to any length divisible by their period — no empty browser
   at 12 / 20 / 24 beats.
4. Editing a cell never locks a rhythm; chips highlight purely by derivation.
5. Duration drawer is reduced to Length × Rhythm × Hold (category browser,
   save/apply tabs, preview/confirm flow removed).
6. AAA contrast + ≥ 44px touch targets; no checkbox inputs; reuses
   `SegmentedControl` / `FilterChipBase` rather than hand-rolled chips.
