---
status: backlog
value: 4
effort: L
remaining: "USB serial Ignis upload, hardware integration"
depends_on: Physical LED poi hardware
plan_path: plans/backlog/2026-04-10-led-strip-pattern-engine.md
tags: []
last_triaged: 2026-04-26
---
# LED Strip Pattern Engine + POV Hardware Integration

**Date:** 2026-04-08
**Status:** Approved
**Scope:** Full-strip LED pattern engine, 3D POV renderer, 2D strip visualization, device management UI, hardware upload pipeline

---

## Problem

TKA's LED effect system renders 2 colored points per staff (thumb tip + pinky tip). Real pixel poi like the iPixel 200 HD have 200 individually addressable LEDs along their length, creating persistence-of-vision (POV) images as they spin. There is no way to design, preview, or upload POV patterns from TKA. Users must use the poorly-designed Ignis Pixel Utility for image uploads, and there is no connection between TKA's choreography data and the visual patterns displayed on physical hardware.

## Goals

1. Build a pattern engine that produces full-strip LED color data (200 LEDs × N frames)
2. Render POV patterns on 3D staves with persistence-of-vision trail accumulation — images form in the air as the avatar spins, matching real-world physics
3. Render strip patterns on 2D pictograph staves as segmented color bars
4. Support custom image upload (PNG/BMP → strip pattern) for Pyroterra-style workflows
5. Upload patterns to physical poi hardware (Open-Pixel-Poi via BLE, Ignis Pixel via USB serial)
6. Replace the Ignis Pixel Utility entirely with TKA's own device management UI

## Non-Goals

- Real-time BLE streaming of colors during playback (latency makes this impractical)
- Poi-to-poi wireless sync (hardware radio protocol, outside TKA's scope)
- DMX integration
- Supporting poi with non-addressable LEDs

---

## Architecture

### Core Data Model

```typescript
// A single frame: one color per LED
interface StripFrame {
  colors: Uint8Array; // RGB interleaved: [R0, G0, B0, R1, G1, B1, ...], length = ledCount * 3
}

// A complete pattern: array of frames forming the POV image
interface StripPattern {
  ledCount: number;     // Height of the POV image (e.g., 200 for iPixel 200 HD)
  frameCount: number;   // Width of the POV image (number of columns)
  frames: StripFrame[]; // frameCount entries
  metadata: PatternMetadata;
}

interface PatternMetadata {
  name: string;
  source: "algorithmic" | "image-upload";
  presetId?: string;
  sourceImagePath?: string;
  createdAt: number;
}
```

`StripPattern` is the universal currency. Every renderer, exporter, and uploader consumes it. Every pattern source produces it.

### Pattern Sources

**1. Algorithmic Pattern Presets**

Each preset is a pure function: `(frameIndex, ledIndex, context?) → RGB`.

```typescript
interface IPatternPreset {
  id: string;
  name: string;
  category: "basic" | "motion-driven";
  previewColor: string; // For UI thumbnails
  generate(ledCount: number, frameCount: number, params: PatternParams): StripPattern;
}

interface PatternParams {
  primaryColor: RGBColor;
  secondaryColor?: RGBColor;
  speed: number;        // 0.1–5.0, pattern animation speed multiplier
  brightness: number;   // 0–1
  // Motion data (optional, for motion-driven presets)
  motionData?: BeatMotionData[];
}
```

**Initial presets (Phase 1):**
- `solid` — Single color, full strip
- `gradient` — Linear gradient between primary and secondary color along strip length
- `rainbow-sweep` — HSL hue cycles along strip, advances per frame
- `pulse` — Brightness pulse wave traveling along strip
- `prop-colors` — Blue/red matched to TKA prop assignment

**Motion-driven presets (Phase 4, deferred):**
- Composite mapping slots: position → hue, motion type → pattern shape, orientation → modulation
- Only implemented when specific mappings prove visually interesting

**2. Image Upload**

User provides a raster image (PNG, BMP, JPG). The engine maps it to a `StripPattern`:

- Image height → `ledCount` (resized to match target hardware if needed)
- Image width → `frameCount` (each column = one animation frame)
- Pixel RGB values map directly to LED colors
- Minimum width: 2 (single-column images don't cycle meaningfully)
- Maximum pixel count: 40,000 (matching Open-Pixel-Poi limit; Ignis supports more)

```typescript
interface IImagePatternLoader {
  fromImage(imageData: ImageData, targetLedCount: number): StripPattern;
  fromFile(file: File, targetLedCount: number): Promise<StripPattern>;
}
```

### Pattern Engine Service

```typescript
// Contract: services/contracts/IStripPatternEngine.ts
interface IStripPatternEngine {
  // Generate from preset
  generate(presetId: string, ledCount: number, frameCount: number, params: PatternParams): StripPattern;

  // Load from image
  fromImage(imageData: ImageData, ledCount: number): StripPattern;

  // Export as image (the pattern IS a POV image)
  toImageData(pattern: StripPattern): ImageData;

  // Get available presets
  getPresets(): IPatternPreset[];

  // Apply brightness limiting for hardware (Ignis power management)
  applyBrightnessLimit(pattern: StripPattern, maxBright: number, maxPower: number, groupSize: number): StripPattern;
}
```

Registered in DI container: `poi-container.ts`.

---

## 3D POV Renderer

This is the centerpiece. The avatar spins staves with 200 LEDs each, and the LEDs leave light trails in 3D space that accumulate into the POV image — exactly like watching a pixel poi performer in a dark room.

### How It Works

**Real-world POV physics:**
A stick with 200 LEDs spins. At each moment, each LED shows one pixel of one column of an image. As the stick sweeps a full rotation, all columns are displayed. The viewer's eye persistence (~100ms) holds the earlier columns, so the full image appears to float in space.

**3D replication:**

1. **200 LED billboards** distributed along each staff's axis (matching iPixel 200 HD)
2. Each LED's color comes from `StripPattern[currentFrame][ledIndex]`
3. Frame index is derived from the staff's rotation angle: `frameIndex = (rotationAngle / 2π) * pattern.frameCount`
4. Each LED deposits a **trail ghost** at its world-space position every frame
5. Trail ghosts fade over a configurable **persistence duration**
6. The accumulated trails form the image in 3D space

### Data Flow Per Frame

```
EffectOrchestrator3D (per frame tick)
  │
  ├─ TipPositionBridge3D.update()
  │   → Returns PropState3D with worldRotation (quaternion)
  │
  ├─ Compute staff axis from quaternion (existing math)
  │   → 200 positions along axis at uniform intervals
  │
  ├─ Read StripPattern frame from rotation angle
  │   → frameIndex = (staffRotationAngle / 2π) * pattern.frameCount
  │   → StripFrame = pattern.frames[frameIndex % pattern.frameCount]
  │
  ├─ Build LedTipInput[] (200 entries)
  │   → Each entry: { position, r, g, b, brightness, velocity, speed }
  │   → RGB from StripFrame.colors[ledIndex * 3 .. ledIndex * 3 + 2]
  │
  └─ PovStripRenderer3D.update(tips[], camera, currentTime)
      ├─ Render 200 active LED billboards (instanced mesh)
      ├─ Push all 200 positions + colors to trail ring buffer
      ├─ Render trail ghosts with age-based alpha fade
      └─ Discard ghosts beyond persistence window
```

### PovStripRenderer3D

New renderer class, replacing `LedRenderer3D` when a strip pattern is active. Falls back to the existing 2-point `LedRenderer3D` when no strip pattern is assigned.

```typescript
// services/contracts/IPovStripRenderer3D.ts
interface IPovStripRenderer3D {
  initialize(parent: Object3D): void;
  update(
    staffAxis: Vector3,
    staffCenter: Vector3,
    staffHalfLength: number,
    rotationAngle: number,
    pattern: StripPattern,
    camera: Camera,
    currentTime: number,
    brightness: number
  ): void;
  setPersistenceDuration(seconds: number): void;
  setQualityTier(tier: QualityTier): void;
  reset(): void;
  dispose(): void;
}
```

**Instancing budget:**

| Quality Tier | LEDs per staff | Persistence frames (at 60fps) | Instances per prop | Two props |
|---|---|---|---|---|
| HIGH | 200 | 12 (200ms) | 2,600 | 5,200 |
| MEDIUM | 100 | 8 (133ms) | 900 | 1,800 |
| LOW | 50 | 4 (67ms) | 250 | 500 |

All well within GPU instancing limits. Uses the same `LedMaterial3D` shader (additive blending, core + halo).

**Persistence duration control:**
- Exposed in Effects Lab UI as a slider (50ms – 500ms)
- Default: 120ms (realistic eye persistence)
- Lower = streaky light trails (artistic)
- Higher = solid floating image (POV preview mode)

### Integration with Existing Effect System

The `EffectOrchestrator3D` already has the LED effect path with `TipEffectMap` resolution. The new renderer slots in alongside the existing one:

- `tipEffectMap` resolves to `"led"` → check if a `StripPattern` is assigned
  - Yes → route to `PovStripRenderer3D` (full-strip POV mode)
  - No → route to existing `LedRenderer3D` (2-point mode, backwards compatible)

No changes to the effect type enum, tip effect resolution, or other renderers (fire, charcoal, trails).

---

## 2D Strip Visualization

In the 2D pictograph, staves currently render as lines with colored endpoints. When a strip pattern is active, the staff renders as a **segmented color bar**:

- Staff line divided into `ledCount` segments (or a reasonable subset for rendering performance)
- Each segment filled with the color from `StripPattern[currentFrame][ledIndex]`
- Frame index synced to beat playback (frame advances with animation)
- Implemented as a series of small colored rectangles along the staff path, rotated to match staff orientation

**Rendering approach:**
- Canvas 2D: draw `N` small filled rectangles along the staff vector
- Performance: render every 4th LED at most (50 segments max per staff) — sufficient visual fidelity
- Color sampling: nearest-neighbor from the full-resolution strip data

**Fallback:** When no strip pattern is active, the existing staff rendering is unchanged.

---

## Device Management

### Supported Hardware

| Device | Connection | Protocol Status | LED Count | LED Type |
|---|---|---|---|---|
| Open-Pixel-Poi v3 | BLE (Web Bluetooth) | Fully documented | 25–55 | WS2812B or SK9822 |
| iPixel 200 HD | USB Serial (Web Serial) | Reverse-engineer post-gig | 200 | SK9822 |
| iPixel 104/144/256 HD | USB Serial (Web Serial) | Same protocol, different LED count | varies | SK9822 |
| Generic POV poi | PNG export | Universal | any | any |

### Device Adapter Interface

```typescript
// services/contracts/IPoiDeviceAdapter.ts
interface IPoiDeviceAdapter {
  readonly protocolName: string;
  scan(): Promise<PoiDeviceInfo[]>;
  connect(device: PoiDeviceInfo): Promise<IPoiConnection>;
}

interface IPoiConnection {
  readonly deviceInfo: PoiDeviceInfo;
  readonly connected: boolean;
  getDetailedInfo(): Promise<DeviceDetailedInfo>;
  uploadPattern(pattern: StripPattern, slot: number, onProgress?: (pct: number) => void): Promise<void>;
  setBrightness(level: number): Promise<void>;
  setSpeed(hz: number): Promise<void>;
  disconnect(): void;
}

interface PoiDeviceInfo {
  id: string;
  name: string;
  model: string;
  connectionType: "ble" | "usb-serial";
  ledCount: number;
  ledType: "ws2812b" | "sk9822";
}

interface DeviceDetailedInfo extends PoiDeviceInfo {
  firmwareVersion: string;
  bootloaderVersion?: string;
  uid: string;
  batteryLevel?: number;
}
```

### Adapter Implementations

**OpenPixelPoiAdapter** (Phase 1 — protocol fully documented):
- Uses Web Bluetooth API (`navigator.bluetooth`)
- Nordic UART Service: `6E400001-B5A3-F393-E0A9-E50E24DCCA9E`
- Pattern upload: CommCode `0x04`, chunked at 509 bytes per BLE write
- Start byte `0xD0`, end byte `0xD1`
- Brightness: CommCode `0x02`, Speed: CommCode `0x03`

**IgnisPixelAdapter** (Phase 3 — after protocol capture):
- Uses Web Serial API (`navigator.serial`)
- "Packed" protocol (from binary analysis: `C_SERIAL_PACK` + `C_DEVICE_PACK`)
- Operations: `GET_INFO`, `GET_UID`, `ERASE` (sector), `WRITE` (512-byte blocks), `LOAD_MODE`
- Brightness limiting: `ledBright = min(maxBright, floor(maxPower / avgBright))` per image column, `groupSize = 8` LEDs
- Wire-level byte framing: TBD (Wireshark capture session)

### Device Management UI

Lives in Effects Lab as a "Devices" tab or as a panel accessible from the LED tuning controls:

- **Device list:** Connected poi with model, firmware, connection status
- **Scan button:** Triggers BLE scan or USB serial port enumeration
- **Pattern assignment:** Drag/drop or select patterns for each device slot
- **Upload button:** Pushes pattern to selected device(s) with progress bar
- **Brightness/speed controls:** Sliders that write to connected devices in real-time
- **POV preview:** Shows the flat pattern image as it would appear on the physical poi

### PNG Export (Universal Fallback)

Since a `StripPattern` is structurally identical to a POV image:
- `toImageData()` produces an `ImageData` (height = ledCount, width = frameCount)
- User can download as PNG
- Compatible with any poi software (Ignis Utility, Visual Poi, Ignis Pixel app, Open-Pixel-Poi app)

---

## Brightness & Power Management

The Ignis Pixel hardware uses power-limited brightness to prevent battery brownout. From the reverse-engineered logs:

```
maxBright = 21 (from bright.json, SK9822-specific)
maxPower = 0.226
groupSize = 8 LEDs

For each image column:
  avgBright = average brightness of all pixels in column (0–1 range)
  ledBright = min(maxBright, floor(maxPower / avgBright))

Where ledBright is the SK9822 global brightness register value (0–31 range).
```

The pattern engine applies this as a post-processing step before upload, preserving the original pattern data. The 3D/2D renderers show the unconstrained pattern; the hardware gets the power-limited version.

---

## Service Architecture

### New Services

| Service | Interface | Implementation | Container |
|---|---|---|---|
| `stripPatternEngine` | `IStripPatternEngine` | `StripPatternEngine` | `poi-container.ts` |
| `imagePatternLoader` | `IImagePatternLoader` | `ImagePatternLoader` | `poi-container.ts` |
| `povStripRenderer3DFactory` | `IPovStripRenderer3DFactory` | `PovStripRenderer3DFactory` | `poi-container.ts` |
| `openPixelPoiAdapter` | `IPoiDeviceAdapter` | `OpenPixelPoiAdapter` | `poi-container.ts` |
| `ignisPixelAdapter` | `IPoiDeviceAdapter` | `IgnisPixelAdapter` | `poi-container.ts` |
| `poiDeviceManager` | `IPoiDeviceManager` | `PoiDeviceManager` | `poi-container.ts` |

### New State Factory

```typescript
// state/poi-state.svelte.ts
function createPoiState(patternEngine: IStripPatternEngine, deviceManager: IPoiDeviceManager) {
  let activePattern = $state<StripPattern | null>(null);
  let activePresetId = $state<string>("solid");
  let connectedDevices = $state<PoiDeviceInfo[]>([]);
  let persistenceDuration = $state(0.12); // 120ms default
  let uploadProgress = $state<number | null>(null);

  return {
    get activePattern() { return activePattern; },
    get activePresetId() { return activePresetId; },
    get connectedDevices() { return connectedDevices; },
    get persistenceDuration() { return persistenceDuration; },
    get uploadProgress() { return uploadProgress; },
    // ... setters and actions
  };
}
```

### File Structure

```
src/lib/features/poi/
  ├── domain/
  │   ├── StripPattern.ts          // Core data types
  │   ├── PatternPreset.ts         // Preset interface + built-in presets
  │   └── DeviceTypes.ts           // Device info, connection types
  ├── services/
  │   ├── contracts/
  │   │   ├── IStripPatternEngine.ts
  │   │   ├── IImagePatternLoader.ts
  │   │   ├── IPoiDeviceAdapter.ts
  │   │   ├── IPoiDeviceManager.ts
  │   │   └── IPovStripRenderer3DFactory.ts
  │   └── implementations/
  │       ├── StripPatternEngine.ts
  │       ├── ImagePatternLoader.ts
  │       ├── OpenPixelPoiAdapter.ts
  │       ├── IgnisPixelAdapter.ts
  │       └── PoiDeviceManager.ts
  ├── state/
  │   └── poi-state.svelte.ts
  ├── context/
  │   └── poi-context.ts
  └── components/
      ├── PatternPicker.svelte       // Preset browser + image upload
      ├── DevicePanel.svelte          // Connected devices, upload controls
      ├── PovPreview.svelte           // Flat POV image preview
      └── PersistenceSlider.svelte    // Trail duration control

src/lib/shared/3d/effects/poi/
  ├── PovStripRenderer3D.ts          // Full-strip renderer with POV trails
  └── PovTrailRing.ts                // Ring buffer for POV trail accumulation
```

---

## Phasing

### Phase 1: Pattern Engine + Image Upload + Open-Pixel-Poi BLE
- `StripPatternEngine` with 5 algorithmic presets
- `ImagePatternLoader` (PNG/BMP/JPG → StripPattern)
- `toImageData()` for PNG export
- `OpenPixelPoiAdapter` (Web Bluetooth, full protocol)
- Minimal UI: pattern picker, image upload, device connect, upload button
- Interim: PNG export for Ignis Utility upload

### Phase 2: 3D POV Renderer
- `PovStripRenderer3D` with instanced 200-LED strip
- `PovTrailRing` for persistence-of-vision trail accumulation
- Integration into `EffectOrchestrator3D` (strip pattern → full POV, no pattern → existing 2-point)
- Persistence duration slider in Effects Lab
- Quality tier adaptation (200/100/50 LEDs)

### Phase 3: Ignis Protocol Reverse Engineering + Device Management
- Wireshark/USBPcap capture session → document wire protocol
- `IgnisPixelAdapter` implementation (Web Serial API)
- Full device management UI (scan, connect, upload, brightness/speed)
- Brightness power-limiting post-processor
- Multi-device upload (both poi simultaneously)

### Phase 4: 2D Renderer + Composite Motion Mapping
- Staff-as-segmented-color-bar in 2D pictograph
- Motion-driven pattern presets (only the ones that prove visually interesting)
- Advanced preset parameter UI (overrides layer on top of presets)

---

## Hardware Recon Summary

### Austen's Hardware (from reverse engineering session)

**2x iPixel 200 HD:**
- Firmware: 3.0.11.10
- Bootloader: 3.0.2
- Type code: 010B
- LED type: SK9822 (DotStar)
- Connection: USB Serial (STM32 VCP, COM3 + COM5)
- Serial IDs: `004F-0040-5109-3035-3338-3434`, `0064-0048-5113-3037-3538-3636`
- Bluetooth MAC (shared): `78:a5:88:05:ae:37`

**Protocol (from log analysis + binary string extraction):**
- Qt6 app with `Qt6SerialPort.dll`
- Protocol layers: `C_SERIAL_SIMPLE` → `C_SERIAL_PACK` → `C_SERIAL_BASE`
- Device layers: `C_DEVICE_LEGACY` (fallback) → `C_DEVICE_PACK` (primary) → `C_DEVICE_TLV` (newest)
- Connection sequence: scan ports → `TryCreate` (tries packed, falls back to legacy) → `GET_INFO` → `GET_UID`
- Upload sequence: `CnvToLegacyFmt` (per-column brightness) → `erase N sectors` → `write data` (512-byte blocks, indexed A:1,2,3...) → `write done` → `LOAD_MODE` OK
- Brightness formula: `ledBright = min(maxBright, floor(maxPower / avgBright))`, maxBright=21, maxPower=0.226, groupSize=8

**Wire-level protocol:** Not yet captured. Requires Wireshark + USBPcap session while Ignis Utility uploads. Scheduled for after 2026-04-08 gig.

### Open-Pixel-Poi Protocol (fully documented)

- BLE: Nordic UART Service `6E400001-B5A3-F393-E0A9-E50E24DCCA9E`
- Packet framing: `0xD0 [CommCode] [payload] 0xD1`
- Pattern upload: CommCode `0x04`, payload = `[height:1] [count:2 BE] [RGB data]`
- Chunking: 509 bytes per BLE write, implicit multipart (first chunk has header, last has `0xD1`)
- Max pixels: 40,000 (height × width)
- Brightness: CommCode `0x02` (0–255)
- Speed: CommCode `0x03` (uint16 BE, Hz)
- Bank/slot: 3 banks × 5 slots = 15 pattern positions

---

## Testing Strategy

**Pattern engine:** Unit tests for preset generation (deterministic RGB output for known inputs), image-to-pattern conversion (round-trip: image → StripPattern → image should match), brightness limiting formula.

**3D renderer:** Visual verification via Playwright screenshots — load a known pattern, capture the 3D scene, compare trail accumulation. Not unit-testable (GPU rendering).

**Device adapters:** Integration tests against mock serial/BLE streams. The BLE packet building logic is pure and testable. The actual hardware communication is verified manually.

**Brightness limiting:** Unit tests — the formula from the Ignis logs gives us exact expected values to test against (e.g., avgBright 0.550 → ledBright 8, avgBright 0.107 → ledBright 21).
