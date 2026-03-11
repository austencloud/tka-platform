# Decompose Lab Tab — Design Spec

**Date:** 2026-03-10
**Status:** Approved

## Concept

A learning tool that plays a sequence continuously across three synchronized canvases. The hero canvas shows the user's current focus; two smaller canvases below show the other two views. Tapping a small canvas swaps it into the hero slot — they trade places with a smooth animation while playback continues uninterrupted.

## Three Views

| View | Renders | Default Slot |
|------|---------|--------------|
| Both | Normal dual-prop rendering | Hero |
| Blue | Blue hand path only | Small left |
| Red | Red hand path only | Small right |

## Layout

**Desktop:** Hero canvas full width on top. Two smaller canvases below, side by side.

**Mobile:** Same vertical arrangement. Hero stacks on top, two small squares below.

## Interaction

- Tap/click a small canvas to swap it with the hero (~300ms smooth transition)
- Animation keeps playing through the swap — no pause, no restart
- All three canvases stay in sync at all times
- Swap is purely a slot reassignment + CSS transition on containers

## Effects

All effect modes available: Trails, Fire, Charcoal, LED. The Decompose tab imports effect renderers (TrailRenderer, FireRenderer, etc.) directly from the shared animation engine layer — not from the Effects Lab module. Each canvas applies effects to whichever props it renders. Effect tuning controls (mode bar, intensity sliders, etc.) are embedded in the Decompose tab's own controls panel, reusing the same control components the Effects Lab uses.

## Source

Reuses the `SourceControls.svelte` component from Effects Lab. This component needs to be extracted to a shared location (e.g., `src/lib/shared/animation-engine/components/SourceControls.svelte`) so both Effects Lab and Decompose can import it without cross-module dependency. The component's callback props (`onPick`, `onSkip`, `onShuffle`, `isChainingNow`) will be wired to Decompose's own state.

## Initial State

When the tab opens, all three canvases are empty (no sequence loaded). The Source panel is visible, prompting the user to pick a sequence, select from library, or start infinite mode. Tapping a small canvas while no sequence is loaded does nothing.

## Architecture

### New Files

- `src/lib/features/decompose-lab/DecomposeLab.svelte` — Module root, layout, slot state
- `src/lib/features/decompose-lab/components/DecomposeCanvas.svelte` — Wrapper around AnimatorCanvas with hand filter
- `src/lib/features/decompose-lab/components/DecomposeLayout.svelte` — Hero + small grid with swap transitions
- `src/lib/features/decompose-lab/components/DecomposeControls.svelte` — Source + effect tuning controls
- `src/lib/features/decompose-lab/state/decompose-state.svelte.ts` — Slot assignments, swap logic, active effect mode
- `src/lib/features/decompose-lab/context/decompose-context.ts` — Context distribution

### State Factory Shape

```typescript
function createDecomposeState(deps) {
  let heroView = $state<"both" | "blue" | "red">("both");
  let smallLeftView = $state<"both" | "blue" | "red">("blue");
  let smallRightView = $state<"both" | "blue" | "red">("red");

  function swapWithHero(slot: "left" | "right") {
    // Swap the clicked slot's view with the hero view
  }

  return {
    get heroView() { return heroView; },
    get smallLeftView() { return smallLeftView; },
    get smallRightView() { return smallRightView; },
    swapWithHero,
  };
}
```

DI services (animation engine services, effect renderers) are passed as `deps` arguments per the Factory + Context pattern.

### Playback Synchronization

A single `requestAnimationFrame` loop drives all three canvases. The Decompose module owns one shared playback clock (frame counter / timestamp). Each canvas receives the current frame and renders its filtered view. This avoids drift between canvases and is cheaper than three independent rAF loops.

Implementation: a single `DecomposePlaybackLoop` that calls `renderFrame(timestamp)` on each of the three canvas renderers sequentially within one rAF callback.

### Hand Filtering in the Canvas Pipeline

The animation engine renders to `<canvas>` (Canvas2D), not SVG. The `visibleHand` prop on `PictographRenderer` is for static SVG pictographs only. For the animated canvas pipeline, hand filtering happens at the render layer: `DecomposeCanvas` wraps `AnimatorCanvas` and passes a `handFilter` option that tells the engine's render loop to skip drawing props/arrows/effects for the excluded hand. This is a new parameter on the render pipeline, not the static pictograph renderer.

### Key Decisions

1. **One rAF loop, three canvas renders** — shared playback clock, no drift
2. Each canvas gets a `handFilter`: `"both"` | `"blue"` | `"red"`
3. Swap is a reactive state change (which filter occupies which slot) + CSS transition on canvas containers
4. `SourceControls` extracted to shared so both Effects Lab and Decompose can use it
5. Effect renderers imported from shared animation engine layer, not from Effects Lab module

### Integration Points

- Register in `moduleLoaders` in `ModuleRenderer.svelte`
- Add to `MODULE_DEFINITIONS` in `module-definitions.ts`
- No new DI container needed initially — reuses existing animation engine services

### Existing Building Blocks

- `AnimatorCanvas.svelte` — canvas wrapper (reuse directly)
- `AnimationEngine.svelte.ts` — orchestration (needs `handFilter` support added to render loop)
- `PropPositionCalculator` — per-frame position computation
- Effect renderers (TrailRenderer, FireRenderer, etc.) — work on rendered prop positions
- `SourceControls.svelte` — sequence picker (extract to shared)
- `ViewerSplitPane.svelte` — reference for multi-canvas layout patterns

### Performance

One rAF loop rendering three canvases sequentially. The two isolated canvases each render ~half the props of the combined view, so total render work is roughly 2x a single full render. `FrameBudgetMonitor` already exists. If frame budget is tight, small canvases can render at reduced resolution.
