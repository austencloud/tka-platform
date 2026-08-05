# 3D Effects Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the eight stranded 3D effects — goo, bubbles, smoke, petals, sparkles, zap, ghost, bloom — actually render in the 3D viewer, so every Vulcan Cave room can have an elemental motif with its own signature instead of four elements sharing `trails`.

**Architecture:** The renderers are already written and already correctly parameterized. `EffectsLayer.svelte` takes exactly the values `EffectOrchestrator3D` already holds (`bluePropState`, `redPropState`, `isPlaying`, `staffLength`, `currentStep`) and mounts all eight. It is simply rendered nowhere. So this is a **mount-and-verify** job, not a rewrite: mount `EffectsLayer` inside the orchestrator's template, then walk the eight effects one at a time in the motif harness, fixing what the frames actually show. Do not copy 500 lines of derivation into the orchestrator — that would duplicate `calculatePropEnds`, the velocity derivations and the enabled flags, and it is the exact hand-rolling `never-hand-roll.md` forbids.

**Tech Stack:** Svelte 5 runes, Threlte 8, three.js, vitest.

---

## Context an engineer needs before touching anything

**Read these first:**

- `src/lib/shared/3d/effects/EffectsLayer.svelte` — 624 lines, the thing being mounted. Its header comment claims it is "currently unmounted (legacy)". The first half of that is true and the second half is wrong: it holds the only 3D renderers for eight effects.
- `src/lib/shared/3d/effects/EffectOrchestrator3D.svelte` — 817 lines, the component that IS mounted, via `PerformerRig`'s `effectsSlot`. Renders `trails` (Svelte `Trail3D` per tip) plus `led`, `charcoal`, `fire` (imperative renderer classes driven from a `useTask`).
- `src/routes/test/element-motifs/` — the harness this plan is verified in. Six stations, one per VTG category, avatar and props hidden.

**Four facts that will otherwise cost you hours:**

1. **Enabled flags come from the effects-config CONTEXT, not the `tipEffectMap` prop.** Every effect in `EffectsLayer` gates on
   `unifiedState.config.tipEffectMap["*"]?.effect === "<id>"`, where `unifiedState = getEffectsConfigContext()`. `CovenStation` passes a `tipEffectMap` *prop* down to `EffectOrchestrator3D`, which is a different channel. **Selecting an effect per station therefore requires giving that station its own effects-config context** — that is Task 1, and nothing else can be verified until it exists.
2. **`getEffectState()` is a lazy singleton** (`effect-state.svelte.ts:278`). Six stations share one position/velocity history. Positions are passed per-emitter so they are fine; **velocity-reactive emission is not** — with multiple rigs, `blueVelocityVec` reflects whichever rig wrote last. Acceptable for the harness. Flag it if a room ever needs two velocity-reactive performers at once.
3. **`EffectOrchestrator3D` mounts inside `PerformerRig`'s `effectsSlot`**, which is a sibling of the avatar and prop blocks and receives the prop states directly. That is why `showAvatar={false} showProps={false}` still yields a live effect trace.
4. **The dev server does not pick up new route directories.** A route created after the server started will bounce to `/create/construct`. Verify on a server started after your files exist, or restart. This wasted a full diagnosis round already.

**Verification is visual.** `npm run check` passing proves nothing here. Every effect task ends with a screenshot you looked at. Per `visual-verification-mandatory.md` this needs no permission — it is the second half of the edit.

---

## File Structure

| File | Responsibility | Change |
|---|---|---|
| `src/routes/test/element-motifs/MotifStation.svelte` | Owns one station's isolated effects-config context and selects its effect | **Create** |
| `src/routes/test/element-motifs/ElementMotifScene.svelte` | Lays out six stations | Modify |
| `src/routes/test/element-motifs/element-motifs.ts` | The six element definitions and their candidate effects | Modify |
| `src/lib/shared/3d/effects/EffectOrchestrator3D.svelte` | Mounts every 3D effect for one rig | Modify |
| `src/lib/shared/3d/effects/EffectsLayer.svelte` | Holds the eight stranded renderers | Modify (header comment only) |
| `tests/unit/effects/effect-orchestrator-mounts-layer.test.ts` | Static contract: the orchestrator must mount the layer | **Create** |

---

### Task 1: Give each station its own effects-config context

Without this, every station reads the same global config and only one effect can be active across the whole harness. This task unblocks all verification.

**Files:**
- Create: `src/routes/test/element-motifs/MotifStation.svelte`
- Modify: `src/routes/test/element-motifs/ElementMotifScene.svelte`

- [ ] **Step 1: Create the station wrapper**

`persist: false` is mandatory — it keeps the harness from writing to the shared `tka_effects_config` key and clobbering Austen's real effects settings.

```svelte
<script lang="ts">
  /**
   * One motif station with its own isolated effects config.
   *
   * Every effect in EffectsLayer gates on the effects-config CONTEXT
   * (`config.tipEffectMap["*"].effect`), not on the tipEffectMap prop, so six
   * stations showing six different effects need six separate config states.
   *
   * persist:false keeps this harness out of the shared tka_effects_config key.
   */
  import { createEffectsConfigState } from "$lib/shared/effects/state/effects-config-state.svelte";
  import { setEffectsConfigContext } from "$lib/shared/effects/state/effects-config-context";
  import TelekineticFormation3D from "$lib/features/museum/components/game/TelekineticFormation3D.svelte";
  import type { EffectType } from "$lib/shared/animation-engine/domain/types/tip-effect-types";

  interface Props {
    stationId: string;
    worldX: number;
    worldZ: number;
    sequenceId: string;
    effectId: string;
    showProps: boolean;
    playing: boolean;
  }
  const props: Props = $props();

  const effectsState = createEffectsConfigState(undefined, { persist: false });
  setEffectsConfigContext(effectsState);

  $effect(() => {
    effectsState.setTipEffectMap({ "*": { effect: props.effectId as EffectType } });
  });
</script>

<TelekineticFormation3D
  stationId={props.stationId}
  worldX={props.worldX}
  worldZ={props.worldZ}
  sequenceId={props.sequenceId}
  presentation="sculpture"
  effectId={props.effectId}
  showProps={props.showProps}
  autoPlay={props.playing}
/>
```

- [ ] **Step 2: Check `createEffectsConfigState`'s first argument**

Run: `grep -n "export function createEffectsConfigState" -A4 src/lib/shared/effects/state/effects-config-state.svelte.ts`

Expected: `initial: EffectsConfig = DEFAULT_EFFECTS_CONFIG`. If passing `undefined` does not fall through to the default, import `DEFAULT_EFFECTS_CONFIG` from `$lib/shared/effects/domain/defaults` and pass it explicitly.

- [ ] **Step 3: Point the scene at the wrapper**

In `ElementMotifScene.svelte`, replace the `TelekineticFormation3D` import with `MotifStation` and swap the element in the `{#each}`:

```svelte
  <MotifStation
    stationId={`motif-${motif.roomId}`}
    worldX={pos.x}
    worldZ={pos.z}
    sequenceId={motif.sequenceId}
    effectId={props.effects[motif.roomId] ?? motif.defaultEffect}
    showProps={props.showProps}
    playing={props.playing}
  />
```

- [ ] **Step 4: Typecheck**

Run: `npx svelte-check --threshold error --output human`
Expected: `svelte-check found 0 errors`

- [ ] **Step 5: Commit**

```bash
git add src/routes/test/element-motifs
git commit -m "feat(harness): per-station effects config so six effects can run at once" -- src/routes/test/element-motifs
```

---

### Task 2: Mount EffectsLayer inside the orchestrator

**Files:**
- Create: `tests/unit/effects/effect-orchestrator-mounts-layer.test.ts`
- Modify: `src/lib/shared/3d/effects/EffectOrchestrator3D.svelte`
- Modify: `src/lib/shared/3d/effects/EffectsLayer.svelte` (header comment)

- [ ] **Step 1: Write the failing contract test**

A static source assertion, in the spirit of `tests/unit/sequence-viewer-shell-contract.test.ts`. It guards the exact regression this plan fixes: a renderer file existing while nothing renders it.

```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ORCHESTRATOR = resolve("src/lib/shared/3d/effects/EffectOrchestrator3D.svelte");

describe("EffectOrchestrator3D mounts EffectsLayer", () => {
  const source = readFileSync(ORCHESTRATOR, "utf8");

  it("imports EffectsLayer", () => {
    expect(source).toMatch(/import\s+EffectsLayer\s+from\s+"\.\/EffectsLayer\.svelte"/);
  });

  it("renders EffectsLayer in its template", () => {
    expect(source).toMatch(/<EffectsLayer\b/);
  });

  it("passes the prop states EffectsLayer needs", () => {
    const tag = source.slice(source.indexOf("<EffectsLayer"));
    for (const prop of ["bluePropState", "redPropState", "isPlaying", "staffLength", "currentStep"]) {
      expect(tag).toContain(prop);
    }
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/unit/effects/effect-orchestrator-mounts-layer.test.ts`
Expected: FAIL — "imports EffectsLayer" fails, because nothing imports it.

- [ ] **Step 3: Add the import**

In `EffectOrchestrator3D.svelte`, next to the `Trail3D` import at line 26:

```ts
  import EffectsLayer from "./EffectsLayer.svelte";
```

- [ ] **Step 4: Mount it at the end of the template**

Append to the very bottom of `EffectOrchestrator3D.svelte`, after the LED/charcoal/fire comment block. `staffLength` is `staffHalfLength * 2` — confirm that prop's name in the orchestrator's `Props` interface first and use whatever it actually is.

```svelte
<!-- The eight effects whose only 3D renderers live in EffectsLayer: goo,
     bubbles, smoke, petals, sparkles, zap, ghost, bloom. EffectsLayer gates
     each one on the effects-config context, so mounting it unconditionally is
     correct — at most one is active at a time. -->
<EffectsLayer
  {bluePropState}
  {redPropState}
  {isPlaying}
  staffLength={staffHalfLength * 2}
  {currentStep}
/>
```

- [ ] **Step 5: Run the test again**

Run: `npx vitest run tests/unit/effects/effect-orchestrator-mounts-layer.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 6: Correct the lie in EffectsLayer's header**

Replace `// EffectsLayer itself is currently unmounted (legacy).` with:

```
// Mounted by EffectOrchestrator3D. This component owns the ONLY 3D renderers
// for goo, bubbles, smoke, petals, sparkles, zap, ghost and bloom. It was
// unmounted for a period, which silently cost those eight effects their 3D
// path; tests/unit/effects/effect-orchestrator-mounts-layer.test.ts now
// guards against that recurring.
```

- [ ] **Step 7: Typecheck**

Run: `npx svelte-check --threshold error --output human`
Expected: `svelte-check found 0 errors`

- [ ] **Step 8: Commit**

```bash
git add src/lib/shared/3d/effects/EffectOrchestrator3D.svelte src/lib/shared/3d/effects/EffectsLayer.svelte tests/unit/effects/effect-orchestrator-mounts-layer.test.ts
git commit -m "fix(effects): mount EffectsLayer so eight effects get their 3D path back" -- src/lib/shared/3d/effects/EffectOrchestrator3D.svelte src/lib/shared/3d/effects/EffectsLayer.svelte tests/unit/effects/effect-orchestrator-mounts-layer.test.ts
```

---

### Task 3: Verify bubbles — the pilot, and the Water room's motif

Bubbles goes first because Austen chose it for Water on 2026-08-05 and because it exercises the whole chain: context selection, `trackingMode`, velocity-reactive emission.

**Files:**
- Modify: `src/routes/test/element-motifs/element-motifs.ts`

- [ ] **Step 1: Point Water at bubbles**

In the `cave-water` entry:

```ts
    defaultEffect: "bubbles",
    candidates: ["bubbles", "goo", "trails", "led"],
```

- [ ] **Step 2: Load the harness on a server that knows the route**

Confirm a dev server is serving this checkout and was started after `src/routes/test/element-motifs/` existed:

```bash
curl -sk -o /dev/null -w "%{http_code}\n" --max-time 25 https://localhost:5174/test/element-motifs
```

Then open [localhost:5174/test/element-motifs](https://localhost:5174/test/element-motifs), wait ~10 s for the scene, and screenshot.

- [ ] **Step 3: Read the frame**

The Water station must show bubbles rising off the tips. If it is empty, check in this order: (a) is `trackingMode` `"both_ends"`, or is it `"neither"` and gating every emitter off; (b) is `isPlaying` true at the station; (c) did the context actually get set — log `effectsState.config.tipEffectMap` in `MotifStation`.

- [ ] **Step 4: Commit**

```bash
git add src/routes/test/element-motifs/element-motifs.ts
git commit -m "feat(museum): bubbles is the Water room motif" -- src/routes/test/element-motifs/element-motifs.ts
```

---

### Tasks 4–10: Verify the remaining seven

One effect per task, same shape each time. Do them in this order — it front-loads the ones the six rooms need: **goo, smoke, petals, sparkles, ghost, zap, bloom.**

For each effect `<id>`:

- [ ] **Step 1: Select it.** Add `<id>` to a station's `candidates` in `element-motifs.ts`, and set it as that station's `defaultEffect` so it renders without a click.
- [ ] **Step 2: Reload and screenshot** at [localhost:5174/test/element-motifs](https://localhost:5174/test/element-motifs).
- [ ] **Step 3: Read the frame.** Confirm the effect renders AND that it looks materially different from `trails`. An effect that renders but reads identically to the baseline has not earned its slot (`effects-earn-their-slot.md`) — say so rather than ticking the box.
- [ ] **Step 4: Fix or record.** If it renders wrong, fix it. If it needs work beyond this plan's scope, add it to Loose ends at the bottom of this file with what you actually saw.
- [ ] **Step 5: Commit** with an explicit pathspec.

Known specifics per effect:

- **goo** — renders through `WaterEmitter3D`, the legacy water particle system, not a real goo renderer. Expect droplets, not metaballs. A dedicated 3D goo renderer is a known follow-up, out of scope here. Do not re-add realistic water (`feedback_water_renamed_to_goo`).
- **smoke** — `SmokeRenderer3D`, 256-particle pool per tip, curl-noise. Four tips means four pools; watch frame rate with six stations up.
- **petals** — mounts `PetalAmbientShower3D` **scene-wide** in addition to the four per-tip emitters. With six stations that is six ambient showers. If the harness rains petals everywhere, that is why, and it is a real finding for room use.
- **sparkles** — `pickSparkleColor` in rainbow mode calls `Date.now()` inside a `$derived`, which will not re-evaluate per frame. Expect a static hue per emitter. Note it; do not fix it here.
- **ghost** — needs `currentStep` to advance or it captures nothing. If ghost is empty, verify `currentStep` is actually being plumbed through `PerformerRig`'s `effectsSlot` and is non-zero while playing.
- **zap** — arcs BETWEEN the blue and red props, so it needs both prop states. It is the only effect that will look wrong on a single-prop rig.
- **bloom** — runs even when paused (time-based pulse, not step-based). Verify by pausing the harness: bloom should keep breathing while everything else freezes.

---

### Task 11: Restore the full candidate lists and correct the harness docs

**Files:**
- Modify: `src/routes/test/element-motifs/element-motifs.ts`

- [ ] **Step 1: Replace the coverage-gap comment**

The header currently states that only four effects exist in 3D. After this plan that is false. Replace the `── The 3D coverage gap (measured 2026-08-05) ──` block with:

```
 * ── 3D coverage (2026-08-05) ───────────────────────────────────────────────
 *
 * Twelve of the sixteen registry effects render in 3D: trails, led, charcoal
 * and fire through EffectOrchestrator3D directly, plus goo, bubbles, smoke,
 * petals, sparkles, zap, ghost and bloom through EffectsLayer, which the
 * orchestrator mounts. Still absent in 3D: ink (palettes only), silk, animal
 * and pulse.
```

- [ ] **Step 2: Widen each element's candidates** to the effects that now work, so the mapping question can actually be auditioned. Keep `trails` on every list as the control.

- [ ] **Step 3: Screenshot all six at once** and read it against the question that started this: does each element now have a distinguishable signature, or do any two still read as the same object?

- [ ] **Step 4: Commit**

```bash
git add src/routes/test/element-motifs/element-motifs.ts
git commit -m "docs(harness): twelve of sixteen effects now render in 3D" -- src/routes/test/element-motifs/element-motifs.ts
```

---

## Explicitly out of scope

Name these rather than silently skipping them:

- **Authoring ink, silk, animal and pulse in 3D.** Genuinely absent — no renderer exists. Four net-new components, a separate plan.
- **A real 3D goo renderer.** Goo currently borrows `WaterEmitter3D`. Known follow-up, recorded in `feedback_water_renamed_to_goo`.
- **Retiring the legacy `PropMotionEffects` mount.** `EffectsLayer` still carries it beside Ghost; its own comment says "Phase 3 retires the legacy path." Not this plan.
- **The portal hub room, mandalas, and tunnel tiling.** Separate work, still undesigned.
- **The Sun room design doc's notation section**, which Austen's 2026-08-05 direction supersedes — the modality should be expressed as material throughout the room, not as one diagram at noon.

## Loose ends

Append what the frames actually show as you go.
