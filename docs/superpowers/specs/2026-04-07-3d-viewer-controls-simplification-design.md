# 3D Viewer Controls Simplification

**Date:** 2026-04-07
**Status:** Approved
**Mockups:** `.superpowers/brainstorm/33707-1775590593/content/final-design-v2.html`

## Problem

The 3D viewer overlay in the Sequence Viewer has 10+ interactive controls competing for attention:
- **Top right:** Grid button, DW toggle, blue/red Wall dropdowns, ALL/beat toggle, reset button
- **Bottom right:** Learn/Mirror toggle, Main/Side/Top/3/4 camera presets, tooltip text

On mobile (where the 3D viewer is half-screen height), this is overwhelming and confusing. The controls obscure the animation and create cognitive overload.

## Design Decisions

### 1. Remove Learn/Mirror Toggle Entirely

**What:** Delete the Learn/Mirror mode concept from the 3D viewer. Colors always match the performer's actual hands — blue is always blue-hand, red is always red-hand, regardless of camera angle.

**Why:** Mirror mode swaps colors so the performer's left hand shows red, which looks like a bug. Users expect color consistency. If someone orbits to face the performer, they see the front naturally — no mode switch needed.

**Impact:**
- Remove `Viewer3DViewPresets.svelte` mode toggle and sublabel tooltip
- Remove `mirrorMode` state and `setMirrorMode()` from viewer3D state
- Remove color-swap logic that was triggered by mirror mode
- Camera presets no longer have learn/mirror position variants — one position per preset
- The "Main" preset defaults to behind the performer (current "learn" position)
- A "Front" preset is added for viewing the performer face-on (current "mirror" main position), but without any color swap

### 2. Half-Screen: Gear Icon Only

**What:** Replace all top-right controls (Grid, DW, plane selects, ALL) and bottom-right controls (camera presets) with a single gear icon (28x28px) in the top-right corner.

**Gear popover contents (when tapped):**
- **Camera** section: Main | Side | Top | 3/4 preset buttons
- **Grid Planes** section: Wall, Wheel, Floor toggles with colored dots and checkmarks

**What's NOT in the gear popover:**
- DW / Plane mode controls — moved to the Settings sheet (accessed from full-screen bottom panel). This is an advanced feature that doesn't need viewport presence.
- Learn/Mirror — removed entirely (see decision 1).

### 3. Tap to Expand to Full-Screen

**What:** Tapping (not dragging) the 3D scene expands it to full-screen, same gesture as the 2D animation viewer. Drag continues to orbit the camera. Long-press keeps its existing behavior.

**Why:** In 2D mode, tapping the animation expands to the download/export view. The 3D viewer currently consumes taps for orbit controls, but orbit only needs drag — tap does nothing useful today. Making tap = expand creates a consistent mental model across 2D and 3D.

**Implementation:** The orbit controls (Threlte `<OrbitControls>`) already distinguish between drag and tap. We need to intercept `click` events (mousedown + mouseup without significant movement) on the canvas wrapper and trigger the expand transition instead of passing them to OrbitControls.

### 4. Full-Screen: Controls Shown Directly

**What:** In full-screen mode, the gear icon disappears. Camera presets and grid controls are shown directly on the viewport (top-right) because there's enough room.

**Viewport overlays (top-right):**
- Grid button (same as current, with popover for plane toggles)
- Camera preset bar: Main | Front | Side | Top | 3/4

**Back button (top-left):** Returns to half-screen view.

**Beat number** (top-center) and **letter** (bottom-left) remain as-is.

### 5. Unified Bottom Panel (2D and 3D)

**What:** The full-screen bottom panel is the same component in both 2D and 3D modes. It contains:

1. **Transport controls:** Previous, step back, play/pause, step forward, next
2. **BPM row:** Minus, BPM display, plus, separator, Slow/Med/Fast presets
3. **Action buttons:** Effects | Settings | Share

**Effects** opens a sheet for fire, LED, trails, charcoal toggles.
**Settings** opens the existing animation settings sheet (FPS, loop count, overlays, and now also DW/plane mode for 3D).
**Share** triggers the export/download flow.

This panel is identical whether the viewport shows a 2D pictograph animation or a 3D scene. The only difference is what's on the viewport itself.

### 6. Compact Touch Targets for Viewport Overlays

**What:** Introduce `--min-touch-target-compact: 32px` for controls that float on the 3D viewport (gear icon, camera presets, grid button). The standard `--min-touch-target: 44px` remains the default for all other UI.

**Why:** 44px overlay buttons on a half-screen 3D viewport consume too much of the limited scene area. 32px with 8px spacing is the standard for video player and map app overlay controls. The bottom panel actions (Effects, Settings, Share) stay at 44px since those are primary actions in a dedicated control area.

**Scope:** Only applies to viewport overlay controls in the 3D viewer. All other buttons, toggles, and interactive elements in the app continue to use 44px.

## Component Changes

### Files to Modify

| File | Change |
|------|--------|
| `Viewer3DCanvas.svelte` | Replace top-controls with gear icon component; add tap-to-expand handler; conditionally show gear vs direct controls based on full-screen state |
| `Viewer3DViewPresets.svelte` | Remove Learn/Mirror toggle and sublabel; keep camera presets only; simplify to single position set (no learn/mirror variants) |
| `Viewer3DGridPopover.svelte` | No structural change — used inside gear popover in half-screen, shown directly in full-screen |
| `PlaneModeToggle.svelte` | Remove from viewport overlay; move into Settings sheet |
| `viewer-3d-state` | Remove `mirrorMode`, `setMirrorMode()`; remove mirror camera position variants |
| `ViewerSplitPane.svelte` | Add full-screen state management; handle tap-to-expand transition |

### New Components

| Component | Purpose |
|-----------|---------|
| `Viewer3DGearPopover.svelte` | Gear icon + popover containing camera presets and grid planes (half-screen only) |
| `Viewer3DFullScreenPanel.svelte` | Bottom panel for full-screen mode — wraps the existing `AnimationControlsPanel` / `ExportActionsPanel` components to maintain consistency with 2D |

### CSS Variable Addition

```css
:root {
  --min-touch-target-compact: 32px; /* viewport overlay controls only */
}
```

## State Transitions

```
Half-screen (default)
  ├── Tap gear → popover opens (camera presets, grid toggles)
  ├── Tap scene → Full-screen
  └── Drag scene → orbit camera

Full-screen
  ├── Tap back arrow → Half-screen
  ├── Drag scene → orbit camera
  ├── Tap Grid → grid plane popover
  ├── Tap camera preset → snap camera
  ├── Tap Effects → effects sheet
  ├── Tap Settings → settings sheet (includes DW/plane mode)
  └── Tap Share → export/download flow
```

## Out of Scope

- **Export flow redesign:** The bottom panel reuses existing export components. A unified export redesign (for both 2D and 3D) is a separate task.
- **DW / Dual Wheel as a primary feature:** Moved to Settings sheet. If usage data shows it's accessed frequently, it can be promoted later.
- **Desktop layout:** This spec focuses on mobile. Desktop has more room and can show controls directly without the gear/full-screen pattern. Desktop changes should be minimal — primarily removing Learn/Mirror.
