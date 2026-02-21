# Colored Flames Design

## Problem

The WebGL fire overlay renders all flames in fixed orange/yellow blackbody colors. Props have assigned colors (blue/red by default, plus purple/orange, emerald/pink, cyan/yellow for multi-performer), but flames ignore them.

## Solution

Tint flames to match prop colors using a color field texture in the fluid simulation, plus expose fire controls in the visibility tab.

## Architecture

### 1. Color Field Texture (Shader Pipeline)

Add a new RGB texture (`colorField`) at simulation resolution that stores the color of fuel at each grid cell.

**Per-frame pipeline additions:**
- **Splat phase:** When splatting fuel at tip `i`, also splat that tip's prop color into `colorField` using the same Gaussian position/radius. Reuses `SPLAT_FRAG`.
- **Advection phase:** Advect `colorField` through the velocity field using `ADVECTION_FRAG` with same dissipation as fuel. One additional draw call per frame.
- **Display phase:** New `tintedBlackbody(temperature, propColor)` function replaces `blackbodyColor(temperature)`:
  - Hot core (high temp): white — all fires have white-hot centers
  - Mid-range: prop color at full saturation
  - Cool edges (low temp): dark version of prop color
  - When `coloredFlames` is off, falls back to the existing fixed blackbody ramp

**Wick cores (Layer 2):** Already rendered per-tip in a `for` loop. Replace hardcoded orange body color `vec3(1.0, 0.65, 0.12)` and glow color `vec3(0.9, 0.25, 0.02)` with prop color at appropriate brightness. Core stays white-hot.

### 2. Prop Color Plumbing

**Data flow:**
1. `PropTipData` already has `propIndex` (0 = left, 1 = right)
2. `WebGLFireRenderer` receives two prop colors (left RGB, right RGB) as part of frame input
3. During splat, renderer maps `propIndex` to the corresponding color for the color field splat
4. Colors sourced from:
   - Single performer: `#3b82f6` (blue), `#ef4444` (red)
   - Multi-performer: `TUNNEL_LAYER_COLORS[layerIndex].left/right`

**New uniforms in display shader:**
- `u_tipPropColors[16]` — vec3 array, one per tip
- `u_colorField` — sampler2D for the advected color texture
- `u_useColoredFlames` — bool toggle

### 3. Visibility Tab UI

Two new controls in the Animation panel using existing conditional disclosure pattern:

```
[Fire Effect]          [ON/OFF]     ← exists in state, needs UI button
   └─ [Colored Flames]  [ON/OFF]   ← new, visible only when fire is ON
```

**State changes:**
- `AnimationVisibilityManager` gets `coloredFlames: boolean` (default `true`)
- Persisted to localStorage alongside existing animation visibility settings
- Methods: `isColoredFlamesEnabled()`, `setColoredFlames(boolean)`, `toggleColoredFlames()`

### 4. When Colored Flames Are Off

Renderer ignores prop colors entirely. `blackbodyColor()` runs as-is. Color field texture still exists but isn't sampled in the display shader. Zero performance difference from current behavior.

## Files Affected

| File | Change |
|------|--------|
| `FluidShaderSources.ts` | New `COLOR_SPLAT_FRAG` or reuse `SPLAT_FRAG`; modified `DISPLAY_FRAG` with `tintedBlackbody()` and `u_colorField` |
| `WebGLFireRenderer.ts` | Create/manage color field FBO pair; splat colors during tip injection; advect color field; pass color uniforms to display |
| `FireTypes.ts` | Add `propColors` to `FireFrameInput` or renderer config |
| `FireTipTracker.ts` | Potentially pass prop colors through (or renderer resolves via propIndex) |
| `animation-visibility-state.svelte.ts` | Add `coloredFlames` property + getter/setter/toggle |
| `AnimationPanel.svelte` | Add fire effect toggle + colored flames sub-toggle |
| `AnimationDesktopControls.svelte` | Wire fire toggle if desktop layout needs it |
| `AnimationMobileControls.svelte` | Wire fire toggle if mobile layout needs it |

## GPU Cost

One additional texture (color field) + one additional advection draw call per frame. Roughly ~5-10% more GPU work on top of existing ~30 draw calls. Negligible on any GPU that can already run the fluid sim.
