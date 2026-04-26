---
status: backlog
value: 3
effort: M
remaining: "Beat mapping, synced playback, viewer panel lifecycle"
depends_on: ""
plan_path: ""
tags: []
last_triaged: 2026-04-26
---
# Media Workspace Design Spec

> Depends on: [Beat Mapping](./2026-03-16-beat-mapping-design.md), [Synced Playback](./2026-03-16-synced-playback-design.md)
>
> The sequence viewer becomes a media workspace where animation, notation, and video are first-class panels. The video panel has a lifecycle: save-first, upload, beat mapping, video gallery with synced playback.

---

## Video Panel Lifecycle

The video panel shows different content based on state:

| State | What the user sees |
|-------|--------------------|
| Unsaved sequence | "Save to library first" prompt with Save button |
| Saved, no videos | File picker / upload zone with drag-and-drop |
| Uploading | Progress bar with cancel |
| Has videos, no beat map | Video gallery with "Map Beats" action per video |
| Has videos, with beat map | Video gallery with synced playback indicator. Play starts synced mode. |
| Beat mapping mode | BeatMapEditor replaces the gallery |

Each state is a discrete view rendered by `VideoPanel.svelte`. No intermediate loading states between transitions. The panel checks conditions in order and renders the first match.

---

## Layout Strategy

The video panel is NOT a permanent third column. It appears when the user taps "Video" and replaces the notation card. This is the same swap pattern the export panels already use.

### Why Replace Instead of Add

- Works at all screen sizes without new breakpoints
- Mobile gets the same experience as desktop
- No layout reflow when opening/closing panels
- The choreo card is still accessible via the footer toggle

### Future Enhancement (1440px+)

On large screens, a three-column layout (animation | notation | video) could show all panels simultaneously. That's a separate spec. The initial implementation uses replace/swap only.

---

## Video Discovery

Two indicators tell users a sequence has videos:

### Footer Video Button Badge

The existing Video button in ViewerFooter gets a count badge:

```svelte
{#if isLoggedIn && onVideoUpload}
  <button class="action-btn video" onclick={onVideoUpload}>
    <i class="fas fa-video"></i>
    <span>Video</span>
    {#if videoCount > 0}
      <span class="badge">{videoCount}</span>
    {/if}
  </button>
{/if}
```

Badge styling:

```css
.badge {
  position: absolute;
  top: -4px;
  right: -4px;
  background: var(--theme-accent);
  color: var(--theme-text);
  font-size: var(--font-size-compact, 12px);
  min-width: 18px;
  height: 18px;
  border-radius: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
}
```

### Header Video Indicator

A small camera icon + count near the sequence title. Visible without opening the video panel.

```svelte
{#if videoCount > 0}
  <span class="video-indicator">
    <i class="fas fa-video"></i>
    {videoCount}
  </span>
{/if}
```

---

## Video Gallery

When a sequence has uploaded videos, the panel shows a thumbnail grid:

```
+-----------------------------+
|  Performance Videos (3)     |
|                             |
|  +-----+ +-----+ +-----+   |
|  |thumb| |thumb| |thumb|   |
|  | 1:30| | 0:45| | 2:10|   |
|  |  M  | |     | |  M  |   |  <- M = has beat map
|  +-----+ +-----+ +-----+   |
|                             |
|  [+ Add Video]              |
+-----------------------------+
```

### Thumbnail Cards

Each card shows:

- Video thumbnail (first frame or uploaded poster)
- Duration in bottom-right corner
- Beat map indicator (music note icon) if the video has been mapped
- Tap opens that video for playback

### Gallery Actions

- Tap thumbnail: opens video for playback (with synced choreo if beat-mapped)
- "Map Beats" button on videos without a beat map: enters BeatMapEditor
- "+ Add Video" at the bottom: opens file picker for another upload
- Long-press or swipe (mobile) / hover menu (desktop): delete video

---

## Component Structure

| Component | Path | Responsibility |
|-----------|------|---------------|
| `VideoPanel.svelte` | `src/lib/shared/sequence-viewer/components/video-panel/VideoPanel.svelte` | Lifecycle orchestrator. Renders the correct view based on state. |
| `VideoGallery.svelte` | `src/lib/shared/sequence-viewer/components/video-panel/VideoGallery.svelte` | Grid of video thumbnails with beat map indicators |
| `VideoPlayer.svelte` | `src/lib/shared/sequence-viewer/components/video-panel/VideoPlayer.svelte` | Video playback with timeupdate events for sync |
| `VideoUploadZone.svelte` | `src/lib/shared/sequence-viewer/components/video-panel/VideoUploadZone.svelte` | Drag-and-drop file picker with upload progress |

`BeatMapEditor.svelte` and `BeatMapTimeline.svelte` are defined in the beat mapping spec and rendered by `VideoPanel.svelte` when the user enters mapping mode.

---

## Panel State Machine

`VideoPanel.svelte` derives its view from a few reactive checks:

```typescript
const panelView = $derived.by(() => {
  if (!sequence.isSaved) return "save-first";
  if (isBeatMapping) return "beat-mapping";
  if (isUploading) return "uploading";
  if (activeVideo) return "player";
  if (videos.length > 0) return "gallery";
  return "upload-zone";
});
```

Each view is a separate component rendered with `{#if}` blocks. No dynamic component loading needed since these are small, focused components.

---

## Upload Flow

### File Selection

- Accepts `.mp4`, `.webm`, `.mov`
- Max file size: 500MB (enforced client-side before upload)
- Drag-and-drop zone with visual feedback on dragover

### Upload Progress

- Uses the existing `FirebaseVideoUploader` infrastructure
- Progress bar shows percentage
- Cancel button aborts the upload and cleans up partial files
- On success, transitions to gallery view with the new video visible

### Save-First Guard

If the sequence hasn't been saved to the library yet, the video panel shows a clear prompt:

```
"Save this sequence to your library to add videos."

[Save to Library]
```

The save button triggers the existing library save flow. After save completes, the panel transitions to the upload zone.

---

## Synced Playback Integration

When the user taps a beat-mapped video thumbnail in the gallery:

1. `VideoPanel` renders `VideoPlayer` with the selected video
2. `VideoPlayer` emits `timeupdate` events to the orchestrator via `onVideoTimeUpdate`
3. The orchestrator's `playbackSource` switches to `"video"`
4. Choreo card gold border follows the video's beat position
5. When the user closes the video or navigates away, `playbackSource` reverts to `"animation"`

Videos without beat maps play normally. The choreo card stays on whatever beat the animation is on (or the last manually selected beat).

---

## Mobile Considerations

### Touch Targets

- Gallery thumbnails: minimum 80x80px
- Action buttons: minimum 44px hit area
- "Map Beats" and "+ Add Video" buttons: full-width on mobile

### Panel Transition

On mobile, the video panel slides in as a full-screen overlay (same pattern as other viewer panels). Back button or swipe-down dismisses.

### Upload

Mobile file picker opens the camera roll by default. The `accept` attribute on the file input allows video selection from gallery or camera.

---

## Success Criteria

- Video panel lifecycle works end-to-end: save, upload, gallery, mapping, synced playback
- Video count badge appears on footer when videos exist
- Header shows video indicator
- Gallery displays all videos with beat map status
- Tapping a video opens playback with synced choreo card highlighting
- Works on mobile (overlay) and desktop (replace right pane)
