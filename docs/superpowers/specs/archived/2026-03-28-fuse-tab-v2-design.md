---
status: archived
value: 3
effort: L
remaining: ""
depends_on: ""
plan_path: plans/backlog/2026-03-28-fuse-tab-v2.md
tags: []
superseded_by: docs/superpowers/specs/2026-07-20-fuse-mixer-design.md
last_triaged: 2026-07-29
---
# Fuse Tab v2 — Single Component with Assemble/Disassemble States

**Date:** 2026-03-28
**Status:** Archived as superseded (verified 2026-07-29)

> **Queue closeout:** This v2 was reverted and its FLIP model was explicitly recorded as failed. The July Fuse-as-a-Mixer design (`65af4c3175`) replaced the interaction model and is the current lineage.

## Problem

The current Fuse tab swaps between two entirely separate components (`FuseLayout` and `FuseResultView`) based on phase. This causes:

- Hard DOM swap when fusing — canvases are destroyed and recreated, making smooth animation impossible
- A visible gap/flash between the merge animation ending and the result view appearing
- The result view borrows `AnimatorCanvas` and `ChoreoCard` from other contexts without feeling native
- "Disassemble" and "Build Another" both do `fuseState.reset()` with no meaningful distinction

## Mental Model

The Fuse tab is one pictograph that starts disassembled. The two split canvases (blue-only, red-only) are the two halves. The beat grids above each canvas let you browse/shuffle which half you want. Clicking Fuse reassembles the pictograph. Clicking "Swap a Half" disassembles it again with the same sequences loaded.

There is no "result view" — just assembled vs disassembled states of the same component.

## Architecture

### Single Component Lifecycle

`FuseTab` renders one component (`FuseLayout`) that manages the entire lifecycle. No phase-based component swap.

**Three AnimatorCanvas instances are always mounted:**
- **Hero canvas** — shows both props (blue + red). Hidden when disassembled via `visibility: hidden; position: absolute` at assembled-state dimensions so `getBoundingClientRect()` returns the real target rect for FLIP calculation. Visible when assembled.
- **Blue-only canvas** — shows only blue prop (`redProp={null}`). Visible when disassembled, hidden when assembled.
- **Red-only canvas** — shows only red prop (`blueProp={null}`). Visible when disassembled, hidden when assembled.

All three are driven by the fuse clock's `currentStep` via props. The hero canvas should have its internal rAF paused when hidden to avoid GPU work on an invisible canvas — pass `isPlaying={false}` when in disassembled state. The two split canvases share the fuse clock for synchronized playback.

### Sequence Selection

Sequence selection tracking remains as local component state in `FuseLayout` (`leftBrowsingSeq` / `rightBrowsingSeq`), outside the state machine. The Fuse button's disabled state is derived from whether both panel sequences are non-null, same as today. The state machine does not need selection substates.

### Visual States

| State | Hero Canvas | Split Canvases | Beat Grids | Choreo Card | Bottom Bar |
|-------|-------------|----------------|------------|-------------|------------|
| Disassembled | Mounted at assembled-state dimensions, `visibility: hidden; position: absolute` | Visible, large, side-by-side | Visible above each canvas | Hidden | Fuse button, beat length, bpm |
| Reassembling | FLIP-animating to final position, `visibility: visible` | FLIP-animating toward hero, fading out last 25% | Fading out (200ms) | Hidden | Disabled |
| Assembled | Visible, left side | `visibility: hidden; position: absolute` | Hidden | Visible, right side | Save, Build Another, Viewer, Swap a Half |
| Disassembling | FLIP-animating from final to center | FLIP-animating from hero to sides, fading in first 25% | Fading in (200ms) | Sliding out | Disabled |

### State Machine

```
disassembled → (click Fuse) → reassembling → assembled
assembled → (click Swap a Half) → disassembling → disassembled
assembled → (click Build Another) → disassembling → disassembled (reset sequences on completion)
```

During `reassembling` and `disassembling` states, all action buttons are disabled. The state machine only accepts transitions from `disassembled` or `assembled`.

"Build Another" routes through the `disassembling` animation and resets sequences after the animation completes, so there is no hard cut.

### FLIP Target Measurement

The hero canvas container always occupies its assembled-state position via `position: absolute` with the correct assembled-layout dimensions, but with `visibility: hidden`. This means `getBoundingClientRect()` returns the real target rect at any time, even while in disassembled state. No phantom elements or mathematical calculation needed.

When reassembly begins:
1. Measure split canvas rects (they're visible, normal flow)
2. Measure hero canvas rect (it's invisible but positioned correctly)
3. Calculate FLIP transforms and animate

### Resize Observation During Animation

Set `resizePaused={true}` on all three `AnimatorCanvas` instances during `reassembling` and `disassembling` states. This prevents `ResizeObserver` from clearing canvas buffers during the FLIP transforms (which change element dimensions). Resume `resizePaused={false}` after the animation's `.finished` resolves.

### Fuse Transition Choreography (Reassemble)

**Total: ~1000ms, staggered phases (some overlap):**

1. **Beat grids fade out (0-200ms):** Both beat grid areas and shuffle bars animate opacity 1→0. Starts immediately on Fuse click.

2. **Split canvases reassemble (100-700ms):** Using FLIP technique (same as `DisassembleTransition`):
   - Measure current rects of blue-only and red-only canvases
   - Measure target rect from hero canvas container (always measurable, see above)
   - Animate blue-only and red-only with `translate + scale` toward hero rect
   - Fade out blue-only and red-only during last 25% of the 600ms animation
   - Set hero canvas to `visibility: visible` at animation start
   - Hero canvas simultaneously FLIP-animates from the assembled rect to its natural position (identity transform — it becomes visible as the splits fade into it)
   - Overlaps with grid fade by 100ms for continuous motion

3. **Choreo card enters (700-1000ms):**
   - Hero canvas is now in its assembled position (left side on desktop)
   - Choreo card slides in from the right (opacity 0→1, translateX 30px→0) over 200ms
   - Bottom bar transitions to assembled actions

### Reverse Transition (Disassemble / "Swap a Half")

Exact reverse of reassemble:

1. **Card exits (0-200ms):** Slides out to the right
2. **Hero disassembles into splits (200-800ms):** FLIP in reverse — hero scales toward center while blue-only and red-only FLIP from hero rect to their side-by-side positions, fading in during first 25%. Set split canvases to `visibility: visible` at animation start.
3. **Beat grids fade in (700-900ms):** Both grids and shuffle bars fade in
4. **On completion:** Hero canvas back to `visibility: hidden`. If triggered by "Build Another", reset sequences and clear browse state.

Sequences stay loaded (unless "Build Another" triggered the disassembly). User can shuffle one side and fuse again.

### Layout — Disassembled State

```
┌─────────────────────────────────────────────────┐
│ ┌──────────────────┐  ┌──────────────────┐      │
│ │ Beat Grid (blue) │  │ Beat Grid (red)  │      │
│ │ 3x3 pictograph   │  │ 3x3 pictograph   │      │
│ │ cells, scrollable │  │ cells, scrollable │      │
│ └──────────────────┘  └──────────────────┘      │
│ ┌──────────────────┐  ┌──────────────────┐      │
│ │ Blue-only canvas │  │ Red-only canvas  │      │
│ │ (AnimatorCanvas, │  │ (AnimatorCanvas, │      │
│ │  square)         │  │  square)         │      │
│ └──────────────────┘  └──────────────────┘      │
│ [ Shuffle 1/98 ]       [ Shuffle 1/98 ]         │
│                                                  │
│         [ 8 beats ] [ 60 bpm ] [ 🔥 Fuse ]      │
└─────────────────────────────────────────────────┘
```

Two equal columns. Each column: beat grid (top), animation canvas (middle, square), shuffle bar (bottom). Bottom bar centered.

The hero canvas is mounted at its assembled-state position (`visibility: hidden; position: absolute`) overlapping the left column area. It does not affect layout flow.

**Responsive (< 600px):** Columns stack vertically.

### Layout — Assembled State

```
┌─────────────────────────────────────────────────┐
│              blue + red  8 beats                 │
│ ┌────────────────────┐  ┌──────────────────────┐│
│ │                    │  │ Start │  1  │  2  │  3││
│ │   Hero Canvas      │  │───────┼─────┼─────┼──││
│ │   (both props,     │  │  4   │  5  │  6  │   ││
│ │    square,         │  │───────┼─────┼─────┼──││
│ │    max-width 600px)│  │  7   │  8  │     │   ││
│ │                    │  │ (ChoreoCard)       │  ││
│ └────────────────────┘  └──────────────────────┘│
│                                                  │
│  [ Save ] [ Build Another ] [ Viewer ] [← Swap] │
└─────────────────────────────────────────────────┘
```

Hero canvas on left (constrained, max-width 600px). ChoreoCard on right with beat highlighting synced to playback. Bottom bar with action buttons.

Split canvases are `visibility: hidden; position: absolute` at their disassembled-state positions for FLIP measurement.

**Responsive (< 600px):** Canvas on top, card below.

### FLIP Animation Implementation

The FLIP technique is lifted from `DisassembleTransition`:

```typescript
function calcFlipTransform(sourceRect: DOMRect, targetRect: Rect) {
  return {
    tx: targetCenterX - sourceCenterX,
    ty: targetCenterY - sourceCenterY,
    sx: targetRect.width / sourceRect.width,
    sy: targetRect.height / sourceRect.height,
  };
}
```

All three canvases are measured via `getBoundingClientRect()`. Hidden elements use `visibility: hidden` (not `display: none`) so their rects are always measurable.

Web Animations API with `fill: "both"`, cleaned up via `cancelAllAnimations()` after `.finished` resolves.

600ms duration, `cubic-bezier(0.16, 1, 0.3, 1)` easing — same as existing `DisassembleTransition`.

Respects `prefers-reduced-motion` by skipping animation and calling completion immediately.

## Tour Integration

Tour logic moves into the rewritten `FuseLayout` unchanged. The tour state is orthogonal to assembled/disassembled state. Key detail: `tourFuseCompleted` should be set after the reassemble animation finishes (i.e., when state reaches `assembled`), not immediately after clicking Fuse. This ensures the "Let's go" button appears after the user sees the assembled result.

## Files

### Delete

| File | Reason |
|------|--------|
| `src/lib/features/fuse/components/FuseResultView.svelte` | Replaced by assembled state in FuseLayout |
| `src/lib/features/fuse/services/implementations/FuseAssemblyAnimator.ts` | FLIP animation lives in FuseLayout now |
| `src/lib/features/fuse/services/contracts/IFuseAssemblyAnimator.ts` | No longer needed |
| `src/lib/features/fuse/components/CelebrationOverlay.svelte` | Cut for now |

### Modify

| File | Changes |
|------|---------|
| `FuseTab.svelte` | Remove phase-based swap. Always render FuseLayout. |
| `FuseLayout.svelte` | Complete rewrite — single component with assembled/disassembled states, FLIP animation, three AnimatorCanvas instances, ChoreoCard integration |
| `fuse-state.svelte.ts` | Simplify phases to `disassembled`, `reassembling`, `assembled`, `disassembling`. Remove `goBackToBrowse`. Keep `reset` for Build Another (routes through disassemble first). |

### Reuse (no changes)

| Component | Role |
|-----------|------|
| `AnimatorCanvas` | All three canvas instances (hero, blue-only, red-only) |
| `ChoreoCard` | Beat grid in assembled state |
| `FusePanel` | Browse/shuffle UI in disassembled state (wraps beat grid + shuffle) |
| `FuseSequenceBrowser` | Sequence browsing within each panel |

## DI Container Changes

Remove `fuseAssemblyAnimator` registration from the fuse container. The FLIP animation is internal to `FuseLayout`, not a service.

## Button Behavior

| Button | Action |
|--------|--------|
| **Fuse** | Triggers reassemble transition. Computes fused sequence, then animates. Disabled during transitions. |
| **Save** | Saves fused sequence to library (existing save flow). |
| **Build Another** | Triggers disassemble transition, then resets sequences on completion. |
| **Open in Viewer** | Navigates to sequence viewer with fused sequence. |
| **Swap a Half** | Triggers disassemble transition. Sequences stay loaded. |

All buttons disabled during `reassembling` and `disassembling` states.

## Right-Click Disassemble

The `AnimatorCanvas` context menu's "Disassemble" option (in assembled state) triggers the same disassemble transition as "Swap a Half". They are the same action.

## Testing

No new unit tests needed — the FLIP animation is visual and tested via manual verification. The fuse algorithm (`SequenceFuser`) already has tests. The `HandPathFactory` length fix has an updated test.

## What This Does NOT Change

- `DisassembleTransition.svelte` — untouched, used only by the sequence viewer
- `SequenceFuser` — untouched (the 8→9 beat fix was already applied separately)
- Browse/shuffle UX — `FusePanel` and `FuseSequenceBrowser` stay the same
