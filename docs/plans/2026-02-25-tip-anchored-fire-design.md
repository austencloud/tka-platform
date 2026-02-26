# Tip-Anchored Fire Rendering

## Problem

The Navier-Stokes fluid simulation accumulates velocity field bias over time, causing the rendered fire to drift 36-103px away from prop tips. Diagnostics confirmed the velocity field reaches steady-state with persistent directional bias from prop motion injection.

## Solution: Display-Stage Anchoring (Approach C)

Keep the existing simulation pipeline. Rewrite the display shader to sample the temperature/fuel fields **relative to each tip position** instead of at absolute UV coordinates. The sim can drift internally — the display output is always anchored to the tip.

### Display Shader Changes

1. **Per-tip sampling**: For each pixel, iterate over tips. For each tip, compute a local offset from the tip's UV position and sample the sim grid at that offset. Accumulate fire color with distance-based falloff.

2. **Velocity stretching**: Shift the sampling anchor opposite to tip velocity direction. When the wick moves right, fire renders slightly left (trailing behind). Replaces physics-based velocity injection for visual trailing.

3. **Per-tip falloff**: Gaussian falloff from each tip center prevents one tip's fire from rendering everywhere. Radius scales with `flameScale`.

4. **Fire merging preserved**: When tips are close, their falloff radii overlap and fire contributions blend naturally.

### TypeScript Changes

1. **Pass tip velocities to display shader**: Add `u_tipVelocities[16]` uniform array (already have speeds, need direction).

2. **Add velocity stretch parameters**: `u_velocityStretchScale` uniform for controlling trail length.

3. **Add anchored mode toggle**: `u_anchoredMode` uniform (1 = anchored/new, 0 = absolute/legacy) for A/B comparison.

### Files Changed

- `FluidShaderSources.ts` — rewrite DISPLAY_FRAG
- `WebGLFireRenderer.ts` — pass velocity uniforms, cache locations, add stretch param
- `FireTypes.ts` — add `anchoredMode` to FireOverlayConfig

### Performance

Identical draw call count. The display shader does slightly more work (per-tip loop with sampling), but it's one pass on a 128×128 grid — negligible.

### What Does NOT Change

- Simulation pipeline (splat, advect, curl, vorticity, buoyancy, combustion, pressure, gradient subtract)
- Fire frame cache (records display output, which is now anchored)
- FireTipTracker (still computes positions and velocities)
- Wick core rendering (Layer 2 — already anchored, stays as-is)
- Smoke/soot rendering (shifted to tip-relative sampling too)
