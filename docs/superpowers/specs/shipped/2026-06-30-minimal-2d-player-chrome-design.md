---
status: active
value: 3
effort: M
remaining: "Body status: Active"
depends_on: ""
plan_path: ""
tags: []
last_triaged: 2026-07-25
---
# Minimal 2D Player Chrome — Design

**Date:** 2026-06-30
**Status:** Active
**Topic:** Replace the viewer's 2D-animation transport (round play button + `UnifiedTimeline` scrubber) with tap-canvas-to-play/pause + a thin, seekable progress line, on every surface and size.

## Problem

The 2D animation pane in the sequence viewer shows the full `UnifiedTimeline`
transport (a round play/pause button + a scrubber pill) anchored under the
canvas on desktop/landscape. Portrait mobile already hides it and uses
tap-to-play + a *relocated* `UnifiedTimeline` scrubber bar. The direction is a
single minimal chrome everywhere: the canvas is the hero, you tap it to
play/pause, and a thin straight line (the one used elsewhere) gives position +
seek control. The round button and the heavy scrubber should be gone.

Austen (2026-06-30): *"the little play pause button at the bottom and the
scrubber bar is not present and instead we rely on clicking on the canvas itself
to play and pause it while using the minimalist little scrubber which is just
like a straight line ... that gives them control over where they are in the
sequence."*

## Decisions (locked)

- **Scope:** the whole viewer's 2D animation pane — Side-by-Side, 2D Animation
  mode, and Download Animation — at every size (desktop AND mobile). This also
  retires the portrait-mobile relocated transport bar.
- **Seek:** the thin line is seekable (drag/click to scrub), not display-only.
- **3D animation pane is out of scope** and unchanged.

## Existing primitives (reuse, do not rebuild)

- `AnimatorCanvas` already has `tapToToggle` (tap body → play/pause + flash icon,
  `:102`) and `progressLine` (render the thin `SequenceProgressBar` instead of
  `UnifiedTimeline`, `:103`). Proven together in `PlayWithItInner.svelte`
  (`tapToToggle={true}` + `progressLine={true}`).
- `SequenceProgressBar` is the thin (3px) line — **display-only today**.
- Seek path already plumbed end-to-end: `onProgressBarSeek` /
  `onProgressBarScrubStart` / `onProgressBarScrubEnd` flow
  SequenceViewerDrawerHost → ViewerSplitPane → AnimatorCanvas → playback adapter.
  `UnifiedTimeline` already uses it; the thin line will reuse the same path.
- `suppressProgress` (set only by the QR landing `q/[code]` split view) hides
  transport — must keep being respected.

## Changes

### 1. `SequenceProgressBar.svelte` — add opt-in seek (backward compatible)

New optional props: `onSeek?: (ratio: number) => void`, `onScrubStart?: () =>
void`, `onScrubEnd?: () => void`.

- **When `onSeek` is provided:** the container becomes interactive —
  `role="slider"` with `aria-valuenow/min/max`, pointer `down`/`move`/`up`/
  `cancel` with pointer-capture, keyboard `←`/`→` (step) + `Home`/`End`, and a
  knob shown on hover/scrub. The visible track stays 3px; the interactive hit
  area grows to ≥20px tall via transparent padding so it is easy to grab. Pointer
  behaviour mirrors `UnifiedTimeline` (pause on grab, resume on release via the
  scrub-start/end callbacks). `onSeek` reports a 0–1 ratio across the full
  sequence.
- **When `onSeek` is absent:** unchanged display-only `role="progressbar"`.
  Landing / endless-spinner / any current consumer keeps today's behaviour.

### 2. `AnimatorCanvas.svelte` — wire seek into the `progressLine` branch

In the `{#if progressLine}` block, pass the existing
`onProgressBarSeek`/`onProgressBarScrubStart`/`onProgressBarScrubEnd` to
`SequenceProgressBar`'s new `onSeek`/`onScrubStart`/`onScrubEnd`, converting the
0–1 ratio to the target step using the same convention the `UnifiedTimeline`
playback adapter uses. No new plumbing — these props already arrive.

### 3. `ViewerSplitPane.svelte` — minimal chrome for the 2D pane, every size

- For the 2D animation `AnimatorCanvas`: `tapToToggle={true}` and
  `progressLine={true}` always (no longer gated on `showMobileTransport`).
- `hideProgressBar={suppressProgress}` (QR-landing split still bare); keep
  `hideHeader={showMobileTransport}` (portrait still reclaims the word-header).
- Remove the relocated `.mobile-transport-bar` block and `mobileTransportAdapter`
  (the thin line now covers mobile). Keep the `showMobileTransport` derived only
  for `hideHeader`.
- Result: one transport everywhere — tap = play/pause, thin line = position +
  seek.

### Untouched

- `UnifiedTimeline` is NOT deleted — it stays the default for `AnimatorCanvas`
  consumers that don't set `progressLine` (3D pane, standalone `AnimationPlayer`,
  test pages).
- 3D animation pane, landing players, endless-spinner: unchanged (opt-in seek,
  `progressLine` only set in the viewer 2D pane).

## Verification

DevTools sweep across Side-by-Side, 2D Animation, and Download Animation, at
desktop and mobile widths:
1. No round play button anywhere in the 2D pane.
2. Tap on the canvas toggles play/pause (flash icon appears).
3. Dragging / clicking the thin line seeks; playback resumes after release if it
   was playing.
4. `q/[code]` split view (suppressProgress) still shows no transport line.
5. Word-header still hidden on portrait (space reclaimed).

## Risks / notes

- Only genuinely new interactive code is the seek handler on
  `SequenceProgressBar`, copied from `UnifiedTimeline`'s proven pointer logic.
- Backward-compat hinges on `onSeek` being optional — display-only consumers must
  pass nothing and keep `role="progressbar"`.
