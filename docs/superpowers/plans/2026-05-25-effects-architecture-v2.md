# Effects Architecture v2 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify dual effect state (VM singleton + EffectsConfigState) into a single source of truth, replace 16x duplicated update/switch code with registry-driven patterns, merge two panel components into one responsive component, and drop the unified panel into the QR page.

**Architecture:** EffectsConfigState becomes the sole owner of all effect state (tipEffectMap, fire/LED/charcoal/trails params, active effect, layer overrides). VM keeps only display + playback settings. A registry map replaces switch/if-else chains. Preset `apply` signatures drop the VM parameter. One `<EffectsPanel>` component handles all layouts via a `layout` prop.

**Tech Stack:** Svelte 5 runes, TypeScript strict mode, Vitest, localStorage persistence.

---

## File Map

### Modified
| File | Responsibility |
|------|---------------|
| `src/lib/shared/effects/state/effects-config-state.svelte.ts` | Add activeEffect, generic updateEffect, dark mode forcing, effectLayerOverrides, localStorage migration |
| `src/lib/shared/effects/state/effects-config-context.ts` | No change (context wrapper stays) |
| `src/lib/shared/effects/domain/EffectsConfig.ts` | Add `activeEffect` field, `effectLayerOverrides` field to EffectsConfig interface |
| `src/lib/shared/effects/domain/defaults.ts` | Add defaults for new fields |
| `src/lib/shared/animation-engine/state/animation-visibility-state.svelte.ts` | Remove ~400 lines of effect state (fire/LED/charcoal/tipEffectMap/effectLayerOverrides/activeEffect) |
| `src/lib/shared/animation-engine/services/implementations/FrameParameterBuilder.ts` | Read fire/LED/charcoal/tipEffectMap from EffectsConfigState instead of VM |
| `src/lib/shared/animation-engine/services/implementations/EffectRendererManager.ts` | Read charcoal params and tipEffectMap from EffectsConfigState instead of VM |
| `src/lib/shared/animation-engine/components/effects-panel/effect-registry.ts` | Add registration map, self-registration, presetGroup/customizeComponent/primaryParam per effect |
| `src/lib/shared/animation-engine/components/effects-panel/presets/types.ts` | Change apply/getSummary signature to `(state: EffectsConfigState)` |
| `src/lib/shared/animation-engine/components/effects-panel/presets/fire-presets.ts` | Write to EffectsConfigState instead of VM |
| `src/lib/shared/animation-engine/components/effects-panel/presets/led-presets.ts` | Write to EffectsConfigState instead of VM |
| `src/lib/shared/animation-engine/components/effects-panel/presets/charcoal-presets.ts` | Write to EffectsConfigState instead of VM |
| `src/lib/shared/animation-engine/components/effects-panel/presets/trail-presets.ts` | Write to EffectsConfigState instead of animationSettings |
| `src/lib/shared/animation-engine/components/effects-panel/presets/*.ts` (remaining 12) | Drop VM param from apply/getSummary (already write to EffectsConfigState) |
| `src/lib/shared/animation-engine/components/effects-panel/EffectsPanel.svelte` | Rewrite: registry-driven, layout prop, drop VM sync |
| `src/lib/shared/animation-engine/components/settings-panels/FirePanel.svelte` | Read/write EffectsConfigState instead of VM |
| `src/lib/shared/animation-engine/components/settings-panels/LedPanel.svelte` | Read/write EffectsConfigState instead of VM |
| `src/lib/shared/animation-engine/components/settings-panels/CharcoalPanel.svelte` | Read/write EffectsConfigState instead of VM |
| `src/lib/shared/animation-engine/components/settings-panels/TrailsPanel.svelte` | Read/write EffectsConfigState instead of animationSettings |
| `src/lib/shared/animation-engine/components/AnimatorCanvas.svelte` | Remove vm-shim binding |
| `src/lib/shared/sequence-viewer/components/SequenceViewerOrchestrator.svelte` | Remove animation-settings-shim import |
| `src/lib/shared/sequence-viewer/components/ViewerSplitPane.svelte` | Remove animation-settings-shim import |
| `src/lib/shared/3d/components/Viewer3DFullscreen.svelte` | Remove animation-settings-shim import |
| `src/routes/q/[code]/+page.svelte` | Drop in unified EffectsPanel, delete hand-rolled controls |

### Deleted
| File | Reason |
|------|--------|
| `src/lib/shared/effects/compat/vm-shim.ts` | Bridge between VM → EffectsConfigState no longer needed |
| `src/lib/shared/effects/compat/animation-settings-shim.ts` | Trail bridge no longer needed |
| `src/lib/shared/animation-engine/components/effects-panel/MobileEffectsPanel.svelte` | Merged into EffectsPanel |
| `src/lib/shared/animation-engine/components/effects-panel/effect-primary-param.ts` | Absorbed into registry |

### Test Files
| File | Tests |
|------|-------|
| `src/lib/shared/effects/state/__tests__/effects-config-state.test.ts` | New: updateEffect generic, activeEffect management, dark mode forcing, localStorage migration |
| `src/lib/shared/animation-engine/components/effects-panel/__tests__/effect-registry.test.ts` | New: registration, lookup, preset group retrieval |

---

## Task 1: Add activeEffect + effectLayerOverrides to EffectsConfig schema

**Files:**
- Modify: `src/lib/shared/effects/domain/EffectsConfig.ts`
- Modify: `src/lib/shared/effects/domain/defaults.ts`

- [ ] **Step 1: Write the test for the new schema fields**

Create test file:

```typescript
// src/lib/shared/effects/domain/__tests__/effects-config-schema.test.ts
import { describe, it, expect } from "vitest";
import { DEFAULT_EFFECTS_CONFIG } from "../defaults";
import type { EffectsConfig } from "../EffectsConfig";

describe("EffectsConfig schema", () => {
  it("has activeEffect field defaulting to 'none'", () => {
    expect(DEFAULT_EFFECTS_CONFIG.activeEffect).toBe("none");
  });

  it("has effectLayerOverrides field defaulting to empty object", () => {
    expect(DEFAULT_EFFECTS_CONFIG.effectLayerOverrides).toEqual({});
  });

  it("satisfies EffectsConfig type with new fields", () => {
    const config: EffectsConfig = {
      ...DEFAULT_EFFECTS_CONFIG,
      activeEffect: "fire",
      effectLayerOverrides: { fire: "front" },
    };
    expect(config.activeEffect).toBe("fire");
    expect(config.effectLayerOverrides.fire).toBe("front");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/shared/effects/domain/__tests__/effects-config-schema.test.ts`
Expected: FAIL — `activeEffect` and `effectLayerOverrides` don't exist on the type yet.

- [ ] **Step 3: Add fields to EffectsConfig interface**

In `src/lib/shared/effects/domain/EffectsConfig.ts`, add to the `EffectsConfig` interface:

```typescript
/** The globally-active effect, or "none" if no effect is selected. */
activeEffect: EffectType;

/** Per-effect z-layer override. Missing entry = "behind" (default).
 *  When "front", the effect's canvas renders above the main props canvas. */
effectLayerOverrides: Record<string, "behind" | "front">;
```

Import `EffectType` from `$lib/shared/animation-engine/domain/types/TipEffectTypes` if not already imported. It's already imported for `TipEffectMap`.

- [ ] **Step 4: Add defaults**

In `src/lib/shared/effects/domain/defaults.ts`, add to the `DEFAULT_EFFECTS_CONFIG` object:

```typescript
activeEffect: "none" as EffectType,
effectLayerOverrides: {},
```

- [ ] **Step 5: Update mergeConfig in effects-config-state.svelte.ts**

In the `mergeConfig` function, add handling for the new fields:

```typescript
activeEffect: patch.activeEffect ?? base.activeEffect,
effectLayerOverrides: patch.effectLayerOverrides ?? base.effectLayerOverrides,
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run src/lib/shared/effects/domain/__tests__/effects-config-schema.test.ts`
Expected: PASS

- [ ] **Step 7: Run full typecheck**

Run: `npm run check`
Expected: PASS (no type errors from the additions — they're additive)

- [ ] **Step 8: Commit**

```bash
git add src/lib/shared/effects/domain/EffectsConfig.ts src/lib/shared/effects/domain/defaults.ts src/lib/shared/effects/state/effects-config-state.svelte.ts src/lib/shared/effects/domain/__tests__/effects-config-schema.test.ts
git commit -m "feat(effects-v2): add activeEffect + effectLayerOverrides to EffectsConfig schema"
```

---

## Task 2: Add generic updateEffect + activeEffect management to EffectsConfigState

**Files:**
- Modify: `src/lib/shared/effects/state/effects-config-state.svelte.ts`
- Create: `src/lib/shared/effects/state/__tests__/effects-config-state.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/shared/effects/state/__tests__/effects-config-state.test.ts
import { describe, it, expect } from "vitest";
import { createEffectsConfigState } from "../effects-config-state.svelte";
import { DEFAULT_EFFECTS_CONFIG } from "../../domain/defaults";

describe("EffectsConfigState", () => {
  describe("updateEffect", () => {
    it("updates a specific effect by id", () => {
      const state = createEffectsConfigState();
      state.updateEffect("fire", { intensity: 0.9 });
      expect(state.fire.intensity).toBe(0.9);
    });

    it("clears active preset for the effect", () => {
      const state = createEffectsConfigState();
      // Seed a preset
      state.config.activePresets.fire = "fire-classic";
      state.updateEffect("fire", { intensity: 0.5 });
      expect(state.activePresets.fire).toBeNull();
    });

    it("throws for unknown effect id", () => {
      const state = createEffectsConfigState();
      expect(() => state.updateEffect("bogus" as any, {})).toThrow();
    });
  });

  describe("activeEffect management", () => {
    it("defaults to 'none'", () => {
      const state = createEffectsConfigState();
      expect(state.activeEffect).toBe("none");
    });

    it("setActiveEffect updates activeEffect and tipEffectMap", () => {
      const state = createEffectsConfigState();
      state.setActiveEffect("fire");
      expect(state.activeEffect).toBe("fire");
      expect(state.tipEffectMap).toEqual({ "*": { effect: "fire" } });
    });

    it("setActiveEffect('none') clears tipEffectMap", () => {
      const state = createEffectsConfigState();
      state.setActiveEffect("fire");
      state.setActiveEffect("none");
      expect(state.activeEffect).toBe("none");
      expect(state.tipEffectMap).toEqual({});
    });
  });

  describe("effectLayerOverrides", () => {
    it("getEffectLayer returns 'behind' by default", () => {
      const state = createEffectsConfigState();
      expect(state.getEffectLayer("fire")).toBe("behind");
    });

    it("setEffectLayer stores override", () => {
      const state = createEffectsConfigState();
      state.setEffectLayer("fire", "front");
      expect(state.getEffectLayer("fire")).toBe("front");
    });

    it("setEffectLayer('behind') removes entry from map", () => {
      const state = createEffectsConfigState();
      state.setEffectLayer("fire", "front");
      state.setEffectLayer("fire", "behind");
      expect(state.config.effectLayerOverrides).toEqual({});
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/shared/effects/state/__tests__/effects-config-state.test.ts`
Expected: FAIL — `updateEffect`, `setActiveEffect`, `getEffectLayer`, `setEffectLayer`, `activeEffect` don't exist.

- [ ] **Step 3: Add generic updateEffect**

In `effects-config-state.svelte.ts`, add inside the factory function (after the 16 `updateX` functions):

```typescript
const EFFECT_IDS = [
  "trails", "fire", "led", "charcoal", "zap", "sparkles", "echo", "bloom",
  "water", "bubbles", "petals", "smoke", "ink", "frost", "silk", "pulse",
] as const;

function updateEffect(effectId: string, patch: Record<string, unknown>) {
  if (!EFFECT_IDS.includes(effectId as any)) {
    throw new Error(`Unknown effect id: "${effectId}"`);
  }
  sceneUndo.captureState("update-effect-config", `Update ${effectId}`);
  (config as any)[effectId] = { ...(config as any)[effectId], ...patch };
  config.activePresets[effectId as keyof typeof config.activePresets] = null;
  scheduleSave();
  sceneUndo.commitStateCoalescing(`effects-${effectId}`);
}
```

- [ ] **Step 4: Add activeEffect management**

```typescript
function setActiveEffect(effect: string) {
  sceneUndo.captureState("set-active-effect", "Set active effect");
  if (effect === "none") {
    config.activeEffect = "none" as any;
    config.tipEffectMap = {};
  } else {
    config.activeEffect = effect as any;
    config.tipEffectMap = { "*": { effect: effect as any } };
  }
  syncDarkModeFromActiveEffect();
  scheduleSave();
  sceneUndo.commitState();
}
```

- [ ] **Step 5: Add dark mode forcing bridge**

```typescript
function syncDarkModeFromActiveEffect() {
  // Import getAnimationVisibilityManager at the top of the file
  // Dark mode forcing: fire, charcoal, LED require dark backgrounds.
  // This bridges to the VM's dark mode toggle since dark mode stays on VM.
  if (typeof window === "undefined") return;
  const darkEffects = ["fire", "charcoal", "led"];
  const needsDark = Object.values(config.tipEffectMap)
    .some(a => darkEffects.includes(a.effect));
  try {
    const { getAnimationVisibilityManager } = await import(
      "$lib/shared/animation-engine/state/animation-visibility-state.svelte"
    );
    // The VM's own syncDarkModeFromMap handles save/restore internally,
    // but we need to tell it the map changed. Use its existing method.
    const vm = getAnimationVisibilityManager();
    // Bridge: VM needs to know which effects need dark mode.
    // Since we're taking over tipEffectMap, use a lightweight signal.
    if (needsDark && !vm.isDarkMode()) {
      vm.setDarkMode(true);
    }
  } catch { /* SSR or VM not available */ }
}
```

Actually, the dark mode sync is complex with save/restore semantics. Simpler approach — keep the `syncDarkModeFromMap` logic in EffectsConfigState directly, since it already owns the tipEffectMap. We need access to the VM's `setDarkMode()` for the actual CSS class toggle. Let's use a callback pattern:

```typescript
let darkModeBeforeEffect: boolean | null = null;
let onDarkModeChange: ((dark: boolean) => void) | null = null;

function setDarkModeBridge(callback: (dark: boolean) => void, currentDark: boolean) {
  onDarkModeChange = callback;
  if (darkModeBeforeEffect === null && currentDark) {
    darkModeBeforeEffect = currentDark;
  }
}

function syncDarkModeFromActiveEffect() {
  if (!onDarkModeChange) return;
  const darkEffects = ["fire", "charcoal", "led"];
  const needsDark = Object.values(config.tipEffectMap)
    .some(a => darkEffects.includes(a.effect));
  if (needsDark) {
    if (darkModeBeforeEffect === null) {
      // Capture current state before forcing
      // The VM will provide this via setDarkModeBridge
    }
    onDarkModeChange(true);
  } else if (darkModeBeforeEffect !== null) {
    onDarkModeChange(darkModeBeforeEffect);
    darkModeBeforeEffect = null;
  }
}
```

This will be wired by AnimatorCanvas after creating EffectsConfigState. For the test, skip the dark mode bridge (it requires the VM which is a singleton with DOM deps).

- [ ] **Step 6: Add effectLayerOverrides management**

```typescript
function getEffectLayer(effectId: string): "behind" | "front" {
  return config.effectLayerOverrides[effectId] ?? "behind";
}

function setEffectLayer(effectId: string, mode: "behind" | "front") {
  if (mode === "behind") {
    const { [effectId]: _omit, ...rest } = config.effectLayerOverrides;
    config.effectLayerOverrides = rest;
  } else {
    config.effectLayerOverrides = {
      ...config.effectLayerOverrides,
      [effectId]: mode,
    };
  }
  scheduleSave();
}
```

- [ ] **Step 7: Expose new methods in the return object**

Add to the return object:

```typescript
get activeEffect() { return config.activeEffect; },
get effectLayerOverrides() { return config.effectLayerOverrides; },
updateEffect,
setActiveEffect,
getEffectLayer,
setEffectLayer,
setDarkModeBridge,
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npx vitest run src/lib/shared/effects/state/__tests__/effects-config-state.test.ts`
Expected: PASS

- [ ] **Step 9: Run typecheck**

Run: `npm run check`
Expected: PASS

- [ ] **Step 10: Commit**

```bash
git add src/lib/shared/effects/state/effects-config-state.svelte.ts src/lib/shared/effects/state/__tests__/effects-config-state.test.ts
git commit -m "feat(effects-v2): generic updateEffect + activeEffect + effectLayerOverrides in EffectsConfigState"
```

---

## Task 3: Migrate fire/LED/charcoal params from VM to EffectsConfigState

**Files:**
- Modify: `src/lib/shared/effects/state/effects-config-state.svelte.ts` (minor — fire/LED/charcoal intent objects already exist in the schema, they're already stored here. The work is making the _readers_ use them.)
- Modify: `src/lib/shared/animation-engine/services/implementations/FrameParameterBuilder.ts`
- Modify: `src/lib/shared/animation-engine/services/implementations/EffectRendererManager.ts`

This task changes WHERE the engine reads fire/LED/charcoal config from — switching from VM getters to EffectsConfigState properties. The write side (presets/panels) is migrated in Tasks 7-8.

- [ ] **Step 1: Update FrameParameterBuilder — fire config reads**

In `FrameParameterBuilder.ts`, line 251 currently reads:
```typescript
fp.propColors = getVM()?.getFirePropColors() ?? DEFAULT_PROP_FLAME_COLORS;
```

Change to:
```typescript
fp.propColors = effectsConfigState?.fire.propColors ?? DEFAULT_PROP_FLAME_COLORS;
```

The `fireConfig` on line 248 is already read from `erm.fireConfig` which comes from the renderer — that path stays. But the fire color curve is read by the fire renderer from VM. We need to trace that path.

- [ ] **Step 2: Update FrameParameterBuilder — tipEffectMap read**

Line 389 currently reads:
```typescript
fp.tipEffectMap = erm.cellTipEffectMap ?? getVM()?.getTipEffectMap() ?? {};
```

Change to:
```typescript
fp.tipEffectMap = erm.cellTipEffectMap ?? effectsConfigState?.tipEffectMap ?? {};
```

- [ ] **Step 3: Update EffectRendererManager — charcoal params**

In `EffectRendererManager.ts`, line 287 has `getCharcoalParamsFromVM()` which reads `this.getVM().getCharcoalParams()`. Change this to read from EffectsConfigState.

The ERM already has access to `effectsConfigState` (it's passed via the engine). Add a method:

```typescript
getCharcoalParamsFromConfig(): CharcoalSparkParams | undefined {
  if (!this.effectsConfigState) return undefined;
  const intent = this.effectsConfigState.charcoal;
  return semanticToCharcoalParams(intent);
}
```

Update the OVERLAY_REGISTRY charcoal `onInit` (line 94):
```typescript
onInit: (mgr, renderer) => {
  const charcoalParams = mgr.getCharcoalParamsFromConfig();
  if (charcoalParams) (renderer as CharcoalSparkRenderer).setParams(charcoalParams);
},
```

- [ ] **Step 4: Update EffectRendererManager — tipEffectMap reads**

In `hasEffectInEffectiveMap` (line 475-478), change:
```typescript
const effectiveMap = this.cellTipEffectMap ??
  (this.getVM ? this.getVM().getTipEffectMap() : {});
```
to:
```typescript
const effectiveMap = this.cellTipEffectMap ??
  this.effectsConfigState?.tipEffectMap ?? {};
```

- [ ] **Step 5: Update EffectRendererManager — effect layer reads**

In `syncEffectLayers` (line 508-520), change:
```typescript
if (!this.getVM) return;
const vm = this.getVM();
// ...
renderer.setCanvasZIndex(resolveEffectZ(id, vm.getEffectLayer(id)));
```
to:
```typescript
if (!this.effectsConfigState) return;
const state = this.effectsConfigState;
const apply = (id: string, renderer: { setCanvasZIndex?: (z: number) => void } | null) => {
  if (!renderer?.setCanvasZIndex) return;
  renderer.setCanvasZIndex(resolveEffectZ(id, state.getEffectLayer(id)));
};
```

- [ ] **Step 6: Run typecheck**

Run: `npm run check`
Expected: PASS — types align since EffectsConfigState already has fire/led/charcoal intent objects.

- [ ] **Step 7: Run existing tests**

Run: `npx vitest run`
Expected: PASS (no existing tests should break from read-path changes)

- [ ] **Step 8: Commit**

```bash
git add src/lib/shared/animation-engine/services/implementations/FrameParameterBuilder.ts src/lib/shared/animation-engine/services/implementations/EffectRendererManager.ts
git commit -m "refactor(effects-v2): engine reads fire/LED/charcoal/tipEffectMap from EffectsConfigState"
```

---

## Task 4: One-time localStorage migration + delete vm-shim and animation-settings-shim

**Files:**
- Modify: `src/lib/shared/effects/state/effects-config-state.svelte.ts`
- Delete: `src/lib/shared/effects/compat/vm-shim.ts`
- Delete: `src/lib/shared/effects/compat/animation-settings-shim.ts`
- Modify: `src/lib/shared/animation-engine/components/AnimatorCanvas.svelte` (remove vm-shim binding)
- Modify: `src/lib/shared/sequence-viewer/components/SequenceViewerOrchestrator.svelte` (remove shim import)
- Modify: `src/lib/shared/sequence-viewer/components/ViewerSplitPane.svelte` (remove shim import)
- Modify: `src/lib/shared/3d/components/Viewer3DFullscreen.svelte` (remove shim import)

- [ ] **Step 1: Add one-time localStorage migration to EffectsConfigState**

In `loadStoredConfig()`, after loading and parsing, check if fire/LED/charcoal have default values and the VM's localStorage key has non-default values. If so, snapshot from VM key one final time.

Add this function before `loadStoredConfig`:

```typescript
const VM_STORAGE_KEY = "animation-visibility-settings";

function migrateFromVmStorageOnce(config: EffectsConfig): EffectsConfig {
  if (typeof window === "undefined") return config;
  try {
    const vmRaw = localStorage.getItem(VM_STORAGE_KEY);
    if (!vmRaw) return config;
    const vm = JSON.parse(vmRaw);
    const migrated = { ...config };

    // Fire — if EffectsConfigState has defaults but VM has custom values
    if (vm.fireIntensity !== undefined) {
      migrated.fire = {
        ...migrated.fire,
        intensity: vm.fireIntensity ?? migrated.fire.intensity,
        colorBlend: vm.fireColorBlend ?? migrated.fire.colorBlend,
        turbulence: vm.fireTurbulence ?? migrated.fire.turbulence,
        colorCurve: vm.fireColorCurve ?? migrated.fire.colorCurve,
        propColors: vm.firePropColors ?? migrated.fire.propColors,
      };
    }

    // LED
    if (vm.ledPatternId !== undefined) {
      migrated.led = {
        ...migrated.led,
        brightness: vm.ledBrightness ?? migrated.led.brightness,
        patternId: vm.ledPatternId ?? migrated.led.patternId,
        patternSpeed: vm.ledPatternSpeed ?? migrated.led.patternSpeed,
        primaryColor: vm.ledPrimaryColor ?? migrated.led.primaryColor,
        secondaryColor: vm.ledSecondaryColor ?? migrated.led.secondaryColor,
        colorMode: vm.ledColorMode ?? migrated.led.colorMode,
      };
    }

    // Charcoal — VM stores raw CharcoalSparkParams; translate to semantic
    if (vm.charcoalParams) {
      // Import charcoalParamsToSemantic at top
      const semantic = charcoalParamsToSemantic(vm.charcoalParams);
      migrated.charcoal = {
        ...migrated.charcoal,
        intensity: semantic.intensity,
        spread: semantic.spread,
        glow: semantic.glow,
      };
    }

    // tipEffectMap
    if (vm.tipEffectMap && Object.keys(vm.tipEffectMap).length > 0) {
      migrated.tipEffectMap = vm.tipEffectMap;
    }

    // effectLayerOverrides
    if (vm.effectLayerOverrides && Object.keys(vm.effectLayerOverrides).length > 0) {
      migrated.effectLayerOverrides = vm.effectLayerOverrides;
    }

    // activeEffect — derive from tipEffectMap wildcard
    const wildcard = migrated.tipEffectMap["*"];
    if (wildcard) {
      migrated.activeEffect = wildcard.effect as any;
    }

    return migrated;
  } catch {
    return config;
  }
}
```

Call it inside `loadStoredConfig`:
```typescript
// After merging defaults:
return migrateFromVmStorageOnce(mergeConfig(DEFAULT_EFFECTS_CONFIG, parsed));
```

Also call it for the first-load case (when no stored config exists):
```typescript
// In createEffectsConfigState:
const stored = loadStoredConfig();
let config = $state<EffectsConfig>(stored ?? migrateFromVmStorageOnce(structuredClone(initial)));
```

- [ ] **Step 2: Remove vm-shim binding from AnimatorCanvas.svelte**

Search for `bindVmToEffectsConfig` in `AnimatorCanvas.svelte` and remove the import and the call. Also remove any `snapshotConfigFromVm` usage.

- [ ] **Step 3: Remove animation-settings-shim calls from consumers**

In each of these files, remove the import of `seedTrailsFromAnimationSettings` and the call:
- `SequenceViewerOrchestrator.svelte`
- `ViewerSplitPane.svelte`
- `Viewer3DFullscreen.svelte`

These callers were seeding trail state from `animationSettings` into EffectsConfigState. After migration, EffectsConfigState owns trails directly — no seeding needed.

- [ ] **Step 4: Delete the shim files**

```bash
git rm src/lib/shared/effects/compat/vm-shim.ts
git rm src/lib/shared/effects/compat/animation-settings-shim.ts
```

- [ ] **Step 5: Run typecheck**

Run: `npm run check`
Expected: PASS — all imports of deleted files have been removed.

- [ ] **Step 6: Run tests**

Run: `npx vitest run`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor(effects-v2): one-time localStorage migration, delete vm-shim + animation-settings-shim"
```

---

## Task 5: Strip effect state from VM

**Files:**
- Modify: `src/lib/shared/animation-engine/state/animation-visibility-state.svelte.ts`

Remove all fire/LED/charcoal getters and setters, tipEffectMap/tipEffortMap methods, activeEffect/hasEffect methods, effectLayerOverrides methods, syncDarkModeFromMap, and darkModeBeforeEffect. Also remove the related types from `AnimationVisibilitySettings` interface.

- [ ] **Step 1: Remove fire fields from AnimationVisibilitySettings**

Remove these fields from the interface (lines 54-58):
```
fireColorBlend, fireIntensity, fireTurbulence, fireColorCurve, firePropColors
```

- [ ] **Step 2: Remove charcoal field**

Remove `charcoalParams: CharcoalSparkParams` from the interface (line 61).

- [ ] **Step 3: Remove LED fields**

Remove all `led*` fields from the interface (lines 63-71):
```
ledBrightness, ledPatternId, ledPrimaryColor, ledSecondaryColor, ledActivePresetId, ledUserPresets, ledPatternSpeed, ledColorMode
```

- [ ] **Step 4: Remove tipEffectMap/tipEffortMap/effectLayerOverrides from interface**

Remove lines 86-91:
```
tipEffectMap, tipEffortMap, effectLayerOverrides
```

- [ ] **Step 5: Remove corresponding getters/setters/methods**

Remove the following method blocks (approximately lines 610-1027):
- `getFireColorBlend`, `setFireColorBlend` (610-618)
- `getCharcoalParams`, `setCharcoalParams`, `updateCharcoalParam` (624-638)
- `getFireIntensity`, `setFireIntensity` (640-648)
- `getFireTurbulence`, `setFireTurbulence` (650-658)
- `getFireColorCurve`, `setFireColorCurve` (660-668)
- `getFirePropColors`, `setFirePropColors` (670-678)
- `resetFireDefaults` (681-688)
- `resetCharcoalDefaults` (691-695)
- All LED getters/setters (700-845)
- `getTipEffectMap`, `setTipEffectMap` (871-880)
- `getTipEffortMap`, `setTipEffortMap` (882-890)
- `setActiveEffect`, `getActiveEffect` (896-913)
- `hasEffect`, `isTrailsActive`, `isAnyDarkModeEffectActive` (918-937)
- `syncDarkModeFromMap` (944-966)
- `getEffectLayer`, `setEffectLayer`, `toggleEffectLayer`, `getEffectLayerOverrides` (1006-1031)

- [ ] **Step 6: Remove darkModeBeforeEffect field**

Remove `private darkModeBeforeEffect: boolean | null = null;` (line 99).

- [ ] **Step 7: Clean up getDefaultSettings**

Remove the fire/LED/charcoal/tipEffectMap/tipEffortMap/effectLayerOverrides defaults.

- [ ] **Step 8: Clean up loadFromStorage**

Remove all migration code that references fire/LED/charcoal/tipEffectMap/tipEffortMap/effectLayerOverrides. These fields no longer exist in the VM's settings shape.

- [ ] **Step 9: Update Exclude type unions in getVisibility/setVisibility/toggleVisibility**

Remove the now-deleted field names from the Exclude union types.

- [ ] **Step 10: Remove unused imports**

Remove imports of: `CharcoalSparkParams`, `DEFAULT_CHARCOAL_PARAMS`, `FireColorCurve`, `EffectType`, `TipEffectMap`, `TipEffortMap`, `LedColorPreset`, `findPreset`, `validatePreset`, `EffectLayerMode`, `PropFlameColor`.

- [ ] **Step 11: Run typecheck**

Run: `npm run check`
Expected: Errors in files that still call removed VM methods. These are the settings panels and preset files — they'll be migrated in Tasks 7-8.

Identify all callers. Fix import errors now, but leave preset/panel migrations for their own tasks.

- [ ] **Step 12: Fix remaining callers that read from VM**

Grep for all remaining usages of removed methods across the codebase:
```
getFireColorBlend, setFireColorBlend, getFireIntensity, setFireIntensity,
getFireTurbulence, setFireTurbulence, getFireColorCurve, setFireColorCurve,
getFirePropColors, setFirePropColors, getCharcoalParams, setCharcoalParams,
getLedBrightness, setLedBrightness, getLedPatternId, setLedPatternId,
getLedPrimaryColor, setLedPrimaryColor, getLedSecondaryColor, setLedSecondaryColor,
getActivePresetId, setActivePreset, getUserPresets, addUserPreset, removeUserPreset,
getLedPatternSpeed, setLedPatternSpeed, getLedColorMode, setLedColorMode,
getTipEffectMap, setTipEffectMap, setActiveEffect, getActiveEffect,
hasEffect, isTrailsActive, isAnyDarkModeEffectActive,
getEffectLayer, setEffectLayer, toggleEffectLayer, getEffectLayerOverrides,
resetFireDefaults, resetCharcoalDefaults
```

For each caller, redirect to EffectsConfigState. This is a large mechanical step — each caller just needs to swap `vm.getX()` → `effectsConfigState.x` (for simple property reads) or `vm.setX(v)` → `effectsConfigState.updateEffect("x", { field: v })`.

Note: The settings panels (FirePanel, LedPanel, CharcoalPanel, TrailsPanel) and preset files are the main callers. Those are covered in Tasks 7-8. The remaining callers (keyboard shortcuts, context menu, etc.) are covered in Task 12.

- [ ] **Step 13: Run typecheck again**

Run: `npm run check`
Expected: Still errors from preset/panel files — those are Tasks 7-8. But the VM itself should be clean.

- [ ] **Step 14: Commit (with `--no-verify` only if preset/panel errors remain)**

Actually — do NOT commit with errors. Combine this task with Task 7 (preset migration) in a single commit if needed. Or temporarily keep thin delegating methods on VM that forward to a passed EffectsConfigState. Given the plan structure, let's take a different approach:

**Revised approach:** Instead of deleting everything at once, add deprecation markers and change the VM methods to delegate to EffectsConfigState. This way typecheck passes at each step. The actual deletion happens after all callers are migrated (Task 9).

Keep this task focused on: remove the STORAGE of effect fields from VM's settings interface and defaults. The methods become thin delegates that log a deprecation warning and forward to a shared EffectsConfigState instance. The shared instance is set via a new `setEffectsConfigState(state)` method on the VM.

```typescript
private effectsState: EffectsConfigState | null = null;

setEffectsConfigState(state: EffectsConfigState): void {
  this.effectsState = state;
}

// Delegate: all fire getters/setters forward to effectsState
getFireIntensity(): number {
  return this.effectsState?.fire.intensity ?? 0.7;
}
setFireIntensity(intensity: number): void {
  this.effectsState?.updateEffect("fire", { intensity: Math.max(0, Math.min(1, intensity)) });
}
// ... etc for all effect methods
```

This preserves backward compat while the engine is the source of truth.

- [ ] **Step 15: Commit**

```bash
git add src/lib/shared/animation-engine/state/animation-visibility-state.svelte.ts
git commit -m "refactor(effects-v2): VM delegates effect getters/setters to EffectsConfigState"
```

---

## Task 6: Enhance effect-registry.ts with registration map

**Files:**
- Modify: `src/lib/shared/animation-engine/components/effects-panel/effect-registry.ts`
- Create: `src/lib/shared/animation-engine/components/effects-panel/__tests__/effect-registry.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/shared/animation-engine/components/effects-panel/__tests__/effect-registry.test.ts
import { describe, it, expect } from "vitest";
import { getRegistration, EFFECTS } from "../effect-registry";

describe("effect-registry", () => {
  it("returns registration for every effect in EFFECTS", () => {
    for (const meta of EFFECTS) {
      const reg = getRegistration(meta.id);
      expect(reg).toBeDefined();
      expect(reg!.meta.id).toBe(meta.id);
      expect(reg!.presetGroup).toBeDefined();
      expect(reg!.presetGroup.presets.length).toBeGreaterThan(0);
    }
  });

  it("returns undefined for unknown effect id", () => {
    expect(getRegistration("bogus")).toBeUndefined();
  });

  it("each registration has a customizeComponent loader", () => {
    for (const meta of EFFECTS) {
      const reg = getRegistration(meta.id);
      expect(typeof reg!.customizeComponent).toBe("function");
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/shared/animation-engine/components/effects-panel/__tests__/effect-registry.test.ts`
Expected: FAIL — `getRegistration` doesn't exist.

- [ ] **Step 3: Add EffectRegistration interface and registration map**

In `effect-registry.ts`, add:

```typescript
import type { EffectPresetGroup } from "./presets/types";
import type { PrimaryParamSpec } from "./effect-primary-param";
import type { Component } from "svelte";

export interface EffectRegistration {
  meta: EffectMeta;
  presetGroup: EffectPresetGroup;
  customizeComponent: () => Promise<{ default: Component }>;
  primaryParam?: PrimaryParamSpec;
}

const REGISTRY = new Map<string, EffectRegistration>();

export function registerEffect(reg: EffectRegistration): void {
  REGISTRY.set(reg.meta.id, reg);
}

export function getRegistration(id: string): EffectRegistration | undefined {
  return REGISTRY.get(id);
}

export function getAllRegistrations(): EffectRegistration[] {
  return EFFECTS.map(e => REGISTRY.get(e.id)).filter(Boolean) as EffectRegistration[];
}
```

- [ ] **Step 4: Self-register all 16 effects**

Add at the bottom of `effect-registry.ts`, importing from each preset file:

```typescript
import { FIRE_PRESET_GROUP } from "./presets/fire-presets";
import { LED_PRESET_GROUP } from "./presets/led-presets";
import { TRAIL_PRESET_GROUP } from "./presets/trail-presets";
import { CHARCOAL_PRESET_GROUP } from "./presets/charcoal-presets";
import { ZAP_PRESET_GROUP } from "./presets/zap-presets";
import { SPARKLES_PRESET_GROUP } from "./presets/sparkles-presets";
import { ECHO_PRESET_GROUP } from "./presets/echo-presets";
import { BLOOM_PRESET_GROUP } from "./presets/bloom-presets";
import { WATER_PRESET_GROUP } from "./presets/water-presets";
import { BUBBLES_PRESET_GROUP } from "./presets/bubbles-presets";
import { PETALS_PRESET_GROUP } from "./presets/petals-presets";
import { SMOKE_PRESET_GROUP } from "./presets/smoke-presets";
import { INK_PRESET_GROUP } from "./presets/ink-presets";
import { FROST_PRESET_GROUP } from "./presets/frost-presets";
import { SILK_PRESET_GROUP } from "./presets/silk-presets";
import { PULSE_PRESET_GROUP } from "./presets/pulse-presets";
import { PRIMARY_PARAMS } from "./effect-primary-param";

// Register all effects. Customize components are lazy-loaded.
for (const meta of EFFECTS) {
  const presetGroups: Record<string, EffectPresetGroup> = {
    trails: TRAIL_PRESET_GROUP,
    fire: FIRE_PRESET_GROUP,
    led: LED_PRESET_GROUP,
    charcoal: CHARCOAL_PRESET_GROUP,
    zap: ZAP_PRESET_GROUP,
    sparkles: SPARKLES_PRESET_GROUP,
    echo: ECHO_PRESET_GROUP,
    bloom: BLOOM_PRESET_GROUP,
    water: WATER_PRESET_GROUP,
    bubbles: BUBBLES_PRESET_GROUP,
    petals: PETALS_PRESET_GROUP,
    smoke: SMOKE_PRESET_GROUP,
    ink: INK_PRESET_GROUP,
    frost: FROST_PRESET_GROUP,
    silk: SILK_PRESET_GROUP,
    pulse: PULSE_PRESET_GROUP,
  };

  const customizeLoaders: Record<string, () => Promise<{ default: Component }>> = {
    trails: () => import("./customize/TrailCustomize.svelte"),
    fire: () => import("./customize/FireCustomize.svelte"),
    led: () => import("./customize/LedCustomize.svelte"),
    charcoal: () => import("./customize/CharcoalCustomize.svelte"),
    zap: () => import("./customize/ZapCustomize.svelte"),
    sparkles: () => import("./customize/SparklesCustomize.svelte"),
    echo: () => import("./customize/EchoCustomize.svelte"),
    bloom: () => import("./customize/BloomCustomize.svelte"),
    water: () => import("./customize/WaterCustomize.svelte"),
    bubbles: () => import("./customize/BubblesCustomize.svelte"),
    petals: () => import("./customize/PetalsCustomize.svelte"),
    smoke: () => import("./customize/SmokeCustomize.svelte"),
    ink: () => import("./customize/InkCustomize.svelte"),
    frost: () => import("./customize/FrostCustomize.svelte"),
    silk: () => import("./customize/SilkCustomize.svelte"),
    pulse: () => import("./customize/PulseCustomize.svelte"),
  };

  registerEffect({
    meta,
    presetGroup: presetGroups[meta.id]!,
    customizeComponent: customizeLoaders[meta.id]!,
    primaryParam: PRIMARY_PARAMS[meta.id],
  });
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/lib/shared/animation-engine/components/effects-panel/__tests__/effect-registry.test.ts`
Expected: PASS

- [ ] **Step 6: Run typecheck**

Run: `npm run check`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/lib/shared/animation-engine/components/effects-panel/effect-registry.ts src/lib/shared/animation-engine/components/effects-panel/__tests__/effect-registry.test.ts
git commit -m "feat(effects-v2): enhanced effect registry with preset groups, customize loaders, primary params"
```

---

## Task 7: Migrate preset apply/getSummary signatures

**Files:**
- Modify: `src/lib/shared/animation-engine/components/effects-panel/presets/types.ts`
- Modify: all 16 preset files in `src/lib/shared/animation-engine/components/effects-panel/presets/`

- [ ] **Step 1: Change preset types**

In `presets/types.ts`, change:

```typescript
apply: (vm: AnimationVisibilityStateManager, state: EffectsConfigState | null) => void;
```
to:
```typescript
apply: (state: EffectsConfigState) => void;
```

And:
```typescript
getSummary: (vm: AnimationVisibilityStateManager, state: EffectsConfigState | null) => string;
```
to:
```typescript
getSummary: (state: EffectsConfigState) => string;
```

Remove the `AnimationVisibilityStateManager` import.

- [ ] **Step 2: Migrate fire-presets.ts**

Each fire preset currently calls `vm.setFireColorCurve()`, `vm.setFirePropColors()`, etc. Change to write to `state`:

```typescript
apply: (state) => {
  state.updateEffect("fire", { colorCurve: CLASSIC_CURVE, propColors: null });
},
```

For the custom preset:
```typescript
apply: (state) => {
  const colors = loadCustomFireColors();
  state.updateEffect("fire", {
    colorBlend: 1.0,
    propColors: [hexToFlameColor(colors.left), hexToFlameColor(colors.right)],
  });
},
```

For `applyCustomFireColors`, change signature from `(vm, colors)` to `(state, colors)`:
```typescript
export function applyCustomFireColors(state: EffectsConfigState, colors: CustomFireColors): void {
  state.updateEffect("fire", {
    colorBlend: 1.0,
    propColors: [hexToFlameColor(colors.left), hexToFlameColor(colors.right)],
  });
}
```

For `getSummary`:
```typescript
getSummary: (state: EffectsConfigState): string => {
  const intensityPct = Math.round(state.fire.intensity * 100);
  const blend = state.fire.colorBlend;
  const colorMode = blend < 0.15 ? "Natural" : blend < 0.5 ? "Tinted" : "Prop-colored";
  return `Intensity ${intensityPct}% · ${colorMode}`;
},
```

Remove `AnimationVisibilityStateManager` import.

- [ ] **Step 3: Migrate led-presets.ts**

Each LED preset currently calls `vm.setLedColorMode()`, `vm.setLedPrimaryColor()`, etc. Change to:

```typescript
apply: (state) => {
  state.updateEffect("led", {
    colorMode: "unified",
    primaryColor: "#00ff88",
    patternId: "solid",
    brightness: 4,
  });
},
```

For `getSummary`:
```typescript
getSummary: (state: EffectsConfigState): string => {
  const pattern = capitalizeFirst(state.led.patternId);
  const brightness = state.led.brightness;
  const speed = state.led.patternSpeed.toFixed(1);
  return `${pattern} · Brightness ${brightness} · ${speed}x`;
},
```

Remove `AnimationVisibilityStateManager` import.

- [ ] **Step 4: Migrate charcoal-presets.ts**

Each charcoal preset calls `vm.setCharcoalParams()`. The canonical EffectsConfigState uses semantic scalars, not raw params. The preset builds semantic + custom colors:

```typescript
apply: (state) => {
  state.updateEffect("charcoal", {
    intensity: 0.5,
    spread: 0.5,
    glow: 0.6,
    coreColor: [230, 180, 255],
    midColor: [160, 60, 220],
    coolColor: [80, 10, 120],
  });
},
```

Note: The CharcoalIntent interface needs `coreColor`, `midColor`, `coolColor` fields. Check if they exist. If not, add them to the interface in `EffectsConfig.ts`.

For `getSummary`:
```typescript
getSummary: (state: EffectsConfigState): string => {
  const i = Math.round(state.charcoal.intensity * 100);
  const s = Math.round(state.charcoal.spread * 100);
  const g = Math.round(state.charcoal.glow * 100);
  return `Intensity ${i}% · Spread ${s}% · Glow ${g}%`;
},
```

Remove `AnimationVisibilityStateManager` import.

- [ ] **Step 5: Migrate trail-presets.ts**

Trail presets currently call `animationSettings.setTrailAppearance()`. Change to write to EffectsConfigState:

```typescript
apply: (state) => {
  state.updateEffect("trails", {
    thickness: 5,
    brightness: 1.0,
    blueColor: DEFAULT_BLUE,
    redColor: DEFAULT_RED,
  });
},
```

For `applyCustomTrailColors`:
```typescript
export function applyCustomTrailColors(state: EffectsConfigState, colors: CustomTrailColors): void {
  state.updateEffect("trails", {
    thickness: 5,
    brightness: 1.0,
    blueColor: colors.blue,
    redColor: colors.red,
  });
}
```

For `getSummary`:
```typescript
getSummary: (state: EffectsConfigState): string => {
  const lineWidth = state.trails.thickness;
  const brightnessPct = Math.round(state.trails.brightness * 100);
  return `Width ${lineWidth}px · Brightness ${brightnessPct}%`;
},
```

Remove `animationSettings` and `AnimationVisibilityStateManager` imports.

- [ ] **Step 6: Migrate remaining 12 preset files**

For zap, sparkles, echo, bloom, water, bubbles, petals, smoke, ink, frost, silk, pulse:

These already write to EffectsConfigState. The mechanical change is:
1. Change `apply: (vm, state)` to `apply: (state)` — drop unused `vm` param
2. Change `state!.updateX(...)` to `state.updateEffect("x", ...)` (or keep `state.updateX(...)` — the named methods still exist as aliases)
3. Change `getSummary: (vm, state)` to `getSummary: (state)` — drop `vm`
4. Remove `AnimationVisibilityStateManager` import

- [ ] **Step 7: Run typecheck**

Run: `npm run check`
Expected: Errors in EffectsPanel.svelte and MobileEffectsPanel.svelte where `preset.apply(vm, effectsConfigState)` now doesn't match the new signature. These are fixed in Task 10.

- [ ] **Step 8: Commit**

```bash
git add src/lib/shared/animation-engine/components/effects-panel/presets/
git commit -m "refactor(effects-v2): migrate all preset apply/getSummary to EffectsConfigState-only signature"
```

---

## Task 8: Migrate settings panels (FirePanel, LedPanel, CharcoalPanel, TrailsPanel)

**Files:**
- Modify: `src/lib/shared/animation-engine/components/settings-panels/FirePanel.svelte`
- Modify: `src/lib/shared/animation-engine/components/settings-panels/LedPanel.svelte`
- Modify: `src/lib/shared/animation-engine/components/settings-panels/CharcoalPanel.svelte`
- Modify: `src/lib/shared/animation-engine/components/settings-panels/TrailsPanel.svelte`

These panels are the "Customize" views. Each currently reads/writes to the VM. After migration, they read/write to EffectsConfigState via context.

- [ ] **Step 1: Migrate FirePanel.svelte**

Replace every `vm.getFireX()` / `vm.setFireX()` call with EffectsConfigState reads/writes:

```
vm.getFireIntensity()     → effectsConfigState.fire.intensity
vm.setFireIntensity(v)    → effectsConfigState.updateEffect("fire", { intensity: v })
vm.getFireColorBlend()    → effectsConfigState.fire.colorBlend
vm.setFireColorBlend(v)   → effectsConfigState.updateEffect("fire", { colorBlend: v })
vm.getFireTurbulence()    → effectsConfigState.fire.turbulence
vm.setFireTurbulence(v)   → effectsConfigState.updateEffect("fire", { turbulence: v })
vm.getFireColorCurve()    → effectsConfigState.fire.colorCurve
vm.setFireColorCurve(v)   → effectsConfigState.updateEffect("fire", { colorCurve: v })
vm.getFirePropColors()    → effectsConfigState.fire.propColors
vm.setFirePropColors(v)   → effectsConfigState.updateEffect("fire", { propColors: v })
vm.resetFireDefaults()    → effectsConfigState.updateEffect("fire", DEFAULT_EFFECTS_CONFIG.fire)
```

Remove the `getAnimationVisibilityManager` import and `vm` variable. Get `effectsConfigState` from context via `getEffectsConfigContext()`.

- [ ] **Step 2: Migrate LedPanel.svelte**

```
vm.getLedBrightness()      → effectsConfigState.led.brightness
vm.setLedBrightness(v)     → effectsConfigState.updateEffect("led", { brightness: v })
vm.getLedPatternId()       → effectsConfigState.led.patternId
vm.setLedPatternId(v)      → effectsConfigState.updateEffect("led", { patternId: v })
vm.getLedPrimaryColor()    → effectsConfigState.led.primaryColor
vm.setLedPrimaryColor(v)   → effectsConfigState.updateEffect("led", { primaryColor: v })
vm.getLedSecondaryColor()  → effectsConfigState.led.secondaryColor
vm.setLedSecondaryColor(v) → effectsConfigState.updateEffect("led", { secondaryColor: v })
vm.getLedColorMode()       → effectsConfigState.led.colorMode
vm.setLedColorMode(v)      → effectsConfigState.updateEffect("led", { colorMode: v })
vm.getLedPatternSpeed()    → effectsConfigState.led.patternSpeed
vm.setLedPatternSpeed(v)   → effectsConfigState.updateEffect("led", { patternSpeed: v })
vm.getActivePresetId()     → effectsConfigState.activePresets.led
vm.setActivePreset(id)     → effectsConfigState.applyPreset({ effectType: "led", id, patch: {...} })
vm.getUserPresets()        → (move user presets to EffectsConfigState or keep as standalone localStorage)
vm.addUserPreset(n, c)     → (move to EffectsConfigState)
vm.removeUserPreset(id)    → (move to EffectsConfigState)
```

Note: LED user presets (custom saved color combos) are currently stored on the VM. These need to either move into EffectsConfigState or stay as a separate localStorage concern. Since they're small and LED-specific, add a `ledUserPresets` field to the LedIntent interface, or keep them in standalone localStorage (they're already persisted separately). Keeping them standalone is simpler.

- [ ] **Step 3: Migrate CharcoalPanel.svelte**

```
vm.getCharcoalParams()       → semanticToCharcoalParams(effectsConfigState.charcoal)
vm.setCharcoalParams(p)      → effectsConfigState.updateEffect("charcoal", charcoalParamsToSemantic(p))
vm.updateCharcoalParam(k, v) → (use updateEffect with the semantic equivalent)
vm.resetCharcoalDefaults()   → effectsConfigState.updateEffect("charcoal", DEFAULT_EFFECTS_CONFIG.charcoal)
```

- [ ] **Step 4: Migrate TrailsPanel.svelte**

Currently reads from `animationSettings.trail`:
```
animationSettings.trail.lineWidth    → effectsConfigState.trails.thickness
animationSettings.trail.maxOpacity   → effectsConfigState.trails.brightness
animationSettings.trail.blueColor    → effectsConfigState.trails.blueColor
animationSettings.trail.redColor     → effectsConfigState.trails.redColor
animationSettings.setTrailAppearance → effectsConfigState.updateEffect("trails", {...})
```

- [ ] **Step 5: Run typecheck**

Run: `npm run check`
Expected: PASS (panels now read/write EffectsConfigState)

- [ ] **Step 6: Commit**

```bash
git add src/lib/shared/animation-engine/components/settings-panels/
git commit -m "refactor(effects-v2): migrate Fire/LED/Charcoal/Trails panels to EffectsConfigState"
```

---

## Task 9: Delete VM delegate methods + clean up unused code

**Files:**
- Modify: `src/lib/shared/animation-engine/state/animation-visibility-state.svelte.ts`

After Tasks 5-8 migrated all callers, the VM's delegate methods are no longer called. Remove them entirely.

- [ ] **Step 1: Grep for any remaining callers of VM effect methods**

Run comprehensive grep for every method name listed in Task 5, step 12. Any remaining caller must be migrated first.

- [ ] **Step 2: Remove all delegate methods**

Delete all fire/LED/charcoal/effect delegate methods added in Task 5. Also remove `setEffectsConfigState()` and `effectsState` field since the VM no longer delegates.

- [ ] **Step 3: Remove unused imports and types**

Remove `CharcoalSparkParams`, `DEFAULT_CHARCOAL_PARAMS`, `FireColorCurve`, `EffectType`, `TipEffectMap`, `TipEffortMap`, `LedColorPreset`, `findPreset`, `validatePreset`, `EffectLayerMode`, `PropFlameColor`.

- [ ] **Step 4: Clean up AnimationVisibilitySettings interface**

The interface should now only contain display/playback fields.

- [ ] **Step 5: Run typecheck**

Run: `npm run check`
Expected: PASS

- [ ] **Step 6: Run full test suite**

Run: `npx vitest run`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/lib/shared/animation-engine/state/animation-visibility-state.svelte.ts
git commit -m "refactor(effects-v2): remove all effect state from VM — single source of truth achieved"
```

---

## Task 10: Rewrite EffectsPanel.svelte (registry-driven, layout prop)

**Files:**
- Modify: `src/lib/shared/animation-engine/components/effects-panel/EffectsPanel.svelte`

- [ ] **Step 1: Rewrite EffectsPanel to use registry**

Replace the 16 static imports with a single registry import. Replace `getPresetGroup()` switch with `getRegistration()`. Replace the 16-branch customize if/else with dynamic component loading.

New script:

```svelte
<script lang="ts">
  import { onMount } from "svelte";
  import type { Snippet, Component } from "svelte";
  import { getEffectsConfigContext } from "$lib/shared/effects/state/effects-config-context";
  import EffectSelector from "./EffectSelector.svelte";
  import EffectPresetsSection from "./EffectPresetsSection.svelte";
  import { EFFECT_COLORS, EFFECT_LABELS, EFFECTS, getRegistration } from "./effect-registry";
  import type { EffectRegistration } from "./effect-registry";
  import TempoControl from "$lib/shared/sequence-viewer/components/TempoControl.svelte";
  import TransportControls from "$lib/shared/animation-engine/components/controls/TransportControls.svelte";
  import type { PrimaryParamSpec } from "./effect-primary-param";

  interface Props {
    bpm: number;
    onBpmChange: (bpm: number) => void;
    isPlaying: boolean;
    onPlaybackToggle: () => void;
    onStepForward?: () => void;
    onStepBackward?: () => void;
    onHalfStepForward?: () => void;
    onHalfStepBackward?: () => void;
    showPlayback?: boolean;
    showTransport?: boolean;
    showExportControls?: boolean;
    /** "sidebar" = desktop vertical, "strip" = mobile horizontal, "grid" = popover grid */
    layout?: "sidebar" | "strip" | "grid";
    children?: Snippet;
  }

  const {
    bpm, onBpmChange, isPlaying, onPlaybackToggle,
    onStepForward, onStepBackward, onHalfStepForward, onHalfStepBackward,
    showPlayback = true, showTransport = true, showExportControls = false,
    layout = "sidebar",
    children,
  }: Props = $props();

  const effectsConfigState = getEffectsConfigContext()!;

  let customizeOpen = $state(false);
  let CustomizeComponent = $state<Component<{ onBack: () => void }> | null>(null);

  const activeEffect = $derived(effectsConfigState.activeEffect);
  const registration = $derived<EffectRegistration | undefined>(
    activeEffect !== "none" ? getRegistration(activeEffect) : undefined
  );

  const activePresetId = $derived(
    activeEffect !== "none"
      ? effectsConfigState.activePresets[activeEffect as keyof typeof effectsConfigState.activePresets] ?? null
      : null
  );

  const currentSummary = $derived.by(() => {
    if (!registration) return "";
    return registration.presetGroup.getSummary(effectsConfigState);
  });

  const primarySpec = $derived<PrimaryParamSpec | undefined>(registration?.primaryParam);
  const primaryValue = $derived.by(() => {
    if (!primarySpec) return 0;
    return primarySpec.get(effectsConfigState);
  });

  function handleEffectSelect(effectId: string) {
    customizeOpen = false;
    CustomizeComponent = null;
    if (effectId === activeEffect) {
      effectsConfigState.setActiveEffect("none");
      return;
    }
    effectsConfigState.setActiveEffect(effectId);
  }

  function handlePresetSelect(presetId: string) {
    if (!registration) return;
    const preset = registration.presetGroup.presets.find(p => p.id === presetId);
    if (!preset) return;
    preset.apply(effectsConfigState);
  }

  async function handleCustomizeOpen() {
    if (!registration) return;
    const mod = await registration.customizeComponent();
    CustomizeComponent = mod.default;
    customizeOpen = true;
  }

  function handleSliderInput(ev: Event) {
    if (!primarySpec) return;
    const v = parseFloat((ev.currentTarget as HTMLInputElement).value);
    primarySpec.set(effectsConfigState, v);
  }
</script>
```

The template adapts based on `layout`:
- `"sidebar"` renders the current vertical desktop layout
- `"strip"` renders the MobileEffectsPanel's horizontal scroll + primary slider + "More tuning" flow
- `"grid"` renders the popover wrapping grid

- [ ] **Step 2: Write the sidebar layout template**

Adapt current template to use registry + $derived instead of VM sync:

```svelte
{#if layout === "sidebar"}
  <div class="effects-panel">
    {#if showPlayback}
      <div class="sb-section">
        <TempoControl {bpm} {onBpmChange} showPresets={false} showPractice={false} presetsMode="popover" />
        {#if showTransport}
          <TransportControls ... />
        {/if}
      </div>
    {/if}

    <div class="sb-section">
      <span class="sb-label">EFFECTS</span>
      <EffectSelector {activeEffect} onSelect={handleEffectSelect} />
    </div>

    {#if activeEffect !== "none" && !customizeOpen && registration}
      <div class="sb-section">
        <EffectPresetsSection
          presetGroup={registration.presetGroup}
          {activePresetId}
          onSelectPreset={handlePresetSelect}
          onCustomize={handleCustomizeOpen}
          effectLabel={EFFECT_LABELS[activeEffect] ?? ""}
          accentColor={EFFECT_COLORS[activeEffect] ?? "#8b5cf6"}
          summary={currentSummary}
        />
      </div>
    {/if}

    {#if customizeOpen && CustomizeComponent}
      <div class="sb-section">
        <CustomizeComponent onBack={() => { customizeOpen = false; CustomizeComponent = null; }} />
      </div>
    {/if}

    {#if children}{@render children()}{/if}
  </div>
{/if}
```

- [ ] **Step 3: Write the strip layout template (mobile)**

Port the MobileEffectsPanel template, replacing VM refs with EffectsConfigState:

```svelte
{:else if layout === "strip" || layout === "grid"}
  <div class="mep">
    {#if customizeOpen && CustomizeComponent}
      <button type="button" class="back-row" onclick={() => { customizeOpen = false; CustomizeComponent = null; }} aria-label="Back to effect presets">
        <i class="fas fa-arrow-left" aria-hidden="true"></i>
        <span class="back-row-title">
          <span class="back-row-label">{EFFECT_LABELS[activeEffect] ?? activeEffect}</span>
          <span class="back-row-sub">More tuning</span>
        </span>
      </button>
      <CustomizeComponent onBack={() => { customizeOpen = false; CustomizeComponent = null; }} />
    {:else}
      <div class="fx-strip" class:grid={layout === "grid"} role="radiogroup" aria-label="Select effect">
        {#each EFFECTS as e (e.id)}
          {@const isActive = activeEffect === e.id}
          <button type="button" class="fx-tile" class:active={isActive} role="radio" aria-checked={isActive} aria-label={e.label} style:--fx={e.color} onclick={() => handleEffectSelect(e.id)}>
            <i class="fas {e.icon}" aria-hidden="true"></i>
            <span>{e.label}</span>
            {#if isActive}<span class="dot" aria-hidden="true"></span>{/if}
          </button>
        {/each}
      </div>

      {#if activeEffect !== "none" && registration}
        <div class="preset-strip" role="radiogroup" aria-label="{EFFECT_LABELS[activeEffect] ?? activeEffect} presets">
          {#each registration.presetGroup.presets as preset (preset.id)}
            {@const isActive = activePresetId === preset.id}
            <button type="button" class="preset-chip" class:active={isActive} role="radio" aria-checked={isActive} onclick={() => handlePresetSelect(preset.id)}>
              {#if preset.previewColor === "rainbow"}
                <span class="swatch rainbow" aria-hidden="true"></span>
              {:else}
                <span class="swatch" style:background={preset.previewColor} aria-hidden="true"></span>
              {/if}
              {preset.name}
            </button>
          {/each}
        </div>

        {#if primarySpec}
          <div class="slider-row">
            <span class="slider-label">{primarySpec.label}</span>
            <input type="range" class="slider" min={primarySpec.min} max={primarySpec.max} step={primarySpec.step} value={primaryValue} oninput={handleSliderInput} aria-label="{primarySpec.label} for {EFFECT_LABELS[activeEffect] ?? activeEffect}" />
            <span class="slider-val">{primarySpec.format(primaryValue)}</span>
          </div>
          <button type="button" class="more-btn" onclick={handleCustomizeOpen}>
            <span>More tuning…</span>
            <i class="fas fa-chevron-right" aria-hidden="true"></i>
          </button>
        {/if}
      {/if}
    {/if}
  </div>
{/if}
```

- [ ] **Step 4: Merge styles from both panels**

Combine styles from current EffectsPanel.svelte and MobileEffectsPanel.svelte into one `<style>` block. The sidebar styles go under `.effects-panel`, the strip/grid styles go under `.mep`.

- [ ] **Step 5: Run typecheck**

Run: `npm run check`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/shared/animation-engine/components/effects-panel/EffectsPanel.svelte
git commit -m "feat(effects-v2): rewrite EffectsPanel — registry-driven, layout prop, no VM sync"
```

---

## Task 11: Delete MobileEffectsPanel + effect-primary-param.ts + update consumers

**Files:**
- Delete: `src/lib/shared/animation-engine/components/effects-panel/MobileEffectsPanel.svelte`
- Delete: `src/lib/shared/animation-engine/components/effects-panel/effect-primary-param.ts`
- Modify: all files that import `MobileEffectsPanel` → switch to `EffectsPanel` with `layout="strip"` or `layout="grid"`

- [ ] **Step 1: Find all MobileEffectsPanel consumers**

```bash
grep -r "MobileEffectsPanel" src/ --include="*.svelte" --include="*.ts" -l
```

- [ ] **Step 2: Update each consumer**

For each file importing `MobileEffectsPanel`, replace with:
```svelte
<EffectsPanel layout="strip" ... />
```
or
```svelte
<EffectsPanel layout="grid" ... />
```

depending on whether the consumer used `layout="grid"`.

- [ ] **Step 3: Delete MobileEffectsPanel.svelte**

```bash
git rm src/lib/shared/animation-engine/components/effects-panel/MobileEffectsPanel.svelte
```

- [ ] **Step 4: Delete effect-primary-param.ts**

The `PrimaryParamSpec` interface and `PRIMARY_PARAMS` record are now consumed by the registry. Move the interface to `effect-registry.ts` and the data inline into registrations. Or keep `effect-primary-param.ts` as an internal module consumed only by the registry.

Actually — the registry already imports from `effect-primary-param.ts`. It's cleaner to keep it as the definition file and just delete the standalone `getPrimaryParam()`/`setPrimaryParam()` helper functions (which MobileEffectsPanel used). The `PrimaryParamSpec` type and `PRIMARY_PARAMS` data stay.

So: don't delete the file. Just remove the `getPrimaryParam` and `setPrimaryParam` helper functions (no longer needed — the registry provides direct access).

- [ ] **Step 5: Run typecheck**

Run: `npm run check`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor(effects-v2): delete MobileEffectsPanel, all consumers use unified EffectsPanel"
```

---

## Task 12: Migrate remaining consumers (keyboard shortcuts, context menu, etc.)

**Files:**
- Modify: `src/lib/shared/animation-engine/components/canvas-context-menu/CanvasContextMenuBuilder.ts`
- Modify: any file still referencing VM effect methods

- [ ] **Step 1: Comprehensive grep for all remaining VM effect method calls**

```bash
grep -rn "vm\.\(get\|set\)\(Fire\|Led\|Charcoal\|ActiveEffect\|ActivePreset\|TipEffect\|EffectLayer\)" src/ --include="*.ts" --include="*.svelte"
```

- [ ] **Step 2: Migrate each caller**

For each remaining caller, redirect to EffectsConfigState. Common patterns:

- `register-global-shortcuts.ts`: `vm.setActiveEffect("fire")` → `effectsConfigState.setActiveEffect("fire")`
- `CanvasContextMenuBuilder.ts`: `vm.getActiveEffect()` → `effectsConfigState.activeEffect`
- `SettingsCommandHandler.ts`: effect toggle commands
- `PlaybackCommandHandler.ts`: any effect-related commands

Each caller needs access to EffectsConfigState. For service-layer callers that don't have Svelte context, pass it explicitly (same pattern as the engine chain).

- [ ] **Step 3: Run typecheck**

Run: `npm run check`
Expected: PASS

- [ ] **Step 4: Run full test suite**

Run: `npx vitest run`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(effects-v2): migrate keyboard shortcuts, context menu, and remaining consumers"
```

---

## Task 13: QR page integration — drop unified EffectsPanel

**Files:**
- Modify: `src/routes/q/[code]/+page.svelte`

- [ ] **Step 1: Remove hand-rolled effect/prop controls (~350 lines)**

The QR page currently has:
- Hand-rolled prop picker overlay
- Hand-rolled effect selector
- TempoControl wired directly
- Multiple overlays and drawers

Delete the hand-rolled controls and replace with:

```svelte
<EffectsPanel
  layout="strip"
  bpm={bpm}
  onBpmChange={handleBpmChange}
  isPlaying={isPlaying}
  onPlaybackToggle={togglePlayback}
  showTransport={true}
/>
```

- [ ] **Step 2: Ensure EffectsConfigState context is provided**

The QR page uses `+layout@.svelte` (layout reset). It must provide EffectsConfigState in its own component tree:

```svelte
<script>
  import { createEffectsConfigState } from "$lib/shared/effects/state/effects-config-state.svelte";
  import { setEffectsConfigContext } from "$lib/shared/effects/state/effects-config-context";

  const effectsConfigState = createEffectsConfigState();
  setEffectsConfigContext(effectsConfigState);
</script>
```

This may already be done from the prior QR page rewrite. Verify.

- [ ] **Step 3: Wire EffectsConfigState to AnimationPlayer**

The AnimationPlayer (lazy-loaded via AnimatorCanvas) needs the EffectsConfigState. Since it reads from context, and the QR page provides it, this should work automatically.

- [ ] **Step 4: Run typecheck**

Run: `npm run check`
Expected: PASS

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/routes/q/[code]/+page.svelte
git commit -m "feat(effects-v2): QR page uses unified EffectsPanel — hand-rolled controls deleted"
```

---

## Task 14: Final verification + cleanup

**Files:** All modified files

- [ ] **Step 1: Run full typecheck**

Run: `npm run check`
Expected: PASS with zero errors

- [ ] **Step 2: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: Clean build

- [ ] **Step 4: Verify the compat directory is clean**

```bash
ls src/lib/shared/effects/compat/
```

Expected: Directory either empty or deleted. vm-shim.ts and animation-settings-shim.ts are gone.

- [ ] **Step 5: Grep for any remaining VM effect imports**

```bash
grep -rn "getFireColorBlend\|setFireColorBlend\|getFireIntensity\|setFireIntensity\|getCharcoalParams\|setCharcoalParams\|getLedBrightness\|setLedBrightness\|getTipEffectMap\|setTipEffectMap\|setActiveEffect.*vm\|getActiveEffect.*vm\|getEffectLayer.*vm\|vm-shim\|animation-settings-shim" src/ --include="*.ts" --include="*.svelte"
```

Expected: Zero matches in source files (only matches in docs/plans are OK).

- [ ] **Step 6: Open the app and verify effects work**

Open: `http://localhost:5173` (user's dev server)
- Switch between effects — each should toggle correctly
- Apply presets — fire/LED/charcoal presets should change the render
- Use customize sliders — values should persist
- Check QR page (`/q/[code]`) — effects panel should render with strip layout

This step requires user verification per CLAUDE.md rules. Tell the user what to check.

- [ ] **Step 7: Commit any final cleanup**

```bash
git add -A
git commit -m "chore(effects-v2): final cleanup — zero dead imports, clean build"
```

---

## Dependency Graph

```
Task 1 (schema) → Task 2 (state methods) → Task 3 (engine reads) → Task 4 (migration + shim delete)
                                          ↘ Task 5 (VM delegates)
                                                    ↓
Task 6 (registry) ──────────────────────→ Task 7 (preset signatures) → Task 8 (panel reads)
                                                                              ↓
                                                                       Task 9 (VM cleanup)
                                                                              ↓
                                                                       Task 10 (EffectsPanel rewrite)
                                                                              ↓
                                                                       Task 11 (delete MobileEffectsPanel)
                                                                              ↓
                                                                       Task 12 (remaining consumers)
                                                                              ↓
                                                                       Task 13 (QR page)
                                                                              ↓
                                                                       Task 14 (verification)
```

Tasks 1-5 can partially parallel with Task 6 (registry is independent).
Tasks 7-8 depend on both Task 5 (VM delegates) and Task 6 (registry).
Tasks 10-14 are sequential.
