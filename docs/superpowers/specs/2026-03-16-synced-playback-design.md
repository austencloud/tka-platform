# Synced Playback Design Spec

> Depends on: [Beat Mapping](./2026-03-16-beat-mapping-design.md)
>
> Once a video has a beat map, the choreo card's gold border follows the video's playback position instead of the animation's BPM clock. The notation tracks the actual performance.

---

## Playback Modes

The orchestrator gains a concept of "playback source":

```typescript
type PlaybackSource = "animation" | "video";
```

- **animation** (default): The existing BPM-driven playback. ChoreoCard highlights follow `currentStepLocal` from the animation controller.
- **video**: A video element's `currentTime` drives the highlight via the beat map. The animation can optionally play alongside, synced to the same beat boundaries.

---

## How It Works

1. When a video with a beat map is playing in the video panel, the orchestrator switches to "video" playback source
2. A `$effect` watches the video element's `timeupdate` events
3. On each update, `getHighlightedBeatFromVideo(currentTime, beatMap.beatTimestamps)` produces the current beat index
4. This beat index drives `highlightedStepIndex` on the choreo card
5. The gold border follows the video performance

The switch happens automatically when the user starts playing a beat-mapped video. When the video pauses or the user navigates away from the video panel, the source reverts to "animation".

---

## Orchestrator Changes

Add to `OrchestratorContext`:

```typescript
playbackSource: PlaybackSource;
videoPlaybackBeatIndex: number | null;
setPlaybackSource: (source: PlaybackSource) => void;
onVideoTimeUpdate: (currentTime: number) => void;
activeBeatMap: BeatMap | null;
setActiveBeatMap: (beatMap: BeatMap | null) => void;
```

The existing `highlightedStepIndex` derived value checks `playbackSource`:

- If `"animation"`: use existing logic (`currentStepLocal`)
- If `"video"`: use `videoPlaybackBeatIndex`

This is the only branching point. Everything downstream (ChoreoCard gold border, beat display) already consumes `highlightedStepIndex` and doesn't care where it came from.

---

## Video Time Tracking

`timeupdate` events fire roughly every 250ms in most browsers. That's sufficient for beat transitions in flow arts videos (beats typically last 500ms+). No `requestAnimationFrame` polling needed for v1.

If jitter becomes noticeable at fast tempos, a future enhancement can use `requestAnimationFrame` with `video.currentTime` reads for smoother tracking.

### Debounce Strategy

The `onVideoTimeUpdate` callback runs the beat lookup and only updates `videoPlaybackBeatIndex` when the beat actually changes. This avoids re-renders on every timeupdate event when the user is still within the same beat.

```typescript
onVideoTimeUpdate(currentTime: number) {
  const beatIndex = getHighlightedBeatFromVideo(currentTime, activeBeatMap.beatTimestamps);
  if (beatIndex !== videoPlaybackBeatIndex) {
    videoPlaybackBeatIndex = beatIndex;
  }
}
```

---

## Animation Sync (Optional Enhancement)

When in "video" playback mode, the animation canvas can optionally sync to the video's beat position instead of its own BPM clock. The animation plays at the same variable tempo as the performance.

Implementation: when `videoPlaybackBeatIndex` changes, seek the animation to the corresponding beat position. This means the animation steps forward (or backward) to match the video.

This is not required for v1. The core value is choreo card highlighting following the video. Animation sync is a polish layer.

---

## Component Changes

| Component | Change |
|-----------|--------|
| `SequenceViewerOrchestrator.svelte` | Add `playbackSource` state, `videoPlaybackBeatIndex`, beat map integration |
| `ViewerSplitPane.svelte` | Pass video-driven beat index when `playbackSource` is `"video"` |
| `ChoreoCard.svelte` | No changes needed. Already accepts `highlightedStepIndex`. |

### State Factory Addition

The viewer's state factory gets new fields:

```typescript
function createViewerState(/* existing deps */) {
  let playbackSource = $state<PlaybackSource>("animation");
  let videoPlaybackBeatIndex = $state<number | null>(null);
  let activeBeatMap = $state<BeatMap | null>(null);

  const highlightedStepIndex = $derived(
    playbackSource === "video" && videoPlaybackBeatIndex !== null
      ? videoPlaybackBeatIndex
      : currentStepLocal
  );

  return {
    get playbackSource() { return playbackSource; },
    get highlightedStepIndex() { return highlightedStepIndex; },
    get activeBeatMap() { return activeBeatMap; },
    setPlaybackSource(source: PlaybackSource) { playbackSource = source; },
    setActiveBeatMap(beatMap: BeatMap | null) { activeBeatMap = beatMap; },
    onVideoTimeUpdate(currentTime: number) {
      if (!activeBeatMap) return;
      const idx = getHighlightedBeatFromVideo(currentTime, activeBeatMap.beatTimestamps);
      if (idx !== videoPlaybackBeatIndex) videoPlaybackBeatIndex = idx;
    },
  };
}
```

---

## Viewer Contexts: Drawer and Route

Synced playback works in both sequence viewer contexts:

- **Drawer viewer** (browse gallery, library): Video panel replaces the choreo card in the drawer content area
- **Route viewer** (`/sequence/:id`): Video panel replaces the right pane

Both contexts share the same orchestrator state factory, so the playback source logic is identical.

---

## Success Criteria

- When a beat-mapped video plays, the choreo card gold border follows the video
- Switching between animation and video playback sources is seamless
- Beat transitions are smooth (no jitter from timeupdate granularity)
- Works in both drawer and route viewer
