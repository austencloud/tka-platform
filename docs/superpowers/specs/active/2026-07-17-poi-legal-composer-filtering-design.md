---
status: active
value: 3
effort: M
remaining: "Body status: Active (design approved, awaiting spec review)"
depends_on: ""
plan_path: ""
tags: []
last_triaged: 2026-07-25
---
# Poi-Legal Option Filtering in the Composer — Design

**Date:** 2026-07-17
**Status:** Active (design approved, awaiting spec review)
**Scope tier:** Filtering only · illegal moves hidden · admin/dev-gated first

## Context

TKA is built for directly-gripped static props (canonical: double staves). Poi is a
**restricted subset** — a momentum-based prop whose orientation is set by gravity and
the tether, not by a grip, so it can perform many TKA sequences but not all. Identifying
that poi-legal subset is the long-planned "Poi Lab" goal.

Most of that work is already **built** and sitting unwired:

- `src/lib/features/levels/poi-lab/services/poi-constraint-validator.ts` — the rule
  engine: `validateMotion(motion)` and `validateTransition(from, to)`, encoding 5 poi
  physics rules (FLOAT only at gravity orientation; ANTI 0 turns impossible; PRO 0 turns
  + IN impossible; DASH ≥ 0.5 turns; no instant CW↔CCW reversal).
- `src/lib/features/levels/poi-lab/services/poi-sequence-validator.ts` — walks a
  `PictographData[]` applying those rules per beat + transition.
- `src/lib/features/levels/poi-lab/services/poi-option-filter-decorator.ts` —
  `filterPoiLegalOptions(options, previousPictograph)`, purpose-built to filter the
  composer's option list. **Zero call sites** — manufactured, never plugged in.
- `get-poi-option-filter-decorator.ts` — its singleton getter.
- Prop selection already ships: per-hand `bluePropType`/`redPropType` in
  `src/lib/shared/settings/state/settings-state.svelte.ts:66-67`, with a settings tab
  (`PropTypeTab.svelte`) and an inline composer picker (`PropTypeRow.svelte`,
  `PropIndicatorButton.svelte`).

This spec wires the existing filter into the composer so that **selecting poi hides the
moves poi can't legally do**, behind a runtime gate, with no other UI change.

## Goal

When a hand's prop is poi, the composer's option picker offers only moves that hand can
legally perform with poi. When neither hand is poi, behavior is unchanged.

## Non-goals (explicitly deferred)

- Poi-native VTG terminology in the picker (the `vtg-terminology-mapper.ts` exists but is
  not surfaced here).
- The poi **trail/animation renderer** (prototyped separately; not part of this spec).
- A real `poi.svg` glyph — poi keeps borrowing `club.svg` (`prop-type.ts:82-86`).
- Public exposure / changing the "Poi Lab: planned, not built" public stance.
- Dual-hand phase modeling.
- Showing illegal moves with a reason (they are hidden, not disabled).

## Design

### 1. Hook point — the `filteredOptions` derivation (Approach A)

The option list flows through one chokepoint:
`option-loader.ts:42-46` (`getNextOptionsForSequence`) → stored raw into `options` by
`option-picker-state.svelte.ts:loadOptions` (`:138`) → displayed via the `filteredOptions`
derived (`option-picker-state.svelte.ts:84-113`, which today does continuity-filter + sort).

**Apply the poi filter inside `filteredOptions`**, after continuity filtering. Rationale:

- It reacts to prop-type changes for free — flip a hand to/from poi mid-build and the
  offered options re-filter without a reload.
- It is display-local and leaves raw `options` intact for any other consumer.
- It sits beside the existing "which loaded options are currently offerable" logic — the
  same concern.

Rejected alternatives: wrapping the `getOptionLoader()` singleton (`option-loader.ts:80-83`)
matches the decorator's shape but touches a shared lower-level service and is not reactive
to a mid-build prop switch; filtering in `loadOptions()` strips illegal options from raw
`options`, which other consumers may want whole.

### 2. Per-hand legality semantics

Prop type is per-hand (`bluePropType`/`redPropType`) and cat-dog mode allows blue ≠ red,
so "poi is selected" is evaluated **per hand**. An option (a candidate `PictographData`
with `motions.blue`/`motions.red`) is offered iff, for each hand H ∈ {blue, red}:

- if `settings.<H>PropType !== POI` → H imposes no constraint; **or**
- if `settings.<H>PropType === POI`:
  - if H's motion is **absent** in this option → no constraint (see §4); **else**
  - `validateMotion(optionMotion[H])` is valid, **and**
  - `validateTransition(previousMotion[H], optionMotion[H])` is valid (when a previous
    beat exists).

Neither hand poi → filter is the identity (staff/fan/club/buugeng users unaffected).

### 3. The one code change — decorator signature

`filterPoiLegalOptions` currently reads `option.motions?.blue?.propType === POI`
(`poi-option-filter-decorator.ts:22-23`). But raw options are not stamped with the user's
prop type until `prepareBatch` (`OptionPicker.svelte:156-160`), which runs **after** the
filter point — so as written the filter always no-ops. Fix:

```
filterPoiLegalOptions(
  options: PictographData[],
  previous: PictographData | null,
  activeProps: { bluePropType: PropType; redPropType: PropType },
): PictographData[]
```

Iterate hands, apply the §2 rule using `activeProps` (not a propType read off the motion).
This also closes the logged bug at `poi-option-filter-decorator.ts:22` (and is the same
class as the logged `poi-sequence-validator.ts:29` / `vtg-terminology-mapper.ts:17`
absent-motion issues — see §4).

### 4. Absent-motion handling

Some steps move only one hand; the other hand's motion is absent under the both-hands step
model. An absent motion imposes **no** poi constraint. This is explicit in §2 and is the
fix for the logged absent-motion bug in the poi-lab services.

### 5. Gating

The composer lives in the always-on core `create` module, so the compile-time module gate
(`src/config/feature-flags.ts`, `__FEATURE_*__`) is the wrong grain. Use a **runtime gate**:
the poi filter is applied only when `import.meta.env.DEV` is true **or** the current user
holds an `admin`/`tester` role (the same admin detection the Poi Lab badge uses). When the
gate is false, `filteredOptions` skips the poi step entirely — the composer is
byte-identical to today. This keeps the feature dark in production and reversible.

## Data flow

```
settings.bluePropType / redPropType  ─┐
                                       ├─> filteredOptions (option-picker-state.svelte.ts:84-113)
previous beat (last pictograph) ───────┤        │ continuity filter + sort  (existing)
raw options (option-loader.ts:42-46) ──┘        │ + gate? poi filter (new)  ──> displayed options
                                                 └─> filterPoiLegalOptions(opts, prev, activeProps)
                                                        └─> validateMotion / validateTransition
                                                            (poi-constraint-validator.ts)
```

## Testing

Unit-test `filterPoiLegalOptions` (pure function) with fixtures:

- **no-poi → identity:** both hands staff → output === input.
- **one-poi:** blue poi, red staff → only blue motions constrained; red never filters.
- **both-poi:** both constrained.
- **absent motion:** a hand's motion absent → not rejected on that hand's account.
- **transition:** legal move whose motion reverses spin vs. the previous beat is rejected.
- **positive fixtures** (must survive): legal poi moves — extension, cat-eye, flowers.
- **negative fixtures** (must be removed): the 5 illegal patterns the validator encodes.
- **gate off → identity** regardless of prop type.

The positive/negative fixtures are the "constructive oracle": poi-native legal moves pass
by construction; the validator's five rules define the illegal set.

## Risks / open questions

- **Empty option list.** If poi filtering removes every candidate for a state, the picker
  shows nothing. Decide UX: an explicit "no poi-legal continuation" empty state vs. leaving
  it blank. (Empty-state copy is a small follow-up; not blocking the filter.)
- **Admin-detection helper.** Pin the exact client-side role check the Poi Lab uses during
  implementation so the gate matches it rather than inventing a second one.
- **Validator coverage.** The 5 rules are a first-pass model; the fixtures will surface any
  gaps, but this spec does not expand the rule set.

## Rollout

Dark by default (gate off in prod) → admin/tester dogfood via the gate → (future, separate
decision) public, paired with terminology + trail renderer and the "planned, not built"
copy update.
