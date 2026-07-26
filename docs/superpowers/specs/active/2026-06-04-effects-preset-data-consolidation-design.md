---
status: active
value: 2
effort: XS
remaining: "Body status: Implemented 2026-06-12. Presets are data-first (`patch`/`resolvePatch`), `applyPreset(effectType, presetId, patch)` is single-undo, `effects-preset.ts` deleted, one shared chip handler in EffectsPanel. Unit-verified (50 tests: state `applyPreset` incl. single-undo assertion + preset-data invariants); svelte-check clean for the touched files. In-browser checklist below still owed at…"
depends_on: ""
plan_path: ""
tags: []
last_triaged: 2026-07-25
---
# Effects Preset Data Consolidation — Design

**Date:** 2026-06-04
**Status:** Implemented 2026-06-12. Presets are data-first (`patch`/`resolvePatch`), `applyPreset(effectType, presetId, patch)` is single-undo, `effects-preset.ts` deleted, one shared chip handler in EffectsPanel. Unit-verified (50 tests: state `applyPreset` incl. single-undo assertion + preset-data invariants); svelte-check clean for the touched files. In-browser checklist below still owed at PR review.
**Prerequisite:** Dead-code removal (shipped 2026-06-04): `effects/domain/presets/` built-ins, `led-settings-section.ts`, `EffectsOverrides` layer, `findPreset`. This spec covers the follow-up refactor only.

## Problem

The 16 live preset files under
`src/lib/shared/animation-engine/components/effects-panel/presets/` all carry
the same boilerplate: a private `applyX(state, presetId, patch)` helper plus
per-preset `apply` closures that exist only to feed it. The data each preset
actually contributes is a static `Partial<Intent>` patch — but it's trapped
inside imperative closures, so it can't be inspected, serialized, or reused.

The helper itself is a workaround stacked on a workaround
(`led-presets.ts:14-26`, identical in all 16 files):

```ts
function applyLed(state, presetId, patch) {
  state.updateEffect("led", patch);
  // updateLed nulls activePresets.led; restore it so the chip stays highlighted.
  state.applyPreset({
    id: presetId,
    effectType: "led",
    patch: { activePresets: { ...state.activePresets, led: presetId } },
  } as unknown as EffectsPreset);
}
```

Three concrete defects:

1. **Double undo entry.** `updateEffect` runs
   `captureState` → `commitStateCoalescing`, then `applyPreset` runs
   `captureState` → `commitState`. Applying one preset chip costs the user
   two Ctrl+Z presses to revert.
2. **The `as unknown as EffectsPreset` cast.** The second call fabricates a
   fake preset whose patch only touches `activePresets` — it abuses
   `applyPreset` as a "set the chip highlight" backdoor. The cast is needed
   because the fabricated object doesn't satisfy the type it's pretending
   to be.
3. **16 copies of the same helper**, each importing 4 types to express
   "merge this patch, remember this preset id."

Meanwhile `applyPreset` in `effects-config-state.svelte.ts` already does the
right thing in one step — merge patch, set `activePresets[effectType]`, single
undo capture/commit. The boilerplate exists because the panel presets never
handed it a real patch.

## Grep evidence (per never-hand-roll)

- `state.applyPreset` callers: exactly the 16 preset files, all via the fake-cast hack. No other consumers.
- `EffectsPreset` (`effects/domain/effects-preset.ts`) importers: the same 16 files (type-only, for the cast) + `effects-config-state.svelte.ts`. After this refactor the type has no remaining purpose → delete the file.
- Preset chip consumer: `EffectsPanel.svelte:88` (`preset.apply(effectsConfigState)`), summary at `:65`.
- Dynamic presets (the only non-static data): `trail-presets.ts` "Custom" and `fire-presets.ts` "Custom" read their colors from localStorage at apply time (`loadCustomTrailColors` / `loadCustomFireColors`).

## Design

### 1. `EffectPreset` becomes data-first (`presets/types.ts`)

```ts
import type { EffectConfigMap } from "$lib/shared/effects/state/effects-config-state.svelte";

export interface EffectPreset<E extends keyof EffectConfigMap = keyof EffectConfigMap> {
  id: string;
  name: string;
  /** CSS color for the preview dot, "rainbow", or "custom". */
  previewColor: string;
  previewColor2?: string;
  /** Static intent patch. The normal case (62 of 64 presets). */
  patch?: Partial<EffectConfigMap[E]>;
  /**
   * Dynamic presets resolve their patch at apply time. Only the two
   * "Custom" presets (trails, fire) use this — they read user-picked
   * colors from localStorage. Exactly one of patch/resolvePatch is set.
   */
  resolvePatch?: () => Partial<EffectConfigMap[E]>;
}
```

`apply: (state) => void` is removed. `EffectPresetGroup` keeps `effectType`,
`presets`, `getSummary` unchanged — `getSummary` is a pure read of current
state and is not part of the problem.

### 2. `applyPreset` gets an honest signature (`effects-config-state.svelte.ts`)

Replace the `EffectsPreset`-typed `applyPreset` with:

```ts
function applyPreset<K extends keyof EffectConfigMap>(
  effectType: K,
  presetId: string,
  patch: Partial<EffectConfigMap[K]>,
) {
  sceneUndo.captureState("apply-effect-preset", `Apply ${effectType} preset`);
  (config as any)[effectType] = { ...(config as any)[effectType], ...patch };
  config.activePresets[effectType] = presetId;
  scheduleSave();
  sceneUndo.commitState();
}
```

One undo entry. No fabricated objects. No cast. Note this drops the
`mergeConfig` round-trip — preset patches only ever touch one effect's
intent, so a shallow per-effect merge (same as `updateEffect`) is the
correct depth.

### 3. One shared chip handler (`EffectsPanel.svelte`)

```ts
function applyPresetChip(group: EffectPresetGroup, preset: EffectPreset) {
  const patch = preset.resolvePatch ? preset.resolvePatch() : (preset.patch ?? {});
  effectsConfigState.applyPreset(group.effectType, preset.id, patch);
}
```

Replaces the `preset.apply(effectsConfigState)` call at line 88.

### 4. The 16 preset files become data

Example (`led-presets.ts` after):

```ts
export const LED_PRESETS: EffectPreset<"led">[] = [
  {
    id: "led-green-glow",
    name: "Green Glow",
    previewColor: "#00ff88",
    patch: { colorMode: "unified", primaryColor: "#00ff88", patternId: "solid", brightness: 4 },
  },
  // ...
];
```

Each file deletes its `applyX` helper and 3 of its 4 type imports. The two
dynamic presets become:

```ts
{
  id: "trail-custom",
  name: "Custom",
  previewColor: "custom",
  resolvePatch: () => {
    const colors = loadCustomTrailColors();
    return { thickness: 5, brightness: 1.0, blueColor: colors.blue, redColor: colors.red };
  },
},
```

The exported custom-color helpers (`loadCustomTrailColors`,
`saveCustomTrailColors`, `applyCustomTrailColors`, fire equivalents) are
consumed by the Customize panels and stay as-is.

### 5. Delete `effects/domain/effects-preset.ts`

After steps 1–4 nothing imports `EffectsPreset` or `DeepPartial`. The
"presets as serializable Firestore data" aspiration this type encoded is
already dead (its built-in preset data was deleted 2026-06-04). If
user-saved presets ever ship, the data-first `EffectPreset` from step 1 is
the serialization shape — `{ id, name, patch }` round-trips through JSON
as-is (dynamic `resolvePatch` presets are built-in-only and never persisted).

## Alternatives considered

- **Keep `apply` callbacks, just fix the double-undo:** treats the symptom;
  presets stay opaque closures, 16 helpers remain.
- **Route everything through the old `EffectsPreset` + `mergeConfig` path:**
  resurrects the dead data system's full-config `DeepPartial` patches for
  presets that only ever touch one effect. Wrong altitude; deep-merge of the
  whole config per chip click buys nothing.
- **Per-file generic helper instead of typed `patch` field:** still 16 import
  blocks and no serializability. Rejected.

## Touched files

- `presets/types.ts` — interface change
- `presets/*-presets.ts` × 16 — closures → data
- `EffectsPanel.svelte` — one shared apply handler
- `effects-config-state.svelte.ts` — `applyPreset` signature, drop `EffectsPreset` import
- `effects/domain/effects-preset.ts` — delete

## Risks / invariants to preserve

- **Chip highlight:** `activePresets[effectType] = presetId` on apply;
  `updateEffect` (slider edits) still nulls it. Unchanged semantics.
- **Undo:** preset apply must produce exactly ONE undo entry (this is a fix,
  but verify it doesn't coalesce with a preceding slider edit).
- **fire-custom `colorBlend: 1.0` + `propColors`** and **charcoal RGB color
  arrays** are plain intent fields — they move into `patch` verbatim.
- `getSummary` untouched.

## Verification

### Mandatory unit tests (write these as part of the refactor)

The existing `effects-config-state.test.ts` proves the state factory runs
headless in vitest (sceneUndo mocked). Extend it and add a preset-data test
so an agent can verify this refactor without a browser:

> **Known trap:** `effects-config-state.test.ts:4` mocks
> `$lib/shared/3d/undo/getSceneUndoManager`, but the real module is
> `get-scene-undo-manager` (Phase C kebab rename) — the mock silently never
> attaches and the real singleton runs. Fix the mock path FIRST or the undo
> call-count assertions below will count against the wrong object.

1. **`applyPreset` behavior** (extend `effects-config-state.test.ts`):
   - merges the patch into the right effect's intent
   - sets `activePresets[effectType]` to the preset id
   - preserves untouched fields of that intent
   - a subsequent `updateEffect` on the same effect nulls the active preset
   - undo: exactly ONE `captureState`/`commitState` pair per apply (assert
     on the mock's call counts — this pins the double-undo fix)
2. **Preset data invariants** (new `presets/preset-data.test.ts`, iterate
   all 16 groups via the registry's `presetGroups` map or direct imports):
   - preset ids unique across all groups
   - every preset has exactly one of `patch` / `resolvePatch`
   - every static `patch`'s keys are a subset of the corresponding
     `DEFAULT_EFFECTS_CONFIG[effectType]` keys (catches typo'd fields that
     `Partial<Intent>` would also catch, but this guards `resolvePatch`
     returns too — call them with localStorage mocked)
3. `npm run check` clean + full `npx vitest run` clean (one cold run each).
4. Grep-proof: `as unknown as EffectsPreset` → 0 matches;
   `effects-preset` imports → 0 matches; `\.apply\(` on presets → 0 matches.

### Deferred to PR review (human, in-browser)

For at least trails, fire (incl. Custom), LED, charcoal: click each chip →
effect visibly changes, chip highlights, summary line updates, ONE Ctrl+Z
fully reverts, reload restores the highlighted chip. List this checklist in
the PR description. Worst-case failure mode if the agent gets the chip
plumbing subtly wrong is cosmetic (highlight/summary), not data loss — the
intent merge path is unit-covered.
