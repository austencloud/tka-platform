---
status: active
value: 3
effort: L
remaining: "Unscored until triage 2026-07-25; spec body carries no status line. Needs a read-through to establish real state before this score is trusted."
depends_on: ""
plan_path: ""
tags: []
last_triaged: 2026-07-25
---
# Viewer Popover Architecture Redesign

## Problem

The 3D viewer has 7 popovers (formation, tempo, camera, planes, export, scene, prop, effects, effort) that each hand-roll identical positioning (`right: calc(100% + 10px); top: 0`), animation, escape handling, click-outside dismissal, and styling. This produces:

1. **No shared base** — 7 copies of the same positioning/animation/escape/styling code
2. **No viewport awareness** — popovers clip below the viewport on shorter screens
3. **No accessibility** — hand-rolled `role="dialog"` without focus trapping
4. **CSS brightness hacks** — PropCompositionPreview SVGs designed for light backgrounds, patched with `filter: brightness(1.8)` per-consumer
5. **Hardcoded prop families** — PropPopover defines `PROP_FAMILIES` array duplicating data the registry already has
6. **`forceIndividual` flag** — PropSizeControl does double duty as global and per-performer slider via a mode flag
7. **Inconsistent backgrounds** — some popovers use glassmorphic `rgba(20,22,32,0.82)` + blur, PropPopover uses opaque `#0c0e16`

Bits UI (`bits-ui@^2.14.4`) is already installed and used for Dialog and DropdownMenu, but all viewer popovers are hand-rolled.

## Solution

Three independent subsystems, each fixing one category of band-aid.

---

## Subsystem 1: ViewerPopover — Bits UI Migration

### Architecture

Replace all 7 hand-rolled popovers with a shared `ViewerPopover` component built on Bits UI's `Popover` primitive.

**New file:** `src/lib/shared/3d/components/controls/ViewerPopover.svelte`

Wraps `Popover.Root` → `Popover.Trigger` → `Popover.Portal` → `Popover.Content` with the viewer's standard styling and behavior.

### Props

```typescript
interface ViewerPopoverProps {
  /** Which popover this is — used to sync with viewer.activePopover */
  id: PopoverId;
  /** Popover header title (e.g. "Formation", "Performer 1") */
  title: string;
  /** Optional accent color dot in header (performer color) */
  accentColor?: string;
  /** Content width in px */
  width?: number; // default 420
  /** Chip icon class (e.g. "fa-staff-snake") */
  icon: string;
  /** Chip tooltip text */
  tooltip: string;
  /** Whether this is a performer-scoped chip (uses accent tinting) */
  performerScoped?: boolean;
  /** Snippet: popover body content */
  children: Snippet;
  /** Snippet: optional footer (e.g. prop size slider) */
  footer?: Snippet;
}
```

### Bits UI Integration

```svelte
<Popover.Root bind:open={popoverOpen}>
  <Popover.Trigger asChild>
    {#snippet child({ props })}
      <button {...props} class="rail-chip" ...>
        <i class="fas {icon}"></i>
      </button>
    {/snippet}
  </Popover.Trigger>
  <Popover.Portal>
    <Popover.Content
      side="left"
      sideOffset={10}
      align="start"
      class="viewer-popover-content"
      onInteractOutside={handleInteractOutside}
      forceMount
    >
      {#snippet child({ wrapperProps, props, open })}
        {#if open}
          <div {...wrapperProps}>
            <div {...props} class="viewer-popover-panel"
              transition:scale={{ duration: 200, start: 0.92, easing: backOut }}>
              <header>...</header>
              {@render children()}
              {#if footer}{@render footer()}{/if}
            </div>
          </div>
        {/if}
      {/snippet}
    </Popover.Content>
  </Popover.Portal>
</Popover.Root>
```

### State Synchronization

Bits UI Popover manages its own `open` state. We sync bidirectionally with `viewer.activePopover`:

- **Open from viewer state:** `$effect` watches `viewer.activePopover === id` and sets `popoverOpen = true/false`
- **Close from Bits UI:** `onOpenChange` callback calls `viewer.closePopover()` when Bits UI closes (escape, click-outside)
- **Open from chip click:** existing `viewer.openPopover(id)` triggers the effect, which opens the Bits UI popover

This keeps `viewer.activePopover` as the single source of truth while Bits UI handles positioning, focus, and dismissal.

### Styling

All popovers get the same solid dark background:

```css
.viewer-popover-panel {
  width: var(--popover-width, 420px);
  border-radius: 18px;
  background: #0c0e16;
  border: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow: 0 12px 48px rgba(0, 0, 0, 0.7);
  overflow: hidden;
}
```

No glassmorphic blur. Solid opaque background for maximum content readability.

### RightRail Changes

RightRail.svelte simplifies from rendering chip + popover separately to rendering `<ViewerPopover>` which owns both:

```svelte
<!-- Before: chip button + separate popover component -->
<div class="chip-wrap">
  <button class="rail-chip" onclick={...}>...</button>
  <FormationPopover />
</div>

<!-- After: ViewerPopover owns both trigger and content -->
<ViewerPopover id="formation" title="Formation" icon="fa-users" tooltip="Formation">
  <FormationSelector ... />
</ViewerPopover>
```

The `chip-wrap` positioning hack goes away. Bits UI Portal handles z-index. The document-level click handler in RightRail's `onMount` is deleted — Bits UI `onInteractOutside` replaces it.

### What Each Popover Becomes

After migration, each popover file contains ONLY its unique content — no positioning, animation, escape, or styling boilerplate:

| Popover | Content |
|---------|---------|
| Formation | `<FormationSelector>` |
| Tempo | BPM slider + labels |
| Camera | Camera preset buttons |
| Planes | Plane visibility toggles |
| Export | Export options |
| Scene | Scene environment cards |
| Effects | `<MobileEffectsPanel layout="grid">` |
| Prop | Prop grid + variant strip + size slider |
| Effort | `<EffortPalette>` |

Each stays as a separate file for clarity — content components don't move directories, they just shed their positioning/animation/styling boilerplate.

---

## Subsystem 2: PropCompositionPreview Dark-Mode Support

### Problem

Prop SVGs (e.g. `staff.svg`) use hardcoded fill `#2e3192` (dark navy blue). On dark backgrounds this is near-invisible. Currently patched with per-consumer CSS `filter: brightness(1.8) saturate(1.4)`.

Canonical dark-mode colors from `mcp-server/StandalonePictographRenderer.ts`:
- Blue dark: `#3575E2` (bright)
- Blue light: `#3D44B8` (dark — current SVG fill `#2e3192` is even darker)
- Red dark: `#ED1C24`
- Red light: `#DC2626`

### Fix

Add a `darkBackground` prop to `PropCompositionPreview.svelte`:

```typescript
let {
  propType,
  size = 64,
  recipeOverride = undefined,
  darkBackground = false,  // NEW
}: Props = $props();
```

When `darkBackground` is true, apply a tuned CSS filter to the entire SVG:

```css
.prop-composition-preview.dark-bg {
  filter: brightness(1.8) saturate(1.4);
}
.prop-composition-preview.dark-bg:hover {
  filter: brightness(2.0) saturate(1.5);
}
```

The filter values are tuned once in this component. All consumers that set `darkBackground` get correct rendering. No more per-consumer brightness hacks.

### Consumers

| Consumer | Background | darkBackground |
|----------|-----------|----------------|
| PropPopover (viewer) | `#000` tiles on `#0c0e16` | `true` |
| PropIndicatorButton (create) | Theme-dependent | Read from theme |
| PropTypeButton (settings) | Theme-dependent | Read from theme |
| PropButtonLab (lab) | Theme-dependent | Read from theme |

### Why Not Inline SVG with CSS Variables

The SVGs are loaded via `<image>` tags (raster-like embedding in SVG). CSS custom properties cannot penetrate `<image>`. Switching to inline SVG injection would require:
- Fetching all 36 SVGs as text at runtime
- Regex-replacing fill values
- Changing PropCompositionPreview's rendering architecture

This is a larger initiative with higher risk for marginal visual gain over a well-tuned filter. The filter approach is the pragmatic correct choice for this rendering method.

---

## Subsystem 3: PropPopover Cleanup

### 3a. Registry-Driven Prop Categories

**Problem:** PropPopover hardcodes a `PROP_FAMILIES` array that duplicates and curates data the registry already has.

**Fix:** Add a `category` field to `PropTypeDisplayInfo` and a `PROP_CATEGORIES` ordered array to `PropTypeDisplayRegistry.ts`:

```typescript
export type PropCategory = "staves-clubs" | "curved" | "novelty" | "singles";

export interface PropTypeDisplayInfo {
  label: string;
  image: string;
  category?: PropCategory; // Only needed on base props
}

export const PROP_CATEGORIES: { id: PropCategory; label: string }[] = [
  { id: "staves-clubs", label: "Staves & Clubs" },
  { id: "curved",       label: "Curved Props" },
  { id: "novelty",      label: "Novelty" },
  { id: "singles",      label: "Singles" },
];
```

Each base prop gets a `category` in its registry entry. Variant props inherit from their base.

New registry export:

```typescript
export function getBasePropsByCategory(): Map<PropCategory, PropType[]> {
  // Returns base props grouped by category, filtered by isPropActive
}
```

PropPopover derives its grid from this function instead of a hardcoded array.

### 3b. Dedicated PerformerPropSizeSlider

**Problem:** `PropSizeControl` does double duty as global (linked) and per-performer (individual) slider via `forceIndividual` flag. The per-performer popover should never show global controls.

**Fix:** New component `PerformerPropSizeSlider.svelte` (~30 lines):

```svelte
<script lang="ts">
  import { inchesToCm } from "@austencloud/scene-3d";
  import type { AvatarInstanceState } from "../../state/avatar-instance-state.svelte";

  let { performer }: { performer: AvatarInstanceState } = $props();

  const currentCm = $derived(performer.settings.staffLengthCm ?? 81); // default 32in
  const displayInches = $derived(Math.round(currentCm / 2.54));
</script>

<div class="prop-size">
  <span class="label">Prop size</span>
  <span class="value">{displayInches} in</span>
  <input type="range"
    min={inchesToCm(24)} max={inchesToCm(60)} step="1"
    value={currentCm}
    oninput={(e) => performer.setStaffLengthCm(Number(e.currentTarget.value))}
  />
</div>
```

No link toggle. No global mode. No `forceIndividual`. Just a slider that sets one performer's prop size.

PropPopover uses `PerformerPropSizeSlider`. The existing `PropSizeControl` stays unchanged for any context that needs the linked/global behavior (if any still exists — if not, it gets deleted).

### 3c. PropPopover Content

After subsystems 1-3b, PropPopover becomes pure content inside a `<ViewerPopover>`:

- Prop grid derived from `getBasePropsByCategory()` 
- Variant strip (existing pattern, moved outside scroll area — already done)
- `PerformerPropSizeSlider` in footer slot
- `darkBackground` on all `PropCompositionPreview` instances
- No positioning, animation, escape handling, header, or background styling

---

## Files Changed

### New Files
- `src/lib/shared/3d/components/controls/ViewerPopover.svelte` — Bits UI popover wrapper
- `src/lib/shared/3d/components/controls/PerformerPropSizeSlider.svelte` — per-performer size slider

### Modified Files
- `src/lib/shared/sequence-viewer/components/RightRail.svelte` — use ViewerPopover, delete document click handler
- `src/lib/shared/pictograph/prop/domain/PropTypeDisplayRegistry.ts` — add `PropCategory`, `category` field, `getBasePropsByCategory()`
- `src/lib/shared/pictograph/prop/components/PropCompositionPreview.svelte` — add `darkBackground` prop + CSS class
- `src/lib/shared/3d/components/controls/PropPopover.svelte` — rewrite as content-only, use registry-driven categories

### Migrated Files (become content-only or inlined)
- `src/lib/shared/3d/components/controls/EffectsPopover.svelte`
- `src/lib/shared/3d/components/controls/EffortPopover.svelte`
- `src/lib/shared/3d/components/controls/FormationPopover.svelte`
- `src/lib/shared/3d/components/CameraPopover.svelte`
- `src/lib/shared/3d/components/PlanesPopover.svelte`
- `src/lib/shared/3d/components/SceneSelectorPopover.svelte`
- `src/lib/shared/sequence-viewer/components/TempoPopover.svelte`
- `src/lib/shared/sequence-viewer/components/ExportPopover.svelte`

### Possibly Deleted
- `src/lib/shared/sequence-viewer/components/PropSizeControl.svelte` — if no remaining consumers after PerformerPropSizeSlider replaces its only use

---

## What This Does NOT Include

- No drawer/panel migration — popovers stay as the pattern
- No SVG asset duplication or modification
- No responsive/mobile breakpoints
- No new keyboard navigation within prop grid
- No changes to performer state model or PerformerRail
- No changes to effects, effort, or formation content components — only their popover wrappers

---

## Success Criteria

1. All 7 popovers render via Bits UI with automatic viewport-aware positioning
2. Zero hand-rolled `position: absolute; right: calc(100% + 10px)` in the codebase
3. PropCompositionPreview renders clearly on both light and dark backgrounds via `darkBackground` prop
4. PropPopover derives families from PropTypeDisplayRegistry, not a hardcoded array
5. No `forceIndividual` flag — per-performer slider is its own component
6. Focus trapping works on all popovers (Bits UI built-in)
7. Escape and click-outside dismissal work (Bits UI built-in)
8. `npm run check` passes with no new errors
