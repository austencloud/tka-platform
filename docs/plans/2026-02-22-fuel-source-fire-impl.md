# Fuel Source Fire System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the 8 abstract fire presets with 4 physics-informed fuel sources (White Gas, Lamp Oil, Isopropyl, Charcoal), simplify the end-user UI to fuel picker + intensity slider + color mode, build an admin fuel authoring environment, and create a new particle renderer for charcoal sparks.

**Architecture:** Fuel sources become Firestore documents loaded at app start with baked-in TypeScript fallbacks. The existing WebGL Navier-Stokes fluid sim handles liquid fuels with per-fuel color curves passed as shader uniforms. A new WebGL particle system handles charcoal sparks as ballistic particles. The `FireOverlayConfig` gains a `fuelSourceId` field replacing the old `physicsPreset`. The visibility state replaces `firePreset: "small"|"medium"|"large"` with `fuelSourceId: string` + `fireIntensity: number`.

**Tech Stack:** Svelte 5 + TypeScript + WebGL2 (GLSL 300 es) + Firebase Firestore + ITI dependency injection

**Design Doc:** `docs/plans/2026-02-22-fuel-source-fire-redesign.md`

---

## Phase 1: Domain Layer (Types + Data)

### Task 1.1: Create FuelSource interfaces

**Files:**
- Create: `src/lib/shared/animation-engine/domain/types/FuelSourceTypes.ts`

**Step 1: Create the fuel source type definitions**

```typescript
import type { FirePhysicsParams } from "./FireTypes";

/** Renderer type determines which WebGL pipeline handles this fuel */
export type FuelRendererType = "fluid" | "particle";

/** Color curve for the fluid renderer's display pass.
 *  Maps normalized temperature (0.0-1.0) through 4 color stops
 *  instead of the hardcoded blackbody ramp. */
export interface FireColorCurve {
  /** RGB [0-1] at lowest visible temperature (dark ember glow) */
  coldColor: [number, number, number];
  /** RGB [0-1] at mid combustion (main flame body) */
  midColor: [number, number, number];
  /** RGB [0-1] at peak combustion (bright flame) */
  hotColor: [number, number, number];
  /** RGB [0-1] at wick core (brightest point, near-white) */
  coreColor: [number, number, number];
}

/** Charcoal/steel wool particle physics params */
export interface CharcoalParams {
  /** Sparks emitted per second per tip */
  sparkRate: number;
  /** Seconds before a spark fades out completely */
  sparkLifetime: number;
  /** Multiplier on tip velocity for initial spark speed */
  sparkInitialSpeed: number;
  /** Scatter cone angle in degrees around tangential direction */
  sparkScatter: number;
  /** Base particle render size in pixels */
  sparkSize: number;
  /** Random size variation (0.0-1.0, multiplied by sparkSize) */
  sparkSizeVariance: number;
  /** Downward acceleration in units/s^2 */
  gravity: number;
  /** Air resistance coefficient (velocity decay per second) */
  dragCoefficient: number;
  /** Probability (0.0-1.0) of spawning secondary branching sparks */
  secondarySparkChance: number;
  /** How long ember glow persists after spark stops moving (seconds) */
  emberGlowDuration: number;
  /** Temperature decay rate (normalized units per ms) */
  coolingRate: number;
  /** Starting temperature in normalized units (1.0 = brightest) */
  initialTemperature: number;
}

/** A fuel source document — stored in Firestore, with baked-in defaults */
export interface FuelSourceDocument {
  /** Unique identifier: "white-gas", "lamp-oil", "isopropyl", "charcoal" */
  id: string;
  /** Display name shown in the fuel picker */
  name: string;
  /** One-line description */
  description: string;
  /** Which rendering pipeline this fuel uses */
  rendererType: FuelRendererType;
  /** Navier-Stokes physics params (required when rendererType === "fluid") */
  fluidParams?: FirePhysicsParams;
  /** Display color curve (required when rendererType === "fluid") */
  colorCurve?: FireColorCurve;
  /** Charcoal spark params (required when rendererType === "particle") */
  particleParams?: CharcoalParams;
  /** true for the 4 built-in defaults, false for admin-created custom fuels */
  builtIn: boolean;
  /** Sort order in the picker */
  sortOrder: number;
}

/** The fuel source ID stored in user settings */
export const DEFAULT_FUEL_SOURCE_ID = "white-gas";
```

**Step 2: Commit**

```bash
git add src/lib/shared/animation-engine/domain/types/FuelSourceTypes.ts
git commit -m "feat(fire): add FuelSource type definitions"
```

---

### Task 1.2: Create built-in fuel source defaults

**Files:**
- Create: `src/lib/shared/animation-engine/domain/types/BuiltInFuelSources.ts`

**Step 1: Define the 4 built-in fuel sources with physics-informed parameters**

Use the physics research data from the design doc to set parameter values. Each fuel source includes a complete `FirePhysicsParams`, a `FireColorCurve`, or `CharcoalParams` as appropriate.

```typescript
import type { FuelSourceDocument, FireColorCurve, CharcoalParams } from "./FuelSourceTypes";
import type { FirePhysicsParams } from "./FireTypes";

// --- White Gas: bright, fast burn, standard fire spinning fuel ---
const WHITE_GAS_PHYSICS: FirePhysicsParams = {
  splatRadius: 0.012,
  fuelAmount: 1.0,
  velocityInjectScale: 0.001,
  velocityDissipation: 0.935,
  temperatureDissipation: 0.93,
  fuelDissipation: 0.93,
  vorticityStrength: 8.0,
  buoyancyStrength: 80.0,
  burnRate: 5.0,
  fuelEfficiency: 2.5,
  coolingRate: 4.0,
  pressureDissipation: 0.8,
  temperatureInjection: 1.5,
  upwardBias: 3.0,
};

const WHITE_GAS_COLOR: FireColorCurve = {
  coldColor: [0.2, 0.02, 0.0],       // dark ember
  midColor: [0.9, 0.15, 0.0],        // bright orange
  hotColor: [1.0, 0.55, 0.05],       // orange-yellow
  coreColor: [1.0, 0.9, 0.35],       // near-white yellow
};

// --- Lamp Oil: deep orange, slow burn, lingering trails ---
const LAMP_OIL_PHYSICS: FirePhysicsParams = {
  splatRadius: 0.014,
  fuelAmount: 0.75,
  velocityInjectScale: 0.0008,
  velocityDissipation: 0.965,        // higher = longer trails
  temperatureDissipation: 0.96,
  fuelDissipation: 0.96,
  vorticityStrength: 5.0,            // less turbulent
  buoyancyStrength: 55.0,            // less buoyancy (cooler flame)
  burnRate: 2.8,                     // slower burn
  fuelEfficiency: 2.0,
  coolingRate: 2.0,                  // slower cooling = longer visible trail
  pressureDissipation: 0.8,
  temperatureInjection: 1.2,
  upwardBias: 2.2,
};

const LAMP_OIL_COLOR: FireColorCurve = {
  coldColor: [0.18, 0.01, 0.0],      // deep dark red
  midColor: [0.75, 0.08, 0.0],       // deep reddish-orange
  hotColor: [0.94, 0.39, 0.08],      // warm orange
  coreColor: [1.0, 0.75, 0.25],      // amber-white
};

// --- Isopropyl: blue-purple, fast burn, minimal soot, ethereal ---
const ISOPROPYL_PHYSICS: FirePhysicsParams = {
  splatRadius: 0.010,
  fuelAmount: 0.55,                  // less fuel density
  velocityInjectScale: 0.0012,
  velocityDissipation: 0.90,         // shorter trails
  temperatureDissipation: 0.89,
  fuelDissipation: 0.90,
  vorticityStrength: 10.0,           // more turbulent (lighter gas)
  buoyancyStrength: 95.0,            // stronger updraft
  burnRate: 6.0,                     // very fast burn
  fuelEfficiency: 1.8,
  coolingRate: 6.0,                  // rapid cooling
  pressureDissipation: 0.8,
  temperatureInjection: 1.0,
  upwardBias: 3.5,
};

const ISOPROPYL_COLOR: FireColorCurve = {
  coldColor: [0.0, 0.02, 0.15],      // deep blue
  midColor: [0.05, 0.1, 0.7],        // blue
  hotColor: [0.15, 0.25, 0.9],       // bright blue-purple
  coreColor: [0.6, 0.7, 1.0],        // pale blue-white
};

// --- Charcoal: spark shower, particle system ---
const CHARCOAL_PARTICLES: CharcoalParams = {
  sparkRate: 120,                    // sparks per second per tip
  sparkLifetime: 0.8,               // seconds
  sparkInitialSpeed: 1.2,           // multiplier on tip velocity
  sparkScatter: 100,                // degrees
  sparkSize: 3.0,                   // pixels
  sparkSizeVariance: 0.5,           // 50% random size variation
  gravity: 150,                     // downward accel
  dragCoefficient: 2.0,             // air resistance
  secondarySparkChance: 0.15,       // 15% chance of branching
  emberGlowDuration: 0.3,          // seconds of residual glow
  coolingRate: 0.002,               // temperature decay per ms
  initialTemperature: 1.0,          // full brightness at ejection
};

/** The 4 built-in fuel sources, physics-informed from combustion research */
export const BUILT_IN_FUEL_SOURCES: FuelSourceDocument[] = [
  {
    id: "white-gas",
    name: "White Gas",
    description: "Bright, fast burn. The standard.",
    rendererType: "fluid",
    fluidParams: WHITE_GAS_PHYSICS,
    colorCurve: WHITE_GAS_COLOR,
    builtIn: true,
    sortOrder: 0,
  },
  {
    id: "lamp-oil",
    name: "Lamp Oil",
    description: "Deep orange, lingering trails.",
    rendererType: "fluid",
    fluidParams: LAMP_OIL_PHYSICS,
    colorCurve: LAMP_OIL_COLOR,
    builtIn: true,
    sortOrder: 1,
  },
  {
    id: "isopropyl",
    name: "Isopropyl",
    description: "Blue-purple, ethereal glow.",
    rendererType: "fluid",
    fluidParams: ISOPROPYL_PHYSICS,
    colorCurve: ISOPROPYL_COLOR,
    builtIn: true,
    sortOrder: 2,
  },
  {
    id: "charcoal",
    name: "Charcoal",
    description: "Spark showers from burning steel.",
    rendererType: "particle",
    particleParams: CHARCOAL_PARTICLES,
    builtIn: true,
    sortOrder: 3,
  },
];

/** Look up a built-in fuel source by ID */
export function getBuiltInFuelSource(id: string): FuelSourceDocument | undefined {
  return BUILT_IN_FUEL_SOURCES.find((f) => f.id === id);
}
```

**Step 2: Commit**

```bash
git add src/lib/shared/animation-engine/domain/types/BuiltInFuelSources.ts
git commit -m "feat(fire): add 4 built-in fuel sources with physics-informed params"
```

---

### Task 1.3: Update FireOverlayConfig to use fuel source

**Files:**
- Modify: `src/lib/shared/animation-engine/domain/types/FireTypes.ts`

**Step 1: Add fuel source fields to FireOverlayConfig**

Add these fields to the `FireOverlayConfig` interface (keep `physicsPreset` for backward compatibility during migration):

```typescript
// Add import at top of file
import type { FireColorCurve, FuelRendererType, CharcoalParams } from "./FuelSourceTypes";

// Add to FireOverlayConfig interface:
  /** Active fuel source ID (replaces preset system) */
  fuelSourceId?: string;
  /** Which renderer to use for this fuel */
  fuelRendererType?: FuelRendererType;
  /** Color curve for the fluid renderer display pass */
  colorCurve?: FireColorCurve;
  /** Charcoal particle params (when fuelRendererType === "particle") */
  charcoalParams?: CharcoalParams;
```

Update `DEFAULT_FIRE_CONFIG` to include `fuelSourceId: "white-gas"`.

**Step 2: Commit**

```bash
git add src/lib/shared/animation-engine/domain/types/FireTypes.ts
git commit -m "feat(fire): add fuel source fields to FireOverlayConfig"
```

---

## Phase 2: Fuel Source Loader (Firestore + Fallback)

### Task 2.1: Create FuelSourceLoader

**Files:**
- Create: `src/lib/shared/animation-engine/services/contracts/IFuelSourceLoader.ts`
- Create: `src/lib/shared/animation-engine/services/implementations/FuelSourceLoader.ts`

**Step 1: Create the interface**

```typescript
// IFuelSourceLoader.ts
import type { FuelSourceDocument } from "../../domain/types/FuelSourceTypes";

export interface IFuelSourceLoader {
  /** Load fuel sources from Firestore (with baked-in fallback) */
  load(): Promise<void>;
  /** Get all available fuel sources, sorted by sortOrder */
  getAll(): FuelSourceDocument[];
  /** Get a specific fuel source by ID */
  get(id: string): FuelSourceDocument | undefined;
  /** Subscribe to real-time updates from Firestore */
  subscribe(callback: () => void): void;
}
```

**Step 2: Create the implementation**

The loader:
1. Fetches Firestore collection `config/fuelSources` (if connected)
2. Falls back to `BUILT_IN_FUEL_SOURCES` if offline or collection doesn't exist yet
3. Caches in localStorage under `"tka-fuel-sources-cache"`
4. Merges Firestore docs with built-in defaults (Firestore overrides built-in params for matching IDs, plus any custom fuels admin created)
5. Provides `subscribe()` for real-time `onSnapshot` listener

Pattern: follow `FireDefaultsLoader.ts` exactly (same file at `src/lib/shared/animation-engine/services/implementations/FireDefaultsLoader.ts`). Same localStorage fallback pattern, same `onSnapshot` subscription model.

Key difference: this loads a **collection** (`config/fuelSources/*`) not a single document.

**Step 3: Commit**

```bash
git add src/lib/shared/animation-engine/services/contracts/IFuelSourceLoader.ts \
        src/lib/shared/animation-engine/services/implementations/FuelSourceLoader.ts
git commit -m "feat(fire): add FuelSourceLoader with Firestore + baked-in fallback"
```

---

### Task 2.2: Create FuelSourcePublisher (admin only)

**Files:**
- Create: `src/lib/shared/animation-engine/services/contracts/IFuelSourcePublisher.ts`
- Create: `src/lib/shared/animation-engine/services/implementations/FuelSourcePublisher.ts`

**Step 1: Create the interface**

```typescript
// IFuelSourcePublisher.ts
import type { FuelSourceDocument } from "../../domain/types/FuelSourceTypes";

export interface IFuelSourcePublisher {
  /** Publish a single fuel source to Firestore */
  publish(fuelSource: FuelSourceDocument): Promise<void>;
  /** Publish all fuel sources (full replace) */
  publishAll(fuelSources: FuelSourceDocument[]): Promise<void>;
  /** Delete a custom (non-built-in) fuel source */
  delete(id: string): Promise<void>;
}
```

**Step 2: Implement using Firestore `setDoc` / `deleteDoc`**

Write to `config/fuelSources/{id}`. Only allow deletion of documents where `builtIn === false`.

Pattern: follow `FireDefaultsPublisher.ts` (at `src/lib/shared/animation-engine/services/implementations/FireDefaultsPublisher.ts`).

**Step 3: Commit**

```bash
git add src/lib/shared/animation-engine/services/contracts/IFuelSourcePublisher.ts \
        src/lib/shared/animation-engine/services/implementations/FuelSourcePublisher.ts
git commit -m "feat(fire): add FuelSourcePublisher for admin fuel authoring"
```

---

### Task 2.3: Register in DI container

**Files:**
- Modify: `src/lib/shared/di/containers/flame-lab-container.ts`

**Step 1: Add FuelSourceLoader and FuelSourcePublisher registrations**

Add alongside existing `fireDefaultsLoader` and `fireDefaultsPublisher`:

```typescript
import { FuelSourceLoader } from "../../shared/animation-engine/services/implementations/FuelSourceLoader";
import { FuelSourcePublisher } from "../../shared/animation-engine/services/implementations/FuelSourcePublisher";

// In container chain:
.add({
  fuelSourceLoader: () => new FuelSourceLoader(),
  fuelSourcePublisher: () => new FuelSourcePublisher(),
})
```

**Step 2: Commit**

```bash
git add src/lib/shared/di/containers/flame-lab-container.ts
git commit -m "feat(fire): register fuel source services in DI container"
```

---

## Phase 3: Shader Modifications (Per-Fuel Color Curves)

### Task 3.1: Add color curve uniforms to display shader

**Files:**
- Modify: `src/lib/shared/animation-engine/services/implementations/fire/FluidShaderSources.ts`

**Step 1: Replace hardcoded blackbodyColor with uniform-driven color curve**

In `DISPLAY_FRAG`, replace the hardcoded `blackbodyColor()` function with one that uses 4 uniform color stops:

```glsl
// Add uniforms after existing ones:
uniform vec3 u_colorCold;   // FireColorCurve.coldColor
uniform vec3 u_colorMid;    // FireColorCurve.midColor
uniform vec3 u_colorHot;    // FireColorCurve.hotColor
uniform vec3 u_colorCore;   // FireColorCurve.coreColor

// Replace blackbodyColor():
vec3 blackbodyColor(float t) {
  vec3 color;
  if (t < 0.4) {
    color = u_colorCold * (t / 0.4);
  } else if (t < 1.0) {
    float f = (t - 0.4) / 0.6;
    color = mix(u_colorCold, u_colorMid, f);
  } else if (t < 2.0) {
    float f = (t - 1.0);
    color = mix(u_colorMid, u_colorHot, f);
  } else if (t < 3.5) {
    float f = (t - 2.0) / 1.5;
    color = mix(u_colorHot, u_colorCore, f);
  } else {
    float f = clamp((t - 3.5) / 2.0, 0.0, 1.0);
    color = mix(u_colorCore, vec3(1.0, 0.98, 0.9), f);
  }
  return color;
}
```

The wick core colors (in the tip rendering section, lines 449-468) should also adapt:
- `tipColor` base: use `mix(u_colorHot, u_tipColors[i], u_colorBlend)` instead of hardcoded `vec3(1.0, 0.65, 0.12)`
- `coreColor`: use `mix(u_colorCore, vec3(1.0, 0.95, 0.85), 0.5)` to blend fuel core with white
- `glowTint`: use `mix(u_colorMid, u_tipColors[i] * 0.4, u_colorBlend)` instead of hardcoded `vec3(0.9, 0.25, 0.02)`

**Step 2: Commit**

```bash
git add src/lib/shared/animation-engine/services/implementations/fire/FluidShaderSources.ts
git commit -m "feat(fire): parameterize display shader color curve via uniforms"
```

---

### Task 3.2: Pass color curve uniforms from WebGLFireRenderer

**Files:**
- Modify: `src/lib/shared/animation-engine/services/implementations/fire/WebGLFireRenderer.ts`

**Step 1: Cache uniform locations for the 4 color curve uniforms**

In the `init()` method where uniform locations are cached, add:

```typescript
private uColorCold: WebGLUniformLocation | null = null;
private uColorMid: WebGLUniformLocation | null = null;
private uColorHot: WebGLUniformLocation | null = null;
private uColorCore: WebGLUniformLocation | null = null;
```

Initialize in `init()` alongside other display uniform lookups.

**Step 2: Set color curve uniforms in renderDisplay()**

In the `renderDisplay()` method, before the draw call, set the uniforms from `config.colorCurve`:

```typescript
const curve = config.colorCurve ?? DEFAULT_COLOR_CURVE;
gl.uniform3fv(this.uColorCold, curve.coldColor);
gl.uniform3fv(this.uColorMid, curve.midColor);
gl.uniform3fv(this.uColorHot, curve.hotColor);
gl.uniform3fv(this.uColorCore, curve.coreColor);
```

Import `WHITE_GAS_COLOR` from `BuiltInFuelSources.ts` as `DEFAULT_COLOR_CURVE` (it matches the current hardcoded values).

**Step 3: Commit**

```bash
git add src/lib/shared/animation-engine/services/implementations/fire/WebGLFireRenderer.ts
git commit -m "feat(fire): pass per-fuel color curve uniforms to display shader"
```

---

## Phase 4: Charcoal Particle Renderer

### Task 4.1: Create charcoal shader sources

**Files:**
- Create: `src/lib/shared/animation-engine/services/implementations/fire/CharcoalShaderSources.ts`

**Step 1: Write vertex + fragment shaders for spark particles**

Vertex shader:
- Input: per-particle attributes (position, velocity, age, size, temperature)
- Transform: apply aspect correction, output point size based on distance + particle size
- Pass temperature to fragment for color lookup

Fragment shader:
- Circular point sprite (discard outside radius)
- Color: blackbody curve from orange-white (hot) → dark red (cool) → invisible
- Alpha fades with age (temperature decay)
- Soft edge with smoothstep for anti-aliasing

```glsl
// CHARCOAL_VERT
#version 300 es
precision highp float;

in vec2 a_position;     // current XY in UV space [0,1]
in float a_temperature; // normalized 0-1 (1=hot, 0=cold)
in float a_size;        // point size in pixels

uniform vec2 u_aspectCorrect;
uniform float u_displayIntensity;

out float v_temperature;

void main() {
  vec2 pos = a_position * 2.0 - 1.0; // UV to clip space
  gl_Position = vec4(pos, 0.0, 1.0);
  gl_PointSize = a_size * u_displayIntensity;
  v_temperature = a_temperature;
}
```

```glsl
// CHARCOAL_FRAG
#version 300 es
precision highp float;

in float v_temperature;
out vec4 fragColor;

void main() {
  // Circular point sprite
  vec2 center = gl_PointCoord - 0.5;
  float dist = length(center);
  if (dist > 0.5) discard;

  // Soft edge
  float alpha = smoothstep(0.5, 0.3, dist);

  // Blackbody color from temperature
  vec3 color;
  if (v_temperature > 0.7) {
    // White-orange (freshly ejected)
    float f = (v_temperature - 0.7) / 0.3;
    color = mix(vec3(1.0, 0.5, 0.05), vec3(1.0, 0.85, 0.6), f);
  } else if (v_temperature > 0.3) {
    // Orange to dark red
    float f = (v_temperature - 0.3) / 0.4;
    color = mix(vec3(0.6, 0.08, 0.0), vec3(1.0, 0.5, 0.05), f);
  } else {
    // Dark red to invisible
    float f = v_temperature / 0.3;
    color = vec3(0.6, 0.08, 0.0) * f;
    alpha *= f;
  }

  alpha *= v_temperature; // overall fade with cooling
  fragColor = vec4(color * alpha, alpha);
}
```

**Step 2: Commit**

```bash
git add src/lib/shared/animation-engine/services/implementations/fire/CharcoalShaderSources.ts
git commit -m "feat(fire): add charcoal spark particle shaders"
```

---

### Task 4.2: Create CharcoalParticleRenderer

**Files:**
- Create: `src/lib/shared/animation-engine/services/contracts/ICharcoalRenderer.ts`
- Create: `src/lib/shared/animation-engine/services/implementations/fire/CharcoalParticleRenderer.ts`

**Step 1: Create the interface**

```typescript
import type { FireFrameInput, FireOverlayConfig } from "../../../domain/types/FireTypes";

export interface ICharcoalRenderer {
  init(canvas: HTMLCanvasElement, gl: WebGL2RenderingContext): void;
  renderSparks(input: FireFrameInput, config: FireOverlayConfig): void;
  dispose(): void;
}
```

**Step 2: Implement the particle system**

Core architecture:
- **Particle pool**: Pre-allocated array of ~2000 particles (position, velocity, temperature, size, age, alive)
- **Emission**: On each frame, for each tip, spawn `sparkRate * dt` particles. Initial velocity = tip velocity * `sparkInitialSpeed`, scattered within `sparkScatter` degree cone around tangential direction.
- **Simulation**: For each alive particle: apply gravity, apply drag (`velocity *= 1 - dragCoefficient * dt`), update position, cool temperature (`temp -= coolingRate * dt_ms`), check for secondary spark chance.
- **Rendering**: Upload alive particles to a VBO, draw with `gl.POINTS` using the charcoal shaders.
- **Recycling**: When `temperature <= 0` or `age > sparkLifetime`, mark dead and recycle slot.

WebGL setup:
- Compile charcoal shaders from `CharcoalShaderSources.ts`
- Create a dynamic VBO with `gl.DYNAMIC_DRAW` for particle data
- Each particle: 5 floats (x, y, temperature, size, unused) = 20 bytes
- Max 2048 particles * 20 bytes = ~40KB VBO

Important: The charcoal renderer must share the same `WebGL2RenderingContext` and canvas as the fluid fire renderer. The `AnimationEngine` will call one or the other based on `config.fuelRendererType`.

**Step 3: Commit**

```bash
git add src/lib/shared/animation-engine/services/contracts/ICharcoalRenderer.ts \
        src/lib/shared/animation-engine/services/implementations/fire/CharcoalParticleRenderer.ts
git commit -m "feat(fire): add CharcoalParticleRenderer with particle physics"
```

---

### Task 4.3: Integrate charcoal renderer into AnimationEngine

**Files:**
- Modify: `src/lib/shared/animation-engine/services/implementations/AnimationEngine.svelte.ts`

**Step 1: Create and manage charcoal renderer lifecycle**

The `AnimationEngine` already creates `WebGLFireRenderer`. Add a `CharcoalParticleRenderer` alongside it:

```typescript
import { CharcoalParticleRenderer } from "./fire/CharcoalParticleRenderer";

// In constructor/init:
private charcoalRenderer: CharcoalParticleRenderer | null = null;

// Initialize alongside fire renderer:
this.charcoalRenderer = new CharcoalParticleRenderer();
this.charcoalRenderer.init(this.fireCanvas, this.fireGl);
```

**Step 2: Route rendering based on fuel renderer type**

In the render loop where `this.fireRenderer.renderFire(input, config)` is called, add a branch:

```typescript
if (this.fireConfig.fuelRendererType === "particle") {
  this.charcoalRenderer?.renderSparks(input, this.fireConfig);
} else {
  this.fireRenderer?.renderFire(input, this.fireConfig);
}
```

Make sure to clear the fire canvas before rendering either path (the existing code likely already does this).

**Step 3: Dispose charcoal renderer in cleanup**

Add `this.charcoalRenderer?.dispose()` to the existing cleanup/destroy method.

**Step 4: Commit**

```bash
git add src/lib/shared/animation-engine/services/implementations/AnimationEngine.svelte.ts
git commit -m "feat(fire): integrate charcoal renderer into animation engine"
```

---

## Phase 5: Visibility State Migration

### Task 5.1: Replace firePreset with fuelSourceId + fireIntensity

**Files:**
- Modify: `src/lib/shared/animation-engine/state/animation-visibility-state.svelte.ts`
- Modify: `src/lib/shared/animation-engine/domain/types/FireDefaultsDocument.ts`

**Step 1: Update AnimationVisibilitySettings interface**

Replace:
```typescript
firePreset: string; // Fire intensity tier ID (small, medium, large)
```

With:
```typescript
fuelSourceId: string;    // Active fuel source: "white-gas", "lamp-oil", "isopropyl", "charcoal"
fireIntensity: number;   // User intensity slider value (0.1-3.0)
```

**Step 2: Update default values**

In the defaults initialization:
```typescript
fuelSourceId: "white-gas",
fireIntensity: 1.0,
```

**Step 3: Add migration for existing users' localStorage**

In the `loadFromStorage()` migration section (around line 158-166), add:

```typescript
// Migrate old firePreset to fuelSourceId + fireIntensity
if ("firePreset" in parsed && !("fuelSourceId" in parsed)) {
  const tierToIntensity: Record<string, number> = {
    small: 0.35,
    medium: 0.5,
    large: 1.0,
  };
  parsed.fireIntensity = tierToIntensity[parsed.firePreset] ?? 0.5;
  parsed.fuelSourceId = "white-gas"; // all old users default to white gas
  delete parsed.firePreset;
}
```

**Step 4: Update getter/setter methods**

Replace `getFirePreset()` / `setFirePreset()` with:

```typescript
getFuelSourceId(): string {
  return this.settings.fuelSourceId;
}

setFuelSourceId(id: string): void {
  this.settings.fuelSourceId = id;
  this.saveToStorage();
  this.notifyObservers();
}

getFireIntensity(): number {
  return this.settings.fireIntensity;
}

setFireIntensity(intensity: number): void {
  this.settings.fireIntensity = Math.max(0.1, Math.min(3.0, intensity));
  this.saveToStorage();
  this.notifyObservers();
}
```

**Step 5: Update the Exclude<> type unions**

Replace `"firePreset"` with `"fuelSourceId" | "fireIntensity"` in the 3 `Exclude<>` type constraints (at `getVisibility`, `setVisibility`, `toggleVisibility`).

**Step 6: Remove FIRE_INTENSITY_TIERS from FireDefaultsDocument.ts**

Delete `FireIntensityTier` type and `FIRE_INTENSITY_TIERS` constant. These are no longer needed.

**Step 7: Commit**

```bash
git add src/lib/shared/animation-engine/state/animation-visibility-state.svelte.ts \
        src/lib/shared/animation-engine/domain/types/FireDefaultsDocument.ts
git commit -m "feat(fire): replace firePreset tiers with fuelSourceId + fireIntensity"
```

---

### Task 5.2: Update AnimationEngine to use fuel sources

**Files:**
- Modify: `src/lib/shared/animation-engine/services/implementations/AnimationEngine.svelte.ts`

**Step 1: Replace FIRE_INTENSITY_TIERS logic with fuel source lookup**

Remove import of `FIRE_INTENSITY_TIERS` and `FireIntensityTier`.

Add import of `FuelSourceLoader` and `BUILT_IN_FUEL_SOURCES`.

In the visibility observer section (around lines 456-470), replace the fire preset sync block:

```typescript
// Old: sync fire intensity tier
// New: sync fuel source
const fuelId = vm.getFuelSourceId();
const intensity = vm.getFireIntensity();
if (fuelId !== this.prevFuelSourceId || intensity !== this.prevFireIntensity) {
  this.prevFuelSourceId = fuelId;
  this.prevFireIntensity = intensity;

  const fuelSource = this.fuelSourceLoader?.get(fuelId)
    ?? BUILT_IN_FUEL_SOURCES.find(f => f.id === fuelId)
    ?? BUILT_IN_FUEL_SOURCES[0]; // fallback to white gas

  this.setFireConfig({
    fuelSourceId: fuelSource.id,
    fuelRendererType: fuelSource.rendererType,
    intensity,
    flameHeight: 1.0, // baked into fuel source physics
    physicsPreset: fuelSource.fluidParams,
    colorCurve: fuelSource.colorCurve,
    charcoalParams: fuelSource.particleParams,
  });
}
```

Add `private prevFuelSourceId = ""` and `private prevFireIntensity = 0` fields.

**Step 2: Commit**

```bash
git add src/lib/shared/animation-engine/services/implementations/AnimationEngine.svelte.ts
git commit -m "feat(fire): wire AnimationEngine to fuel source lookup"
```

---

## Phase 6: Settings UI (End User)

### Task 6.1: Create FuelSourcePicker component

**Files:**
- Create: `src/lib/shared/animation-engine/components/FuelSourcePicker.svelte`

**Step 1: Build the fuel picker component**

A row of 3 liquid fuel buttons + a full-width charcoal button below them. Each button shows the fuel name and is highlighted when active.

Props:
```typescript
interface Props {
  fuelSources: FuelSourceDocument[];
  activeFuelId: string;
  onSelect: (id: string) => void;
}
```

Layout: CSS grid. Top row = 3 equal columns for fluid fuels. Bottom row = 1 full-width column for charcoal. Active state uses `--theme-accent` border. Buttons have `aria-pressed` for accessibility.

Style the buttons with a subtle color tint reflecting each fuel's character:
- White Gas: warm orange tint
- Lamp Oil: deep amber tint
- Isopropyl: cool blue tint
- Charcoal: dark ember/red tint

Use CSS custom properties from `styling.md` (`--theme-card-bg`, `--theme-stroke`, `--theme-accent`, etc.).

**Step 2: Commit**

```bash
git add src/lib/shared/animation-engine/components/FuelSourcePicker.svelte
git commit -m "feat(fire): add FuelSourcePicker component"
```

---

### Task 6.2: Replace S/M/L buttons with fuel picker + intensity slider

**Files:**
- Modify: `src/lib/shared/settings/components/tabs/visibility/AnimationDesktopControls.svelte`
- Modify: `src/lib/shared/settings/components/tabs/visibility/AnimationMobileControls.svelte`

**Step 1: Replace the flame-mode-row (S/M/L) in both files**

Remove the S/M/L preset buttons. Replace with:

1. `<FuelSourcePicker>` using fuel sources from the loader
2. Intensity slider (range 0.1-3.0, step 0.1)

The `onFirePresetChange` callback becomes `onFuelSourceChange(id: string)` + `onFireIntensityChange(value: number)`.

Keep the existing Natural/Colored flame color row as-is.

**Step 2: Update prop chain**

Trace the prop chain upward through `AnimationPanel.svelte` → `VisibilityTab.svelte` and update:
- `firePreset` prop → `fuelSourceId` prop
- `onFirePresetChange` → `onFuelSourceChange`
- Add `fireIntensity` prop + `onFireIntensityChange` callback
- These call `visibilityManager.setFuelSourceId()` and `visibilityManager.setFireIntensity()`

**Step 3: Commit**

```bash
git add src/lib/shared/settings/components/tabs/visibility/AnimationDesktopControls.svelte \
        src/lib/shared/settings/components/tabs/visibility/AnimationMobileControls.svelte
git commit -m "feat(fire): replace S/M/L buttons with fuel picker + intensity slider"
```

---

## Phase 7: Flame Lab Tuning Tab Redesign

### Task 7.1: Replace preset grid with fuel source editor

**Files:**
- Modify: `src/lib/features/flame-lab/components/FlameLabTuningTab.svelte`

**Step 1: Replace FIRE_PRESETS import and preset card grid**

Remove:
- `import { FIRE_PRESETS } from "..." `
- The `{#each FIRE_PRESETS as preset}` block (lines 824-837)
- `activePresetId` state and `activePreset` derived
- `adjustedPhysics` derived (trail length modifier)
- Trail Length slider
- Flame Height slider

Add:
- Import `BUILT_IN_FUEL_SOURCES` and `FuelSourceDocument` types
- `FuelSourcePicker` component at top of fire effect section
- Load fuel sources via DI container's `fuelSourceLoader`
- When a fuel source is selected, populate the physics editor fields from its params
- Single intensity slider (already exists, just remove the other two)

**Step 2: Add grouped physics parameter editors (admin only)**

Below the fuel picker, show 4 collapsible sections:

1. **Combustion**: burnRate, fuelAmount, fuelEfficiency, temperatureInjection
2. **Convection**: buoyancyStrength, upwardBias
3. **Persistence**: velocityDissipation, temperatureDissipation, fuelDissipation, coolingRate
4. **Turbulence**: vorticityStrength, splatRadius, pressureDissipation, velocityInjectScale

Each param gets a labeled slider with the range from `FirePhysicsParams` docs. Show human-readable labels, not internal param names:
- `burnRate` → "Burn speed"
- `fuelAmount` → "Fuel density"
- `coolingRate` → "Cooling speed"
- `vorticityStrength` → "Turbulence"
- etc.

For charcoal fuel, show charcoal-specific params instead:
- "Spark rate", "Spark lifetime", "Scatter angle", "Gravity", "Drag", "Secondary spark chance", etc.

**Step 3: Add color curve editor**

4 color pickers (cold/mid/hot/core) for fluid fuels. Use native `<input type="color">` with the current curve values pre-populated.

**Step 4: Update fireConfig derivation**

Replace the old `adjustedPhysics` derived with direct fuel source params:

```typescript
let fireConfig = $derived({
  enabled: fireEnabled,
  intensity,
  flameHeight: 1.0,
  velocityReactive: true,
  quality: 4,
  fuelSourceId: activeFuelId,
  fuelRendererType: activeFuel?.rendererType ?? "fluid",
  physicsPreset: editedFluidParams,
  colorCurve: editedColorCurve,
  charcoalParams: editedCharcoalParams,
});
```

**Step 5: Update publish flow**

`publishToProduction()` should now publish fuel sources via `FuelSourcePublisher` instead of (or in addition to) the old `FireDefaultsPublisher`. The admin edits the fuel source params, then publishes the full fuel source document.

**Step 6: Commit**

```bash
git add src/lib/features/flame-lab/components/FlameLabTuningTab.svelte
git commit -m "feat(fire): replace preset grid with fuel source editor in Flame Lab"
```

---

## Phase 8: Cleanup & Migration

### Task 8.1: Deprecate old preset system

**Files:**
- Modify: `src/lib/shared/animation-engine/domain/types/FirePresets.ts`

**Step 1: Mark as deprecated**

Add `@deprecated` JSDoc to all exports. Don't delete yet - the file may have other consumers. Leave for a future cleanup pass.

```typescript
/** @deprecated Use FuelSourceTypes and BuiltInFuelSources instead */
export const FIRE_PRESETS: FirePreset[] = [ ... ];
```

**Step 2: Commit**

```bash
git add src/lib/shared/animation-engine/domain/types/FirePresets.ts
git commit -m "chore(fire): deprecate old FirePresets in favor of fuel sources"
```

---

### Task 8.2: TypeScript check + build verification

**Step 1: Run full typecheck**

```bash
npm run check
```

Fix any type errors from the migration (likely in files that still reference `firePreset`, `FIRE_INTENSITY_TIERS`, `getFirePreset`, or `setFirePreset`).

Common fixes:
- Search for `firePreset` across codebase, update to `fuelSourceId`
- Search for `FIRE_INTENSITY_TIERS`, remove references
- Search for `getFirePreset` / `setFirePreset`, update to `getFuelSourceId` / `setFuelSourceId`

**Step 2: Run build**

```bash
npm run build
```

**Step 3: Commit any remaining fixes**

```bash
git add -A
git commit -m "fix(fire): resolve type errors from fuel source migration"
```

---

### Task 8.3: Seed Firestore with default fuel sources

**Files:**
- Create: `scripts/seed-fuel-sources.js`

**Step 1: Write a one-shot script that uploads the 4 built-in fuel sources to Firestore**

```javascript
// node scripts/seed-fuel-sources.js
// Uploads BUILT_IN_FUEL_SOURCES to config/fuelSources/* in Firestore
```

Use the Firebase Admin SDK pattern from existing seed scripts. Read the built-in fuel source constants and write them as documents.

This is a one-time bootstrap for production. After this, the admin edits via Flame Lab UI.

**Step 2: Commit**

```bash
git add scripts/seed-fuel-sources.js
git commit -m "chore(fire): add Firestore fuel source seed script"
```

---

## Phase Summary

| Phase | Tasks | What It Delivers |
|-------|-------|------------------|
| 1 | 1.1-1.3 | Type definitions + built-in fuel data + FireOverlayConfig update |
| 2 | 2.1-2.3 | Firestore loader/publisher + DI registration |
| 3 | 3.1-3.2 | Per-fuel color curves in WebGL display shader |
| 4 | 4.1-4.3 | Charcoal particle renderer + engine integration |
| 5 | 5.1-5.2 | Visibility state migration (firePreset → fuelSourceId) |
| 6 | 6.1-6.2 | End user UI (fuel picker + intensity slider) |
| 7 | 7.1 | Admin Flame Lab redesign (fuel source editor) |
| 8 | 8.1-8.3 | Cleanup, typecheck, Firestore seeding |

**Estimated tasks:** 15 tasks across 8 phases
**Dependencies:** Phases 1-2 are foundational. Phase 3-4 can run in parallel. Phase 5 depends on 1. Phase 6-7 depend on 5. Phase 8 is last.
