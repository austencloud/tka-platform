None# Playback & Animation Plan

> Musical Duration System - Stream 3 of 4
> Created: 2026-01-11 | Feedback ID: AYMHIvudhrRC0NWwWcUU

## Executive Summary

This plan defines how duration affects playback timing, integrating with the existing BPM system so pictographs display proportionally to their subdivision count.

---

## Current State Analysis

### Existing Playback Architecture

```
AnimationPlaybackController (orchestrates)
    ├→ AnimationLoopService (RAF + speed control)
    ├→ SequenceAnimationOrchestrator (beat state)
    └→ BeatCalculator (which beat we're in)
```

**Key Files:**
- `src/lib/features/compose/services/implementations/AnimationPlaybackController.ts`
- `src/lib/features/compose/services/implementations/AnimationLoopService.ts`
- `src/lib/features/compose/services/implementations/SequenceAnimationOrchestrator.ts`
- `src/lib/features/compose/services/implementations/BeatCalculator.ts`

### Current Timing Model

```typescript
// AnimationPlaybackController.ts line 428-429
const DEFAULT_BPM = 60;
const beatsPerSecond = DEFAULT_BPM / 60;  // = 1.0

// Each frame:
const beatDelta = (deltaTime / 1000) * beatsPerSecond;
currentBeat += beatDelta;
```

**Problem:** All beats have equal duration. No subdivision awareness.

### Current Beat Semantics

- `currentBeat = 1.0-1.999` → Beat 1's motion
- `currentBeat = 2.0-2.999` → Beat 2's motion
- Progress within beat: `beatProgress = currentBeat - floor(currentBeat)`

**Problem:** Assumes each beat = 1.0 units. No variable duration.

---

## New Timing Model

### Core Formula

```typescript
// Convert BPM to milliseconds per subdivision
const msPerBeat = 60000 / bpm;
const msPerSubdivision = msPerBeat / subdivisionsPerBeat;

// Calculate display time for a pictograph
const pictographDisplayMs = duration * msPerSubdivision;

// Example at 120 BPM, 4/4 time:
// - msPerBeat = 60000 / 120 = 500ms
// - msPerSubdivision = 500 / 4 = 125ms
// - Pictograph with duration=4: 4 * 125 = 500ms (one beat)
// - Pictograph with duration=1: 1 * 125 = 125ms (one subdivision)
// - Pictograph with duration=6: 6 * 125 = 750ms (1.5 beats)
```

### New Timeline Model

Instead of `currentBeat` (0-N), use `currentSubdivision` (0-totalSubdivisions):

```typescript
// Old model: each beat = 1.0 time unit
currentBeat: 0 → 1 → 2 → 3 → 4 (end)

// New model: timeline in subdivisions
currentSubdivision: 0 → 4 → 8 → 12 → 16 (for 4 beats of duration 4 each)

// With variable durations:
// Beat 1: duration=4, spans subdivisions 0-3
// Beat 2: duration=2, spans subdivisions 4-5
// Beat 3: duration=6, spans subdivisions 6-11
currentSubdivision: 0 → 4 → 6 → 12 (end)
```

---

## New Service: PlaybackTimingCalculator

**New File:** `src/lib/shared/music/services/contracts/IPlaybackTimingCalculator.ts`

```typescript
export interface IPlaybackTimingCalculator {
  /**
   * Calculate milliseconds per subdivision given BPM and time signature.
   */
  getMsPerSubdivision(bpm: number, timeSignature: TimeSignature): number;

  /**
   * Calculate total playback duration for a sequence.
   */
  getSequenceDurationMs(
    beats: readonly BeatData[],
    bpm: number,
    timeSignature: TimeSignature
  ): number;

  /**
   * Calculate which beat index we're in given current subdivision.
   * Returns beat index and progress within that beat (0-1).
   */
  getBeatAtSubdivision(
    currentSubdivision: number,
    beats: readonly BeatData[]
  ): { beatIndex: number; progress: number };

  /**
   * Convert elapsed milliseconds to subdivision position.
   */
  msToSubdivision(
    elapsedMs: number,
    bpm: number,
    timeSignature: TimeSignature
  ): number;

  /**
   * Convert subdivision position to milliseconds.
   */
  subdivisionToMs(
    subdivision: number,
    bpm: number,
    timeSignature: TimeSignature
  ): number;

  /**
   * Pre-calculate subdivision boundaries for all beats.
   * Returns array of { startSubdivision, endSubdivision, durationMs }
   */
  calculateBeatTimings(
    beats: readonly BeatData[],
    bpm: number,
    timeSignature: TimeSignature
  ): BeatTiming[];
}

export interface BeatTiming {
  beatIndex: number;
  startSubdivision: number;
  endSubdivision: number;
  startMs: number;
  endMs: number;
  durationMs: number;
}
```

**Implementation:** `src/lib/shared/music/services/implementations/PlaybackTimingCalculator.ts`

```typescript
@injectable()
export class PlaybackTimingCalculator implements IPlaybackTimingCalculator {
  getMsPerSubdivision(bpm: number, timeSignature: TimeSignature): number {
    const msPerBeat = 60000 / bpm;
    return msPerBeat / timeSignature.subdivisionsPerBeat;
  }

  getSequenceDurationMs(
    beats: readonly BeatData[],
    bpm: number,
    timeSignature: TimeSignature
  ): number {
    const totalSubdivisions = beats.reduce((sum, beat) => sum + (beat.duration || 4), 0);
    return totalSubdivisions * this.getMsPerSubdivision(bpm, timeSignature);
  }

  getBeatAtSubdivision(
    currentSubdivision: number,
    beats: readonly BeatData[]
  ): { beatIndex: number; progress: number } {
    let accumulatedSubs = 0;

    for (let i = 0; i < beats.length; i++) {
      const beatDuration = beats[i].duration || 4;
      const beatEnd = accumulatedSubs + beatDuration;

      if (currentSubdivision < beatEnd) {
        const progressInBeat = (currentSubdivision - accumulatedSubs) / beatDuration;
        return { beatIndex: i, progress: progressInBeat };
      }

      accumulatedSubs = beatEnd;
    }

    // Past end - return last beat at 100%
    return { beatIndex: beats.length - 1, progress: 1.0 };
  }

  msToSubdivision(elapsedMs: number, bpm: number, timeSignature: TimeSignature): number {
    const msPerSub = this.getMsPerSubdivision(bpm, timeSignature);
    return elapsedMs / msPerSub;
  }

  subdivisionToMs(subdivision: number, bpm: number, timeSignature: TimeSignature): number {
    const msPerSub = this.getMsPerSubdivision(bpm, timeSignature);
    return subdivision * msPerSub;
  }

  calculateBeatTimings(
    beats: readonly BeatData[],
    bpm: number,
    timeSignature: TimeSignature
  ): BeatTiming[] {
    const msPerSub = this.getMsPerSubdivision(bpm, timeSignature);
    const timings: BeatTiming[] = [];
    let currentSub = 0;
    let currentMs = 0;

    for (let i = 0; i < beats.length; i++) {
      const duration = beats[i].duration || 4;
      const durationMs = duration * msPerSub;

      timings.push({
        beatIndex: i,
        startSubdivision: currentSub,
        endSubdivision: currentSub + duration,
        startMs: currentMs,
        endMs: currentMs + durationMs,
        durationMs,
      });

      currentSub += duration;
      currentMs += durationMs;
    }

    return timings;
  }
}
```

---

## AnimationPlaybackController Changes

**File:** `src/lib/features/compose/services/implementations/AnimationPlaybackController.ts`

### New State Properties

```typescript
interface AnimationState {
  // Existing
  currentBeat: number;  // Keep for backward compatibility
  isPlaying: boolean;
  speed: number;

  // New subdivision-based timing
  currentSubdivision: number;
  totalSubdivisions: number;
  beatTimings: BeatTiming[];  // Pre-calculated
}
```

### Modified onAnimationUpdate

```typescript
// OLD (line 421-430)
private onAnimationUpdate(deltaTime: number): void {
  const DEFAULT_BPM = 60;
  const beatsPerSecond = DEFAULT_BPM / 60;
  const beatDelta = (deltaTime / 1000) * beatsPerSecond;
  const newBeat = this.state.currentBeat + beatDelta;
  // ...
}

// NEW
private onAnimationUpdate(deltaTime: number): void {
  const bpm = this.getBpm();  // Get from BPM chips/settings
  const timeSignature = this.getTimeSignature();

  // Calculate subdivision delta
  const msPerSubdivision = this.timingCalculator.getMsPerSubdivision(bpm, timeSignature);
  const subdivisionDelta = deltaTime / msPerSubdivision;

  // Advance subdivision
  const newSubdivision = this.state.currentSubdivision + subdivisionDelta;

  // Check for end/loop
  if (newSubdivision >= this.state.totalSubdivisions) {
    if (this.state.shouldLoop) {
      this.state.currentSubdivision = this.isSeamlesslyLoopable
        ? this.getLoopStartSubdivision()  // Skip start position
        : 0;
    } else {
      this.pause();
      return;
    }
  } else {
    this.state.currentSubdivision = newSubdivision;
  }

  // Calculate which beat we're in for interpolation
  const { beatIndex, progress } = this.timingCalculator.getBeatAtSubdivision(
    this.state.currentSubdivision,
    this.beats
  );

  // Update legacy currentBeat for compatibility
  this.state.currentBeat = beatIndex + 1 + progress;

  // Trigger render with new state
  this.render();
}
```

### Initialize Beat Timings

```typescript
private initializePlayback(beats: BeatData[], timeSignature: TimeSignature): void {
  const bpm = this.getBpm();

  // Pre-calculate all beat timings
  this.state.beatTimings = this.timingCalculator.calculateBeatTimings(
    beats,
    bpm,
    timeSignature
  );

  this.state.totalSubdivisions = beats.reduce(
    (sum, beat) => sum + (beat.duration || 4),
    0
  );

  this.state.currentSubdivision = 0;
}
```

---

## BeatCalculator Changes

**File:** `src/lib/features/compose/services/implementations/BeatCalculator.ts`

### Add Subdivision Awareness

```typescript
// OLD
calculateBeatState(currentBeat: number, beats, totalBeats) {
  const currentBeatIndex = Math.floor(currentBeat);
  const beatProgress = currentBeat - currentBeatIndex;
  // ...
}

// NEW
calculateBeatState(
  currentSubdivision: number,
  beats: BeatData[],
  beatTimings: BeatTiming[]
): BeatState {
  // Find which beat contains this subdivision
  const timing = beatTimings.find(
    t => currentSubdivision >= t.startSubdivision &&
         currentSubdivision < t.endSubdivision
  );

  if (!timing) {
    // Past end or before start
    return this.getEndState(beats);
  }

  const beatProgress =
    (currentSubdivision - timing.startSubdivision) /
    (timing.endSubdivision - timing.startSubdivision);

  return {
    beatIndex: timing.beatIndex,
    beatProgress,
    currentBeat: beats[timing.beatIndex],
    nextBeat: beats[timing.beatIndex + 1] ?? null,
  };
}
```

---

## PropInterpolator Changes

**File:** `src/lib/features/compose/services/implementations/PropInterpolator.ts`

No changes needed - it already uses `beatProgress` (0-1) for interpolation. The new system provides the same `beatProgress` calculated from subdivisions.

---

## Step Playback Mode Changes

**File:** `src/lib/features/compose/services/implementations/AnimationPlaybackController.ts`

```typescript
// OLD: Step by fixed beat amount
private stepForward(stepSize: 0.5 | 1): void {
  const newBeat = this.state.currentBeat + stepSize;
  // ...
}

// NEW: Step by subdivision-aware amounts
private stepForward(): void {
  // Find next beat boundary
  const currentTiming = this.getCurrentBeatTiming();
  const nextSubdivision = currentTiming.endSubdivision;

  // Animate to next beat
  this.animateToSubdivision(nextSubdivision);
}

private stepBackward(): void {
  // Find previous beat boundary
  const currentTiming = this.getCurrentBeatTiming();
  const prevSubdivision = currentTiming.startSubdivision;

  // If we're at the start, go to previous beat
  if (this.state.currentSubdivision <= prevSubdivision + 0.1) {
    const prevTiming = this.state.beatTimings[currentTiming.beatIndex - 1];
    if (prevTiming) {
      this.animateToSubdivision(prevTiming.startSubdivision);
    }
  } else {
    this.animateToSubdivision(prevSubdivision);
  }
}
```

---

## BPM Integration

### Existing BPM Sources

1. **BPM Chips** - User selection (15, 30, 60, 90, 120, 150)
2. **Speed Multiplier** - `speed = bpm / 60`
3. **localStorage** - `tka_animation_speed`

### No New BPM UI Needed

The existing BPM system works perfectly. We just need to:

1. Read BPM from existing state
2. Combine with time signature
3. Calculate ms per subdivision

```typescript
private getBpm(): number {
  // Use existing BPM from compose state or animation panel
  return this.compositionState?.bpm ?? this.animationPanelState?.effectiveBpm ?? 60;
}

private getTimeSignature(): TimeSignature {
  // Get from sequence or default
  return this.sequence?.timeSignature ?? DEFAULT_TIME_SIGNATURE;
}
```

---

## Performance Considerations

### Pre-calculation Strategy

Calculate beat timings once when:
- Sequence loads
- BPM changes
- Time signature changes

Store in `beatTimings` array for O(1) lookup during playback.

### Binary Search for Long Sequences

For sequences with many beats, use binary search:

```typescript
getBeatAtSubdivision(currentSubdivision: number, beatTimings: BeatTiming[]): BeatTiming {
  let left = 0;
  let right = beatTimings.length - 1;

  while (left < right) {
    const mid = Math.floor((left + right) / 2);
    if (beatTimings[mid].endSubdivision <= currentSubdivision) {
      left = mid + 1;
    } else {
      right = mid;
    }
  }

  return beatTimings[left];
}
```

### Avoid Recalculation Per Frame

```typescript
// BAD - recalculates every frame
onAnimationUpdate(deltaTime) {
  const msPerSub = 60000 / bpm / subdivisionsPerBeat;  // Calculated every frame
}

// GOOD - use cached value
onAnimationUpdate(deltaTime) {
  const msPerSub = this.cachedMsPerSubdivision;  // Pre-calculated
}
```

---

## DI Registration

**File:** `src/lib/shared/di/containers/music-container.ts`

```typescript
bind(MUSIC_TYPES.PlaybackTimingCalculator)
  .to(PlaybackTimingCalculator)
  .inSingletonScope();
```

**File:** `src/lib/shared/di/types/music.types.ts`

```typescript
export const MUSIC_TYPES = {
  // ... existing
  PlaybackTimingCalculator: Symbol.for('PlaybackTimingCalculator'),
} as const;
```

---

## Backward Compatibility

### Legacy Sequences (No Duration Data)

- All beats default to `duration: 4`
- Total subdivisions = beats.length * 4
- Playback behavior identical to current

### Legacy currentBeat Property

Keep updating `state.currentBeat` for components that still use it:

```typescript
// After calculating subdivision position
this.state.currentBeat = beatIndex + 1 + progress;
```

---

## File Changes Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `IPlaybackTimingCalculator.ts` | **New** | Timing calculation interface |
| `PlaybackTimingCalculator.ts` | **New** | Timing calculation implementation |
| `AnimationPlaybackController.ts` | **Modify** | Add subdivision-based timeline |
| `BeatCalculator.ts` | **Modify** | Add subdivision awareness |
| `music-container.ts` | **Modify** | Register new service |
| `music.types.ts` | **Modify** | Add new type symbol |

---

## Dependencies

| From Stream 1 (Data Model) | Used For |
|----------------------------|----------|
| `TimeSignature` | Subdivisions per beat |
| `beat.duration` | How long each beat lasts |
| `DEFAULT_TIME_SIGNATURE` | Fallback |

---

## Implementation Order

1. Create `IPlaybackTimingCalculator` interface
2. Implement `PlaybackTimingCalculator`
3. Register in DI container
4. Add `currentSubdivision`, `totalSubdivisions`, `beatTimings` to AnimationPlaybackController state
5. Modify `initializePlayback` to pre-calculate timings
6. Modify `onAnimationUpdate` to use subdivision-based advancement
7. Update `BeatCalculator.calculateBeatState`
8. Update step playback mode
9. Test with variable duration sequences
10. Verify backward compatibility with legacy sequences

---

## Testing Approach

Unit tests for:
- `PlaybackTimingCalculator.getMsPerSubdivision()` - verify math at various BPMs
- `PlaybackTimingCalculator.getBeatAtSubdivision()` - verify correct beat lookup
- `PlaybackTimingCalculator.calculateBeatTimings()` - verify pre-calculation

Integration tests:
- Sequence with uniform durations plays same as before
- Sequence with variable durations plays proportionally
- Loop behavior works with variable durations
- Step playback jumps to correct beat boundaries
