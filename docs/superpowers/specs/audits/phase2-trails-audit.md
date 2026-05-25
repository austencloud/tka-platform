# Audit: Mandala Phase 2 Trails / Afterimage Design Spec

**Spec:** `docs/superpowers/specs/2026-05-25-mandala-phase2-trails-design.md`
**Auditor:** Claude Opus 4.6
**Date:** 2026-05-25

---

## VERDICT: CONDITIONAL PASS

The spec is well-structured, demonstrates genuine understanding of the existing codebase, and the core architecture (ghost buffer + SVG stacking + motion-threshold sampling) is sound. However, there are several correctness bugs that would cause runtime failures or visual artifacts if implemented as written. All are fixable without rearchitecting.

---

## STRENGTHS

1. **Option B for animation ownership is correct and well-reasoned.** The spec correctly identifies that `SequenceMandala` already has a `tipDx` prop override (line 139 of `SequenceMandala.svelte`) that bypasses internal animation when set. The `effectiveDx` derived value (line 218-219) confirms this: `tipDx ?? (animate ? animatedDx : MANDALA_STANDARD_TIP_DX)`. Hoisting animation to `MandalaPane` and passing `animate={false}` + `tipDx={animatedDx}` is the cleanest integration path.

2. **Motion-threshold sampling is the right call.** Sampling on `tipDx` delta and rotation delta produces denser ghosts during fast motion, which matches the long-exposure photography metaphor. The 80ms fixed-interval alternative would produce uniform ghosts during the slow reversal points of the breathe cycle, wasting ghost slots on nearly-identical frames.

3. **`suppressGlow` via render option instead of string replacement.** The spec offers both approaches but the `suppressGlow` render option is clearly better than `svgStr.replace()`. String replacement is fragile if the filter attribute value ever changes (e.g., from an additional filter). The one-line renderer change at line 162 of `mandala-renderer.ts` is minimal and safe.

4. **Flow color interaction requires zero additional logic.** The spec correctly identifies that each ghost SVG was rendered with the palette current at capture time, so the rainbow trail emerges automatically. Verified: `renderMandalaSVG` bakes colors into the SVG string at call time.

5. **Export integration plan is realistic.** The sequential `svgToCanvas` approach with 8 extra conversions per frame at ~5ms each is acceptable for offline export. The existing `handleDownload()` loop (lines 272-318 of `MandalaPane.svelte`) already runs sequentially per frame.

6. **Edge cases are well-covered.** Sequence change, paused state, color mode switch, and the zero-rotation fallback timer are all addressed. The fallback timer for zero-motion states is a detail most specs miss.

---

## ISSUES

### CRITICAL

**C1: `svgToCanvas` destroys previous canvas content -- export compositing will not work as described.**

The spec says (Export Compositing section): "For each ghost (oldest first): call `svgToCanvas(ghost.svgStr, canvas, ghost.rotDeg, "transparent")` -- use transparent background so the existing content is preserved underneath."

But `svgToCanvas` (lines 195-221 of `MandalaPane.svelte`) calls `ctx.clearRect(0, 0, s, s)` followed by `ctx.fillStyle = bg; ctx.fillRect(0, 0, s, s)` on every invocation. Even with `bg = "transparent"`, the `clearRect` wipes the canvas to fully transparent, destroying all previously composited ghost layers.

**Fix:** The export pipeline needs a modified compositing function that skips `clearRect` + `fillRect` for ghost layers, or uses a separate approach: render each ghost SVG to its own temporary `Image`, then composite all images onto the export canvas in a single pass using `ctx.globalAlpha = ghost.opacity` before `ctx.drawImage()`. This avoids the `svgToCanvas` function entirely for ghost compositing.

---

**C2: SVG filter ID collision -- all ghost SVGs share `id="glow"` in the same DOM.**

The `renderMandalaSVG` function hardcodes `<filter id="glow">` (line 113 of `mandala-renderer.ts`). When multiple ghost SVGs are injected via `{@html}` into the same document, all share the same `id="glow"` filter definition. SVG ID resolution in a flat DOM is undefined when IDs collide -- browsers typically resolve to the first definition encountered, which means the glow filter may reference the wrong `<defs>` block or produce unexpected behavior.

The mask/overlap filter IDs use `maskIdCounter` (line 36-37) to generate unique suffixes (`feather${uid}`, `bloom${uid}`, `bom${uid}`), but the glow filter does not.

**Fix:** When `suppressGlow` is true (the ghost case), the filter is omitted entirely, so the ID collision is harmless for ghost frames. However, the *live* `SequenceMandala` also renders its own SVG with `id="glow"`. With 8 ghost SVGs + 1 live SVG all in the DOM, there are 9 `<defs>` blocks each defining `id="glow"`. The spec's `suppressGlow` mitigation handles the ghost side (no `filter="url(#glow)"` reference), but the `<defs>` block still emits the `<filter id="glow">` definition in every ghost SVG.

For correctness, `suppressGlow` should also suppress the `<filter id="glow">` definition in `<defs>`, not just the reference. Or: strip the entire `<defs>` glow definition when `suppressGlow` is true. Alternatively, make the glow filter ID use `maskIdCounter` like the other filter IDs.

---

### IMPORTANT

**I1: `{#each}` key expression will produce collisions.**

The spec uses `ghost.rotationDeg + ghost.svgString.length` as the key:
```svelte
{#each ghostBuffer as ghost (ghost.rotationDeg + ghost.svgString.length)}
```

Two ghosts captured at different times can have identical `rotationDeg` (if rotation is 0) and identical `svgString.length` (if palette changes don't affect string length, which they often won't for same-beat-count sequences). The sum of two identical values produces an identical key, causing Svelte's keyed-each to skip rendering or misassign DOM nodes.

**Fix:** Use a monotonically increasing capture ID:
```typescript
interface GhostFrame {
  id: number;  // monotonic counter, assigned at capture time
  svgString: string;
  rotationDeg: number;
  opacity: number;
}
```
Key on `ghost.id`.

---

**I2: `.mandala-stage` lacks `position: relative` -- ghost layer's `position: absolute` will escape.**

The spec places the ghost layer inside `.mandala-stage` with `position: absolute; inset: 0`. But `.mandala-stage` in `MandalaPane.svelte` (lines 397-403) has no `position` property set. Its `display: flex` does not establish a containing block for absolutely positioned children. The ghost layer will be positioned relative to the nearest ancestor with `position: relative/absolute/fixed`, which is likely `.mandala-pane` or even the viewport.

**Fix:** Add `position: relative` to `.mandala-stage`.

---

**I3: Live frame rotation is unaddressed under Option B.**

The spec selects Option B: `MandalaPane` drives animation, passes `animate={false}` to `SequenceMandala`. With `animate={false}`, the `$effect` block in `SequenceMandala` (lines 175-216) returns early, so `rotationDeg` stays at its initial value of 0. The live `SequenceMandala` will not rotate.

The spec says "The live frame's rotation is still handled by `SequenceMandala`" (Rotation Interaction section), but this contradicts Option B's `animate={false}`. Under Option B, `MandalaPane` must also apply rotation to the live `SequenceMandala`, either by wrapping it in a rotating container div (matching the ghost-frame pattern) or by modifying `SequenceMandala` to accept an external `rotationDeg` prop.

**Fix:** The spec must acknowledge that Option B requires `MandalaPane` to handle live-frame rotation too. The simplest approach: wrap the `SequenceMandala` in a `<div style:transform="rotate({currentRotationDeg}deg)">` inside `.mandala-stage`, matching the ghost-frame rotation pattern.

---

**I4: Opacity recomputation on every ghost capture is wasteful and creates a visual pop.**

The spec's `maybeCaptureGhost()` function (lines 268-274) recomputes all ghost opacities on every new capture:
```typescript
ghostBuffer = newBuffer.map((g, i) => ({
  ...g,
  opacity: BASE_OPACITY * Math.pow(DECAY_RATE, i),
}));
```

This creates new objects for every ghost on every capture (8 object allocations + 8 opacity recalculations). More importantly, it produces a visual discontinuity: a ghost that was at opacity `BASE_OPACITY * DECAY^2` suddenly jumps to `BASE_OPACITY * DECAY^3` when a new ghost pushes in front of it. At DECAY_RATE = 0.62, that is a 38% brightness drop in a single frame.

This contradicts the spec's own statement: "Opacity is computed once at capture time using the ghost's position in the buffer -- not recalculated on each render."

**Fix:** Assign each ghost its opacity at capture time based on its buffer position at that moment, and never recompute. When a new ghost enters, it gets `BASE_OPACITY`. Old ghosts keep their original opacity. When a ghost falls off the buffer tail, it simply disappears. The fade is built into the capture rhythm -- older ghosts were given lower opacity when they were captured at a deeper buffer position? No, that does not work either because all ghosts enter at position 0.

The correct approach: compute opacity at render time from buffer index, not at capture time. Store only `svgString` and `rotationDeg` on the ghost. At render time, `opacity = BASE_OPACITY * DECAY^i`. This is O(N) with no per-frame recomputation overhead (it is computed during the `{#each}` render, which Svelte does anyway). The "computed once at capture time" framing in the spec is internally inconsistent with the implementation code that follows it.

---

**I5: Roadmap document is referenced but does not appear to define Phase 2 scope.**

The spec references `docs/superpowers/specs/2026-05-25-mandala-roadmap.md` for its "Phase 2" designation. The roadmap file exists, but the spec should be self-contained enough that implementers don't need to cross-reference for scope boundaries. The spec's Non-Goals section is good, but there is no explicit "Phase 2 scope" list at the top. Adding a 3-bullet scope summary (ghost buffer, UI controls, export integration) would help.

---

### MINOR

**M1: `will-change: opacity` on every ghost frame is excessive.**

The spec applies `will-change: opacity` to every `.ghost-frame`. With 15 ghosts, this requests 15 GPU-promoted layers. The opacity on ghost frames is set once (at capture time or render time) and does not animate -- it is a static CSS property per ghost. `will-change` is designed for properties that *will* change in the near future, not static values. 15 unnecessary GPU layers consume VRAM for no benefit.

**Fix:** Remove `will-change: opacity` from `.ghost-frame`. If any ghost opacity does animate (e.g., a fade-in transition), use `will-change` on that specific ghost during the transition only.

---

**M2: The spec does not address `maskIdCounter` exhaustion for ghost SVGs.**

`renderMandalaSVG` increments `maskIdCounter` (a module-level `let`, line 36) on every call. With 15 ghosts captured at 5fps, that is 75 increments per second. After an hour of viewing, `maskIdCounter` reaches 270,000. This is not a practical problem (JavaScript numbers are safe to 2^53), but ghost SVGs that are discarded still increment the counter. The counter never resets. This is cosmetically messy but functionally harmless.

---

**M3: The 500ms max-time-gap fallback (zero-rotation edge case) needs cleanup on disable.**

The spec mentions a 500ms forced-capture timer for the zero-rotation case but does not specify cleanup. If `trailEnabled` toggles off while this timer is pending, the timer must be cleared to avoid a stale ghost capture into an empty buffer.

---

**M4: Export ghost buffer starts empty -- first ~8 frames of exported video have no trail.**

The spec acknowledges the export ghost buffer "starts empty" and populates during the frame loop. For a 5-second cycle at 30fps (150 frames) with one ghost every 6 frames, the buffer takes 48 frames (~1.6 seconds) to fill to 8 ghosts. The first third of the exported loop has a visibly thinner trail than the rest.

**Fix:** Pre-warm the export ghost buffer by computing ghost frames for a preceding "virtual" cycle that is not encoded. This adds one cycle of computation (~150 extra `renderMandalaSVG` calls) but produces a seamless exported loop from frame 1.

---

## RECOMMENDATIONS

1. **Fix C1 immediately.** The export compositing will produce a black video with only the last ghost visible. Either refactor `svgToCanvas` to accept a `clearCanvas: boolean` parameter, or write a separate `compositeGhostToCanvas()` function that uses `globalAlpha` and skips clearing.

2. **Fix C2 by extending `suppressGlow` to also suppress the glow `<defs>` entry.** A two-line change: wrap the glow filter `<defs>` emission in `if (!options.suppressGlow)`. This eliminates all ID collisions.

3. **Fix I1 with a monotonic ID.** One additional `let ghostCaptureId = 0` counter and `id: ghostCaptureId++` on each new ghost.

4. **Fix I2 with one CSS line:** `position: relative` on `.mandala-stage`.

5. **Fix I3 by specifying that `MandalaPane` wraps `SequenceMandala` in a rotating div** when Option B is active, using the same `currentRotationDeg` state that ghost frames use.

6. **Resolve I4 by computing opacity from buffer index at render time.** Drop `opacity` from `GhostFrame` interface. In the template: `style:opacity={BASE_OPACITY * Math.pow(DECAY_RATE, i)}` using the `{#each}` index.

7. **Consider pre-warming the export ghost buffer (M4)** if the exported video quality matters for marketing or user downloads.

---

## STATE-OF-THE-ART CHECK

The SVG-stacking approach is reasonable for the scope (max 15 layers at 600px). Alternative approaches considered:

- **OffscreenCanvas compositing:** Would avoid the DOM bloat of 15 SVG elements but requires converting each ghost SVG to a bitmap via `createImageBitmap()` or blob+Image. The conversion latency (~5ms per ghost) would need to happen off the main thread to avoid jank. Not worth the complexity for 15 elements.

- **CSS `filter()` / `backdrop-filter`:** Not applicable -- the ghosts need distinct opacity per layer, not a uniform filter on a container.

- **View Transitions API:** Not relevant -- this is continuous animation, not discrete state transitions.

- **`element()` CSS function:** Still only in Firefox (2026 status unchanged). Not viable.

- **Container queries:** Not relevant to this feature.

The spec's approach is appropriate for the problem size. Canvas compositing would be better if trail length were 50+, but at 3-15 ghosts, SVG stacking is simpler and leverages the existing pipeline.
