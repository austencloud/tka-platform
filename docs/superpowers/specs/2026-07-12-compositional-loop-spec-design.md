# Compositional LOOP System — Design

**Date:** 2026-07-12
**Status:** Approved (conversational, session "LOOP detector accuracy")
**Owner decisions:** Austen — two-tier UI, canonical nesting, spec-first resolver, clear-on-edit, detection completeness committed "sooner rather than later"

## Problem

The flat `LOOPType` string + single `period` knob cannot express the real algebra of LOOP composition. Three findings (verified with real generated sequences, see `scratchpad loop-spec-variants.md` session artifacts):

1. **Per-component periods.** `mirrored_inverted_rotated` at 16 beats has at least three distinct realizations (rot:4/mir:2/inv:2, rot:2/mir:2/inv:2, rot:2+mir:2 with inv:4 overlaid). `loopSpecFromLegacy` smears one period across all components, collapsing them.
2. **Nesting order matters.** Same components + same periods produce different sequences depending on which transform runs innermost (verified: {mir:2, inv:4} single-spec vs sequenced). The engine currently hard-sorts fused groups descending (`spec-executor.ts` `groupFuseableByPeriod`).
3. **Overlay mode exists.** Inversion never moves a hand location, so it can be applied IN PLACE over an already-expanded sequence (×1 length): identical positions, motion types + rotation directions toggling on a block rhythm. Verified: 0 position diffs, 0 orientation continuity breaks, 0 unknown letters, closes. The spec model anticipated this (`LOOPDomain: "orientation"` — "positions stay pinned").

Detection is blind to every new shape (overlay inversion collapsed detection from mirrored+rotated to just "mirrored"), and the UI offers no way to choose among realizations.

## Decisions (with rationale)

| # | Decision | Rationale |
|---|---|---|
| D1 | **Two-tier UI.** Simple component picker unchanged; a "Rhythm" disclosure in the combo overlay exposes per-component interval + overlay. Defaults reproduce today's output exactly. | Novices never see the tier; experts get the full (curated) algebra. Gallery of named shapes layers on later as presets over the same controls. |
| D2 | **Canonical nesting law, never a knob:** rotation innermost → mirror/flip/swap expansion → inversion outermost; inversion alone additionally offers overlay. | Every combo has exactly one meaning. Matches MCP-grounded canon (rotation is always the innermost layer) and Austen's own instincts (both his proposed shapes put inversion on top). Makes complete detection tractable (finite canonical space). Exotic shapes (e.g. inversion-innermost) return later as named gallery shapes if they earn a slot. |
| D3 | **Spec = intent, detection = evidence.** Resolver precedence: intact spec > detection > dirty/absent spec. Disagreement between intact spec and detection is surfaced (flag/telemetry), never silently overridden. | For an unedited generated sequence, "the executor ran this spec" beats pattern inference. Detection remains authoritative for legacy/imported/hand-built content. The disagreement channel keeps both systems honest. |
| D4 | **Clear spec on beat-level edit.** Any step mutation drops `loopSpec` (detection takes over). Re-verify-on-edit is a later upgrade behind the same resolver contract. | An intact spec is a proof certificate; a stale one is a rumor. Simple, never lies. |
| D5 | **Detection completeness over the canonical algebra is committed roadmap** (Phase 4), not a ship-gate for generation. | Canonical law turns detection into the inverse of generation: peel outermost seam relation, recurse, plus block-wise overlay check. Needed for the labeler and hand-built content regardless. |

## Canonical algebra

- **Components:** rotated, mirrored, flipped, swapped, inverted, rewound (rewound stays standalone/exclusive).
- **Per component:** `interval` ∈ {2, 4} and `mode` ∈ {expand, overlay}.
- **Nesting law (fixed):** rotated (innermost) → mirrored/flipped/swapped → inverted (outermost). Expanders multiply length by their interval; overlays multiply by 1.
- **Overlay legality:** only location-preserving transforms. v1: INVERTED only. (SWAPPED is conditionally location-preserving; out of scope v1.)
- **Overlay semantics (verified in variant E):** partition the final sequence into `interval` equal blocks; on odd blocks flip motionType pro↔anti and rotationDirection cw↔ccw in place (dash/static types untouched); recompute the orientation chain from the start position forward; re-derive letters per beat. Positions are untouched by construction, so closure is preserved.
- **Tier-2 v1 exposure:** rotation interval (2/4 — the existing Period choice, relocated into the combo overlay), inversion interval (2/4) + expand/overlay toggle. Mirrored/flipped/swapped remain fixed interval-2 expanders in v1 (quarter-toggle mirror, variant D, returns later as a gallery shape).

## Wire format

`packages/sequence-engine/src/loop/loop-spec.ts`:

```ts
export interface ComponentSpec {
  readonly period: number;              // existing
  readonly domain?: LOOPDomain;         // existing (detection semantics)
  readonly mode?: "expand" | "overlay"; // NEW; absent = "expand"
}
```

- Wire form (`ComponentSpecWire`) gains the same optional field. All previously stored specs remain valid (absent mode = expand).
- `validateLOOPSpec` gains rules: `overlay_legality` (mode overlay only on INVERTED in v1), `rewound_exclusivity` unchanged, `minimum_period` unchanged.
- `SequenceData.loopSpec` already exists (`sequence-data.ts:111`) — no schema change app-side.
- Legacy `loopType` string remains as a derived compat/display field, computed from the spec's component set.

## Engine execution

`spec-executor.ts` (`executeSymmetricSpec`):

1. **Replace descending-period sort with the canonical order.** Stage order: ROTATED stage (existing), then fuseable expand-groups ordered mirror/flip/swap before inverted (group by period within a layer as today). **Migration safety:** the legacy path (`loopSpecFromLegacy`) assigns one period to every component → a single fused group → ordering change cannot affect any existing caller. Re-run the production fixture audit (`tests/unit/loop/real-loop-detector-audit.test.ts`) to prove zero behavioral drift.
2. **Add the overlay stage, always last.** For each component with `mode: "overlay"`: apply the in-place block transform per the semantics above. Orientation recompute via `updateStepOrientations` chain. Letter re-derivation stays the caller's job (SequenceBuilder already re-derives via `findLetterByMotions`) — the overlay stage must leave letters untouched so the caller's pass is authoritative.
3. `FusedExecutor` unchanged.

## Generation plumbing

`SequenceBuilder`:

- **Honor the dead `options.loopSpec` param** (declared `SequenceBuilder.ts:190`, never read). When present it wins over `options.loop` type+period.
- **Seed length:** `total / Π(expander intervals)`. Overlays don't divide. Non-integer → invalid combo for that length (UI blocks with reason).
- **Seam targeting:** `determineEndPositionForSpec` (exists, `LOOPEndPositionSelector.ts:116`) already derives the seed end position from the innermost location-relevant component.
- **Degenerate guard:** if the computed seed is too short to carry pro/anti content (e.g. 1-letter halved seeds are structurally dash-only — a half jump in one beat is always a dash), block inversion-bearing combos for that length with a stated reason.
- **Write the full spec** onto the result (`SequenceData.loopSpec`), alongside the derived legacy `loopType`.

App-side: generation config (UI state) → `LOOPSpec` construction in one place (extend `loop-type-utils.ts` scope: `buildLoopSpec(components, rhythm)`), passed through the generation orchestrator.

## Spec lifecycle

- **Write:** generation (and only generation) writes an intact spec.
- **Invalidate:** any beat-level mutation (step edit, add, remove, turn change, motion change) clears `loopSpec`. Implementation: single chokepoint in the sequence mutation service(s); grep-audit all step-mutating paths.
- **Resolve (display):** `loop-display-resolver.computeLoopDisplay` precedence becomes: explicit input components → **intact stored `loopSpec`** → detection → legacy stored `loopType` string. When intact spec AND detection both available and disagree on the component set: render the spec, log a structured mismatch (sequence id, spec, detected) for triage.

## UI — "Rhythm" tier (combo overlay)

Inside `LOOPExpandedOverlay` (combo mode), below the component grid, a collapsed disclosure "Rhythm":

- **Rotation row** (when rotated selected): Half turns / Quarter turns — `SegmentedControl`. Replaces/relocates the Period card's role for combo LOOPs; the standalone Period card remains for simple (non-combo) LOOPs.
- **Inversion row** (when inverted selected): rhythm Halves / Quarters (`SegmentedControl`) + mode toggle "Adds length / On top" (button + toggle-indicator pattern, no checkboxes). Plain-language caption per state, e.g. on-top quarters: *"Props flip spin direction every quarter — hand positions stay the same."*
- **Word math line** (always visible when combo valid): `4 letters × 2 (rotation) × 2 (mirror) = 16 beats · inversion on top`. Uses `tabular-nums`; reserve worst-case width (no-layout-shift rule).
- **Block timeline strip:** a row of `interval`-driven cells (4 or 8) showing each block's transform state by color/icon — the novice bridge; shows what the sequence does without terminology. Reuses LOOPIconStrip colors. Fixed-size cells (no layout shift). This component is designed for reuse (card backs, guide pages later).
- Defaults when the tier is never opened = exactly today's behavior (rotation interval from current period setting, inversion expand@2).
- Gating: `isImplemented`/`canExtendCombo` logic extends to spec validity (seed divisibility, degenerate guard) with stated reasons.

Copy follows the writing guide (no jargon-first labels; fire jam test).

## Representation (read surfaces)

- **`LOOPIconStrip`:** order icons by nesting (innermost first) instead of the fixed display order; interval icon variants already exist (fa-rotate vs fa-arrows-spin; same pattern for inversion). Overlaid components render after a small faded dot separator — the same segment grammar as the word display (`TKAWordGlyph`/`WordHeader` group-dot). One visual language across word, glyph strip, and block timeline.
- Consumers get this automatically (cards, export headers, viewer header) since they all render the shared strip.
- The number-over-icon treatment stays rejected (prior decision — over-information).

## Detection (Phase 4 — committed)

Canonical law makes detection the inverse of generation over a finite space:

1. **Overlay check first:** for each candidate interval k ∈ {2, 4}: blocks equal in locations, odd blocks uniformly type+rotation flipped → strip the overlay (un-invert odd blocks), record `inverted@k overlay`, continue on the normalized sequence.
2. **Peel expanders outermost-in:** test the half-seam relation (mirror/flip/swap/invert per the canonical pair-relation algebra in `pair-relation.ts`), recurse into the first half; innermost remainder tested for rotation (the 2026-07-12 nested-rotation logic generalizes here).
3. Lands first in the **loop-labeler** (#4, the card path), then engine detector #1 (`detect_loop_pattern` MCP). The 5-detector consolidation (2026-07-05) means #2/#3/#5 inherit or delegate.
4. **Fixtures:** the variant-generator script (session scratchpad `loop-spec-variants.mjs`) graduates to `scripts/` and emits committed fixtures for A/B/C1b/C2/E shapes; contract tests lock detection results per shape.
5. **Mismatch telemetry:** resolver logs intact-spec-vs-detection disagreements; the labeler surfaces them as a review queue.

## Testing

- Engine: unit tests per composition mode (expand orders, overlay in-place invariants: position identity, orientation continuity, closure); fixture audit re-run proving the sort change causes zero drift on legacy paths.
- Generation: round-trip spec → generate → (Phase 4) detect → same spec; seed-length solver cases incl. non-divisible and degenerate guards.
- Resolver: precedence matrix tests (intact/dirty/absent spec × detection agree/disagree/absent).
- UI: combo gating extends existing `loop-type-utils` tests; component test for the Rhythm disclosure only if it ships a regression (test-on-fix discipline).

## Phases

| Phase | Scope | Ships value |
|---|---|---|
| P1 | Engine: `mode` field, canonical stage order, overlay stage, validation rules, fixture-audit proof | Algebra executable end-to-end |
| P2 | Generation: `loopSpec` through SequenceBuilder, seed solver, spec write + clear-on-edit, resolver precedence + mismatch flag | Correct cards for spec-generated content |
| P3 | UI: Rhythm tier, word-math line, block timeline, icon-strip nesting order + overlay dot | User can choose any v1 realization |
| P4 | Detection completeness (labeler → engine), fixtures, telemetry queue | Hand-built/edited content fully labeled |
| P5 | Gallery presets (named shapes incl. variant D), overlay-swap exploration | Discoverability |

## Out of scope (named)

- Asymmetric per-prop specs (blue ≠ red) — typed, execution still throws (Phase 3b follow-on in engine).
- Re-verify-on-edit spec preservation (D4 upgrade).
- Overlay for SWAPPED.
- MCP tool params for compositional specs (follows P2 wire format; engine rebuild + MCP redeploy required regardless).
- Interval 8+ (the `TransformationInterval` widening to 8 exists detection-side only).

## Related

- `.claude/rules/` — chip-primitives (SegmentedControl routing), no-checkboxes, no-layout-shift, clickables-look-like-buttons
- `docs/superpowers/specs/2026-07-05-viewer-shell-anti-drift-design.md` (shared chrome pattern)
- Memory: `project_loop_detection_audit`, `reference_dual_loop_executor_sets`
- Session artifacts: variant examples (`loop-spec-variants.md`), nested-rotation fix commit `a5c9da7f3d`
