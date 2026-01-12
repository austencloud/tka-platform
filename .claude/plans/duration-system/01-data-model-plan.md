# Data Model & Core Domain Plan

> Musical Duration System - Stream 1 of 4
> Created: 2026-01-11 | Feedback ID: AYMHIvudhrRC0NWwWcUU

## Executive Summary

This plan defines the foundational data structures for a musical subdivision system that enables pictographs to span any number of musical subdivisions, with full time signature support.

---

## Current State Analysis

### Existing Duration in BeatData

**File:** `src/lib/features/create/shared/domain/models/BeatData.ts`

```typescript
interface BeatData extends PictographData {
  readonly duration: number;  // Currently float, default 1.0, unused
  // ... other properties
}
```

**Issues:**
- `duration` exists but means nothing (always 1.0)
- No time signature concept
- No subdivision system

### Existing Sequence Structure

**File:** `src/lib/shared/foundation/domain/models/SequenceData.ts`

```typescript
interface SequenceData {
  readonly beats: readonly BeatData[];
  // No time signature
  // No tempo metadata
}
```

---

## Proposed Data Model

### 1. Time Signature Type

**New File:** `src/lib/shared/music/domain/models/TimeSignature.ts`

```typescript
/**
 * Musical time signature defining beats per measure and subdivision feel.
 *
 * Examples:
 * - 4/4 simple: { beatsPerMeasure: 4, subdivisionType: 'simple', subdivisionsPerBeat: 4 }
 * - 3/4 simple: { beatsPerMeasure: 3, subdivisionType: 'simple', subdivisionsPerBeat: 4 }
 * - 6/8 compound: { beatsPerMeasure: 2, subdivisionType: 'compound', subdivisionsPerBeat: 3 }
 * - Triplet feel: { beatsPerMeasure: 4, subdivisionType: 'triplet', subdivisionsPerBeat: 3 }
 */
export interface TimeSignature {
  /** Beats per measure (top number in traditional notation) */
  readonly beatsPerMeasure: number;

  /** Type of subdivision feel */
  readonly subdivisionType: SubdivisionType;

  /** Number of subdivisions per beat (4 for "1 e & a", 3 for triplets) */
  readonly subdivisionsPerBeat: number;

  /** Optional display label (e.g., "4/4", "6/8") */
  readonly displayLabel?: string;
}

export type SubdivisionType = 'simple' | 'compound' | 'triplet' | 'custom';

/** Common time signature presets */
export const TIME_SIGNATURE_PRESETS = {
  '4/4': { beatsPerMeasure: 4, subdivisionType: 'simple', subdivisionsPerBeat: 4, displayLabel: '4/4' },
  '3/4': { beatsPerMeasure: 3, subdivisionType: 'simple', subdivisionsPerBeat: 4, displayLabel: '3/4' },
  '2/4': { beatsPerMeasure: 2, subdivisionType: 'simple', subdivisionsPerBeat: 4, displayLabel: '2/4' },
  '6/8': { beatsPerMeasure: 2, subdivisionType: 'compound', subdivisionsPerBeat: 3, displayLabel: '6/8' },
  '9/8': { beatsPerMeasure: 3, subdivisionType: 'compound', subdivisionsPerBeat: 3, displayLabel: '9/8' },
  '12/8': { beatsPerMeasure: 4, subdivisionType: 'compound', subdivisionsPerBeat: 3, displayLabel: '12/8' },
  'triplet': { beatsPerMeasure: 4, subdivisionType: 'triplet', subdivisionsPerBeat: 3, displayLabel: 'Triplet' },
} as const satisfies Record<string, TimeSignature>;

export const DEFAULT_TIME_SIGNATURE: TimeSignature = TIME_SIGNATURE_PRESETS['4/4'];
```

### 2. Musical Position Type

**New File:** `src/lib/shared/music/domain/models/MusicalPosition.ts`

```typescript
/**
 * A specific position within the musical timeline.
 * Measured in subdivisions from the start of the sequence.
 */
export interface MusicalPosition {
  /** Measure number (1-indexed) */
  readonly measure: number;

  /** Beat within the measure (1-indexed) */
  readonly beat: number;

  /** Subdivision within the beat (1-indexed, 1-4 for simple, 1-3 for compound) */
  readonly subdivision: number;

  /** Absolute subdivision index from sequence start (0-indexed) */
  readonly absoluteSubdivision: number;
}

/**
 * Subdivision labels for display.
 * Simple time (4 subdivisions): 1, e, &, a
 * Compound time (3 subdivisions): 1, &, a
 */
export const SUBDIVISION_LABELS = {
  simple: ['1', 'e', '&', 'a'] as const,
  compound: ['1', '&', 'a'] as const,
  triplet: ['1', '&', 'a'] as const,
} as const;
```

### 3. Updated BeatData

**File:** `src/lib/features/create/shared/domain/models/BeatData.ts`

```typescript
interface BeatData extends PictographData {
  readonly isBeat?: true;
  readonly beatNumber: number;

  /**
   * Duration in subdivisions (not beats, not seconds).
   * - Default: 4 (one full beat in simple time)
   * - Minimum: 1 (single subdivision)
   * - No maximum (can span multiple beats/measures)
   *
   * Examples in 4/4 simple time:
   * - duration: 4 → spans "1 e & a" (one beat)
   * - duration: 1 → spans single subdivision
   * - duration: 6 → spans "1 e & a 2 e" (1.5 beats)
   */
  readonly duration: number;  // BREAKING: semantics change from float to int

  /**
   * Starting position in the sequence (subdivision index, 0-indexed).
   * Calculated by summing durations of all previous beats.
   * Used for musical position display and playback timing.
   */
  readonly startSubdivision?: number;

  // ... existing properties unchanged
  readonly blueReversal: boolean;
  readonly redReversal: boolean;
  readonly isBlank: boolean;
  readonly isSelected?: boolean;
}
```

### 4. Updated SequenceData

**File:** `src/lib/shared/foundation/domain/models/SequenceData.ts`

```typescript
interface SequenceData {
  // ... existing properties

  /**
   * Time signature for this sequence.
   * Determines subdivision count per beat and beat count per measure.
   * Default: 4/4 simple time (4 beats per measure, 4 subdivisions per beat)
   */
  readonly timeSignature?: TimeSignature;

  /**
   * Total duration of sequence in subdivisions.
   * Calculated as sum of all beat durations.
   * Used for playback timing and display.
   */
  readonly totalSubdivisions?: number;
}
```

### 5. Duration Constants

**New File:** `src/lib/shared/music/domain/constants/duration-constants.ts`

```typescript
/** Default duration for new beats (one full beat = 4 subdivisions in simple time) */
export const DEFAULT_BEAT_DURATION = 4;

/** Minimum duration (single subdivision) */
export const MIN_DURATION = 1;

/** Duration validation */
export function isValidDuration(duration: number): boolean {
  return Number.isInteger(duration) && duration >= MIN_DURATION;
}

/** Common duration presets for quick selection */
export const DURATION_PRESETS = {
  // Simple time (4 subdivisions per beat)
  simple: {
    full: 4,      // "1 e & a"
    half: 2,      // "1 e" or "& a"
    quarter: 1,   // single subdivision
    dotted: 6,    // "1 e & a 2 e" (1.5 beats)
    double: 8,    // two beats
  },
  // Compound time (3 subdivisions per beat)
  compound: {
    full: 3,      // "1 & a"
    half: 2,      // approximately (round as needed)
    quarter: 1,   // single subdivision
    dotted: 4,    // 1.33 beats
    double: 6,    // two beats
  },
} as const;
```

---

## New Services

### 1. MusicalPositionCalculator

**New File:** `src/lib/shared/music/services/contracts/IMusicalPositionCalculator.ts`

```typescript
export interface IMusicalPositionCalculator {
  /**
   * Calculate the musical position for a beat given its start subdivision.
   */
  calculatePosition(
    startSubdivision: number,
    timeSignature: TimeSignature
  ): MusicalPosition;

  /**
   * Format a musical position for display.
   * Examples: "1", "2e", "3&", "4a", "2e&" (for spans)
   */
  formatPosition(
    position: MusicalPosition,
    timeSignature: TimeSignature
  ): string;

  /**
   * Format a position range for display (when duration > 1).
   * Example: "1e-&" for a pictograph spanning subdivisions 2-3 of beat 1
   */
  formatPositionRange(
    startSubdivision: number,
    duration: number,
    timeSignature: TimeSignature
  ): string;

  /**
   * Calculate the absolute subdivision from measure, beat, subdivision.
   */
  toAbsoluteSubdivision(
    measure: number,
    beat: number,
    subdivision: number,
    timeSignature: TimeSignature
  ): number;
}
```

**Implementation:** `src/lib/shared/music/services/implementations/MusicalPositionCalculator.ts`

```typescript
@injectable()
export class MusicalPositionCalculator implements IMusicalPositionCalculator {
  calculatePosition(startSubdivision: number, timeSignature: TimeSignature): MusicalPosition {
    const subdivisionsPerMeasure =
      timeSignature.beatsPerMeasure * timeSignature.subdivisionsPerBeat;

    const measure = Math.floor(startSubdivision / subdivisionsPerMeasure) + 1;
    const subdivisionInMeasure = startSubdivision % subdivisionsPerMeasure;
    const beat = Math.floor(subdivisionInMeasure / timeSignature.subdivisionsPerBeat) + 1;
    const subdivision = (subdivisionInMeasure % timeSignature.subdivisionsPerBeat) + 1;

    return {
      measure,
      beat,
      subdivision,
      absoluteSubdivision: startSubdivision,
    };
  }

  formatPosition(position: MusicalPosition, timeSignature: TimeSignature): string {
    const labels = SUBDIVISION_LABELS[timeSignature.subdivisionType] ?? SUBDIVISION_LABELS.simple;
    const subdivisionLabel = labels[position.subdivision - 1] ?? '';

    // If on downbeat, just show beat number
    if (position.subdivision === 1) {
      return `${position.beat}`;
    }

    // Otherwise show beat + subdivision: "2e", "3&", "4a"
    return `${position.beat}${subdivisionLabel}`;
  }

  // ... other methods
}
```

### 2. SequenceDurationCalculator

**New File:** `src/lib/shared/music/services/contracts/ISequenceDurationCalculator.ts`

```typescript
export interface ISequenceDurationCalculator {
  /**
   * Calculate total subdivisions for a sequence.
   */
  calculateTotalSubdivisions(beats: readonly BeatData[]): number;

  /**
   * Calculate start subdivision for each beat.
   * Returns a map of beat index to start subdivision.
   */
  calculateBeatStartSubdivisions(beats: readonly BeatData[]): Map<number, number>;

  /**
   * Convert total subdivisions to formatted time (measures:beats:subdivisions).
   */
  formatTotalDuration(
    totalSubdivisions: number,
    timeSignature: TimeSignature
  ): string;
}
```

---

## DI Registration

**File:** `src/lib/shared/di/containers/music-container.ts` (NEW)

```typescript
import { ContainerModule } from 'inversify';
import { MUSIC_TYPES } from '../types/music.types';
import { MusicalPositionCalculator } from '../../music/services/implementations/MusicalPositionCalculator';
import { SequenceDurationCalculator } from '../../music/services/implementations/SequenceDurationCalculator';

export const musicModule = new ContainerModule((bind) => {
  bind(MUSIC_TYPES.MusicalPositionCalculator)
    .to(MusicalPositionCalculator)
    .inSingletonScope();

  bind(MUSIC_TYPES.SequenceDurationCalculator)
    .to(SequenceDurationCalculator)
    .inSingletonScope();
});
```

**File:** `src/lib/shared/di/types/music.types.ts` (NEW)

```typescript
export const MUSIC_TYPES = {
  MusicalPositionCalculator: Symbol.for('MusicalPositionCalculator'),
  SequenceDurationCalculator: Symbol.for('SequenceDurationCalculator'),
} as const;
```

---

## Migration Strategy

### Phase 1: Backward Compatible Addition

1. Add `timeSignature` to SequenceData as optional (default: 4/4)
2. Add `startSubdivision` to BeatData as optional (calculated on-the-fly if missing)
3. Keep existing `duration: number` property but change semantics:
   - Old: float 1.0 (ignored)
   - New: integer subdivision count (default 4)

### Phase 2: Migration Script

For existing sequences in Firestore:
```typescript
// All beats without explicit duration get duration: 4 (one beat)
// This maintains exact same playback behavior as before
if (beat.duration === 1.0 || beat.duration === undefined) {
  beat.duration = 4;  // 4 subdivisions = 1 beat
}
```

### Phase 3: Validation

**Update:** `src/lib/features/create/shared/domain/factories/createBeatData.ts`

```typescript
export function createBeatData(
  pictographData: PictographData,
  beatNumber: number,
  options?: {
    duration?: number;  // Now integer subdivisions, default 4
    blueReversal?: boolean;
    redReversal?: boolean;
    isBlank?: boolean;
  }
): BeatData {
  const duration = options?.duration ?? DEFAULT_BEAT_DURATION;

  if (!isValidDuration(duration)) {
    throw new Error(`Invalid duration: ${duration}. Must be positive integer.`);
  }

  return {
    ...pictographData,
    isBeat: true,
    beatNumber,
    duration,
    blueReversal: options?.blueReversal ?? false,
    redReversal: options?.redReversal ?? false,
    isBlank: options?.isBlank ?? false,
  };
}
```

---

## File Structure

```
src/lib/shared/music/
├── domain/
│   ├── models/
│   │   ├── TimeSignature.ts
│   │   └── MusicalPosition.ts
│   └── constants/
│       └── duration-constants.ts
├── services/
│   ├── contracts/
│   │   ├── IMusicalPositionCalculator.ts
│   │   └── ISequenceDurationCalculator.ts
│   └── implementations/
│       ├── MusicalPositionCalculator.ts
│       └── SequenceDurationCalculator.ts
└── index.ts  (NO - avoid barrel exports)
```

---

## Dependencies on Other Streams

| Stream | What This Stream Provides | What This Stream Needs |
|--------|---------------------------|------------------------|
| Display (Stream 2) | MusicalPositionCalculator.formatPosition() | Nothing |
| Playback (Stream 3) | TimeSignature, duration, SequenceDurationCalculator | Nothing |
| UX (Stream 4) | Duration constants, validation | Nothing |

**This stream has NO dependencies and must be implemented first.**

---

## Implementation Order

1. Create `TimeSignature` type and presets
2. Create `MusicalPosition` type
3. Create duration constants
4. Implement `MusicalPositionCalculator`
5. Implement `SequenceDurationCalculator`
6. Register in DI container
7. Update `BeatData` interface
8. Update `SequenceData` interface
9. Update `createBeatData` factory
10. Write migration script for existing data

---

## Testing Approach

Unit tests for:
- `MusicalPositionCalculator.calculatePosition()` - verify measure/beat/subdivision math
- `MusicalPositionCalculator.formatPosition()` - verify "1", "2e", "3&" formatting
- `SequenceDurationCalculator.calculateTotalSubdivisions()` - verify sum
- Duration validation
- Time signature presets

These are pure calculation services - perfect for unit testing per `testing.md` philosophy.
