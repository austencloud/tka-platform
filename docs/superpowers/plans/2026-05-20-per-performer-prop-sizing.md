# Per-Performer Prop Sizing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move prop size from Scene popover into Performers popover, support per-performer sizing with linked/unlinked mode, fix chip strip layout, and add performer identification badges.

**Architecture:** pnpm patch threads `propLength` through PerformerRig→Prop3D. App-side PerformerSettings gains `staffLengthCm`. Viewer state manages link mode. New PropSizeControl component renders the slider with a link toggle. PerformerBadge3D adds floating numbered labels in the 3D scene.

**Tech Stack:** Svelte 5, Threlte (Three.js), @austencloud/scene-3d (pnpm patch), Vitest

**Spec:** `docs/superpowers/specs/2026-05-20-per-performer-prop-sizing-design.md`

---

## File Map

### New Files
| File | Purpose |
|------|---------|
| `patches/@austencloud__scene-3d@0.1.2.patch` | pnpm patch for Prop3D + PerformerRig length threading |
| `src/lib/shared/3d/constants/performer-colors.ts` | Shared CHIP_COLORS array (extracted from PerformerChipStrip) |
| `src/lib/shared/sequence-viewer/components/PropSizeControl.svelte` | Prop size slider with link/unlink toggle |
| `src/lib/shared/3d/components/PerformerBadge3D.svelte` | Floating numbered badge above performers |
| `tests/unit/3d-viewer/prop-size-link.test.ts` | Tests for link/unlink state transitions |

### Modified Files
| File | Change |
|------|--------|
| `src/lib/shared/3d/state/performer-settings-types.ts` | Add `staffLengthCm: number \| null` |
| `src/lib/shared/3d/state/avatar-instance-state.svelte.ts` | Add `setStaffLengthCm()` method |
| `src/lib/shared/3d/state/viewer-3d-state.svelte.ts` | Add `propSizeLinked` + `togglePropSizeLink()` |
| `src/lib/shared/sequence-viewer/components/PerformerPopover.svelte` | Restructure Prop tab, mount PropSizeControl |
| `src/lib/shared/3d/components/SceneSelectorPopover.svelte` | Remove prop size slider |
| `src/lib/shared/3d/components/Viewer3DScene.svelte` | Thread propLength, add badge, upgrade disc color |
| `src/lib/shared/3d/components/controls/PerformerChipStrip.svelte` | Fix `+` button layout |
| `package.json` | Add pnpm patchedDependencies entry |

---

## Task 1: Create pnpm Patch for @austencloud/scene-3d

Thread `length` through Prop3D dispatcher and `propLength` through PerformerRig.

**Files:**
- Patch: `node_modules/.pnpm/@austencloud+scene-3d@0.1.2_*/node_modules/@austencloud/scene-3d/src/lib/components/props/Prop3D.svelte`
- Patch: `node_modules/.pnpm/@austencloud+scene-3d@0.1.2_*/node_modules/@austencloud/scene-3d/src/lib/components/PerformerRig.svelte`
- Modify: `package.json` (patchedDependencies)

- [ ] **Step 1: Start pnpm patch**

```bash
pnpm patch @austencloud/scene-3d@0.1.2
```

This creates a temp directory. Note the path it prints.

- [ ] **Step 2: Patch Prop3D.svelte — add `length` to Props and pass through**

In the temp directory, edit `src/lib/components/props/Prop3D.svelte`. Replace the Props interface and destructuring:

```svelte
<script lang="ts">
  // ... existing imports unchanged ...

  interface Props {
    propType: PropType;
    propState: PropState3D;
    color: "blue" | "red";
    visible?: boolean;
    isActivePlayer?: boolean;
    length?: number;
  }

  let {
    propType,
    propState,
    color,
    visible = true,
    isActivePlayer = false,
    length,
  }: Props = $props();

  // ... rest unchanged ...
```

Then in every `<Staff3D>`, `<Club3D>`, `<Fan3D>`, etc. call, add `{length}`:

```svelte
  {:else if propType === PropType.STAFF || propType === PropType.SIMPLESTAFF || propType === PropType.STAFF2}
    <Staff3D {propState} {color} {visible} {isActivePlayer} {length} />
  {:else if propType === PropType.BIGSTAFF}
    <Staff3D {propState} {color} {visible} {isActivePlayer} {length} />

  {:else if propType === PropType.CLUB}
    <Club3D {propState} {color} {visible} {isActivePlayer} {length} />
  {:else if propType === PropType.BIGCLUB}
    <Club3D {propState} {color} {visible} {isActivePlayer} scale={BIG_SCALE} {length} />
```

Add `{length}` to ALL procedural prop component calls (Staff3D, Club3D, Fan3D, Hoop3D, Ball3D, Torch3D, Sword3D, Buugeng3D, Triad3D, Doublestar3D, Chicken3D, Guitar3D, Triquetra3D, Eightrings3D, Poi3D). The `GltfProp3D` call does not need it (GLTF models scale differently).

- [ ] **Step 3: Patch PerformerRig.svelte — add `propLength` prop, thread to Prop3D**

In the temp directory, edit `src/lib/components/PerformerRig.svelte`.

Add to the Props interface (after `staffHalfLength?: number;` on line 80):

```typescript
    /** Per-performer prop length in scene units. When provided, overrides
     *  the global userProportionsState.staffLength for this performer's props
     *  and hand positioning. */
    propLength?: number;
```

Add to destructuring (after `staffHalfLength = userProportionsState.staffLength / 2,` on line 135):

```typescript
    propLength,
```

Replace the `staffHalfLength` default to also account for `propLength`:

Change line 135 from:
```typescript
    staffHalfLength = userProportionsState.staffLength / 2,
```
to:
```typescript
    staffHalfLength: staffHalfLengthProp,
```

Then add a derived after the destructuring:

```typescript
  const staffHalfLength = $derived(
    staffHalfLengthProp ?? (propLength ? propLength / 2 : userProportionsState.staffLength / 2)
  );
```

Add `length={propLength}` to both `<Prop3D>` instances (lines 327-330 and 347-350):

```svelte
        {#if showProps}
          <Prop3D
            propType={bluePropType}
            propState={bluePropState}
            color="blue"
            length={propLength}
          />
        {/if}
```

```svelte
        {#if showProps}
          <Prop3D
            propType={redPropType}
            propState={redPropState}
            color="red"
            length={propLength}
          />
        {/if}
```

- [ ] **Step 4: Commit the patch**

```bash
pnpm patch-commit <temp-directory-path>
```

This creates `patches/@austencloud__scene-3d@0.1.2.patch` and updates `package.json` with `pnpm.patchedDependencies`.

- [ ] **Step 5: Verify patch applied**

```bash
pnpm install
```

Then grep to confirm the patched Prop3D has `length`:

```bash
grep -n "length" node_modules/.pnpm/@austencloud+scene-3d@0.1.2_*/node_modules/@austencloud/scene-3d/src/lib/components/props/Prop3D.svelte | head -5
```

Expected: lines showing `length?: number` in interface and `{length}` passed to child components.

- [ ] **Step 6: Commit**

```bash
git add patches/ package.json pnpm-lock.yaml
git commit -m "feat(3d): patch scene-3d to thread propLength through PerformerRig→Prop3D"
```

---

## Task 2: Extract CHIP_COLORS to Shared Constant

Both PerformerChipStrip and the new badge/disc need the same color array. Extract it.

**Files:**
- Create: `src/lib/shared/3d/constants/performer-colors.ts`
- Modify: `src/lib/shared/3d/components/controls/PerformerChipStrip.svelte`
- Modify: `src/lib/shared/sequence-viewer/components/PerformerPopover.svelte`

- [ ] **Step 1: Create shared constant file**

```typescript
// src/lib/shared/3d/constants/performer-colors.ts

/**
 * Per-performer accent colors, indexed by performer slot.
 * Used by: PerformerChipStrip, PerformerBadge3D, ground disc,
 * BentoPropGrid accent, and PropSizeControl.
 */
export const PERFORMER_COLORS = [
  "#3b82f6", "#ef4444", "#8b5cf6", "#f97316",
  "#10b981", "#ec4899", "#06b6d4", "#eab308",
] as const;

export function getPerformerColor(index: number): string {
  return PERFORMER_COLORS[index % PERFORMER_COLORS.length] ?? "#6b7280";
}
```

- [ ] **Step 2: Update PerformerChipStrip to import from shared**

In `src/lib/shared/3d/components/controls/PerformerChipStrip.svelte`, replace lines 32-39:

```svelte
  import { getPerformerColor } from "../../constants/performer-colors";
```

Remove the local `CHIP_COLORS` array and `chipColor` function. Replace usage of `chipColor(i)` with `getPerformerColor(i)` in the template (line 77):

```svelte
style="--chip-color: {getPerformerColor(i)}"
```

- [ ] **Step 3: Update PerformerPopover to import from shared**

In `src/lib/shared/sequence-viewer/components/PerformerPopover.svelte`, replace lines 57-63:

```svelte
  import { getPerformerColor } from "$lib/shared/3d/constants/performer-colors";
```

Remove the local `CHIP_COLORS` array. Replace `gridColor` derived (line 61-63):

```typescript
  const gridColor = $derived<string>(
    getPerformerColor(viewer.selectedPerformerIndex ?? 0),
  );
```

- [ ] **Step 4: Run typecheck**

```bash
npx svelte-check --tsconfig tsconfig.json 2>&1 | head -30
```

Expected: no errors related to CHIP_COLORS or performer-colors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/3d/constants/performer-colors.ts src/lib/shared/3d/components/controls/PerformerChipStrip.svelte src/lib/shared/sequence-viewer/components/PerformerPopover.svelte
git commit -m "refactor(3d): extract CHIP_COLORS to shared performer-colors constant"
```

---

## Task 3: Extend PerformerSettings with staffLengthCm

**Files:**
- Modify: `src/lib/shared/3d/state/performer-settings-types.ts`
- Modify: `src/lib/shared/3d/state/avatar-instance-state.svelte.ts`

- [ ] **Step 1: Add staffLengthCm to PerformerSettings**

In `src/lib/shared/3d/state/performer-settings-types.ts`, add to the interface and default factory:

```typescript
export interface PerformerSettings {
  effortId: EffortId;
  prop: PropType;
  effects: Set<EffectId>;
  staffLengthCm: number | null;
}

export function makeDefaultPerformerSettings(): PerformerSettings {
  return {
    effortId: "linear",
    prop: PropType.STAFF,
    effects: new Set(),
    staffLengthCm: null,
  };
}
```

- [ ] **Step 2: Add setStaffLengthCm to AvatarInstanceState**

In `src/lib/shared/3d/state/avatar-instance-state.svelte.ts`, add after `toggleEffect` (around line 691):

```typescript
  function setStaffLengthCm(cm: number | null): void {
    _settings = { ..._settings, staffLengthCm: cm };
  }
```

Add `setStaffLengthCm` to the return object (after `toggleEffect` on line 875):

```typescript
    toggleEffect,
    setStaffLengthCm,
```

- [ ] **Step 3: Run typecheck**

```bash
npx svelte-check --tsconfig tsconfig.json 2>&1 | head -30
```

Expected: clean (new field has a default so no existing code breaks).

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/3d/state/performer-settings-types.ts src/lib/shared/3d/state/avatar-instance-state.svelte.ts
git commit -m "feat(3d): add staffLengthCm to PerformerSettings for per-performer sizing"
```

---

## Task 4: Add propSizeLinked State + Toggle Logic

**Files:**
- Modify: `src/lib/shared/3d/state/viewer-3d-state.svelte.ts`
- Create: `tests/unit/3d-viewer/prop-size-link.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/unit/3d-viewer/prop-size-link.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { createViewer3DStateForTest } from "./viewer3d-test-helpers.svelte";
import { __resetWebGL2CapabilityForTests } from "$lib/shared/3d/capabilities/webgl-capabilities";
import { userProportionsState, inchesToCm } from "@austencloud/scene-3d";

beforeAll(() => {
  const originalCreateElement = document.createElement as unknown as (tag: string) => unknown;
  (document as unknown as { createElement: (tag: string) => unknown }).createElement = (tag: string) => {
    const base = originalCreateElement(tag) as Record<string, unknown>;
    if (tag === "canvas") {
      base.getContext = () => null;
    }
    return base;
  };
  __resetWebGL2CapabilityForTests();
});

const cleanups: Array<() => void> = [];
function makeState() {
  const { state, dispose } = createViewer3DStateForTest({});
  cleanups.push(dispose);
  state.performerManager.initialize();
  return state;
}
afterEach(() => {
  while (cleanups.length) cleanups.pop()!();
});

describe("prop size link mode", () => {
  it("defaults to linked", () => {
    const state = makeState();
    expect(state.propSizeLinked).toBe(true);
  });

  it("togglePropSizeLink switches to unlinked and stamps current global onto performers", () => {
    const state = makeState();
    state.performerManager.addPerformer();
    userProportionsState.setStaffLengthCm(inchesToCm(40));

    state.togglePropSizeLink();

    expect(state.propSizeLinked).toBe(false);
    const p0 = state.performerManager.performers[0];
    const p1 = state.performerManager.performers[1];
    expect(p0.settings.staffLengthCm).toBe(inchesToCm(40));
    expect(p1.settings.staffLengthCm).toBe(inchesToCm(40));
  });

  it("togglePropSizeLink back to linked clears per-performer values and syncs global", () => {
    const state = makeState();
    state.performerManager.addPerformer();
    const p1 = state.performerManager.performers[1];
    p1.setStaffLengthCm(inchesToCm(50));

    state.togglePropSizeLink(); // linked → unlinked (stamps global)
    state.selectPerformerScope(1);
    state.togglePropSizeLink(); // unlinked → linked (syncs to selected)

    expect(state.propSizeLinked).toBe(true);
    expect(state.performerManager.performers[0].settings.staffLengthCm).toBeNull();
    expect(state.performerManager.performers[1].settings.staffLengthCm).toBeNull();
    // Global should be set to selected performer's value before clear
    expect(userProportionsState.staffLengthCm).toBe(inchesToCm(50));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/unit/3d-viewer/prop-size-link.test.ts 2>&1
```

Expected: FAIL — `state.propSizeLinked` and `state.togglePropSizeLink` don't exist yet.

- [ ] **Step 3: Implement propSizeLinked in viewer-3d-state**

In `src/lib/shared/3d/state/viewer-3d-state.svelte.ts`, add state variable near the other state declarations (around line 280):

```typescript
  let propSizeLinked = $state(true);
```

Add the toggle function (near `selectPerformerScope` around line 316):

```typescript
  function togglePropSizeLink(): void {
    if (propSizeLinked) {
      // Linked → Unlinked: stamp current global value onto all performers with null
      const globalCm = userProportionsState.staffLengthCm;
      for (const p of performerManager.performers) {
        if (p.settings.staffLengthCm === null) {
          p.setStaffLengthCm(globalCm);
        }
      }
      propSizeLinked = false;
    } else {
      // Unlinked → Linked: sync global to selected performer's value, clear all
      const sourceIdx = selectedPerformerIndex ?? 0;
      const source = performerManager.performers[sourceIdx];
      if (source?.settings.staffLengthCm != null) {
        userProportionsState.setStaffLengthCm(source.settings.staffLengthCm);
      }
      for (const p of performerManager.performers) {
        p.setStaffLengthCm(null);
      }
      propSizeLinked = true;
    }
  }
```

Add to the return object (near line 830):

```typescript
    get propSizeLinked() {
      return propSizeLinked;
    },
    togglePropSizeLink,
```

Add the import for `userProportionsState` if not already present (check existing imports at top of file).

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/unit/3d-viewer/prop-size-link.test.ts 2>&1
```

Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/3d/state/viewer-3d-state.svelte.ts tests/unit/3d-viewer/prop-size-link.test.ts
git commit -m "feat(3d): add propSizeLinked state with linked/unlinked toggle logic"
```

---

## Task 5: Build PropSizeControl Component

**Files:**
- Create: `src/lib/shared/sequence-viewer/components/PropSizeControl.svelte`

- [ ] **Step 1: Create PropSizeControl.svelte**

```svelte
<script lang="ts">
  import { getViewer3DContext } from "$lib/shared/3d/context/viewer-3d-context";
  import { userProportionsState, inchesToCm } from "@austencloud/scene-3d";
  import type { AvatarInstanceState } from "$lib/shared/3d/state/avatar-instance-state.svelte";

  interface Props {
    performer: AvatarInstanceState | null;
  }

  let { performer }: Props = $props();

  const viewer = getViewer3DContext();
  const linked = $derived(viewer.propSizeLinked);
  const performerCount = $derived(viewer.performerManager.performers.length);
  const showLinkToggle = $derived(performerCount > 1);
  const selectedIndex = $derived(viewer.selectedPerformerIndex);

  const currentCm = $derived.by(() => {
    if (linked) return userProportionsState.staffLengthCm;
    if (performer?.settings.staffLengthCm != null) return performer.settings.staffLengthCm;
    return userProportionsState.staffLengthCm;
  });

  const displayValue = $derived(userProportionsState.formatLength(currentCm));

  const disabled = $derived(!linked && performer === null);

  const label = $derived.by(() => {
    if (linked) return "Prop size";
    if (selectedIndex != null) return `P${selectedIndex + 1} prop size`;
    return "Prop size";
  });

  function handleInput(e: Event) {
    const cm = Number((e.currentTarget as HTMLInputElement).value);
    if (linked) {
      userProportionsState.setStaffLengthCm(cm);
    } else if (performer) {
      performer.setStaffLengthCm(cm);
    }
  }
</script>

<div class="prop-size-control" class:disabled>
  <div class="control-header">
    <span class="control-label">{label}</span>
    <span class="control-value">{displayValue}</span>
    {#if showLinkToggle}
      <button
        type="button"
        class="link-toggle"
        aria-pressed={linked}
        aria-label={linked ? "Unlink performer prop sizes" : "Link all prop sizes"}
        onclick={(e) => { e.stopPropagation(); viewer.togglePropSizeLink(); }}
      >
        <i class="fas {linked ? 'fa-link' : 'fa-link-slash'}" aria-hidden="true"></i>
      </button>
    {/if}
  </div>
  {#if disabled}
    <div class="hint">Select a performer to set individual size</div>
  {:else}
    <input
      type="range"
      class="size-slider"
      min={inchesToCm(24)}
      max={inchesToCm(60)}
      step="1"
      value={currentCm}
      oninput={handleInput}
      aria-label="Prop size"
    />
  {/if}
</div>

<style>
  .prop-size-control {
    margin-top: 12px;
    padding: 12px 14px;
    border-radius: 10px;
    background: rgba(0, 0, 0, 0.35);
    border: 1px solid rgba(255, 255, 255, 0.06);
    transition: border-color 180ms;
  }

  .prop-size-control:hover:not(.disabled) {
    border-color: rgba(255, 255, 255, 0.12);
  }

  .prop-size-control.disabled {
    opacity: 0.5;
  }

  .control-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }

  .control-label {
    font-size: 12px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.72);
  }

  .control-value {
    font-size: 12px;
    font-weight: 700;
    color: #cfe4ff;
    font-variant-numeric: tabular-nums;
    margin-left: auto;
  }

  .link-toggle {
    width: 28px;
    height: 28px;
    min-width: 44px;
    min-height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.5);
    cursor: pointer;
    transition: all 180ms;
    font-size: 12px;
    margin: -8px 0;
    padding: 0;
  }

  .link-toggle:hover {
    background: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.9);
  }

  .link-toggle[aria-pressed="true"] {
    background: color-mix(in srgb, #60a5fa 15%, transparent);
    border-color: color-mix(in srgb, #60a5fa 40%, transparent);
    color: #60a5fa;
  }

  .hint {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.35);
    text-align: center;
    padding: 4px 0;
  }

  .size-slider {
    width: 100%;
    height: 6px;
    appearance: none;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 3px;
    outline: none;
    cursor: pointer;
    transition: background 180ms;
  }

  .size-slider:hover {
    background: rgba(255, 255, 255, 0.15);
  }

  .size-slider::-webkit-slider-thumb {
    appearance: none;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: #60a5fa;
    border: 2.5px solid rgba(20, 22, 32, 1);
    cursor: pointer;
    box-shadow: 0 0 10px rgba(96, 165, 250, 0.35);
    transition: box-shadow 180ms, transform 180ms;
  }

  .size-slider::-webkit-slider-thumb:hover {
    box-shadow: 0 0 16px rgba(96, 165, 250, 0.55);
    transform: scale(1.1);
  }

  .size-slider::-moz-range-thumb {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: #60a5fa;
    border: 2.5px solid rgba(20, 22, 32, 1);
    cursor: pointer;
    box-shadow: 0 0 10px rgba(96, 165, 250, 0.35);
  }
</style>
```

- [ ] **Step 2: Verify the `formatLength` method exists on userProportionsState**

```bash
grep -n "formatLength\|staffLengthDisplay" node_modules/.pnpm/@austencloud+scene-3d@0.1.2_*/node_modules/@austencloud/scene-3d/src/lib/state/user-proportions-state.svelte.ts | head -10
```

If `formatLength` doesn't exist but `staffLengthDisplay` does, replace `userProportionsState.formatLength(currentCm)` with `userProportionsState.staffLengthDisplay` in the component. The display getter already formats the global value; for per-performer values, compute inline:

```typescript
  const displayValue = $derived.by(() => {
    const cm = currentCm;
    const inches = Math.round(cm / 2.54);
    return `${inches} in`;
  });
```

- [ ] **Step 3: Run typecheck**

```bash
npx svelte-check --tsconfig tsconfig.json 2>&1 | head -30
```

Fix any type errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/sequence-viewer/components/PropSizeControl.svelte
git commit -m "feat(3d): add PropSizeControl component with linked/unlinked mode"
```

---

## Task 6: Rewire PerformerPopover Prop Tab + Remove from Scene

**Files:**
- Modify: `src/lib/shared/sequence-viewer/components/PerformerPopover.svelte`
- Modify: `src/lib/shared/3d/components/SceneSelectorPopover.svelte`

- [ ] **Step 1: Update PerformerPopover — restructure Prop tab**

In `src/lib/shared/sequence-viewer/components/PerformerPopover.svelte`:

Add import at top (after the existing imports):

```typescript
  import PropSizeControl from "./PropSizeControl.svelte";
```

Replace the template section from `{:else if allSelected}` through `{:else if activeTab === "effort"}` (lines 129-146) with:

```svelte
      {:else if allSelected}
        {#if activeTab === "prop"}
          <div class="empty">
            Select a performer to change prop type.
          </div>
          <PropSizeControl performer={null} />
        {:else if activeTab === "effects"}
          <div class="effects-host"><MobileEffectsPanel layout="grid" /></div>
        {:else}
          <div class="empty">
            Select a performer to edit their prop or effort.
          </div>
        {/if}
      {:else if selected === null}
        <div class="empty">No performer selected.</div>
      {:else if activeTab === "prop"}
        <BentoPropGrid
          selectedPropType={selected.settings.prop ?? PropType.STAFF}
          color={gridColor}
          variant="inline"
          onSelect={(p: PropType) => selected.setProp(p)}
        />
        <PropSizeControl performer={selected} />
      {:else if activeTab === "effort"}
        <EffortPalette
          selectedEffort={selected.settings.effortId ?? "linear"}
          onSelect={(e: EffortId) => selected.setEffort(e)}
        />
```

Also update the Prop tab button to NOT be disabled when allSelected AND linked (so users can access the global slider):

Replace line 98 (`disabled={allSelected}`):

```svelte
          disabled={allSelected && !viewer.propSizeLinked}
```

Wait — the Prop tab houses the prop TYPE grid too, which requires a selected performer. The tab should stay enabled when allSelected + linked so the PropSizeControl is reachable. The grid shows a hint instead. The template above already handles this.

Actually, keep the Prop tab always enabled. The gating happens inside the content, not the tab button:

```svelte
        <button
          class="tab"
          role="tab"
          aria-selected={activeTab === "prop"}
          onclick={() => (activeTab = "prop")}>Prop</button
        >
```

Remove the `disabled={allSelected}` from the Prop tab button entirely.

- [ ] **Step 2: Remove prop size from SceneSelectorPopover**

In `src/lib/shared/3d/components/SceneSelectorPopover.svelte`:

Delete the prop size section (lines 93-108):

```svelte
      <!-- DELETE THIS ENTIRE BLOCK -->
      <div class="scene-control">
        <div class="scene-control-header">
          <span class="scene-control-label">Prop size</span>
          <span class="scene-control-value">{userProportionsState.staffLengthDisplay}</span>
        </div>
        <input
          type="range"
          class="scene-slider"
          min={inchesToCm(24)}
          max={inchesToCm(60)}
          step="1"
          value={userProportionsState.staffLengthCm}
          oninput={(e) => userProportionsState.setStaffLengthCm(Number(e.currentTarget.value))}
          aria-label="Prop size"
        />
      </div>
```

Remove `inchesToCm` from the import on line 10 (keep `userProportionsState` — body freedom still uses it):

```typescript
  import { userProportionsState } from "@austencloud/scene-3d";
```

If `inchesToCm` was only used for prop size, also remove it from the import. Check if body freedom uses it — it doesn't (body freedom range is 0-1, no inch conversion). So remove `inchesToCm` from the import.

- [ ] **Step 3: Run typecheck**

```bash
npx svelte-check --tsconfig tsconfig.json 2>&1 | head -30
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/sequence-viewer/components/PerformerPopover.svelte src/lib/shared/3d/components/SceneSelectorPopover.svelte
git commit -m "feat(3d): move prop size slider from Scene to Performers popover"
```

---

## Task 7: Thread propLength to PerformerRig in Viewer3DScene

**Files:**
- Modify: `src/lib/shared/3d/components/Viewer3DScene.svelte`

- [ ] **Step 1: Add import for cmToUnits**

Add to imports (around line 5):

```typescript
  import { cmToUnits } from "@austencloud/scene-3d";
```

- [ ] **Step 2: Compute and pass propLength per performer**

Inside the `{#each performerManager.performers ...}` loop (after line 337), add a const for per-performer prop length:

```svelte
    {@const perfStaffCm = performer.settings.staffLengthCm}
    {@const propLength = perfStaffCm != null ? cmToUnits(perfStaffCm) : undefined}
```

Add `propLength` to the `<PerformerRig>` call (around line 340):

```svelte
    <PerformerRig
      position={performer.position}
      groundOffset={stageGroundOffset}
      facingAngle={performer.facingAngle}
      planeMode={performer.planeMode}
      avatarState={performer}
      visiblePlanes={mergedPlanes}
      gridMode={performerGridMode}
      bluePropType={resolvePerformerProp(performer, bluePropType)}
      redPropType={resolvePerformerProp(performer, redPropType)}
      bluePropState={performer.bluePropState}
      redPropState={performer.redPropState}
      tipEffectMap={globalTipEffectMap}
      {isPlaying}
      {propLength}
      enableLocomotion={true}
      enableFootPlanting={true}
    >
```

- [ ] **Step 3: Run typecheck**

```bash
npx svelte-check --tsconfig tsconfig.json 2>&1 | head -30
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/3d/components/Viewer3DScene.svelte
git commit -m "feat(3d): thread per-performer propLength to PerformerRig"
```

---

## Task 8: Fix PerformerChipStrip Layout

**Files:**
- Modify: `src/lib/shared/3d/components/controls/PerformerChipStrip.svelte`

- [ ] **Step 1: Fix the `+` button CSS**

In `PerformerChipStrip.svelte`, change `.chip-add` styles (lines 159-167):

Replace:

```css
  .chip-add {
    margin-left: auto;
    width: 44px;
    height: 44px;
    border-radius: 22px;
    padding: 0;
    font-size: 18px;
    line-height: 1;
  }
```

With:

```css
  .chip-add {
    width: 44px;
    height: 28px;
    border-radius: 14px;
    padding: 0;
    font-size: 16px;
    line-height: 1;
  }
```

Changes: removed `margin-left: auto` (was causing orphan), reduced height from 44px to 28px (matches performer chip height), kept width at 44px (AAA touch target preserved).

- [ ] **Step 2: Run typecheck**

```bash
npx svelte-check --tsconfig tsconfig.json 2>&1 | head -30
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/3d/components/controls/PerformerChipStrip.svelte
git commit -m "fix(3d): remove margin-left auto from chip-add to prevent orphaned wrap"
```

---

## Task 9: Add PerformerBadge3D Component

**Files:**
- Create: `src/lib/shared/3d/components/PerformerBadge3D.svelte`

- [ ] **Step 1: Create PerformerBadge3D.svelte**

```svelte
<script lang="ts">
  import { T } from "@threlte/core";
  import { useThrelte } from "@threlte/core";
  import { CanvasTexture } from "three";
  import { getPerformerColor } from "../constants/performer-colors";
  import { userProportionsState } from "@austencloud/scene-3d";

  interface Props {
    index: number;
    selected: boolean;
    allMode: boolean;
  }

  let { index, selected, allMode }: Props = $props();

  const color = $derived(getPerformerColor(index));
  const opacity = $derived(selected ? 1.0 : allMode ? 0.6 : 0.35);
  const badgeY = $derived(-userProportionsState.groundY + 0.15);

  const texture = $derived.by(() => {
    const size = 64;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;

    ctx.clearRect(0, 0, size, size);

    // Circle fill
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    // Glow ring when selected
    if (selected) {
      ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    // Number text
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 32px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(index + 1), size / 2, size / 2);

    const tex = new CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  });
</script>

<T.Sprite
  position.y={badgeY}
  scale={[0.22, 0.22, 1]}
  material.map={texture}
  material.transparent={true}
  material.opacity={opacity}
  material.depthTest={false}
  renderOrder={999}
/>
```

- [ ] **Step 2: Run typecheck**

```bash
npx svelte-check --tsconfig tsconfig.json 2>&1 | head -30
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/3d/components/PerformerBadge3D.svelte
git commit -m "feat(3d): add PerformerBadge3D floating numbered label"
```

---

## Task 10: Integrate Badges + Upgrade Ground Disc in Viewer3DScene

**Files:**
- Modify: `src/lib/shared/3d/components/Viewer3DScene.svelte`

- [ ] **Step 1: Add imports**

Add to imports:

```typescript
  import PerformerBadge3D from "./PerformerBadge3D.svelte";
  import { getPerformerColor, PERFORMER_COLORS } from "../constants/performer-colors";
```

- [ ] **Step 2: Add PerformerBadge3D inside each performer's T.Group**

Inside the `{#each performerManager.performers ...}` loop, add the badge right after the `<PerformerRig>` closing tag (before the ground disc conditional, around line 366):

```svelte
    </PerformerRig>

    <PerformerBadge3D
      {i}
      index={i}
      selected={viewer3DState.selectedPerformerIndex === i}
      allMode={viewer3DState.selectedPerformerIndex === null}
    />

    {#if viewer3DState.selectedPerformerIndex === i || viewer3DState.selectedPerformerIndex === null}
```

Wait — the badge needs to be positioned at the performer's world coordinates. It's already inside the `<T.Group userData={{ performerIndex: i }}>` which doesn't have a position transform — the performer position is set on PerformerRig internally. Need to wrap badge with position:

```svelte
    <T.Group
      position.x={performer.position.x}
      position.y={stageGroundOffset}
      position.z={performer.position.z}
    >
      <PerformerBadge3D
        index={i}
        selected={viewer3DState.selectedPerformerIndex === i}
        allMode={viewer3DState.selectedPerformerIndex === null}
      />
    </T.Group>
```

- [ ] **Step 3: Upgrade ground disc color**

Replace the ground disc `<T.MeshBasicMaterial>` (line 375-379):

```svelte
        <T.MeshBasicMaterial
          color={viewer3DState.selectedPerformerIndex === null
            ? 0x6b7280
            : Number.parseInt(getPerformerColor(i).slice(1), 16)}
          transparent
          opacity={0.35}
        />
```

The `getPerformerColor` returns a hex string like `"#3b82f6"`. Three.js `color` accepts a number, so parse the hex.

- [ ] **Step 4: Run typecheck**

```bash
npx svelte-check --tsconfig tsconfig.json 2>&1 | head -30
```

- [ ] **Step 5: Run build**

```bash
npm run build 2>&1 | tail -20
```

Expected: successful build.

- [ ] **Step 6: Commit**

```bash
git add src/lib/shared/3d/components/Viewer3DScene.svelte
git commit -m "feat(3d): add performer badges and color-coded ground discs"
```

---

## Task 11: Final Verification

- [ ] **Step 1: Run full test suite**

```bash
npx vitest run 2>&1 | tail -30
```

All tests should pass including the new prop-size-link tests.

- [ ] **Step 2: Run typecheck**

```bash
npm run check 2>&1 | tail -20
```

- [ ] **Step 3: Run build**

```bash
npm run build 2>&1 | tail -10
```

- [ ] **Step 4: Manual verification checklist**

Cannot verify visually without browser permission. Report to user:

"I've made all the changes but need you to verify. Please check:
1. Open Performers popover → Prop tab. Prop size slider should appear below the prop grid.
2. Click the link icon — it should switch between linked (🔗) and unlinked (broken chain).
3. In linked mode, dragging the slider should resize all performers' props.
4. In unlinked mode, select performer 2, drag slider — only P2's props should resize.
5. Add 6+ performers — the `+` button should wrap naturally with its neighbors, not orphan.
6. Each performer should have a colored numbered badge floating above their head.
7. Ground discs should match performer chip colors (blue for P1, red for P2, etc.).
8. Scene popover should no longer have the prop size slider."

- [ ] **Step 5: Commit if any fixes needed, then final commit**

```bash
git add -u
git commit -m "feat(3d): per-performer prop sizing with linked/unlinked mode

- Move prop size from Scene to Performers popover
- Add PropSizeControl with link/unlink toggle
- Patch @austencloud/scene-3d to thread propLength
- Add PerformerBadge3D floating labels
- Color-code ground discs per performer
- Fix chip strip +button orphan layout bug"
```
