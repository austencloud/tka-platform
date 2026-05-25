# Phase 10 Sequence Morphing Design Spec -- Audit

**Auditor:** Claude Opus 4.6
**Date:** 2026-05-25
**Spec reviewed:** `docs/superpowers/specs/2026-05-25-mandala-phase10-sequence-morphing-design.md`
**Codebase cross-referenced:** MandalaGeometryCalculator.ts, mandala-renderer.ts, mandala-types.ts, SequenceMandala.svelte, MandalaPane.svelte, mandala-collection-types.ts

---

## VERDICT: CONDITIONAL PASS

The spec is architecturally sound, well-structured, and correctly identifies the key insight that makes morphing tractable (fixed path correspondence via tipIndex). The interpolation strategy is the right call. However, it contains one critical claim that is **not always true** and two important technical gaps that need resolution before implementation begins.

---

## STRENGTHS

1. **Correct architectural insight.** The spec correctly identifies that `standardTips` always has exactly 2 entries (`[{ dx: -dx, dy: 0 }, { dx: dx, dy: 0 }]`), which means `bluePointSets` and `redPointSets` are always populated with exactly 2 arrays (lines 557-578 of MandalaGeometryCalculator.ts). The tip-index correspondence strategy is sound for the common case.

2. **Right interpolation choice.** Point-array lerp with arc-length resampling is the correct approach here. The spec correctly rejects `flubber` (no semantic awareness of mandala structure) and direct `d`-string interpolation (segment count mismatch). The custom approach respects the geometric correspondence that the architecture provides.

3. **Clean separation of concerns.** MorphController (per-pair logic) and PlaylistController (state machine) are correctly separated. The `prepare()` / `tick()` split avoids per-frame allocation.

4. **Breathing interaction is correct.** The spec accurately describes how tipDx oscillation and geometry morphing compose: breathing varies tipDx which feeds into `calculate()` via `tipOverride`, morphing interpolates between point arrays computed at standard tipDx. They are orthogonal. Confirmed by reading SequenceMandala.svelte lines 218-237.

5. **Justified scope exclusions.** Palette crossfade, playlist non-persistence, and no export in Phase 10 are all reasonable scope cuts.

---

## ISSUES

### CRITICAL

**C1. Path count is NOT always exactly 4.** The spec's central claim states: "MandalaGeometryCalculator *always* produces exactly 2 blue paths and 2 red paths." This is **conditionally false**.

Evidence from the calculator (lines 584-592):
```ts
for (let i = 0; i < bluePointSets.length; i++) {
    const d = pointsToSVGPath(bluePointSets[i]!);
    if (d) blue.push({ d, tipIndex: i });
}
```

The `if (d)` guard means that if `generatePathPoints()` returns an empty array for a given hand+tip combination, `pointsToSVGPath()` returns `""` (line 341: `if (points.length < 2) return ""`), and that path is **omitted** from the result.

When does this happen? `generatePathPoints()` iterates over steps and calls `extractMotion(step.motions?.[hand])`. If a particular hand has no motion data in any step (e.g., the step has `motions.blue` but `motions.red` is null/undefined for every step), `continue` fires for every step and the function returns an empty `MandalaPoint[]`.

Additionally, line 551-553 shows that if `stepsWithMotions` is empty, the method returns `{ blue: [], red: [], purple: [] }` -- zero paths for both hands.

**Impact on morphing:** If source sequence has 2 blue + 2 red paths but target sequence has 2 blue + 0 red paths (one-hand-only sequence), the tipIndex correspondence breaks. The MorphController would try to morph `red[0]` to... nothing. The spec assumes this case away.

**Required fix:** The spec must define a fallback for mismatched path counts:
- If target has fewer paths than source for a hand, morph the missing target paths toward a degenerate point (e.g., the center, or the hand's resting position).
- If target has more paths than source, reverse the logic.
- OR: gate morphing to only work between sequences where both produce 2+2 paths (enforce at the UI level with a validation check, and document the constraint).

### IMPORTANT

**I1. `calculatePoints()` does not exist and `generatePathPoints()` is module-private.** The spec proposes adding `calculatePoints()` as a new export on the class, but currently `generatePathPoints()` is a module-level function (line 398), not a method on `MandalaGeometryCalculator`. The spec correctly identifies this needs exposure but understates the work: the function depends on several other module-private functions (`extractMotion`, `calculateMotionEndpoints`, `computeTipPosition`, `interpolate`, `resolvePathShape`). The cleanest approach is to add a `calculatePoints()` method on the class that delegates to `generatePathPoints()` -- no refactoring of the private functions needed since they're in the same module scope.

**I2. Canvas fast path claim is misleading.** The spec states: "MorphController.tick() returns Path2D objects directly (skipping SVG string construction) when a canvas context is available." But `renderMandalaToCanvas()` (mandala-renderer.ts line 228) takes `MandalaPaths` which contains `d` strings, and constructs `Path2D` from those strings internally (line 55: `new Path2D(d)`). There is no existing code path that accepts pre-built `Path2D` objects. The fast path would require:
1. A new `MandalaMorphPaths` type that holds `Path2D[]` instead of `SVGPathData[]`.
2. A variant render function or an overload on `renderMandalaToCanvas()`.
3. OR: skip the SVG-string-to-Path2D conversion and construct `Path2D` directly from point arrays using `moveTo()`/`bezierCurveTo()` calls -- this is the actual optimization.

The spec should specify option 3 explicitly. Using `Path2D` from `d` strings still requires building the ~50KB string per frame. The real win is `Path2D.moveTo()` + `bezierCurveTo()` from point arrays, never touching string construction.

**I3. Per-frame SVG string cost is worse than stated for the SVG render path.** The spec calculates ~50KB of SVG per frame but then says "use Canvas2D during morph." SequenceMandala.svelte currently renders via `{@html svgString}` (line 267). Switching to canvas during morph means the component needs a `<canvas>` element that's hidden when not morphing and shown when morphing. The spec should detail this DOM switching strategy. An abrupt swap between SVG and canvas at morph start/end could cause a visual flash if the canvas render doesn't pixel-match the SVG render (and it won't -- SVG has anti-aliasing differences from Canvas2D).

**I4. `CollectedMandala` stores `StepData[]` but has no `MandalaPathOptions` or `pathShape`.** The spec's morph targets are `CollectedMandala` references (from mandala-collection-types.ts). But `CollectedMandala` only stores `steps`, `variant`, and prop types. It does not store the `pathShape` that was active when the mandala was collected. If the user collected mandala A with `pathShape: "concave"` and mandala B with `pathShape: "arc"`, the morph target calculation needs to know which pathShape to use for each. The spec is silent on this. Options:
- Always morph at a single pathShape (the currently selected one) -- simplest but potentially wrong.
- Store pathShape in `CollectedMandala` and use each side's stored shape during morph point calculation.

### MINOR

**M1. Resampling preserves spatial density but not temporal density.** Arc-length resampling distributes points uniformly along the curve's length. But mandala paths encode temporal information: each beat contributes `BASE_SAMPLES_PER_BEAT` (64) points, and high-turn motions contribute more (line 466-469: adaptive sampling). After resampling, the temporal correspondence between beats is lost. For most morph transitions this is fine (the visual result is geometric, not temporal). But if a future phase adds beat-synchronous morphing (morph beat 1 to beat 1, beat 2 to beat 2), this approach would need rework. Worth noting in the spec as a known limitation.

**M2. sRGB color lerp is acceptable but not ideal.** The spec acknowledges this: "for short transitions at moderate opacity, the perceptual error is not visible." For transitions up to 8 seconds with saturated colors, mid-transition colors can appear muddy in sRGB (the classic problem where lerping red to green passes through brown). Oklab interpolation is a one-function addition and would be noticeably better for the "aurora" and "twilight" presets. Low priority but easy win.

**M3. `UndulationEasing` type is defined in SequenceMandala.svelte, not in a shared type file.** The spec references "same 8 easing curves as breathing" but the type is local to the component (line 34-42 of SequenceMandala.svelte). MorphController and PlaylistController need this type. It should be extracted to a shared location (e.g., `mandala-types.ts` or `morph-types.ts`).

**M4. Playlist state machine lacks PAUSED state.** The spec shows `DWELLING -> MORPHING -> DWELLING` with a `pause()` method. But "paused" is not a state in the machine -- it's an implicit flag. This means `pause()` during MORPHING freezes progress but `tick()` still gets called. The spec should clarify: does `pause()` freeze the morph mid-transition (holding at current `t`)? Or does it cancel to the nearest complete mandala? The former is more useful.

**M5. `pointsToSVGPath` is module-private.** The spec says "currently private, needs to be exported or the logic duplicated in the morpher." Since the canvas fast path (I2) should skip SVG string construction entirely, `pointsToSVGPath` only needs to be exposed for the fallback SVG render path during morph. For the canvas path, a `pointsToPath2D()` function that builds `Path2D` directly from the Catmull-Rom-to-Bezier math would be needed instead.

---

## RECOMMENDATIONS

1. **Before implementation, resolve C1.** Add a `validateMorphCompatibility(source, target)` function that checks both sequences produce the same path structure (same number of blue paths, same number of red paths). If they don't match, either: (a) pad the shorter side with a degenerate single-point path that morphs in/out, or (b) disable the morph button with an explanatory message. Option (a) is more robust and produces a "dissolve from nothing" effect that looks intentional.

2. **Implement the canvas fast path correctly (I2).** Build a `pointsToPath2D(points: MandalaPoint[]): Path2D` function that uses `path.moveTo()` + `path.bezierCurveTo()` with the same Catmull-Rom-to-Bezier math as `pointsToSVGPath`. This avoids string construction entirely. The MorphController returns `Path2D[]` arrays, and `renderMandalaToCanvas` gets an overload that accepts pre-built `Path2D` objects.

3. **Add pathShape to CollectedMandala (I4).** One new field: `pathShape?: MandalaPathShape`. Default to `"arc"` for existing collected mandalas that lack it.

4. **Extract UndulationEasing to a shared type (M3).** Move it from SequenceMandala.svelte to `morph-types.ts` alongside the other new types. Re-export from the component for backward compatibility.

5. **Consider Oklab for color lerp (M2).** A single `lerpOklab(a, b, t)` function replaces the sRGB lerp for the crossfade. This is roughly 20 lines of code and eliminates muddy mid-transition colors. The existing `MandalaPane.svelte` already has `lerpColor` (line 104) which would be the swap point.

6. **Specify the DOM strategy for canvas-during-morph (I3).** The simplest approach: always use canvas rendering in MandalaPane (it already has canvas export logic). The SVG path is only needed for static snapshots and export. During morph, the canvas is the primary render target. This avoids the SVG-to-canvas switching flash entirely.
