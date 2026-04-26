# LED Strip Pattern Engine — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full-strip LED pattern engine that generates per-pixel-per-frame color data for POV pixel poi, renders POV images on 3D staves with persistence-of-vision trail accumulation, and uploads patterns to physical hardware via Web Bluetooth (Open-Pixel-Poi) and Web Serial (Ignis Pixel).

**Architecture:** `StripPattern` (ledCount x frameCount RGB array) is the universal currency consumed by all renderers and uploaders. Pattern sources: algorithmic presets (pure functions) and image upload. The 3D POV renderer distributes 200 instanced LED billboards along the staff axis, maps rotation angle to frame index, and accumulates trail ghosts in a ring buffer for persistence-of-vision. Device adapters use Web Bluetooth (Nordic UART) and Web Serial (STM32 VCP) to upload patterns to physical poi.

**Tech Stack:** Svelte 5 + TypeScript + ITI DI + Three.js (InstancedMesh) + Web Bluetooth API + Web Serial API

**Spec:** `docs/superpowers/specs/2026-04-08-led-strip-pattern-engine-design.md`

---

## Scope

This plan covers **Phase 1** (Pattern Engine + Image Upload + BLE adapter) and **Phase 2** (3D POV Renderer). Phases 3 (Ignis protocol) and 4 (2D renderer + motion mapping) are deferred to separate plans after the Wireshark capture session.

## File Structure

### New Files

```
src/lib/features/poi/
  domain/
    StripPattern.ts              — Core data types (StripFrame, StripPattern, PatternMetadata, PatternParams, RGBColor)
    PatternPreset.ts             — IPatternPreset interface + 5 built-in presets (solid, gradient, rainbow-sweep, pulse, prop-colors)
    DeviceTypes.ts               — PoiDeviceInfo, DeviceDetailedInfo, BleCommCode constants
  services/
    contracts/
      IStripPatternEngine.ts     — generate(), fromImage(), toImageData(), getPresets(), applyBrightnessLimit()
      IImagePatternLoader.ts     — fromImage(), fromFile()
      IPoiDeviceAdapter.ts       — scan(), connect() → IPoiConnection
      IPoiDeviceManager.ts       — adapters, scanAll(), connectedDevices, upload()
      IPovStripRenderer3DFactory.ts — create() → PovStripRenderer3D instance
    implementations/
      StripPatternEngine.ts      — Orchestrates presets + image loader + brightness limiting
      ImagePatternLoader.ts      — PNG/BMP/JPG → StripPattern via OffscreenCanvas
      OpenPixelPoiAdapter.ts     — Web Bluetooth Nordic UART, pattern upload with 509-byte chunking
      PoiDeviceManager.ts        — Aggregates adapters, manages connections
  state/
    poi-state.svelte.ts          — activePattern, activePresetId, connectedDevices, persistenceDuration, uploadProgress
  context/
    poi-context.ts               — setPoiContext() / getPoiContext()
  components/
    PatternPicker.svelte         — Preset grid + image upload dropzone
    DevicePanel.svelte           — Device list, scan, upload with progress
    PovPreview.svelte            — Flat POV image canvas preview
    StripPatternExporter.svelte  — PNG download button

src/lib/shared/3d/effects/poi/
  PovStripRenderer3D.ts          — 200-LED instanced renderer with trail ring buffer
  PovTrailRing.ts                — Ring buffer for POV trail position+color accumulation

src/lib/shared/di/containers/
  poi-container.ts               — DI container for all poi services

tests/unit/
  poi/
    strip-pattern-engine.test.ts — Preset generation, round-trip image, brightness limiting
    image-pattern-loader.test.ts — Image → StripPattern conversion
    pov-trail-ring.test.ts       — Ring buffer push/age/clear
    open-pixel-poi-adapter.test.ts — BLE packet building (no hardware needed)
```

### Modified Files

```
src/lib/shared/di/container-types.ts   — Add PoiContainer type import + items to IAppContainerItems
src/lib/shared/di/index.ts             — Import + wire poi-container
src/lib/shared/3d/effects/EffectOrchestrator3D.svelte — Route "led" to PovStripRenderer3D when strip pattern active
```

---

## Task 1: Core Domain Types

**Files:**
- Create: `src/lib/features/poi/domain/StripPattern.ts`
- Create: `src/lib/features/poi/domain/PatternPreset.ts`
- Create: `src/lib/features/poi/domain/DeviceTypes.ts`

- [ ] **Step 1: Create StripPattern.ts with core data model**

```typescript
// src/lib/features/poi/domain/StripPattern.ts

/**
 * Core data types for the LED strip pattern engine.
 * StripPattern is the universal currency: every renderer, exporter,
 * and uploader consumes it, every pattern source produces it.
 */

export interface RGBColor {
  r: number; // 0-255
  g: number;
  b: number;
}

/**
 * A single frame of the strip pattern — one color per LED.
 * In POV terms, this is one column of the image.
 */
export interface StripFrame {
  /** RGB interleaved: [R0, G0, B0, R1, G1, B1, ...], length = ledCount * 3 */
  colors: Uint8Array;
}

/**
 * A complete strip pattern: array of frames forming the POV image.
 * Height = ledCount (LEDs along the strip), Width = frameCount (columns).
 */
export interface StripPattern {
  /** Number of LEDs (height of the POV image) */
  ledCount: number;
  /** Number of frames (width of the POV image) */
  frameCount: number;
  /** One StripFrame per column */
  frames: StripFrame[];
  metadata: PatternMetadata;
}

export interface PatternMetadata {
  name: string;
  source: "algorithmic" | "image-upload";
  presetId?: string;
  sourceImagePath?: string;
  createdAt: number;
}

/**
 * Parameters for algorithmic pattern generation.
 */
export interface PatternParams {
  primaryColor: RGBColor;
  secondaryColor?: RGBColor;
  /** Pattern animation speed multiplier (0.1–5.0) */
  speed: number;
  /** Global brightness (0–1) */
  brightness: number;
}

/**
 * Create an empty StripPattern filled with black.
 */
export function createEmptyPattern(
  ledCount: number,
  frameCount: number,
  name: string
): StripPattern {
  const frames: StripFrame[] = [];
  for (let f = 0; f < frameCount; f++) {
    frames.push({ colors: new Uint8Array(ledCount * 3) });
  }
  return {
    ledCount,
    frameCount,
    frames,
    metadata: {
      name,
      source: "algorithmic",
      createdAt: Date.now(),
    },
  };
}

/**
 * Read the RGB color for a specific LED in a specific frame.
 */
export function getPixel(
  pattern: StripPattern,
  frameIndex: number,
  ledIndex: number
): RGBColor {
  const frame = pattern.frames[frameIndex % pattern.frameCount]!;
  const offset = ledIndex * 3;
  return {
    r: frame.colors[offset]!,
    g: frame.colors[offset + 1]!,
    b: frame.colors[offset + 2]!,
  };
}

/**
 * Set the RGB color for a specific LED in a specific frame.
 */
export function setPixel(
  pattern: StripPattern,
  frameIndex: number,
  ledIndex: number,
  color: RGBColor
): void {
  const frame = pattern.frames[frameIndex % pattern.frameCount]!;
  const offset = ledIndex * 3;
  frame.colors[offset] = color.r;
  frame.colors[offset + 1] = color.g;
  frame.colors[offset + 2] = color.b;
}
```

- [ ] **Step 2: Create PatternPreset.ts with interface and 5 built-in presets**

```typescript
// src/lib/features/poi/domain/PatternPreset.ts

import type { StripPattern, PatternParams, RGBColor } from "./StripPattern";
import { setPixel } from "./StripPattern";
import { createEmptyPattern } from "./StripPattern";

export type PresetCategory = "basic" | "motion-driven";

export interface IPatternPreset {
  id: string;
  name: string;
  category: PresetCategory;
  /** CSS color string for UI thumbnails */
  previewColor: string;
  generate(ledCount: number, frameCount: number, params: PatternParams): StripPattern;
}

// ---------------------------------------------------------------------------
// Helper: clamp to 0–255
// ---------------------------------------------------------------------------
function clamp255(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)));
}

// ---------------------------------------------------------------------------
// Helper: HSL → RGB (h: 0–360, s: 0–1, l: 0–1) → 0–255
// ---------------------------------------------------------------------------
function hslToRgb(h: number, s: number, l: number): RGBColor {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  return {
    r: clamp255((r + m) * 255),
    g: clamp255((g + m) * 255),
    b: clamp255((b + m) * 255),
  };
}

// ---------------------------------------------------------------------------
// Helper: linear interpolation between two colors
// ---------------------------------------------------------------------------
function lerpColor(a: RGBColor, b: RGBColor, t: number): RGBColor {
  return {
    r: clamp255(a.r + (b.r - a.r) * t),
    g: clamp255(a.g + (b.g - a.g) * t),
    b: clamp255(a.b + (b.b - a.b) * t),
  };
}

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------

const solidPreset: IPatternPreset = {
  id: "solid",
  name: "Solid",
  category: "basic",
  previewColor: "#ffffff",
  generate(ledCount, frameCount, params) {
    const pattern = createEmptyPattern(ledCount, frameCount, "Solid");
    pattern.metadata.presetId = "solid";
    const c: RGBColor = {
      r: clamp255(params.primaryColor.r * params.brightness),
      g: clamp255(params.primaryColor.g * params.brightness),
      b: clamp255(params.primaryColor.b * params.brightness),
    };
    for (let f = 0; f < frameCount; f++) {
      for (let led = 0; led < ledCount; led++) {
        setPixel(pattern, f, led, c);
      }
    }
    return pattern;
  },
};

const gradientPreset: IPatternPreset = {
  id: "gradient",
  name: "Gradient",
  category: "basic",
  previewColor: "linear-gradient(#00ff88, #3b82f6)",
  generate(ledCount, frameCount, params) {
    const pattern = createEmptyPattern(ledCount, frameCount, "Gradient");
    pattern.metadata.presetId = "gradient";
    const secondary = params.secondaryColor ?? { r: 0, g: 0, b: 0 };
    for (let f = 0; f < frameCount; f++) {
      for (let led = 0; led < ledCount; led++) {
        const t = ledCount > 1 ? led / (ledCount - 1) : 0;
        const c = lerpColor(params.primaryColor, secondary, t);
        setPixel(pattern, f, led, {
          r: clamp255(c.r * params.brightness),
          g: clamp255(c.g * params.brightness),
          b: clamp255(c.b * params.brightness),
        });
      }
    }
    return pattern;
  },
};

const rainbowSweepPreset: IPatternPreset = {
  id: "rainbow-sweep",
  name: "Rainbow Sweep",
  category: "basic",
  previewColor: "rainbow",
  generate(ledCount, frameCount, params) {
    const pattern = createEmptyPattern(ledCount, frameCount, "Rainbow Sweep");
    pattern.metadata.presetId = "rainbow-sweep";
    for (let f = 0; f < frameCount; f++) {
      for (let led = 0; led < ledCount; led++) {
        // Hue: spatial along strip + temporal advance per frame
        const spatialHue = (led / ledCount) * 360;
        const temporalOffset = (f / frameCount) * 360 * params.speed;
        const hue = (spatialHue + temporalOffset) % 360;
        const c = hslToRgb(hue, 1.0, 0.5);
        setPixel(pattern, f, led, {
          r: clamp255(c.r * params.brightness),
          g: clamp255(c.g * params.brightness),
          b: clamp255(c.b * params.brightness),
        });
      }
    }
    return pattern;
  },
};

const pulsePreset: IPatternPreset = {
  id: "pulse",
  name: "Pulse",
  category: "basic",
  previewColor: "#ff6600",
  generate(ledCount, frameCount, params) {
    const pattern = createEmptyPattern(ledCount, frameCount, "Pulse");
    pattern.metadata.presetId = "pulse";
    for (let f = 0; f < frameCount; f++) {
      for (let led = 0; led < ledCount; led++) {
        // Sine wave pulse traveling along strip
        const phase = (led / ledCount + (f / frameCount) * params.speed) * Math.PI * 2;
        const intensity = (Math.sin(phase) + 1) / 2; // 0–1
        setPixel(pattern, f, led, {
          r: clamp255(params.primaryColor.r * intensity * params.brightness),
          g: clamp255(params.primaryColor.g * intensity * params.brightness),
          b: clamp255(params.primaryColor.b * intensity * params.brightness),
        });
      }
    }
    return pattern;
  },
};

const propColorsPreset: IPatternPreset = {
  id: "prop-colors",
  name: "Prop Colors",
  category: "basic",
  previewColor: "#3b82f6",
  generate(ledCount, frameCount, params) {
    const pattern = createEmptyPattern(ledCount, frameCount, "Prop Colors");
    pattern.metadata.presetId = "prop-colors";
    // Half the strip in primary color, half in secondary (or red if no secondary)
    const secondary = params.secondaryColor ?? { r: 239, g: 68, b: 68 };
    const midpoint = Math.floor(ledCount / 2);
    for (let f = 0; f < frameCount; f++) {
      for (let led = 0; led < ledCount; led++) {
        const c = led < midpoint ? params.primaryColor : secondary;
        setPixel(pattern, f, led, {
          r: clamp255(c.r * params.brightness),
          g: clamp255(c.g * params.brightness),
          b: clamp255(c.b * params.brightness),
        });
      }
    }
    return pattern;
  },
};

/** All built-in pattern presets */
export const BUILT_IN_PRESETS: IPatternPreset[] = [
  solidPreset,
  gradientPreset,
  rainbowSweepPreset,
  pulsePreset,
  propColorsPreset,
];
```

- [ ] **Step 3: Create DeviceTypes.ts**

```typescript
// src/lib/features/poi/domain/DeviceTypes.ts

/**
 * Hardware device types for poi connectivity.
 */

export interface PoiDeviceInfo {
  id: string;
  name: string;
  model: string;
  connectionType: "ble" | "usb-serial";
  ledCount: number;
  ledType: "ws2812b" | "sk9822";
}

export interface DeviceDetailedInfo extends PoiDeviceInfo {
  firmwareVersion: string;
  bootloaderVersion?: string;
  uid: string;
  batteryLevel?: number;
}

/**
 * Open-Pixel-Poi BLE protocol constants.
 * Packet format: [0xD0] [CommCode] [payload] [0xD1]
 */
export const BLE_START_BYTE = 0xd0;
export const BLE_END_BYTE = 0xd1;

export enum BleCommCode {
  /** Upload pattern image data */
  IMAGE_UPLOAD = 0x04,
  /** Set global brightness (0–255) */
  SET_BRIGHTNESS = 0x02,
  /** Set rotation speed (uint16 BE, Hz) */
  SET_SPEED = 0x03,
}

/** Maximum bytes per BLE write (MTU-limited) */
export const BLE_CHUNK_SIZE = 509;

/** Maximum total pixel count for Open-Pixel-Poi */
export const OPP_MAX_PIXELS = 40_000;

/** Nordic UART Service UUID */
export const NORDIC_UART_SERVICE = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
/** Nordic UART TX characteristic (write to device) */
export const NORDIC_UART_TX = "6e400002-b5a3-f393-e0a9-e50e24dcca9e";
/** Nordic UART RX characteristic (read from device) */
export const NORDIC_UART_RX = "6e400003-b5a3-f393-e0a9-e50e24dcca9e";
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/poi/domain/StripPattern.ts src/lib/features/poi/domain/PatternPreset.ts src/lib/features/poi/domain/DeviceTypes.ts
git commit -m "feat(poi): add core domain types — StripPattern, presets, device types"
```

---

## Task 2: StripPatternEngine + ImagePatternLoader Services

**Files:**
- Create: `src/lib/features/poi/services/contracts/IStripPatternEngine.ts`
- Create: `src/lib/features/poi/services/contracts/IImagePatternLoader.ts`
- Create: `src/lib/features/poi/services/implementations/StripPatternEngine.ts`
- Create: `src/lib/features/poi/services/implementations/ImagePatternLoader.ts`

- [ ] **Step 1: Create IStripPatternEngine contract**

```typescript
// src/lib/features/poi/services/contracts/IStripPatternEngine.ts

import type { StripPattern, PatternParams } from "../../domain/StripPattern";
import type { IPatternPreset } from "../../domain/PatternPreset";

export interface IStripPatternEngine {
  /** Generate a pattern from a registered preset */
  generate(presetId: string, ledCount: number, frameCount: number, params: PatternParams): StripPattern;

  /** Create a StripPattern from raw image pixel data */
  fromImage(imageData: ImageData, ledCount: number): StripPattern;

  /** Convert a StripPattern back to ImageData (for PNG export / preview) */
  toImageData(pattern: StripPattern): ImageData;

  /** List all available presets */
  getPresets(): IPatternPreset[];

  /**
   * Apply Ignis-style brightness power limiting.
   * Returns a new pattern with per-column brightness capped.
   * Original pattern is not mutated.
   */
  applyBrightnessLimit(
    pattern: StripPattern,
    maxBright: number,
    maxPower: number,
    groupSize: number
  ): StripPattern;
}
```

- [ ] **Step 2: Create IImagePatternLoader contract**

```typescript
// src/lib/features/poi/services/contracts/IImagePatternLoader.ts

import type { StripPattern } from "../../domain/StripPattern";

export interface IImagePatternLoader {
  /** Convert raw ImageData to a StripPattern, resizing height to targetLedCount */
  fromImageData(imageData: ImageData, targetLedCount: number): StripPattern;

  /** Load a File (PNG/BMP/JPG), decode, and convert to StripPattern */
  fromFile(file: File, targetLedCount: number): Promise<StripPattern>;
}
```

- [ ] **Step 3: Create ImagePatternLoader implementation**

```typescript
// src/lib/features/poi/services/implementations/ImagePatternLoader.ts

import type { IImagePatternLoader } from "../contracts/IImagePatternLoader";
import type { StripPattern, StripFrame } from "../../domain/StripPattern";

/**
 * Converts raster images into StripPattern data.
 * Image height maps to ledCount, image width maps to frameCount.
 * Uses OffscreenCanvas for resizing when the source height differs
 * from the target LED count.
 */
export class ImagePatternLoader implements IImagePatternLoader {
  fromImageData(imageData: ImageData, targetLedCount: number): StripPattern {
    const sourceHeight = imageData.height;
    const sourceWidth = imageData.width;

    // Resize if source height doesn't match target LED count
    let pixelData: Uint8ClampedArray;
    let width: number;
    let height: number;

    if (sourceHeight !== targetLedCount) {
      const canvas = new OffscreenCanvas(sourceWidth, targetLedCount);
      const ctx = canvas.getContext("2d")!;
      // Draw source image scaled to target height
      const tempCanvas = new OffscreenCanvas(sourceWidth, sourceHeight);
      const tempCtx = tempCanvas.getContext("2d")!;
      tempCtx.putImageData(imageData, 0, 0);
      ctx.drawImage(tempCanvas, 0, 0, sourceWidth, sourceHeight, 0, 0, sourceWidth, targetLedCount);
      const resized = ctx.getImageData(0, 0, sourceWidth, targetLedCount);
      pixelData = resized.data;
      width = sourceWidth;
      height = targetLedCount;
    } else {
      pixelData = imageData.data;
      width = sourceWidth;
      height = sourceHeight;
    }

    // Each column of the image = one frame
    const frames: StripFrame[] = [];
    for (let col = 0; col < width; col++) {
      const colors = new Uint8Array(height * 3);
      for (let row = 0; row < height; row++) {
        const srcIdx = (row * width + col) * 4; // RGBA
        const dstIdx = row * 3;
        colors[dstIdx] = pixelData[srcIdx]!;     // R
        colors[dstIdx + 1] = pixelData[srcIdx + 1]!; // G
        colors[dstIdx + 2] = pixelData[srcIdx + 2]!; // B
        // Alpha channel is ignored — fully transparent pixels become black
      }
      frames.push({ colors });
    }

    return {
      ledCount: height,
      frameCount: width,
      frames,
      metadata: {
        name: "Image Upload",
        source: "image-upload",
        createdAt: Date.now(),
      },
    };
  }

  async fromFile(file: File, targetLedCount: number): Promise<StripPattern> {
    const bitmap = await createImageBitmap(file);
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(bitmap, 0, 0);
    const imageData = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
    bitmap.close();

    const pattern = this.fromImageData(imageData, targetLedCount);
    pattern.metadata.sourceImagePath = file.name;
    pattern.metadata.name = file.name.replace(/\.[^.]+$/, "");
    return pattern;
  }
}
```

- [ ] **Step 4: Create StripPatternEngine implementation**

```typescript
// src/lib/features/poi/services/implementations/StripPatternEngine.ts

import type { IStripPatternEngine } from "../contracts/IStripPatternEngine";
import type { IImagePatternLoader } from "../contracts/IImagePatternLoader";
import type { StripPattern, PatternParams, StripFrame } from "../../domain/StripPattern";
import type { IPatternPreset } from "../../domain/PatternPreset";
import { BUILT_IN_PRESETS } from "../../domain/PatternPreset";

/**
 * Orchestrates pattern generation from presets and image loading.
 * Also handles brightness limiting for hardware upload.
 */
export class StripPatternEngine implements IStripPatternEngine {
  private presets: Map<string, IPatternPreset>;

  constructor(private imageLoader: IImagePatternLoader) {
    this.presets = new Map();
    for (const preset of BUILT_IN_PRESETS) {
      this.presets.set(preset.id, preset);
    }
  }

  generate(
    presetId: string,
    ledCount: number,
    frameCount: number,
    params: PatternParams
  ): StripPattern {
    const preset = this.presets.get(presetId);
    if (!preset) {
      throw new Error(`Unknown preset: ${presetId}. Available: ${[...this.presets.keys()].join(", ")}`);
    }
    return preset.generate(ledCount, frameCount, params);
  }

  fromImage(imageData: ImageData, ledCount: number): StripPattern {
    return this.imageLoader.fromImageData(imageData, ledCount);
  }

  toImageData(pattern: StripPattern): ImageData {
    const { ledCount, frameCount, frames } = pattern;
    const data = new Uint8ClampedArray(frameCount * ledCount * 4);

    for (let col = 0; col < frameCount; col++) {
      const frame = frames[col]!;
      for (let row = 0; row < ledCount; row++) {
        const srcIdx = row * 3;
        const dstIdx = (row * frameCount + col) * 4;
        data[dstIdx] = frame.colors[srcIdx]!;     // R
        data[dstIdx + 1] = frame.colors[srcIdx + 1]!; // G
        data[dstIdx + 2] = frame.colors[srcIdx + 2]!; // B
        data[dstIdx + 3] = 255;                        // A
      }
    }

    return new ImageData(data, frameCount, ledCount);
  }

  getPresets(): IPatternPreset[] {
    return [...this.presets.values()];
  }

  applyBrightnessLimit(
    pattern: StripPattern,
    maxBright: number,
    maxPower: number,
    groupSize: number
  ): StripPattern {
    const { ledCount, frameCount, frames } = pattern;
    const limitedFrames: StripFrame[] = [];

    for (let f = 0; f < frameCount; f++) {
      const srcFrame = frames[f]!;
      const dstColors = new Uint8Array(srcFrame.colors.length);

      // Compute average brightness for this column
      let totalBrightness = 0;
      for (let led = 0; led < ledCount; led++) {
        const offset = led * 3;
        const r = srcFrame.colors[offset]!;
        const g = srcFrame.colors[offset + 1]!;
        const b = srcFrame.colors[offset + 2]!;
        totalBrightness += (r + g + b) / (3 * 255);
      }
      const avgBright = totalBrightness / ledCount;

      // Ignis brightness formula: ledBright = min(maxBright, floor(maxPower / avgBright))
      const ledBright =
        avgBright > 0
          ? Math.min(maxBright, Math.floor(maxPower / avgBright))
          : maxBright;

      // Scale all colors by ledBright / maxBright ratio
      const scale = ledBright / maxBright;
      for (let i = 0; i < srcFrame.colors.length; i++) {
        dstColors[i] = Math.round(srcFrame.colors[i]! * scale);
      }

      limitedFrames.push({ colors: dstColors });
    }

    return {
      ledCount,
      frameCount,
      frames: limitedFrames,
      metadata: { ...pattern.metadata },
    };
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/poi/services/contracts/IStripPatternEngine.ts src/lib/features/poi/services/contracts/IImagePatternLoader.ts src/lib/features/poi/services/implementations/StripPatternEngine.ts src/lib/features/poi/services/implementations/ImagePatternLoader.ts
git commit -m "feat(poi): add StripPatternEngine + ImagePatternLoader services"
```

---

## Task 3: Unit Tests for Pattern Engine

**Files:**
- Create: `tests/unit/poi/strip-pattern-engine.test.ts`
- Create: `tests/unit/poi/image-pattern-loader.test.ts`

- [ ] **Step 1: Write strip-pattern-engine tests**

```typescript
// tests/unit/poi/strip-pattern-engine.test.ts

import { describe, it, expect } from "vitest";
import { StripPatternEngine } from "$lib/features/poi/services/implementations/StripPatternEngine";
import { ImagePatternLoader } from "$lib/features/poi/services/implementations/ImagePatternLoader";
import { getPixel, setPixel, createEmptyPattern } from "$lib/features/poi/domain/StripPattern";
import type { PatternParams, RGBColor } from "$lib/features/poi/domain/StripPattern";

function defaultParams(overrides: Partial<PatternParams> = {}): PatternParams {
  return {
    primaryColor: { r: 255, g: 0, b: 0 },
    speed: 1.0,
    brightness: 1.0,
    ...overrides,
  };
}

describe("StripPatternEngine", () => {
  const imageLoader = new ImagePatternLoader();
  const engine = new StripPatternEngine(imageLoader);

  describe("presets", () => {
    it("lists 5 built-in presets", () => {
      expect(engine.getPresets()).toHaveLength(5);
      const ids = engine.getPresets().map((p) => p.id);
      expect(ids).toContain("solid");
      expect(ids).toContain("gradient");
      expect(ids).toContain("rainbow-sweep");
      expect(ids).toContain("pulse");
      expect(ids).toContain("prop-colors");
    });

    it("throws for unknown preset", () => {
      expect(() => engine.generate("nonexistent", 10, 10, defaultParams())).toThrow(
        "Unknown preset: nonexistent"
      );
    });
  });

  describe("solid preset", () => {
    it("fills every pixel with the primary color", () => {
      const pattern = engine.generate("solid", 10, 5, defaultParams());
      expect(pattern.ledCount).toBe(10);
      expect(pattern.frameCount).toBe(5);
      for (let f = 0; f < 5; f++) {
        for (let led = 0; led < 10; led++) {
          const px = getPixel(pattern, f, led);
          expect(px.r).toBe(255);
          expect(px.g).toBe(0);
          expect(px.b).toBe(0);
        }
      }
    });

    it("applies brightness scaling", () => {
      const pattern = engine.generate("solid", 4, 2, defaultParams({ brightness: 0.5 }));
      const px = getPixel(pattern, 0, 0);
      expect(px.r).toBe(128); // 255 * 0.5 ≈ 128
      expect(px.g).toBe(0);
    });
  });

  describe("gradient preset", () => {
    it("interpolates from primary to secondary along LEDs", () => {
      const params = defaultParams({
        primaryColor: { r: 255, g: 0, b: 0 },
        secondaryColor: { r: 0, g: 0, b: 255 },
      });
      const pattern = engine.generate("gradient", 3, 1, params);
      // First LED = pure red
      const first = getPixel(pattern, 0, 0);
      expect(first.r).toBe(255);
      expect(first.b).toBe(0);
      // Last LED = pure blue
      const last = getPixel(pattern, 0, 2);
      expect(last.r).toBe(0);
      expect(last.b).toBe(255);
    });
  });

  describe("rainbow-sweep preset", () => {
    it("produces varying hues along the strip", () => {
      const pattern = engine.generate("rainbow-sweep", 20, 10, defaultParams());
      // First and last LED in the same frame should differ
      const first = getPixel(pattern, 0, 0);
      const last = getPixel(pattern, 0, 19);
      const same = first.r === last.r && first.g === last.g && first.b === last.b;
      expect(same).toBe(false);
    });
  });

  describe("toImageData round-trip", () => {
    it("converts pattern to ImageData and back", () => {
      const original = engine.generate("solid", 8, 4, defaultParams());
      const imageData = engine.toImageData(original);
      expect(imageData.width).toBe(4);
      expect(imageData.height).toBe(8);

      const roundTripped = engine.fromImage(imageData, 8);
      for (let f = 0; f < 4; f++) {
        for (let led = 0; led < 8; led++) {
          const orig = getPixel(original, f, led);
          const rt = getPixel(roundTripped, f, led);
          expect(rt.r).toBe(orig.r);
          expect(rt.g).toBe(orig.g);
          expect(rt.b).toBe(orig.b);
        }
      }
    });
  });

  describe("brightness limiting", () => {
    it("caps bright columns more than dim columns", () => {
      // Bright column: all white (avgBright = 1.0)
      // ledBright = min(21, floor(0.226 / 1.0)) = min(21, 0) = 0
      // Scale = 0 / 21 = 0 → all black
      const pattern = createEmptyPattern(4, 2, "test");
      for (let led = 0; led < 4; led++) {
        setPixel(pattern, 0, led, { r: 255, g: 255, b: 255 }); // bright column
        setPixel(pattern, 1, led, { r: 10, g: 10, b: 10 });    // dim column
      }

      const limited = engine.applyBrightnessLimit(pattern, 21, 0.226, 8);

      // Bright column: heavily limited
      const brightPx = getPixel(limited, 0, 0);
      expect(brightPx.r).toBe(0); // floor(0.226/1.0) = 0, scale = 0

      // Dim column: avgBright ≈ 0.039, floor(0.226/0.039) = 5, scale = 5/21 ≈ 0.238
      const dimPx = getPixel(limited, 1, 0);
      expect(dimPx.r).toBeGreaterThan(0);
      expect(dimPx.r).toBeLessThan(10);
    });

    it("preserves dark patterns unchanged (capped at maxBright)", () => {
      // Very dim: avgBright ≈ 0.0039, floor(0.226/0.0039) = 57 > 21, so ledBright = 21
      // scale = 21/21 = 1.0 → unchanged
      const pattern = createEmptyPattern(4, 1, "test");
      for (let led = 0; led < 4; led++) {
        setPixel(pattern, 0, led, { r: 1, g: 1, b: 1 });
      }
      const limited = engine.applyBrightnessLimit(pattern, 21, 0.226, 8);
      const px = getPixel(limited, 0, 0);
      expect(px.r).toBe(1);
    });
  });
});
```

- [ ] **Step 2: Write image-pattern-loader tests**

```typescript
// tests/unit/poi/image-pattern-loader.test.ts

import { describe, it, expect } from "vitest";
import { ImagePatternLoader } from "$lib/features/poi/services/implementations/ImagePatternLoader";
import { getPixel } from "$lib/features/poi/domain/StripPattern";

describe("ImagePatternLoader", () => {
  const loader = new ImagePatternLoader();

  it("converts a 3x2 image to a 3-LED 2-frame pattern", () => {
    // 3 rows (height/LEDs) x 2 columns (width/frames)
    // Pixel layout (RGBA):
    //   (0,0)=red   (1,0)=green
    //   (0,1)=blue  (1,1)=white
    //   (0,2)=black (1,2)=yellow
    const data = new Uint8ClampedArray([
      255, 0, 0, 255,     0, 255, 0, 255,   // row 0: red, green
      0, 0, 255, 255,     255, 255, 255, 255, // row 1: blue, white
      0, 0, 0, 255,       255, 255, 0, 255,   // row 2: black, yellow
    ]);
    const imageData = new ImageData(data, 2, 3);

    const pattern = loader.fromImageData(imageData, 3);

    expect(pattern.ledCount).toBe(3);
    expect(pattern.frameCount).toBe(2);

    // Frame 0 (column 0): red, blue, black
    expect(getPixel(pattern, 0, 0)).toEqual({ r: 255, g: 0, b: 0 });
    expect(getPixel(pattern, 0, 1)).toEqual({ r: 0, g: 0, b: 255 });
    expect(getPixel(pattern, 0, 2)).toEqual({ r: 0, g: 0, b: 0 });

    // Frame 1 (column 1): green, white, yellow
    expect(getPixel(pattern, 1, 0)).toEqual({ r: 0, g: 255, b: 0 });
    expect(getPixel(pattern, 1, 1)).toEqual({ r: 255, g: 255, b: 255 });
    expect(getPixel(pattern, 1, 2)).toEqual({ r: 255, g: 255, b: 0 });
  });

  it("sets metadata source to image-upload", () => {
    const imageData = new ImageData(new Uint8ClampedArray(4 * 4), 2, 2);
    const pattern = loader.fromImageData(imageData, 2);
    expect(pattern.metadata.source).toBe("image-upload");
  });
});
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run tests/unit/poi/ --reporter=verbose`
Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add tests/unit/poi/strip-pattern-engine.test.ts tests/unit/poi/image-pattern-loader.test.ts
git commit -m "test(poi): unit tests for pattern engine + image loader"
```

---

## Task 4: Open-Pixel-Poi BLE Adapter

**Files:**
- Create: `src/lib/features/poi/services/contracts/IPoiDeviceAdapter.ts`
- Create: `src/lib/features/poi/services/implementations/OpenPixelPoiAdapter.ts`
- Create: `tests/unit/poi/open-pixel-poi-adapter.test.ts`

- [ ] **Step 1: Create IPoiDeviceAdapter and IPoiConnection contracts**

```typescript
// src/lib/features/poi/services/contracts/IPoiDeviceAdapter.ts

import type { PoiDeviceInfo, DeviceDetailedInfo } from "../../domain/DeviceTypes";
import type { StripPattern } from "../../domain/StripPattern";

export interface IPoiConnection {
  readonly deviceInfo: PoiDeviceInfo;
  readonly connected: boolean;
  uploadPattern(
    pattern: StripPattern,
    slot: number,
    onProgress?: (pct: number) => void
  ): Promise<void>;
  setBrightness(level: number): Promise<void>;
  setSpeed(hz: number): Promise<void>;
  disconnect(): void;
}

export interface IPoiDeviceAdapter {
  readonly protocolName: string;
  scan(): Promise<PoiDeviceInfo[]>;
  connect(device: PoiDeviceInfo): Promise<IPoiConnection>;
}
```

- [ ] **Step 2: Create OpenPixelPoiAdapter with packet building**

```typescript
// src/lib/features/poi/services/implementations/OpenPixelPoiAdapter.ts

import type { IPoiDeviceAdapter, IPoiConnection } from "../contracts/IPoiDeviceAdapter";
import type { PoiDeviceInfo } from "../../domain/DeviceTypes";
import type { StripPattern } from "../../domain/StripPattern";
import {
  BLE_START_BYTE,
  BLE_END_BYTE,
  BleCommCode,
  BLE_CHUNK_SIZE,
  OPP_MAX_PIXELS,
  NORDIC_UART_SERVICE,
  NORDIC_UART_TX,
} from "../../domain/DeviceTypes";

/**
 * Build the complete BLE packet for an Open-Pixel-Poi pattern upload.
 * Exported for unit testing (no hardware dependency).
 *
 * Format: [0xD0] [0x04] [height:1] [count:2 BE] [RGB data...] [0xD1]
 * Where count = ledCount * frameCount (total pixels)
 */
export function buildPatternPacket(pattern: StripPattern): Uint8Array {
  const totalPixels = pattern.ledCount * pattern.frameCount;
  if (totalPixels > OPP_MAX_PIXELS) {
    throw new Error(
      `Pattern has ${totalPixels} pixels, exceeds Open-Pixel-Poi limit of ${OPP_MAX_PIXELS}`
    );
  }

  // Header: start byte + comm code + height + pixel count (2 bytes BE)
  const headerSize = 5;
  const dataSize = totalPixels * 3;
  const totalSize = headerSize + dataSize + 1; // +1 for end byte

  const packet = new Uint8Array(totalSize);
  let offset = 0;

  packet[offset++] = BLE_START_BYTE;
  packet[offset++] = BleCommCode.IMAGE_UPLOAD;
  packet[offset++] = pattern.ledCount; // height (1 byte, max 255)
  packet[offset++] = (totalPixels >> 8) & 0xff; // count high byte
  packet[offset++] = totalPixels & 0xff;         // count low byte

  // RGB data: frame-major order (column by column)
  for (let f = 0; f < pattern.frameCount; f++) {
    const frame = pattern.frames[f]!;
    for (let led = 0; led < pattern.ledCount; led++) {
      const srcIdx = led * 3;
      packet[offset++] = frame.colors[srcIdx]!;
      packet[offset++] = frame.colors[srcIdx + 1]!;
      packet[offset++] = frame.colors[srcIdx + 2]!;
    }
  }

  packet[offset++] = BLE_END_BYTE;
  return packet;
}

/**
 * Build a brightness command packet.
 * Format: [0xD0] [0x02] [brightness:1] [0xD1]
 */
export function buildBrightnessPacket(brightness: number): Uint8Array {
  const clamped = Math.max(0, Math.min(255, Math.round(brightness)));
  return new Uint8Array([BLE_START_BYTE, BleCommCode.SET_BRIGHTNESS, clamped, BLE_END_BYTE]);
}

/**
 * Build a speed command packet.
 * Format: [0xD0] [0x03] [hz_high:1] [hz_low:1] [0xD1]
 */
export function buildSpeedPacket(hz: number): Uint8Array {
  const clamped = Math.max(0, Math.min(65535, Math.round(hz)));
  return new Uint8Array([
    BLE_START_BYTE,
    BleCommCode.SET_SPEED,
    (clamped >> 8) & 0xff,
    clamped & 0xff,
    BLE_END_BYTE,
  ]);
}

/**
 * Split a packet into BLE-sized chunks for transmission.
 */
export function chunkPacket(packet: Uint8Array, chunkSize: number = BLE_CHUNK_SIZE): Uint8Array[] {
  const chunks: Uint8Array[] = [];
  for (let i = 0; i < packet.length; i += chunkSize) {
    chunks.push(packet.slice(i, Math.min(i + chunkSize, packet.length)));
  }
  return chunks;
}

/**
 * Web Bluetooth adapter for Open-Pixel-Poi hardware.
 * Requires browser with Web Bluetooth API support.
 */
export class OpenPixelPoiAdapter implements IPoiDeviceAdapter {
  readonly protocolName = "Open-Pixel-Poi BLE";

  async scan(): Promise<PoiDeviceInfo[]> {
    if (!navigator.bluetooth) {
      throw new Error("Web Bluetooth API not available in this browser");
    }

    const device = await navigator.bluetooth.requestDevice({
      filters: [{ services: [NORDIC_UART_SERVICE] }],
      optionalServices: [NORDIC_UART_SERVICE],
    });

    if (!device) return [];

    return [
      {
        id: device.id,
        name: device.name ?? "Open-Pixel-Poi",
        model: "Open-Pixel-Poi",
        connectionType: "ble",
        ledCount: 55, // Default; user can override
        ledType: "ws2812b",
      },
    ];
  }

  async connect(device: PoiDeviceInfo): Promise<IPoiConnection> {
    if (!navigator.bluetooth) {
      throw new Error("Web Bluetooth API not available in this browser");
    }

    const btDevices = await navigator.bluetooth.getDevices();
    const btDevice = btDevices.find((d) => d.id === device.id);
    if (!btDevice) {
      throw new Error(`BLE device ${device.id} no longer available`);
    }

    const server = await btDevice.gatt!.connect();
    const service = await server.getPrimaryService(NORDIC_UART_SERVICE);
    const txChar = await service.getCharacteristic(NORDIC_UART_TX);

    return new OpenPixelPoiConnection(device, server, txChar);
  }
}

class OpenPixelPoiConnection implements IPoiConnection {
  readonly deviceInfo: PoiDeviceInfo;
  private server: BluetoothRemoteGATTServer;
  private txChar: BluetoothRemoteGATTCharacteristic;

  constructor(
    deviceInfo: PoiDeviceInfo,
    server: BluetoothRemoteGATTServer,
    txChar: BluetoothRemoteGATTCharacteristic
  ) {
    this.deviceInfo = deviceInfo;
    this.server = server;
    this.txChar = txChar;
  }

  get connected(): boolean {
    return this.server.connected;
  }

  async uploadPattern(
    pattern: StripPattern,
    _slot: number,
    onProgress?: (pct: number) => void
  ): Promise<void> {
    const packet = buildPatternPacket(pattern);
    const chunks = chunkPacket(packet);

    for (let i = 0; i < chunks.length; i++) {
      await this.txChar.writeValueWithoutResponse(chunks[i]!);
      onProgress?.(((i + 1) / chunks.length) * 100);
    }
  }

  async setBrightness(level: number): Promise<void> {
    const packet = buildBrightnessPacket(level);
    await this.txChar.writeValueWithoutResponse(packet);
  }

  async setSpeed(hz: number): Promise<void> {
    const packet = buildSpeedPacket(hz);
    await this.txChar.writeValueWithoutResponse(packet);
  }

  disconnect(): void {
    if (this.server.connected) {
      this.server.disconnect();
    }
  }
}
```

- [ ] **Step 3: Write BLE packet building tests**

```typescript
// tests/unit/poi/open-pixel-poi-adapter.test.ts

import { describe, it, expect } from "vitest";
import {
  buildPatternPacket,
  buildBrightnessPacket,
  buildSpeedPacket,
  chunkPacket,
} from "$lib/features/poi/services/implementations/OpenPixelPoiAdapter";
import { createEmptyPattern, setPixel } from "$lib/features/poi/domain/StripPattern";
import { BLE_START_BYTE, BLE_END_BYTE, BleCommCode } from "$lib/features/poi/domain/DeviceTypes";

describe("Open-Pixel-Poi packet building", () => {
  describe("buildPatternPacket", () => {
    it("builds correct header for a 3-LED 2-frame pattern", () => {
      const pattern = createEmptyPattern(3, 2, "test");
      setPixel(pattern, 0, 0, { r: 255, g: 0, b: 0 });

      const packet = buildPatternPacket(pattern);

      // Header: [0xD0] [0x04] [height=3] [count_hi] [count_lo]
      expect(packet[0]).toBe(BLE_START_BYTE);
      expect(packet[1]).toBe(BleCommCode.IMAGE_UPLOAD);
      expect(packet[2]).toBe(3); // ledCount
      // Total pixels = 3 * 2 = 6
      expect(packet[3]).toBe(0); // count high byte
      expect(packet[4]).toBe(6); // count low byte

      // First pixel data: red
      expect(packet[5]).toBe(255);
      expect(packet[6]).toBe(0);
      expect(packet[7]).toBe(0);

      // End byte
      expect(packet[packet.length - 1]).toBe(BLE_END_BYTE);

      // Total size: 5 header + 6*3 data + 1 end = 24
      expect(packet.length).toBe(24);
    });

    it("throws when pattern exceeds 40,000 pixels", () => {
      const pattern = createEmptyPattern(200, 201, "too-big"); // 200*201 = 40200 > 40000
      expect(() => buildPatternPacket(pattern)).toThrow("exceeds Open-Pixel-Poi limit");
    });
  });

  describe("buildBrightnessPacket", () => {
    it("builds a 4-byte brightness command", () => {
      const packet = buildBrightnessPacket(128);
      expect(packet).toEqual(
        new Uint8Array([BLE_START_BYTE, BleCommCode.SET_BRIGHTNESS, 128, BLE_END_BYTE])
      );
    });

    it("clamps brightness to 0–255", () => {
      expect(buildBrightnessPacket(300)[2]).toBe(255);
      expect(buildBrightnessPacket(-10)[2]).toBe(0);
    });
  });

  describe("buildSpeedPacket", () => {
    it("encodes speed as uint16 big-endian", () => {
      const packet = buildSpeedPacket(300); // 0x012C
      expect(packet[0]).toBe(BLE_START_BYTE);
      expect(packet[1]).toBe(BleCommCode.SET_SPEED);
      expect(packet[2]).toBe(1);   // 300 >> 8
      expect(packet[3]).toBe(44);  // 300 & 0xFF
      expect(packet[4]).toBe(BLE_END_BYTE);
    });
  });

  describe("chunkPacket", () => {
    it("splits a packet into chunks of given size", () => {
      const data = new Uint8Array(1200);
      const chunks = chunkPacket(data, 509);
      expect(chunks).toHaveLength(3); // 509 + 509 + 182
      expect(chunks[0]!.length).toBe(509);
      expect(chunks[1]!.length).toBe(509);
      expect(chunks[2]!.length).toBe(182);
    });

    it("returns single chunk for small packets", () => {
      const data = new Uint8Array(100);
      const chunks = chunkPacket(data, 509);
      expect(chunks).toHaveLength(1);
      expect(chunks[0]!.length).toBe(100);
    });
  });
});
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/unit/poi/ --reporter=verbose`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/poi/services/contracts/IPoiDeviceAdapter.ts src/lib/features/poi/services/implementations/OpenPixelPoiAdapter.ts tests/unit/poi/open-pixel-poi-adapter.test.ts
git commit -m "feat(poi): Open-Pixel-Poi BLE adapter with packet building + tests"
```

---

## Task 5: Device Manager Service

**Files:**
- Create: `src/lib/features/poi/services/contracts/IPoiDeviceManager.ts`
- Create: `src/lib/features/poi/services/implementations/PoiDeviceManager.ts`

- [ ] **Step 1: Create IPoiDeviceManager contract**

```typescript
// src/lib/features/poi/services/contracts/IPoiDeviceManager.ts

import type { IPoiDeviceAdapter, IPoiConnection } from "./IPoiDeviceAdapter";
import type { PoiDeviceInfo } from "../../domain/DeviceTypes";
import type { StripPattern } from "../../domain/StripPattern";

export interface IPoiDeviceManager {
  /** All registered adapters */
  readonly adapters: IPoiDeviceAdapter[];

  /** Currently active connections */
  readonly connections: IPoiConnection[];

  /** Trigger scan on all adapters, returns discovered devices */
  scanAll(): Promise<PoiDeviceInfo[]>;

  /** Connect to a specific device via the appropriate adapter */
  connect(device: PoiDeviceInfo): Promise<IPoiConnection>;

  /** Disconnect a specific device */
  disconnect(deviceId: string): void;

  /** Upload pattern to a specific connected device */
  uploadPattern(
    deviceId: string,
    pattern: StripPattern,
    slot: number,
    onProgress?: (pct: number) => void
  ): Promise<void>;

  /** Upload pattern to ALL connected devices simultaneously */
  uploadToAll(
    pattern: StripPattern,
    slot: number,
    onProgress?: (pct: number) => void
  ): Promise<void>;
}
```

- [ ] **Step 2: Create PoiDeviceManager implementation**

```typescript
// src/lib/features/poi/services/implementations/PoiDeviceManager.ts

import type { IPoiDeviceManager } from "../contracts/IPoiDeviceManager";
import type { IPoiDeviceAdapter, IPoiConnection } from "../contracts/IPoiDeviceAdapter";
import type { PoiDeviceInfo } from "../../domain/DeviceTypes";
import type { StripPattern } from "../../domain/StripPattern";

/**
 * Aggregates multiple device adapters (BLE, USB Serial) and manages
 * connections + pattern uploads across all connected poi.
 */
export class PoiDeviceManager implements IPoiDeviceManager {
  private _adapters: IPoiDeviceAdapter[];
  private _connections: Map<string, IPoiConnection> = new Map();
  private _deviceToAdapter: Map<string, IPoiDeviceAdapter> = new Map();

  constructor(adapters: IPoiDeviceAdapter[]) {
    this._adapters = adapters;
  }

  get adapters(): IPoiDeviceAdapter[] {
    return this._adapters;
  }

  get connections(): IPoiConnection[] {
    return [...this._connections.values()].filter((c) => c.connected);
  }

  async scanAll(): Promise<PoiDeviceInfo[]> {
    const results: PoiDeviceInfo[] = [];
    for (const adapter of this._adapters) {
      try {
        const devices = await adapter.scan();
        for (const device of devices) {
          this._deviceToAdapter.set(device.id, adapter);
          results.push(device);
        }
      } catch (err) {
        // Adapter may not be supported in this browser — skip it
        console.warn(`${adapter.protocolName} scan failed:`, err);
      }
    }
    return results;
  }

  async connect(device: PoiDeviceInfo): Promise<IPoiConnection> {
    const adapter = this._deviceToAdapter.get(device.id);
    if (!adapter) {
      throw new Error(`No adapter found for device ${device.id}. Run scanAll() first.`);
    }

    const connection = await adapter.connect(device);
    this._connections.set(device.id, connection);
    return connection;
  }

  disconnect(deviceId: string): void {
    const connection = this._connections.get(deviceId);
    if (connection) {
      connection.disconnect();
      this._connections.delete(deviceId);
    }
  }

  async uploadPattern(
    deviceId: string,
    pattern: StripPattern,
    slot: number,
    onProgress?: (pct: number) => void
  ): Promise<void> {
    const connection = this._connections.get(deviceId);
    if (!connection || !connection.connected) {
      throw new Error(`Device ${deviceId} not connected`);
    }
    await connection.uploadPattern(pattern, slot, onProgress);
  }

  async uploadToAll(
    pattern: StripPattern,
    slot: number,
    onProgress?: (pct: number) => void
  ): Promise<void> {
    const active = this.connections;
    if (active.length === 0) {
      throw new Error("No connected devices");
    }
    // Upload to all devices in parallel
    await Promise.all(
      active.map((conn) => conn.uploadPattern(pattern, slot, onProgress))
    );
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/poi/services/contracts/IPoiDeviceManager.ts src/lib/features/poi/services/implementations/PoiDeviceManager.ts
git commit -m "feat(poi): PoiDeviceManager — aggregates adapters, manages connections"
```

---

## Task 6: DI Container + Wiring

**Files:**
- Create: `src/lib/shared/di/containers/poi-container.ts`
- Modify: `src/lib/shared/di/container-types.ts`
- Modify: `src/lib/shared/di/index.ts`

- [ ] **Step 1: Create poi-container.ts**

```typescript
// src/lib/shared/di/containers/poi-container.ts

import { createContainer } from "iti";
import { ImagePatternLoader } from "$lib/features/poi/services/implementations/ImagePatternLoader";
import { StripPatternEngine } from "$lib/features/poi/services/implementations/StripPatternEngine";
import { OpenPixelPoiAdapter } from "$lib/features/poi/services/implementations/OpenPixelPoiAdapter";
import { PoiDeviceManager } from "$lib/features/poi/services/implementations/PoiDeviceManager";

/**
 * Poi (LED strip pattern engine + hardware adapters) DI container.
 * Self-contained — no external dependencies needed.
 */
export function createPoiContainer() {
  return createContainer()
    .add({
      imagePatternLoader: () => new ImagePatternLoader(),
      openPixelPoiAdapter: () => new OpenPixelPoiAdapter(),
    })
    .add(({ imagePatternLoader, openPixelPoiAdapter }) => ({
      stripPatternEngine: () => new StripPatternEngine(imagePatternLoader),
      poiDeviceManager: () => new PoiDeviceManager([openPixelPoiAdapter]),
    }));
}

export type PoiContainer = ReturnType<typeof createPoiContainer>;
```

- [ ] **Step 2: Add PoiContainer to container-types.ts**

In `src/lib/shared/di/container-types.ts`, add the import alongside the other factory container imports (around line 58, near the existing `PoiLabContainer` import):

```typescript
import type { PoiContainer } from "./containers/poi-container";
```

Add the items extraction (around line 133, near `PoiLabItems`):

```typescript
type PoiItems = ItemsOf<PoiContainer>;
```

Add `PoiItems` to the `IAppContainerItems` intersection (after `PoiLabItems &`):

```typescript
PoiItems &
```

- [ ] **Step 3: Wire into index.ts**

In `src/lib/shared/di/index.ts`, add the import (near the other factory container imports around line 60):

```typescript
import { createPoiContainer } from "./containers/poi-container";
```

Add the container creation (near the `poiLabContainer` creation around line 297):

```typescript
const poiContainer = typeof window !== 'undefined' ? createPoiContainer() : null as any;
```

Add to the `buildAppContainer()` composition chain (near `c = c.add(poiLabContainer.items);` around line 432):

```typescript
c = c.add(poiContainer.items);
```

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: Clean build with no errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/di/containers/poi-container.ts src/lib/shared/di/container-types.ts src/lib/shared/di/index.ts
git commit -m "feat(poi): wire poi container into DI composition root"
```

---

## Task 7: POV Trail Ring Buffer

**Files:**
- Create: `src/lib/shared/3d/effects/poi/PovTrailRing.ts`
- Create: `tests/unit/poi/pov-trail-ring.test.ts`

- [ ] **Step 1: Write PovTrailRing test**

```typescript
// tests/unit/poi/pov-trail-ring.test.ts

import { describe, it, expect } from "vitest";
import { PovTrailRing, type PovTrailSnapshot } from "$lib/shared/3d/effects/poi/PovTrailRing";

describe("PovTrailRing", () => {
  it("starts empty", () => {
    const ring = new PovTrailRing(200, 4);
    expect(ring.count).toBe(0);
    expect(ring.getSnapshots()).toEqual([]);
  });

  it("stores snapshots up to capacity", () => {
    const ring = new PovTrailRing(3, 4); // 3 LEDs, 4 snapshots
    ring.push(makeSnapshot(3, 1.0));
    ring.push(makeSnapshot(3, 2.0));
    ring.push(makeSnapshot(3, 3.0));
    ring.push(makeSnapshot(3, 4.0));

    expect(ring.count).toBe(4);
  });

  it("overwrites oldest when exceeding capacity", () => {
    const ring = new PovTrailRing(2, 3); // 2 LEDs, max 3 snapshots
    ring.push(makeSnapshot(2, 1.0));
    ring.push(makeSnapshot(2, 2.0));
    ring.push(makeSnapshot(2, 3.0));
    ring.push(makeSnapshot(2, 4.0)); // overwrites t=1.0

    expect(ring.count).toBe(3);
    const snaps = ring.getSnapshots();
    // Oldest surviving is t=2.0
    expect(snaps[0]!.timestamp).toBe(2.0);
    expect(snaps[2]!.timestamp).toBe(4.0);
  });

  it("clears all data", () => {
    const ring = new PovTrailRing(2, 3);
    ring.push(makeSnapshot(2, 1.0));
    ring.push(makeSnapshot(2, 2.0));
    ring.clear();
    expect(ring.count).toBe(0);
    expect(ring.getSnapshots()).toEqual([]);
  });

  it("getSnapshotsNewerThan filters by age", () => {
    const ring = new PovTrailRing(2, 10);
    ring.push(makeSnapshot(2, 1.0));
    ring.push(makeSnapshot(2, 2.0));
    ring.push(makeSnapshot(2, 3.0));
    ring.push(makeSnapshot(2, 4.0));

    const recent = ring.getSnapshotsNewerThan(2.5);
    expect(recent).toHaveLength(2);
    expect(recent[0]!.timestamp).toBe(3.0);
    expect(recent[1]!.timestamp).toBe(4.0);
  });
});

function makeSnapshot(ledCount: number, timestamp: number): PovTrailSnapshot {
  const positions = new Float32Array(ledCount * 3);
  const colors = new Uint8Array(ledCount * 3);
  // Fill positions with timestamp-based values for identification
  for (let i = 0; i < ledCount; i++) {
    positions[i * 3] = timestamp;
    colors[i * 3] = Math.round(timestamp * 10);
  }
  return { positions, colors, timestamp };
}
```

- [ ] **Step 2: Implement PovTrailRing**

```typescript
// src/lib/shared/3d/effects/poi/PovTrailRing.ts

/**
 * A single snapshot of all LED positions + colors at one moment in time.
 * Used to accumulate persistence-of-vision trail ghosts.
 */
export interface PovTrailSnapshot {
  /** Flat array of LED world positions: [x0, y0, z0, x1, y1, z1, ...] */
  positions: Float32Array;
  /** Flat array of LED colors: [r0, g0, b0, r1, g1, b1, ...] (0–255) */
  colors: Uint8Array;
  /** Time this snapshot was recorded (seconds) */
  timestamp: number;
}

/**
 * Ring buffer that stores recent LED position/color snapshots for
 * persistence-of-vision trail rendering. Each push stores the full
 * strip state (all 200 LEDs) at one frame.
 *
 * The oldest snapshot is overwritten when the buffer is full.
 */
export class PovTrailRing {
  private buffer: PovTrailSnapshot[];
  private head = 0;
  private _count = 0;
  readonly capacity: number;
  private readonly ledCount: number;

  constructor(ledCount: number, capacity: number) {
    this.ledCount = ledCount;
    this.capacity = capacity;
    this.buffer = new Array(capacity);
    // Pre-allocate all snapshot slots to avoid GC pressure
    for (let i = 0; i < capacity; i++) {
      this.buffer[i] = {
        positions: new Float32Array(ledCount * 3),
        colors: new Uint8Array(ledCount * 3),
        timestamp: 0,
      };
    }
  }

  get count(): number {
    return this._count;
  }

  /**
   * Record a new snapshot. Copies the provided data into the ring buffer.
   */
  push(snapshot: PovTrailSnapshot): void {
    const slot = this.buffer[this.head]!;
    slot.positions.set(snapshot.positions);
    slot.colors.set(snapshot.colors);
    slot.timestamp = snapshot.timestamp;
    this.head = (this.head + 1) % this.capacity;
    if (this._count < this.capacity) this._count++;
  }

  /**
   * Get all stored snapshots in chronological order (oldest first).
   */
  getSnapshots(): PovTrailSnapshot[] {
    if (this._count === 0) return [];
    const result: PovTrailSnapshot[] = [];
    const start = this._count < this.capacity ? 0 : this.head;
    for (let i = 0; i < this._count; i++) {
      const idx = (start + i) % this.capacity;
      result.push(this.buffer[idx]!);
    }
    return result;
  }

  /**
   * Get only snapshots newer than a given timestamp (oldest first).
   */
  getSnapshotsNewerThan(minTimestamp: number): PovTrailSnapshot[] {
    return this.getSnapshots().filter((s) => s.timestamp >= minTimestamp);
  }

  clear(): void {
    this.head = 0;
    this._count = 0;
  }
}
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run tests/unit/poi/pov-trail-ring.test.ts --reporter=verbose`
Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/3d/effects/poi/PovTrailRing.ts tests/unit/poi/pov-trail-ring.test.ts
git commit -m "feat(poi): PovTrailRing — ring buffer for POV trail accumulation"
```

---

## Task 8: PovStripRenderer3D

**Files:**
- Create: `src/lib/shared/3d/effects/poi/PovStripRenderer3D.ts`

This is the centerpiece. A 200-LED instanced billboard renderer that reads colors from a `StripPattern` frame (mapped from rotation angle) and accumulates trail ghosts for the persistence-of-vision effect.

- [ ] **Step 1: Create PovStripRenderer3D**

```typescript
// src/lib/shared/3d/effects/poi/PovStripRenderer3D.ts

/**
 * PovStripRenderer3D — Full-strip LED renderer with POV trail accumulation.
 *
 * Distributes N LED billboards along a staff axis. Each LED's color comes
 * from a StripPattern frame, where frame index is derived from the staff's
 * rotation angle. Trail ghosts are accumulated in a PovTrailRing to create
 * the persistence-of-vision effect — images forming in the air as the
 * avatar spins, exactly like watching a pixel poi performer in a dark room.
 *
 * Reuses the existing LedMaterial3D shader (additive blending, core + halo).
 */

import {
  Vector3,
  PlaneGeometry,
  InstancedMesh,
  InstancedBufferAttribute,
  Object3D,
  type Camera,
  type Quaternion,
} from "three";
import { createLedMaterial, type LedMaterialOptions } from "../led/LedMaterial3D";
import { QualityTier } from "../types";
import { PovTrailRing, type PovTrailSnapshot } from "./PovTrailRing";
import type { StripPattern } from "$lib/features/poi/domain/StripPattern";

/** LED counts per quality tier */
const LEDS_PER_TIER: Record<QualityTier, number> = {
  [QualityTier.HIGH]: 200,
  [QualityTier.MEDIUM]: 100,
  [QualityTier.LOW]: 50,
};

/** Persistence frame count per quality tier */
const PERSISTENCE_FRAMES: Record<QualityTier, number> = {
  [QualityTier.HIGH]: 12,
  [QualityTier.MEDIUM]: 8,
  [QualityTier.LOW]: 4,
};

/** Billboard size for each LED — smaller than 2-point LEDs since we have 200 */
const POV_LED_SIZE = 0.012;

export class PovStripRenderer3D {
  private mesh: InstancedMesh | null = null;
  private instanceColors: Float32Array;
  private instanceAlphas: Float32Array;
  private instanceStretches: Float32Array;
  private dummy = new Object3D();
  private trail: PovTrailRing;
  private qualityTier: QualityTier;
  private activeLedCount: number;
  private parent: Object3D | null = null;
  private maxInstances: number;

  /** Persistence duration in seconds (default 120ms) */
  private persistenceDuration = 0.12;

  // Reusable snapshot to avoid allocations each frame
  private currentSnapshot: PovTrailSnapshot;

  constructor(qualityTier: QualityTier = QualityTier.HIGH) {
    this.qualityTier = qualityTier;
    this.activeLedCount = LEDS_PER_TIER[qualityTier];
    const persistenceFrames = PERSISTENCE_FRAMES[qualityTier];

    // Max instances: active LEDs + (LEDs * persistence frames)
    this.maxInstances = this.activeLedCount * (1 + persistenceFrames);
    this.trail = new PovTrailRing(this.activeLedCount, persistenceFrames);

    this.instanceColors = new Float32Array(this.maxInstances * 3);
    this.instanceAlphas = new Float32Array(this.maxInstances);
    this.instanceStretches = new Float32Array(this.maxInstances * 2);

    this.currentSnapshot = {
      positions: new Float32Array(this.activeLedCount * 3),
      colors: new Uint8Array(this.activeLedCount * 3),
      timestamp: 0,
    };
  }

  initialize(parent: Object3D, materialOptions?: LedMaterialOptions): void {
    if (this.mesh) return;
    this.parent = parent;

    const geometry = new PlaneGeometry(POV_LED_SIZE, POV_LED_SIZE);
    const material = createLedMaterial({
      glowRadius: 0.8,
      brightness: 1.0,
      emissiveStrength: 2.5,
      ...materialOptions,
    });

    this.mesh = new InstancedMesh(geometry, material, this.maxInstances);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 100;

    // Instanced attributes
    const colorAttr = new InstancedBufferAttribute(this.instanceColors, 3);
    colorAttr.setUsage(35048); // DynamicDrawUsage
    geometry.setAttribute("instanceColor", colorAttr);

    const alphaAttr = new InstancedBufferAttribute(this.instanceAlphas, 1);
    alphaAttr.setUsage(35048);
    geometry.setAttribute("instanceAlpha", alphaAttr);

    const stretchAttr = new InstancedBufferAttribute(this.instanceStretches, 2);
    stretchAttr.setUsage(35048);
    geometry.setAttribute("instanceStretch", stretchAttr);

    this.mesh.count = 0;
    parent.add(this.mesh);
  }

  /**
   * Update all LED instances for the current frame.
   *
   * @param staffAxis - Normalized direction vector along the staff
   * @param staffCenter - World-space center of the staff
   * @param staffHalfLength - Half the staff length in world units
   * @param rotationAngle - Current rotation angle in radians (0–2PI)
   * @param pattern - Active strip pattern
   * @param camera - Current camera (for billboard orientation)
   * @param currentTime - Current time in seconds
   * @param brightness - Global brightness multiplier (0–1)
   */
  update(
    staffAxis: Vector3,
    staffCenter: Vector3,
    staffHalfLength: number,
    rotationAngle: number,
    pattern: StripPattern,
    camera: Camera,
    currentTime: number,
    brightness: number
  ): void {
    if (!this.mesh) return;

    const cameraQuat = camera.quaternion;

    // Map rotation angle to frame index
    const normalizedAngle = ((rotationAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const frameIndex = Math.floor((normalizedAngle / (Math.PI * 2)) * pattern.frameCount) % pattern.frameCount;
    const frame = pattern.frames[frameIndex]!;

    // Sample stride: if pattern has more LEDs than our quality tier renders
    const sampleStride = pattern.ledCount / this.activeLedCount;

    let instanceIndex = 0;

    // Compute LED positions along staff axis and record snapshot
    for (let i = 0; i < this.activeLedCount && instanceIndex < this.maxInstances; i++) {
      // Position: distribute uniformly along staff
      const t = this.activeLedCount > 1 ? (i / (this.activeLedCount - 1)) * 2 - 1 : 0;
      const px = staffCenter.x + staffAxis.x * staffHalfLength * t;
      const py = staffCenter.y + staffAxis.y * staffHalfLength * t;
      const pz = staffCenter.z + staffAxis.z * staffHalfLength * t;

      // Sample color from pattern (nearest-neighbor from full-res data)
      const srcLed = Math.min(Math.floor(i * sampleStride), pattern.ledCount - 1);
      const srcOffset = srcLed * 3;
      const r = frame.colors[srcOffset]! / 255;
      const g = frame.colors[srcOffset + 1]! / 255;
      const b = frame.colors[srcOffset + 2]! / 255;

      // Record in snapshot
      const snapIdx = i * 3;
      this.currentSnapshot.positions[snapIdx] = px;
      this.currentSnapshot.positions[snapIdx + 1] = py;
      this.currentSnapshot.positions[snapIdx + 2] = pz;
      this.currentSnapshot.colors[snapIdx] = frame.colors[srcOffset]!;
      this.currentSnapshot.colors[snapIdx + 1] = frame.colors[srcOffset + 1]!;
      this.currentSnapshot.colors[snapIdx + 2] = frame.colors[srcOffset + 2]!;

      // Active LED instance
      this.setInstance(
        instanceIndex, px, py, pz, cameraQuat,
        r * brightness, g * brightness, b * brightness,
        brightness, 1.0, 0
      );
      instanceIndex++;
    }

    // Push snapshot to trail ring
    this.currentSnapshot.timestamp = currentTime;
    this.trail.push(this.currentSnapshot);

    // Render trail ghosts from ring buffer
    const cutoff = currentTime - this.persistenceDuration;
    const snapshots = this.trail.getSnapshotsNewerThan(cutoff);

    for (let s = 0; s < snapshots.length - 1 && instanceIndex < this.maxInstances; s++) {
      // Skip the most recent snapshot — it's the current frame
      const snap = snapshots[s]!;
      const age = currentTime - snap.timestamp;
      const alpha = (1.0 - age / this.persistenceDuration) * 0.7 * brightness;

      if (alpha < 0.01) continue;

      for (let i = 0; i < this.activeLedCount && instanceIndex < this.maxInstances; i++) {
        const posIdx = i * 3;
        const colIdx = i * 3;
        const r = snap.colors[colIdx]! / 255;
        const g = snap.colors[colIdx + 1]! / 255;
        const b = snap.colors[colIdx + 2]! / 255;

        // Skip black LEDs in trails (no point rendering invisible ghosts)
        if (r < 0.01 && g < 0.01 && b < 0.01) continue;

        this.setInstance(
          instanceIndex,
          snap.positions[posIdx]!,
          snap.positions[posIdx + 1]!,
          snap.positions[posIdx + 2]!,
          cameraQuat,
          r * alpha, g * alpha, b * alpha,
          alpha, 1.0, 0
        );
        instanceIndex++;
      }
    }

    this.mesh.count = instanceIndex;

    // Flag attributes for GPU upload
    const geo = this.mesh.geometry;
    (geo.getAttribute("instanceColor") as InstancedBufferAttribute).needsUpdate = true;
    (geo.getAttribute("instanceAlpha") as InstancedBufferAttribute).needsUpdate = true;
    (geo.getAttribute("instanceStretch") as InstancedBufferAttribute).needsUpdate = true;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  private setInstance(
    index: number,
    x: number, y: number, z: number,
    cameraQuat: Quaternion,
    r: number, g: number, b: number,
    alpha: number,
    stretchFactor: number,
    stretchAngle: number
  ): void {
    this.dummy.position.set(x, y, z);
    this.dummy.quaternion.copy(cameraQuat);
    this.dummy.updateMatrix();
    this.mesh!.setMatrixAt(index, this.dummy.matrix);

    const ci = index * 3;
    this.instanceColors[ci] = r;
    this.instanceColors[ci + 1] = g;
    this.instanceColors[ci + 2] = b;

    this.instanceAlphas[index] = alpha;

    const si = index * 2;
    this.instanceStretches[si] = stretchFactor;
    this.instanceStretches[si + 1] = stretchAngle;
  }

  setPersistenceDuration(seconds: number): void {
    this.persistenceDuration = Math.max(0.05, Math.min(0.5, seconds));
  }

  setQualityTier(tier: QualityTier): void {
    if (tier === this.qualityTier) return;
    // Quality tier change requires full re-initialization
    this.dispose();
    this.qualityTier = tier;
    this.activeLedCount = LEDS_PER_TIER[tier];
    const persistenceFrames = PERSISTENCE_FRAMES[tier];
    this.maxInstances = this.activeLedCount * (1 + persistenceFrames);
    this.trail = new PovTrailRing(this.activeLedCount, persistenceFrames);
    this.instanceColors = new Float32Array(this.maxInstances * 3);
    this.instanceAlphas = new Float32Array(this.maxInstances);
    this.instanceStretches = new Float32Array(this.maxInstances * 2);
    this.currentSnapshot = {
      positions: new Float32Array(this.activeLedCount * 3),
      colors: new Uint8Array(this.activeLedCount * 3),
      timestamp: 0,
    };
    // Caller must re-initialize after tier change
  }

  reset(): void {
    this.trail.clear();
    if (this.mesh) {
      this.mesh.count = 0;
    }
  }

  dispose(): void {
    if (this.mesh) {
      this.parent?.remove(this.mesh);
      this.mesh.geometry.dispose();
      if (Array.isArray(this.mesh.material)) {
        this.mesh.material.forEach((m) => m.dispose());
      } else {
        this.mesh.material.dispose();
      }
      this.mesh = null;
    }
    this.trail.clear();
    this.parent = null;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/shared/3d/effects/poi/PovStripRenderer3D.ts
git commit -m "feat(poi): PovStripRenderer3D — 200-LED instanced renderer with POV trails"
```

---

## Task 9: Integrate POV Renderer into EffectOrchestrator3D

**Files:**
- Modify: `src/lib/shared/3d/effects/EffectOrchestrator3D.svelte`

The existing orchestrator routes `"led"` effect type to `LedRenderer3D` (2-point mode). When a `StripPattern` is active, it should route to `PovStripRenderer3D` instead. The pattern is provided via the poi state context.

- [ ] **Step 1: Add PovStripRenderer3D imports and state**

At the top of the `<script>` block (after the existing imports around line 28), add:

```typescript
import { PovStripRenderer3D } from "./poi/PovStripRenderer3D";
import type { StripPattern } from "$lib/features/poi/domain/StripPattern";
```

After the existing renderer variables (around line 98, after `let fireRenderer`), add:

```typescript
// POV strip renderers — used when a StripPattern is active
let bluePovRenderer: PovStripRenderer3D | null = null;
let redPovRenderer: PovStripRenderer3D | null = null;

// Reusable vectors for staff axis computation
const _staffAxis = new Vector3();
const _staffCenter = new Vector3();
```

Add a new prop to the `Props` interface:

```typescript
/** Active strip pattern for POV LED rendering. When set, LED effect uses PovStripRenderer3D instead of LedRenderer3D. */
activeStripPattern?: StripPattern | null;
/** POV persistence duration in seconds */
povPersistenceDuration?: number;
```

Destructure the new props:

```typescript
activeStripPattern = null,
povPersistenceDuration = 0.12,
```

- [ ] **Step 2: Route LED effect to POV renderer when strip pattern is active**

Inside the `useTask()` callback, replace the LED rendering section (around lines 296–320, the "LED rendering — direct imperative update" block) with routing logic that checks for an active strip pattern:

```typescript
    // LED rendering — route to POV strip renderer or legacy 2-point renderer
    if (imperativeParent) {
      const now = performance.now() / 1000;
      const hasPovPattern = activeStripPattern != null;

      if (hasPovPattern) {
        // POV Strip Mode: full 200-LED strip with persistence-of-vision trails

        // Initialize POV renderers lazily
        if (!bluePovRenderer) {
          bluePovRenderer = new PovStripRenderer3D(qualityTierDetector.currentTier);
          bluePovRenderer.initialize(imperativeParent);
        }
        if (!redPovRenderer) {
          redPovRenderer = new PovStripRenderer3D(qualityTierDetector.currentTier);
          redPovRenderer.initialize(imperativeParent);
        }
        bluePovRenderer.setPersistenceDuration(povPersistenceDuration);
        redPovRenderer.setPersistenceDuration(povPersistenceDuration);

        // Compute staff axis + rotation angle for blue prop
        if (blueLedTips.length > 0 && visualBlueProp) {
          const rotation = new Quaternion(
            visualBlueProp.worldRotation.x, visualBlueProp.worldRotation.y,
            visualBlueProp.worldRotation.z, visualBlueProp.worldRotation.w,
          );
          const horizontalQuat = new Quaternion().setFromEuler(new Euler(0, 0, Math.PI / 2));
          const finalQuat = rotation.clone().multiply(horizontalQuat);
          _staffAxis.set(0, 1, 0).applyQuaternion(finalQuat).normalize();

          const blueCenter = blueRigCenter!;
          _staffCenter.set(blueCenter.x, blueCenter.y, blueCenter.z);

          // Rotation angle: extract from the quaternion's Z-axis rotation
          const euler = new Euler().setFromQuaternion(rotation, "ZYX");
          const rotAngle = euler.z;

          bluePovRenderer.update(
            _staffAxis, _staffCenter, staffHalfLength,
            rotAngle, activeStripPattern!, cam!, now, 1.0,
          );
        } else {
          bluePovRenderer.reset();
        }

        // Compute staff axis + rotation angle for red prop
        if (redLedTips.length > 0 && visualRedProp) {
          const rotation = new Quaternion(
            visualRedProp.worldRotation.x, visualRedProp.worldRotation.y,
            visualRedProp.worldRotation.z, visualRedProp.worldRotation.w,
          );
          const horizontalQuat = new Quaternion().setFromEuler(new Euler(0, 0, Math.PI / 2));
          const finalQuat = rotation.clone().multiply(horizontalQuat);
          _staffAxis.set(0, 1, 0).applyQuaternion(finalQuat).normalize();

          const redCenter = redRigCenter!;
          _staffCenter.set(redCenter.x, redCenter.y, redCenter.z);

          const euler = new Euler().setFromQuaternion(rotation, "ZYX");
          const rotAngle = euler.z;

          redPovRenderer.update(
            _staffAxis, _staffCenter, staffHalfLength,
            rotAngle, activeStripPattern!, cam!, now, 1.0,
          );
        } else {
          redPovRenderer.reset();
        }

        // Suppress legacy LED renderers while POV is active
        blueLedRenderer?.reset();
        redLedRenderer?.reset();
      } else {
        // Legacy 2-point LED mode (unchanged)
        if (!blueLedRenderer) {
          blueLedRenderer = new LedRenderer3D(qualityTierDetector.currentTier);
          blueLedRenderer.initialize(imperativeParent);
        }
        if (!redLedRenderer) {
          redLedRenderer = new LedRenderer3D(qualityTierDetector.currentTier);
          redLedRenderer.initialize(imperativeParent);
        }

        if (blueLedTips.length > 0) {
          blueLedRenderer.update(blueLedTips, cam!, now);
        } else {
          blueLedRenderer.reset();
        }

        if (redLedTips.length > 0) {
          redLedRenderer.update(redLedTips, cam!, now);
        } else {
          redLedRenderer.reset();
        }

        // Suppress POV renderers while legacy mode is active
        bluePovRenderer?.reset();
        redPovRenderer?.reset();
      }
```

**Note:** This also requires adding `Euler` to the Three.js imports at the top:

```typescript
import { Vector3, Color, Object3D, Quaternion, Euler } from "three";
```

- [ ] **Step 3: Add cleanup for POV renderers in onDestroy**

In the existing `onDestroy` callback (at the end of the script), add:

```typescript
bluePovRenderer?.dispose();
redPovRenderer?.dispose();
```

- [ ] **Step 4: Add reset for POV renderers in the !isPlaying early return**

In the `useTask` callback where `!isPlaying` triggers reset (around line 146), add:

```typescript
bluePovRenderer?.reset();
redPovRenderer?.reset();
```

- [ ] **Step 5: Verify build**

Run: `npm run build`
Expected: Clean build.

- [ ] **Step 6: Commit**

```bash
git add src/lib/shared/3d/effects/EffectOrchestrator3D.svelte
git commit -m "feat(poi): route LED effect to PovStripRenderer3D when strip pattern active"
```

---

## Task 10: Poi State Factory + Context

**Files:**
- Create: `src/lib/features/poi/state/poi-state.svelte.ts`
- Create: `src/lib/features/poi/context/poi-context.ts`

- [ ] **Step 1: Create poi-state.svelte.ts**

```typescript
// src/lib/features/poi/state/poi-state.svelte.ts

import type { IStripPatternEngine } from "../services/contracts/IStripPatternEngine";
import type { IPoiDeviceManager } from "../services/contracts/IPoiDeviceManager";
import type { StripPattern, PatternParams, RGBColor } from "../domain/StripPattern";
import type { PoiDeviceInfo } from "../domain/DeviceTypes";
import type { IPatternPreset } from "../domain/PatternPreset";

export function createPoiState(
  patternEngine: IStripPatternEngine,
  deviceManager: IPoiDeviceManager
) {
  // Pattern state
  let activePattern = $state<StripPattern | null>(null);
  let activePresetId = $state<string>("solid");
  let ledCount = $state(200); // iPixel 200 HD default
  let frameCount = $state(180); // 180 columns = good POV resolution

  // Device state
  let connectedDevices = $state<PoiDeviceInfo[]>([]);
  let uploadProgress = $state<number | null>(null);

  // 3D rendering state
  let persistenceDuration = $state(0.12); // 120ms default

  // Default generation params
  let patternParams = $state<PatternParams>({
    primaryColor: { r: 0, g: 255, b: 136 }, // Green
    secondaryColor: { r: 59, g: 130, b: 246 }, // Blue
    speed: 1.0,
    brightness: 1.0,
  });

  function generateFromPreset(): void {
    try {
      activePattern = patternEngine.generate(
        activePresetId, ledCount, frameCount, patternParams
      );
    } catch (err) {
      console.error("Pattern generation failed:", err);
    }
  }

  function loadFromImage(imageData: ImageData): void {
    activePattern = patternEngine.fromImage(imageData, ledCount);
  }

  async function loadFromFile(file: File): Promise<void> {
    const loader = patternEngine as any; // Access underlying imageLoader
    // Use the engine's fromImage which delegates to imageLoader
    const bitmap = await createImageBitmap(file);
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(bitmap, 0, 0);
    const imgData = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
    bitmap.close();
    activePattern = patternEngine.fromImage(imgData, ledCount);
    if (activePattern) {
      activePattern.metadata.sourceImagePath = file.name;
      activePattern.metadata.name = file.name.replace(/\.[^.]+$/, "");
    }
  }

  function toImageData(): ImageData | null {
    if (!activePattern) return null;
    return patternEngine.toImageData(activePattern);
  }

  async function scanDevices(): Promise<void> {
    const devices = await deviceManager.scanAll();
    connectedDevices = devices;
  }

  async function connectDevice(device: PoiDeviceInfo): Promise<void> {
    await deviceManager.connect(device);
    // Refresh device list
    connectedDevices = deviceManager.connections.map((c) => c.deviceInfo);
  }

  async function uploadToDevice(deviceId: string, slot: number = 0): Promise<void> {
    if (!activePattern) return;
    uploadProgress = 0;
    try {
      await deviceManager.uploadPattern(deviceId, activePattern, slot, (pct) => {
        uploadProgress = pct;
      });
    } finally {
      uploadProgress = null;
    }
  }

  async function uploadToAll(slot: number = 0): Promise<void> {
    if (!activePattern) return;
    uploadProgress = 0;
    try {
      await deviceManager.uploadToAll(activePattern, slot, (pct) => {
        uploadProgress = pct;
      });
    } finally {
      uploadProgress = null;
    }
  }

  return {
    // Getters
    get activePattern() { return activePattern; },
    get activePresetId() { return activePresetId; },
    get ledCount() { return ledCount; },
    get frameCount() { return frameCount; },
    get connectedDevices() { return connectedDevices; },
    get uploadProgress() { return uploadProgress; },
    get persistenceDuration() { return persistenceDuration; },
    get patternParams() { return patternParams; },
    get presets(): IPatternPreset[] { return patternEngine.getPresets(); },

    // Setters
    setActivePresetId(id: string) { activePresetId = id; },
    setLedCount(n: number) { ledCount = n; },
    setFrameCount(n: number) { frameCount = n; },
    setPersistenceDuration(s: number) { persistenceDuration = Math.max(0.05, Math.min(0.5, s)); },
    setPatternParams(p: PatternParams) { patternParams = p; },
    setPrimaryColor(c: RGBColor) { patternParams = { ...patternParams, primaryColor: c }; },
    setSecondaryColor(c: RGBColor) { patternParams = { ...patternParams, secondaryColor: c }; },

    // Actions
    generateFromPreset,
    loadFromImage,
    loadFromFile,
    toImageData,
    scanDevices,
    connectDevice,
    uploadToDevice,
    uploadToAll,
  };
}

export type PoiState = ReturnType<typeof createPoiState>;
```

- [ ] **Step 2: Create poi-context.ts**

```typescript
// src/lib/features/poi/context/poi-context.ts

import { getContext, setContext } from "svelte";
import type { PoiState } from "../state/poi-state.svelte";

const KEY = Symbol("poi");

export function setPoiContext(state: PoiState): void {
  setContext(KEY, state);
}

export function getPoiContext(): PoiState {
  return getContext<PoiState>(KEY);
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/poi/state/poi-state.svelte.ts src/lib/features/poi/context/poi-context.ts
git commit -m "feat(poi): state factory + context — reactive poi state management"
```

---

## Task 11: UI Components — Pattern Picker + POV Preview

**Files:**
- Create: `src/lib/features/poi/components/PatternPicker.svelte`
- Create: `src/lib/features/poi/components/PovPreview.svelte`
- Create: `src/lib/features/poi/components/StripPatternExporter.svelte`

- [ ] **Step 1: Create PatternPicker.svelte**

```svelte
<!-- src/lib/features/poi/components/PatternPicker.svelte -->
<script lang="ts">
  import { getPoiContext } from "../context/poi-context";

  const state = getPoiContext();

  let dragOver = $state(false);

  function handlePresetSelect(presetId: string): void {
    state.setActivePresetId(presetId);
    state.generateFromPreset();
  }

  async function handleFileDrop(e: DragEvent): Promise<void> {
    e.preventDefault();
    dragOver = false;
    const file = e.dataTransfer?.files[0];
    if (file && file.type.startsWith("image/")) {
      await state.loadFromFile(file);
    }
  }

  async function handleFileInput(e: Event): Promise<void> {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      await state.loadFromFile(file);
      input.value = ""; // Reset for re-upload of same file
    }
  }
</script>

<div class="pattern-picker">
  <h3 class="section-title">Pattern</h3>

  <!-- Preset Grid -->
  <div class="preset-grid">
    {#each state.presets as preset}
      <button
        class="preset-card"
        class:active={state.activePresetId === preset.id}
        onclick={() => handlePresetSelect(preset.id)}
      >
        <div
          class="preset-preview"
          style:background={preset.previewColor === "rainbow"
            ? "linear-gradient(90deg, red, orange, yellow, green, blue, violet)"
            : preset.previewColor}
        ></div>
        <span class="preset-name">{preset.name}</span>
      </button>
    {/each}
  </div>

  <!-- Image Upload -->
  <div
    class="upload-zone"
    class:drag-over={dragOver}
    role="button"
    tabindex="0"
    ondragover={(e) => { e.preventDefault(); dragOver = true; }}
    ondragleave={() => { dragOver = false; }}
    ondrop={handleFileDrop}
  >
    <label class="upload-label">
      <i class="fas fa-image" aria-hidden="true"></i>
      <span>Drop image or click to upload</span>
      <input
        type="file"
        accept="image/png,image/bmp,image/jpeg"
        class="sr-only"
        onchange={handleFileInput}
      />
    </label>
  </div>
</div>

<style>
  .pattern-picker {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .section-title {
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    color: var(--theme-text-primary, #e2e8f0);
    margin: 0;
  }

  .preset-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
    gap: 0.5rem;
  }

  .preset-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    padding: 0.5rem;
    border: 1px solid var(--theme-stroke, rgba(255 255 255 / 0.1));
    border-radius: 8px;
    background: var(--theme-card-bg, rgba(255 255 255 / 0.05));
    cursor: pointer;
    transition: border-color 0.15s;
    min-height: 44px;
  }

  .preset-card:hover {
    border-color: var(--theme-accent, #3b82f6);
  }

  .preset-card.active {
    border-color: var(--theme-accent, #3b82f6);
    background: color-mix(in srgb, var(--theme-accent, #3b82f6) 15%, transparent);
  }

  .preset-preview {
    width: 32px;
    height: 32px;
    border-radius: 50%;
  }

  .preset-name {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-secondary, #94a3b8);
  }

  .upload-zone {
    border: 2px dashed var(--theme-stroke, rgba(255 255 255 / 0.15));
    border-radius: 8px;
    padding: 1rem;
    text-align: center;
    transition: border-color 0.15s, background 0.15s;
    cursor: pointer;
  }

  .upload-zone:hover,
  .upload-zone.drag-over {
    border-color: var(--theme-accent, #3b82f6);
    background: color-mix(in srgb, var(--theme-accent, #3b82f6) 8%, transparent);
  }

  .upload-label {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    color: var(--theme-text-secondary, #94a3b8);
    font-size: var(--font-size-compact, 12px);
    cursor: pointer;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    border: 0;
  }
</style>
```

- [ ] **Step 2: Create PovPreview.svelte**

```svelte
<!-- src/lib/features/poi/components/PovPreview.svelte -->
<script lang="ts">
  import { getPoiContext } from "../context/poi-context";

  const state = getPoiContext();

  let canvasRef = $state<HTMLCanvasElement | null>(null);

  $effect(() => {
    const pattern = state.activePattern;
    const canvas = canvasRef;
    if (!canvas || !pattern) return;

    const imageData = state.toImageData();
    if (!imageData) return;

    canvas.width = imageData.width;
    canvas.height = imageData.height;
    const ctx = canvas.getContext("2d")!;
    ctx.putImageData(imageData, 0, 0);
  });
</script>

<div class="pov-preview">
  <h3 class="section-title">POV Preview</h3>
  {#if state.activePattern}
    <div class="preview-frame">
      <canvas
        bind:this={canvasRef}
        class="preview-canvas"
      ></canvas>
      <div class="preview-info">
        {state.activePattern.ledCount} LEDs x {state.activePattern.frameCount} frames
      </div>
    </div>
  {:else}
    <div class="empty-state">No pattern loaded</div>
  {/if}
</div>

<style>
  .pov-preview {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .section-title {
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    color: var(--theme-text-primary, #e2e8f0);
    margin: 0;
  }

  .preview-frame {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    padding: 0.5rem;
    background: #000;
    border-radius: 8px;
    border: 1px solid var(--theme-stroke, rgba(255 255 255 / 0.1));
  }

  .preview-canvas {
    width: 100%;
    max-height: 200px;
    object-fit: contain;
    image-rendering: pixelated;
  }

  .preview-info {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-secondary, #94a3b8);
  }

  .empty-state {
    padding: 2rem;
    text-align: center;
    color: var(--theme-text-secondary, #94a3b8);
    font-size: var(--font-size-compact, 12px);
  }
</style>
```

- [ ] **Step 3: Create StripPatternExporter.svelte**

```svelte
<!-- src/lib/features/poi/components/StripPatternExporter.svelte -->
<script lang="ts">
  import { getPoiContext } from "../context/poi-context";

  const state = getPoiContext();

  function downloadPng(): void {
    const imageData = state.toImageData();
    if (!imageData) return;

    const canvas = new OffscreenCanvas(imageData.width, imageData.height);
    const ctx = canvas.getContext("2d")!;
    ctx.putImageData(imageData, 0, 0);

    canvas.convertToBlob({ type: "image/png" }).then((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${state.activePattern?.metadata.name ?? "pattern"}.png`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }
</script>

{#if state.activePattern}
  <button class="export-btn" onclick={downloadPng}>
    <i class="fas fa-download" aria-hidden="true"></i>
    Export PNG
  </button>
{/if}

<style>
  .export-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    border: 1px solid var(--theme-stroke, rgba(255 255 255 / 0.15));
    border-radius: 8px;
    background: var(--theme-card-bg, rgba(255 255 255 / 0.05));
    color: var(--theme-text-primary, #e2e8f0);
    font-size: var(--font-size-min, 14px);
    cursor: pointer;
    min-height: 44px;
    transition: border-color 0.15s;
  }

  .export-btn:hover {
    border-color: var(--theme-accent, #3b82f6);
  }
</style>
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/poi/components/PatternPicker.svelte src/lib/features/poi/components/PovPreview.svelte src/lib/features/poi/components/StripPatternExporter.svelte
git commit -m "feat(poi): UI components — PatternPicker, PovPreview, StripPatternExporter"
```

---

## Task 12: Device Panel UI

**Files:**
- Create: `src/lib/features/poi/components/DevicePanel.svelte`

- [ ] **Step 1: Create DevicePanel.svelte**

```svelte
<!-- src/lib/features/poi/components/DevicePanel.svelte -->
<script lang="ts">
  import { getPoiContext } from "../context/poi-context";

  const state = getPoiContext();

  let scanning = $state(false);
  let error = $state<string | null>(null);

  async function handleScan(): Promise<void> {
    scanning = true;
    error = null;
    try {
      await state.scanDevices();
    } catch (err) {
      error = err instanceof Error ? err.message : "Scan failed";
    } finally {
      scanning = false;
    }
  }

  async function handleConnect(device: { id: string; name: string; model: string; connectionType: "ble" | "usb-serial"; ledCount: number; ledType: "ws2812b" | "sk9822" }): Promise<void> {
    error = null;
    try {
      await state.connectDevice(device);
    } catch (err) {
      error = err instanceof Error ? err.message : "Connection failed";
    }
  }

  async function handleUpload(deviceId: string): Promise<void> {
    error = null;
    try {
      await state.uploadToDevice(deviceId);
    } catch (err) {
      error = err instanceof Error ? err.message : "Upload failed";
    }
  }

  async function handleUploadAll(): Promise<void> {
    error = null;
    try {
      await state.uploadToAll();
    } catch (err) {
      error = err instanceof Error ? err.message : "Upload failed";
    }
  }
</script>

<div class="device-panel">
  <div class="panel-header">
    <h3 class="section-title">Devices</h3>
    <button
      class="scan-btn"
      onclick={handleScan}
      disabled={scanning}
    >
      {scanning ? "Scanning..." : "Scan"}
    </button>
  </div>

  {#if error}
    <div class="error-msg">{error}</div>
  {/if}

  {#if state.connectedDevices.length === 0}
    <div class="empty-state">
      No devices found. Click Scan to search for BLE poi.
    </div>
  {:else}
    <div class="device-list">
      {#each state.connectedDevices as device}
        <div class="device-card">
          <div class="device-info">
            <span class="device-name">{device.name}</span>
            <span class="device-meta">{device.model} ({device.ledCount} LEDs)</span>
          </div>
          <div class="device-actions">
            <button
              class="action-btn"
              onclick={() => handleUpload(device.id)}
              disabled={!state.activePattern || state.uploadProgress !== null}
            >
              {state.uploadProgress !== null ? `${Math.round(state.uploadProgress)}%` : "Upload"}
            </button>
          </div>
        </div>
      {/each}
    </div>

    {#if state.connectedDevices.length > 1 && state.activePattern}
      <button
        class="upload-all-btn"
        onclick={handleUploadAll}
        disabled={state.uploadProgress !== null}
      >
        Upload to All
      </button>
    {/if}
  {/if}

  {#if state.uploadProgress !== null}
    <div class="progress-bar">
      <div class="progress-fill" style:width="{state.uploadProgress}%"></div>
    </div>
  {/if}
</div>

<style>
  .device-panel {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .section-title {
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    color: var(--theme-text-primary, #e2e8f0);
    margin: 0;
  }

  .scan-btn,
  .action-btn,
  .upload-all-btn {
    padding: 0.375rem 0.75rem;
    border: 1px solid var(--theme-stroke, rgba(255 255 255 / 0.15));
    border-radius: 6px;
    background: var(--theme-card-bg, rgba(255 255 255 / 0.05));
    color: var(--theme-text-primary, #e2e8f0);
    font-size: var(--font-size-compact, 12px);
    cursor: pointer;
    min-height: 36px;
    transition: border-color 0.15s;
  }

  .scan-btn:hover:not(:disabled),
  .action-btn:hover:not(:disabled),
  .upload-all-btn:hover:not(:disabled) {
    border-color: var(--theme-accent, #3b82f6);
  }

  .scan-btn:disabled,
  .action-btn:disabled,
  .upload-all-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .error-msg {
    padding: 0.5rem;
    border-radius: 6px;
    background: rgba(239 68 68 / 0.15);
    color: #fca5a5;
    font-size: var(--font-size-compact, 12px);
  }

  .empty-state {
    padding: 1.5rem;
    text-align: center;
    color: var(--theme-text-secondary, #94a3b8);
    font-size: var(--font-size-compact, 12px);
  }

  .device-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .device-card {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--theme-stroke, rgba(255 255 255 / 0.1));
    border-radius: 8px;
    background: var(--theme-card-bg, rgba(255 255 255 / 0.05));
  }

  .device-info {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .device-name {
    font-size: var(--font-size-min, 14px);
    color: var(--theme-text-primary, #e2e8f0);
    font-weight: 500;
  }

  .device-meta {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-secondary, #94a3b8);
  }

  .upload-all-btn {
    width: 100%;
  }

  .progress-bar {
    height: 4px;
    border-radius: 2px;
    background: rgba(255 255 255 / 0.1);
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: var(--theme-accent, #3b82f6);
    transition: width 0.2s;
  }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/features/poi/components/DevicePanel.svelte
git commit -m "feat(poi): DevicePanel UI — scan, connect, upload with progress"
```

---

## Task 13: Run All Tests + Build Verification

- [ ] **Step 1: Run all poi tests**

Run: `npx vitest run tests/unit/poi/ --reporter=verbose`
Expected: All tests pass.

- [ ] **Step 2: Run full test suite to check for regressions**

Run: `npm run test:ci`
Expected: All tests pass.

- [ ] **Step 3: Verify clean build**

Run: `npm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 4: Run TypeScript check**

Run: `npm run check`
Expected: No type errors.

---

## Task 14: Clean Up Temporary Recon Files

**Files:**
- Delete: `static/ble-explorer.html`
- Delete: `scripts/probe-poi.ps1`

- [ ] **Step 1: Remove temporary files from the recon session**

```bash
git rm static/ble-explorer.html scripts/probe-poi.ps1
```

- [ ] **Step 2: Commit**

```bash
git commit -m "chore: remove temporary poi hardware recon files"
```
