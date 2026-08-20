---
status: shipped
value: 5
effort: S
remaining: ""
depends_on: ""
plan_path: ""
tags: [browse, performances, sequence-viewer, video]
last_triaged: 2026-08-20
---

# Performance Intent Handoff

## Problem

Browse can now distinguish sequences that have public performances from those
that do not, but opening either result drops the reason for browsing. The
sequence viewer returns to its normal default instead of carrying the person
into the existing performance surface.

That creates a broken journey:

```text
Browse by performances -> choose a sequence -> ordinary sequence view
```

The expected journey is:

```text
Browse by performances -> choose a sequence -> watch or contribute
```

## Decision

An active Performances availability filter is navigation intent. Opening any
result while that filter is active starts the canonical sequence viewer on its
performance surface.

- **Has public performances** opens the existing player and performance list.
- **No public performances yet** opens the same surface, whose empty state
  offers the existing upload path.
- Removing the Performances filter restores the viewer's ordinary default.
- Additional filters do not erase the performance intent.

The surface is named **Performances**, not Videos. Video is the file format;
performance is the thing a person chose to browse and contribute.

## Capability ownership

Search terms: `performance video`, `video gallery`, `initialViewMode`,
`view-detail`, `upload performance`, `BrowseFilterType.PERFORMANCE_AVAILABILITY`.

| Capability                             | Owner                                                                     | Relationship                                                                             |
| -------------------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Viewer destination and initial surface | `shared/sequence-viewer/services/sequence-viewer-navigator.ts`            | Extend the existing full-surface `initialViewerMode` contract through overlay navigation |
| Browse result navigation               | `features/browse/shared/services/browse-event-handler.ts`                 | Extend with performance-filter intent                                                    |
| Performance browsing and contribution  | `shared/sequence-viewer/components/sequence-videos/SequenceVideos.svelte` | Reuse; revise user-facing terminology only                                               |
| Viewer mode catalog                    | `shared/sequence-viewer/services/viewer-modes.ts`                         | Rename the existing mode label                                                           |

No new player, gallery, uploader, or video state is introduced.

## Scope

1. Resolve an initial viewer mode from the active Browse filters.
2. Pass `initialViewerMode: "videos"` only when a Performances availability rule
   is active.
3. Rename the viewer mode and canonical surface copy to Performances.
4. Make the zero-result action read as contributing the sequence rather than
   managing a media file.
5. Add a focused test for both performance choices, mixed filters, and the
   ordinary no-performance-filter path.

## Acceptance

- [x] Both Performances choices open the sequence viewer on Performances.
- [x] Other Browse filters continue to open the normal viewer default.
- [x] Stacking another rule with Performances keeps the intent.
- [x] The viewer mode is labeled Performances everywhere its canonical option
      is rendered.
- [x] The empty state says there are no performances and offers to perform the
      sequence through the existing uploader.
- [x] Focused tests, TypeScript/Svelte diagnostics, build, and required
      responsive screenshots pass.
