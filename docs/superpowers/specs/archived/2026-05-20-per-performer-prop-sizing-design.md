---
status: archived
value: 2
effort: M
remaining: ""
depends_on: ""
plan_path: ""
tags: []
superseded_by: docs/superpowers/specs/shipped/2026-05-21-performer-rail-design.md
last_triaged: 2026-07-29
---
# Per-Performer Prop Sizing — Design Spec

**Date:** 2026-05-20
**Status:** Archived as superseded (verified 2026-07-29)
**Scope:** Move prop size out of Scene popover into Performers popover. Add per-performer sizing with linked/unlinked mode. Fix chip strip layout. Add performer identification badges in 3D scene.

> **Queue closeout:** The underlying per-performer sizing, linked state, scene threading, and badges landed across `a2bea2b2e1`, `d62aada8b2`, `0192fbc583`, and `776b3346aa`. The proposed popover structure was replaced by the shipped Performer Rail and Performer Hub designs, so this draft is retained as implementation history rather than active work.

---

## 1. Problem Statement

Prop size is currently a global slider in the Scene popover (`SceneSelectorPopover.svelte`). It belongs in the Performers popover alongside prop type, effects, and effort — all of which are already per-performer. Users need the ability to set different prop sizes per performer, with a convenient "linked" mode that keeps all performers in sync.

Secondary issues surfaced during brainstorming:
- Performer chip strip layout breaks at 6+ performers (orphaned `+` button)
- No visual identification of performers in the 3D scene (no numbers, no color matching)

---

## 2. Architecture

### 2.1 npm Package Patch (`@austencloud/scene-3d` v0.1.2)

`Prop3D` and `PerformerRig` are in the external npm package. They need a `pnpm patch` to thread per-performer prop length.

**Prop3D.svelte** — add `length?: number` to Props interface. Pass to `Staff3D`, `Club3D`, and all procedural geometry components that accept a length/scale parameter.

**PerformerRig.svelte** — add `propLength?: number` to Props interface. Pass to both `<Prop3D>` instances. Also derive `staffHalfLength` from `propLength` when provided (hand positioning must track prop size).

```typescript
// PerformerRig.svelte — new prop
interface Props {
  // ... existing props
  propLength?: number; // scene units, overrides global userProportionsState.staffLength
}

// Destructuring default
let { propLength, ...rest }: Props = $props();

// Derived half-length uses propLength when available
const effectiveStaffHalfLength = $derived(
  staffHalfLength ?? (propLength ? propLength / 2 : userProportionsState.staffLength / 2)
);

// Pass to Prop3D
<Prop3D propType={bluePropType} propState={bluePropState} color="blue" length={propLength} />
```

### 2.2 PerformerSettings Extension

**File:** `src/lib/shared/3d/state/performer-settings-types.ts`

```typescript
export interface PerformerSettings {
  effortId: EffortId;
  prop: PropType;
  effects: Set<EffectId>;
  staffLengthCm: number | null; // null = use linked (global) value
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

### 2.3 AvatarInstanceState Extension

Add `setStaffLengthCm(cm: number | null)` method alongside existing `setEffort`, `setProp`, `toggleEffect`.

### 2.4 Viewer3D State — Link Mode

**File:** `src/lib/shared/3d/state/viewer-3d-state.svelte.ts`

Add `propSizeLinked: boolean` (default `true`) to viewer state. Expose `togglePropSizeLink()`.

**Transition behavior:**
- **Linked → Unlinked:** Each performer with `staffLengthCm === null` gets the current global value written into their settings. From this point, sliders are per-performer.
- **Unlinked → Linked:** All performers' `staffLengthCm` set to `null`. Global `userProportionsState` set to the selected performer's value (or first performer's if "All" is selected).

### 2.5 Rendering Thread

**File:** `src/lib/shared/3d/components/Viewer3DScene.svelte` (line 340)

```svelte
{@const perfStaffCm = performer.settings.staffLengthCm}
{@const perfPropLength = perfStaffCm != null
  ? perfStaffCm * CM_TO_UNITS
  : undefined}
<PerformerRig
  ...existing props
  propLength={perfPropLength}
>
```

When `perfPropLength` is `undefined`, PerformerRig falls back to `userProportionsState.staffLength` (the global).

---

## 3. UI Changes

### 3.1 Move Prop Size to Performers Popover

**Remove from:** `SceneSelectorPopover.svelte` — delete the prop size `scene-control` div (lines 93–108). Remove `inchesToCm` import (keep `userProportionsState` — body freedom still uses it).

**Add to:** `PerformerPopover.svelte` — below `<BentoPropGrid>` in the `activeTab === "prop"` branch. New component: `PropSizeControl.svelte`.

### 3.2 PropSizeControl Component

**File:** `src/lib/shared/sequence-viewer/components/PropSizeControl.svelte`

Layout:
```
┌──────────────────────────────────┐
│  Prop size         34 in   [🔗] │
│  ═══════════●════════════════    │
└──────────────────────────────────┘
```

- Label "Prop size" left-aligned
- Value display (e.g. "34 in") right of label
- Link toggle button far-right: `fa-link` when linked, `fa-link-slash` when unlinked
- Range slider below, full width
- Range: 24–60 inches (converted to cm via `inchesToCm`)
- Step: 1 cm

**When linked:**
- Slider writes to `userProportionsState.setStaffLengthCm()`
- Reads from `userProportionsState.staffLengthCm`
- Works even when "All" is selected (changes global for everyone)
- Label: "Prop size"

**When unlinked:**
- Slider writes to `selected.setStaffLengthCm(cm)`
- Reads from `selected.settings.staffLengthCm`
- Disabled when "All" is selected (Prop tab already gates this)
- Label: "P{n} prop size" where n = selected performer number

**Link toggle button:**
- Button with `aria-pressed` for accessibility
- `fa-link` icon when linked (pressed)
- `fa-link-slash` icon when unlinked (not pressed)
- Styled as a small icon button matching the glass popover aesthetic
- Hidden when only 1 performer exists (no point in per-performer mode)

### 3.3 Integration in PerformerPopover Prop Tab

The Prop tab currently requires a selected performer (gates on `allSelected`). With linked mode, the prop size slider should remain usable even when "All" is selected (it controls the global value). The integration restructures the tab gating:

```svelte
{:else if activeTab === "prop"}
  {#if !allSelected && selected}
    <BentoPropGrid
      selectedPropType={selected.settings.prop ?? PropType.STAFF}
      color={gridColor}
      variant="inline"
      onSelect={(p: PropType) => selected.setProp(p)}
    />
  {:else}
    <div class="empty">Select a performer to change prop type.</div>
  {/if}
  <PropSizeControl performer={selected} />
```

`PropSizeControl` handles its own state logic:
- **Linked mode:** renders regardless of `performer` value — reads/writes global `userProportionsState`
- **Unlinked mode + performer selected:** reads/writes `performer.settings.staffLengthCm`
- **Unlinked mode + "All" selected:** shows disabled state with hint "Select a performer"

---

## 4. Chip Strip Layout Fix

**File:** `src/lib/shared/3d/components/controls/PerformerChipStrip.svelte`

**Problem:** `margin-left: auto` on `+` button orphans it onto its own row at 6+ performers. When it wraps alone, it sits isolated on the right — confusing layout.

**Fix:** Remove `margin-left: auto` from `.chip-add`. The `+` button flows naturally after the last numbered chip. If the row wraps at 6+ performers, `+` wraps with its neighbors (e.g. `[5] [6] [7] [8] [+]` on the second row). Every chip stays visible — no hidden state.

Also reduce `+` button from 44×44 to 44×28 (same height as performer chips, 44px width preserves AAA touch target).

**Size constraints (AAA accessibility):**
- All chips remain 44px minimum touch target
- No scrolling, no hidden affordances — everything visible at all performer counts

---

## 5. Performer Identification Badges

**Problem:** No visual link between chip strip numbers/colors and 3D performers. Ground disc is generic gray/lavender.

### 5.1 Floating Badge Sprite

New component: `PerformerBadge3D.svelte`

Renders a camera-facing billboard sprite above each performer:
- Small circle (radius ~0.12 scene units) positioned above performer's head
- Filled with the performer's `CHIP_COLORS[index]` color
- White number text ("1", "2", etc.) centered inside
- Always faces camera (Three.js `Sprite` or `<T.Sprite>`)
- Y position: `userProportionsState.groundY + avatar height + 0.15` (above head)

**State-dependent appearance:**
- When this performer is selected: full opacity (1.0), subtle glow ring
- When "All" is selected: all badges at 0.6 opacity
- When another performer is selected: 0.35 opacity

### 5.2 Ground Disc Color Upgrade

**File:** `Viewer3DScene.svelte` (line 376)

Change the ground disc to use per-performer chip color instead of generic lavender:

```svelte
<T.MeshBasicMaterial
  color={viewer3DState.selectedPerformerIndex === null
    ? 0x6b7280
    : CHIP_COLORS[i]}
  transparent
  opacity={0.35}
/>
```

Import `CHIP_COLORS` from the same array used in `PerformerChipStrip` (extract to shared constant if needed).

---

## 6. Edge Cases

| Scenario | Behavior |
|----------|----------|
| Add performer while unlinked | New performer gets `staffLengthCm: null` → inherits global value |
| Only 1 performer | Link toggle hidden, slider writes global directly |
| "All" selected + linked | Slider works (changes global for everyone) |
| "All" selected + unlinked | Prop tab disabled (existing gate) |
| Switch linked→unlinked | Each performer with `null` gets current global value |
| Switch unlinked→linked | All set to `null`, global set to selected performer's value |
| Delete performer while unlinked | No special handling — removed from array |
| Performer added at max (8) | `+` disabled (existing behavior) |
| Export with mixed sizes | Export captures what's rendered — per-performer sizes preserved |

---

## 7. Files Changed

### Modified
| File | Change |
|------|--------|
| `@austencloud/scene-3d` (pnpm patch) | Add `length` to Prop3D, `propLength` to PerformerRig |
| `performer-settings-types.ts` | Add `staffLengthCm: number \| null` |
| `avatar-instance-state.svelte.ts` | Add `setStaffLengthCm()` method |
| `viewer-3d-state.svelte.ts` | Add `propSizeLinked`, `togglePropSizeLink()` |
| `Viewer3DScene.svelte` | Pass `propLength` to PerformerRig, add badge, upgrade disc color |
| `PerformerPopover.svelte` | Add `PropSizeControl` to Prop tab |
| `SceneSelectorPopover.svelte` | Remove prop size slider |
| `PerformerChipStrip.svelte` | Fix layout: nowrap + scroll |

### New
| File | Purpose |
|------|---------|
| `PropSizeControl.svelte` | Prop size slider with link/unlink toggle |
| `PerformerBadge3D.svelte` | Floating numbered badge above performers |

---

## 8. Not In Scope

- Per-performer body freedom (stays global in Scene popover)
- Per-performer prop thickness
- Saving per-performer sizes to sequence data / persistence
- Keyboard shortcuts for performer switching
