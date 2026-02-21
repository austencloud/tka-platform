# Colored Flames Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Tint fire overlay flames to match prop colors (blue/red, plus multi-performer palette), with a visibility tab toggle.

**Architecture:** Add a color field texture to the Navier-Stokes fluid sim that carries RGB color alongside fuel. Splat prop colors during injection, advect with the fluid, sample in display shader. Extend AnimationVisibilityManager with `coloredFlames` boolean. Wire fire toggle + colored sub-toggle into the Animation panel.

**Tech Stack:** WebGL2 GLSL 300 es shaders, Svelte 5 runes, TypeScript, AnimationVisibilityStateManager (localStorage persistence)

---

### Task 1: Add `coloredFlames` to AnimationVisibilityManager

**Files:**
- Modify: `src/lib/shared/animation-engine/state/animation-visibility-state.svelte.ts`

**Step 1: Add property to settings interface**

In `AnimationVisibilitySettings` (line 25), add after `fireEffect: boolean`:

```typescript
coloredFlames: boolean; // Tint flames to match prop colors
```

**Step 2: Add default value**

In `getDefaultSettings()` (line 87), add after `fireEffect: false`:

```typescript
coloredFlames: true, // Colored flames on by default
```

**Step 3: Add getter/setter/toggle methods**

After the `toggleFireEffect()` method (line 467), add:

```typescript
/**
 * Check if colored flames are enabled
 */
isColoredFlamesEnabled(): boolean {
  return this.settings.coloredFlames;
}

/**
 * Set colored flames
 */
setColoredFlames(enabled: boolean): void {
  this.settings.coloredFlames = enabled;
  this.saveToStorage();
  this.notifyObservers();
}

/**
 * Toggle colored flames
 */
toggleColoredFlames(): void {
  this.setColoredFlames(!this.settings.coloredFlames);
}
```

**Step 4: Verify**

Run: `npm run check 2>&1 | head -20`
Expected: 0 errors

**Step 5: Commit**

```bash
git add src/lib/shared/animation-engine/state/animation-visibility-state.svelte.ts
git commit -m "feat(fire): add coloredFlames setting to AnimationVisibilityManager"
```

---

### Task 2: Add `propColors` to FireFrameInput and FireOverlayConfig

**Files:**
- Modify: `src/lib/shared/animation-engine/domain/types/FireTypes.ts`

**Step 1: Add prop color type**

Before `PropTipData` (line 13), add:

```typescript
/**
 * RGB color for a prop, normalized to [0, 1] for shader consumption.
 */
export interface PropFlameColor {
  r: number;
  g: number;
  b: number;
}
```

**Step 2: Add propColors to FireFrameInput**

In `FireFrameInput` (line 35), add after `darkMode: boolean`:

```typescript
/** Prop colors for colored flames: [leftPropColor, rightPropColor] */
propColors?: [PropFlameColor, PropFlameColor];
```

**Step 3: Add coloredFlames to FireOverlayConfig**

In `FireOverlayConfig` (line 85), add after `quality: number`:

```typescript
/** Whether flames should be tinted to match prop colors */
coloredFlames?: boolean;
```

**Step 4: Add hex-to-normalized color utility**

After `DEFAULT_FIRE_CONFIG` (line 130), add:

```typescript
/**
 * Convert a CSS hex color (#rrggbb) to normalized [0,1] RGB for shader use.
 */
export function hexToFlameColor(hex: string): PropFlameColor {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return { r, g, b };
}

/** Default prop flame colors (blue/red) */
export const DEFAULT_PROP_FLAME_COLORS: [PropFlameColor, PropFlameColor] = [
  hexToFlameColor("#3b82f6"), // blue (left prop)
  hexToFlameColor("#ef4444"), // red (right prop)
];
```

**Step 5: Verify**

Run: `npm run check 2>&1 | head -20`
Expected: 0 errors

**Step 6: Commit**

```bash
git add src/lib/shared/animation-engine/domain/types/FireTypes.ts
git commit -m "feat(fire): add PropFlameColor type and coloredFlames config"
```

---

### Task 3: Add color field texture and color splat to WebGLFireRenderer

**Files:**
- Modify: `src/lib/shared/animation-engine/services/implementations/fire/WebGLFireRenderer.ts`

**Step 1: Add color field FBO member**

After `private fuel: DoubleFBO | null = null;` (line 110), add:

```typescript
private colorField: DoubleFBO | null = null;
```

**Step 2: Add per-tip color cache**

After `private displayTipFlameScales: Float32Array` (line 123), add:

```typescript
private displayTipColors: Float32Array = new Float32Array(48); // 16 tips * 3 (r,g,b)
```

**Step 3: Create color field in `createSimulationBuffers()`**

In `createSimulationBuffers()` (line 639), after `this.curlFBO = ...`, add:

```typescript
this.colorField = this.createDoubleFBO(w, h);
```

**Step 4: Destroy color field in `destroySimulationBuffers()`**

In `destroySimulationBuffers()` (line 651), after `destroyDouble(this.fuel)`, add:

```typescript
destroyDouble(this.colorField);
```

And after `this.fuel = null`, add:

```typescript
this.colorField = null;
```

**Step 5: Splat prop colors during tip injection**

In `stepSimulation()`, inside the `for (const tip of tips)` loop (line 269), after the temperature splat (line 288), add:

```typescript
// Color injection: splat prop color into color field (only when colored flames active)
if (config.coloredFlames && input.propColors && this.colorField) {
  const propColor = input.propColors[tip.propIndex];
  if (propColor) {
    this.splat(this.colorField!, uvX, uvY, propColor.r, propColor.g, propColor.b);
  }
}
```

**Step 6: Cache tip colors for display pass**

In the tip UV caching loop (line 295), after caching flameScales (line 300), add:

```typescript
if (input.propColors) {
  const color = input.propColors[tip.propIndex];
  if (color) {
    this.displayTipColors[ti * 3] = color.r;
    this.displayTipColors[ti * 3 + 1] = color.g;
    this.displayTipColors[ti * 3 + 2] = color.b;
  }
}
```

**Step 7: Advect color field**

After the fuel advection line (line 326), add:

```typescript
// Advect color field so flame colors travel with the fluid
if (this.colorField && config.coloredFlames) {
  this.advect(this.colorField!, this.colorField!.read, p.fuelDissipation, dt, texelSize);
}
```

**Step 8: Update `renderFire` signature to pass through**

The existing `renderFire` method (line 208) already passes `config` to `stepSimulation` and `renderDisplay`. We need `renderDisplay` to also receive `input` (it already does at line 218: `this.renderDisplay(config, input)`). No change needed here.

**Step 9: Verify**

Run: `npm run check 2>&1 | head -20`
Expected: 0 errors

**Step 10: Commit**

```bash
git add src/lib/shared/animation-engine/services/implementations/fire/WebGLFireRenderer.ts
git commit -m "feat(fire): add color field texture, splat and advect prop colors"
```

---

### Task 4: Modify display shader for colored flames

**Files:**
- Modify: `src/lib/shared/animation-engine/services/implementations/fire/FluidShaderSources.ts`

**Step 1: Update `DISPLAY_FRAG` with color field sampling and tinted blackbody**

Replace the entire `DISPLAY_FRAG` export (lines 343-436) with:

```typescript
export const DISPLAY_FRAG = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 fragColor;

uniform sampler2D u_temperature;
uniform sampler2D u_fuel;
uniform sampler2D u_colorField;
uniform float u_displayIntensity;
uniform bool u_coloredFlames;

// Wick core rendering uniforms (up to 16 tips for multi-point props like fans)
uniform vec2 u_tipPositions[16];
uniform float u_tipSpeeds[16];
uniform float u_tipFlameScales[16];
uniform vec3 u_tipColors[16];
uniform int u_tipCount;
uniform vec2 u_aspectCorrect;  // (1.0, width/height) to keep cores circular

// Standard blackbody for natural fire (unchanged from original)
vec3 blackbodyColor(float t) {
  vec3 color;
  if (t < 0.4) {
    color = vec3(0.2, 0.02, 0.0) * (t / 0.4);
  } else if (t < 1.0) {
    float f = (t - 0.4) / 0.6;
    color = mix(vec3(0.2, 0.02, 0.0), vec3(0.9, 0.15, 0.0), f);
  } else if (t < 2.0) {
    float f = (t - 1.0);
    color = mix(vec3(0.9, 0.15, 0.0), vec3(1.0, 0.55, 0.05), f);
  } else if (t < 3.5) {
    float f = (t - 2.0) / 1.5;
    color = mix(vec3(1.0, 0.55, 0.05), vec3(1.0, 0.9, 0.35), f);
  } else {
    float f = clamp((t - 3.5) / 2.0, 0.0, 1.0);
    color = mix(vec3(1.0, 0.9, 0.35), vec3(1.0, 0.98, 0.9), f);
  }
  return color;
}

// Tinted blackbody: same temperature ramp but hue-shifted toward propColor.
// Hot core stays white (all fires have white-hot centers).
// Mid-range takes on the prop color at full saturation.
// Cool edges are a dark version of the prop color.
vec3 tintedBlackbody(float t, vec3 propColor) {
  // Dark base: dim version of prop color
  vec3 darkBase = propColor * 0.15;
  // Bright mid: full prop color
  vec3 brightMid = propColor;
  // Hot core: desaturate toward white
  vec3 hotCore = mix(propColor, vec3(1.0), 0.7);

  vec3 color;
  if (t < 0.4) {
    color = darkBase * (t / 0.4);
  } else if (t < 1.0) {
    float f = (t - 0.4) / 0.6;
    color = mix(darkBase, brightMid * 0.6, f);
  } else if (t < 2.0) {
    float f = (t - 1.0);
    color = mix(brightMid * 0.6, brightMid, f);
  } else if (t < 3.5) {
    float f = (t - 2.0) / 1.5;
    color = mix(brightMid, hotCore, f);
  } else {
    float f = clamp((t - 3.5) / 2.0, 0.0, 1.0);
    color = mix(hotCore, vec3(1.0, 0.98, 0.95), f);
  }
  return color;
}

void main() {
  float temp = texture(u_temperature, v_uv).x;
  float fuel = texture(u_fuel, v_uv).x;

  vec3 color = vec3(0.0);
  float alpha = 0.0;

  // --- Layer 1: Fluid sim trail (the wake behind each wick) ---
  float fireIntensity = temp + fuel * 0.5;
  fireIntensity *= u_displayIntensity;

  if (fireIntensity > 0.1) {
    vec3 trailColor;
    if (u_coloredFlames) {
      // Sample the advected color field to get the prop color at this position
      vec3 fieldColor = texture(u_colorField, v_uv).rgb;
      // Normalize: color field may have accumulated values > 1 from splats
      float maxC = max(fieldColor.r, max(fieldColor.g, fieldColor.b));
      if (maxC > 0.01) {
        fieldColor /= maxC;
      }
      trailColor = tintedBlackbody(fireIntensity, fieldColor);
    } else {
      trailColor = blackbodyColor(fireIntensity);
    }
    float trailAlpha = smoothstep(0.1, 0.8, fireIntensity);
    color = trailColor * trailAlpha;
    alpha = trailAlpha;
  }

  // --- Layer 2: Wick cores (the actual burning wick) ---
  for (int i = 0; i < 16; i++) {
    if (i >= u_tipCount) break;

    float fs = u_tipFlameScales[i];
    vec2 delta = (v_uv - u_tipPositions[i]) * u_aspectCorrect;
    float dist2 = dot(delta, delta);

    vec3 tipColor = u_coloredFlames ? u_tipColors[i] : vec3(1.0, 0.65, 0.12);

    // Inner core: white-hot center of the wick (always white regardless of mode)
    float coreR = 0.006 * fs;
    float coreR2 = coreR * coreR;
    float core = exp(-dist2 / coreR2);
    vec3 coreColor = mix(vec3(1.0, 0.95, 0.85), vec3(1.0), u_coloredFlames ? 0.0 : 0.0) * core * 4.0 * u_displayIntensity;

    // Middle flame body: prop-colored or orange envelope
    float bodyR = 0.018 * fs;
    float bodyR2 = bodyR * bodyR;
    float body = exp(-dist2 / bodyR2);
    vec3 bodyColor = tipColor * body * 2.5 * u_displayIntensity;

    // Outer glow: softer version of prop color or red-orange
    float glowR = 0.035 * fs;
    float glowR2 = glowR * glowR;
    float glow = exp(-dist2 / glowR2);
    vec3 glowTint = u_coloredFlames ? tipColor * 0.4 : vec3(0.9, 0.25, 0.02);
    vec3 glowColor = glowTint * glow * 1.2 * u_displayIntensity;

    color += coreColor + bodyColor + glowColor;
    alpha = max(alpha, max(core, max(body * 0.9, glow * 0.5)));
  }

  alpha = min(alpha, 1.0);
  fragColor = vec4(color * alpha, alpha);
}
`;
```

**Step 2: Verify**

Run: `npm run check 2>&1 | head -20`
Expected: 0 errors (shader is a string, no TS impact)

**Step 3: Commit**

```bash
git add src/lib/shared/animation-engine/services/implementations/fire/FluidShaderSources.ts
git commit -m "feat(fire): add tintedBlackbody and color field sampling to display shader"
```

---

### Task 5: Wire new uniforms in WebGLFireRenderer display pass

**Files:**
- Modify: `src/lib/shared/animation-engine/services/implementations/fire/WebGLFireRenderer.ts`

**Step 1: Update `compileAllPrograms()` to include new uniforms**

In `compileAllPrograms()` (line 699), update the `displayProgram` build to include new uniform names:

```typescript
this.displayProgram = this.buildProgram(DISPLAY_FRAG, [
  "u_temperature", "u_fuel", "u_colorField", "u_displayIntensity",
  "u_tipCount", "u_aspectCorrect", "u_coloredFlames",
]);
```

**Step 2: Update `renderDisplay()` to pass color uniforms**

In `renderDisplay()` (line 550), after binding `u_fuel` to TEXTURE1 (line 569), add:

```typescript
// Color field texture for colored flames
gl.activeTexture(gl.TEXTURE2);
if (this.colorField && config.coloredFlames) {
  gl.bindTexture(gl.TEXTURE_2D, this.colorField.read.texture);
} else {
  // Bind a dummy (fuel texture) when not using colored flames
  gl.bindTexture(gl.TEXTURE_2D, this.fuel!.read.texture);
}
gl.uniform1i(prog.uniforms.get("u_colorField")!, 2);

// Colored flames toggle
gl.uniform1i(prog.uniforms.get("u_coloredFlames")!, config.coloredFlames ? 1 : 0);
```

**Step 3: Pass per-tip colors to shader**

In the tip uniform loop in `renderDisplay()` (line 576), after setting `scaleLoc`, add:

```typescript
const colorLoc = gl.getUniformLocation(prog.program, `u_tipColors[${i}]`);
if (colorLoc) {
  gl.uniform3f(
    colorLoc,
    this.displayTipColors[i * 3] ?? 1.0,
    this.displayTipColors[i * 3 + 1] ?? 0.65,
    this.displayTipColors[i * 3 + 2] ?? 0.12
  );
}
```

**Step 4: Verify**

Run: `npm run check 2>&1 | head -20`
Expected: 0 errors

**Step 5: Commit**

```bash
git add src/lib/shared/animation-engine/services/implementations/fire/WebGLFireRenderer.ts
git commit -m "feat(fire): wire color field and tip color uniforms in display pass"
```

---

### Task 6: Pass prop colors through AnimationRenderLoop

**Files:**
- Modify: `src/lib/shared/animation-engine/services/implementations/AnimationRenderLoop.ts`

**Step 1: Import types**

Add to imports at top:

```typescript
import type { PropFlameColor } from "../../domain/types/FireTypes";
import { DEFAULT_PROP_FLAME_COLORS } from "../../domain/types/FireTypes";
```

**Step 2: Pass propColors in the renderFire call**

In the `renderFire` call (line 324), update the `FireFrameInput` object to include `propColors`:

```typescript
this.fireRenderer.renderFire(
  {
    tips,
    currentTime,
    canvasWidth: this.canvasSize,
    canvasHeight: this.canvasSize,
    darkMode: params.darkMode ?? false,
    propColors: params.propColors ?? DEFAULT_PROP_FLAME_COLORS,
  },
  params.fireConfig
);
```

**Step 3: Find where `params` is typed and add `propColors`**

Search for the interface/type that defines `params` passed to the render loop. It likely includes `fireConfig`, `bluePropType`, etc. Add:

```typescript
propColors?: [PropFlameColor, PropFlameColor];
```

This will need to be traced from wherever the render loop params are defined. Check `AnimationFrameParams` or similar type.

**Step 4: Wire `coloredFlames` from visibility manager into fireConfig**

Find where `fireConfig` is built (likely in `AnimationEngine.svelte.ts` or similar orchestrator). The `coloredFlames` property from `AnimationVisibilityManager.isColoredFlamesEnabled()` needs to be included:

```typescript
fireConfig: {
  ...existingConfig,
  coloredFlames: animationVisibilityManager.isColoredFlamesEnabled(),
}
```

**Step 5: Verify**

Run: `npm run check 2>&1 | head -20`
Expected: 0 errors

**Step 6: Commit**

```bash
git add src/lib/shared/animation-engine/services/implementations/AnimationRenderLoop.ts
# Add any other files modified in steps 3-4
git commit -m "feat(fire): pass prop colors and coloredFlames through render pipeline"
```

---

### Task 7: Wire fire toggle and colored flames toggle into Visibility Tab

**Files:**
- Modify: `src/lib/shared/settings/components/tabs/VisibilityTab.svelte`
- Modify: `src/lib/shared/settings/components/tabs/visibility/AnimationPanel.svelte`
- Modify: `src/lib/shared/settings/components/tabs/visibility/AnimationDesktopControls.svelte`
- Modify: `src/lib/shared/settings/components/tabs/visibility/AnimationMobileControls.svelte`

**Step 1: Add state variables to VisibilityTab.svelte**

After `let animWordHeaderVisible` (line 59), add:

```typescript
let animFireEffectEnabled = $state(false);
let animColoredFlamesEnabled = $state(true);
```

**Step 2: Add toggle handlers to VisibilityTab.svelte**

In `handleAnimationToggle()` (line 136), add cases:

```typescript
case "fireEffect":
  animFireEffectEnabled = !animFireEffectEnabled;
  animationVisibilityManager.setFireEffect(animFireEffectEnabled);
  break;
case "coloredFlames":
  animColoredFlamesEnabled = !animColoredFlamesEnabled;
  animationVisibilityManager.setColoredFlames(animColoredFlamesEnabled);
  break;
```

**Step 3: Load initial values in onMount**

After loading `animWordHeaderVisible` (line 239), add:

```typescript
animFireEffectEnabled = animationVisibilityManager.isFireEffectEnabled();
animColoredFlamesEnabled = animationVisibilityManager.isColoredFlamesEnabled();
```

**Step 4: Sync in animation observer**

In the `animationObserver` callback (line 268), add:

```typescript
animFireEffectEnabled = animationVisibilityManager.isFireEffectEnabled();
animColoredFlamesEnabled = animationVisibilityManager.isColoredFlamesEnabled();
```

**Step 5: Pass new props to AnimationPanel**

In the `<AnimationPanel>` usage (line 330), add:

```typescript
fireEffectEnabled={animFireEffectEnabled}
coloredFlamesEnabled={animColoredFlamesEnabled}
```

**Step 6: Update AnimationPanel.svelte Props interface**

Add to `Props` interface (line 22):

```typescript
fireEffectEnabled: boolean;
coloredFlamesEnabled: boolean;
```

And destructure them in `$props()`.

**Step 7: Pass to Desktop and Mobile controls**

In both `<AnimationDesktopControls>` and `<AnimationMobileControls>`, pass:

```typescript
fireEffectEnabled={fireEffectEnabled}
coloredFlamesEnabled={coloredFlamesEnabled}
```

**Step 8: Add toggles to AnimationDesktopControls.svelte**

Add to Props interface and destructure. After the "Overlays" control group (line 142), add a new control group:

```svelte
<div class="control-group">
  <span class="group-label">Effects</span>
  <div class="toggle-grid">
    <button
      class="toggle-btn"
      class:active={fireEffectEnabled}
      aria-pressed={fireEffectEnabled}
      onclick={() => onToggle("fireEffect")}
      type="button"
    >
      <i class="fas fa-fire" aria-hidden="true"></i>
      Fire
    </button>
    {#if fireEffectEnabled}
      <button
        class="toggle-btn"
        class:active={coloredFlamesEnabled}
        aria-pressed={coloredFlamesEnabled}
        onclick={() => onToggle("coloredFlames")}
        type="button"
      >
        <i class="fas fa-palette" aria-hidden="true"></i>
        Colored
      </button>
    {/if}
  </div>
</div>
```

**Step 9: Add toggles to AnimationMobileControls.svelte**

Add to Props interface and destructure. After the trails row (Row 4), add:

```svelte
<!-- Row 5: Effects -->
<div class="mobile-row">
  <button
    class="compact-btn"
    class:active={fireEffectEnabled}
    aria-pressed={fireEffectEnabled}
    onclick={() => onToggle("fireEffect")}
    type="button"
  >
    <i class="fas fa-fire" aria-hidden="true"></i>
    <span>Fire</span>
  </button>
  {#if fireEffectEnabled}
    <button
      class="compact-btn"
      class:active={coloredFlamesEnabled}
      aria-pressed={coloredFlamesEnabled}
      onclick={() => onToggle("coloredFlames")}
      type="button"
    >
      <i class="fas fa-palette" aria-hidden="true"></i>
      <span>Colored</span>
    </button>
  {/if}
</div>
```

**Step 10: Verify**

Run: `npm run check 2>&1 | head -20`
Expected: 0 errors

**Step 11: Commit**

```bash
git add src/lib/shared/settings/components/tabs/VisibilityTab.svelte
git add src/lib/shared/settings/components/tabs/visibility/AnimationPanel.svelte
git add src/lib/shared/settings/components/tabs/visibility/AnimationDesktopControls.svelte
git add src/lib/shared/settings/components/tabs/visibility/AnimationMobileControls.svelte
git commit -m "feat(fire): add fire effect and colored flames toggles to visibility tab"
```

---

### Task 8: Trace render pipeline and wire `coloredFlames` + `propColors` end-to-end

This task requires reading the actual param types and orchestrator code to ensure the colored flames setting flows from the visibility manager all the way to `renderFire()`. The agent implementing this should:

**Files to read:**
- `src/lib/shared/animation-engine/services/implementations/AnimationEngine.svelte.ts` - find where `fireConfig` is constructed
- Search for `AnimationFrameParams` or equivalent type that includes `fireConfig`
- Find where `propColors` should be set based on current prop color state

**What to wire:**

1. In the `fireConfig` construction, add `coloredFlames: animationVisibilityManager.isColoredFlamesEnabled()`
2. Add `propColors` to the frame params, sourced from `TUNNEL_LAYER_COLORS[0]` for single performer mode (blue/red), or the active layer colors for tunnel mode
3. Use `hexToFlameColor()` to convert hex strings to normalized RGB

**Step 1: Read AnimationEngine.svelte.ts to find fireConfig construction**

Search for `fireConfig` in that file and add the `coloredFlames` property.

**Step 2: Find where to source prop colors**

For single performer, use `DEFAULT_PROP_FLAME_COLORS` from FireTypes.ts.
For tunnel/compose mode, convert `getTunnelLayerColors(layerIndex)` via `hexToFlameColor()`.

**Step 3: Verify**

Run: `npm run check 2>&1 | head -20`
Expected: 0 errors

**Step 4: Verify end-to-end**

Run: `npm run build 2>&1 | tail -5`
Expected: Build succeeds

**Step 5: Commit**

```bash
git add -A  # All files modified during this wiring task
git commit -m "feat(fire): wire coloredFlames and propColors end-to-end through render pipeline"
```

---

### Task 9: Manual verification

Ask the user to verify visually:

1. Open Settings > Visibility tab > Animation panel
2. Confirm "Fire" toggle appears in an "Effects" section
3. Toggle Fire ON — confirm flames appear
4. Confirm "Colored" toggle appears when fire is ON
5. With Colored ON — confirm blue prop has blue-tinted flames, red prop has red-tinted flames
6. Toggle Colored OFF — confirm flames revert to natural orange/yellow
7. Toggle Fire OFF — confirm "Colored" toggle disappears
8. Refresh page — confirm settings persist
