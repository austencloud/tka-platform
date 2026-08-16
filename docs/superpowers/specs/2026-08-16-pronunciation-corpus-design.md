# Pronunciation corpus and unit selection

**Date:** 2026-08-16
**Status:** Design, awaiting Phase 0 result
**Supersedes:** the four-take-per-letter recording model in
`docs/reference/pronunciation-recording-guide.md`

## Problem

The shipped pronunciation system asks for four discrete carrier-phrase takes per
letter. With 54 canonical letters that is 216 takes, each requiring its own
prompt, crop, and approval. `static/audio/pronunciations/v1/manifest.json` is
still `{"recordings": {}}`, so none of that work has been done and the app always
falls through to browser speech synthesis.

Four fixed slots also underfit the problem. A letter in the second position of a
four-letter word does not carry the same pitch as the same letter in the fifth
position of an eight-letter word, but both resolve to the single `medial` file.

## Approach

Read whole generated words back to back in one continuous session. Split each
recording into its letters. Keep every letter instance as a separate token
tagged with the context it was actually spoken in. At playback, choose the token
whose real context best matches the target and whose edges join most cleanly to
its neighbours.

This produces many instances per letter instead of one per slot, preserves
natural coarticulation, and replaces a tedious prompt-crop-approve loop with a
continuous read.

### Why not a cloned voice

Scope is word labels only, over a closed vocabulary of 54 symbols. A text-to-speech
clone captures timbre but not the prosody of a symbol list that is not natural
language, cannot read `Σ-` without a text expansion, and regenerates differently
on every call. A deterministic bank of real audio is exact, free per play, works
offline, and never varies. Revisit only if arbitrary narration enters scope.

### Why generated sequences rather than synthetic coverage words

The letter adjacencies a generated sequence can produce are exactly the
adjacencies that can appear in a real label. Constraining the script to real
words scopes boundary coverage to reachable pairs and spends no breath on joins
that cannot occur. It also keeps the delivery honest: reading a real word and
reading a nonsense coverage string are different performances.

## Phase 0: does the existing trimmer already segment words?

`src/lib/features/lab/pronunciation-recorder/domain/voice-activity-trimmer.ts`
performs energy-based speech-island detection with `MERGE_GAP_SECONDS = 0.2`,
tuned to hold `Sigma dash` together as one island. It already reports
`confidence: "strong"` only when the detected island count matches the expected
count.

If a word read as a comma-separated list yields one island per letter, that
function is the segmenter and no forced-alignment dependency is needed. If
letters run together, islands merge and the count check fails.

**The experiment:** record ten words of mixed length (2, 3, 4, 6, 8 letters), run
`suggestPronunciationTrim` variants over each with `expectedSegments` set to the
letter count, and record the exact-match rate plus the boundary error against
hand-marked truth.

**Decision rule**, measured over the ten words:

- Exact island count on at least 8 of 10 words, and median boundary error under
  40 ms against hand-marked truth: energy segmentation is the primary path. No
  Python enters the project. Flagged words go to the review screen.
- Anything below that: add forced alignment (WhisperX or Montreal Forced
  Aligner) as the primary segmenter, run as a batch CLI step over the session
  WAV plus the prompt log. Everything downstream in this document is unchanged.

40 ms is roughly the edge padding the trimmer already applies
(`EDGE_PADDING_SECONDS = 0.035`), so an error inside that window is absorbed by
padding rather than clipping a consonant.

Run Phase 0 before implementing the rest. Its result changes one component and
nothing else.

## Architecture

Five stages, each independently testable.

### 1. Script generation

A coverage planner holds a running count per letter per position
(`initial`, `medial`, `final`) and requests words biased toward starved slots.
It mixes word lengths across 2, 3, 4, 6, and 8 letters so the bank is not
entirely four-beat contours. It terminates when every letter clears the
threshold in every position.

A four-letter word yields one initial, two medial, and one final token. Initials
and finals are therefore the binding constraint at one each per word. Covering
54 letters K times in both positions takes on the order of 54K words. K=3 lands
near 160 words, K=5 near 270. Medial coverage arrives overprovisioned, which is
where unit selection benefits most from choice.

`isolated` cannot be produced by any multi-letter word. `createPronunciationPlan`
emits it whenever a group split on the middle dot holds a single letter, so it
needs its own pass of 54 solo reads.

Input: current coverage counts. Output: an ordered list of words to read.

### 2. Capture

The Lab tool gains a corpus mode alongside the existing job mode. It displays
one word at a time and advances without per-word approval, keeping the read
continuous. Audio is one unbroken stream for the whole session plus a
timestamped prompt log mapping elapsed time to the word displayed.

One stream matters: level, pitch, and room stay fixed across the bank, which is
the property the current guide protects with its fixed-setup rules and the
property most at risk when harvesting from natural reads.

Reuses `IPronunciationRecorder` unchanged for device selection, stream capture,
and buffer production.

### 3. Segmentation

For each word in the prompt log, take its slice of the session buffer and split
it into per-letter ranges by whichever mechanism Phase 0 selects.

Island count equal to letter count means auto-accept. Any other count flags the
word for review.

Each accepted range becomes a token written through
`IPronunciationRecorder.renderDelivery(audioBuffer, range)`, which already
renders a sub-range to a delivery WAV.

Each token carries:

| Field | Purpose |
| --- | --- |
| `assetKey` | which letter |
| `position` | initial / medial / final / isolated |
| `previousLetter`, `nextLetter` | real spoken context, `null` at word edges |
| `sourceWord`, `indexInWord`, `wordLength` | provenance and contour depth |
| `durationMs` | pacing |
| `rmsDb`, `f0StartHz`, `f0EndHz` | join cost inputs |

### 4. The bank

Manifest moves to version 2. Version 1 maps `assetKey` to a record of position
to path. Version 2 maps `assetKey` to an array of tokens.

```jsonc
{
  "version": 2,
  "tokens": {
    "sigma-dash": [
      {
        "path": "sigma-dash/0f3a.wav",
        "position": "medial",
        "previousLetter": "α",
        "nextLetter": "Ω",
        "sourceWord": "αΣ-Ωβ",
        "indexInWord": 1,
        "wordLength": 4,
        "durationMs": 412,
        "rmsDb": -19.4,
        "f0StartHz": 118.2,
        "f0EndHz": 121.7
      }
    ]
  }
}
```

`isPronunciationManifest` in the player gains a v2 branch. Keeping the v1 branch
costs little and lets a partially recorded v1 bank keep working if one is ever
produced.

### 5. Selection and playback

`resolveRecordedCuePaths` becomes a selector. For a plan of N cues it builds the
candidate set per cue, then finds the minimum-cost path with Viterbi over two
costs:

- **Target cost**, per candidate: does this token's `position` match, do its real
  `previousLetter` and `nextLetter` match the target's neighbours, is its
  `wordLength` close to the target's? Position mismatch is disqualifying;
  neighbour and length mismatches are penalties.
- **Join cost**, per adjacent pair: `f0EndHz` of the left token against
  `f0StartHz` of the right, and the `rmsDb` difference. This is the control the
  carrier-phrase method bought by construction and the main risk of harvesting
  from natural reads.

Any cue with an empty candidate set rejects the whole word, preserving the
existing all-or-nothing rule so human and synthetic voices never mix inside one
word.

`PronunciationPlayer.playBuffers` is unchanged. It already schedules resolved
buffers on one Web Audio clock with per-cue pauses from the plan. Only path
resolution changes.

## Data flow

```
coverage counts
  -> script generator -> word list
  -> capture (one stream + prompt log)
  -> segmentation -> per-letter ranges
  -> renderDelivery -> token WAVs + metadata
  -> manifest v2
  -> selector (target cost + join cost, Viterbi)
  -> PronunciationPlayer.playBuffers
```

## Error handling

**Misread or stumble.** The dangerous failure: a segmenter confidently maps the
prompted letters onto audio of a different word, poisoning the bank silently. The
island-count check catches length mismatches. A review screen lists every flagged
word for re-reading. Words never enter the bank unflagged unless the count
matched.

**Starved letters.** The planner reports any letter it could not reach the
threshold for in any position. Those slots fall back to carrier-phrase takes
through the existing job mode, which stays in the tool for exactly this reason.

**Uncovered word at playback.** Unchanged. One missing cue sends the whole word
to browser speech synthesis, as `tryRecordedPlayback` already does on a null
resolution.

**Manifest or clip load failure.** Unchanged. The player already logs and falls
through to synthesis.

## Testing

- **Trimmer segmentation** (Phase 0): per-letter boundary error and exact-count
  rate against hand-marked truth on the ten-word sample. This is measurement, not
  a regression test.
- **Coverage planner:** given synthetic coverage counts, asserts it biases toward
  starved slots, mixes lengths, and terminates.
- **Selector:** given a fixture token bank, asserts position mismatch is
  disqualifying, exact neighbour matches win over inexact, join cost breaks ties
  toward pitch continuity, and an empty candidate set rejects the whole word.
- **Manifest validation:** v2 accepted, v1 accepted, malformed rejected.
- **Player integration:** extends the existing tests under `tests/unit/pronunciation/`.
- **Listening pass:** the existing guide's listening set still applies and remains
  the real quality gate. Boundary clicks and level jumps are what the join cost
  exists to prevent, and only ears confirm it.

## What is reused unchanged

- `IPronunciationRecorder` in full, including `renderDelivery` as the slicer
- `PronunciationPlayer.playBuffers` and the Web Audio scheduling
- `createPronunciationPlan` and the position model
- The all-or-nothing resolution rule
- The session discipline in the recording guide: fixed mic and room, disabled
  AGC and noise suppression, batch normalisation around -18 LUFS

## What changes

- `pronunciation-plan.ts`: manifest v2 types, `resolveRecordedCuePaths` becomes
  the selector
- `pronunciation-player.ts`: v2 branch in `isPronunciationManifest`
- `IPronunciationTakeStore`: `saveTake` and `exportSessionZip` generalise from
  job-keyed to token-keyed
- Lab tool: corpus mode, coverage planner, review screen
- `scripts/build-pronunciation-manifest.ts`: emits v2, validates token metadata
- `docs/reference/pronunciation-recording-guide.md`: rewritten for the corpus
  session once Phase 0 settles the segmenter

## Open

Phase 0 has not run. Its result selects the segmenter and nothing else.
