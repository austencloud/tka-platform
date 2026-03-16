# Beat Mapping Design Spec

> Foundation layer for the media workspace. Lets users annotate video timestamps to individual beats in a sequence.

---

## Data Model

A `BeatMap` is stored as a field on `CollaborativeVideo` in Firestore (`videos/{videoId}`):

```typescript
interface BeatMap {
  /** One timestamp per beat. beatTimestamps[0] = when beat 1 starts in seconds. */
  beatTimestamps: number[];
  /** Total beats expected (matches sequence step count). */
  beatCount: number;
  /** How this map was created. */
  source: "manual" | "auto-detected" | "hybrid";
  /** When the mapping was last edited. */
  updatedAt: Date;
}
```

Added to the existing `CollaborativeVideo` interface:

```typescript
readonly beatMap?: BeatMap;
```

No new Firestore collection needed. The beat map lives on the video document.

---

## Persistence

New method on `ICollaborativeVideoManager`:

```typescript
updateBeatMap(videoId: string, beatMap: BeatMap): Promise<void>
```

Stores the beat map directly on the video document. Reads come back with the existing video load path.

---

## Annotation UI: BeatMapEditor

Lives in the video panel area of the sequence viewer. The flow:

1. Video plays at the top with native `<video>` controls
2. Below: a timeline strip showing video duration as a horizontal bar
3. Beat markers shown as vertical lines on the timeline
4. Two interaction modes:
   - **Tap-to-place**: Video plays, user taps "Mark Beat" button at each beat transition. Markers placed sequentially.
   - **Drag-to-adjust**: After initial placement, drag markers left/right to fine-tune.
5. Real-time choreo card highlighting follows current markers for immediate feedback
6. Save button persists the beatMap

---

## Auto-Detection Bootstrap

Two starting points offered when entering the editor:

- **Even spacing**: Divide video duration by beat count. Gives a reasonable starting grid that the user can adjust.
- **Start from scratch**: No markers, user places each one manually by tapping during playback.

Even spacing uses the sequence's step count as the beat count. No BPM detection or audio analysis required for v1.

---

## Component Structure

| Component | Path | Responsibility |
|-----------|------|---------------|
| `BeatMapEditor.svelte` | `src/lib/shared/sequence-viewer/components/beat-mapping/BeatMapEditor.svelte` | Full annotation UI: video + timeline + controls |
| `BeatMapTimeline.svelte` | `src/lib/shared/sequence-viewer/components/beat-mapping/BeatMapTimeline.svelte` | Horizontal timeline bar with draggable markers |
| `IBeatMapPersister` | `src/lib/shared/video-collaboration/services/contracts/IBeatMapPersister.ts` | Save/load beat maps |
| `BeatMapPersister` | `src/lib/shared/video-collaboration/services/implementations/BeatMapPersister.ts` | Firestore implementation |

---

## Key Function

Maps video playback position to the active beat index:

```typescript
function getHighlightedBeatFromVideo(
  currentTime: number,
  beatTimestamps: number[]
): number {
  for (let i = beatTimestamps.length - 1; i >= 0; i--) {
    if (currentTime >= beatTimestamps[i]) return i;
  }
  return -1;
}
```

Walks backwards through timestamps. Returns the index of the last beat whose timestamp has been reached. Returns -1 if playback hasn't reached the first beat yet.

---

## Timeline Interaction Details

### Tap-to-Place Mode

- User presses play on the video
- A "Mark Beat" button pulses with a visual cue
- Each tap records `videoElement.currentTime` as the next beat timestamp
- Beat counter shows progress: "Beat 3 of 8"
- After all beats are placed, switches to drag-to-adjust mode automatically

### Drag-to-Adjust Mode

- Each marker is a vertical line on the timeline strip
- Markers are touch-draggable (min 44px hit target)
- Dragging snaps to 0.05s increments for precision without jitter
- Video seeks to the marker position during drag for visual feedback
- Markers cannot cross each other (beat 3 can't be before beat 2)

### Timeline Rendering

- Timeline width fills the container
- Beat markers use `--theme-accent` color
- Current playback position shown as a thin white line
- Played region has a subtle fill: `var(--theme-accent)` at 15% opacity

---

## Success Criteria

- User can upload a video and map beats to it manually
- Beat markers are draggable on the timeline
- Choreo card highlights follow markers in real-time during video playback
- Beat map persists to Firestore and loads on next view
- Even-spacing bootstrap provides a reasonable starting point
