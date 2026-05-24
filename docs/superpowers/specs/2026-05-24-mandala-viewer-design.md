# Mandala Viewer — Design Spec

## Summary

A new content pane in the sequence viewer that displays the current sequence's mandala with real-time breathing animation and path shape controls. The mandala undulates (tip dx oscillates 0–250 on a breathe easing curve) while rotating, creating a meditative visual. A right-edge settings panel — same pattern as ExportVideoDrawer — lets users select path shape, easing curve, rotation, and timing.

## Location in Architecture

- **ContentType:** Add `"mandala"` to the `ContentType` union in `viewer-state-persistence.ts`
- **PaneContentSelector:** Add mandala option (`fa-dharmachakra` icon, "Mandala" label)
- **Main content area:** Full-pane `SequenceMandala` component with animation active
- **Right panel:** `MandalaViewerControls.svelte` — collapsed by default, expands with settings

## Default Behavior (Zero Config)

When user selects the Mandala pane:
- Mandala begins breathing immediately (no play button needed)
- Easing: `breathe` (fast expand, slow contract)
- Path shape: `arc`
- Rotation: 90° per cycle
- Period: 5 seconds
- Range: dx 0–250
- Size: fills available pane width (responsive)

## Right Panel — MandalaViewerControls

Layered disclosure pattern:

### Always Visible
- **Path Shape** — 4 buttons: Arc / Linear / Concave / Motion Aware
- **Pause/Play** — toggle button (animation runs by default)

### Expandable "Tune" Section
- **Easing** — button group: Sine, Ease, Soft Elastic, Breathe (default), Heartbeat, Drift, Bloom, Tidal
- **Rotation** — button group: None, 45°, 90° (default), 180°, 360°
- **Period** — slider or number input, 1–20s (default 5)
- **Range** — min/max dx inputs (default 0–250)

### Export Section
- **Download SVG** — static snapshot at current dx/path shape
- **Download GIF** — animated loop (one full breath cycle)

## Component Structure

```
src/lib/shared/sequence-viewer/components/
  MandalaPane.svelte              — full-pane wrapper, manages size/layout
  MandalaViewerControls.svelte    — right panel with settings
```

`MandalaPane` renders `SequenceMandala` with:
```svelte
<SequenceMandala
  {sequence}
  animate={!paused}
  animateMin={range.min}
  animateMax={range.max}
  animatePeriod={period}
  animateEasing={selectedEasing}
  animateRotation={rotation}
  pathShape={selectedPathShape}
  size={paneSize}
/>
```

## Data Flow

1. Sequence comes from existing viewer state (`viewerState.sequence`)
2. All mandala settings are local component state (not persisted)
3. Path shape passed as `MandalaPathOptions` to calculator via the existing `pathShape` prop on `SequenceMandala`

## Path Shape Details

Already implemented in `MandalaGeometryCalculator`:
- **Arc** — `lerpAngle` circular interpolation between positions (default, what all mandalas show today)
- **Linear** — straight-line interpolation in Cartesian space (angular/geometric look)
- **Concave** — mirror of arc: `2*linear - arc` (inward-bowing curves)
- **Motion Aware** — pro motions use arc, anti motions use concave (asymmetric per direction)

Note: dash motions always use linear interpolation regardless of path shape setting. Static motions render as points. Only shift motions (pro/anti) are affected by path shape.

## Responsive Sizing

- Mandala `size` prop = `min(paneWidth, paneHeight) - padding`
- On narrow viewports (mobile), controls collapse to a bottom sheet instead of right panel (same `PanelLayout` pattern as ExportVideoDrawer)

## Phase 3 Future: Path Shape Morphing

Architectural path for interpolating between path shapes within a single breath:
- `generatePathPoints()` already produces point arrays per tip
- Generate points for both source and target path shapes
- Lerp between the two point arrays using a morph parameter (0 = source shape, 1 = target shape)
- This requires both shapes to produce the same number of sample points (already guaranteed since `samplesPerBeat` is constant)

Not in scope for initial implementation but the data structures support it.

## What's NOT in Scope

- "Fresh" meditation mode (cycling through different sequences per breath) — requires collection/playlist context, separate feature
- Audio cues / haptic feedback
- Path shape morphing (Phase 3 noted above)
- Saving mandala animation settings to user preferences
