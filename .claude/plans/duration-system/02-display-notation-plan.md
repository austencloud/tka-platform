# Display & Notation Plan

> Musical Duration System - Stream 2 of 4
> Created: 2026-01-11 | Feedback ID: AYMHIvudhrRC0NWwWcUU

## Executive Summary

This plan defines how musical positions are displayed to users, replacing simple "Beat 1, Beat 2" with musical notation like "1", "2e", "3&", "4a".

---

## Current State Analysis

### Beat Number Display Components

| Component | File | Current Behavior |
|-----------|------|------------------|
| BeatNumber.svelte | `src/lib/shared/pictograph/shared/components/BeatNumber.svelte` | Shows "1", "2", "3" or "Start" |
| BeatCell.svelte | `src/lib/features/create/shared/workspace-panel/sequence-display/components/BeatCell.svelte` | Calculates `displayBeatNumber = beat.beatNumber \|\| index + 1` |
| PictographContainer.svelte | `src/lib/shared/pictograph/shared/components/PictographContainer.svelte` | Extracts beatNumber, passes to renderer |
| MobilePlaybackBeatGrid.svelte | `src/lib/features/compose/tabs/playback/components/MobilePlaybackBeatGrid.svelte` | Shows `{beatNumber}` in corner |

### Current Display Logic

```typescript
// BeatCell.svelte line 43-44
const displayBeatNumber = $derived.by(() => {
  return beat.beatNumber || index + 1;
});

// BeatNumber.svelte - just renders the number
<text>{beatNumber === 0 ? 'Start' : beatNumber}</text>
```

**Problem:** No awareness of subdivisions or musical position.

---

## Proposed Display System

### 1. Musical Position Display Modes

Users should see contextually appropriate notation:

| Mode | When | Example Display |
|------|------|-----------------|
| **Beat Only** | Duration = full beat (4 subs) | "1", "2", "3", "4" |
| **Beat + Start Sub** | Duration < full beat | "2e", "3&", "4a" |
| **Range** | Duration spans multiple subdivisions | "1e-&" or "2-3e" |
| **Compact** | Space constrained (thumbnails) | "2e" |

### 2. Display Format Rules

#### Simple Time (4 subdivisions: 1 e & a)

| Start Sub | Duration | Display |
|-----------|----------|---------|
| 0 (beat 1) | 4 | "1" |
| 0 (beat 1) | 2 | "1-e" |
| 1 (1e) | 2 | "1e-&" |
| 2 (1&) | 1 | "1&" |
| 3 (1a) | 1 | "1a" |
| 4 (beat 2) | 4 | "2" |
| 5 (2e) | 3 | "2e-a" |
| 6 (2&) | 6 | "2&-3e" |

#### Compound Time (3 subdivisions: 1 & a)

| Start Sub | Duration | Display |
|-----------|----------|---------|
| 0 (beat 1) | 3 | "1" |
| 1 (1&) | 2 | "1&-a" |
| 2 (1a) | 1 | "1a" |
| 3 (beat 2) | 3 | "2" |

---

## Component Changes

### 1. BeatNumber.svelte - Major Refactor

**File:** `src/lib/shared/pictograph/shared/components/BeatNumber.svelte`

**Current Props:**
```typescript
beatNumber?: number | null
showBeatNumber?: boolean
isStartPosition?: boolean
```

**New Props:**
```typescript
interface BeatNumberProps {
  // Legacy support (still works for simple sequences)
  beatNumber?: number | null;

  // New musical position props
  musicalPosition?: string;  // Pre-formatted: "2e", "3&-a", etc.
  duration?: number;         // For visual duration indicator

  // Display options
  showBeatNumber?: boolean;
  isStartPosition?: boolean;
  displayMode?: 'full' | 'compact';  // Compact for thumbnails
  hasValidData?: boolean;
  darkMode?: boolean;
}
```

**New Rendering Logic:**
```svelte
<script lang="ts">
  interface Props {
    beatNumber?: number | null;
    musicalPosition?: string;
    duration?: number;
    showBeatNumber?: boolean;
    isStartPosition?: boolean;
    displayMode?: 'full' | 'compact';
    hasValidData?: boolean;
    darkMode?: boolean;
  }

  let {
    beatNumber = null,
    musicalPosition,
    duration,
    showBeatNumber = true,
    isStartPosition = false,
    displayMode = 'full',
    hasValidData = true,
    darkMode,
  }: Props = $props();

  // Use musical position if provided, fall back to beat number
  const displayText = $derived(() => {
    if (isStartPosition) return 'Start';
    if (musicalPosition) return musicalPosition;
    if (beatNumber != null && beatNumber > 0) return String(beatNumber);
    return null;
  });

  // Adjust font size based on text length
  const fontSize = $derived(() => {
    const text = displayText();
    if (!text) return 100;
    if (text.length <= 2) return 100;
    if (text.length <= 4) return 80;
    return 60;  // For ranges like "2&-3e"
  });
</script>

{#if showBeatNumber && displayText() && hasValidData}
  <text
    x="50"
    y="50"
    text-anchor="middle"
    dominant-baseline="central"
    font-family="Georgia, serif"
    font-size={fontSize()}
    font-weight="bold"
    fill={darkMode ? '#ffffff' : '#000000'}
  >
    {displayText()}
  </text>
{/if}
```

### 2. BeatCell.svelte - Add Position Calculation

**File:** `src/lib/features/create/shared/workspace-panel/sequence-display/components/BeatCell.svelte`

**Changes:**
```svelte
<script lang="ts">
  import { getContext } from 'svelte';
  import type { IMusicalPositionCalculator } from '$lib/shared/music/services/contracts/IMusicalPositionCalculator';
  import { MUSIC_TYPES } from '$lib/shared/di/types/music.types';

  interface Props {
    beat: BeatData;
    index: number;
    // ... existing props
  }

  let { beat, index, ...rest }: Props = $props();

  // Get calculator from DI (via context or container)
  const positionCalculator = getContext<IMusicalPositionCalculator>(MUSIC_TYPES.MusicalPositionCalculator);
  const timeSignature = getContext<TimeSignature>('timeSignature') ?? DEFAULT_TIME_SIGNATURE;

  // Calculate musical position for display
  const musicalPosition = $derived.by(() => {
    if (!beat.startSubdivision && beat.startSubdivision !== 0) {
      // Fallback: calculate from index if startSubdivision not set
      const startSub = index * (beat.duration || 4);
      return positionCalculator.formatPositionRange(startSub, beat.duration || 4, timeSignature);
    }
    return positionCalculator.formatPositionRange(beat.startSubdivision, beat.duration, timeSignature);
  });

  // Legacy fallback for simple display
  const displayBeatNumber = $derived.by(() => {
    return beat.beatNumber || index + 1;
  });
</script>

<PictographContainer
  pictographData={beat}
  {musicalPosition}
  beatNumber={displayBeatNumber}
  ...
/>
```

### 3. PictographContainer.svelte - Pass Position Through

**File:** `src/lib/shared/pictograph/shared/components/PictographContainer.svelte`

**Add prop:**
```typescript
interface Props {
  // ... existing
  musicalPosition?: string;
}
```

**Pass to renderer:**
```svelte
<PictographRenderer
  {beatNumber}
  {musicalPosition}
  ...
/>
```

### 4. PictographRenderer.svelte - Pass to BeatNumber

**File:** `src/lib/shared/pictograph/shared/components/PictographRenderer.svelte`

**Add prop and pass through:**
```svelte
<BeatNumber
  {beatNumber}
  {musicalPosition}
  {showBeatNumber}
  ...
/>
```

### 5. MobilePlaybackBeatGrid.svelte - Update Corner Label

**File:** `src/lib/features/compose/tabs/playback/components/MobilePlaybackBeatGrid.svelte`

**Current (line 57):**
```svelte
<span class="beat-number">{beatNumber}</span>
```

**Updated:**
```svelte
<script>
  // Calculate musical position for each beat
  const getMusicalPosition = (beat: BeatData, index: number) => {
    // Use position calculator...
    return positionCalculator.formatPosition(...);
  };
</script>

<span class="beat-number">{getMusicalPosition(beat, index)}</span>
```

---

## New Service: BeatDisplayFormatter

**New File:** `src/lib/shared/music/services/contracts/IBeatDisplayFormatter.ts`

```typescript
/**
 * Formats beat information for display in various contexts.
 * Wraps MusicalPositionCalculator with display-specific logic.
 */
export interface IBeatDisplayFormatter {
  /**
   * Format a beat's position for display.
   * Automatically chooses best format based on duration.
   */
  formatBeatPosition(
    beat: BeatData,
    index: number,
    timeSignature: TimeSignature,
    mode?: 'full' | 'compact'
  ): string;

  /**
   * Format for aria-label (accessibility).
   * "Beat 2, subdivisions e through and"
   */
  formatAccessiblePosition(
    beat: BeatData,
    index: number,
    timeSignature: TimeSignature
  ): string;

  /**
   * Get subdivisions covered by this beat as labels.
   * ["1", "e", "&", "a"] for a full beat
   */
  getSubdivisionLabels(
    startSubdivision: number,
    duration: number,
    timeSignature: TimeSignature
  ): string[];
}
```

**Implementation:** `src/lib/shared/music/services/implementations/BeatDisplayFormatter.ts`

```typescript
@injectable()
export class BeatDisplayFormatter implements IBeatDisplayFormatter {
  constructor(
    @inject(MUSIC_TYPES.MusicalPositionCalculator)
    private positionCalculator: IMusicalPositionCalculator
  ) {}

  formatBeatPosition(
    beat: BeatData,
    index: number,
    timeSignature: TimeSignature,
    mode: 'full' | 'compact' = 'full'
  ): string {
    const startSub = beat.startSubdivision ?? index * (beat.duration || 4);
    const duration = beat.duration || 4;

    // If duration equals one full beat, just show beat number
    if (duration === timeSignature.subdivisionsPerBeat) {
      const pos = this.positionCalculator.calculatePosition(startSub, timeSignature);
      return String(pos.beat);
    }

    // Otherwise show range
    return this.positionCalculator.formatPositionRange(startSub, duration, timeSignature);
  }

  formatAccessiblePosition(
    beat: BeatData,
    index: number,
    timeSignature: TimeSignature
  ): string {
    const startSub = beat.startSubdivision ?? index * (beat.duration || 4);
    const duration = beat.duration || 4;
    const startPos = this.positionCalculator.calculatePosition(startSub, timeSignature);

    if (duration === timeSignature.subdivisionsPerBeat) {
      return `Beat ${startPos.beat}`;
    }

    const endSub = startSub + duration - 1;
    const endPos = this.positionCalculator.calculatePosition(endSub, timeSignature);

    return `Beat ${startPos.beat}, subdivisions ${
      this.getSubdivisionName(startPos.subdivision, timeSignature)
    } through ${
      this.getSubdivisionName(endPos.subdivision, timeSignature)
    }`;
  }

  private getSubdivisionName(subdivision: number, timeSignature: TimeSignature): string {
    const names = {
      1: 'downbeat',
      2: timeSignature.subdivisionType === 'simple' ? 'e' : 'and',
      3: 'and',
      4: 'a',
    };
    return names[subdivision] || String(subdivision);
  }
}
```

---

## Visual Duration Indicator (Optional Enhancement)

For users who want visual feedback on duration length:

### Option A: Width Scaling

In timeline/compose view, pictograph cells could be wider for longer durations:

```css
.beat-cell {
  /* Base width for duration=1 (single subdivision) */
  --base-width: 60px;

  /* Scale width by duration */
  width: calc(var(--base-width) * var(--duration, 4));
}
```

**Consideration:** Only makes sense in timeline views, not grid views.

### Option B: Duration Badge

Small indicator showing duration count:

```svelte
{#if showDurationBadge && beat.duration !== 4}
  <div class="duration-badge">
    {beat.duration}
  </div>
{/if}

<style>
  .duration-badge {
    position: absolute;
    bottom: 4px;
    right: 4px;
    background: var(--theme-accent);
    color: white;
    font-size: 10px;
    padding: 2px 4px;
    border-radius: 4px;
  }
</style>
```

### Option C: Subdivision Dots

Visual dots showing how many subdivisions this beat spans:

```svelte
<div class="subdivision-dots">
  {#each Array(beat.duration) as _, i}
    <span class="dot" class:filled={i < beat.duration}></span>
  {/each}
</div>
```

**Recommendation:** Start with Option A for Compose timeline, Option B as optional badge elsewhere.

---

## Time Signature Display

### Sequence Header

Show time signature in sequence info area:

**File:** `src/lib/features/create/shared/workspace-panel/sequence-display/components/SequenceHeader.svelte` (if exists) or similar

```svelte
{#if sequence.timeSignature}
  <span class="time-signature">
    {sequence.timeSignature.displayLabel ?? '4/4'}
  </span>
{/if}
```

### Settings Integration

Allow users to set time signature per sequence in settings or create panel.

---

## Edge Cases

### 1. Crossing Beat Boundaries

When a pictograph starts mid-beat and continues into next beat:

- Start: subdivision 3 of beat 1 (1&)
- Duration: 3 (spans 1&, 1a, 2)
- Display: "1&-2" or "1& → 2"

### 2. Crossing Measure Boundaries

- Start: subdivision 15 of measure 1 (beat 4, subdivision a)
- Duration: 4 (spans into measure 2)
- Display: "4a-1e" or "[M1]4a-[M2]1e"

**Recommendation:** For simplicity, don't show measure numbers in beat display. Use "4a-1e" format.

### 3. Very Long Durations

Pictograph spanning 16+ subdivisions (full measure+):

- Display: Show start position only with duration indicator
- Example: "1 (16)" or "1 ×4" meaning "starts at 1, lasts 4 beats"

### 4. Legacy Sequences (No Duration Data)

- Default duration: 4 (one beat)
- Display falls back to simple beat numbers: "1", "2", "3"
- Seamless upgrade path

---

## File Changes Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `BeatNumber.svelte` | **Modify** | Add musicalPosition prop, dynamic font sizing |
| `BeatCell.svelte` | **Modify** | Calculate and pass musical position |
| `PictographContainer.svelte` | **Modify** | Pass musicalPosition through |
| `PictographRenderer.svelte` | **Modify** | Pass musicalPosition to BeatNumber |
| `MobilePlaybackBeatGrid.svelte` | **Modify** | Use formatted position |
| `IBeatDisplayFormatter.ts` | **New** | Display formatting service interface |
| `BeatDisplayFormatter.ts` | **New** | Display formatting implementation |

---

## Dependencies

| From Stream 1 (Data Model) | Used For |
|----------------------------|----------|
| `TimeSignature` type | Calculating subdivisions per beat |
| `MusicalPosition` type | Position representation |
| `IMusicalPositionCalculator` | Core position math |
| `SUBDIVISION_LABELS` | Display labels ("e", "&", "a") |
| `beat.startSubdivision` | Where beat starts |
| `beat.duration` | How many subdivisions |

---

## Implementation Order

1. **Wait for Stream 1** - Need MusicalPositionCalculator
2. Create `IBeatDisplayFormatter` interface
3. Implement `BeatDisplayFormatter`
4. Register in DI container
5. Update `BeatNumber.svelte` props and rendering
6. Update `BeatCell.svelte` to calculate position
7. Update `PictographContainer.svelte` to pass through
8. Update `PictographRenderer.svelte` to pass through
9. Update `MobilePlaybackBeatGrid.svelte`
10. Add accessibility labels
11. (Optional) Add visual duration indicators

---

## Accessibility Considerations

- All musical positions must have full aria-labels: "Beat 2, starting at e, lasting 2 subdivisions"
- Screen readers should announce position changes during playback
- Color is not sole indicator of position (use text)
- Position text meets contrast requirements (handled by existing dark mode logic)
