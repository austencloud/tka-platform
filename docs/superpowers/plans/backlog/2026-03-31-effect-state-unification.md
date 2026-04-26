# Effect State Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace legacy boolean effect toggles with `tipEffectMap` as the single source of truth, fixing the trails+fire simultaneous rendering bug and eliminating three-way persistence drift.

**Architecture:** The visibility state manager (`AnimationVisibilityStateManager`) loses its per-effect boolean fields (`fireEffect`, `charcoalEffect`, `ledEffect`, `trailStyle`) and their setter/getter methods. All effect state flows through the existing `tipEffectMap` field. A new `setActiveEffect(effect)` method replaces all legacy setters. The render loop stops checking `trailSettings.enabled` and `fireConfig.enabled`, routing everything through `resolveEffect()` on the tipEffectMap.

**Tech Stack:** Svelte 5 + TypeScript + ITI DI. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-03-31-effect-state-unification-design.md`

---

## Task 1: Add new tipEffectMap API to AnimationVisibilityStateManager

**Files:**
- Modify: `src/lib/shared/animation-engine/state/animation-visibility-state.svelte.ts`

This task ADDS the new methods without removing old ones yet. This lets us migrate consumers incrementally while keeping the app functional at every commit.

- [ ] **Step 1: Add `setActiveEffect()` method**

After the existing `setTipEffectMap()` method (or near the tipEffectMap section), add:

```typescript
import type { EffectType, TipEffectMap } from "../domain/types/TipEffectTypes";

setActiveEffect(effect: EffectType): void {
  if (effect === "none") {
    this.settings.tipEffectMap = {};
  } else {
    this.settings.tipEffectMap = { "*": { effect } };
  }
  this.syncDarkModeFromMap();
  this.saveToStorage();
  this.notifyObservers();
}
```

- [ ] **Step 2: Add `getActiveEffect()` method**

```typescript
getActiveEffect(): EffectType {
  const cellWide = this.settings.tipEffectMap["*"];
  return cellWide?.effect ?? "none";
}
```

- [ ] **Step 3: Add `hasEffect()` and `isTrailsActive()` methods**

```typescript
hasEffect(effect: EffectType): boolean {
  return Object.values(this.settings.tipEffectMap)
    .some(a => a.effect === effect);
}

isTrailsActive(): boolean {
  return this.hasEffect("trails");
}

isAnyDarkModeEffectActive(): boolean {
  const darkEffects: EffectType[] = ["fire", "charcoal", "led"];
  return Object.values(this.settings.tipEffectMap)
    .some(a => darkEffects.includes(a.effect as EffectType));
}
```

- [ ] **Step 4: Add `syncDarkModeFromMap()` private method**

```typescript
private syncDarkModeFromMap(): void {
  const needsDarkMode = this.isAnyDarkModeEffectActive();
  if (needsDarkMode) {
    if (this.darkModeBeforeEffect === null) {
      this.darkModeBeforeEffect = this.settings.darkMode;
    }
    if (!this.settings.darkMode) {
      this.settings.darkMode = true;
      this.syncDarkModeClass();
      this.updateMotionColorsCache();
    }
  } else {
    if (this.darkModeBeforeEffect !== null) {
      const restore = this.darkModeBeforeEffect;
      this.darkModeBeforeEffect = null;
      if (this.settings.darkMode !== restore) {
        this.settings.darkMode = restore;
        this.syncDarkModeClass();
        this.updateMotionColorsCache();
      }
    }
  }
}
```

- [ ] **Step 5: Update localStorage migration to handle trails and clean up legacy fields**

In `loadFromStorage()`, replace the existing tipEffectMap migration block (around line 292-298) with:

```typescript
// Migrate legacy booleans → tipEffectMap (one-time, on load)
if (!parsed.tipEffectMap || Object.keys(parsed.tipEffectMap).length === 0) {
  if (parsed.fireEffect) parsed.tipEffectMap = { "*": { effect: "fire" } };
  else if (parsed.charcoalEffect) parsed.tipEffectMap = { "*": { effect: "charcoal" } };
  else if (parsed.ledEffect) parsed.tipEffectMap = { "*": { effect: "led" } };
  else if (parsed.trailStyle === "on") parsed.tipEffectMap = { "*": { effect: "trails" } };
  else parsed.tipEffectMap = {};
}

// Clean up legacy fields (they'll be omitted on next save)
delete parsed.fireEffect;
delete parsed.charcoalEffect;
delete parsed.ledEffect;
delete parsed.trailStyle;
```

- [ ] **Step 6: Run typecheck**

Run: `npm run check`
Expected: PASS (new methods are additive, nothing removed yet)

- [ ] **Step 7: Commit**

```
feat(effects): add tipEffectMap-based API to visibility manager

Adds setActiveEffect(), getActiveEffect(), hasEffect(), isTrailsActive(),
and syncDarkModeFromMap(). Legacy methods are still present — consumers
migrate incrementally in subsequent commits.
```

---

## Task 2: Remove `enabled` from TrailSettings

**Files:**
- Modify: `src/lib/shared/animation-engine/domain/types/TrailTypes.ts`
- Modify: `src/lib/features/compose/utils/animation-panel-persistence.ts`
- Modify: `src/lib/shared/animation-engine/state/animation-settings-state.svelte.ts`
- Modify: `src/lib/shared/animation-engine/services/implementations/TrailSettingsSynchronizer.svelte.ts` (fix any `enabled` references)
- Modify: `src/lib/features/disassemble-lab/components/DisassemblePlaybackHost.svelte` (remove `setTrailEnabled` call)

- [ ] **Step 1: Remove `enabled` from `TrailSettings` interface in `TrailTypes.ts`**

Remove `enabled: boolean;` from the `TrailSettings` interface (line 68).
Remove `enabled: true,` from `DEFAULT_TRAIL_SETTINGS` (line 97).

- [ ] **Step 2: Update `loadTrailSettings()` in `animation-panel-persistence.ts`**

Remove `result.enabled = true;` (line 53). Remove any other references to `enabled` in this function.

- [ ] **Step 3: Update `animation-settings-state.svelte.ts`**

Remove `settings.trail.enabled = true;` force (line 104).
Remove `setTrailEnabled` from the interface and implementation (lines 134, 207-210).
Remove `void settings.trail.enabled;` from the reactivity tracking (line 165).

- [ ] **Step 4: Fix any TypeScript errors from removal**

Run: `npm run check`

Any file that references `trailSettings.enabled` or `trail.enabled` will error. The main ones are in `AnimationRenderLoop.ts` (4 locations) and `TrailSettingsSynchronizer.svelte.ts`. Fix them:

In `AnimationRenderLoop.ts`, these will be replaced with proper `hasTrailTips()` calls in Task 3. For now, apply these temporary changes to keep the build green (Task 3 will overwrite them):
- Line 257: `trailSettings.enabled &&` → remove the check (just `trailSettings.mode !== TrailMode.OFF`)
- Line 280: same pattern
- Line 382: `visibility.trailsVisible && trailSettings.enabled` → `visibility.trailsVisible`
- Line 701: diagnostic logging — remove the `.enabled` reference

In `DisassemblePlaybackHost.svelte` line 226: remove `animationSettings.setTrailEnabled(true);`

- [ ] **Step 5: Run typecheck again**

Run: `npm run check`
Expected: PASS

- [ ] **Step 6: Commit**

```
refactor(trails): remove `enabled` from TrailSettings interface

TrailSettings is now purely about appearance (fade duration, line width,
glow, colors). Whether trails are active is determined by tipEffectMap.
```

---

## Task 3: Update AnimationRenderLoop to use tipEffectMap for trails

**Files:**
- Modify: `src/lib/shared/animation-engine/services/implementations/AnimationRenderLoop.ts`

- [ ] **Step 1: Add `hasTrailTips` helper at top of file**

```typescript
import type { TipEffectMap } from "../../domain/types/TipEffectTypes";

function hasTrailTips(map: TipEffectMap | undefined): boolean {
  if (!map) return false;
  return Object.values(map).some(a => a.effect === "trails");
}
```

- [ ] **Step 2: Replace trail capture gate (around line 256)**

Change:
```typescript
if (
  trailSettings.mode !== TrailMode.OFF &&
  this.TrailCapturer
) {
```
To:
```typescript
const trailsActive = hasTrailTips(params.tipEffectMap);
if (
  trailsActive &&
  trailSettings.mode !== TrailMode.OFF &&
  this.TrailCapturer
) {
```

- [ ] **Step 3: Replace continuous render decision (around line 279)**

Change:
```typescript
const trailsNeedContinuousRender =
  trailSettings.mode !== TrailMode.OFF;
```
To:
```typescript
const trailsNeedContinuousRender =
  hasTrailTips(params.tipEffectMap) && trailSettings.mode !== TrailMode.OFF;
```

- [ ] **Step 4: Replace effectiveTrailsVisible (around line 381)**

Change:
```typescript
const effectiveTrailsVisible = visibility.trailsVisible;
```
To:
```typescript
const effectiveTrailsVisible = hasTrailTips(params.tipEffectMap);
```

- [ ] **Step 5: Remove empty-map fallback for fire/charcoal (around line 528)**

Replace the entire if/else block:
```typescript
const hasPerTipAssignments = Object.keys(tipMap).length > 0;

let fireTips: typeof allTips;
let charcoalTips: typeof allTips;

if (hasPerTipAssignments) {
  fireTips = allTips.filter(t => resolveEffect(t.propIndex, t.tipIndex, tipMap, {}) === 'fire');
  charcoalTips = allTips.filter(t => resolveEffect(t.propIndex, t.tipIndex, tipMap, {}) === 'charcoal');
} else {
  fireTips = (activeFireRenderer && params.fireConfig?.enabled) ? allTips : [];
  charcoalTips = activeCharcoalRenderer ? allTips : [];
}
```

With:
```typescript
const fireTips = allTips.filter(t => resolveEffect(t.propIndex, t.tipIndex, tipMap, {}) === 'fire');
const charcoalTips = allTips.filter(t => resolveEffect(t.propIndex, t.tipIndex, tipMap, {}) === 'charcoal');
```

- [ ] **Step 6: Remove `enabled` from `FireOverlayConfig` type**

In `src/lib/shared/animation-engine/domain/types/FireTypes.ts`, remove `enabled: boolean;` (line 148) from the `FireOverlayConfig` interface. Also remove the `enabled` field from `DEFAULT_FIRE_CONFIG` if it exists. Fix any TypeScript errors this causes — the render loop and engine should no longer check `fireConfig.enabled` after Steps 5 and the engine changes in Task 4.

- [ ] **Step 7: Update LED tip filtering (around line 621)**

Remove the `params.ledConfig?.enabled` gate from the LED rendering section. LED tips should be filtered by tipEffectMap only:

```typescript
const ledTips = allLedTips.filter(t => resolveEffect(t.propIndex, t.tipIndex, ledTipMap, {}) === 'led');
```

(This may already be correct — verify the surrounding `if` block doesn't gate on `ledConfig.enabled`.)

- [ ] **Step 8: Fix diagnostic logging (around line 701)**

Update the trail count diagnostic to use `hasTrailTips(params.tipEffectMap)` instead of `params.trailSettings.enabled`.

- [ ] **Step 9: Run typecheck**

Run: `npm run check`
Expected: PASS

- [ ] **Step 10: Commit**

```
feat(effects): route trail rendering through tipEffectMap

The render loop now uses hasTrailTips(tipEffectMap) instead of
trailSettings.enabled for trail capture, visibility, and continuous
render decisions. Removes empty-map fallback for fire/charcoal.
```

---

## Task 4: Update AnimationEngine to sync from tipEffectMap

**Files:**
- Modify: `src/lib/shared/animation-engine/services/implementations/AnimationEngine.svelte.ts`

- [ ] **Step 1: Replace trail overlay show/hide in visibility observer**

Find the block that compares `state.trails !== this.prevTrailsVisible` (around line 476). Replace with:

```typescript
const vm = this.getVM();
const trailsInMap = vm.isTrailsActive();
if (trailsInMap !== this.prevTrailsActive) {
  const trailsTurnedOff = this.prevTrailsActive && !trailsInMap;
  this.prevTrailsActive = trailsInMap;

  if (trailsTurnedOff && this.trailOverlay) {
    this.trailOverlay.clear();
    this.trailOverlay.setVisible(false);
  } else if (trailsInMap && this.trailOverlay) {
    this.trailOverlay.setVisible(true);
  }

  if (this.state.isInitialized) {
    this.renderLoopService?.triggerRender(() =>
      this.getFrameParams(this.lastPropsRef ?? DEFAULT_ENGINE_PROPS)
    );
  }
}
```

Rename `prevTrailsVisible` to `prevTrailsActive` (field declaration around line 309).

- [ ] **Step 2: Replace fire/charcoal sync in visibility observer**

Find the fire effect sync block (around line 537). Replace:

```typescript
const fireEnabled = vm.isFireEffectEnabled();
if (fireEnabled !== this.prevFireEffect) {
  this.prevFireEffect = fireEnabled;
  this.setFireConfig({ enabled: fireEnabled });
}

const charcoalEnabled = vm.isCharcoalEffectEnabled();
if (charcoalEnabled !== this.prevCharcoalEffect) {
  this.prevCharcoalEffect = charcoalEnabled;
  this.syncCharcoalOverlay();
}
```

With:
```typescript
const hasFireTips = vm.hasEffect("fire");
if (hasFireTips !== this.prevHasFireTips) {
  this.prevHasFireTips = hasFireTips;
  this.setFireConfig({ enabled: hasFireTips });
}

const hasCharcoalTips = vm.hasEffect("charcoal");
if (hasCharcoalTips !== this.prevHasCharcoalTips) {
  this.prevHasCharcoalTips = hasCharcoalTips;
  this.syncCharcoalOverlay();
}
```

Update field declarations: rename `prevFireEffect` → `prevHasFireTips`, `prevCharcoalEffect` → `prevHasCharcoalTips`.

- [ ] **Step 3: Update fireConfig gate in getFrameParams()**

Find (around line 2132):
```typescript
fp.fireConfig = (this.fireConfig.enabled || this.prevCharcoalEffect) ? this.fireConfig : null;
```

Replace with:
```typescript
const vm = this.getVM();
const hasFireOrCharcoal = vm.hasEffect("fire") || vm.hasEffect("charcoal");
fp.fireConfig = hasFireOrCharcoal ? this.fireConfig : null;
```

- [ ] **Step 4: Update initialization code**

Find where `this.prevFireEffect` and `this.prevCharcoalEffect` are initialized from the VM (around line 401-404). Update to use new method names:

```typescript
this.prevTrailsActive = vm.isTrailsActive();
this.prevHasFireTips = vm.hasEffect("fire");
this.prevHasCharcoalTips = vm.hasEffect("charcoal");
```

- [ ] **Step 5: Update fire/charcoal renderer lazy init checks**

Find `if (this.fireConfig.enabled && !this.fireRenderer?.isInitialized())` (around line 747) and `if (this.prevCharcoalEffect && !this.charcoalRenderer?.isInitialized())` (around line 750). Update to:

```typescript
if (this.prevHasFireTips && !this.fireRenderer?.isInitialized()) {
```
```typescript
if (this.prevHasCharcoalTips && !this.charcoalRenderer?.isInitialized()) {
```

- [ ] **Step 6: Update visibility state reads**

Find `fp.visibility.trailsVisible = this.state.visibilityState.trails;` (line 2099). The synchronizer will be updated in Task 5 to set `trails` from `isTrailsActive()`, so this line stays the same but now reads the correct value.

Also update `this.prevTrailsVisible` → `this.prevTrailsActive` in all remaining references.

- [ ] **Step 7: Run typecheck**

Run: `npm run check`
Expected: PASS (may have errors from renamed fields — fix any remaining references)

- [ ] **Step 8: Commit**

```
refactor(engine): sync effect state from tipEffectMap instead of booleans

AnimationEngine now checks vm.hasEffect("fire"), vm.isTrailsActive()
etc. instead of the legacy boolean getters. Trail overlay show/hide,
fire renderer init, and frame params all read from the map.
```

---

## Task 5: Update AnimationVisibilitySynchronizer

**Files:**
- Modify: `src/lib/shared/animation-engine/services/implementations/AnimationVisibilitySynchronizer.ts`
- Modify: `src/lib/shared/animation-engine/services/contracts/IAnimationVisibilitySynchronizer.ts`

- [ ] **Step 1: Update `AnimationVisibilityState` interface**

Add to the interface:
```typescript
activeEffect: EffectType;
tipEffectMap: TipEffectMap;
```

Import the types from `TipEffectTypes.ts`.

- [ ] **Step 2: Update `getState()`**

```typescript
getState(): AnimationVisibilityState {
  return {
    grid: this.manager.isGridVisible(),
    stepNumbers: this.manager.getVisibility("stepNumbers"),
    props: this.manager.getVisibility("props"),
    trails: this.manager.isTrailsActive(),  // Was: isTrailsVisible()
    tkaGlyph: this.manager.getVisibility("tkaGlyph"),
    blueMotion: this.manager.getVisibility("blueMotion"),
    redMotion: this.manager.getVisibility("redMotion"),
    darkMode: this.manager.isDarkMode(),
    wordHeader: this.manager.getVisibility("wordHeader"),
    activeEffect: this.manager.getActiveEffect(),
    tipEffectMap: this.manager.getTipEffectMap(),
  };
}
```

- [ ] **Step 3: Run typecheck**

Run: `npm run check`
Expected: PASS (or errors from consumers that destructure the state — fix as needed)

- [ ] **Step 4: Commit**

```
refactor(sync): update visibility synchronizer to expose tipEffectMap

getState() now returns activeEffect and tipEffectMap. The trails field
reads from isTrailsActive() instead of isTrailsVisible().
```

---

## Task 6: Migrate EffectsPanel and EffectSelector

**Files:**
- Modify: `src/lib/shared/animation-engine/components/effects-panel/EffectsPanel.svelte`

- [ ] **Step 1: Replace `syncFromVM()`**

```typescript
function syncFromVM(): void {
  activeEffect = vm.getActiveEffect();
  if (activeEffect === "led") {
    activePresetId = vm.getActivePresetId();
  }
  summaryTick++;
}
```

- [ ] **Step 2: Replace `handleEffectSelect()`**

```typescript
function handleEffectSelect(effectId: string): void {
  customizeOpen = false;
  vm.setActiveEffect(effectId as EffectType);
  activeEffect = effectId;
  activePresetId = null;
}
```

Add import for `EffectType` from `TipEffectTypes.ts`.

- [ ] **Step 3: Run typecheck**

Run: `npm run check`
Expected: PASS

- [ ] **Step 4: Commit**

```
refactor(effects-panel): use setActiveEffect() instead of legacy toggles
```

---

## Task 7: Migrate CanvasContextMenuBuilder

**Files:**
- Modify: `src/lib/shared/animation-engine/components/canvas-context-menu/CanvasContextMenuBuilder.ts`

- [ ] **Step 1: Replace `getActiveEffect()`**

Replace the function that reads individual booleans with:
```typescript
function getActiveEffect(vm: AnimationVisibilityStateManager): ActiveEffect {
  return vm.getActiveEffect() as ActiveEffect;
}
```

(Or inline it — `vm.getActiveEffect()` returns the same string union.)

- [ ] **Step 2: Replace all effect-setting actions**

Each menu item action that calls `vm.setFireEffect(true)` etc. becomes `vm.setActiveEffect("fire")`.
Items that disable effects become `vm.setActiveEffect("none")`.

- [ ] **Step 3: Run typecheck**

Run: `npm run check`
Expected: PASS

- [ ] **Step 4: Commit**

```
refactor(context-menu): use setActiveEffect() for effect switching
```

---

## Task 8: Migrate settings UI consumers

**Files:**
- Modify: `src/lib/shared/settings/components/tabs/VisibilityTab.svelte`
- Modify: `src/lib/features/compose/components/controls/settings-panel/VisualPane.svelte`
- Modify: `src/lib/features/compose/components/trail/SimpleTrailControls.svelte`
- Modify: `src/lib/shared/settings/components/tabs/visibility/AnimationPanel.svelte`
- Modify: `src/lib/shared/animation-engine/components/animation-settings-modal/AnimationSettingsModal.svelte`

- [ ] **Step 1: Update VisibilityTab.svelte**

Replace `animTrailStyle` derived state:
```typescript
const trailsActive = $derived.by(() => {
  void version;
  return avm.isTrailsActive();
});
```

Replace `avm.setTrailStyle(style)` calls with `avm.setActiveEffect(style === "on" ? "trails" : "none")`.

- [ ] **Step 2: Update VisualPane.svelte**

Remove the `getTrailStyleFromSettings()` hack and the onMount sync logic. Replace with:
```typescript
let currentTrailStyle = $state<TrailVisibility>(
  visibilityManager.isTrailsActive() ? "on" : "off"
);
```

Replace `visibilityManager.setTrailStyle(style)` with `visibilityManager.setActiveEffect(style === "on" ? "trails" : "none")`.

Update observer to read from `isTrailsActive()`.

- [ ] **Step 3: Update SimpleTrailControls.svelte**

Replace `animationVisibilityManager.getTrailStyle()` with `animationVisibilityManager.isTrailsActive() ? "on" : "off"`.

Replace `animationVisibilityManager.setTrailStyle(preset)` with `animationVisibilityManager.setActiveEffect(preset === "off" ? "none" : "trails")`.

- [ ] **Step 4: Update AnimationPanel.svelte**

Replace `trailStyle !== "off"` with reading from the parent's derived state.
Replace `onTrailStyleChange(next)` with `vm.setActiveEffect(next === "on" ? "trails" : "none")`.

- [ ] **Step 5: Update AnimationSettingsModal.svelte**

Replace any `isFireEffectEnabled()` / `isTrailsVisible()` reads with `getActiveEffect()` / `hasEffect()`.

- [ ] **Step 6: Run typecheck**

Run: `npm run check`
Expected: PASS

- [ ] **Step 7: Commit**

```
refactor(settings-ui): migrate all settings panels to tipEffectMap API
```

---

## Task 9: Migrate complex consumers (DisassemblePlaybackHost, VideoExportOrchestrator, EffectsLab)

**Files:**
- Modify: `src/lib/features/disassemble-lab/components/DisassemblePlaybackHost.svelte`
- Modify: `src/lib/features/compose/services/implementations/VideoExportOrchestrator.ts`
- Modify: `src/lib/features/effects-lab/components/EffectsLabPlaybackHost.svelte`
- Modify: `src/lib/features/effects-lab/EffectsLabModule.svelte`

- [ ] **Step 1: Migrate DisassemblePlaybackHost.svelte**

Replace the $effect block (lines 220-252) with:
```typescript
$effect(() => {
  const mode = activeEffectMode;
  untrack(() => {
    vm.setActiveEffect(mode === "clean" ? "none" : mode as EffectType);
    if (mode === "fire") {
      visibilityManager.setFireIntensity(intensity);
      visibilityManager.setFireColorBlend(colorBlend);
    }
  });
});
```

Remove `animationSettings.setTrailEnabled(true)` call (line 226).

Replace save/restore logic:
```typescript
const savedEffectMap = { ...visibilityManager.getTipEffectMap() };
// ... on cleanup:
visibilityManager.setTipEffectMap(savedEffectMap);
```

Remove individual boolean saves (`savedFireEnabled`, `savedCharcoalEnabled`, `savedLedEnabled`, `savedTrailStyle`).

- [ ] **Step 2: Migrate VideoExportOrchestrator.ts**

Update `applyEffectOverrides()` (around line 910-936):
```typescript
private applyEffectOverrides(
  visibilityManager: ReturnType<typeof getAnimationVisibilityManager>,
  overrides?: VideoEffectOverrides
): TipEffectMap | null {
  if (!overrides?.activeEffect) return null;
  const saved = { ...visibilityManager.getTipEffectMap() };
  visibilityManager.setActiveEffect(overrides.activeEffect);
  return saved;
}
```

Update `restoreEffectState()` (around line 941-951):
```typescript
private restoreEffectState(
  visibilityManager: ReturnType<typeof getAnimationVisibilityManager>,
  saved: TipEffectMap | null
): void {
  if (!saved) return;
  visibilityManager.setTipEffectMap(saved);
}
```

Update `VideoEffectOverrides` interface to use `activeEffect?: EffectType` instead of 4 booleans. Update any UI that produces this interface.

- [ ] **Step 3: Migrate EffectsLabPlaybackHost.svelte**

Replace `visibilityManager.isTrailsVisible() && visibilityManager.getTrailStyle() === "on"` with `visibilityManager.isTrailsActive()`.

Replace all `setFireEffect()`/`setTrailStyle()`/etc. calls with `setActiveEffect()`.

Replace save/restore with `getTipEffectMap()` / `setTipEffectMap()`.

- [ ] **Step 4: Migrate EffectsLabModule.svelte**

Replace all legacy setter calls with `setActiveEffect()`.

- [ ] **Step 5: Run typecheck**

Run: `npm run check`
Expected: PASS

- [ ] **Step 6: Commit**

```
refactor(complex-consumers): migrate DisassemblePlaybackHost,
VideoExportOrchestrator, and EffectsLab to tipEffectMap API
```

---

## Task 10: Migrate landing page components

**Files:**
- Modify: `src/routes/landing/components/PlayWithItInner.svelte`
- Modify: `src/routes/landing/components/LandingAnimationDemo.svelte`
- Modify: `src/routes/landing/components/HowTkaAnimationCard.svelte`

- [ ] **Step 1: Migrate PlayWithItInner.svelte**

Replace the switch statement (lines 298-329):
```typescript
switch (effect) {
  case "clean":
    visibilityManager.setActiveEffect("none");
    break;
  case "trails":
    visibilityManager.setActiveEffect("trails");
    break;
  case "fire":
    visibilityManager.setActiveEffect("fire");
    break;
  case "charcoal":
    visibilityManager.setActiveEffect("charcoal");
    break;
  case "leds":
    visibilityManager.setActiveEffect("led");
    break;
}
```

Also update any other `setFireEffect()`/`setTrailStyle()` calls in the file.

- [ ] **Step 2: Migrate LandingAnimationDemo.svelte**

Replace `visibilityManager.setTrailStyle(trailsEnabled ? "on" : "off")` with `visibilityManager.setActiveEffect(trailsEnabled ? "trails" : "none")`.

- [ ] **Step 3: Migrate HowTkaAnimationCard.svelte**

Replace `visibilityManager.setTrailStyle("off")` with `visibilityManager.setActiveEffect("none")`.

- [ ] **Step 4: Run typecheck**

Run: `npm run check`
Expected: PASS

- [ ] **Step 5: Commit**

```
fix(landing): migrate demo components to setActiveEffect(), fixing
trails+fire simultaneous rendering bug in PlayWithItInner
```

---

## Task 11: Migrate keyboard shortcuts and voice control

**Files:**
- Modify: `src/lib/shared/keyboard/utils/register-global-shortcuts.ts`
- Modify: `src/lib/shared/voice-control/services/implementations/interpreters/SettingsSubInterpreter.ts`
- Modify: `src/lib/shared/voice-control/services/implementations/handlers/SettingsCommandHandler.ts`

- [ ] **Step 1: Update keyboard shortcuts**

In `register-global-shortcuts.ts`, replace the fire toggle (around line 327-332):
```typescript
action: () => {
  const visibilityManager = getAnimationVisibilityManager();
  const isFireActive = visibilityManager.getActiveEffect() === "fire";
  visibilityManager.setActiveEffect(isFireActive ? "none" : "fire");
  toast.info(isFireActive ? "Fire OFF" : "Fire ON", 1500);
},
```

Replace the LED toggle (around line 346-350):
```typescript
action: () => {
  const visibilityManager = getAnimationVisibilityManager();
  const isLedActive = visibilityManager.getActiveEffect() === "led";
  visibilityManager.setActiveEffect(isLedActive ? "none" : "led");
  toast.info(isLedActive ? "LED OFF" : "LED ON", 1500);
},
```

- [ ] **Step 2: Update voice command aliases**

In `SettingsSubInterpreter.ts`, replace:
```typescript
trails: "trailStyle",
"trail style": "trailStyle",
```

With:
```typescript
trails: "effect:trails",
"trail style": "effect:trails",
fire: "effect:fire",
"fire effect": "effect:fire",
leds: "effect:led",
"led effect": "effect:led",
charcoal: "effect:charcoal",
```

- [ ] **Step 3: Update SettingsCommandHandler.ts**

Add a handler for `effect:*` targets. When the target starts with `"effect:"`, extract the effect name and call `vm.setActiveEffect()` for "show"/"enable" actions, or `vm.setActiveEffect("none")` for "hide"/"disable" actions. For "toggle", check `vm.getActiveEffect()` and flip.

- [ ] **Step 4: Run typecheck**

Run: `npm run check`
Expected: PASS

- [ ] **Step 5: Commit**

```
refactor(input): migrate keyboard shortcuts and voice commands to
tipEffectMap API
```

---

## Task 12: Migrate remaining consumers and update AnimatorCanvas

**Files:**
- Modify: `src/lib/shared/animation-engine/components/AnimatorCanvas.svelte`
- Modify: `src/lib/features/compose/tabs/arrange/components/grid/cell-editor/ChipGrid.svelte`

- [ ] **Step 1: Update AnimatorCanvas.svelte**

Replace any `isFireEffectEnabled()` or `isTrailsVisible()` reads with `hasEffect("fire")` / `isTrailsActive()`.

- [ ] **Step 2: Update ChipGrid.svelte**

Replace effect state reads with `getActiveEffect()` / `hasEffect()`.

- [ ] **Step 3: Run typecheck**

Run: `npm run check`
Expected: PASS — all consumers are now migrated

- [ ] **Step 4: Commit**

```
refactor(canvas): migrate AnimatorCanvas and ChipGrid to tipEffectMap API
```

---

## Task 13: Remove legacy methods and fields

**Files:**
- Modify: `src/lib/shared/animation-engine/state/animation-visibility-state.svelte.ts`

Now that all consumers use the new API, remove the legacy code.

- [ ] **Step 1: Remove legacy boolean fields from AnimationVisibilitySettings**

Remove from the interface (and `getDefaultSettings()`):
- `fireEffect: boolean`
- `charcoalEffect: boolean`
- `ledEffect: boolean`
- `trailStyle: TrailVisibility`

- [ ] **Step 2: Remove legacy getter/setter methods**

Remove:
- `setFireEffect()`, `isFireEffectEnabled()`, `toggleFireEffect()`
- `setCharcoalEffect()`, `isCharcoalEffectEnabled()`, `toggleCharcoalEffect()`
- `setLedEffect()`, `isLedEffectEnabled()`, `toggleLedEffect()`
- `setTrailStyle()`, `getTrailStyle()`, `isTrailsVisible()`
- `syncEffectDarkMode()` (replaced by `syncDarkModeFromMap()`)

- [ ] **Step 3: Remove TrailVisibility type if no longer used**

If `TrailVisibility` type is only used by the removed methods, remove it. Check imports first.

- [ ] **Step 4: Update the Exclude list in setVisibility/getVisibility**

Remove `"trailStyle"` from the Exclude union in `setVisibility()` and `getVisibility()` since the field no longer exists. Also remove `fireEffect`, `charcoalEffect`, `ledEffect` if they were in those exclusion lists.

- [ ] **Step 5: Run typecheck**

Run: `npm run check`
Expected: PASS — if any file still references removed methods, it needs migration (go back to the relevant task)

- [ ] **Step 6: Run tests**

Run: `npm test`
Expected: PASS — verify no unit tests reference the removed methods

- [ ] **Step 7: Commit**

```
refactor(effects): remove legacy boolean toggles and mutual exclusion code

fireEffect, charcoalEffect, ledEffect, trailStyle, and all their
getters/setters/toggles are removed. tipEffectMap is now the sole
authority for which effect is active. No more mutual exclusion code —
the map inherently allows only one effect per tip.
```

---

## Task 14: Build verification

**Files:** None — this is a verification-only task.

- [ ] **Step 1: Full typecheck**

Run: `npm run check`
Expected: PASS with zero errors

- [ ] **Step 2: Full test suite**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: Clean build

- [ ] **Step 4: Verify no remaining references to removed API**

Search for any orphaned references:
```
grep -r "isFireEffectEnabled\|setFireEffect\|isTrailsVisible\|setTrailStyle\|isCharcoalEffectEnabled\|setCharcoalEffect\|isLedEffectEnabled\|setLedEffect\|toggleFireEffect\|toggleCharcoalEffect\|toggleLedEffect\|trailSettings\.enabled" src/
```

Expected: Zero matches in `.ts` and `.svelte` files (docs/specs may reference them — that's fine).

- [ ] **Step 5: Manual smoke test checklist**

Ask user to verify in the running app:
1. Open sequence viewer → select Fire in effects panel → fire renders, dark mode on
2. Switch to Trails → fire stops, trails render, dark mode restores
3. Switch to None → everything off
4. Select LED → LED renders, dark mode on
5. Refresh page → same effect persists from localStorage
6. Open landing page → fire demo does NOT show trails simultaneously

- [ ] **Step 6: Commit (if any fixups needed)**

```
fix(effects): address verification findings
```
