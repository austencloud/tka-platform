# Audit: Mandala Formations Phase 5 Design Spec

**Spec:** `docs/superpowers/specs/2026-05-25-mandala-phase5-formations-design.md`
**Auditor:** Claude Opus 4.6
**Date:** 2026-05-25

---

## VERDICT

**Conditional Approve** -- strong design with one critical rendering bug and two important performance issues that must be resolved before implementation.

---

## STRENGTHS

1. **Single-canvas compositing is the correct call.** The spec correctly identifies that N SVG elements with filter passes would bust the frame budget. The Canvas 2D approach avoids DOM thrash and SVG filter overhead entirely.

2. **FormationSlot abstraction is clean.** Reducing all formation types to `{ x, y, scale, phaseOffset, sequenceId? }` makes the layout engine a pure function with a single output contract. This is testable, serializable, and extends to freeform layouts in Phase 6 without architecture changes.

3. **Phase offset system is well-designed.** Six modes with a single master clock and `effectivePhase_i = ((masterTime / period) + phaseOffset_i) % 1` is elegant. The decision to share period across all slots in Phase 5 (individual speed overrides deferred) keeps the wave coherent and avoids a combinatorial explosion of timing edge cases.

4. **Formation-level transforms via CSS.** Separating formation rotation/scale/translate as CSS transforms on the canvas container (GPU-composited) while canvas handles per-mandala rendering is a clean separation of concerns.

5. **Correct identification of the Path2D bottleneck.** The spec pinpoints `new Path2D(d)` as the real cost, not the canvas draw calls themselves. This matches Chrome's profile behavior -- Path2D parsing from SVG `d` strings is the expensive step.

6. **The caching strategy is sound in principle.** Collapsing N path computations to 1 in synchronized mode via `sequenceId:tipDxInt` keys is correct. The integer rounding for tipDx is a reasonable precision/cache-hit tradeoff.

7. **Export path reuses existing infrastructure.** The h264-mp4-encoder pipeline is already proven in `MandalaPane.svelte`'s export. Scaling it to formations is mechanical.

---

## ISSUES

### CRITICAL

#### C1: `renderMandalaToCanvas` does NOT use `tipDx` for viewBox scaling -- paths will clip at large dx values

**Evidence:** `mandala-renderer.ts` line 235:
```typescript
const tipReach = MANDALA_STANDARD_TIP_DX * MANDALA_GRID_RADIUS / ENGINE_GRID_RADIUS;
```

The canvas renderer hardcodes `MANDALA_STANDARD_TIP_DX` for its scale computation. Compare with `renderMandalaSVG` at line 100:
```typescript
const effectiveTipDx = Math.max(options.tipDx ?? MANDALA_STANDARD_TIP_DX, MANDALA_STANDARD_TIP_DX);
const tipReach = effectiveTipDx * MANDALA_GRID_RADIUS / ENGINE_GRID_RADIUS;
```

The SVG renderer scales the viewBox to accommodate the current tip distance. The canvas renderer does not. When `tipDx` exceeds `MANDALA_STANDARD_TIP_DX`, mandala tips will be drawn outside the computed scale bounds and clipped. The spec assumes parity between renderers that does not exist.

**Fix required:** Port the `tipDx`-aware scaling from `renderMandalaSVG` to `renderMandalaToCanvas` before Phase 5 implementation begins. This is a one-line change (replace `MANDALA_STANDARD_TIP_DX` with `Math.max(options.tipDx ?? MANDALA_STANDARD_TIP_DX, MANDALA_STANDARD_TIP_DX)` in the canvas renderer).

### IMPORTANT

#### I1: Hidden per-call OffscreenCanvas allocation in overlap rendering will destroy frame budget at N>8

**Evidence:** `mandala-renderer.ts` lines 291-292:
```typescript
const maskB = new OffscreenCanvas(w, h);
const maskR = new OffscreenCanvas(w, h);
```

When `show === "both"` (the default), `renderMandalaToCanvas` allocates TWO full-canvas-sized `OffscreenCanvas` objects PER CALL for the purple overlap masking effect. At N=16 on a 1080p canvas, this creates 32 OffscreenCanvas objects (each 1080x1080 RGBA = ~4.7MB) per frame = ~150MB of allocation per frame at 60fps = 9GB/s of allocation throughput. The GC pressure alone will cause visible jank.

The spec's performance budget table (lines 336-343) estimates ~2ms for N=16 synchronized mode. This estimate accounts for path computation and canvas draw calls but does not account for the overlap mask allocation. The actual cost will be dominated by OffscreenCanvas creation and GC, not by Path2D parsing.

**Fix required:** Either:
- (a) Pre-allocate a pair of OffscreenCanvas objects and reuse them across all calls within a frame (resize only when canvas dimensions change), or
- (b) Skip the overlap rendering in formation mode (formation mandalas are small enough that the purple overlap blend is barely visible), or
- (c) Implement the overlap using `globalCompositeOperation` directly on the main canvas with clipping regions instead of offscreen buffers.

Option (a) is the cleanest and preserves visual fidelity. Add two OffscreenCanvas fields to FormationCanvas and pass them to a modified `renderMandalaToCanvas` or wrap the call with pre/post setup.

#### I2: `ContentType` definition does not include `"formation"` and the spec understates integration scope

**Evidence:** `viewer-state-persistence.ts` line 1:
```typescript
export type ContentType = 'animation' | 'animation-3d' | 'card' | 'videos' | 'mandala';
```

And `isValidContentType` at line 89-91 hardcodes the same list. `PaneContentSelector.svelte` at lines 13-18 also hardcodes the options array. The spec says "new ContentType" but does not call out that this requires changes to:
- `viewer-state-persistence.ts` (type + validation function + localStorage migration)
- `PaneContentSelector.svelte` (options array)
- `ViewerContentRail.svelte` (mode handling)
- `viewer-state.svelte.ts` (state management)
- `ViewerSplitPane.svelte` (pane rendering switch)

This is 5 files minimum, not a single type addition.

#### I3: "Use Deck" integration assumes a collection context that the viewer does not currently expose

**Evidence:** The viewer state (`viewer-state.svelte.ts`) has no concept of "current deck" or "collection sequences." The `sequence-viewer` module receives a single `SequenceData` from its parent. There is no `sequences[]` array or deck context piped through.

The spec states "When the viewer has a collection context (browsing a deck)" -- this context does not currently exist in the viewer's state model. Building it requires either:
- Threading a `sequences: SequenceData[]` prop from the browse page through to `FormationPane`, or
- Creating a shared deck context store accessible to viewer panes.

This is not Phase 5a work -- the spec correctly defers it to Phase 5b, but the implementation estimate should account for the plumbing.

#### I4: The spec references `MandalaColorPaletteConfig` in the export config but this type does not exist

**Evidence:** Grep for `MandalaColorPaletteConfig` across the entire codebase returns only the spec itself. The actual palette type is `MandalaPalette` (defined in `mandala-types.ts`). The export config interface should use `MandalaPalette` instead.

### MINOR

#### M1: PathsCache eviction strategy has a subtle bug for non-synchronized modes

The spec states "Evict all entries for this sequenceId at old dx values" in the `set()` method, but the implementation shown only does `this.map.set(key, paths)` without any eviction. In sequential mode with 16 different tipDx values per frame, the cache grows to 16 entries per sequence per frame and is never pruned until `clear()`. This is not a memory concern (MandalaPaths are small) but the cache hit rate drops to zero in sequential mode because each frame produces slightly different tipDx integers. The cache is only effective in synchronized mode.

Consider: for sequential mode, the cache should store paths keyed by `sequenceId:tipDxInt` and retain only the most recent N entries (where N = slot count). Or accept that the cache only helps in synchronized mode and document that.

#### M2: The spec claims `UndulationEasing` is imported from `SequenceMandala.svelte`

This is technically correct (the type is exported from the module script block), but importing types from `.svelte` files is fragile. The easing type and functions should be extracted to a standalone `mandala-easing.ts` module. Same for `MandalaPathShape`. This is a pre-existing codebase smell, not something Phase 5 introduced, but Phase 5 adding another consumer makes the extraction worthwhile.

#### M3: `PaneContentSelector` omits `"videos"` from its options array

The `ContentType` union includes `'videos'` but `PaneContentSelector` only shows 4 options (animation, animation-3d, card, mandala). Adding `"formation"` to the type without also verifying which components render each type in the split pane system could cause runtime errors if a user's persisted `localStorage` contains `"formation"` after a downgrade.

#### M4: Formation coordinate system description is inconsistent

The spec states "formation layout positions are in a normalized [0,1] space, scaled to canvas pixel dimensions at render time" (line 299). But the rendering loop pseudocode (line 279) passes `slot.x - size / 2` directly as `offsetX`, implying pixel coordinates. If slots use normalized coordinates, there needs to be a `slot.x * canvasWidth` step. If they use pixel coordinates, the "normalized [0,1] space" claim is wrong. Pick one and be consistent.

#### M5: No accessibility consideration for formation viewer

The formation canvas is purely visual with no ARIA labeling, keyboard navigation, or screen reader description. The existing `MandalaPane` has the same gap, but Phase 5 is a good time to add at minimum an `aria-label` describing the formation configuration.

---

## RECOMMENDATIONS

### R1: Fix `renderMandalaToCanvas` tipDx scaling before Phase 5 begins (blocks C1)

One-line fix in `mandala-renderer.ts`:
```typescript
// Line 235, change:
const tipReach = MANDALA_STANDARD_TIP_DX * MANDALA_GRID_RADIUS / ENGINE_GRID_RADIUS;
// To:
const effectiveTipDx = Math.max(options.tipDx ?? MANDALA_STANDARD_TIP_DX, MANDALA_STANDARD_TIP_DX);
const tipReach = effectiveTipDx * MANDALA_GRID_RADIUS / ENGINE_GRID_RADIUS;
```

This fix benefits the existing `ImageComposer` and future Phase 8/9 specs that also depend on canvas rendering with dynamic tipDx.

### R2: Pre-allocate overlap OffscreenCanvas pair (blocks I1)

Add a `FormationOverlapBuffers` class or modify `renderMandalaToCanvas` to accept optional pre-allocated OffscreenCanvas buffers:
```typescript
interface OverlapBuffers {
  maskA: OffscreenCanvas;
  maskB: OffscreenCanvas;
}
```
Resize only when canvas dimensions change. Pass into each `renderMandalaToCanvas` call. This eliminates 32 OffscreenCanvas allocations per frame at N=16.

### R3: OffscreenCanvas + Worker is closer to required than the spec suggests

The spec defers OffscreenCanvas Worker to "Phase 5b if needed." Given I1 (overlap allocation cost) and the fact that `renderMandalaToCanvas` is already stateless and DOM-free, moving the formation render loop to a worker is low-risk and high-reward. The existing `composition.worker.ts` demonstrates the pattern. Recommendation: implement the worker path in Phase 5a as the primary path, not as a fallback.

### R4: Profile actual Path2D cost before committing to N=32

The spec's performance estimates are plausible but unvalidated. Before implementing the N=32 cap, profile on:
- Chrome (V8 Path2D is fast)
- Firefox (Gecko Path2D parsing is historically slower)
- Safari (WebKit has occasional Path2D regressions)

96k Path2D constructions/sec is fine on Chrome but may fail on Firefox. If Firefox is a target, Path2D object pooling (cache the `Path2D` object alongside the `d` string in `MandalaPaths`) would eliminate reconstruction costs entirely.

### R5: Extract types from Svelte module scripts (addresses M2)

Before Phase 5 adds `FormationSettings` that imports `UndulationEasing` and `MandalaPathShape` from `.svelte` files, extract these to:
- `src/lib/shared/mandala/domain/mandala-easing.ts` (easing types + functions)
- `src/lib/shared/mandala/domain/mandala-path-shape.ts` (or add to existing `mandala-types.ts`)

### R6: Add responsive layout handling for wide formations

The spec does not address what happens when a grid or spiral formation is wider than the viewport. The canvas element itself will be constrained by its container, but the internal layout math (`computeFormationLayout`) should either:
- Auto-scale formation to fit canvas bounds (preferred), or
- Clip with a user-visible indicator that content extends beyond view.

The ring and hex types auto-fit by nature. Grid (8x8 = 64 items at N=32 cap... actually grid is capped at cols*rows <= some limit) and spiral with high turns can exceed bounds. Add a `fitToCanvas` normalization step after layout computation.
