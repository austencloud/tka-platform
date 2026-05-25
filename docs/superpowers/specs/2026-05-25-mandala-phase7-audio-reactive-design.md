# Mandala Phase 7: Audio-Reactive Mode — Design Spec

## Overview

Audio-Reactive Mode drives mandala animation parameters in real-time from mic input or an uploaded audio file. The viewer's existing RAF animation loop (`animatePeriod`, `animateMax`, `animateRotation`, `colorPhase`) is replaced by a live audio pipeline that maps FFT frequency bands to those same parameters. The result is a mandala that breathes, spins, and shifts color with the music — festival projection material.

This builds directly on Phase 1 (`MandalaPane.svelte` + `SequenceMandala.svelte`) and extends cleanly to Phase 5 formations once that phase ships. The audio pipeline is self-contained and does not alter the mandala geometry or rendering code.

---

## Audio Pipeline

### Sources

Three input sources, selectable from the controls panel:

| Source | Mechanism | Notes |
|--------|-----------|-------|
| **Microphone** | `navigator.mediaDevices.getUserMedia({ audio: true })` | Requires browser permission. `MediaStreamAudioSourceNode`. |
| **Uploaded file** | `<input type="file" accept="audio/*">` → `AudioBuffer` → `AudioBufferSourceNode` | Decoded via `audioContext.decodeAudioData`. Loops. |
| **System audio** | Not supported. `getDisplayMedia` is video-only in Chrome/Firefox; audio capture from system requires OS-level APIs not available in Web Audio. | Show a tooltip explaining the limitation. |

System audio is excluded — the browser cannot capture it reliably cross-platform. Mic + file covers the real use cases (live performance + DJ set playback).

### AudioContext Lifecycle

One `AudioContext` per session. Created on first source activation, reused when switching sources, closed on component teardown or when audio is explicitly stopped.

```
getUserMedia / file input
        ↓
MediaStreamAudioSourceNode / AudioBufferSourceNode
        ↓
AnalyserNode (FFT_SIZE = 2048, smoothingTimeConstant = 0.75)
        ↓
AudioContext.destination (file source only — mic must NOT reach destination)
```

Mic source is never connected to `destination` (prevents feedback). File source is connected so the user hears playback.

**FFT_SIZE = 2048** → 1024 frequency bins. With typical 44.1 kHz sample rate, each bin = 43 Hz. This gives adequate resolution across all five bands without being expensive.

### FFT Bin Ranges

Bin resolution at 44.1 kHz, FFT_SIZE 2048: each bin covers ~21.5 Hz. Bin index = `floor(Hz / (sampleRate / fftSize))`.

| Band | Hz Range | Bin Range (44.1 kHz, 2048 FFT) | Maps To |
|------|----------|--------------------------------|---------|
| Sub-bass | 20–60 Hz | bins 1–2 | Depth / expansion amplitude |
| Bass | 60–250 Hz | bins 3–11 | Breathing speed |
| Mids | 250–2000 Hz | bins 12–93 | Rotation / spin speed |
| High-mids | 2000–6000 Hz | bins 93–279 | Color phase shift rate |
| Highs | 6000–20000 Hz | bins 279–465 | Line weight / stroke opacity |

Each band energy = average of byte values (0–255) across its bin range, normalized to 0–1. Actual sample rate is read from `audioContext.sampleRate` at runtime — bin indices are computed dynamically, not hardcoded, to handle 48 kHz sources.

---

## Frequency Mapping

Five band energies (0–1) drive five viewer parameters:

### Sub-bass → Depth

Maps sub-bass energy to `animateMax` (the `rangeMax` in `MandalaPane`).

```
rangeMax = BASE_RANGE_MAX * (1 + subBassEnergy * depthGain)
```

- `BASE_RANGE_MAX` = user's manual depth setting (preserved as baseline)
- `depthGain` = per-band sensitivity multiplier (UI slider, default 2.0, range 0.5–5.0)
- At zero energy: mandala breathes at its baseline depth
- At peak energy: mandala expands to `BASE_RANGE_MAX * (1 + depthGain)`

### Bass → Breathing Speed

Maps bass energy to `animatePeriod`. Higher energy = faster breathing.

```
period = BASE_PERIOD / (1 + bassEnergy * speedGain)
```

- `BASE_PERIOD` = user's manual speed setting (e.g. 5s)
- `speedGain` = sensitivity (default 1.5, range 0.5–4.0)
- Clamped: period ∈ [0.5s, BASE_PERIOD * 2]

### Mids → Rotation Speed

Maps mid energy to `animateRotation` (degrees per cycle).

```
rotationPerCycle = BASE_ROTATION + midsEnergy * rotationGain * 360
```

- `BASE_ROTATION` = user's manual rotation setting (default 90°)
- `rotationGain` = sensitivity (default 0.5, range 0–2.0)
- Clamped: 0–720 degrees per cycle

### High-mids → Color Phase Rate

The existing `colorPhase` RAF clock runs at `1 / (period * COLOR_CYCLE_BREATHS)` per second. Audio-reactive mode adds a multiplier driven by high-mid energy:

```
colorPhaseRate = BASE_RATE * (1 + highMidEnergy * colorGain)
```

- `colorGain` = sensitivity (default 2.0, range 0–5.0)
- Result: busy high-mid passages (cymbals, lead synth) strobe through color faster

### Highs → Line Weight

```
strokeWidth = BASE_STROKE_WIDTH * (1 + highsEnergy * lineGain)
```

- `lineGain` = sensitivity (default 1.0, range 0–3.0)
- Clamped: stroke width ∈ [0.5, BASE_STROKE_WIDTH * 4]
- Subtle by default — highs are noisy; low gain prevents jitter

---

## Smoothing and Sensitivity

### Exponential Moving Average (EMA)

Raw FFT data is jittery. Each band value is smoothed with a per-tick EMA:

```
smoothed[band] = smoothed[band] * alpha + raw[band] * (1 - alpha)
```

- `alpha` is the **smoothing factor** (0 = no smoothing / instant response, 1 = frozen)
- Default: `0.75` (quarter-second feel at 60fps)
- Global smoothing slider in the controls panel, range 0–0.95
- Heavy smoothing (0.85–0.95) works for ambient/slow music; light (0.5–0.65) for percussion-driven

The `AnalyserNode.smoothingTimeConstant` is set to `0` — smoothing is handled manually per-band so different bands can have different response curves. (Sub-bass benefits from heavier smoothing than highs.)

### Per-Band Smoothing Multipliers

Internal constants (not user-exposed):

| Band | Alpha modifier |
|------|---------------|
| Sub-bass | `globalAlpha * 1.1` (extra smoothing — sub-bass is bassy/slow) |
| Bass | `globalAlpha` |
| Mids | `globalAlpha * 0.9` |
| High-mids | `globalAlpha * 0.8` |
| Highs | `globalAlpha * 0.7` (faster response for transients) |

Clamped to [0, 0.95] for all bands.

### Threshold Gate

Each band has a **noise floor threshold** (0–0.3, default 0.05). Energy below the threshold is treated as zero. This prevents near-silence from causing faint parameter drift.

```
gated[band] = energy[band] > threshold[band] ? energy[band] : 0
```

Threshold controls are in the Advanced section of the sensitivity panel (collapsed by default).

---

## Beat Detection

Beat detection provides an optional discrete pulse on top of the continuous FFT mapping. When a beat is detected, it fires an **impulse** that snaps a parameter to a peak value, then the smoothed EMA pulls it back down naturally.

### Algorithm: Spectral Flux Onset Detection

`realtime-bpm-analyzer` (already in `package.json`, used by `bpm-analyzer.ts`) handles offline BPM estimation and is used to populate the informational BPM badge when a file source is loaded. For live onset detection — which must run in the RAF loop with zero blocking — we use **spectral flux**, a lightweight real-time algorithm:

1. Store the previous FFT frame
2. For each bin, compute `max(0, current[bin] - previous[bin])` (positive flux only)
3. Sum flux across the bass band (bins 1–30)
4. Compare against a running average + threshold multiplier
5. If sum > `runningAvg * beatSensitivity`, fire beat event

The running average uses a 2-second window (120 frames at 60fps). `beatSensitivity` is a slider (1.2–3.0, default 1.6). Higher = fewer false positives.

### Beat Impulse

On beat detection, whichever parameter(s) are in "beat snap" mode receive an impulse:

```
impulseValue[param] = Math.min(smoothed[param] + BEAT_IMPULSE_STRENGTH, 1.0)
```

`BEAT_IMPULSE_STRENGTH` defaults to 0.4. The EMA smoothing naturally decays the impulse over the next ~0.3s.

Beat detection can be toggled independently per-parameter. By default it is enabled for **depth** only (the most dramatic visual response). The user can enable it for rotation and color phase as well.

### BPM Display

The detected BPM is displayed as a read-only badge in the controls panel. Not used for anything mechanical — informational only.

---

## UI Controls

Audio controls slot into `MandalaViewerControls.svelte` as a new collapsible section above the existing "Tune" section.

### Audio Source Section (always visible when audio mode is active)

```
[ Mic ]  [ File ]                   ← source selector buttons (pill group)
[ ● Live ]                          ← status badge: idle / listening / playing
[ Stop Audio ]                      ← appears when audio is active
```

When File is selected: file picker opens immediately. After picking, shows filename + playback controls (play/pause/loop toggle).

### Sensitivity Panel (expandable)

```
▸ Sensitivity
  Global Smoothing     [————●———] 0.75
  
  Sub-bass → Depth     [——●—————] 2.0
  Bass → Speed         [—●——————] 1.5
  Mids → Spin          [——●—————] 0.5
  High-mids → Color    [———●————] 2.0
  Highs → Line         [——●—————] 1.0
```

Each slider is a horizontal range with label on left, numeric value on right. Same styling as the existing speed/depth sliders in MandalaViewerControls.

### Beat Detection Section (inside Sensitivity, collapsed by default)

```
▸ Beat Detection
  Sensitivity          [———●————] 1.6
  Snap depth           [toggle on]
  Snap rotation        [toggle off]
  Snap color           [toggle off]
  BPM: 124             ← read-only badge
```

Toggles follow the existing button + toggle-indicator pattern (no checkboxes).

### Spectrum Overlay (optional)

A small frequency spectrum bar chart overlaid at the bottom edge of the mandala canvas. Toggle in the controls panel ("Show spectrum" button). Five bars, one per band, colored to match their target parameter:

| Bar color | Band |
|-----------|------|
| Indigo | Sub-bass |
| Blue | Bass |
| Cyan | Mids |
| Green | High-mids |
| Yellow | Highs |

Bars are 4px wide, max height 40px, opacity 0.6. Rendered as SVG overlay on top of the mandala canvas. Useful for diagnosing sensitivity settings and as visual feedback during live performance setup.

---

## Formation Integration (Phase 5 Extension)

When mandala formations ship (Phase 5), audio-reactive mode extends naturally. Each mandala instance in the formation can be assigned a **primary band** and will react most strongly to that band's energy:

| Mandala role | Primary band |
|--------------|-------------|
| Center mandala | Sub-bass |
| Inner ring | Bass |
| Middle ring | Mids |
| Outer ring | High-mids |
| Corner / accent | Highs |

Assignment is automatic based on position in formation (distance from center → higher frequency band). The user can override per-mandala in a formation assignment UI (out of scope for Phase 7 — spec here for handoff to Phase 5 implementation).

**Data model for formation integration (Phase 5 handoff):**

```typescript
export type FrequencyBand = 'subBass' | 'bass' | 'mids' | 'highMids' | 'highs';

export interface MandalaInstanceAudioConfig {
  primaryBand: FrequencyBand;   // gets 3x gain weight
  gainMultiplier: number;        // per-instance overall sensitivity (default 1.0)
}
```

`MandalaPane` (formations variant) will hold a `MandalaInstanceAudioConfig[]` parallel to its formation `mandalas[]` array. `MandalaAudioEngine.bands` is shared across all instances; each instance applies its own `primaryBand` weighting when calling `computeAudioParams`.

All mandalas still receive all bands at reduced weight; the "primary band" just has a 3x gain multiplier relative to the others for that instance. This creates differentiated visual response without hard-gating.

---

## Export — Audio-Reactive Session Recording

### MP4 Record Mode

The existing `handleDownload` in `MandalaPane.svelte` renders a predetermined animation. Audio-reactive export is fundamentally different: it must capture a **live session** as it happens.

**Mechanism: MediaRecorder + Canvas stream**

1. When recording starts, call `canvas.captureStream(30)` to get a `MediaStream` from the mandala's canvas.
2. If audio source is a file: mix the audio track into the stream via `AudioContext.createMediaStreamDestination()` → add its audio track to the canvas stream.
3. If audio source is mic: optionally include mic audio track (user choice — some users don't want to record ambient sound).
4. Pass the combined stream to `MediaRecorder` with `{ mimeType: 'video/webm; codecs=vp9,opus' }` (or VP8 as fallback).
5. Collect `ondataavailable` chunks into a Blob.
6. On stop: assemble Blob, trigger download as `.webm`.

**Why WebM, not MP4:**
`MediaRecorder` cannot write MP4 in the browser. The existing `h264-mp4-encoder` workflow (offline frame-by-frame) cannot be used for live sessions — it requires all frames in advance. WebM is the correct format for live browser recording. If MP4 is required, the user can convert via ffmpeg post-download.

**Canvas requirement:**
The mandala currently renders as SVG injected into a `<img>` tag. For `captureStream` to work, the final composition must be on an `HTMLCanvasElement`. The existing `svgToCanvas` helper in `MandalaPane.svelte` already handles SVG→Canvas conversion per-frame. Audio-reactive mode promotes the canvas to a persistent element (not created per-export) so `captureStream` has a stable surface.

This requires a minor refactor: `MandalaPane` maintains a persistent `<canvas>` element that the RAF loop writes to. The SVG is still generated by `SequenceMandala` but composited to canvas each tick instead of inserted as an `<img>`.

**Record controls:**
```
[ ● Record ]  ← starts recording, turns red while active
[ ■ Stop ]    ← stops and downloads .webm
```

Recording badge shows elapsed time (MM:SS). Max session: 30 minutes (safety cap to prevent browser memory issues with large Blobs).

### Static MP4 (Scripted Preview)

For non-live export, audio reactive mode adds an option to scrub through an uploaded audio file and export a predetermined MP4 using the existing `h264-mp4-encoder` pipeline. The user sets the duration (default: 30s) and the system renders frame-by-frame. This is slower (30fps × 30s = 900 frames rendered offline) but produces a standard MP4.

---

## Technical Architecture

### New Service: `MandalaAudioEngine`

Location: `src/lib/shared/mandala/services/audio/MandalaAudioEngine.ts`

Responsibilities:
- Manages `AudioContext` lifecycle
- Handles source switching (mic → file, file → mic)
- Runs the per-tick FFT read + per-band EMA smoothing
- Runs spectral flux beat detection
- Exposes reactive state: `bandEnergies: BandEnergies`, `bpm: number`, `beatFired: boolean`
- Owns `AudioContext` cleanup on `destroy()`

```typescript
export interface BandEnergies {
  subBass: number;   // 0–1, smoothed
  bass: number;
  mids: number;
  highMids: number;
  highs: number;
}

export type AudioSource = 'mic' | 'file' | 'none';

export class MandalaAudioEngine {
  readonly bands: BandEnergies;        // Svelte 5 $state
  readonly bpm: number;                // $state
  readonly beatFired: boolean;         // $state — true for one tick on beat
  readonly source: AudioSource;        // $state
  readonly active: boolean;            // $state

  async startMic(): Promise<void>;
  async startFile(file: File): Promise<void>;
  stop(): void;
  destroy(): void;

  // Configuration (reactive)
  smoothing: number;                   // global alpha, 0–0.95
  gains: Record<keyof BandEnergies, number>;
  beatSensitivity: number;
  beatSnapTargets: Set<'depth' | 'rotation' | 'color'>;
  thresholds: Record<keyof BandEnergies, number>;
}
```

The engine's `bands` object is read every RAF tick by `MandalaPane` to compute audio-modulated parameter values.

### Parameter Computation Layer

A pure function `computeAudioParams` in `MandalaPane.svelte` converts `BandEnergies` + user sensitivity settings into the five viewer parameters. This is called each RAF frame when audio mode is active, replacing the existing periodic RAF clock for those parameters.

```typescript
function computeAudioParams(
  bands: BandEnergies,
  gains: SensitivityGains,
  base: BaseParams,
  beatFired: boolean,
  beatSnapTargets: Set<string>
): AudioDrivenParams {
  return {
    rangeMax: ...,
    period: ...,
    rotation: ...,
    colorPhaseRate: ...,
    strokeWidth: ...,
  };
}
```

When `audioMode` is `false`, `MandalaPane` uses the existing manual parameter values (no change to current behavior).

### Canvas Refactor for Recording

`MandalaPane.svelte` gains a persistent `<canvas>` element in the DOM. The existing `SequenceMandala` component continues to drive the SVG string via its RAF loop. `MandalaPane` composites that SVG to the canvas each tick. This canvas is invisible (positioned absolutely, zero z-index below the visible SVG) when not recording, and becomes the capture surface when recording starts.

Implementation path: add a `captureMode: boolean` prop to `SequenceMandala`, or lift the RAF entirely into `MandalaPane` (already partially done — `MandalaPane` manages the color phase RAF today).

### File Organization

```
src/lib/shared/mandala/
  services/
    audio/
      MandalaAudioEngine.ts       ← new
      audio-band-extractor.ts     ← new (FFT bin range constants + band energy extraction)
      spectral-flux-detector.ts   ← new (beat detection algorithm)
  components/
    AudioReactiveControls.svelte  ← new (sensitivity + beat panel, consumes MandalaAudioEngine)
    SpectrumOverlay.svelte        ← new (5-bar SVG overlay)
  MandalaPane.svelte              ← modified (audio mode integration, canvas recording)
  MandalaViewerControls.svelte    ← modified (audio source section added)
```

### Latency

Web Audio API input latency is typically 10–50ms. At 60fps, one frame = 16.7ms. The visual response lags by at most 50ms + one frame ≈ 67ms worst case. This is imperceptible for mandala animation (no sharp timing requirement like rhythm game hit detection). No additional latency compensation is needed.

---

## Accessibility and Permissions

- Mic permission: browser permission prompt fires on first "Mic" activation. If denied, show an inline error state ("Microphone access denied — check browser permissions").
- File input: standard `<input type="file">` — no special permissions required.
- All sensitivity sliders have `aria-label` and numeric value display.
- Spectrum overlay is decorative (`aria-hidden="true"`).

---

## What Is NOT in Scope

- System audio capture (not feasible in Web Audio API cross-platform)
- MIDI input driving mandala parameters
- Per-formation mandala band assignment UI (data model is specified; UI is Phase 5's responsibility)
- Audio effects on the playback (reverb, EQ) — this is a visual feature
- Saving audio-reactive sessions to Firebase
- Sharing audio-reactive links (the audio file is not stored; sharing would require uploading)
- MP4 export of mic-driven sessions (WebM only for live; scripted MP4 for file-source)
