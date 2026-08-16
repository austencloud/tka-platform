# Step Map Editor — Tap The Pictograph

Date: 2026-08-16
Status: approved, in build

## The problem

Marking a performance video's timing is a core collaborative feature and nobody
can work out how to do it by looking at it. Measured on the current editor at
1920×1080 and 375×667:

- Letters render in `system-ui` — `Ψ`, `Ω`, `Σ` in the OS font, next to an app
  that owns a glyph cache and `TKAWordGlyph`. It is the tell that nothing has
  touched this surface in a long time.
- The video is a 400px square in the corner; a 1200px timeline takes the wide
  half. The thing you watch is the smallest element on screen.
- The timeline pins (1…16) and the step strip chips (1 C, 2 Ψ…) are two parallel
  rows of the same sixteen things, and the strip is a horizontal scroller, so
  the moves you have not marked yet are off screen.
- It opens showing **16/16 in green**, because it pre-fills even spacing. It
  looks finished before you have done anything, and entering marking mode then
  drops it to 0/16.
- "Mark moves" — the entire point of the screen — is a grey chip beside
  "Even spacing".
- No playback rate control. No frame stepping; prev/next jump between markers.
- On a phone the intro copy and progress pill fill the top half, and the mark
  button, timeline, and Save are all below the fold.

Austen (2026-08-16): *"I have no idea how to mark the timing and I want this to
feel intuitive… if I don't know how to do it when I first look at it how am I
going to count on any of my audience members to?"*

## The interaction

**You tap the pictograph.**

The button's face is the move happening right now, rendered as a real
pictograph with its letter in the TKA glyph. You watch the performer, you see
that shape land, you hit the button. It advances to the next one. That is the
whole interaction, and it needs no instructions: it is visual matching, not
counting.

Slow motion is what makes the match findable. Rate defaults to **0.5×** while
marking, with 0.25× and 1× a tap away.

### What a tap means

Every tap is the identical action — *the props arrived at that shape*. A
16-step sequence takes **17 taps**:

| Tap | Button face | The moment |
|---|---|---|
| 0 | `startPosition` pictograph | they are set in the opening pose |
| 1…16 | `steps[i-1]` pictograph | they finish move *i* |

Rejected: tapping *launches* (what the code stores today) — the first tap is
the hardest one to feel and the rest land off the beat a person naturally hits.
Rejected: 16 arrival taps with the first launch extrapolated — one value in
every map would be a guess rather than something the user marked.

### The format stays additive

`beatTimestamps[i]` already means "when step *i*+1 starts", and the arrival of
move *i* **is** the launch of move *i*+1 — the positions chain. So the 17 taps
`a[0…16]` map straight onto the existing array:

```
beatTimestamps = a[0…15]      // unchanged meaning, unchanged length
endTimestamp   = a[16]        // new, optional
```

`getHighlightedBeatFromVideo`, synced playback, and Post Studio keep reading
exactly what they read now. Existing 16-entry maps load unchanged; they simply
have no `endTimestamp`. No migration.

`endTimestamp` also gives synced playback a real end, which it has never had —
today the last step runs to the end of the file.

## The surface

Three stacked zones, one column, video-first:

1. **Stage** — the video, full width of the surface, capped so it never pushes
   the button below the fold. Aspect ratio reserved from
   `videoWidth/videoHeight` on `loadedmetadata` (already correct today; keep).
2. **Mark bar** — rate `SegmentedControl` (0.25× / 0.5× / 1×), then the big
   pictograph button, then Undo. The button carries the pictograph, the TKA
   glyph, and `Tap when this lands` / `3 of 17`.
3. **Timeline** — one object, not two. The pins carry the glyphs, so the
   separate step strip disappears. Selecting a pin scrubs the video to it and
   the stage overlays that pictograph, so nudging is verifiable. `±1 frame`
   buttons and arrow keys nudge the selected mark.

Opening state tells the truth. No timing yet → the mark bar is the screen and
progress reads `0 of 17`. Even spacing becomes an explicit
`Start from even spacing` shortcut, not a pre-fill that masquerades as done.
Re-timing an existing map opens on the timeline with its marks intact.

Phone: stage and mark bar both above the fold; the timeline is the second
screen. The intro paragraph goes — the button explains itself.

## Consistency pass

- Every letter through the glyph cache. No `system-ui` Greek anywhere on this
  surface. Words through `simplifyRepeatedWord` per `simplified-word-display.md`.
- Rate control is `SegmentedControl` per `chip-primitives.md` — exactly-one
  selection, so not N toggle chips.
- No layout shift: progress text is `tabular-nums`, the button's label is
  ghost-sized to its longest variant, the stage box is reserved before load.
- Verified at all seven viewports in `visual-verification-mandatory.md`.

## video-lab stays

`src/lib/features/video/video-lab/` looked like a fourth parallel
implementation and is not one. It is live: `VideoModule.svelte` lazy-imports
`VideoLab.svelte` and `tab-definitions.ts` carries a `video-lab` tab, so it is
reached through the Video module rather than a route — which is why a route
grep found nothing.

Its `StepMappingView` already wraps the canonical `StepMapEditor`, so it
inherits this redesign for free; it only needed its props updated. Its
`SyncedPlaybackView` holds the codebase's existing 0.5×–2× rate control, which
is prior art for the marking rate, not a duplicate of it.

## Verification

- Harness `/test/sequence-videos` → Map timing, with a seeded 16-step sequence.
- A 17-tap run produces 16 `beatTimestamps` plus `endTimestamp`, and
  `getHighlightedBeatFromVideo` highlights each move during its own motion.
- A saved 16-entry map from before this change still loads and still plays.
- Screenshots at 1920 / 2560 / 3840 / 1440 / 820 / 960×412 / 375.
