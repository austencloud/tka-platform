# Unified Timeline Design

**Date:** 2026-04-24
**Status:** Draft

## Problem

Two separate timelines exist for 2D and 3D viewers with different visuals, different behavior, and a bug: the 3D viewer's scrubber fills 0→100% per beat instead of across the entire sequence.

## Decision

**Approach C: Hybrid — Shared Component + Unified Playback Context**

One `<UnifiedTimeline>` component reads from a `UnifiedPlaybackContext` adapter. Each viewer provides its own adapter implementation. The timeline doesn't know which viewer is active.

**Visual treatment: Glass Pill** — frosted glass, full pill radius, floating feel. Matches the existing 3D viewer's premium aesthetic.

## Architecture

### UnifiedPlaybackContext Interface

```typescript
interface UnifiedPlaybackContext {
  // Read
  overallProgress: number;   // 0–1 across entire sequence
  currentBeat: number;       // 1-based beat index
  totalBeats: number;
  isPlaying: boolean;
  isLooping: boolean;
  duration: number;          // total seconds (or estimate)
  elapsed: number;           // seconds into sequence

  // Write
  seek(progress: number): void;   // 0–1, timeline drags here
  togglePlay(): void;
  toggleLoop(): void;
}
```

### 2D Adapter

Maps existing `AnimatorCanvas` playback state:

- `currentStep` is a float: integer part = beat index (1-based), fractional part = within-beat progress
- `overallProgress = (currentStep - 1) / totalSteps` (currentStep already encodes sub-beat fraction)
- `currentBeat = Math.floor(currentStep)` 
- `totalBeats = sequenceData.steps.length`
- `seek()` maps 0–1 progress back: `targetStep = 1 + progress * totalSteps`
- `duration` / `elapsed` derived from beat timing

### 3D Adapter

Maps `avatar-instance-state` + `playback-state`:

- `overallProgress = (currentStepIndex + avatar.progress) / stepConfigs.length`
- `currentBeat = currentStepIndex + 1`
- `totalBeats = stepConfigs.length`
- `seek()` decomposes: `targetStep = floor(progress * totalSteps)`, step-local progress = fractional part
- `duration` / `elapsed` derived from step durations

This adapter is the fix for the per-beat progress bug. No changes to `avatar-instance-state.svelte.ts` or `playback-state.svelte.ts` — normalization happens at the adapter boundary.

## UnifiedTimeline Component

### Visual Design

Glass pill transport bar:

```
┌─────────────────────────────────────────────────┐
│ (▶)  0:02 / 0:08  ──●────────────────────  (↻) │
└─────────────────────────────────────────────────┘
                    beat 3 of 8
```

- **Play/pause button** — left side, indigo accent (#6366f1), circular
- **Time label** — `elapsed / duration`, tabular-nums, centered
- **Track** — segmented with beat tick markers, indigo fill, white draggable knob
- **Loop toggle** — right side, accent border, toggles looping
- **Context label** — below pill, "beat N of M", subtle text

### Styling

- Background: `rgba(20, 22, 32, 0.78)` with `backdrop-filter: blur(24px) saturate(150%)`
- Border: `1px solid rgba(255,255,255,0.15)`
- Border radius: `999px` (full pill)
- Shadow: `0 8px 32px rgba(0,0,0,0.4)`
- Accent color: `#6366f1` (indigo-500)

### Placement

Inside each viewer, at the bottom edge. Each viewer renders `<UnifiedTimeline>` and provides the adapter context. Component is stateless — reads from context, writes via `seek`/`togglePlay`/`toggleLoop`.

### Interaction

- **Click track**: seek to position
- **Drag knob**: continuous scrub
- **Space**: play/pause
- **Arrow keys**: beat skip (left = previous, right = next)
- **Beat markers**: thin tick lines at each beat boundary

## Integration

### 2D Viewer

- Replaces current `TransportBar` + `SegmentedSequenceProgressBar` stack
- Play button moves from canvas overlay into the pill (canvas overlay button removed)
- `AnimatorCanvas` creates a 2D adapter and passes it to `<UnifiedTimeline>`

### 3D Viewer

- Replaces current `ViewerTransportBar`
- Same glass pill visuals it already has, now with correct overall progress
- 3D scene host creates a 3D adapter and passes it to `<UnifiedTimeline>`

### What Gets Removed

- `TransportBar.svelte` — replaced by `UnifiedTimeline`
- `ViewerTransportBar.svelte` — replaced by `UnifiedTimeline`
- `.canvas-play-btn` overlay in `AnimatorCanvas.svelte` — play button lives in the pill now

### What Gets Kept

- `SegmentedSequenceProgressBar.svelte` — track rendering logic may be reused or absorbed into `UnifiedTimeline`
- `playback-state.svelte.ts` — unchanged, adapter reads from it
- `avatar-instance-state.svelte.ts` — unchanged, adapter reads from it

## Bug Fix: 3D Per-Beat Progress

**Root cause:** `ViewerTransportBar` reads `avatar.progress` directly, which cycles 0→1 per beat via `handleCycleComplete()` resetting it to 0.

**Fix:** The 3D adapter normalizes this:
```typescript
overallProgress = (currentStepIndex + avatar.progress) / stepConfigs.length
```

No changes to the playback engine. The adapter bridges the gap.

## File Structure

```
src/lib/shared/timeline/
  UnifiedTimeline.svelte          # Glass pill transport bar
  unified-playback-context.ts     # Interface definition
  adapters/
    animator-playback-adapter.ts   # 2D adapter
    avatar-playback-adapter.ts     # 3D adapter
```
