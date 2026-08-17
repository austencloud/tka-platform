# Video and notation on one playhead

**Date:** 2026-08-16
**Status:** approved, implementing

## What this is for

Austen marked ΩΛ-XJ by hand: 65 timestamps across a 43-second take that runs a
16-move LOOP four times. That map is a measurement, and until now the app threw
it away. The numbers it holds:

| | |
|---|---|
| Pass durations | 10.17s · 10.09s · 10.11s · 10.44s |
| Tempo | 94.4 · 95.1 · 95.0 · 92.0 BPM |
| Mean move | 0.638s |
| Pass-to-pass consistency | 54ms mean per-move deviation |

There is a per-move fingerprint that holds across all four passes: move 15 runs
10% fast and is the tightest of the sixteen (18ms spread), moves 1 and 16 run
7–8% slow — he breathes at the seam — and move 13 carries the widest spread at
89ms. Four independent repetitions agreeing is signal, not noise.

This spec spends the first and most direct part of that: the footage and the
notation share a playhead, so watching one shows you the other.

## What already exists

Almost all of it, which is the point. Nothing here is a new surface.

- `videos` is already a `ContentType`
  (`src/lib/shared/sequence-viewer/services/viewer-state-persistence.ts:3`), so
  `{ leftPane: 'videos', rightPane: 'card' }` already renders the performance
  beside the notation grid.
- `ChoreoCard` in the companion pane already takes
  `highlightedStepIndex={playback.highlightedStepIndex}`
  (`ViewerCompanionSurface.svelte:76`).
- That highlight already prefers video time over animation time when the
  playback source is `"video"`
  (`viewer-playback-presentation-state.svelte.ts:39-56`).
- The orchestrator context already exposes `setPlaybackSource`,
  `setActiveStepMap`, and `onVideoTimeUpdate`
  (`viewer-orchestrator-context.ts:50-54`).
- `getStepIndexFromVideo` already wraps a mark index into a step index, so a
  four-pass map drives the highlight through all four passes.

**Nothing calls any of it.** `SequenceVideos` never hands its selected video's
map to the viewer, and never reports the player's time. The plumbing for
video-driven notation is built and unconnected. That is the whole defect.

## The design

### 1. One owner for the time↔step math

`src/lib/shared/video-collaboration/utils/step-map-utils.ts` owns every
conversion between video time and sequence step. It gains one function:

```ts
seekTimeForStep(
  stepIndex: number,
  currentTime: number,
  stepMap: Pick<StepMap, "beatTimestamps" | "stepCount">
): number | null
```

A take holds each step once per pass, so a step index names several instants.
This returns the one nearest the current playhead — clicking move 13 while
watching pass two lands on 20.26s, not back on 0.86s in pass one. Returns
`null` when the map holds no instance of that step.

That lookup exists today, inlined in
`src/lib/features/video/video-lab/views/SyncedPlaybackView.svelte`. The inline
copy is deleted and calls the shared function. Two consumers, one
implementation, decided before there is a third
(`.claude/rules/never-hand-roll.md`).

### 2. A playhead bridge, set by the shell

`SequenceVideos` renders three prop layers below the shell (shell →
`ViewerSplitPane` → `ViewerCompanionSurface` → `SequenceVideos`) and also
renders outside the viewer entirely — the Create module's `VideosPanel` and
`/test/sequence-videos`. Threading four callbacks down that chain would put
viewer-specific plumbing in every layer between, including the ones that render
outside the viewer.

Instead: a Svelte context, modelled on the existing
`context/viewer-visibility-context.ts`, in
`src/lib/shared/sequence-viewer/context/video-playhead-context.ts`:

```ts
export interface VideoPlayheadBridge {
  /** The performance on screen changed. Null when it has no timing map. */
  attach(map: StepMap | null): void;
  /** The footage moved. */
  reportTime(seconds: number): void;
  /** The player step clicks should drive. Null when none is mounted. */
  registerSeek(seek: ((seconds: number) => void) | null): void;
  /** Drive the footage to a step. False when nothing is attached to drive. */
  seekToStep(stepIndex: number): boolean;
}
```

The shell builds one from `ctx` and sets it. `SequenceVideos` consumes it
through a `tryGet` accessor and does nothing when it is absent, so the Create
module and the test route are unaffected.

### 3. Behaviour

- Selecting a video that has a `beatMap` → `attach(map)` → the viewer's playback
  source becomes `"video"` and the notation grid follows the footage.
- The player's `timeupdate` → `reportTime(t)` → the highlighted step is
  `getStepIndexFromVideo(t, map)`, wrapping through every pass.
- Clicking a pictograph while a mapped video is attached → `seekToStep(i)` →
  the footage jumps to that move **in the pass being watched**. When no mapped
  video is attached, the click falls through to the animation seek exactly as
  it does today.
- Selecting a video with no map, deselecting, or leaving the pane →
  `attach(null)` → source returns to `"animation"`.

### 4. The pass readout

The map knows there are four passes; the viewer should say so. Where the
selected performance's details are shown, a mapped video reads its position as
`move 13 · pass 2`. A single-pass map says `move 13` and nothing more, so
nothing changes for the maps that already exist.

This is the difference between a repeated take being legible and being
confusing — without it, the highlight runs 1→16 four times with no indication
that it went round again.

## Not in this piece

The cross-video letter index — "show me every J from every video." This is its
foundation: `seekTimeForStep` plus one map per video is exactly what a
library-wide query walks. It needs more than one mapped clip before it has
anything to show, so it is a separate piece of work.

Also deliberately out: tempo capture (94 BPM is measurable from this map and
could drive the animation's speed) and practice scoring against a reference
take. Both are real and both are separate.

## Risks

`src/lib/shared/media-composition/domain/sequence-time-map.ts`'s
`fromLegacyStepMap` throws when `beatTimestamps.length !== stepCount`, which
every multi-pass map violates. Grep finds no application call sites — only
`tests/unit/media-composition/*` — and Post Studio is another session's
in-flight work, so this spec does not touch it. If a future surface routes a
multi-pass map through that function it will need the same `% stepCount`
treatment the rest of the read path got.

## Testing

- Unit tests on `seekTimeForStep`: nearest pass wins, ties, first and last
  pass boundaries, single-pass maps unchanged, step absent from the map, empty
  map.
- The existing `tests/unit/sequence-viewer-shell-contract.test.ts` already
  prevents a host forking this — the bridge lives in the shell, so a host
  cannot rebuild it without failing that test.
- Browser verification on `/test/step-map-editor`'s companion route and the
  viewer's split pane with the real OmLam-XJ map: the highlight advances
  through all four passes, and a step click lands in the pass being watched.

## Related

- `.claude/rules/sequence-viewer-shell.md` — the shell owns chrome; hosts stay thin
- `.claude/rules/never-hand-roll.md` — one owner for the time↔step math
- `docs/superpowers/specs/2026-08-16-sequence-videos-consolidation-design.md`
- Commit `ef5e51de22` — multi-pass marking, which produced the map this spends
