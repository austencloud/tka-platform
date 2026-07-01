# Choreo Sheet — Act Playback (design)

**Date:** 2026-07-01
**Status:** approved (design), implementing

## Goal

Play a whole choreo sheet as ONE continuous "act" sequence, in an inline animation
player docked beside the sheet, alongside the existing music player, with BPM as
the shared tempo — so a performer can rehearse the act in time with the track.

## Decisions (locked with Austen 2026-07-01)

- **Surface:** inline player docked to the right of the sheet (page stays visible).
  NOT a full-viewer overlay. Same dock pattern as the add-sequences picker.
- **Music sync v1:** BPM-matched. The animation player owns BPM (its own control);
  the music player plays the track; a single Play starts the animation. True
  zero-drift audio-clock sync (driving frames off `audio.currentTime`) is a
  deferred v2, noted below, not built now.

## Architecture

Three units, each small and independently testable.

### 1. `buildActSequence` — pure concatenation (TDD)

`src/lib/features/write/services/sheet-act-sequence.ts`

```ts
buildActSequence(rows: readonly SequenceData[], name: string): SequenceData | null
```

- Concatenate every row's `steps` in order into one `steps` array.
- Renumber `stepNumber` running 1..N across the whole act.
- Rebuild `word` from the concatenated step letters.
- `startPosition` = row 0's `startPosition`.
- `isCircular` = `loopStatus(rows) === "loops"` (reuse `sheet-continuity`).
- Fresh `id` via `createSequenceData` (which does `crypto.randomUUID()`).
- Return `null` for empty input.

**No orientation/reversal recalculation.** The rows are already normalized (clean
boundaries connect; break boundaries are intentional warnings). Each source
sequence's stored orientations/reversals are already self-consistent; running
`recalculateAllOrientations` would force-propagate across a break and corrupt the
downstream sequence's authored orientations. Literal concatenation preserves what
each sequence was authored to show. This also keeps the function pure and free of
heavy render deps, so it unit-tests trivially.

### 2. Music service completion

`src/lib/features/write/services/music-player.ts` (existing, partial)

The service plays a URL but its `timeupdate`/`loadedmetadata`/`ended` handlers are
empty, and track-loading lived in a now-removed Act parent. Complete it minimally:

- Add listener registration: `onTimeUpdate((currentMs, durationMs) => void)`,
  `onLoadedMetadata((durationMs) => void)`, `onEnded(() => void)`.
- Add `load(url: string, filename: string)` that creates the audio element and
  wires listeners without auto-playing; `play()`/`pause()`/`stop()` operate on the
  loaded element. Keep the existing `play(track)` behavior working.
- Emit through the new callbacks from the (currently empty) handlers.

This is the seam ActPlayer subscribes to in order to keep `MusicPlayerState`
(`isPlaying`, `currentTime`, `duration`, `filename`, `isLoaded`) live for
`MusicPlayer.svelte`.

### 3. `ActPlayer.svelte` — the dock

`src/lib/features/write/components/sheet/ActPlayer.svelte`

- Props: `sequence: SequenceData | null` (the built act), `onClose`.
- Renders `AnimationPlayer` (`$lib/shared/sequence-viewer/components/AnimationPlayer.svelte`)
  with `sequence`, `showControls`, `controlsLevel="full"`, `tapToToggle`,
  `layout="vertical"`. AnimationPlayer owns BPM + transport + progress bar.
- Below it: a "load music" file input (→ object URL → `musicPlayer.load`) and
  `MusicPlayer.svelte` fed a reactive `MusicPlayerState` maintained from the
  service callbacks. Wire its `onPlayRequested`/`onPauseRequested`/`onStopRequested`/
  `onSeekRequested` to the service.
- Empty state when `sequence` is null: "Add sequences to play the act."

### Wiring (`choreo-sheet-state` + `ChoreoSheetView`)

- State: `actSequence = $derived.by(() => buildActSequence(normalizedRows, sheet.name))`.
  Recomputes only on row edits. Expose getter.
- `ChoreoSheetView`: a toolbar **Play act** toggle opens the ActPlayer dock (docked
  column beside the preview, same responsive stacking as the picker dock). Persist
  the open flag in the existing picker-prefs localStorage bag (add `playerOpen`).
- The picker dock and the player dock are mutually exclusive column occupants (open
  one at a time) to keep the page readable.

## Data flow

`normalizedRows → buildActSequence → actSequence → AnimationPlayer` (BPM-driven
animation). Music: `file → objectURL → musicPlayer.load → MusicPlayerState →
MusicPlayer.svelte`. BPM lives in AnimationPlayer; the two transports are
independent in v1.

## Testing

- `buildActSequence`: unit tests (jsdom) — concatenation order, running
  `stepNumber`, rebuilt `word`, `startPosition` from row 0, `isCircular` from loop
  status, `null` on empty, N-sequence concat length.
- ActPlayer / music-service wiring: verified at runtime (build + manual), no browser
  test (per component-test-discipline — grow those on fix, not for a new surface).

## Deferred (v2 — not built now)

Zero-drift audio-clock sync: a shared clock reads `audio.currentTime`, derives the
beat (`currentTime * bpm / 60`), and drives `AnimationPlaybackController.seekToStep`
each frame so the animation never drifts from the music. Touches the animation
timing seam (`animation-playback-controller` speed/loop). Own spec when needed.

## Reuse ledger (never-hand-roll)

- Player: `AnimationPlayer.svelte` (reuse). Progress/transport: its internal
  `SequenceProgressBar` / `HorizontalTransportRow` (reuse).
- Music UI: `MusicPlayer.svelte` (reuse). Music service: `music-player.ts` (extend).
- Continuity: `sheet-continuity.loopStatus` (reuse). Construction:
  `createSequenceData` (reuse). Dock layout: picker-dock pattern (reuse).
- New: only `buildActSequence` (no concat util exists) + `ActPlayer` dock (composes
  the above).
