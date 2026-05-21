# Settings Cascade Architecture

## Goal

Replace the binary "global vs per-performer" split with a cascade system where global defaults flow down to performers unless overridden. Performers can override any setting independently. "All" mode edits the defaults. Individual mode shows inherited vs overridden state with visual feedback.

Industry precedent: CSS cascade (inherit/override), Figma component overrides, Unity prefab instances, After Effects master properties.

## What Cascades

| Setting | Current Location | Cascade Behavior |
|---------|-----------------|------------------|
| `prop` | AvatarInstanceState.settings | null = inherit default |
| `effects` | AvatarInstanceState.settings | null = inherit default |
| `effortId` | AvatarInstanceState.settings | null = inherit default |
| `planeMode` | AvatarInstanceState | null = inherit default |
| `customBluePlane` | AvatarInstanceState | null = inherit default |
| `customRedPlane` | AvatarInstanceState | null = inherit default |

## What Stays Global Always

- `visiblePlanes` (grid rendering preference)
- `showGridLabels` (grid rendering preference)
- Camera state and presets
- Formation presets
- Tempo / playback speed
- Scene selection
- Export settings

## What Stays Per-Performer Always

- Position, facing angle, locomotion
- Loaded sequence, step index, playback state
- `beatPlaneOverrides` (beat-specific, tied to sequence structure)
- `staffLengthCm` (already has its own null-inherit + propSizeLinked mechanism)

## Data Model

### New: Global Defaults on Viewer3DState

```typescript
interface DefaultPerformerSettings {
  prop: PropType;          // default: PropType.STAFF
  effects: Set<EffectId>;  // default: new Set()
  effortId: EffortId;      // default: "linear"
  planeMode: PlaneMode;    // default: PlaneMode.WALL
  customBluePlane: Plane;  // default: Plane.WALL
  customRedPlane: Plane;   // default: Plane.WALL
}
```

Stored on `Viewer3DState` as `_defaultSettings: DefaultPerformerSettings`.

### Changed: Nullable Per-Performer Settings

```typescript
interface PerformerSettings {
  prop: PropType | null;          // null = inherit
  effects: Set<EffectId> | null;  // null = inherit
  effortId: EffortId | null;      // null = inherit
  staffLengthCm: number | null;   // existing, unchanged
}
```

Plane fields on `AvatarInstanceState` become nullable:
- `_planeMode: PlaneMode | null`
- `_customBluePlane: Plane | null`
- `_customRedPlane: Plane | null`

### Resolution: Effective Value Getters

Each performer exposes resolved getters that consumers read instead of raw settings:

```typescript
get effectiveProp(): PropType {
  return this._settings.prop ?? this._viewer.defaultSettings.prop;
}

get effectiveEffects(): Set<EffectId> {
  return this._settings.effects ?? this._viewer.defaultSettings.effects;
}

get effectiveEffortId(): EffortId {
  return this._settings.effortId ?? this._viewer.defaultSettings.effortId;
}

get effectivePlaneMode(): PlaneMode {
  return this._planeMode ?? this._viewer.defaultSettings.planeMode;
}
// etc.
```

### Override Detection

```typescript
get hasOverride(): { prop: boolean; effects: boolean; effort: boolean; planes: boolean } {
  return {
    prop: this._settings.prop !== null,
    effects: this._settings.effects !== null,
    effort: this._settings.effortId !== null,
    planes: this._planeMode !== null,
  };
}

get hasAnyOverride(): boolean {
  const o = this.hasOverride;
  return o.prop || o.effects || o.effort || o.planes;
}
```

### Reset to Default

```typescript
resetProp(): void { this._settings.prop = null; }
resetEffects(): void { this._settings.effects = null; }
resetEffort(): void { this._settings.effortId = null; }
resetPlanes(): void {
  this._planeMode = null;
  this._customBluePlane = null;
  this._customRedPlane = null;
}
resetAllOverrides(): void {
  this.resetProp();
  this.resetEffects();
  this.resetEffort();
  this.resetPlanes();
}
```

## "All" Mode Behavior

When `selectedPerformerIndex === null` ("All" chip active):

1. **All popovers visible.** Effects, Props, Effort, Planes popovers appear in the right rail — no longer hidden.
2. **Popovers read/write `defaultSettings`.** Changing a value updates the global default. All inheriting performers update reactively.
3. **Override badge.** If any performers have overrides for that setting, a pill badge below the header: "2 performers have custom [prop/effects/effort/planes]" in `rgba(255,255,255,0.4)` text, `rgba(255,255,255,0.08)` background, 10px font, uppercase. Clicking it calls `resetAllPerformers[Setting]()` which sets all performers' override to null.
4. **No performer accent color.** Popovers in "All" mode use neutral blue tint, not a performer color.
5. **Popover chips lose the `performerScoped` flag** in "All" mode — standard chip styling.

## Individual Mode Behavior

When `selectedPerformerIndex = i`:

1. **Popovers read/write that performer's settings.** Setting a value creates an override (non-null). Value shows as the effective value (resolved).
2. **Inherited indicator.** When a setting is inherited (null), the popover shows the global default value selected, with a subtle "Default" badge. Changing it creates an override.
3. **Override indicator.** When a setting is overridden, a "Custom" badge appears with a reset button (circular arrow icon). Tapping reset sets the value back to null (inherit).
4. **Chip override dot.** When the selected performer has an override for a setting category, the right-rail chip for that category gets a 6px dot positioned at top-right corner, filled with the performer's accent color. Uses `position: absolute; top: 4px; right: 4px;` on the `.rail-chip`. Visible at a glance without opening the popover.

## Right Rail Layout Changes

### Current
```
[Formation]  [Tempo]  [Camera]  [Planes]  [Export]  [Scene]
─── separator (only if performer selected) ───
[Effects]  [Prop]  [Effort]    ← hidden when "All" selected
```

### New
```
[Formation]  [Tempo]  [Camera]  [Export]  [Scene]
─── separator ───
[Planes]  [Effects]  [Prop]  [Effort]
     ↑ always visible, content switches between default-edit and per-performer-edit
```

Planes moves below the separator to join the cascade group. The separator always renders (it marks "global-only" from "cascading" settings). The cascade group popovers are always visible — their behavior changes based on selection scope.

## ViewerPopover Changes

New prop: `cascading?: boolean`. When true and in "All" mode:
- Uses neutral styling (no performer accent)
- Does NOT get `performerScoped` class

Override dot: new optional prop `hasOverride?: boolean`. When true, renders a small colored dot on the chip corner.

## Popover Content Contract

Each cascading popover needs to support two modes:

**Default-edit mode** (selectedPerformerIndex === null):
- Read from `viewer.defaultSettings`
- Write to `viewer.setDefault*()` methods
- Show override count badge

**Per-performer mode** (selectedPerformerIndex = i):
- Read from `performer.effective*` getters
- Write to `performer.set*()` methods (creates override)
- Show "Default" / "Custom" badge with reset action

This is a behavioral change, not a component split. Each popover reads `selectedPerformerIndex` and branches internally.

## Undo Integration

### New undo domain: `defaults`

```typescript
interface DefaultsDomainSnapshot {
  prop: PropType;
  effects: Set<EffectId>;
  effortId: EffortId;
  planeMode: PlaneMode;
  customBluePlane: Plane;
  customRedPlane: Plane;
}
```

Captured when any `setDefault*()` method fires.

### Existing `performer` domain

Already captures `PerformerDomainSnapshot` which includes settings and planes. The nullable fields slot into the existing snapshot structure — `null` values serialize/restore correctly.

## Migration

### New performers

Created with all settings `null` (inherit everything). Current `createPerformer()` already sets defaults — change those to null.

### Existing state (localStorage / Firebase)

Performers with non-null settings from before the cascade system are treated as overrides. This is backwards-compatible — a performer with `prop: PropType.STAFF` is an override that happens to match the default. No data migration needed. Over time, users who want inheritance can reset individual overrides.

## Effects Cascade Detail

Effects is the one setting where cascade has a subtlety: it's a `Set`, not a scalar.

**Inheritance**: `null` = inherit the entire default set. An overridden effects set is a complete replacement, not a delta. If default is `{trails, bloom}` and performer overrides to `{fire}`, the performer has fire only — no merge.

**Why not delta/merge**: Merging sets (default + performer additions - performer removals) adds complexity with marginal benefit. Complete replacement matches how Props and Effort work (you pick one, not a diff). Users toggle effects on/off in the popover — the resulting set is the override.

## Success Criteria

1. "All" mode shows Props, Effects, Effort, Planes popovers and edits global defaults
2. Changing a default updates all inheriting performers reactively
3. Per-performer overrides survive default changes
4. Override state is visible at chip level (dot) and popover level (badge + reset)
5. "Reset to default" returns a performer to inheritance
6. Undo/redo works across default changes and per-performer override changes
7. New performers inherit all defaults (no overrides on creation)
8. Existing saved state loads without migration — non-null values become overrides
