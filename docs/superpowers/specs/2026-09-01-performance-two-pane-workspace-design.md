# Performance Two-Pane Workspace

**Date:** 2026-09-01  
**Status:** Approved for implementation

## Decision

Performance browsing is a normal Sequence Viewer workspace, not a full-body
gallery takeover.

```text
ViewerWorkspacePanels
  -> persistent stage track
       -> motion surface / selected performance
  -> persistent inspector track
       -> motion settings / performance details and picker
```

The stage track keeps the same DOM identity and allocation used by 2D, Stage,
Tunnel, Card, and Side-by-Side. Entering Performances changes the prepared
source inside that track. It does not mount a framed player inside a second
page-sized gallery.

The inspector track keeps the same destination width as Motion settings. On a
wide screen, 2D or Stage can therefore hand off to Performances without moving
the panel seam. From a full-width mode, `PanelGroup` owns the one structural
glide that reveals the inspector.

The video element and the animation canvases remain different renderers. They
share the stage shell and the canonical `DualSourceCrossfade`; they do not gain
a false common rendering abstraction.

## Capability ownership

Search terms used before this decision: `performance video`, `video gallery`,
`selectedVideoId`, `player stage`, `performance list`, `inspector host`,
`DualSourceCrossfade`, and `PanelGroup`.

| Capability                                                                     | Owner                                                              | Relationship                                                      |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------ | ----------------------------------------------------------------- |
| Performance records for one sequence                                           | `shared/video-collaboration/state/sequence-videos-store.svelte.ts` | Reuse unchanged                                                   |
| Performance selection, player registration, upload/map mode, and deletion flow | `sequence-videos/state/performance-workspace-state.svelte.ts`      | Extract from `SequenceVideos` as the one presentation-state owner |
| Moving performance media                                                       | `sequence-videos/PerformanceStage.svelte`                          | New presentation of the selected record                           |
| Metadata, actions, and performance selection                                   | `sequence-videos/PerformanceInspector.svelte`                      | New presentation of the same state                                |
| Upload and timing work                                                         | `sequence-videos/PerformanceEditor.svelte`                         | Compose the existing `VideoUploadFlow` and `StepMapEditor`        |
| Structural allocation                                                          | `ViewerWorkspacePanels.svelte` / `PanelGroup.svelte`               | Reuse unchanged                                                   |
| Stateful stage handoff                                                         | `DualSourceCrossfade.svelte`                                       | Reuse unchanged                                                   |

`SequenceVideos.svelte` remains the public composition for browse-only and test
hosts. It creates the same state owner and composes the extracted stage,
inspector, and editor presentations. No third performance list or second data
store is introduced.

## Browse composition

### Stage

- The selected video occupies the stage directly against its quiet black media
  background. It has no surrounding featured-card border or duplicated title.
- The source aspect ratio is reserved before metadata arrives. Its poster is
  always supplied when available.
- Duration and mapped-playhead badges remain stage overlays and reserve no flow
  geometry.
- Loading, error, and empty states fill the same stage box and describe the
  destination the person selected. The outgoing animation is never presented
  as though it were the Performance view.

### Inspector

- One header names Performances, gives the count, and places Add performance
  beside the collection it changes.
- The selected performance's creator, date, description, and timing status sit
  above the picker.
- Map timing and delete remain attached to the selected record.
- All performances is one scrolling region. The workspace does not create a
  second page scroll.

### Focused work

Upload and step mapping remain focused full-workspace subflows. They are editing
tasks with different space requirements, so the existing full-body takeover is
appropriate there. Returning to browse restores the still-mounted two-pane
workspace and its selection.

## Responsive behavior

Wide layouts use stage left and inspector right. Narrow and mobile layouts use
the same two owners stacked vertically: stage first, inspector second. The
inspector receives a bounded height and owns its list scroll, so the stage never
falls behind an unbounded collection.

No capability is hidden on mobile. Controls remain at least 44 px, essential
text remains at least 14 px, and metadata remains at least 12 px.

## Motion contract

- `PanelGroup` owns changes to the stage/inspector allocation.
- `DualSourceCrossfade` owns the motion-surface/performance-stage handoff.
- The existing persistent inspector layers own the settings/details handoff.
- Both stage and inspector commit from one `viewerMode === "videos"` signal.
- Reduced motion collapses both handoffs to their accessible final state.
- Hidden players pause and surrender the video playhead bridge.

## Verification

The Performance transition gate must prove:

- the outer stage and inspector retain one DOM identity;
- exactly one active performance player exists;
- no blank or double-opaque stage frames;
- the Performance stage is prepared before it is counted as ready;
- no visible inspector rewrap during the handoff;
- stage and inspector travel without backtracking or overshoot;
- rapid 2D / Performance / 3D reversals settle correctly;
- reduced motion has no delayed handoff;
- 375x667, 960x412, 820x1180, 1440x900, 1920x1080, 2560x1440,
  and 3840x2160 retain the same capabilities and readable hierarchy.

Focused unit coverage protects selection after deletion, mapped-playhead
attachment, active-player handoff, and the structural shell contract. Visual
judgment remains in the in-app transition gate.
