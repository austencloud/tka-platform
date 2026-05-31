# Per-Prop Override Unification — Design

**Date:** 2026-05-30
**Status:** Approved direction, pending spec review
**Author:** Claude (Opus 4.8) + Austen

## Goal

Collapse the arrow-positioning override pipeline from **four tiers** (Global Override → Special JSON → Prop Geometry → Default) to **two prop-scoped tiers** (Special → Default), where *every* override is keyed by prop type. Editing an arrow while viewing prop X always and only adjusts prop X. Render output must be pixel-identical before and after.

This extends the philosophy already shipped for the **Default** tier (per-prop datasets seeded from staff) to the **Special** tier. After this work, the whole editable pipeline is prop-specific and unique per prop, so the question "am I editing a generic value or a prop-specific one?" no longer exists — there is no generic value.

## The Problem This Solves

1. **Redundant override systems.** Two Firestore override layers do the same job: `global_arrow_adjustments` (the "Global Override" tier) and `special_arrow_placements` (the Special JSON override). The user only ever wanted one editable layer.
2. **An empty `[0,0]` Global record shadows real Special JSON values.** `GlobalArrowAdjustmentState.getAdjustment` returns a truthy `Point(0,0)` for a stored zero record (it only returns null when the record is *absent*), and active-tier selection treats any non-null global as the winner. A WASD nudge that nets back to base persists a `[0,0]` record; nothing prunes zeros. Result: the editor edits a dead layer.
   - Evidence: `src/lib/shared/pictograph/arrow/positioning/global/state/GlobalArrowAdjustmentState.svelte.ts` `getAdjustment`; `src/lib/shared/pictograph/arrow/positioning/calculation/services/arrow-adjustment-calculator.ts` active-tier block (~line 421).
3. **WASD does not move the arrow in the pressed screen direction.** The Inspect dock writes raw screen deltas into reference-space tier values, skipping the per-quadrant inverse. The correct inverse component (`ScreenSpaceAdjustmentTransformer.transformToReference`) already exists but is wired only into the *old* step-editor path, not the Inspect dock.
   - Evidence: `src/lib/features/create/shared/components/sequence-actions/pictograph-inspect/PipelineEditorDock.svelte` `handleWASDMovement`; `src/lib/shared/pictograph/arrow/positioning/calculation/services/screen-space-adjustment-transformer.ts`.
4. **Prop Geometry tier is confusing clutter.** Now that prop-awareness is moving natively into Special, the separate Prop Geometry tier has no conceptual reason to exist in the editor.

## Current Live Data (read 2026-05-30)

`global_arrow_adjustments`: **120 records, all non-zero, all authored by austencloud@gmail.com since 2026-04-04.** Zero junk `[0,0]` records currently exist.

| Layer | Count | Maps to |
|---|---|---|
| L1 (5-part, prop-agnostic base) | 60 | **staff** special |
| L2 staff (6-part) | 32 | staff special |
| L2 fan | 15 | fan special |
| L2 bighoop | 12 | bighoop special |
| L2 hand | 1 | hand special |
| L3 combo (7-part) | 0 | — none exist |

Letters covered: A, B, C, D, F, G, H, I, J, L, M, O, P, Q, R, S, T, V, W, X-, Y, Z, Z-, Δ, Δ-, Λ-, Φ, Ψ, Ψ-, Ω-.

`oriKey` values appear in both raw form (`clock_clock`, `in_out`, `out_out`, …) and resolved folder form (`from_layer1`, `from_layer2`, `from_layer3_blue1_red2`, …). Migration must normalize raw → folder via `resolveEffectiveOriKey`.

**Prop Geometry collection:** audit during implementation (collection name + count). Same treatment as Global — migrate any records to the relevant prop's special, parity-check, then retire the tier. If empty, just retire.

## Target Architecture

### Tiers (after)

```
Special(thisPropType)  →  static per-letter special file (shared baseline)  →  Default(thisPropType)
```

- **Global Override tier: deleted** (render read + module + UI).
- **Prop Geometry tier: deleted from the editor UI**; its prop-aware data migrated into Special; render tier retired after parity.
- **Special** and **Default** are both prop-scoped.

### Special override key

Current: `gridMode|oriFolder|letter|turnsTuple|motionType|attributeKey`
New: `gridMode|oriFolder|letter|turnsTuple|motionType|attributeKey|propType` — **propType is mandatory, never omitted.**

- `propType` is the lowercased prop for the arrow being edited, sourced from settings (`bluePropType`/`redPropType`) the same way the dock's `thisPropType` already resolves it.
- No prop-agnostic fallback in the override lookup. A prop with no override for a key falls through to the **static per-letter special file** (shared baseline), then **Default(thisPropType)**.

### Lookup cascade (render)

For a given arrow with `propType = P`:
1. `special_arrow_placements` override at the 7-part key (with `P`). If present → use it.
2. Static per-letter special file value (`{grid}/special/{oriFolder}/{letter}_placements.json`, keyed by turnsTuple → attributeKey). Shared across props (the shipped baseline).
3. `Default(P)` (already per-prop).

This reproduces Global's `L2 → L1 → static → default` for staff and `L2 → static → default` for non-staff props (Global deliberately blocked non-staff L1 fallback), so render is identical.

### Why parity holds

- **staff** value at any key was `L2-staff ?? L1` under Global. Migrated staff special = merge(L1 records, L2-staff records) with L2-staff winning on key clash → same value.
- **non-staff prop** value was `L2-prop` only (Global blocked L1 fallback for non-staff). Migrated prop special = L2-prop records → same value, no staff bleed.
- **untuned props/letters** had no Global record → fell to static special → default. Unchanged after migration.

## Migration Design

A Node script (`scripts/migrate-global-to-special-per-prop.mjs`), dry-run first, that:

1. **Reads** all `global_arrow_adjustments` records (and audits the prop-geometry collection).
2. **Resolves a target prop** per record: L1 → `staff`; L2 → its `propType`.
3. **Derives the special key fields** by *replaying* each record against the real letter variation, using the app's own generators (imported, not re-implemented):
   - `oriFolder` = `resolveEffectiveOriKey(record.oriKey)` (pass-through when already a folder form).
   - `motionType` = the motion type of `record.letter`'s variation for `record.arrowKey` at the record's `turnsTuple`/orientation. Derived from the canonical pictograph dataset the app loads (the same source `generatePlacementKey`/lookup use). Where a letter+color+turns+ori resolves to one motion type, that is the value; ambiguous matches are reported, not guessed.
   - `attributeKey` = `getKeyFromArrow(...)` for the variation (≈ color for non-hybrid letters; motionType for hybrids).
4. **Writes** the value to `special_arrow_placements` at the 7-part key (with target prop). On key clash, L2 beats L1.
5. **Parity verification gate (blocking):** for every migrated record, compute the rendered base adjustment two ways and assert equality:
   - (a) current pipeline with Global **enabled** (today's value).
   - (b) new pipeline with Global **disabled**, reading only Special(prop) → static → Default(prop).
   - If any record fails parity, the migration **aborts** and reports the failures. No source data is deleted.
6. **Idempotent + reversible:** the script can re-run safely; it writes a `migration-report.json` listing every source→target mapping and the parity result, so the original Global records can be reconstructed if needed. Global records are **not deleted by this script** — deletion is a separate, explicit step after Austen has eyeballed render parity in the app.

## Render-Pipeline Changes

- `src/lib/shared/pictograph/arrow/positioning/placement/services/special-placer.ts`: remove the global cascade read (the step-0 block ~lines 94-120). Special override lookup now keys on the 7-part (prop-inclusive) key.
- `src/lib/shared/pictograph/arrow/positioning/calculation/services/arrow-adjustment-calculator.ts`: remove the Global tier from `getDiagnostics` and from `getBaseAdjustment`/`lookupSpecialPlacement`; remove the Prop Geometry tier from the cascade after its data is migrated. Keep the special-override lookup, now prop-keyed.
- `special-override` repository/persister/state + `SpecialArrowPlacement` domain: add mandatory `propType` to the key generator, doc schema, and read/write methods. Back-compat: a legacy 6-part doc (no propType) decodes as `staff` (staff is the canonical prop), matching the per-prop Default tier's legacy handling.
- Keep the shared re-render counter currently named `globalAdjustmentVersion`; rename to `arrowAdjustmentVersion` (it is incremented by *all* tier edits, not just global). All importers updated, incl. `PictographContainer.svelte`.

## Dock / UI Changes (`PipelineEditorDock.svelte`, `PipelineTraceSection.svelte`)

- **Edit target is always Special.** Remove the tier `SegmentedControl` (Global/Special/PropGeo/Default) — there is one editable tier. The dock header shows `{color} · {propType} · Special` (reuses the existing ghost-sizer no-layout-shift title).
- **Remove** the Base/Prop/Combo layer toggle (that was Global's L1/L2/L3 concept; Special is single-prop, no layers).
- **Trace section** shows: Special(thisProp) value, the static baseline it shadows (struck-through when overridden, like today's `original` row), and Default(thisProp). No Global, no Prop Geometry rows.
- **WASD screen-direction fix:** in `handleWASDMovement`, convert the screen-space delta `(dir.dx, dir.dy)` to a reference-space delta via `screenSpaceAdjustmentTransformer.transformToReference(new Point(dx,dy), motion, arrowLocation)` before applying to `editX/editY`. `arrowLocation` derived in the dock via `arrowLocationCalculator.calculateLocation(motion, pictographData)`. Per-delta transform (single-axis WASD, integer `|det|=1` matrices → drift-free).
- Defensive: never persist a `[0,0]` override; treat a zero override record as absent on read (applies to the unified Special tier).

## Components To Remove After Migration + Parity

- `src/lib/shared/pictograph/arrow/positioning/global/**` (module, state, repo, persister, key-gen, tests).
- Global init in `src/lib/shared/auth/services/auth-boot-orchestrator.ts`.
- Global handlers + tier in `PipelineEditorDock.svelte`, `ArrowAdjustmentPanel.svelte`, `ArrowAdjustmentHistory.svelte`, `arrow-adjustment/ArrowLayerModal.svelte`; rework the old orchestrator WASD path (`arrow-adjustment-orchestrator.ts` `applyWASDMovement`) to target Special, or retire it if the old panels are dead.
- Prop Geometry editor UI references (tier option, trace row, handlers).
- `firestore.rules` global block; optionally drop the `global_arrow_adjustments` collection once parity confirmed in-app.

## Testing

- **Unit:** special key generator includes propType; legacy 6-part decodes to staff; zero-override treated as absent; `transformToReference` round-trips screen→reference→screen for each quadrant/motionType/rotation (W/A/S/D land on the pressed direction).
- **Migration parity (the gate):** automated assertion that all 120 (+ any prop-geometry) records render identically with Global off. Must be 100% before deletion.
- **Manual:** Austen opens representative tuned letters (I, P, M, H, plus a fan and a bighoop variation) in Inspect and confirms arrows are unchanged; then confirms WASD moves the selected arrow in the pressed direction and adjusts only the current prop.

## Sequencing (no regression at any step)

1. Add mandatory `propType` to the Special override key/schema/read-write (back-compat staff). Render still reads Global first — no behavior change yet.
2. Run migration script (dry-run → verify parity report → write to `special_arrow_placements`). Global still authoritative; Special now also holds the values.
3. Flip render: remove Global read so Special(prop) is authoritative. Parity test green.
4. Wire WASD screen-direction transform; make Special the sole edit target; strip Global + Prop Geometry from the dock + trace.
5. Migrate/retire Prop Geometry tier; defensive zero-handling.
6. After Austen confirms in-app: delete Global module, old WASD path, rules block, and (optionally) the Firestore collection.

## Open Items (resolved during implementation, not blockers)

- Prop Geometry collection name + record count (audit in step 5).
- Whether the old `ArrowAdjustmentPanel`/step-editor WASD path is still mounted anywhere live; if dead, delete rather than rework.
