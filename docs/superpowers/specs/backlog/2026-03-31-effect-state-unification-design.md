---
status: backlog
value: 5
effort: S
score: 20
remaining: "Trail path into tipEffectMap, localStorage key cleanup"
last_triaged: 2026-04-26
---
# Effect State Unification: tipEffectMap as Single Source of Truth

**Date:** 2026-03-31
**Status:** Draft
**Builds on:** [Per-Tip Effect System (2026-03-29)](2026-03-29-per-tip-effect-system-design.md)
**Module:** Animation Engine (global), Compose (per-cell), all effect consumers

## Problem

The 2026-03-29 spec introduced `tipEffectMap` for per-tip granular effect assignment but kept legacy boolean toggles (`fireEffect`, `charcoalEffect`, `ledEffect`, `trailStyle`) "for backward compatibility." This created a half-migrated architecture with three independent persistence systems controlling the same decision:

| # | Store | localStorage Key | Controls |
|---|-------|-----------------|----------|
| 1 | Visibility Manager | `animation-visibility-settings` | `trailStyle`, `fireEffect`, `charcoalEffect`, `ledEffect`, `tipEffectMap` |
| 2 | Trail Settings (legacy) | `tka_trail_settings` | `enabled`, `mode`, appearance params |
| 3 | Animation Settings | `tka_animation_settings` | `trail.enabled`, `trail.mode`, appearance params |

The render loop checks different systems for different effects:
- Fire/charcoal/LED: routed through `tipEffectMap` when it has entries, falls back to legacy booleans when empty
- Trails: routed through `visibility.trailsVisible && trailSettings.enabled` — completely separate path

The mutual exclusion between effects lives in hand-coded setter logic (`setFireEffect` disables trails, `setTrailStyle` disables fire, etc.). If any code path bypasses the setters (like `loadFromStorage()` applying raw parsed JSON), both can be active simultaneously. This is the root cause of the trails+fire rendering simultaneously bug.

### Specific Symptoms

- Trails and fire render simultaneously when loaded from stale localStorage
- `loadTrailSettings()` forces `enabled: true` on every load, making the engine always think trails are active regardless of what the visibility manager says
- `TrailSettings.enabled` is a dead toggle — it's forced true on load and never meaningfully set to false
- The render loop has a "no per-tip assignments" fallback (lines 531-536 of AnimationRenderLoop.ts) that bypasses `tipEffectMap` entirely

## Design: Complete Migration to tipEffectMap

Remove all legacy boolean toggles. `tipEffectMap` becomes the sole authority for which effect is active on which tip. No dual paths, no fallbacks, no mutual exclusion code.

### What Gets Removed

#### From `AnimationVisibilitySettings` interface:
- `fireEffect: boolean`
- `charcoalEffect: boolean`
- `ledEffect: boolean`
- `trailStyle: TrailVisibility`

These are replaced by reading `tipEffectMap`. A cell-wide fire effect is `{ "*": { effect: "fire" } }`. No effect is `{}`.

#### From `AnimationVisibilityStateManager`:
- `setFireEffect()` / `isFireEffectEnabled()` / `toggleFireEffect()`
- `setCharcoalEffect()` / `isCharcoalEffectEnabled()` / `toggleCharcoalEffect()`
- `setLedEffect()` / `isLedEffectEnabled()` / `toggleLedEffect()`
- `setTrailStyle()` / `getTrailStyle()` / `isTrailsVisible()`
- All mutual exclusion logic in those setters
- `syncEffectDarkMode()` — replaced with map-based dark mode sync

#### From `TrailSettings` interface:
- `enabled: boolean` — trails on/off is now determined by tipEffectMap, not this field

#### From `TrailTypes.ts`:
- Remove `enabled` from `TrailSettings` interface
- Remove `enabled: true` from `DEFAULT_TRAIL_SETTINGS`

#### From persistence:
- `loadTrailSettings()` stops forcing `enabled: true`
- `animation-settings-state.svelte.ts` stops forcing `settings.trail.enabled = true`

### What Gets Added

#### New methods on `AnimationVisibilityStateManager`:

```typescript
// Set the global effect (replaces all legacy setters)
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

// Read the global effect from the map
getActiveEffect(): EffectType {
  const cellWide = this.settings.tipEffectMap["*"];
  return cellWide?.effect ?? "none";
}

// Check if any effect requiring dark mode is active anywhere in the map
isAnyDarkModeEffectActive(): boolean {
  const darkEffects: EffectType[] = ["fire", "charcoal", "led"];
  return Object.values(this.settings.tipEffectMap)
    .some(a => darkEffects.includes(a.effect));
}

// Check if a specific effect is active on any tip
hasEffect(effect: EffectType): boolean {
  return Object.values(this.settings.tipEffectMap)
    .some(a => a.effect === effect);
}

// Check if trails are active on any tip
isTrailsActive(): boolean {
  return this.hasEffect("trails");
}

// Per-tip granular setter (for EffectMatrixDrawer)
setTipEffectMap(map: TipEffectMap): void {
  this.settings.tipEffectMap = map;
  this.syncDarkModeFromMap();
  this.saveToStorage();
  this.notifyObservers();
}

getTipEffectMap(): TipEffectMap {
  return this.settings.tipEffectMap;
}
```

#### Dark mode sync (map-based):

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

### Render Loop Changes

#### Remove the empty-map fallback

Current (lines 528-537 of AnimationRenderLoop.ts):
```typescript
if (hasPerTipAssignments) {
  fireTips = allTips.filter(t => resolveEffect(...) === 'fire');
  charcoalTips = allTips.filter(t => resolveEffect(...) === 'charcoal');
} else {
  // Legacy fallback: check which renderer is initialized
  fireTips = (activeFireRenderer && params.fireConfig?.enabled) ? allTips : [];
  charcoalTips = activeCharcoalRenderer ? allTips : [];
}
```

New:
```typescript
// tipEffectMap is always the authority. No fallback.
fireTips = allTips.filter(t => resolveEffect(t.propIndex, t.tipIndex, tipMap, {}) === 'fire');
charcoalTips = allTips.filter(t => resolveEffect(t.propIndex, t.tipIndex, tipMap, {}) === 'charcoal');
```

Same for LED tips — remove the `params.ledConfig?.enabled` gate in favor of tipEffectMap filtering.

#### Route trails through tipEffectMap

Current trail capture gate (line 256-259):
```typescript
if (trailSettings.enabled && trailSettings.mode !== TrailMode.OFF && this.TrailCapturer) {
```

New:
```typescript
const trailsActive = hasTrailTips(params.tipEffectMap);
if (trailsActive && trailSettings.mode !== TrailMode.OFF && this.TrailCapturer) {
```

Where `hasTrailTips` is a simple check:
```typescript
function hasTrailTips(map: TipEffectMap | undefined): boolean {
  if (!map) return false;
  return Object.values(map).some(a => a.effect === "trails");
}
```

Current effective trails visibility (line 381-382):
```typescript
const effectiveTrailsVisible = visibility.trailsVisible && trailSettings.enabled;
```

New:
```typescript
const effectiveTrailsVisible = hasTrailTips(params.tipEffectMap);
```

The `visibility.trailsVisible` and `trailSettings.enabled` checks are both removed — the map is the authority.

#### Continuous render decision

Current (line 279-280):
```typescript
const trailsNeedContinuousRender = trailSettings.enabled && trailSettings.mode !== TrailMode.OFF;
```

New:
```typescript
const trailsNeedContinuousRender = hasTrailTips(params.tipEffectMap) && trailSettings.mode !== TrailMode.OFF;
```

### AnimationEngine Changes

#### Frame params

`getFrameParams()` already passes `tipEffectMap` (line 2142). This remains the same.

Remove `fireConfig.enabled` as a gate for passing fireConfig. Instead, pass fireConfig whenever any fire/charcoal tips exist in the map:

```typescript
// Current:
fp.fireConfig = (this.fireConfig.enabled || this.prevCharcoalEffect) ? this.fireConfig : null;

// New:
const hasFireOrCharcoal = this.hasFireOrCharcoalTips();
fp.fireConfig = hasFireOrCharcoal ? this.fireConfig : null;
```

#### Visibility observer

The engine's observer reacts to `state.trails` changing to show/hide the trail overlay. This changes to react to the tipEffectMap:

```typescript
// Current: if (state.trails !== this.prevTrailsVisible)
// New: check if trails are in the active effect map
const trailsInMap = vm.isTrailsActive();
if (trailsInMap !== this.prevTrailsActive) {
  this.prevTrailsActive = trailsInMap;
  if (!trailsInMap && this.trailOverlay) {
    this.trailOverlay.clear();
    this.trailOverlay.setVisible(false);
  } else if (trailsInMap && this.trailOverlay) {
    this.trailOverlay.setVisible(true);
  }
  // trigger render...
}
```

#### Fire/charcoal renderer init

Currently the engine initializes fire/charcoal renderers based on `this.prevFireEffect` / `this.prevCharcoalEffect` booleans. These change to check the tipEffectMap:

```typescript
// Current: if (this.fireConfig.enabled && !this.fireRenderer?.isInitialized())
// New:
const hasFireTips = vm.hasEffect("fire");
if (hasFireTips && !this.fireRenderer?.isInitialized()) {
  this.initFireRenderer();
}
```

### AnimationVisibilitySynchronizer Changes

The `getState()` method currently returns `trails: this.manager.isTrailsVisible()`. This changes to:

```typescript
getState(): AnimationVisibilityState {
  return {
    // ...existing fields...
    trails: this.manager.isTrailsActive(),  // Was: isTrailsVisible()
    activeEffect: this.manager.getActiveEffect(),  // New
    tipEffectMap: this.manager.getTipEffectMap(),   // New
  };
}
```

### Consumer Migration (18 files, 112 setter occurrences)

Each file that calls the legacy setters needs to switch to the new API:

| Old Call | New Call |
|----------|---------|
| `vm.setFireEffect(true)` | `vm.setActiveEffect("fire")` |
| `vm.setFireEffect(false)` | `vm.setActiveEffect("none")` |
| `vm.setCharcoalEffect(true)` | `vm.setActiveEffect("charcoal")` |
| `vm.setLedEffect(true)` | `vm.setActiveEffect("led")` |
| `vm.setTrailStyle("on")` | `vm.setActiveEffect("trails")` |
| `vm.setTrailStyle("off")` | `vm.setActiveEffect("none")` |
| `vm.isFireEffectEnabled()` | `vm.getActiveEffect() === "fire"` or `vm.hasEffect("fire")` |
| `vm.isCharcoalEffectEnabled()` | `vm.getActiveEffect() === "charcoal"` or `vm.hasEffect("charcoal")` |
| `vm.isLedEffectEnabled()` | `vm.getActiveEffect() === "led"` or `vm.hasEffect("led")` |
| `vm.isTrailsVisible()` | `vm.isTrailsActive()` |
| `vm.getTrailStyle()` | `vm.getActiveEffect() === "trails" ? "on" : "off"` |

**Note on save/restore patterns:** Several consumers (VideoExportOrchestrator, EffectsLabPlaybackHost, DisassemblePlaybackHost, landing demos) save and restore effect state. These currently save individual booleans. They change to save/restore the entire tipEffectMap:

```typescript
// Current:
const savedFire = vm.isFireEffectEnabled();
const savedTrails = vm.getTrailStyle();
// ... do work ...
vm.setFireEffect(savedFire);
vm.setTrailStyle(savedTrails);

// New:
const savedMap = { ...vm.getTipEffectMap() };
// ... do work ...
vm.setTipEffectMap(savedMap);
```

### Files Changed

| File | Change Summary |
|------|----------------|
| `animation-visibility-state.svelte.ts` | Remove 4 legacy booleans + setters + mutual exclusion. Add `setActiveEffect()`, `getActiveEffect()`, `hasEffect()`, `isTrailsActive()`, `setTipEffectMap()`. Replace `syncEffectDarkMode()` with `syncDarkModeFromMap()`. Update `loadFromStorage()` migration. |
| `AnimationRenderLoop.ts` | Remove empty-map fallback. Route trail capture/render through tipEffectMap. Replace `trailSettings.enabled` checks with `hasTrailTips()`. |
| `AnimationEngine.svelte.ts` | Remove `prevFireEffect`/`prevCharcoalEffect` booleans. Sync fire/charcoal/LED renderer init from tipEffectMap. Change trail overlay show/hide to read from map. Remove `fireConfig.enabled` gate. |
| `AnimationVisibilitySynchronizer.ts` | `getState()` returns `trails` from `isTrailsActive()`, add `activeEffect` and `tipEffectMap` to state. |
| `TrailTypes.ts` | Remove `enabled` from `TrailSettings` interface and `DEFAULT_TRAIL_SETTINGS`. |
| `animation-panel-persistence.ts` | `loadTrailSettings()` stops forcing `enabled: true`. |
| `animation-settings-state.svelte.ts` | Remove `setTrailEnabled()`. Remove `settings.trail.enabled = true` force. Remove `void settings.trail.enabled` tracking. |
| `EffectsPanel.svelte` | `syncFromVM()` reads `getActiveEffect()`. `handleEffectSelect()` calls `setActiveEffect()`. |
| `EffectSelector.svelte` | No changes (already receives `activeEffect` string + `onSelect` callback). |
| `CanvasContextMenuBuilder.ts` | `getActiveEffect()` reads from `vm.getActiveEffect()`. Actions call `vm.setActiveEffect()`. |
| `VisibilityTab.svelte` | Derive trail state from `vm.isTrailsActive()`. |
| `VisualPane.svelte` | Remove dual-source sync hack (`getTrailStyleFromSettings()`). Read from `vm.getActiveEffect()`. |
| `SimpleTrailControls.svelte` | Read from `vm.isTrailsActive()`. `setPreset()` calls `vm.setActiveEffect("trails"/"none")`. |
| `AnimationPanel.svelte` | `toggleTrails()` calls `vm.setActiveEffect("trails"/"none")`. |
| `VideoExportOrchestrator.ts` | Save/restore `tipEffectMap`. Migrate `VideoEffectOverrides` from booleans to `EffectType`. See detailed migration section. |
| `EffectsLabPlaybackHost.svelte` | Save/restore `tipEffectMap`. Replace mode-switching $effect blocks. |
| `DisassemblePlaybackHost.svelte` | Replace $effect mode-switching block. Remove `animationSettings.setTrailEnabled()`. See detailed migration section. |
| `PlayWithItInner.svelte` | Replace switch statement with `setActiveEffect()`. Fixes existing trails+fire bug. See detailed migration section. |
| `LandingAnimationDemo.svelte` | Replace `setTrailStyle()` with `setActiveEffect()`. |
| `HowTkaAnimationCard.svelte` | Replace `setTrailStyle("off")` with `setActiveEffect("none")`. |
| `register-global-shortcuts.ts` | Update keyboard shortcut handlers. |
| `SettingsSubInterpreter.ts` | Change alias map: `trails: "effect:trails"`, add fire/led/charcoal aliases. |
| `SettingsCommandHandler.ts` | Add `effect:*` target handling that calls `setActiveEffect()`. |
| `AnimatorCanvas.svelte` | Remove checks against `isFireEffectEnabled()` / `isTrailsVisible()`. |
| `AnimationSettingsModal.svelte` | Update effect state reads. |
| `ChipGrid.svelte` | Update effect state reads. |
| `EffectsLabModule.svelte` | Replace setter calls. |

### localStorage Migration

In `loadFromStorage()`, after parsing:

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

This migration already partially exists (line 292-298 of the current code). The new version adds trails migration and deletes the legacy fields.

### Legacy Trail Persistence Cleanup

- `tka_trail_settings` localStorage key: still read by `loadTrailSettings()` for appearance params (fade duration, line width, etc.). The `enabled` field is ignored/removed. Long-term this key can be deprecated in favor of `tka_animation_settings`, but that's a separate concern.
- `tka_animation_settings`: `trail.enabled` removed from the interface. The persistence just stops saving/loading it.

### What Does NOT Change

- `tipEffectMap` data structure and resolution cascade — already correct
- `resolveEffect()` function — already correct
- `EffectMatrixDrawer` — already writes to tipEffectMap
- Per-cell overrides in compose grid — already use tipEffectMap
- `TipEffectResolver` service — already correct
- Fire/charcoal/LED renderers — they already accept filtered tip arrays
- Trail appearance settings (fade duration, line width, glow, colors) — still in `TrailSettings`
- `TrailSettings.mode` — still controls fade vs persistent vs off (appearance, not on/off)

### Behavior Changes from Current System

These are intentional improvements, not regressions. Document them so testers know what changed.

#### Dark mode now restores when switching from fire/charcoal/LED to trails

Currently: switching from fire to trails does NOT restore dark mode because `setTrailStyle()` doesn't call `syncEffectDarkMode()`. Dark mode stays on.

New: `syncDarkModeFromMap()` checks if any dark-mode effect (fire, charcoal, LED) is in the map. When switching to trails, none of those are present, so dark mode restores to the user's previous setting. This is the correct behavior.

#### "None" in EffectsPanel now clears trails too

Currently: selecting "None" calls `setFireEffect(false); setLedEffect(false); setCharcoalEffect(false)` but does NOT call `setTrailStyle("off")`, so trails could remain active.

New: `setActiveEffect("none")` clears the entire map. All effects stop, including trails.

#### PlayWithItInner landing demo had trails+fire simultaneously (existing bug)

Line 312 of `PlayWithItInner.svelte` sets both `setTrailStyle("on")` AND `setFireEffect(true)` for the "fire" demo mode. This is the exact bug this spec fixes. Migration: fire demo uses `setActiveEffect("fire")` only — no trails.

### Edge Cases

#### "None" selected but tipEffectMap has per-tip entries

`setActiveEffect("none")` clears the entire map. `setActiveEffect("fire")` replaces the whole map with `{ "*": { effect: "fire" } }`. Both destroy per-tip assignments. This is correct — the global quick-select in EffectsPanel is a "reset all" operation. Per-tip granular assignments are made through the EffectMatrixDrawer, which writes to the map directly via `setTipEffectMap()`.

#### TrailSettings.mode = OFF when trails are selected

If `tipEffectMap = { "*": { effect: "trails" } }` but `TrailSettings.mode` is `TrailMode.OFF`, the render loop checks both: `hasTrailTips(map)` AND `trailSettings.mode !== TrailMode.OFF`. This means trails won't render despite being "selected." This is fine — `mode` controls the appearance style (fade, persistent, off), and `OFF` means "trails are selected but currently paused." The EffectsPanel / SimpleTrailControls should set `mode` to `FADE` when activating trails.

#### Fire renderer initialization timing

The fire renderer is expensive to init (WebGL context). Currently it's initialized when `fireEffect` becomes true and destroyed when false. With the new system, init when `hasEffect("fire")` becomes true (any fire tip in the map) and destroy when no fire tips remain. Same lifecycle, different trigger.

#### fireConfig.enabled field

The `FireOverlayConfig.enabled` field is removed from the type. The engine no longer sets it. The render loop no longer checks it. Whether fire renders is determined entirely by whether any tips resolve to `"fire"` in the tipEffectMap.

### Complex Consumer Migration Details

These consumers have non-trivial interaction patterns that go beyond simple find-and-replace.

#### DisassemblePlaybackHost.svelte

Current code has a `$effect` block (lines 220-252) that pushes state to the visibility manager based on `activeEffectMode`. It also calls `animationSettings.setTrailEnabled(true)` which is being removed.

New pattern:
```typescript
$effect(() => {
  const mode = activeEffectMode;
  untrack(() => {
    vm.setActiveEffect(mode === "clean" ? "none" : mode);
    // Fire sliders still set directly (intensity, colorBlend)
    if (mode === "fire") {
      vm.setFireIntensity(intensity);
      vm.setFireColorBlend(colorBlend);
    }
  });
});
```

The `animationSettings.setTrailEnabled(true)` call is removed — trails on/off is now solely determined by the tipEffectMap.

#### VideoExportOrchestrator.ts

The save/restore AND the override application need migration. The `VideoEffectOverrides` interface currently uses booleans (`{ fire?: boolean, led?: boolean, trails?: boolean, charcoal?: boolean }`).

New override model:
```typescript
interface VideoEffectOverrides {
  activeEffect?: EffectType;  // Replaces 4 booleans
}
```

Save/restore:
```typescript
private applyEffectOverrides(vm, overrides?): TipEffectMap | null {
  if (!overrides?.activeEffect) return null;
  const saved = { ...vm.getTipEffectMap() };
  vm.setActiveEffect(overrides.activeEffect);
  return saved;
}

private restoreEffectState(vm, saved: TipEffectMap | null): void {
  if (!saved) return;
  vm.setTipEffectMap(saved);
}
```

Note: the export dialog UI that produces `VideoEffectOverrides` also needs updating to use the new type.

#### PlayWithItInner.svelte

The switch statement (lines 298-329) has 5 demo modes. Each currently calls 4 setters. Migration:

| Demo Mode | Current | New |
|-----------|---------|-----|
| `"clean"` | setTrailStyle("off") + disable all | `setActiveEffect("none")` |
| `"trails"` | setTrailStyle("on") + disable all | `setActiveEffect("trails")` |
| `"fire"` | setTrailStyle("on") + setFireEffect(true) | `setActiveEffect("fire")` (bug fix: was setting both trails+fire) |
| `"charcoal"` | setTrailStyle("off") + setCharcoalEffect(true) | `setActiveEffect("charcoal")` |
| `"leds"` | setTrailStyle("on") + setLedEffect(true) | `setActiveEffect("led")` (bug fix: was setting both trails+LED) |

#### SettingsSubInterpreter.ts (voice control)

The interpreter maps spoken "trails" to `"trailStyle"` as a settings key. The handler then tries to pass it through `mgr.setVisibility()`, but `trailStyle` is already excluded from that generic method's TypeScript type. This is likely already broken or bypassed.

New: the alias map changes `trails: "trailStyle"` to `trails: "effect:trails"`. The SettingsCommandHandler adds a special case for `effect:*` targets that calls `vm.setActiveEffect()` / clears the map. Also add aliases for fire, LED, charcoal:

```typescript
// New voice command aliases
trails: "effect:trails",
"trail style": "effect:trails",
fire: "effect:fire",
"fire effect": "effect:fire",
leds: "effect:led",
"led effect": "effect:led",
charcoal: "effect:charcoal",
```

### EffectType Definition

Already defined in `TipEffectTypes.ts` (line 16):
```typescript
export type EffectType = "none" | "fire" | "charcoal" | "led" | "trails";
```

All new methods use this existing type. No new type definitions needed.

### Test Plan

1. **Fresh load (no localStorage):** No effect active, map is `{}`, no rendering artifacts
2. **Select fire:** Fire renders, trails don't, dark mode activates
3. **Switch fire → trails:** Fire stops, trails render, dark mode restores (NEW behavior)
4. **Select none:** Nothing renders, dark mode restores, map is `{}`
5. **None clears trails too:** Enable trails, select "None" in EffectsPanel, trails stop (NEW behavior)
6. **Migration (fire+trails conflict):** Start with old localStorage containing `fireEffect: true, trailStyle: "on"`. After load, tipEffectMap should be `{ "*": { effect: "fire" } }` (fire wins because of priority order). Trails do NOT render simultaneously.
7. **Migration (trails only):** Old localStorage with `trailStyle: "on"` and no effects. After load, tipEffectMap should be `{ "*": { effect: "trails" } }`.
8. **Per-tip mixing:** Assign fire to blue thumb, trails to red pinky via EffectMatrixDrawer. Both render on their respective tips simultaneously.
9. **Save/restore (effects lab):** Open effects lab, change effect, exit. Previous tipEffectMap restored.
10. **Video export:** Effect state saved as tipEffectMap before export overrides, restored after.
11. **Keyboard shortcuts:** Effect toggle shortcuts work with new API.
12. **Voice commands:** "toggle trails", "enable fire", "disable leds" work with new API.
13. **Landing demo regression:** Fire demo mode does NOT show trails (was an existing bug).
