# Timeline Editor

DAW-style timeline for composing animation sequences with audio synchronization.

## Architecture Overview

```
timeline/
├── components/           # UI Components
│   ├── inspector/        # Clip property editor panels
│   │   └── inspector-styles.css  # Shared styles for inspector sections
│   ├── clip-interactions/  # Extracted drag handlers
│   ├── TimelinePanel.svelte      # Main container
│   ├── TimelineClip.svelte       # Individual clip on track
│   ├── TimelineControls.svelte   # Transport buttons (play/pause/etc)
│   ├── TimelineAudioTrack.svelte # WaveSurfer waveform display
│   └── ClipInspector.svelte      # Property editor sidebar
├── domain/
│   └── timeline-types.ts   # Types + factory functions
├── services/
│   ├── SnapService.ts            # Pure snap calculation logic
│   ├── TimelinePlaybackEngine.ts # Pure playback loop logic
│   ├── contracts/                # Service interfaces
│   └── implementations/          # Inversify DI wrappers
└── state/
    ├── timeline-state.svelte.ts  # Core Svelte 5 state (runes)
    ├── timeline-storage.ts       # localStorage helpers
    └── actions/                  # Extracted state mutations
```

## Key Concepts

### Clips vs Sequences

- **Sequence**: Source animation data (beats, pictographs, metadata)
- **Clip**: An instance of a sequence placed on the timeline with:
  - Start time
  - Duration
  - Playback rate (speed)
  - Trim points (in/out)
  - Loop settings
  - Visual settings (color, opacity, rotation)

### Tracks

- Clips are organized into tracks (like video editing)
- Each track can be muted/soloed
- Tracks can be reordered

### Time System

- All time values are in **seconds** (floating point)
- `TimeSeconds` type alias for clarity
- Frame rates (24/30/60) only matter for export

### Snapping

Two-layer architecture:

1. `SnapService.ts` - Pure functions for snap calculations
2. `TimelineSnapService.ts` - DI-injectable service wrapper

Snap targets:

- Beat markers (from audio BPM)
- Clip edges (start/end of other clips)
- Grid intervals
- Playhead position

### Playback

Two-layer architecture:

1. `TimelinePlaybackEngine.ts` - RAF loop, audio sync logic
2. `TimelinePlaybackService.ts` - DI-injectable service wrapper

Features:

- Shuttle control (J/K/L keys for variable speed)
- Loop regions
- Audio synchronization via WaveSurfer

## State Management

Uses Svelte 5 runes pattern:

```typescript
// Singleton access
import { getTimelineState } from "./state/timeline-state.svelte";

const state = getTimelineState();
state.addClip(sequence, trackId, startTime);
state.play();
state.selectClip(clipId);
```

State is organized into action modules:

- `playhead-actions.ts` - Transport controls
- `selection-actions.ts` - Clip selection
- `viewport-actions.ts` - Zoom/scroll
- `ui-state-actions.ts` - Inspector/settings panels

## Adding New Features

### New Inspector Section

1. Create `inspector/ClipXxxSection.svelte`
2. Import shared styles: `@import './inspector-styles.css';`
3. Add component-specific styles only
4. Add to `ClipInspector.svelte`

### New Clip Interaction

1. Create `clip-interactions/createClipXxx.ts`
2. Follow existing pattern with context callbacks
3. Import in `TimelineClip.svelte`

### New State Mutations

1. Add to appropriate action module in `state/actions/`
2. Wire up in `timeline-state.svelte.ts` factory function
3. Export via spread operator in return object
