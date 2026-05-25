# Effects Architecture v2 — Design Spec

## Problem

Effect state is split across two systems that must stay in sync:

1. **AnimationVisibilityStateManager** (VM) — class singleton, manual observer pattern, localStorage. The engine reads fire/LED/charcoal/tipEffectMap from here via `FrameParameterBuilder.ts:389`.
2. **EffectsConfigState** — Svelte 5 runes factory, Svelte context distribution, localStorage. Newer effects (zap through pulse) write here exclusively.

This dual-state split causes:
- **Sync bugs**: Every consumer must update both VM and EffectsConfigState. The QR page effect-switching bug (commit `d293b268`) was caused by updating only one.
- **16x code duplication**: `getPresetGroup()` switch duplicated in EffectsPanel and MobileEffectsPanel. 16 identical `updateX()` methods in EffectsConfigState. 16-branch customize if/else chain duplicated in both panels.
- **Observer pattern fighting Svelte 5**: VM uses hand-rolled `registerObserver`/`notifyObservers`. Both panels manually sync with `syncFromVM()` + lifecycle hooks — exactly what `$state` eliminates.
- **vm-shim compat layer**: A 128-line bridge (`vm-shim.ts`) exists solely to translate between the two state systems. It was labeled "Phase A only — deleted in Phase B."

Phase B never happened. This spec is Phase B.

## Goal

Single source of truth for all effect state. One component for all panel layouts. Registry-driven effect system where adding effect 17 = one registration call.

## Architecture

### State Ownership After Migration

**EffectsConfigState owns** (all effect state):
- `tipEffectMap` — which effect is active per tip
- `tipEffortMap` — which effort per tip
- `effectLayerOverrides` — behind/front per effect
- All 16 per-effect intent objects (trails, fire, LED, charcoal, zap, sparkles, echo, bloom, water, bubbles, petals, smoke, ink, frost, silk, pulse)
- `activePresets` — per-effect active preset tracking
- Active effect management (`setActiveEffect`, `getActiveEffect`)
- Dark mode forcing (effects that require dark mode)

**VM keeps** (display + playback — NOT effects):
- Display: `gridMode`, `stepNumbers`, `beatPosition`, `props`, `wordHeader`, `progressBar`
- Playback: `playbackMode`, `speed`
- Rendering: `darkMode`, `pathShape`, `motionAwarePaths`, `pathLines`, `tkaGlyph`, `reversalIndicators`, `effortPreset`
- Transient: `transforming`
- Motion colors cache

### Service-Layer Access

Services don't have Svelte context. The existing wiring already solves this:
- `AnimatorCanvas.svelte` reads EffectsConfigState from context
- Passes it to `AnimationEngine` via `engine.setEffectsConfigState()`
- Engine passes it to `FrameParameterBuilder`
- Service chain receives EffectsConfigState explicitly — no context needed

### Effect Registry

Enhanced `effect-registry.ts` with full registration:

```typescript
export interface EffectRegistration {
  meta: EffectMeta;
  presetGroup: EffectPresetGroup;
  customizeComponent: () => Promise<{ default: Component }>;
  primaryParam?: PrimaryParamSpec;
}
```

Each effect self-registers in its preset file. EffectsPanel iterates the registry instead of switch statements.

### Preset Interface

Current: `apply: (vm: AnimationVisibilityStateManager, state: EffectsConfigState | null) => void`
After: `apply: (state: EffectsConfigState) => void`

All presets write exclusively to EffectsConfigState. VM param dropped.

### Panel Consolidation

EffectsPanel and MobileEffectsPanel merge into one component:

```
<EffectsPanel layout="sidebar" | "strip" | "grid" />
```

- `sidebar` — desktop vertical sections (viewer, lab)
- `strip` — mobile horizontal scroll (viewer bento)
- `grid` — popover wrapping grid (3D controls)

Optional prop picker section via `propType`/`onPropChange`/`propOptions` props.

Customize components loaded dynamically via registry — no static imports.

## Layers (Execution Order)

### Layer 1: Migrate Effect Params from VM → EffectsConfigState

Move tipEffectMap, tipEffortMap, effectLayerOverrides, and all fire/LED/charcoal params out of VM. Add active-effect management and dark-mode forcing to EffectsConfigState. Delete vm-shim.ts and animation-settings-shim.ts.

Files: `animation-visibility-state.svelte.ts` (~400 lines removed), `effects-config-state.svelte.ts` (add activeEffect/tipEffectMap management + dark mode sync), `FrameParameterBuilder.ts` (read tipEffectMap from EffectsConfigState), `AnimationEngine.svelte.ts`, `EffectRendererManager.ts`, `HeadlessAnimationOrchestrator.ts`, `vm-shim.ts` (DELETE), `animation-settings-shim.ts` (DELETE).

### Layer 2: Generic Effect Update

Replace 16 identical `updateX()` methods with one `updateEffect(effectId, patch)`. Keep named wrappers as thin aliases during migration.

Files: `effects-config-state.svelte.ts`.

### Layer 3: Effect Registry Map

Enhance `effect-registry.ts` with registration map. Each preset file self-registers. Delete `effect-primary-param.ts` (absorbed into registry).

Files: `effect-registry.ts`, 16 preset files, `effect-primary-param.ts` (DELETE).

### Layer 4: Preset Interface Cleanup

Change preset `apply` signature to `(state: EffectsConfigState)`. Update all preset files. Fire presets: `vm.setFireColorCurve()` → `state.updateEffect("fire", { colorCurve })`.

Files: `presets/types.ts`, all 16 preset files.

### Layer 5: Panel Merge + Prop Picker

Merge EffectsPanel + MobileEffectsPanel. Registry-driven customize loading. Add optional prop picker section. Delete MobileEffectsPanel.svelte.

Files: `EffectsPanel.svelte` (rewrite), `MobileEffectsPanel.svelte` (DELETE), `ExportVideoDrawer.svelte`, `EffectsPopover.svelte`.

### Layer 6: QR Page Integration + Consumer Migration

Drop unified EffectsPanel into QR page. Delete ~350 lines of hand-rolled controls. Update remaining consumers (keyboard shortcuts, voice commands, context menu, etc.).

Files: `+page.svelte` (QR), `register-global-shortcuts.ts`, `SettingsCommandHandler.ts`, `PlaybackCommandHandler.ts`, `CanvasContextMenuBuilder.ts`, `CanvasContextMenuHost.svelte`.

## What Stays Unchanged

- All 16 customize component UIs (sliders, color pickers — internal logic unchanged)
- All effect renderer implementations (fire shader, LED renderer, etc.)
- EffectsConfig schema and defaults
- All 2D effect translators
- 3D effect renderers (already use EffectsConfigState)
- Dark mode system (stays in VM, but EffectsConfigState triggers it when effects require it)
- Display settings, playback settings (stay in VM)
- AnimatorCanvas.svelte wiring (already correct)

## localStorage Migration

Users have fire/LED/charcoal settings persisted under the VM's `animation-visibility-settings` key. EffectsConfigState already has its own `tka_effects_config` key and loads from it.

Strategy: On first load after migration, EffectsConfigState checks if its localStorage entry has fire/LED/charcoal defaults and the VM key has non-default values. If so, it snapshots from the VM key one final time and saves to its own key. This is a one-time migration that replaces the continuous vm-shim sync.

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Fire/LED/charcoal stop rendering | High | FrameParameterBuilder has one read point per effect — verify each reads from EffectsConfigState |
| tipEffectMap read path breaks engine | High | Single line to change (FrameParameterBuilder:389) — test with multiple effects |
| localStorage migration loses user settings | Medium | One-time snapshot migration from VM key → EffectsConfigState key |
| Observer-dependent code breaks | Medium | VM observer stays for display/playback; only effect observers move |
| 3D effects break | Low | Already reads from EffectsConfigState exclusively |

## Estimated Impact

- Files modified: ~45
- Files deleted: 4 (vm-shim, animation-settings-shim, MobileEffectsPanel, effect-primary-param)
- Lines removed from VM: ~400
- Lines removed from EffectsConfigState (16→1 update): ~200
- Lines removed from panels (switch/if-else): ~120
- Net line delta: -600 to -800
