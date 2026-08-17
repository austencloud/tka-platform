# Pronunciation corpus recording session

Status: approved
Date: 2026-08-16
Supersedes parts of: `2026-08-16-pronunciation-corpus-design.md`

## Problem

The corpus design settles what the bank is and how selection reads it. Its
capture stage is one paragraph: "displays one word at a time and advances
without per-word approval." Everything that makes that sentence true is
unspecified — how the tool knows a word ended, what happens when it guesses
wrong, where the audio lands, and how a 40-minute read survives being
interrupted.

The requirement, in Austen's words: open the page, press one start button, read
the words aloud, and have it move to the next word by itself and finish on its
own. Nothing else to touch.

That is achievable, but it puts the entire quality of the corpus behind one
mechanism — the decision that a word is finished. This document specifies that
mechanism and the session around it.

## Relationship to the corpus design

Five amendments, each with its reason.

**1. Per-word WAVs plus `words.json`, not one session WAV plus a prompt log.**
`scripts/measure-word-segmentation.ts:26` defines the contract the offline tools
already read: an array of `{file, word}` beside one WAV per word. Emitting that
directly means the session output runs through the existing harness with no
conversion step, and it makes a re-read a single replaced file instead of an
edit to a timeline. The audio is identical either way — capture is still
continuous, and the per-word files are cut from it.

**2. Capture rolls to a fresh buffer about once a minute.** The corpus design
asks for "one unbroken stream for the whole session" so that level, pitch and
room stay fixed across the bank. That property comes from holding one
`MediaStream` with one gain configuration, and rolling the output buffer does
not disturb it. Holding forty-five minutes as `Float32` would be roughly 500 MB.
The roll happens only at a detected word boundary, inside silence, and the next
word is not displayed until the new capture is running.

**3. Silent re-queue replaces the in-session review screen.** A flagged word
goes back into the queue further down rather than interrupting. The review
screen becomes an end-of-session report. This is a direct instruction, and it is
what makes the "press start and talk" requirement literally true.

**4. The carrier-phrase fallback for starved letters is removed.** The corpus
design routes letters the planner cannot cover to "carrier-phrase takes through
the existing job mode, which stays in the tool for exactly this reason." That
path does not exist. A v2 token must satisfy `hasCoherentContext`
(`src/lib/shared/pronunciation/pronunciation-manifest.ts:80`), which requires a
`medial` token to declare non-null neighbours, and `isNullableLetter` requires
those to be canonical TKA letters. A carrier take has no TKA neighbours, so it
cannot be represented. `parsePronunciationManifest` also returns v1 **or** v2 and
never merges them, so a v1 take cannot be spliced into a v2 bank either. Starved
cells are instead filled by constructed words from the planner (below).

**5. Auto-advance is gated on letter count, not on silence alone.** New
mechanism; the corpus design does not specify one.

## What already exists

`src/lib/features/lab/pronunciation-recorder/` is a complete feature, registered
as the `pronunciation-recorder` tab in `LabModule.svelte:26`. Reused unchanged:

| Piece | Path | What it gives |
|---|---|---|
| `IPronunciationRecorder` | `services/contracts/IPronunciationRecorder.ts` | Device enumeration, connect, capture, `renderDelivery` as the slicer |
| `PronunciationRecorder` | `services/implementations/PronunciationRecorder.ts` | `mediabunny` writing `pcm-s24` mono at 48 kHz — uncompressed, no codec latency |
| `IPronunciationTakeStore` | `services/contracts/IPronunciationTakeStore.ts` | File System Access directory handle, `JSZip` fallback |
| `segmentWordByEnergy` | `domain/voice-activity-trimmer.ts` | Energy islands, `MERGE_GAP_SECONDS = 0.2` |

`renderDelivery` rejects crops under 50 ms, which is below `MIN_SPEECH_SECONDS`
(80 ms), so it never rejects a real letter.

## Architecture

### The word plan

`domain/corpus-plan.ts`, pure.

The bank needs a token in every one of 54 letters × 4 positions = 216 cells.
`selectTokenPath` (`src/lib/shared/pronunciation/domain/token-selection.ts:101`)
filters candidates on exact position equality and returns null if any cue has
none, so a single empty cell sends every word using it to speech synthesis
permanently. Coverage is not a quality target; it is a correctness requirement.

Target depth is K=3 takes per cell. A word of length L yields one `initial`, one
`final`, and L−2 `medial` tokens, so initials and finals bind at one per word:
roughly 54K words, about 160 at K=3. Medial coverage arrives overprovisioned,
which is where selection has the most to choose from and benefits most.

`isolated` cannot come from any multi-letter word — `positionFor`
(`src/lib/shared/pronunciation/pronunciation-plan.ts:114`) emits it only when a
group holds exactly one letter. It needs its own pass of 54 solo reads. The
Phase 0 sample in the token-bank plan records 2/3/4/6/8-letter words and
produces zero of them.

The planner takes current coverage counts and a candidate pool, and greedily
picks the word that fills the most under-served cells, mixing lengths so the
bank is not all one contour. The pool is a checked-in JSON asset built by a
script from generated TKA sequences, because the adjacencies a real word can
produce are exactly the adjacencies a real label can contain — the corpus
design's reasoning, unchanged.

When the pool leaves a cell starved, the planner constructs a filler word
placing that letter in the position it lacks. A constructed word is a less
honest performance than a real one, which is why it is the fallback and not the
default, but it is the only remaining answer now that carrier takes are gone.

Input: coverage counts. Output: an ordered word list.

### The session queue

`domain/session-queue.ts`, pure.

Holds the ordered list, the current index, and a per-word attempt count. On
failure it reinserts the word `REQUEUE_DISTANCE = 8` places further down rather
than immediately, so a word that failed because of how it was read gets a
different run-up the second time. Eight is far enough that the failure is not
adjacent and near enough that it still lands in the same sitting. If fewer than
eight words remain, it goes to the end. `MAX_ATTEMPTS = 3` retires the word and
records it for the end-of-session report.

### The count gate

The crux, and the piece whose failure wastes a whole sitting.

Two silence thresholds are in play and they must not collide. Letters within a
word are separated by more than `MERGE_GAP_SECONDS` (200 ms) or the segmenter
merges them. A word ends with a longer pause. If the inter-letter pause drifts
up toward the inter-word pause, a naive silence timer advances mid-word.

The gate removes the ambiguity by using information a timer does not have: the
prompted word's letter count. A live analyser over the `MediaStream` counts
speech islands using the same frame size and merge gap as
`segmentWordByEnergy`, so the live count and the offline count agree by
construction. Advance requires **both** that the island count has reached the
letter count **and** that silence has held for `WORD_END_SILENCE = 0.7` seconds.
A long pause in the middle of a word cannot advance, because the count is not
satisfied yet.

0.7 s is three and a half times `MERGE_GAP_SECONDS`, which keeps a deliberate
inter-letter pause from reading as a word ending even before the count gate is
consulted. It is a starting value: the session's first three words measure the
actual gap distribution and, if the observed inter-letter median exceeds
0.7 s / 2, the threshold rises to twice that median for the rest of the sitting.

If silence reaches `WORD_ABANDON_SILENCE = 3.0` seconds without the count
arriving, the word failed: he stopped early, ran letters together, or was
interrupted. The gate reports the failure and the queue re-queues it. He is
never asked about it.

After capture, each word's slice is re-segmented offline by
`segmentWordByEnergy` with the expected count. Disagreement between the live
gate and the offline segmenter flags the word — the live analyser runs on a
different buffer path, so it is a check, not a duplicate.

### Capture and chunking

One `startTake()` spans `CHUNK_SECONDS = 60` of reading — roughly eight words,
about 12 MB of `Float32` at 48 kHz mono. Word boundary timestamps accumulate
against it. At the first boundary past `CHUNK_SECONDS`,
`finishTake()` yields an `AudioBuffer`; each word's range goes through
`renderDelivery` to a WAV blob and into the store, and a new take starts before
the next word is displayed.

Boundaries are cut in the middle of the detected silence rather than at the
speech edge, so no letter is clipped and each word keeps lead-in and tail. The
offline segmenter re-pads with `EDGE_PADDING_SECONDS` anyway.

### Output

Into the folder chosen at session start: one WAV per word, plus `words.json` as
`[{file, word}]`. Both are what `measure-word-segmentation.ts` reads.

`words.json` is rewritten after each chunk flushes, not only at the end, so a
crashed or closed tab leaves a directory the harness can still read.

Session state — coverage counts, retired words, the folder name — persists so a
sitting can end at any point and resume at the thinnest cells.

## Failure handling

**Word does not segment.** Re-queued silently. Three strikes retires it to the
report.

**Misread word with the right letter count.** Not detectable without recognition
and out of scope, as in the corpus design. The listening pass remains the real
gate.

**Microphone lost mid-session.** Capture stops, the current chunk flushes with
the words completed so far, and the session pauses with the reason shown. Resume
reconnects and continues.

**No File System Access support.** The store already falls back to a zip
download. `words.json` goes into the zip.

**Starved cells at the end.** Reported by letter and position, with the
constructed filler words needed to close them offered as a short follow-up
session.

## What is deleted

`domain/recording-jobs.ts` and the job-mode UI in `RecordingWorkspace.svelte` /
`RecordingInventory.svelte`. This is the 216 carrier-phrase take model the
corpus approach replaces, and amendment 4 establishes that its output cannot
enter a v2 bank. `domain/recording-manifest.ts` builds a v1 manifest and goes
with it.

`TakeWaveform.svelte` and the trim UI stay: the end-of-session report needs to
show a flagged word's waveform.

## Testing

The planner, the queue, and the count gate are pure and get real fixtures.

- **Planner:** biases toward starved cells, mixes lengths, terminates, emits
  filler words only when the pool cannot cover a cell, and reaches all 216
  cells at K=3 from an empty start.
- **Queue:** re-queues at a distance rather than immediately, retires at three
  attempts, and reports retired words.
- **Count gate:** advances only when count and silence are both satisfied; does
  not advance on a long mid-word pause; reports failure when the count never
  arrives. Verified by mutation — removing the count condition must fail a
  test, or the gate is untested.
- **Session state machine:** driven against a fake recorder and a fake store,
  asserting chunk rollover writes every word in the chunk and that `words.json`
  is rewritten per chunk.
- **Output contract:** a completed fake session produces a directory
  `measure-word-segmentation.ts` reads without error.

The listening pass over written slices remains the quality gate, unchanged.

## Open

Phase 0 has not run. If energy segmentation misses the decision rule, forced
alignment replaces `segmentWordByEnergy` offline. The live count gate is
unaffected — it needs an island count, not a correct one, and the offline
disagreement check absorbs the difference.
