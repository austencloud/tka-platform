# Create Module UX Plan

> Musical Duration System - Stream 4 of 4
> Created: 2026-01-11 | Feedback ID: AYMHIvudhrRC0NWwWcUU

## Executive Summary

This plan defines how users intuitively adjust pictograph duration in the Create module without dropdown menus or complex UI, maintaining the app's modern feel.

---

## Design Constraints

From user requirements:
- **NO dropdown menus** - feels old school
- **NO Compose module complexity** - should be quick and intuitive
- **Minimal new UI components** - avoid visual overhead
- **Modern interaction patterns** - match app's existing UX quality

---

## Proposed UX Patterns

### Option A: Swipe/Drag Duration (Recommended)

**Interaction:** Long-press a beat, then drag horizontally to adjust duration.

```
┌─────────────┐
│     1e      │  ← Beat showing current position
│   ┌─────┐   │
│   │     │   │  ← Pictograph
│   └─────┘   │
│  ◀──────▶   │  ← Drag handles appear on long-press
│   duration  │
└─────────────┘
```

**How it works:**
1. User long-presses a beat (300ms)
2. Beat enters "duration edit mode" with visual feedback
3. Drag handles appear on left/right edges
4. Drag right to increase duration, left to decrease
5. Live preview shows musical notation updating ("1" → "1e" → "1e&")
6. Release to confirm
7. Subsequent beats automatically shift

**Pros:**
- Gesture-based, modern feel
- No new UI chrome when not editing
- Intuitive (longer swipe = longer duration)
- Works on touch and mouse

**Cons:**
- Requires discovery (first-time hint needed)
- May conflict with other gestures

### Option B: Tap-to-Cycle Quick Presets

**Interaction:** Tap the beat number/position to cycle through common durations.

```
Tap "1" → cycles through: 4 → 2 → 1 → 6 → 8 → 4
                          (full) (half) (quarter) (dotted) (double)
```

**How it works:**
1. Tap on the beat position indicator (e.g., "1", "2e")
2. Duration cycles to next preset
3. Visual/haptic feedback on each tap
4. Long-press opens full duration picker if needed

**Pros:**
- Zero new UI
- Very fast for common cases
- Discoverable via position indicator

**Cons:**
- Limited to presets (can't set arbitrary values like 5 or 7)
- May be confusing without feedback

### Option C: Inline Duration Stepper

**Interaction:** Small +/- controls appear when beat is selected.

```
┌─────────────┐
│  [−] 4 [+]  │  ← Duration stepper (only when selected)
│   ┌─────┐   │
│   │     │   │
│   └─────┘   │
│      1      │
└─────────────┘
```

**How it works:**
1. Select a beat (existing selection behavior)
2. Duration stepper appears above beat
3. Tap +/- to increment/decrement by 1 subdivision
4. Current duration shown as number
5. Deselect to hide stepper

**Pros:**
- Precise control (any value)
- Familiar pattern
- Non-destructive to existing UI

**Cons:**
- More UI chrome
- Slower than gesture for large changes

### Option D: Radial Menu (on Long-Press)

**Interaction:** Long-press reveals radial menu with duration options.

```
        [2]
    [1]     [4]
        ●
    [6]     [8]
       [12]
```

**How it works:**
1. Long-press beat center
2. Radial menu appears with common durations
3. Drag to desired option
4. Release to select

**Pros:**
- Quick access to presets
- Visually distinctive
- Touch-friendly

**Cons:**
- Takes screen space
- May feel gimmicky
- Limited to presets

---

## Recommended Approach: Hybrid A + C

Combine **Swipe/Drag** for quick adjustments with **Inline Stepper** for precision:

### Primary: Drag Duration

1. Long-press any beat → enters duration mode
2. Drag left/right to adjust
3. Snaps to subdivision boundaries
4. Shows live feedback: "1e&" → "1e" → "1"

### Secondary: Stepper for Precision

1. When beat is selected, tap the position indicator
2. Popover with +/- stepper appears
3. Fine-tune exact subdivision count
4. Close by tapping elsewhere

### First-Time Discovery

On first use, show subtle tooltip:
> "Long-press and drag to adjust timing"

Store in localStorage to show only once.

---

## Component Design

### DurationEditMode Component

**New File:** `src/lib/features/create/shared/components/DurationEditMode.svelte`

```svelte
<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  interface Props {
    beat: BeatData;
    timeSignature: TimeSignature;
    onDurationChange: (newDuration: number) => void;
  }

  let { beat, timeSignature, onDurationChange }: Props = $props();

  let isDragging = $state(false);
  let dragStartX = $state(0);
  let originalDuration = $state(beat.duration);

  const PIXELS_PER_SUBDIVISION = 20;  // Drag 20px = 1 subdivision

  function handleDragStart(e: PointerEvent) {
    isDragging = true;
    dragStartX = e.clientX;
    originalDuration = beat.duration;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function handleDrag(e: PointerEvent) {
    if (!isDragging) return;

    const deltaX = e.clientX - dragStartX;
    const subdivisionDelta = Math.round(deltaX / PIXELS_PER_SUBDIVISION);
    const newDuration = Math.max(1, originalDuration + subdivisionDelta);

    onDurationChange(newDuration);
  }

  function handleDragEnd() {
    isDragging = false;
  }
</script>

<div
  class="duration-edit-overlay"
  class:dragging={isDragging}
  onpointerdown={handleDragStart}
  onpointermove={handleDrag}
  onpointerup={handleDragEnd}
>
  <div class="drag-handle left">◀</div>
  <div class="duration-value">{beat.duration}</div>
  <div class="drag-handle right">▶</div>
</div>

<style>
  .duration-edit-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: rgba(0, 0, 0, 0.6);
    border-radius: var(--radius-md);
    cursor: ew-resize;
    touch-action: none;
  }

  .drag-handle {
    padding: 8px;
    color: var(--theme-accent);
    font-size: 20px;
  }

  .duration-value {
    font-size: 24px;
    font-weight: bold;
    color: white;
  }

  .dragging {
    background: rgba(var(--theme-accent-rgb), 0.3);
  }
</style>
```

### DurationStepper Component

**New File:** `src/lib/features/create/shared/components/DurationStepper.svelte`

```svelte
<script lang="ts">
  interface Props {
    duration: number;
    min?: number;
    max?: number;
    onChange: (value: number) => void;
  }

  let { duration, min = 1, max = 32, onChange }: Props = $props();

  function increment() {
    if (duration < max) onChange(duration + 1);
  }

  function decrement() {
    if (duration > min) onChange(duration - 1);
  }
</script>

<div class="duration-stepper">
  <button
    class="stepper-btn"
    onclick={decrement}
    disabled={duration <= min}
    aria-label="Decrease duration"
  >
    −
  </button>
  <span class="duration-display">{duration}</span>
  <button
    class="stepper-btn"
    onclick={increment}
    disabled={duration >= max}
    aria-label="Increase duration"
  >
    +
  </button>
</div>

<style>
  .duration-stepper {
    display: flex;
    align-items: center;
    gap: 8px;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: var(--radius-md);
    padding: 4px 8px;
  }

  .stepper-btn {
    width: 32px;
    height: 32px;
    border: none;
    background: var(--theme-accent);
    color: white;
    border-radius: 50%;
    font-size: 18px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .stepper-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .duration-display {
    min-width: 24px;
    text-align: center;
    font-weight: bold;
  }
</style>
```

---

## BeatCell Integration

**File:** `src/lib/features/create/shared/workspace-panel/sequence-display/components/BeatCell.svelte`

### Add Long-Press Detection

```svelte
<script lang="ts">
  import { DurationEditMode } from '../DurationEditMode.svelte';

  let isEditingDuration = $state(false);
  let longPressTimer: ReturnType<typeof setTimeout> | null = null;

  function handlePointerDown(e: PointerEvent) {
    longPressTimer = setTimeout(() => {
      isEditingDuration = true;
      // Haptic feedback if available
      navigator.vibrate?.(50);
    }, 300);
  }

  function handlePointerUp() {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  }

  function handleDurationChange(newDuration: number) {
    beatOperator.updateBeatDuration(beat.beatNumber, newDuration);
  }

  function exitDurationEdit() {
    isEditingDuration = false;
  }
</script>

<div
  class="beat-cell"
  onpointerdown={handlePointerDown}
  onpointerup={handlePointerUp}
  onpointerleave={handlePointerUp}
>
  <PictographContainer ... />

  {#if isEditingDuration}
    <DurationEditMode
      {beat}
      {timeSignature}
      onDurationChange={handleDurationChange}
    />
    <button class="done-btn" onclick={exitDurationEdit}>Done</button>
  {/if}
</div>
```

---

## BeatOperator Extension

**File:** `src/lib/features/create/shared/services/implementations/BeatOperator.ts`

### Add Duration Update Method

```typescript
export class BeatOperator implements IBeatOperator {
  // ... existing methods

  /**
   * Update the duration of a specific beat.
   * Recalculates startSubdivision for all subsequent beats.
   */
  async updateBeatDuration(beatNumber: number, newDuration: number): Promise<void> {
    if (newDuration < 1) {
      throw new Error('Duration must be at least 1 subdivision');
    }

    const sequence = this.sequenceState.sequence;
    if (!sequence) return;

    // Find the beat
    const beatIndex = sequence.beats.findIndex(b => b.beatNumber === beatNumber);
    if (beatIndex === -1) return;

    // Create updated beat
    const updatedBeat: BeatData = {
      ...sequence.beats[beatIndex],
      duration: newDuration,
    };

    // Recalculate all startSubdivisions
    const updatedBeats = [...sequence.beats];
    updatedBeats[beatIndex] = updatedBeat;

    let currentSubdivision = 0;
    for (let i = 0; i < updatedBeats.length; i++) {
      updatedBeats[i] = {
        ...updatedBeats[i],
        startSubdivision: currentSubdivision,
      };
      currentSubdivision += updatedBeats[i].duration || 4;
    }

    // Update sequence
    await this.updateSequence({
      ...sequence,
      beats: updatedBeats,
      totalSubdivisions: currentSubdivision,
    });
  }
}
```

### Add to Interface

**File:** `src/lib/features/create/shared/services/contracts/IBeatOperator.ts`

```typescript
export interface IBeatOperator {
  // ... existing methods

  /**
   * Update the duration of a beat in subdivisions.
   */
  updateBeatDuration(beatNumber: number, newDuration: number): Promise<void>;
}
```

---

## Time Signature Selection

### Where to Set Time Signature

**Option 1:** Sequence Settings Panel
- Add to existing settings alongside grid mode, prop type, etc.
- Good for initial setup

**Option 2:** Create Module Header
- Quick access toggle/dropdown
- Good for mid-sequence changes

**Recommendation:** Add to Sequence Settings with common presets.

### TimeSignatureSelector Component

**New File:** `src/lib/features/create/shared/components/TimeSignatureSelector.svelte`

```svelte
<script lang="ts">
  import { TIME_SIGNATURE_PRESETS, type TimeSignature } from '$lib/shared/music/domain/models/TimeSignature';

  interface Props {
    value: TimeSignature;
    onChange: (value: TimeSignature) => void;
  }

  let { value, onChange }: Props = $props();

  const presets = Object.entries(TIME_SIGNATURE_PRESETS);
</script>

<div class="time-signature-selector">
  <label>Time Signature</label>
  <div class="preset-chips">
    {#each presets as [key, preset]}
      <button
        class="preset-chip"
        class:selected={value.displayLabel === preset.displayLabel}
        onclick={() => onChange(preset)}
      >
        {preset.displayLabel}
      </button>
    {/each}
  </div>
</div>

<style>
  .time-signature-selector {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .preset-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .preset-chip {
    padding: 8px 16px;
    border: 1px solid var(--theme-stroke);
    border-radius: var(--radius-md);
    background: var(--theme-card-bg);
    color: var(--theme-text);
    cursor: pointer;
  }

  .preset-chip.selected {
    background: var(--theme-accent);
    border-color: var(--theme-accent);
    color: white;
  }
</style>
```

---

## First-Time User Guidance

### Discovery Tooltip

Show once when user first enters Create module after duration feature is added:

```svelte
{#if showDurationHint}
  <div class="duration-hint">
    <span>Long-press any beat to adjust its timing</span>
    <button onclick={() => dismissHint()}>Got it</button>
  </div>
{/if}
```

### Persist Dismissal

```typescript
const DURATION_HINT_KEY = 'tka_duration_hint_dismissed';

function dismissHint() {
  localStorage.setItem(DURATION_HINT_KEY, 'true');
  showDurationHint = false;
}

const showDurationHint = !localStorage.getItem(DURATION_HINT_KEY);
```

---

## Accessibility

### Keyboard Support

When beat is focused:
- `D` - Enter duration edit mode
- `←` / `→` - Decrease/increase duration by 1
- `Shift + ←` / `Shift + →` - Decrease/increase by 4 (one beat)
- `Escape` - Exit duration edit mode

### Screen Reader Announcements

```svelte
<div aria-live="polite" class="sr-only">
  {#if isEditingDuration}
    Duration editing mode. Current duration: {beat.duration} subdivisions.
    Use left and right arrows to adjust.
  {/if}
</div>
```

---

## File Changes Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `DurationEditMode.svelte` | **New** | Drag-to-adjust overlay |
| `DurationStepper.svelte` | **New** | Precision +/- controls |
| `TimeSignatureSelector.svelte` | **New** | Time signature chip picker |
| `BeatCell.svelte` | **Modify** | Add long-press detection |
| `BeatOperator.ts` | **Modify** | Add updateBeatDuration method |
| `IBeatOperator.ts` | **Modify** | Add interface method |

---

## Dependencies

| From Other Streams | Used For |
|--------------------|----------|
| Stream 1: `TimeSignature` | Time signature presets |
| Stream 1: Duration on BeatData | Storing duration value |
| Stream 2: Position display | Showing updated notation |
| Stream 3: Playback | Respecting new durations |

---

## Implementation Order

1. Create `DurationStepper` component
2. Create `DurationEditMode` component
3. Create `TimeSignatureSelector` component
4. Add `updateBeatDuration` to BeatOperator
5. Integrate long-press detection in BeatCell
6. Add time signature to sequence settings
7. Add first-time discovery hint
8. Add keyboard accessibility
9. Test on mobile and desktop
10. Polish animations and feedback

---

## Future Enhancements

- **Visual duration indicator**: Width scaling in timeline view
- **Batch duration editing**: Select multiple beats, set same duration
- **Duration templates**: Save common patterns (e.g., "syncopated", "swing")
- **Audio click track**: Hear subdivisions while editing
- **Import from audio**: Detect BPM and suggest durations
