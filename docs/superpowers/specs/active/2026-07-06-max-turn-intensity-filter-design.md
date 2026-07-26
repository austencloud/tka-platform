---
status: active
value: 3
effort: M
remaining: "Body status: Design approved (pending spec review), then plan"
depends_on: ""
plan_path: ""
tags: []
last_triaged: 2026-07-25
---
# Max Turn Intensity Browse Filter — Design

**Date:** 2026-07-06
**Status:** Design approved (pending spec review), then plan
**Author:** Austen + Claude

## Summary

Add a **Max Turn Intensity** filter to the community-library browse filter
vocabulary. It filters sequences by a turn ceiling — "≤ N turns" — the same
knob the generate panel exposes, but as a *retrieval* filter over existing
sequences instead of a *generation* constraint. Because it becomes a
`BrowseFilterType`, **Smart Collections inherit it automatically** with no
smart-collection code change. This closes the exact gap Austen hit: a Smart
Collection of "16-step, level 2, ≤1 turn, quartered-rotated-loop" sequences.

## Motivation

The generate panel can cap turn intensity (`TurnIntensityCard`,
`config.turnIntensity`, a ceiling applied per-motion during generation). The
browse filter surface has no equivalent, so a Smart Collection — which is built
entirely from browse filters — cannot express a turn-intensity constraint.
Length, level, and loop-type filters already exist; only the turn ceiling is
missing.

## Key finding: no backfill needed

The community browse pool **already carries per-motion turns**, so this is a
pure client-side computed filter (like the TnD-family filter), not a
data-migration:

- `StepPairingData` omits turns, but per-hand `turns: number | "fl"` lives in
  `SoloPropStepData` (`solo-prop-step-data.ts:17`).
- `blueSoloProp`/`redSoloProp` are stored in the public index and loaded into
  every community sequence (`public-sequences-loader.ts:317`), then hydrated
  (`:336`).
- `hydrate` → `deriveSteps` maps the solo-prop turns onto the reconstructed
  motion: `step-deriver.ts:95` (`turns: step.turns`). Verified.

So `seq.steps[i].blue.turns` / `.red.turns` are present in the pool. No
precompute, no publish-pipeline change, no corpus backfill.

## Semantics

The filter value `N` is a **ceiling**. A sequence matches "≤ N turns" iff its
**max numeric turn across every step and both hands ≤ N**.

- `"fl"` (float) motions have no numeric turn count and **always pass** any
  ceiling — identical to how generation treats float
  (`loop-parameter-provider.ts`: `if (t === "fl") return true`).
- A sequence with no turns (all 0, or all float) has a max numeric turn of 0 and
  therefore satisfies every ceiling.
- `maxNumericTurn(seq)` = `max` over steps × {blue, red} of
  `typeof turns === "number" ? turns : -Infinity`, floored at 0.
- Memoized per-`SequenceData` in a module `WeakMap` (mirrors
  `getSequenceTnDFamilies`'s `tndFamilyCache`), so repeated filter/count passes
  over the same pool don't recompute.

## Value ladder: derived from the pool

The offered ceilings are the **distinct max-numeric-turn values actually present
in the pool**, ascending, each carrying a live count — no dead-end options
(same principle as `availableLengths` and the Length/Letter filters). Half-turn
ceilings (≤0.5, ≤1.5, ≤2.5) appear only when half-turn sequences exist in the
corpus. Display format: `≤N` (e.g. "≤1", "≤1.5"), matching the generate card's
`≤${value}`.

The engine exposes `availableMaxTurnIntensities: number[]` (a `$derived` over
`allSequences`, same shape as `availableLengths`) that the chip and drill read.

## Components & data flow (mirrors the DIFFICULTY filter)

| Seam | Change |
|---|---|
| `filtering-enums.ts` | Add `MAX_TURN_INTENSITY = "max_turn_intensity"` to `BrowseFilterType`. |
| `browse-filter.ts` | Add `filterByMaxTurnIntensity` (ceiling predicate + memoized `maxNumericTurn`), a dispatch case in `applyFilter`, and a `getFilterOptions` case. |
| `create-browse-engine.svelte.ts` | Add `availableMaxTurnIntensities` `$derived` + a public getter. `addFilter` needs no change — one-per-type keying (`String(type)`) is the default, correct for a single-select ceiling. |
| `MaxTurnIntensityFilterChip.svelte` (new) | Clone `LevelFilterChip`: a dropdown chip listing "All" + each `≤N` with `getFilteredCount` previews. |
| `BrowseFilterBar.svelte` | `activeMaxTurnIntensity` derived, `handleMaxTurnIntensitySelect`, render the new chip after the Level chip (gated `!chipsOnly`, and reasonably `!isHandsMode` since hands-mode has no turn semantics — confirm during build). |
| `GalleryDrill.svelte` | Add a `max_turn_intensity` section: a values `$derived` (from `getCount` per available ceiling, filtered to count>0), the drill screen (mirror the Length "monument" rows), a mini-tile in the chooser, and register the section in the `SECTIONS`/type union. |
| `messages/en.json` | New i18n keys (chip label "Max Turns", "All turn intensities", `≤{n}` value label). Other locales stale — normal, tracked. |
| Smart Collections | **No change.** `buildFilterSpecFromEngine`/`applySpecToEngine`/`deriveSpecMembers` are filter-agnostic; the new type flows through automatically. |

## Error handling & edge cases

- Sequences whose steps failed to hydrate (empty `steps`) have max numeric turn
  0 → they satisfy every ceiling. Acceptable (a no-turn sequence is low
  intensity); the same sequences are already edge-cased by the difficulty/TnD
  filters.
- Hands-mode: turn intensity is prop-motion semantics; if the chip reads
  awkwardly in hands view, gate it `!isHandsMode` like the Level chip.

## Testing

Unit (`browse-filter` predicate): construct `SequenceData` fixtures with steps
carrying mixed turns (0, 0.5, 1, "fl", 2) and assert:
- `≤1` includes the all-≤1 and the float-only and the zero sequences, excludes
  the one with a 2-turn motion.
- `"fl"` never disqualifies.
- `maxNumericTurn` memoization returns a stable value.

Runtime acceptance (report to Austen, needs a browser): in the gallery, the
Max Turns chip lists real `≤N` options with non-zero counts, and picking `≤1`
yields sequences whose heaviest turn is ≤1. This is also the guard that
confirms the pool truly carries turns at runtime (static evidence is strong;
this is the belt-and-braces check).

## Contingency (documented, not expected)

If runtime shows the community pool's hydrated motions report `turns: 0`
universally (i.e. the static chain is somehow broken in practice), the fallback
is to precompute `maxTurnIntensity` at publish time and store it on the public
index doc (like `level`), plus a one-off backfill script. The static evidence
(`step-deriver.ts:95`) makes this unlikely, but the acceptance check exists to
catch it before the UI ships.

## Out of scope

- Changing the generate panel (this is retrieval, not generation).
- Min/range turn filters (ceiling only, matching generate).
- Exposing turn intensity anywhere outside the browse filter vocabulary.

## Reuse ledger (never-hand-roll)

| Need | Reused |
|---|---|
| Numeric single-select filter pattern | `filterByDifficulty` (`browse-filter.ts`) |
| Computed-filter memoization | `getSequenceTnDFamilies` WeakMap pattern |
| Available-values derived | `availableLengths` (`create-browse-engine.svelte.ts`) |
| Dropdown chip w/ count previews | `LevelFilterChip.svelte` |
| Drill value section | GalleryDrill Length "monument" rows |
| Smart-collection integration | none — inherited via the existing filter-agnostic serialization |
