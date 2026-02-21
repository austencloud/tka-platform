# LED Lab Design Document

**Date:** 2026-02-21
**Status:** Approved
**Depends on:** Flame Lab (complete), Animation Engine, WebGL2 infrastructure

---

## Vision

An LED Lab module that renders photorealistic LED prop visuals — volumetric glow, persistence-of-vision trails, physically-based bloom — using the same raw WebGL2 architecture as the fire system. Pixel-accurate LED dots that cast volumetric glow onto their environment.

Eventually: customizable LED patterns tied to sequence beats, manufacturer-specific hardware profiles, and direct hardware communication with real LED props (Flowtoys, Lighttoys, Neo Flow Arts, Ninja Pirate) via Web Bluetooth.

Nothing like this exists on the web. Open field.

---

## Architecture: Unified Visual Effect Layers

Fire and LEDs are both "visual effect layers" that composite over the animation canvas. They share a common interface but have independent renderers.

```
AnimationEngine
  ├─ Canvas2D (prop rendering)
  └─ Visual Effect Layers
       ├─ WebGLFireRenderer  (existing, Navier-Stokes fluid sim)
       └─ WebGLLedRenderer   (new, sprite glow + bloom + trails)
```

Both render to their own WebGL textures. The animation engine composites them additively. Fire + LEDs can run simultaneously on the same prop.

### IVisualEffectLayer Interface

```typescript
interface IVisualEffectLayer {
  readonly id: string;
  readonly name: string;
  enabled: boolean;

  initialize(gl: WebGL2RenderingContext, canvas: HTMLCanvasElement): void;
  dispose(): void;
  updateTipPositions(props: PropState[], canvasSize: number, dt: number): void;
  render(dt: number): void;
  getOutputTexture(): WebGLTexture;
}
```

Extracted from the existing fire renderer's implicit interface. Fire doesn't change behavior — it gains a formal contract that LEDs also implement.

---

## 1. LED Geometry Model

### v1: LedPoint Only

```typescript
interface LedPoint {
  dx: number;          // prop-local offset along primary axis
  dy: number;          // prop-local offset perpendicular to axis
  brightness: number;  // 0-1, max output capability
}

interface PropLedConfig {
  points: LedPoint[];
}
```

Same coordinate system as `FirePoint` (prop-local space, -300 to +300 units matching `PROP_DIMENSIONS`). Same transform math (rotate by prop angle, scale by canvas factor, translate to prop center).

### Future: Segments and Strips

```typescript
// v2+
interface LedSegment {
  points: LedPoint[];
  groupId: string;
}

interface LedStrip {
  pixelCount: number;
  path: StripPath;
  spacing: number;
  brightness: number;
  colorGamut: 'rgb' | 'rgbw';
}

type StripPath =
  | { type: 'linear'; startDx: number; startDy: number; endDx: number; endDy: number }
  | { type: 'arc'; centerDx: number; centerDy: number; radius: number; startAngle: number; endAngle: number }
  | { type: 'custom'; points: Array<{ dx: number; dy: number }> };
```

Not built in v1. The rendering pipeline handles arrays of positioned, colored light sources — segments and strips are just different ways to generate those arrays.

---

## 2. Rendering Pipeline

Raw WebGL2. No Three.js. No libraries. Same architectural pattern as `WebGLFireRenderer`.

### Pipeline Stages (per frame)

1. **LED Position Transform** — Rotate `(dx, dy)` by prop angle, scale by canvas factor, translate to prop center. Compute velocity via finite differencing (same as `FireTipTracker`). Produces world-space `(x, y, vx, vy)` per LED.

2. **Sprite Render** — For each LED point, render a radial glow quad with additive blending (`gl.ONE, gl.ONE`). Fragment shader computes inverse-square falloff:
   ```glsl
   float dist = length(uv - 0.5);
   float glow = 1.0 / (1.0 + 30.0 * dist * dist);
   gl_FragColor = vec4(ledColor * glow * brightness, glow);
   ```
   Color and brightness come from the pattern engine.

3. **Trail Accumulation** — Composite current frame onto persistent framebuffer:
   ```glsl
   vec4 trail = texture(prevFrame, uv);
   vec4 current = texture(currentFrame, uv);
   gl_FragColor = max(current, trail * fadeRate);
   ```
   `fadeRate` tunable: 0.95 = long POV trails, 0.80 = short trails. `max()` prevents dark bleeding over lit LEDs.

4. **PBR Bloom Pass** — Physically-based bloom (LearnOpenGL 2022 algorithm):
   - 5-level mip-chain downsample with 13-tap energy-preserving kernel
   - Upsample with 3x3 tent filter and additive blending
   - Low bloom weight (~0.04) composited with accumulated trail
   - Uses `RGBA16F` float textures, same `EXT_color_buffer_float` as fire

5. **Display Composite** — Final output with premultiplied alpha, `gl.ONE, gl.ONE_MINUS_SRC_ALPHA`, composited over animation canvas. Identical to fire's compositing.

### Shader Programs (5 total, vs fire's 11)

| Program | Purpose |
|---------|---------|
| LED Sprite | Radial glow quad with additive blending |
| Trail Accumulate | `max()` blend with fade |
| Bloom Downsample | 13-tap energy-preserving mip-chain |
| Bloom Upsample | 3x3 tent filter additive |
| Display | Final composite to screen |

### Performance Budget

- Max 16 LED points per prop (same cap as fire tips)
- 32 total across both props
- Bloom pass: 5 mip levels = 10 extra draw calls per frame
- Trail accumulation: 1 draw call
- LED sprites: 1 instanced draw call
- Total: ~15 draw calls/frame (vs fire's ~30)

---

## 3. Pattern Engine

### Layer Stack

Patterns stack bottom-to-top. Higher layers override lower.

| Layer | Priority | Description | v1? |
|-------|----------|-------------|-----|
| Base pattern | Lowest | Continuous color program | Yes |
| Beat triggers | Middle | Events fired on sequence beats | No |
| Keyframes | Highest | Per-beat explicit color overrides | No |

### v1: Base Patterns Only

```typescript
interface LedPattern {
  id: string;
  name: string;
  type: 'solid' | 'pulse' | 'rainbow' | 'chase' | 'strobe' | 'breathe' | 'custom';
  params: Record<string, number>;
  colorStops: ColorStop[];
}

interface ColorStop {
  position: number;  // 0-1
  color: [number, number, number];  // RGB 0-255
}
```

### Built-in Patterns

| Pattern | Description | Params |
|---------|-------------|--------|
| Solid | Single color | `hue`, `saturation`, `lightness` |
| Pulse | Breathes between bright and dim | `speed`, `minBrightness` |
| Rainbow | Cycles through hue spectrum | `speed`, `saturation` |
| Chase | Color moves along point order | `speed`, `tailLength` |
| Strobe | On/off flash | `speed`, `dutyCycle` |
| Breathe | Smooth sine wave brightness | `speed`, `color` |

### Future: Beat Triggers and Keyframes

```typescript
// v2+
interface BeatTrigger {
  condition: 'reversal' | 'direction-change' | 'letter-boundary' | 'every-n-beats';
  effect: 'flash' | 'color-shift' | 'invert' | 'pulse';
  params: Record<string, number>;
  duration: number;  // beats
}

interface Keyframe {
  beatIndex: number;
  color: [number, number, number];
  transition: 'instant' | 'fade';
  fadeDuration: number;  // beats
}

interface LedTimeline {
  basePattern: LedPattern;
  triggers: BeatTrigger[];
  keyframes: Keyframe[];
}
```

Architecture supports these from day one. The pattern engine evaluates: `keyframe > trigger > base` and outputs a color per LED per frame.

---

## 4. LED Lab UI

Sibling module to Flame Lab. Same two-tab structure.

### Tab 1: Tuning

- **LED enabled** toggle
- **Pattern selector** — preset patterns (solid, rainbow, pulse, etc.)
- **Color picker** — for solid/pulse patterns
- **Speed slider** — pattern animation speed
- **Trail length** — accumulation fade rate (0.80-0.98)
- **Bloom intensity** — bloom mix weight (0.01-0.10)
- **Glow radius** — sprite glow falloff (affects how "diffused" each LED looks)
- **Playback controls** — play/pause, BPM, sequence source (pick/library/infinite)

### Tab 2: LED Points

Same interactive canvas as Flame Lab's fire point editor:
- Prop type selector (shared component)
- Click to place LED points on prop SVG
- Drag to reposition
- Per-point brightness slider
- Set as Default / Reset / Import / Export JSON
- Undo stack (20 levels)

The fire point editor canvas (`FirePointSvgCanvas`) becomes a shared component parameterized by point type (fire vs LED).

---

## 5. Manufacturer Presets

### Data Model

```typescript
interface ManufacturerPreset {
  id: string;
  manufacturer: string;
  product: string;
  ledConfig: PropLedConfig;
  defaultPattern: LedPattern;
  notes: string;
}
```

### v1 Presets (Point-Based Props)

| Manufacturer | Product | Points | Notes |
|-------------|---------|--------|-------|
| Flowtoys | Capsule Light 2.0 | 2 (endpoints) | RGB, diffused capsule glow |
| Flowtoys | Vision Club | 1 (club head) | RGB, single bright zone |
| Flowtoys | Iso Baton | 2 (endpoints) | RGB, isolation prop |
| Lighttoys | Club | 1 (club head) | RGB, single zone |
| Generic | Staff endpoints | 2 (endpoints) | Matches fire point layout |
| Generic | Single point | 1 (center) | Simplest possible |

Strip-based presets (Visual Poi, pixel staffs) come with the strip geometry type.

---

## 6. Persistence

Same two-layer pattern as fire. localStorage for v1.

| Storage | Key | Contents |
|---------|-----|----------|
| Working state | `led-point-overrides` | Current point layout per prop type |
| User defaults | `led-point-user-defaults` | Saved baseline per prop type |
| LED Lab session | `led-lab-state` | Pattern, colors, sliders, sequence source |
| Manufacturer presets | Hardcoded + localStorage | Built-in + user-created |

Override provider follows same `ILedPointOverrideProvider` pattern as `IFirePointOverrideProvider`.

---

## 7. Hardware Bridge (Future Architecture)

Not built in v1. Architecture accommodates it.

```typescript
interface ILedOutputTarget {
  readonly type: 'screen' | 'hardware';
  send(frame: LedFrame): void;
}

interface LedFrame {
  timestamp: number;
  points: Array<{ r: number; g: number; b: number; brightness: number }>;
}
```

The pattern engine produces `LedFrame` data. The screen renderer consumes it for visuals. A future hardware bridge consumes the same data and sends it to real props.

### Flowtoys Protocol Path

Ben Kuper's `FlowtoysConnectBridge` (ESP32 firmware) exposes Flowtoys props over OSC. The Bridge device translates BLE → custom nRF24 RF.

Two integration paths:
1. **Web Bluetooth → Bridge BLE** — Sniff the GATT characteristics the official app uses, talk directly to the Bridge from the browser.
2. **WebSocket → OSC bridge** — Run a local OSC relay server, send frames from browser via WebSocket, relay to props via OSC.

Both paths consume the same `LedFrame` output from the pattern engine.

---

## 8. Research References

- [PBR Bloom algorithm (LearnOpenGL 2022)](https://learnopengl.com/Guest-Articles/2022/Phys.-Based-Bloom)
- [Dual Kawase blur (ARM SIGGRAPH 2015)](https://blog.frost.kiwi/dual-kawase/)
- [FlowtoysConnectBridge (ESP32/nRF24)](https://github.com/benkuper/FlowtoysConnectBridge)
- [Flowtoys Bridge OSC Module](https://github.com/jonglissimo/Flowtoy-Connect-Bridge-OSC-Module)
- [Bento Prop OSC Control](https://github.com/jonglissimo/Bento-Prop-OSC-Control-Chataigne-Module)
- [Lighttoys LED photography guide](https://www.lighttoys.cz/how-to-photo-video-led-light-props/)
- [Sacred Flow Art LED trail photography](https://sacredflowart.com/taking-photos-of-led-props-perfect-pictures-of-led-light-trails/)
- Pixel poi file format convention: image where column = time, row = LED position (universal across manufacturers)
