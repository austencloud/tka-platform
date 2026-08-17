# Post Studio Reads a Multi-Pass Take

Date: 2026-08-16
Status: approved
Follows: `2026-08-16-video-notation-shared-playhead-design.md`

## The problem

Post Studio can already build the post Austen asked for. A post is two stacked
slots (`post-studio-slots.ts`), Performance and Choreo card are both source
roles, and the card already follows the footage through a real time map rather
than a synthetic clock: `evaluatePresetFrame` turns media time into a
*fractional* sequence position and hands that one value to the card highlight,
the animation layer, and the animation clock at once.

What it cannot do is read the take he just marked.

`migrateLegacyStepMap` throws unless `beatTimestamps.length === stepCount`
(`sequence-time-map.ts:267`). The ΩΛ-XJ take is 64 marks against a stepCount of
16 — the same clip performed four times through. The throw is caught in
`createCatalogPerformanceSelection` and degraded to
`"Saved map needs repair · even timing preview"`, which spreads 16 moves evenly
across 43 seconds. The card drifts out of sync within a second and nothing on
screen says why.

Multi-pass marking shipped in `cb561ce21c`. Post Studio's time map predates it.
This closes that gap.

## Decisions

**The post is the whole take, and the card loops.** Four passes of a LOOP word
is the thing the footage is *of*; trimming to one pass throws away 33 of 43
seconds and hides the repetition that makes it a LOOP. (Austen, 2026-08-16.)

**Positions stay strictly increasing.** `SequenceTimeMapSchema` requires it and
the interpolator binary-searches on it. Pass 2's move 1 is sequence position 17,
pass 3's is 33. The wrap happens downstream, not in the data.

**Post Studio boots into performance-over-card** when the sequence has a mapped
performance, and stays on animation-over-card when it does not.

## The change

### 1. `migrateLegacyStepMap` accepts a whole number of passes

`beatTimestamps.length` may be any positive multiple of `stepCount`. Anchors run
1..N over the marks; the closing anchor is N+1. Everything else about the
function is unchanged, and a single-pass map produces byte-identical output.

The closing anchor also gets better: the function currently infers the end of
the last move from the median interval, because the old editor had no end mark.
`StepMap.endTimestamp` is a real recorded arrival — use it when it lies after
the last mark, and keep the median inference as the fallback.

### 2. One wrap, at the source

`step-calculator.ts` already owns this arithmetic (`displayedBeatNumber`,
`clampDisplayedBeatNumber`), so the wrap goes there rather than into a second
owner:

```ts
wrapSequencePosition(position, beatsPerPass, totalBeats): number
```

- `position <= 0` → `0` (the start pose)
- `position >= totalBeats + 1` → `beatsPerPass + 1` (the end hold)
- otherwise → `((position - 1) % beatsPerPass) + 1`, fraction preserved

`evaluatePresetFrame` applies it once, to the continuous position, before
anything derives from it. That is deliberate: wrapping the *position* rather
than the beat number means the card highlight, `sequencePositionToAnimationTime`,
and the animation layer all cycle from one correction instead of three. When
`totalBeats === beatsPerPass` the function is the identity, so single-pass
behaviour is untouched.

`totalBeats` is read off the time map's last anchor, so no schema field is added
and maps already saved to Firestore need no migration.

### 3. Boot layout follows the footage

`PostStudio` currently boots `DEFAULT_POST_LAYOUT` (animation over card)
unconditionally. When a mapped performance resolves for this sequence, the top
slot boots to it via `withSlotSource(normalizePresetToSlots(...), "top",
"performance")` — the existing verb, not new geometry code.

The performance also has to be *found*. Today `PostStudio` calls
`getVideosForSequence` into local state behind a
`sequence.performanceVideoUrl` guard, which `canonical-capabilities.md`
explicitly forbids: a video uploaded or mapped in the viewer never reaches an
open Post Studio, and a sequence with videos but no linked URL never looks. It
moves to the shared per-sequence store, the same instance the viewer writes to.

## Out of scope

- The cross-video letter index. Still the stage after this one.
- Any change to `SequenceTimeMapSchema`, the exporter, or the frame compositor.
- Per-pass trimming in the picker. Rejected above; revisit only if a real post
  wants it.

## Verification

- Unit tests over the real 64-mark ΩΛ-XJ timestamps: the map parses, anchor
  count is 65, positions are strictly increasing, and media time 17.09s resolves
  to move 1 of pass 2 rather than move 17 of nothing.
- `wrapSequencePosition` is the identity for a single-pass map.
- Post Studio screenshotted at the seven viewports in
  `visual-verification-mandatory.md`, with the card observed advancing through
  all four passes rather than freezing on move 16.
