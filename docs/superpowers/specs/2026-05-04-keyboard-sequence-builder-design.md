# Keyboard Sequence Builder — Design Spec

**Date:** 2026-05-04
**Module:** assemble-lab
**Status:** Draft

## Summary

Add numpad-driven sequence building to the existing assemble tab with timing capture. Users tap grid positions on the numpad, and the timing between keypresses becomes the rhythm of the resulting animation. Keyboard mode is a toggle — click-only flow is unchanged when off.

## Goals

1. Build sequences entirely via keyboard (numpad spatial mapping matches grid layout)
2. Capture timing data from keypress rhythm
3. Decouple positions from timing — re-record rhythm without rebuilding the path
4. Provide multiple timing interpretation modes for experimentation
5. Zero impact on existing click-based flow when keyboard mode is off

## Numpad → Grid Mapping

```
7=NW   8=N    9=NE
4=W    5=C    6=E
1=SW   2=S    3=SE
```

Spatial layout mirrors the grid. Numpad 8 is "up" = North, numpad 2 is "down" = South, etc.

### Grid Mode Filtering

- **Diamond:** Only 2 (S), 4 (W), 6 (E), 8 (N) active. Plus 5 (C) if center enabled.
- **Box:** Only 1 (SW), 3 (SE), 7 (NW), 9 (NE) active. Plus 5 (C) if center enabled.
- **Skewed:** All 9 keys active.

Invalid key for current mode: brief red flash on the corresponding grid point label (200ms), no state change.

## Control Key Bindings

| Key | Action |
|-----|--------|
| `NumpadAdd` (+) | Increase turn count: 0 → 0.5 → 1 → 1.5 → 2 → 2.5 → 3 → wraps to 0 |
| `NumpadSubtract` (-) | Decrease turn count: 0 → -0.5 (float) → wraps to 3 |
| `NumpadMultiply` (*) | Toggle rotation direction CW ↔ CCW |
| `NumpadDivide` (/) | Cycle orientation: IN → OUT → CLOCK → COUNTER |
| `Numpad0` (0) | Switch hands: Blue ↔ Red |
| `NumpadDecimal` (.) | Undo last step |
| `NumpadEnter` | Finish hand / complete sequence |

All control keys call existing `assemble-state` actions (`setTurnCount`, `setRotationDirection`, `setOrientation`, `switchToHand`, `undoStep`, `finishHand`).

## Keyboard Handler

New file: `services/assemble-keyboard-handler.ts`

Follows the `arrange-keyboard-handler.ts` pattern — pure function that takes a `KeyboardEvent` + state context, returns an action descriptor. No DOM dependency in the handler itself.

```typescript
interface KeyboardAction {
  type: "position" | "turnUp" | "turnDown" | "toggleRotation"
       | "cycleOrientation" | "switchHand" | "undo" | "finish";
  location?: GridLocation; // only for type === "position"
}

function handleAssembleKeyDown(
  e: KeyboardEvent,
  context: { gridMode: GridMode; showCenter: boolean; isModalOpen: boolean }
): KeyboardAction | null;
```

### Input Guards

Skip keyboard handling when:
- `keyboardMode` is off
- Active element is `INPUT`, `TEXTAREA`, or `contentEditable`
- A modal/popover is open (orientation explainer, etc.)

### Listener Lifecycle

`window.addEventListener("keydown", ...)` added in an `$effect` inside `AssembleLabModule.svelte`, gated on `keyboardMode`. Cleaned up on toggle-off or component destroy.

Separate `keyup` listener for hold-duration timing capture.

## Timing Capture

### Data Model

```typescript
interface TimedStep {
  step: BuilderStep;
  keydownTimestamp: number;   // performance.now()
  keyupTimestamp: number;     // performance.now()
}

interface TimingSession {
  timedSteps: TimedStep[];
  captureMode: "inter-press" | "hold-duration";
  interpretMode: "proportional" | "absolute" | "quantized";
  bpm: number;               // quantized mode, default 120
  subdivision: 4 | 8 | 16;   // quarter, 8th, 16th notes
}
```

### State Location

New file: `state/timing-state.svelte.ts` — separate from assemble-state. Timing is an overlay on position data, not entangled with the builder phase machine.

`AssembleLabModule` composes both states and passes them to relevant components.

### Capture Modes

**Inter-press:** Duration = gap between consecutive `keydownTimestamp` values.

```typescript
duration = timedSteps[i + 1].keydownTimestamp - timedSteps[i].keydownTimestamp;
```

**Hold-duration:** Duration = how long the key was held.

```typescript
duration = timedSteps[i].keyupTimestamp - timedSteps[i].keydownTimestamp;
```

Toggle between modes via `TimingControlsPanel`.

### Interpretation Modes

**Proportional:** Normalize all durations relative to their average. Clamp to [150ms, 2000ms]. Fast taps compress, slow taps stretch proportionally.

**Absolute:** Raw duration used directly. Clamp to [100ms, 3000ms].

**Quantized:** Snap each duration to nearest musical subdivision of BPM grid.

```typescript
const subdivisionMs = (60_000 / bpm) / (subdivision / 4);
const quantized = Math.round(rawDuration / subdivisionMs) * subdivisionMs;
// Clamp: minimum 1 subdivision, maximum 8 subdivisions
```

### Duration Computation

New file: `services/timing-interpreter.ts` — pure functions, no state.

```typescript
function computeDurations(session: TimingSession): number[];
```

Returns an array of millisecond durations, one per step. Interpretation mode and capture mode determine the computation.

## Replay System

### Re-record Flow

1. User builds positions via numpad (or clicks)
2. Presses "Re-record Timing" button
3. Positions stay locked on grid — props shown at their starting positions
4. User taps any numpad position key (1-9) to advance through the sequence
5. Inter-press gaps (or hold durations) recorded as new timing data
6. Positions unchanged, only timing updated

This decouples position authoring from timing authoring.

### Full Replay

"Play" button replays entire sequence using computed durations from the active interpretation mode. Props animate through all steps sequentially.

Switching interpretation mode (e.g., proportional → quantized) and replaying shows the difference immediately — same positions, different rhythm.

### Transport Controls

Play | Pause | Reset — compact bar below StepStrip. Only visible when timing data exists. Re-record button adjacent.

New component: `ReplayTransport.svelte`

## Keyboard Mode Toggle

### Toggle Location

- `AssembleIdlePanel`: keyboard icon button in the idle state panel
- `BuilderInstructionHeader`: same toggle visible during building phase

Boolean `keyboardMode` added to assemble-state.

### Visual Changes When Keyboard Mode ON

1. **Key labels on grid:** Each hit target shows its numpad number as a subtle text overlay (low opacity, small font). Invalid keys for current grid mode are dimmed.

2. **Timing controls panel:** Appears below/beside the grid. Contains:
   - Capture mode toggle (inter-press / hold-duration)
   - Interpretation mode toggle (proportional / absolute / quantized)
   - BPM spinner (visible only in quantized mode)
   - Subdivision picker (quarter / 8th / 16th — visible only in quantized mode)

3. **Turn/rotation badge:** Compact display showing current turn count + rotation direction (e.g., "1.5 CW"). Updates live as user presses `+`/`-`/`*`.

4. **Key hint strip:** Horizontal bar at bottom with compact key reference:
   `+/- turns | * flip | / ori | 0 hand | . undo | ⏎ done`

### Visual Changes When Keyboard Mode OFF

None. Identical to current behavior.

## New Components

### `KeyboardHintStrip.svelte`
Compact horizontal bar showing control key reference. Visible only in keyboard mode. Positioned at bottom of assemble layout.

### `TimingControlsPanel.svelte`
Capture mode + interpretation mode toggles, BPM/subdivision controls. Visible only in keyboard mode and when timing data exists or is being recorded.

### `ReplayTransport.svelte`
Play/Pause/Reset + Re-record button. Visible only when timing data exists.

## File Changes

```
src/lib/features/assemble-lab/
├── state/
│   ├── assemble-state.svelte.ts       MODIFY — add keyboardMode flag
│   └── timing-state.svelte.ts         NEW
├── services/
│   ├── assemble-keyboard-handler.ts   NEW
│   └── timing-interpreter.ts          NEW
├── components/
│   ├── InteractiveGrid.svelte         MODIFY — key label overlays
│   ├── AssembleLabModule.svelte        MODIFY — compose timing state,
│   │                                   keyboard listener, keyboard mode toggle
│   ├── KeyboardHintStrip.svelte        NEW
│   ├── TimingControlsPanel.svelte      NEW
│   └── ReplayTransport.svelte          NEW
```

## Out of Scope

- **Shortened shift/antispin timing** — works naturally via numpad 5 for center (hash), but special shortened animations are a future enhancement after base timing capture proves out
- **Mobile** — numpad is desktop only. Click flow unchanged on mobile.
- **Persisting timing data** — first version is ephemeral (lab experimentation). Save to sequence comes later if the feature earns it.
- **Audio metronome** — natural fit for quantized mode but not MVP.
- **NumLock detection** — assume NumLock is on. If keys don't register, user's NumLock is off. No special handling needed.
