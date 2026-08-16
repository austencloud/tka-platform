# Sequence Videos Consolidation

**Date:** 2026-08-16
**Status:** Approved, implementing
**Supersedes the `onMapTiming` bridge added in `82c70cf3bb`.**

## The problem

Performance-video browsing for one sequence had three live implementations and
two dead ones.

| Component | Mounted at | What it showed |
|---|---|---|
| `VideoGallery.svelte` | shell viewer body, `ViewerCompanionSurface` split pane | featured player + performance list, delete, Map timing |
| `VideoPanel.svelte` (`panelState === "gallery"`) | shell sidebar | thumbnail grid, play, delete, Map timing, Add |
| `VideosPanel.svelte` | `SequencePanel` → `SequenceDrawer` (Create module) | its own list plus `VideoUploadSheet` |
| `SequenceVideosSection.svelte` | nothing | — |
| `VideoUploadPanel.svelte` | nothing | — |

Two defects followed directly from the duplication.

**They rendered at the same time.** `viewer-shell-layout-state.svelte.ts` kept
`showVideoGallery` true while `isVideoUploadActive`, deliberately, so that
opening the uploader would not evict the gallery. The result was the same
videos listed twice on one screen, in two visual languages, behind two
different delete confirmations.

**Neither could see the other's writes.** Each component called
`getVideosForSequence(sequence.id)` into its own `$state` with no shared cache.
An upload in the sidebar never reached the body gallery; a delete in one left
the other listing a record that no longer existed.

`never-hand-roll.md` forbids a third parallel implementation of a capability
unless the distinction is recorded. It was not recorded.

## The design

### One component, three views

`VideoGallery.svelte` becomes `SequenceVideos.svelte` and owns the whole
capability. The rename costs two import lines and stops the name from lying
once the file also owns upload and timing.

```
components/sequence-videos/
  SequenceVideos.svelte     routes browse | upload | map
  VideoUploadFlow.svelte    drop zone, preview, progress, save-first
```

| View | Content | Origin |
|---|---|---|
| `browse` | featured player + performance list | `VideoGallery`, unchanged |
| `upload` | save-first card, drop zone, preview, upload progress | `VideoPanel` |
| `map` | `StepMapEditor` at full body width | already built |

Upload is a sibling component rather than an inlined branch. `VideoPanel`'s
upload half is roughly 250 lines of file validation, metadata reads, thumbnail
extraction, and R2 progress; folding it into the gallery would produce a single
900-line file with three unrelated responsibilities. `SequenceVideos` routes and
owns the list; `VideoUploadFlow` handles one file and reports
`onUploaded(video)`.

Props on `SequenceVideos`:

```ts
sequence: SequenceData;
isOwned: boolean;
isLoggedIn?: boolean;
bpm?: number;                              // StepMapEditor needs it; browse does not
canUpload?: boolean;                       // VIDEO_UPLOAD_ENABLED && signed in
onSaveFirst?: () => Promise<void>;
onUploadOpenChange?: (open: boolean) => void;
```

`ViewerCompanionSurface` keeps passing `isOwned={false}` with no callbacks, so
the split-pane companion stays browse-only exactly as it is today.

### The shell stops hosting a second surface

The sidebar branch `{:else if layout.isVideoUploadActive} <VideoPanel/>` is
deleted, along with the `onUpload` and `onMapTiming` props — both are internal
buttons now.

`editingPane === "video-upload"` **stays** as a state signal. It does real work
beyond layout: it pauses playback, blocks the playback controller
(`playback-controller.svelte.ts:188`), and fires an assertive a11y
announcement. It simply stops being a layout instruction.
`onUploadOpenChange` keeps it in sync with the component's view.

Because video-upload no longer occupies the sidebar, the layout derivations
lose their special case:

```ts
const isSidebarExportActive = $derived(
  isAnyExportActive && !isRecordSceneActive && !isVideoUploadActive
);
const showVideoGallery = $derived(
  viewerMode === "videos" && !isSidebarExportActive
);
```

The comment defending the old condition goes with it.

### A shared per-sequence store

`src/lib/shared/video-collaboration/state/sequence-videos-store.svelte.ts` —
the `state/` directory that shipped empty finally earns its name.

```ts
getSequenceVideosStore(sequenceId): {
  videos, loading, error,
  load(), reload(),
  add(video), remove(id), applyStepMap(id, stepMap),
}
```

One reactive instance per sequence id, held in a module-level map bounded to
the 8 most recently used sequences so a long browse session does not retain
every list it has ever opened. Mutations rewrite the cached array, so every
mounted consumer updates from a single write — the stale-list defect that
neither component could fix alone.

Three live consumers justify the owner: `SequenceVideos` in the shell body,
`SequenceVideos` in the companion pane, and `VideosPanel` in the Create
module's sequence drawer.

`VideosPanel` keeps its own presentation. It is a different host with a
different layout and its own `VideoUploadSheet`; only its data comes from the
store. That decision is recorded in `canonical-capabilities.md` so it does not
read as an unrecorded third implementation.

### Deletions

- `components/video-panel/VideoPanel.svelte` — merged away.
- `components/VideoUploadPanel.svelte` — zero references in `src/` or `tests/`.
- `video-collaboration/components/SequenceVideosSection.svelte` — zero
  references; the only two grep hits are a prose comment in `VideosPanel` and a
  literal `<td>SequenceVideosSection</td>` label in the dev demo route.

## Error handling

The store owns load failure. A failed fetch is not an empty gallery: `error`
is distinct from `videos.length === 0`, and the browse view keeps its Try again
control (`reload()`).

Delete keeps the behavior `82c70cf3bb` established — a failed delete leaves the
row in place and surfaces the reason inside the confirmation dialog, rather
than removing a row whose record survived.

Upload failure returns `VideoUploadFlow` to its preview state with the message
attached, as `VideoPanel` did.

## Verification

- Screenshots at 375×667, 960×412, 820×1180, 1440×900, 1920×1080, 2560×1440,
  3840×2160 for each of the three views. This is a structure change, so
  `visual-verification-mandatory.md` applies.
- `npm run check`.
- `tests/unit/sequence-viewer-shell-contract.test.ts` and the
  `viewer-orchestrator-model` suite. The contract test's `CHROME_INTERNALS`
  list does not name `VideoPanel` and asserts only against host files, so the
  merge does not touch it.
- No live upload. That writes to production R2 and Firestore with
  `visibility: "public"`. The flow is driven with the local
  `/debug-recording.mp4` through the existing `test/step-map-editor` harness.
