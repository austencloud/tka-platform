# LED Lab Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a photorealistic LED prop renderer using raw WebGL2 — additive glow sprites, PBR bloom, persistence-of-vision trails — integrated into the animation engine as a visual effect layer alongside fire.

**Architecture:** Parallel to fire system. LED types in `animation-engine/domain/types/`, LED tip tracker + WebGL renderer in `animation-engine/services/`, LED Lab UI module in `features/led-lab/`, persistence via override provider + DI container. The animation engine manages LED renderer the same way it manages fire: lazy creation on enable, disposal on disable, per-frame rendering in the render loop after Canvas2D.

**Tech Stack:** Raw WebGL2 (GLSL shaders), Svelte 5 runes, ITI dependency injection, localStorage persistence.

**Design doc:** `docs/plans/2026-02-21-led-lab-design.md`

---

## Phase 1: Domain Types + LED Point Registry

Foundation layer. No rendering yet — just the data model that everything builds on.

### Task 1.1: Create LED Domain Types

**Files:**
- Create: `src/lib/shared/animation-engine/domain/types/LedTypes.ts`

**Step 1: Create the LED type definitions**

Model after `FireTypes.ts`. LED types are simpler — no physics simulation params.

```typescript
/**
 * LED Overlay Types
 *
 * Domain types for the WebGL LED overlay that renders addressable
 * LED prop visuals using additive glow sprites, PBR bloom, and
 * persistence-of-vision trail accumulation.
 */

/**
 * A single LED attachment point on a prop.
 * Same coordinate system as FirePoint (prop-local space).
 */
export interface LedPoint {
  /** Offset along prop primary axis from center (prop-dimension units) */
  dx: number;
  /** Offset perpendicular to prop axis from center (prop-dimension units) */
  dy: number;
  /** Maximum brightness output (0-1). 1.0 = full brightness LED. */
  brightness: number;
}

/**
 * LED point configuration for a prop type.
 */
export interface PropLedConfig {
  /** LED attachment points in prop-local coordinates */
  points: LedPoint[];
}

/**
 * Per-LED data computed each frame by LedTipTracker.
 * Positions are in viewbox coordinates (e.g. 950x950).
 */
export interface LedTipData {
  /** X position in viewbox coordinates */
  x: number;
  /** Y position in viewbox coordinates */
  y: number;
  /** Horizontal velocity (viewbox units/second) */
  velocityX: number;
  /** Vertical velocity (viewbox units/second) */
  velocityY: number;
  /** Speed magnitude (viewbox units/second) */
  speed: number;
  /** 0 = blue prop, 1 = red prop */
  propIndex: 0 | 1;
  /** Index of this LED point within the prop's LED point array */
  tipIndex: number;
  /** Brightness from PropLedConfig (0-1) */
  brightness: number;
  /** Current color from pattern engine (RGB 0-1) */
  r: number;
  g: number;
  b: number;
}

/**
 * Full frame input passed to the LED renderer each RAF tick.
 */
export interface LedFrameInput {
  /** Active LED positions + colors (up to 32 tips) */
  tips: LedTipData[];
  /** Current time from performance.now() */
  currentTime: number;
  /** Canvas dimensions in viewbox coordinates */
  canvasWidth: number;
  canvasHeight: number;
}

/**
 * User-configurable LED overlay settings.
 */
export interface LedOverlayConfig {
  /** Whether LED effect is enabled */
  enabled: boolean;
  /** Glow radius multiplier (0.5-3.0, default 1.0). Controls how diffused each LED looks. */
  glowRadius: number;
  /** Bloom intensity (0.0-0.15, default 0.04). Bloom mix weight in final composite. */
  bloomIntensity: number;
  /** Trail fade rate (0.80-0.98, default 0.92). Higher = longer POV trails. */
  trailFadeRate: number;
  /** Active pattern ID */
  patternId: string;
  /** Pattern speed multiplier (0.1-5.0, default 1.0) */
  patternSpeed: number;
  /** Primary color for solid/pulse patterns (hex string) */
  primaryColor: string;
}

/** Default LED overlay config */
export const DEFAULT_LED_CONFIG: LedOverlayConfig = {
  enabled: false,
  glowRadius: 1.0,
  bloomIntensity: 0.04,
  trailFadeRate: 0.92,
  patternId: "solid",
  patternSpeed: 1.0,
  primaryColor: "#00ff88",
};

/**
 * Convert a CSS hex color to normalized [0,1] RGB for shader use.
 */
export function hexToLedColor(hex: string): { r: number; g: number; b: number } {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return { r, g, b };
}
```

**Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit --project tsconfig.json 2>&1 | head -20`
Expected: No errors from LedTypes.ts

**Step 3: Commit**

```bash
git add src/lib/shared/animation-engine/domain/types/LedTypes.ts
git commit -m "feat(led): add LED domain types (LedPoint, LedTipData, LedOverlayConfig)"
```

---

### Task 1.2: Create LED Point Registry (PropLedPoints.ts)

**Files:**
- Create: `src/lib/shared/animation-engine/domain/types/PropLedPoints.ts`

**Step 1: Create the registry**

Model after `PropFirePoints.ts`. Same override provider callback pattern. v1 presets only (point-based props).

```typescript
/**
 * Prop LED Point Definitions
 *
 * Maps each prop type to its LED attachment points. Coordinates are in
 * prop-local space (same units as PROP_DIMENSIONS / FirePoint coordinates).
 *
 * Override provider pattern: a callback can be registered by the LED Lab
 * to inject user-customized point layouts. Falls back to hardcoded defaults.
 */

import type { LedPoint, PropLedConfig } from "./LedTypes";

// ─── Override Provider ────────────────────────────────────────────────────────

type LedPointOverrideFn = (propType: string) => PropLedConfig | null;
let overrideProvider: LedPointOverrideFn | null = null;

export function setLedPointOverrideProvider(provider: LedPointOverrideFn | null): void {
  overrideProvider = provider;
}

// ─── Default: Generic 2-Point Staff Layout ────────────────────────────────────

const DEFAULT_LED_POINTS: PropLedConfig = {
  points: [
    { dx: -150, dy: 0, brightness: 1.0 },
    { dx: 150, dy: 0, brightness: 1.0 },
  ],
};

// ─── Staff Family ─────────────────────────────────────────────────────────────
// Capsule lights at each end (like Flowtoys iso batons)

const STAFF_LED_POINTS: PropLedConfig = {
  points: [
    { dx: -150, dy: 0, brightness: 1.0 },
    { dx: 150, dy: 0, brightness: 1.0 },
  ],
};

const BIGSTAFF_LED_POINTS: PropLedConfig = {
  points: [
    { dx: -300, dy: 0, brightness: 1.0 },
    { dx: 300, dy: 0, brightness: 1.0 },
  ],
};

// ─── Club Family ──────────────────────────────────────────────────────────────
// Single LED zone at the knob end (like Flowtoys Vision Club)

const CLUB_LED_POINTS: PropLedConfig = {
  points: [{ dx: 130, dy: 0, brightness: 1.0 }],
};

const BIGCLUB_LED_POINTS: PropLedConfig = {
  points: [{ dx: 260, dy: 0, brightness: 1.0 }],
};

// ─── Fan Family ───────────────────────────────────────────────────────────────
// LED at each tine tip

const FAN_LED_POINTS: PropLedConfig = {
  points: [
    { dx: 77, dy: -92, brightness: 0.8 },
    { dx: 109, dy: -51, brightness: 0.8 },
    { dx: 120, dy: 0, brightness: 0.8 },
    { dx: 109, dy: 51, brightness: 0.8 },
    { dx: 77, dy: 92, brightness: 0.8 },
  ],
};

const BIGFAN_LED_POINTS: PropLedConfig = {
  points: [
    { dx: 154, dy: -184, brightness: 0.8 },
    { dx: 218, dy: -102, brightness: 0.8 },
    { dx: 240, dy: 0, brightness: 0.8 },
    { dx: 218, dy: 102, brightness: 0.8 },
    { dx: 154, dy: 184, brightness: 0.8 },
  ],
};

// ─── Hoop Family ──────────────────────────────────────────────────────────────
// LEDs around the ring

const MINIHOOP_LED_POINTS: PropLedConfig = {
  points: [
    { dx: 40, dy: -80, brightness: 0.9 },
    { dx: 120, dy: -25, brightness: 0.9 },
    { dx: 120, dy: 25, brightness: 0.9 },
    { dx: 40, dy: 80, brightness: 0.9 },
    { dx: -30, dy: 0, brightness: 0.9 },
  ],
};

const BIGHOOP_LED_POINTS: PropLedConfig = {
  points: [
    { dx: 80, dy: -160, brightness: 0.9 },
    { dx: 240, dy: -50, brightness: 0.9 },
    { dx: 240, dy: 50, brightness: 0.9 },
    { dx: 80, dy: 160, brightness: 0.9 },
    { dx: -60, dy: 0, brightness: 0.9 },
  ],
};

// ─── Poi ──────────────────────────────────────────────────────────────────────
// Single LED at the poi head

const POI_LED_POINTS: PropLedConfig = {
  points: [{ dx: 130, dy: 0, brightness: 1.0 }],
};

const BIGPOI_LED_POINTS: PropLedConfig = {
  points: [{ dx: 260, dy: 0, brightness: 1.0 }],
};

// ─── Torch Family ─────────────────────────────────────────────────────────────
// LED at the torch head (negative dx = left end for torch)

const TORCH_LED_POINTS: PropLedConfig = {
  points: [{ dx: -130, dy: 0, brightness: 1.0 }],
};

const BIGTORCH_LED_POINTS: PropLedConfig = {
  points: [{ dx: -260, dy: 0, brightness: 1.0 }],
};

// ─── Hand (no LEDs) ───────────────────────────────────────────────────────────

const HAND_LED_POINTS: PropLedConfig = { points: [] };

// ─── Registry ─────────────────────────────────────────────────────────────────

const PROP_LED_POINTS: Record<string, PropLedConfig> = {
  staff: STAFF_LED_POINTS,
  bigstaff: BIGSTAFF_LED_POINTS,
  club: CLUB_LED_POINTS,
  bigclub: BIGCLUB_LED_POINTS,
  fan: FAN_LED_POINTS,
  bigfan: BIGFAN_LED_POINTS,
  minihoop: MINIHOOP_LED_POINTS,
  bighoop: BIGHOOP_LED_POINTS,
  poi: POI_LED_POINTS,
  bigpoi: BIGPOI_LED_POINTS,
  torch: TORCH_LED_POINTS,
  bigtorch: BIGTORCH_LED_POINTS,
  hand: HAND_LED_POINTS,
};

/**
 * Get the LED point configuration for a prop type.
 * Checks override provider first, then falls back to hardcoded defaults.
 */
export function getLedPoints(propType: string | null | undefined): PropLedConfig {
  if (!propType) return DEFAULT_LED_POINTS;
  const key = propType.toLowerCase();

  // Check override provider (user-customized points from LED Lab)
  if (overrideProvider) {
    const override = overrideProvider(key);
    if (override) return override;
  }

  // Fall back to hardcoded registry
  return PROP_LED_POINTS[key] ?? DEFAULT_LED_POINTS;
}
```

**Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit --project tsconfig.json 2>&1 | head -20`
Expected: No errors from PropLedPoints.ts

**Step 3: Commit**

```bash
git add src/lib/shared/animation-engine/domain/types/PropLedPoints.ts
git commit -m "feat(led): add LED point registry with override provider pattern"
```

---

### Task 1.3: Create LED Pattern Definitions

**Files:**
- Create: `src/lib/shared/animation-engine/domain/types/LedPatterns.ts`

**Step 1: Create pattern types and built-in presets**

```typescript
/**
 * LED Pattern Definitions
 *
 * Built-in LED color patterns. Each pattern is a pure function that takes
 * time + params and outputs an RGB color per LED point.
 */

export interface LedPattern {
  id: string;
  name: string;
  type: "solid" | "pulse" | "rainbow" | "chase" | "strobe" | "breathe";
}

/**
 * Evaluate a pattern at a given time for a given LED index.
 * Returns RGB color normalized to [0, 1].
 */
export function evaluatePattern(
  pattern: LedPattern,
  time: number,
  ledIndex: number,
  totalLeds: number,
  speed: number,
  primaryColor: { r: number; g: number; b: number }
): { r: number; g: number; b: number } {
  const t = time * speed;

  switch (pattern.type) {
    case "solid":
      return primaryColor;

    case "pulse": {
      const intensity = 0.5 + 0.5 * Math.sin(t * 2.0);
      return {
        r: primaryColor.r * intensity,
        g: primaryColor.g * intensity,
        b: primaryColor.b * intensity,
      };
    }

    case "rainbow": {
      const hue = ((t * 0.5 + ledIndex / Math.max(totalLeds, 1)) % 1.0);
      return hslToRgb(hue, 1.0, 0.5);
    }

    case "chase": {
      const pos = (t * 2.0) % totalLeds;
      const dist = Math.abs(ledIndex - pos);
      const tailLength = Math.max(totalLeds * 0.3, 1);
      const intensity = Math.max(0, 1.0 - dist / tailLength);
      return {
        r: primaryColor.r * intensity,
        g: primaryColor.g * intensity,
        b: primaryColor.b * intensity,
      };
    }

    case "strobe": {
      const on = Math.sin(t * 8.0) > 0 ? 1.0 : 0.0;
      return {
        r: primaryColor.r * on,
        g: primaryColor.g * on,
        b: primaryColor.b * on,
      };
    }

    case "breathe": {
      // Slower, smoother sine wave than pulse
      const intensity = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(t * 1.2));
      return {
        r: primaryColor.r * intensity,
        g: primaryColor.g * intensity,
        b: primaryColor.b * intensity,
      };
    }

    default:
      return primaryColor;
  }
}

/** HSL to RGB conversion (h, s, l all in [0, 1]) */
function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  if (s === 0) return { r: l, g: l, b: l };

  const hue2rgb = (p: number, q: number, t: number): number => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return {
    r: hue2rgb(p, q, h + 1 / 3),
    g: hue2rgb(p, q, h),
    b: hue2rgb(p, q, h - 1 / 3),
  };
}

/** Built-in pattern presets */
export const LED_PATTERNS: LedPattern[] = [
  { id: "solid", name: "Solid", type: "solid" },
  { id: "pulse", name: "Pulse", type: "pulse" },
  { id: "rainbow", name: "Rainbow", type: "rainbow" },
  { id: "chase", name: "Chase", type: "chase" },
  { id: "strobe", name: "Strobe", type: "strobe" },
  { id: "breathe", name: "Breathe", type: "breathe" },
];

/** Look up a pattern by ID */
export function getLedPattern(patternId: string): LedPattern {
  return LED_PATTERNS.find((p) => p.id === patternId) ?? LED_PATTERNS[0];
}
```

**Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit --project tsconfig.json 2>&1 | head -20`

**Step 3: Commit**

```bash
git add src/lib/shared/animation-engine/domain/types/LedPatterns.ts
git commit -m "feat(led): add LED pattern engine with 6 built-in patterns"
```

---

## Phase 2: LED Tip Tracker + Service Contracts

Position tracking and renderer interface. Still no WebGL — this phase wires the data pipeline.

### Task 2.1: Create ILedOverlayRenderer Contract

**Files:**
- Create: `src/lib/shared/animation-engine/services/contracts/ILedOverlayRenderer.ts`

**Step 1: Create the interface**

Model after `IFireOverlayRenderer.ts`.

```typescript
/**
 * ILedOverlayRenderer
 *
 * Interface for the WebGL LED overlay that composites
 * additive glow sprites with PBR bloom and POV trail
 * accumulation on top of the Canvas2D animation.
 */

import type { LedFrameInput, LedOverlayConfig } from "../../domain/types/LedTypes";

export interface ILedOverlayRenderer {
  /**
   * Create the WebGL canvas, compile shaders, allocate framebuffers.
   * @param container - Parent element to append the overlay canvas into
   * @param width - Initial canvas width in CSS pixels
   * @param height - Initial canvas height in CSS pixels
   */
  initialize(container: HTMLElement, width: number, height: number): boolean;

  /**
   * Resize the overlay canvas (e.g., when container resizes).
   */
  resize(width: number, height: number): void;

  /**
   * Render one frame of LEDs.
   * Called after Canvas2D renderScene() in the same RAF tick.
   */
  renderLeds(input: LedFrameInput, config: LedOverlayConfig): void;

  /**
   * Clean up WebGL resources and remove canvas from DOM.
   */
  dispose(): void;

  /**
   * Whether the renderer has been successfully initialized.
   */
  isInitialized(): boolean;
}
```

**Step 2: Commit**

```bash
git add src/lib/shared/animation-engine/services/contracts/ILedOverlayRenderer.ts
git commit -m "feat(led): add ILedOverlayRenderer contract"
```

---

### Task 2.2: Create ILedTipTracker Contract

**Files:**
- Create: `src/lib/shared/animation-engine/services/contracts/ILedTipTracker.ts`

**Step 1: Create the interface**

Model after `IFireTipTracker.ts`.

```typescript
/**
 * ILedTipTracker
 *
 * Tracks LED point positions across frames and computes
 * velocity vectors via finite differencing for trail direction.
 * Also applies the pattern engine to determine per-LED colors.
 */

import type { LedTipData, LedOverlayConfig } from "../../domain/types/LedTypes";
import type { PropState } from "../../domain/PropState";
import type { PropDimensions } from "./IAnimationRenderLoop";

export interface LedTipTrackerConfig {
  canvasSize: number;
  bluePropDimensions: PropDimensions;
  redPropDimensions: PropDimensions;
  bluePropType?: string;
  redPropType?: string;
}

export interface ILedTipTracker {
  /**
   * Update LED positions, compute velocities, and evaluate pattern colors
   * for the current frame.
   */
  update(
    blueProp: PropState | null,
    redProp: PropState | null,
    config: LedTipTrackerConfig,
    currentTime: number,
    ledConfig: LedOverlayConfig
  ): LedTipData[];

  /**
   * Reset stored positions (e.g., on sequence change).
   */
  reset(): void;
}
```

**Step 2: Commit**

```bash
git add src/lib/shared/animation-engine/services/contracts/ILedTipTracker.ts
git commit -m "feat(led): add ILedTipTracker contract"
```

---

### Task 2.3: Implement LedTipTracker

**Files:**
- Create: `src/lib/shared/animation-engine/services/implementations/LedTipTracker.ts`

**Step 1: Implement the tracker**

Port from `FireTipTracker.ts`. Same coordinate transform math, same velocity computation, plus pattern evaluation.

```typescript
/**
 * LedTipTracker
 *
 * Tracks LED point positions and computes velocities via finite differencing.
 * Applies the pattern engine to determine per-LED colors each frame.
 *
 * Architecture mirrors FireTipTracker:
 * - Pre-allocated storage to avoid GC pressure
 * - Reusable output array
 * - Velocity clamping for physics stability
 */

import type { ILedTipTracker, LedTipTrackerConfig } from "../contracts/ILedTipTracker";
import type { LedTipData, LedOverlayConfig } from "../../domain/types/LedTypes";
import { hexToLedColor } from "../../domain/types/LedTypes";
import type { PropState } from "../../domain/PropState";
import { getLedPoints } from "../../domain/types/PropLedPoints";
import { getLedPattern, evaluatePattern } from "../../domain/types/LedPatterns";
import { PropPositionCalculator } from "./PropPositionCalculator";

const MAX_TIPS = 32; // 16 per prop
const MAX_SPEED = 5000;
const MIN_DT = 1 / 120;
const VIEWBOX_SIZE = 950;

interface StoredTip {
  x: number;
  y: number;
  time: number;
  valid: boolean;
}

export class LedTipTracker implements ILedTipTracker {
  private positionCalculator = new PropPositionCalculator();
  private prevTips: StoredTip[] = [];
  private outputTips: LedTipData[] = [];

  constructor() {
    // Pre-allocate storage
    for (let i = 0; i < MAX_TIPS; i++) {
      this.prevTips.push({ x: 0, y: 0, time: 0, valid: false });
      this.outputTips.push({
        x: 0, y: 0,
        velocityX: 0, velocityY: 0, speed: 0,
        propIndex: 0, tipIndex: 0, brightness: 1.0,
        r: 0, g: 0, b: 0,
      });
    }
  }

  update(
    blueProp: PropState | null,
    redProp: PropState | null,
    config: LedTipTrackerConfig,
    currentTime: number,
    ledConfig: LedOverlayConfig
  ): LedTipData[] {
    let outputCount = 0;

    // Get pattern + color for this frame
    const pattern = getLedPattern(ledConfig.patternId);
    const primaryColor = hexToLedColor(ledConfig.primaryColor);

    // Count total LEDs across both props for pattern evaluation
    const blueLedConfig = blueProp ? getLedPoints(config.bluePropType) : null;
    const redLedConfig = redProp ? getLedPoints(config.redPropType) : null;
    const totalLeds =
      (blueLedConfig?.points.length ?? 0) + (redLedConfig?.points.length ?? 0);

    // Emit blue prop LEDs (slots 0-15)
    if (blueProp && blueLedConfig && blueLedConfig.points.length > 0) {
      outputCount = this.emitPropTips(
        blueProp, config.canvasSize,
        config.bluePropDimensions,
        config.bluePropType ?? "staff",
        0, 0, currentTime, 0,
        pattern, primaryColor, ledConfig.patternSpeed,
        totalLeds, currentTime
      );
    }

    // Emit red prop LEDs (slots 16-31)
    if (redProp && redLedConfig && redLedConfig.points.length > 0) {
      outputCount += this.emitPropTips(
        redProp, config.canvasSize,
        config.redPropDimensions,
        config.redPropType ?? "staff",
        1, 16, currentTime, outputCount,
        pattern, primaryColor, ledConfig.patternSpeed,
        totalLeds, currentTime
      );
    }

    // Return slice of reusable array
    return this.outputTips.slice(0, outputCount);
  }

  reset(): void {
    for (const tip of this.prevTips) {
      tip.valid = false;
    }
  }

  private emitPropTips(
    prop: PropState,
    canvasSize: number,
    propDimensions: { width: number; height: number },
    propType: string,
    propIndex: 0 | 1,
    prevTipOffset: number,
    currentTime: number,
    outputStartIndex: number,
    pattern: ReturnType<typeof getLedPattern>,
    primaryColor: { r: number; g: number; b: number },
    patternSpeed: number,
    totalLeds: number,
    time: number
  ): number {
    const ledConfig = getLedPoints(propType);
    const points = ledConfig.points;
    if (points.length === 0) return 0;

    const center = this.positionCalculator.calculateCenter(prop, propDimensions);
    const gridScaleFactor = canvasSize / VIEWBOX_SIZE;
    const angle = prop.staffRotationAngle ?? 0;
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);

    let count = 0;

    for (let i = 0; i < points.length && outputStartIndex + count < MAX_TIPS; i++) {
      const lp = points[i];
      const worldX = center.x + (lp.dx * cosA - lp.dy * sinA) * gridScaleFactor;
      const worldY = center.y + (lp.dx * sinA + lp.dy * cosA) * gridScaleFactor;

      // Velocity via finite differencing
      const slotIndex = prevTipOffset + i;
      const prev = this.prevTips[slotIndex];
      let vx = 0, vy = 0, speed = 0;

      if (prev.valid) {
        const dt = Math.max(currentTime - prev.time, MIN_DT);
        vx = (worldX - prev.x) / dt;
        vy = (worldY - prev.y) / dt;
        speed = Math.sqrt(vx * vx + vy * vy);
        if (speed > MAX_SPEED) {
          const scale = MAX_SPEED / speed;
          vx *= scale;
          vy *= scale;
          speed = MAX_SPEED;
        }
      }

      // Store for next frame
      prev.x = worldX;
      prev.y = worldY;
      prev.time = currentTime;
      prev.valid = true;

      // Evaluate pattern color for this LED
      const ledGlobalIndex = propIndex === 0 ? i : (getLedPoints(propType).points.length + i);
      const color = evaluatePattern(
        pattern, time, ledGlobalIndex, totalLeds, patternSpeed, primaryColor
      );

      // Write to reusable output
      const out = this.outputTips[outputStartIndex + count];
      out.x = worldX;
      out.y = worldY;
      out.velocityX = vx;
      out.velocityY = vy;
      out.speed = speed;
      out.propIndex = propIndex;
      out.tipIndex = i;
      out.brightness = lp.brightness;
      out.r = color.r;
      out.g = color.g;
      out.b = color.b;

      count++;
    }

    return count;
  }
}
```

**Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit --project tsconfig.json 2>&1 | head -20`

Note: This references `PropPositionCalculator` which already exists (used by `FireTipTracker`). Verify the import path works. The `prop.staffRotationAngle` property comes from `PropState`.

**Step 3: Commit**

```bash
git add src/lib/shared/animation-engine/services/implementations/LedTipTracker.ts
git commit -m "feat(led): implement LedTipTracker with position + velocity + pattern evaluation"
```

---

## Phase 3: WebGL LED Renderer

The core rendering engine. Sprite glow + trail accumulation + PBR bloom.

### Task 3.1: Create LED Shader Sources

**Files:**
- Create: `src/lib/shared/animation-engine/services/implementations/led/LedShaderSources.ts`

**Step 1: Write all 5 shader programs**

```typescript
/**
 * LED Shader Sources
 *
 * GLSL shader programs for the LED rendering pipeline:
 * 1. LED Sprite - Radial glow quad with additive blending
 * 2. Trail Accumulate - max() blend with temporal fade
 * 3. Bloom Downsample - 13-tap energy-preserving mip-chain
 * 4. Bloom Upsample - 3x3 tent filter additive
 * 5. Display - Final composite to screen
 */

// ─── Shared Vertex Shader (fullscreen quad) ───────────────────────────────────

export const FULLSCREEN_VERT = `#version 300 es
precision highp float;
in vec2 a_position;
out vec2 v_uv;
void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

// ─── LED Sprite Shader ────────────────────────────────────────────────────────
// Renders individual LED glow quads with inverse-square radial falloff.

export const LED_SPRITE_VERT = `#version 300 es
precision highp float;

// Per-vertex: quad corners (-1 to 1)
in vec2 a_position;

// Per-instance: LED world position, color, brightness, glow radius
in vec2 a_ledPos;      // viewbox coords
in vec3 a_ledColor;    // RGB [0,1]
in float a_brightness; // [0,1]
in float a_glowRadius; // world-space radius

uniform vec2 u_resolution; // canvas size in pixels

out vec2 v_uv;
out vec3 v_color;
out float v_brightness;

void main() {
  v_uv = a_position * 0.5 + 0.5; // quad UV [0,1]
  v_color = a_ledColor;
  v_brightness = a_brightness;

  // Transform LED position from viewbox coords to clip space
  vec2 clipPos = (a_ledPos / u_resolution) * 2.0 - 1.0;
  clipPos.y = -clipPos.y; // flip Y (viewbox Y is top-down)

  // Scale quad by glow radius
  vec2 scaledOffset = a_position * (a_glowRadius / u_resolution);

  gl_Position = vec4(clipPos + scaledOffset, 0.0, 1.0);
}
`;

export const LED_SPRITE_FRAG = `#version 300 es
precision highp float;

in vec2 v_uv;
in vec3 v_color;
in float v_brightness;

out vec4 fragColor;

void main() {
  // Distance from center of quad
  vec2 centered = v_uv - 0.5;
  float dist = length(centered);

  // Inverse-square radial falloff with soft edge
  float glow = 1.0 / (1.0 + 30.0 * dist * dist);

  // Discard fragments beyond visible range
  if (glow < 0.005) discard;

  // Core hotspot: brighter center for LED look
  float core = exp(-dist * dist * 80.0);
  float combined = glow + core * 0.5;

  vec3 color = v_color * combined * v_brightness;
  fragColor = vec4(color, combined * v_brightness);
}
`;

// ─── Trail Accumulation Shader ────────────────────────────────────────────────
// Composites current frame with previous trail using max() blend + temporal fade.

export const TRAIL_ACCUMULATE_FRAG = `#version 300 es
precision highp float;

in vec2 v_uv;
uniform sampler2D u_currentFrame;
uniform sampler2D u_previousTrail;
uniform float u_fadeRate; // 0.80-0.98

out vec4 fragColor;

void main() {
  vec4 current = texture(u_currentFrame, v_uv);
  vec4 trail = texture(u_previousTrail, v_uv);

  // Fade previous trail, then take max with current frame
  // max() prevents dark fragments from bleeding over lit LEDs
  fragColor = max(current, trail * u_fadeRate);
}
`;

// ─── PBR Bloom Downsample ─────────────────────────────────────────────────────
// 13-tap energy-preserving kernel from LearnOpenGL PBR Bloom (2022).
// Each tap uses bilinear filtering for effectively 36 unique samples.

export const BLOOM_DOWNSAMPLE_FRAG = `#version 300 es
precision highp float;

in vec2 v_uv;
uniform sampler2D u_source;
uniform vec2 u_texelSize;

out vec4 fragColor;

void main() {
  // 13-tap downsample with energy-preserving weights
  // Pattern: center + 4 diagonal pairs + 4 edge pairs + 4 corner samples
  vec4 A = texture(u_source, v_uv + u_texelSize * vec2(-1.0, -1.0));
  vec4 B = texture(u_source, v_uv + u_texelSize * vec2( 0.0, -1.0));
  vec4 C = texture(u_source, v_uv + u_texelSize * vec2( 1.0, -1.0));
  vec4 D = texture(u_source, v_uv + u_texelSize * vec2(-0.5, -0.5));
  vec4 E = texture(u_source, v_uv);
  vec4 F = texture(u_source, v_uv + u_texelSize * vec2( 0.5, -0.5));
  vec4 G = texture(u_source, v_uv + u_texelSize * vec2(-1.0,  0.0));
  vec4 H = texture(u_source, v_uv + u_texelSize * vec2( 1.0,  0.0));
  vec4 I = texture(u_source, v_uv + u_texelSize * vec2(-0.5,  0.5));
  vec4 J = texture(u_source, v_uv + u_texelSize * vec2( 0.0,  1.0));
  vec4 K = texture(u_source, v_uv + u_texelSize * vec2( 0.5,  0.5));
  vec4 L = texture(u_source, v_uv + u_texelSize * vec2(-1.0,  1.0));
  vec4 M = texture(u_source, v_uv + u_texelSize * vec2( 1.0,  1.0));

  // Energy-preserving weights (sum to 1.0)
  // Center diamond (D, E, F, I, K) = 0.5 weight total (4 samples, each 0.125)
  // Outer ring = 0.5 weight total
  vec4 d4 = (D + F + I + K) * 0.25;     // Inner diamond
  vec4 d8 = (A + B + C + G + H + J + L + M) * 0.125; // Outer ring
  fragColor = d4 * 0.5 + d8 * 0.5;
}
`;

// ─── PBR Bloom Upsample ──────────────────────────────────────────────────────
// 3x3 tent filter for progressive upsampling with additive accumulation.

export const BLOOM_UPSAMPLE_FRAG = `#version 300 es
precision highp float;

in vec2 v_uv;
uniform sampler2D u_source;
uniform vec2 u_texelSize;
uniform float u_bloomRadius; // controls spread (default 1.0)

out vec4 fragColor;

void main() {
  vec2 ts = u_texelSize * u_bloomRadius;

  // 3x3 tent filter (weights: 1,2,1 / 2,4,2 / 1,2,1) normalized by 16
  vec4 sum = vec4(0.0);
  sum += texture(u_source, v_uv + vec2(-ts.x, -ts.y)) * 1.0;
  sum += texture(u_source, v_uv + vec2( 0.0,  -ts.y)) * 2.0;
  sum += texture(u_source, v_uv + vec2( ts.x, -ts.y)) * 1.0;
  sum += texture(u_source, v_uv + vec2(-ts.x,  0.0))  * 2.0;
  sum += texture(u_source, v_uv)                       * 4.0;
  sum += texture(u_source, v_uv + vec2( ts.x,  0.0))  * 2.0;
  sum += texture(u_source, v_uv + vec2(-ts.x,  ts.y)) * 1.0;
  sum += texture(u_source, v_uv + vec2( 0.0,   ts.y)) * 2.0;
  sum += texture(u_source, v_uv + vec2( ts.x,  ts.y)) * 1.0;

  fragColor = sum / 16.0;
}
`;

// ─── Display Composite Shader ─────────────────────────────────────────────────
// Combines the trail-accumulated LED output with bloom and renders to screen.

export const LED_DISPLAY_FRAG = `#version 300 es
precision highp float;

in vec2 v_uv;
uniform sampler2D u_ledTrail;    // Trail-accumulated LED output
uniform sampler2D u_bloom;       // Final bloom texture (upsampled)
uniform float u_bloomIntensity;  // Bloom mix weight (0.01-0.15)

out vec4 fragColor;

void main() {
  vec4 led = texture(u_ledTrail, v_uv);
  vec4 bloom = texture(u_bloom, v_uv);

  // Additive bloom on top of LED output
  vec4 combined = led + bloom * u_bloomIntensity;

  // Premultiplied alpha output
  fragColor = vec4(combined.rgb, max(combined.r, max(combined.g, combined.b)));
}
`;
```

**Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit --project tsconfig.json 2>&1 | head -20`

**Step 3: Commit**

```bash
git add src/lib/shared/animation-engine/services/implementations/led/LedShaderSources.ts
git commit -m "feat(led): add GLSL shaders for LED sprite glow, trail, and PBR bloom"
```

---

### Task 3.2: Implement WebGLLedRenderer

**Files:**
- Create: `src/lib/shared/animation-engine/services/implementations/led/WebGLLedRenderer.ts`

**Step 1: Implement the full renderer**

This is the largest single file. It manages:
- WebGL2 context + canvas creation
- Shader compilation + program linking
- Framebuffer allocation (current frame, trail ping-pong, bloom mip chain)
- Per-frame rendering pipeline (sprite → trail → bloom → display)
- Resize handling
- Resource disposal

The implementation follows `WebGLFireRenderer.ts` patterns exactly:
- Canvas created with `position: absolute; z-index: 3` (one above fire's z-index: 2)
- `pointer-events: none` so clicks pass through
- Same `EXT_color_buffer_float` check for float textures
- Same premultiplied alpha blending for compositing

**Key implementation details:**

1. **Sprite rendering uses instanced drawing.** One quad geometry, N instances. Per-instance attributes: position, color, brightness, glow radius. Single draw call for all LEDs.

2. **Trail accumulation uses ping-pong framebuffers.** Two FBOs alternate: read from previous, write to current with `max(current, previous * fadeRate)`.

3. **Bloom uses a mip chain.** 5 levels of progressively smaller FBOs. Downsample from trail → mip[0] → mip[1] → ... → mip[4]. Upsample from mip[4] → mip[3] → ... → mip[0], accumulating additively.

4. **Display shader composites trail + bloom with configurable bloom intensity.**

This file will be ~400-500 lines. The implementing agent should:
- Read `WebGLFireRenderer.ts` for the exact WebGL2 boilerplate patterns (context creation, shader compilation helpers, FBO creation helpers)
- Use the same helper functions for `createShaderProgram`, `createFBO`, `createDoubleFBO`
- Follow the same `initialize() → renderLeds() → dispose()` lifecycle

The renderer does NOT need to be fully implemented in one shot. The recommended approach:

**3.2a:** Canvas creation + shader compilation + basic sprite rendering (no trail, no bloom). Verify LEDs appear as glowing dots.

**3.2b:** Add trail accumulation (ping-pong FBOs). Verify persistence-of-vision effect.

**3.2c:** Add PBR bloom pass (mip chain). Verify volumetric light bleed.

**3.2d:** Add display composite. Verify final output.

Each sub-step should be independently testable by enabling LEDs in the visibility state and watching the animation.

**Step 2: Verify the renderer compiles and initializes**

Run: `npx tsc --noEmit --project tsconfig.json 2>&1 | head -20`

For visual verification, the animation engine integration (Phase 4) must be complete first.

**Step 3: Commit after each sub-step**

```bash
git commit -m "feat(led): implement WebGLLedRenderer sprite rendering"
git commit -m "feat(led): add trail accumulation with ping-pong FBOs"
git commit -m "feat(led): add PBR bloom pass (5-level mip chain)"
git commit -m "feat(led): add display composite shader"
```

---

## Phase 4: Animation Engine Integration

Wire LEDs into the existing engine, same pattern as fire.

### Task 4.1: Add LED State to Visibility Manager

**Files:**
- Modify: `src/lib/shared/animation-engine/state/animation-visibility-state.svelte.ts`

**Step 1: Add LED settings to the interface**

Add to `AnimationVisibilitySettings`:

```typescript
// In the interface, after the fire fields:
ledEffect: boolean;        // WebGL LED overlay
ledPatternId: string;      // Active LED pattern
ledPrimaryColor: string;   // Primary color (hex)
```

**Step 2: Add defaults**

In `getDefaultSettings()`:

```typescript
ledEffect: false,
ledPatternId: "solid",
ledPrimaryColor: "#00ff88",
```

**Step 3: Add getters/setters**

Add a new section after the fire effect section:

```typescript
// LED EFFECT
isLedEffectEnabled(): boolean { return this.settings.ledEffect; }
setLedEffect(enabled: boolean): void {
  this.settings.ledEffect = enabled;
  this.saveToStorage();
  this.notifyObservers();
}
toggleLedEffect(): void { this.setLedEffect(!this.settings.ledEffect); }

getLedPatternId(): string { return this.settings.ledPatternId; }
setLedPatternId(patternId: string): void {
  this.settings.ledPatternId = patternId;
  this.saveToStorage();
  this.notifyObservers();
}

getLedPrimaryColor(): string { return this.settings.ledPrimaryColor; }
setLedPrimaryColor(color: string): void {
  this.settings.ledPrimaryColor = color;
  this.saveToStorage();
  this.notifyObservers();
}
```

**Step 4: Update the `getVisibility` exclude list**

Add `"ledPatternId" | "ledPrimaryColor"` to the Exclude type in `getVisibility()` and `setVisibility()`.

**Step 5: Verify**

Run: `npx tsc --noEmit --project tsconfig.json 2>&1 | head -20`

**Step 6: Commit**

```bash
git add src/lib/shared/animation-engine/state/animation-visibility-state.svelte.ts
git commit -m "feat(led): add LED effect state to visibility manager"
```

---

### Task 4.2: Wire LED Renderer into AnimationEngine

**Files:**
- Modify: `src/lib/shared/animation-engine/services/implementations/AnimationEngine.svelte.ts`

**Step 1: Add imports**

```typescript
import { LedTipTracker } from "./LedTipTracker";
import { WebGLLedRenderer } from "./led/WebGLLedRenderer";
import type { ILedOverlayRenderer } from "../contracts/ILedOverlayRenderer";
import type { ILedTipTracker } from "../contracts/ILedTipTracker";
import { DEFAULT_LED_CONFIG, type LedOverlayConfig } from "../../domain/types/LedTypes";
```

**Step 2: Add private fields (near fire fields)**

```typescript
private ledRenderer: ILedOverlayRenderer | null = null;
private ledTipTracker: ILedTipTracker | null = null;
private ledConfig: LedOverlayConfig = { ...DEFAULT_LED_CONFIG };
```

**Step 3: Create LedTipTracker in initializeRenderLoop (near FireTipTracker creation)**

```typescript
this.ledTipTracker = new LedTipTracker();
```

And pass to render loop config:

```typescript
ledTipTracker: this.ledTipTracker,
```

**Step 4: Add syncLedOverlay method (parallel to syncFireOverlay)**

```typescript
private syncLedOverlay(): void {
  if (this.ledConfig.enabled && !this.ledRenderer?.isInitialized()) {
    if (!this.containerElement) return;
    this.ledRenderer = new WebGLLedRenderer();
    const success = this.ledRenderer.initialize(
      this.containerElement,
      this.canvasSize,
      this.canvasSize
    );
    if (success) {
      this.renderLoopService?.updateConfig({ ledRenderer: this.ledRenderer });
    } else {
      this.ledRenderer = null;
    }
  } else if (!this.ledConfig.enabled && this.ledRenderer) {
    this.ledRenderer.dispose();
    this.ledRenderer = null;
    this.renderLoopService?.updateConfig({ ledRenderer: null });
    this.ledTipTracker?.reset();
  }
}
```

**Step 5: Add setLedConfig method**

```typescript
setLedConfig(config: Partial<LedOverlayConfig>): void {
  Object.assign(this.ledConfig, config);
  this.syncLedOverlay();
}
```

**Step 6: Add LED sync to the visibility observer (near fire sync)**

In the observer section where fire state is synced:

```typescript
// LED effect sync
const vm = getAnimationVisibilityManager();
const ledEnabled = vm.isLedEffectEnabled();
if (ledEnabled !== this.ledConfig.enabled) {
  this.setLedConfig({ enabled: ledEnabled });
}
const ledPatternId = vm.getLedPatternId();
if (ledPatternId !== this.ledConfig.patternId) {
  this.setLedConfig({ patternId: ledPatternId });
}
const ledColor = vm.getLedPrimaryColor();
if (ledColor !== this.ledConfig.primaryColor) {
  this.setLedConfig({ primaryColor: ledColor });
}
```

**Step 7: Add LED resize + dispose**

In `resize()`: `this.ledRenderer?.resize(newSize, newSize);`

In `dispose()`:
```typescript
this.ledRenderer?.dispose();
this.ledRenderer = null;
this.ledTipTracker = null;
```

**Step 8: Verify**

Run: `npx tsc --noEmit --project tsconfig.json 2>&1 | head -20`

**Step 9: Commit**

```bash
git add src/lib/shared/animation-engine/services/implementations/AnimationEngine.svelte.ts
git commit -m "feat(led): wire LED renderer into AnimationEngine (lazy create/destroy)"
```

---

### Task 4.3: Wire LED Rendering into Render Loop

**Files:**
- Modify: `src/lib/shared/animation-engine/services/contracts/IAnimationRenderLoop.ts`
- Modify: `src/lib/shared/animation-engine/services/implementations/AnimationRenderLoop.ts`

**Step 1: Add LED fields to RenderLoopConfig**

In `IAnimationRenderLoop.ts`, add to `RenderLoopConfig`:

```typescript
/** Optional LED overlay renderer */
ledRenderer?: ILedOverlayRenderer | null;
/** Optional LED tip position/color tracker */
ledTipTracker?: ILedTipTracker | null;
```

Add to `RenderFrameParams`:

```typescript
/** LED overlay configuration */
ledConfig?: LedOverlayConfig | null;
```

Add imports for `ILedOverlayRenderer`, `ILedTipTracker`, `LedOverlayConfig`.

**Step 2: Add LED fields to AnimationRenderLoop.ts**

Add private fields:

```typescript
private ledRenderer: ILedOverlayRenderer | null = null;
private ledTipTracker: ILedTipTracker | null = null;
```

In `initialize()`:
```typescript
this.ledRenderer = config.ledRenderer ?? null;
this.ledTipTracker = config.ledTipTracker ?? null;
```

In `updateConfig()`:
```typescript
if (config.ledRenderer !== undefined) this.ledRenderer = config.ledRenderer ?? null;
if (config.ledTipTracker !== undefined) this.ledTipTracker = config.ledTipTracker ?? null;
```

**Step 3: Add LED rendering to the render frame method**

After the fire rendering block (line ~335), add:

```typescript
// LED overlay: render after fire so it composites on top of both Canvas2D and fire
if (
  this.ledRenderer?.isInitialized() &&
  this.ledTipTracker &&
  params.ledConfig?.enabled
) {
  const tipTrackerConfig: LedTipTrackerConfig = {
    canvasSize: this.canvasSize,
    bluePropDimensions: props.bluePropDimensions,
    redPropDimensions: props.redPropDimensions,
    bluePropType: params.bluePropType,
    redPropType: params.redPropType,
  };

  const tips = this.ledTipTracker.update(
    props.blueProp,
    props.redProp,
    tipTrackerConfig,
    currentTime,
    params.ledConfig
  );

  this.ledRenderer.renderLeds(
    {
      tips,
      currentTime,
      canvasWidth: this.canvasSize,
      canvasHeight: this.canvasSize,
    },
    params.ledConfig
  );
}
```

**Step 4: Add LED active check to the render loop continuation logic**

In the `shouldContinueLoop` check, add:

```typescript
const ledActive =
  params.ledConfig?.enabled === true &&
  this.ledRenderer?.isInitialized() === true;
```

And include `ledActive` in the `shouldContinueLoop` condition.

**Step 5: Cleanup in dispose()**

```typescript
this.ledRenderer?.dispose();
this.ledRenderer = null;
this.ledTipTracker = null;
```

**Step 6: Verify**

Run: `npx tsc --noEmit --project tsconfig.json 2>&1 | head -20`

**Step 7: Commit**

```bash
git add src/lib/shared/animation-engine/services/contracts/IAnimationRenderLoop.ts
git add src/lib/shared/animation-engine/services/implementations/AnimationRenderLoop.ts
git commit -m "feat(led): wire LED rendering into animation render loop"
```

---

### Task 4.4: Pass LED Config Through AnimatorCanvas

**Files:**
- Modify: `src/lib/shared/animation-engine/components/AnimatorCanvas.svelte` (or wherever `RenderFrameParams` is constructed)

**Step 1: Read LED config from visibility manager and pass to engine**

Same pattern as fire: observe visibility manager, pass `ledConfig` to the engine's `setLedConfig()` and include it in frame params.

**Step 2: Verify**

Run: `npx tsc --noEmit --project tsconfig.json 2>&1 | head -20`

**Step 3: Visual test**

At this point, enabling `ledEffect` in the visibility manager should show LED glow sprites on animated props. Verify by:
1. Opening browser dev console
2. Running: `getAnimationVisibilityManager().setLedEffect(true)`
3. Observing glowing dots at prop endpoints during animation

**Step 4: Commit**

```bash
git add src/lib/shared/animation-engine/components/AnimatorCanvas.svelte
git commit -m "feat(led): pass LED config through AnimatorCanvas to render loop"
```

---

## Phase 5: LED Lab UI Module

### Task 5.1: Create LED Point Override Provider

**Files:**
- Create: `src/lib/features/led-lab/services/contracts/ILedPointOverrideProvider.ts`
- Create: `src/lib/features/led-lab/services/implementations/LedPointOverrideProvider.ts`

**Step 1: Create the interface**

Exact copy of `IFirePointOverrideProvider` with `PropLedConfig` instead of `PropFirePointConfig`.

**Step 2: Create the implementation**

Port `FirePointOverrideProvider.ts`. Change:
- localStorage keys: `"led-point-overrides"`, `"led-point-user-defaults"`
- Types: `PropLedConfig` instead of `PropFirePointConfig`

**Step 3: Commit**

```bash
git add src/lib/features/led-lab/services/
git commit -m "feat(led): add LED point override provider with localStorage persistence"
```

---

### Task 5.2: Create LED Point Editor State

**Files:**
- Create: `src/lib/features/led-lab/state/led-point-editor-state.svelte.ts`

**Step 1: Port from `fire-point-editor-state.svelte.ts`**

Change:
- `FirePoint` → `LedPoint` (dx, dy, brightness instead of dx, dy, flameScale)
- `IFirePointOverrideProvider` → `ILedPointOverrideProvider`
- `getFirePoints()` → `getLedPoints()`
- Storage keys
- Default brightness = 1.0 instead of default flameScale = 1.0

Keep the same undo stack, auto-save, save indicator, action feedback patterns.

**Step 2: Commit**

```bash
git add src/lib/features/led-lab/state/
git commit -m "feat(led): add reactive LED point editor state with undo stack"
```

---

### Task 5.3: Create LED Lab DI Container

**Files:**
- Create: `src/lib/shared/di/containers/led-lab-container.ts`
- Modify: `src/lib/shared/di/index.ts`

**Step 1: Create the container**

```typescript
import { createContainer } from "iti";
import { LedPointOverrideProvider } from "$lib/features/led-lab/services/implementations/LedPointOverrideProvider";
import { setLedPointOverrideProvider } from "$lib/shared/animation-engine/domain/types/PropLedPoints";

export const ledLabContainer = createContainer().add({
  ledPointOverrideProvider: () => {
    const provider = new LedPointOverrideProvider();
    setLedPointOverrideProvider((propType) => provider.getOverride(propType));
    return provider;
  },
});
```

**Step 2: Wire into composition root**

In `src/lib/shared/di/index.ts`, add import and `.add(ledLabContainer.items)`.

**Step 3: Commit**

```bash
git add src/lib/shared/di/containers/led-lab-container.ts
git add src/lib/shared/di/index.ts
git commit -m "feat(led): register LED Lab container in DI composition root"
```

---

### Task 5.4: Create LedLabModule.svelte

**Files:**
- Create: `src/lib/features/led-lab/LedLabModule.svelte`

**Step 1: Port from `FlameLabModule.svelte`**

Same tab structure: "Tuning" and "LED Points". Session storage key: `"led-lab-active-tab"`.

Tab 1 (Tuning) contains:
- LED enabled toggle
- Pattern selector dropdown (6 patterns)
- Color picker
- Speed slider
- Trail length slider
- Bloom intensity slider
- Glow radius slider
- Playback controls (reuse same components as Flame Lab)

Tab 2 (LED Points) contains:
- Prop type selector (reuse from Flame Lab)
- Interactive canvas (port/share from Flame Lab's `FirePointSvgCanvas`)
- Point list panel (port from Flame Lab's `FirePointListPanel`)

Start with Tab 1 only. Tab 2 can reuse the fire point editor components with parameterization.

**Step 2: Commit**

```bash
git add src/lib/features/led-lab/
git commit -m "feat(led): add LedLabModule with tuning tab"
```

---

### Task 5.5: Register LED Lab as Lab Tab

**Files:**
- Modify: `src/lib/shared/navigation/config/tab-definitions.ts`
- Modify: `src/lib/features/lab/LabModule.svelte`

**Step 1: Add LED tab definition to LAB_TABS**

```typescript
{
  id: "led",
  label: "LED",
  icon: '<i class="fas fa-lightbulb" aria-hidden="true"></i>',
  description: "LED prop rendering and pattern design",
  color: "#00ff88",
  gradient: "linear-gradient(135deg, #00ff88 0%, #00cc6a 100%)",
},
```

**Step 2: Add lazy loader to LabModule.svelte**

In the `tabLoaders` map:

```typescript
led: () => import("$lib/features/led-lab/LedLabModule.svelte"),
```

**Step 3: Commit**

```bash
git add src/lib/shared/navigation/config/tab-definitions.ts
git add src/lib/features/lab/LabModule.svelte
git commit -m "feat(led): register LED Lab as tab in Lab module"
```

---

## Phase 6: Visibility Settings UI

### Task 6.1: Add LED Toggle to Visibility Settings

**Files:**
- Modify: `src/lib/shared/settings/components/tabs/visibility/AnimationPanel.svelte` (or the relevant animation controls component)

**Step 1: Add LED effect toggle**

Add a toggle control for `ledEffect` next to the existing `fireEffect` toggle, using the same component pattern. Wire to `visibilityManager.toggleLedEffect()`.

**Step 2: Verify**

Users should be able to toggle LEDs from Settings > Visibility > Animation section.

**Step 3: Commit**

```bash
git add src/lib/shared/settings/components/tabs/visibility/
git commit -m "feat(led): add LED toggle to visibility settings panel"
```

---

## Phase 7: Manufacturer Presets

### Task 7.1: Create Manufacturer Preset Registry

**Files:**
- Create: `src/lib/shared/animation-engine/domain/types/LedManufacturerPresets.ts`

**Step 1: Create preset data**

Hardcoded presets for point-based LED props. Uses `PropLedConfig` for geometry + `LedPattern` for default pattern.

Include presets for: Flowtoys Capsule 2.0, Flowtoys Vision Club, Flowtoys Iso Baton, Lighttoys Club, Generic Staff, Generic Single.

**Step 2: Commit**

```bash
git add src/lib/shared/animation-engine/domain/types/LedManufacturerPresets.ts
git commit -m "feat(led): add manufacturer presets (Flowtoys, Lighttoys, Generic)"
```

---

## Verification Checkpoints

After each phase, verify:

| Phase | Verification |
|-------|-------------|
| 1 | `npx tsc --noEmit` passes, all types resolve |
| 2 | TypeScript compiles, LedTipTracker outputs correct data |
| 3 | Shaders compile in WebGL2 context, framebuffers allocate |
| 4 | Enable LED via console → glowing dots appear on animated props |
| 5 | LED Lab module loads, tuning controls work, point editor works |
| 6 | Toggle in Settings > Visibility enables/disables LEDs |
| 7 | Manufacturer presets load correct point configurations |

**The key visual milestone is Phase 4 completion:** enabling LEDs via `getAnimationVisibilityManager().setLedEffect(true)` in the browser console should show glowing, trailing, blooming LED dots on spinning props.

---

## Files Created/Modified Summary

### New Files (17)

| File | Phase |
|------|-------|
| `animation-engine/domain/types/LedTypes.ts` | 1 |
| `animation-engine/domain/types/PropLedPoints.ts` | 1 |
| `animation-engine/domain/types/LedPatterns.ts` | 1 |
| `animation-engine/services/contracts/ILedOverlayRenderer.ts` | 2 |
| `animation-engine/services/contracts/ILedTipTracker.ts` | 2 |
| `animation-engine/services/implementations/LedTipTracker.ts` | 2 |
| `animation-engine/services/implementations/led/LedShaderSources.ts` | 3 |
| `animation-engine/services/implementations/led/WebGLLedRenderer.ts` | 3 |
| `features/led-lab/services/contracts/ILedPointOverrideProvider.ts` | 5 |
| `features/led-lab/services/implementations/LedPointOverrideProvider.ts` | 5 |
| `features/led-lab/state/led-point-editor-state.svelte.ts` | 5 |
| `features/led-lab/LedLabModule.svelte` | 5 |
| `di/containers/led-lab-container.ts` | 5 |
| `animation-engine/domain/types/LedManufacturerPresets.ts` | 7 |

### Modified Files (6)

| File | Phase | Changes |
|------|-------|---------|
| `animation-visibility-state.svelte.ts` | 4 | Add LED settings |
| `AnimationEngine.svelte.ts` | 4 | Wire LED renderer |
| `IAnimationRenderLoop.ts` | 4 | Add LED to config/params |
| `AnimationRenderLoop.ts` | 4 | Add LED render call |
| `tab-definitions.ts` | 5 | Add LED lab tab |
| `LabModule.svelte` | 5 | Add LED loader |
| `di/index.ts` | 5 | Wire LED container |
| Visibility settings component | 6 | Add LED toggle |
