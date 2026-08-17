# Pronunciation Token Bank Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the four-slot pronunciation manifest with a token bank of many
real letter instances, selected at playback by context match and join cost.

**Architecture:** Five pure modules plus one wiring change. A word segmenter
generalises the existing energy trimmer to return every speech island instead of
one. A feature module measures loudness and pitch at token edges. A manifest
module parses both the v1 and v2 formats. A selection module runs Viterbi over
candidate tokens using a target cost and a join cost. `PronunciationPlayer`
picks its path resolver by manifest version and otherwise does not change.

**Tech Stack:** TypeScript, Vitest (`tests/config/vitest.config.ts`), Web Audio
for playback, `tsx` for the measurement script.

**Scope:** This plan covers the runtime half only: the bank format, the
selector, and the player. It ends with a hand-authorable token bank that plays
with unit selection. The Lab recording tool that produces a bank automatically
is a second plan, written after Phase 0 settles the segmenter.

**Design:** `docs/superpowers/specs/2026-08-16-pronunciation-corpus-design.md`

---

## File Structure

| Path | Responsibility |
| --- | --- |
| `src/lib/features/lab/pronunciation-recorder/domain/voice-activity-trimmer.ts` | Modify. Extract island finding; add whole-word segmentation. |
| `scripts/measure-word-segmentation.ts` | Create. Phase 0 harness: slice recorded words, report counts, write clips to listen to. |
| `src/lib/shared/pronunciation/pronunciation-plan.ts` | Modify. Cue context fields; v2 token types. |
| `src/lib/shared/pronunciation/pronunciation-manifest.ts` | Create. Validation and parsing for v1 and v2. |
| `src/lib/shared/pronunciation/domain/audio-features.ts` | Create. RMS and F0 measurement. |
| `src/lib/shared/pronunciation/domain/token-selection.ts` | Create. Target cost, join cost, Viterbi path. |
| `src/lib/shared/pronunciation/services/pronunciation-player.ts` | Modify. Version-dispatched path resolution. |

---

### Task 1: Whole-word segmentation

`suggestPronunciationTrim` already finds every speech island and then throws all
but one away. Extract the finding so a caller can keep them all.

> **Amended 2026-08-16 after code review. The snippets below are superseded.**
> The shipped signature is `segmentWordByEnergy(samples, sampleRate): TrimRange[]`.
> The `WordSegmentation` interface and the `expectedSegments` parameter were cut:
> `detectedSegments` was provably `segments.length`, and `expectedSegments` could
> only set a boolean the caller computes itself — while making
> `segmentWordByEnergy(anything, 0, 0)` report a match on invalid input. Callers
> compare `segments.length` against their own expected count. Padding is now
> applied through a shared `toPaddedRange` helper used by both this function and
> `suggestPronunciationTrim`, so the "edge padding matches the single-take
> trimmer" invariant is enforced rather than merely asserted in a comment.
>
> One factual correction that matters downstream: adjacent letter ranges **never
> overlap**. Islands survive separately only when more than `MERGE_GAP_SECONDS`
> (0.2s) of quiet divides them, while padding adds `2 × EDGE_PADDING_SECONDS`
> (0.07s), leaving over 100ms of silence between neighbours at every sample rate.
> The audio of each inter-letter transition is discarded. Task 6's join cost is
> therefore joining two clips that were never adjacent in the source recording.

**Files:**
- Modify: `src/lib/features/lab/pronunciation-recorder/domain/voice-activity-trimmer.ts:87-124`
- Test: `tests/unit/pronunciation/word-segmentation.test.ts`

- [x] **Step 1: Write the failing test**

Create `tests/unit/pronunciation/word-segmentation.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { segmentWordByEnergy } from "$lib/features/lab/pronunciation-recorder/domain/voice-activity-trimmer";

const SAMPLE_RATE = 48_000;

/**
 * Build speech-like audio: `count` tone bursts separated by silence. The gap
 * exceeds the trimmer's 200 ms merge window so the bursts stay distinct, and
 * each burst clears its 80 ms minimum-speech floor.
 */
function burstAudio(
  count: number,
  burstSeconds = 0.3,
  gapSeconds = 0.25
): Float32Array {
  const burstLength = Math.round(SAMPLE_RATE * burstSeconds);
  const gapLength = Math.round(SAMPLE_RATE * gapSeconds);
  const total = count * burstLength + (count - 1) * gapLength;
  const samples = new Float32Array(total);

  let cursor = 0;
  for (let burst = 0; burst < count; burst++) {
    for (let index = 0; index < burstLength; index++) {
      samples[cursor + index] =
        0.5 * Math.sin((2 * Math.PI * 200 * index) / SAMPLE_RATE);
    }
    cursor += burstLength + gapLength;
  }
  return samples;
}

describe("segmentWordByEnergy", () => {
  it("returns one range per spoken letter", () => {
    const result = segmentWordByEnergy(burstAudio(4), SAMPLE_RATE, 4);

    expect(result.detectedSegments).toBe(4);
    expect(result.matchesExpected).toBe(true);
    expect(result.segments).toHaveLength(4);
  });

  it("orders ranges by time and keeps them inside the buffer", () => {
    const result = segmentWordByEnergy(burstAudio(3), SAMPLE_RATE, 3);

    const [first, second, third] = result.segments;
    expect(first!.startSeconds).toBeGreaterThanOrEqual(0);
    expect(first!.startSeconds).toBeLessThan(second!.startSeconds);
    expect(second!.startSeconds).toBeLessThan(third!.startSeconds);
    expect(third!.endSeconds).toBeLessThanOrEqual(3 * 0.3 + 2 * 0.25);
  });

  it("reports a mismatch when islands do not match the expected letter count", () => {
    const result = segmentWordByEnergy(burstAudio(2), SAMPLE_RATE, 4);

    expect(result.detectedSegments).toBe(2);
    expect(result.matchesExpected).toBe(false);
  });

  it("reports no segments for silence", () => {
    const result = segmentWordByEnergy(
      new Float32Array(SAMPLE_RATE),
      SAMPLE_RATE,
      3
    );

    expect(result.detectedSegments).toBe(0);
    expect(result.matchesExpected).toBe(false);
  });
});
```

- [x] **Step 2: Run the test to verify it fails**

```bash
npm run test:ci -- tests/unit/pronunciation/word-segmentation.test.ts
```

Expected: FAIL. `segmentWordByEnergy` is not exported by the trimmer module.

- [x] **Step 3: Extract island finding and add the new export**

In `voice-activity-trimmer.ts`, add this exported interface next to `TrimSuggestion`:

```ts
export interface WordSegmentation {
  segments: TrimRange[];
  detectedSegments: number;
  matchesExpected: boolean;
}
```

Add this function above `suggestPronunciationTrim`. Its body is the energy,
threshold, raw-segment, merge, and minimum-length block currently inline in
`suggestPronunciationTrim`, moved verbatim:

```ts
/**
 * Find speech islands by frame energy. Short internal gaps stay joined so a
 * two-word name such as "Sigma dash" remains one island.
 */
function findSpeechSegments(
  samples: Float32Array,
  sampleRate: number
): SampleRange[] {
  if (samples.length === 0 || sampleRate <= 0) return [];

  const frameSize = Math.max(1, Math.round(sampleRate * FRAME_SECONDS));
  const energies: number[] = [];
  for (let start = 0; start < samples.length; start += frameSize) {
    const end = Math.min(samples.length, start + frameSize);
    let sumSquares = 0;
    for (let index = start; index < end; index++) {
      const sample = samples[index] ?? 0;
      sumSquares += sample * sample;
    }
    energies.push(Math.sqrt(sumSquares / Math.max(1, end - start)));
  }

  const peak = Math.max(...energies);
  const noiseFloor = percentile(energies, 0.2);
  const threshold = Math.max(0.0015, noiseFloor * 3.2, peak * 0.055);
  const activeFrames = energies.map((energy) => energy >= threshold);

  const rawSegments: SampleRange[] = [];
  let activeStart = -1;
  for (let frame = 0; frame <= activeFrames.length; frame++) {
    const active = activeFrames[frame] ?? false;
    if (active && activeStart < 0) activeStart = frame;
    if (!active && activeStart >= 0) {
      rawSegments.push({
        start: activeStart * frameSize,
        end: Math.min(samples.length, frame * frameSize),
      });
      activeStart = -1;
    }
  }

  const mergeGap = Math.round(sampleRate * MERGE_GAP_SECONDS);
  const minSpeech = Math.round(sampleRate * MIN_SPEECH_SECONDS);
  const merged: SampleRange[] = [];
  for (const segment of rawSegments) {
    const previous = merged.at(-1);
    if (previous && segment.start - previous.end <= mergeGap) {
      previous.end = segment.end;
    } else {
      merged.push({ ...segment });
    }
  }

  return merged.filter((segment) => segment.end - segment.start >= minSpeech);
}
```

Replace the body of `suggestPronunciationTrim` between its zero-length guard and
its `chooseSegment` call with a single call, leaving every other line of that
function untouched:

```ts
  const speechSegments = findSpeechSegments(samples, sampleRate);
  const selected = chooseSegment(speechSegments, targetSegment);
```

Add the new public function at the end of the file:

```ts
/**
 * Split one spoken word into one range per letter. Edge padding matches the
 * single-take trimmer, so ranges of adjacent letters may overlap slightly;
 * that overlap preserves the natural release of the preceding letter.
 */
export function segmentWordByEnergy(
  samples: Float32Array,
  sampleRate: number,
  expectedSegments: number
): WordSegmentation {
  const found = findSpeechSegments(samples, sampleRate);
  const padding = Math.round(sampleRate * EDGE_PADDING_SECONDS);

  const segments = found.map((segment) => ({
    startSeconds: Math.max(0, segment.start - padding) / sampleRate,
    endSeconds: Math.min(samples.length, segment.end + padding) / sampleRate,
  }));

  return {
    segments,
    detectedSegments: segments.length,
    matchesExpected: segments.length === expectedSegments,
  };
}
```

- [x] **Step 4: Run the tests to verify they pass**

```bash
npm run test:ci -- tests/unit/pronunciation/
```

Expected: PASS, including the pre-existing `pronunciation-recorder`,
`pronunciation-plan`, and `pronunciation-player` suites. The trimmer refactor is
behaviour-preserving; if `pronunciation-recorder.test.ts` fails, the extraction
changed behaviour and must be corrected rather than the test.

- [x] **Step 5: Commit**

```bash
git commit -m "feat(pronunciation): segment a whole word into per-letter ranges" -- src/lib/features/lab/pronunciation-recorder/domain/voice-activity-trimmer.ts tests/unit/pronunciation/word-segmentation.test.ts
```

---

### Task 2: Phase 0 measurement script

Decides whether energy segmentation is good enough or forced alignment is
needed. Reads recorded words, slices each, reports the exact-count rate, and
writes the slices out so they can be listened to.

> **Amended 2026-08-16 after code review. The script below is the initial
> version; `scripts/measure-word-segmentation.ts` is authoritative.** The
> decoding arithmetic is unchanged and was verified numerically on 48 kHz
> 24-bit mono and stereo, including sign extension at both rails; post-fix
> slices are byte-identical to pre-fix ones. What changed is everything around
> it: a bad take no longer aborts the batch, the summary counts only attempted
> words so a typo'd entry cannot look like a segmenter failure, slices from a
> word whose island count disagrees with its letter count are labelled
> `unaligned` rather than asserting a letter identity the tool cannot verify,
> mismatches print segment times, stale slices are cleared before each run,
> malformed input produces one readable line instead of a stack trace, and the
> decoder accepts 32-bit float and WAVE_FORMAT_EXTENSIBLE while refusing to
> silently reinterpret 32-bit integer PCM.

**Files:**
- Create: `scripts/measure-word-segmentation.ts`

- [x] **Step 1: Write the script**

Create `scripts/measure-word-segmentation.ts`:

```ts
/**
 * Phase 0 harness for the pronunciation corpus design.
 *
 * Usage:
 *   pnpm exec tsx scripts/measure-word-segmentation.ts <directory>
 *
 * The directory holds one WAV per read word plus a words.json of the form
 *   [{ "file": "01.wav", "word": "AΣ-Ωβ" }]
 *
 * Reports how often energy segmentation finds exactly one island per letter and
 * writes every slice to <directory>/slices so the cuts can be auditioned.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { segmentWordByEnergy } from "../src/lib/features/lab/pronunciation-recorder/domain/voice-activity-trimmer";
import { createPronunciationPlan } from "../src/lib/shared/pronunciation/pronunciation-plan";

interface WordEntry {
  file: string;
  word: string;
}

interface DecodedWav {
  samples: Float32Array;
  sampleRate: number;
}

/** Read a mono or interleaved PCM WAV. Non-PCM encodings are rejected loudly. */
function decodeWav(bytes: Buffer): DecodedWav {
  if (bytes.toString("ascii", 0, 4) !== "RIFF") {
    throw new Error("Not a RIFF file");
  }
  if (bytes.toString("ascii", 8, 12) !== "WAVE") {
    throw new Error("Not a WAVE file");
  }

  let cursor = 12;
  let sampleRate = 0;
  let channels = 1;
  let bitsPerSample = 16;
  let dataStart = -1;
  let dataLength = 0;

  while (cursor + 8 <= bytes.length) {
    const id = bytes.toString("ascii", cursor, cursor + 4);
    const size = bytes.readUInt32LE(cursor + 4);
    const body = cursor + 8;

    if (id === "fmt ") {
      const format = bytes.readUInt16LE(body);
      if (format !== 1) {
        throw new Error(`Only PCM WAV is supported, found format ${format}`);
      }
      channels = bytes.readUInt16LE(body + 2);
      sampleRate = bytes.readUInt32LE(body + 4);
      bitsPerSample = bytes.readUInt16LE(body + 14);
    } else if (id === "data") {
      dataStart = body;
      dataLength = size;
    }

    cursor = body + size + (size % 2);
  }

  if (dataStart < 0 || sampleRate === 0) {
    throw new Error("WAV is missing a fmt or data chunk");
  }

  const bytesPerSample = bitsPerSample / 8;
  const frameCount = Math.floor(dataLength / (bytesPerSample * channels));
  const samples = new Float32Array(frameCount);

  for (let frame = 0; frame < frameCount; frame++) {
    const offset = dataStart + frame * bytesPerSample * channels;
    if (bitsPerSample === 16) {
      samples[frame] = bytes.readInt16LE(offset) / 32_768;
    } else if (bitsPerSample === 24) {
      const raw =
        bytes[offset]! | (bytes[offset + 1]! << 8) | (bytes[offset + 2]! << 16);
      samples[frame] = (raw & 0x800000 ? raw - 0x1000000 : raw) / 8_388_608;
    } else if (bitsPerSample === 32) {
      samples[frame] = bytes.readFloatLE(offset);
    } else {
      throw new Error(`Unsupported bit depth ${bitsPerSample}`);
    }
  }

  return { samples, sampleRate };
}

/** Write mono 16-bit PCM so the slices can be played in any audio tool. */
function encodeWav(samples: Float32Array, sampleRate: number): Buffer {
  const buffer = Buffer.alloc(44 + samples.length * 2);
  buffer.write("RIFF", 0, "ascii");
  buffer.writeUInt32LE(36 + samples.length * 2, 4);
  buffer.write("WAVE", 8, "ascii");
  buffer.write("fmt ", 12, "ascii");
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36, "ascii");
  buffer.writeUInt32LE(samples.length * 2, 40);

  for (let index = 0; index < samples.length; index++) {
    const clamped = Math.max(-1, Math.min(1, samples[index] ?? 0));
    buffer.writeInt16LE(Math.round(clamped * 32_767), 44 + index * 2);
  }
  return buffer;
}

function main(): void {
  const directory = process.argv[2];
  if (!directory) {
    console.error("Usage: tsx scripts/measure-word-segmentation.ts <directory>");
    process.exit(1);
  }

  const entries = JSON.parse(
    readFileSync(join(directory, "words.json"), "utf8")
  ) as WordEntry[];

  const sliceDirectory = join(directory, "slices");
  mkdirSync(sliceDirectory, { recursive: true });

  let matched = 0;
  for (const entry of entries) {
    const plan = createPronunciationPlan(entry.word);
    if (!plan) {
      console.log(`${entry.file}  ${entry.word}  SKIPPED: not a valid TKA word`);
      continue;
    }

    const { samples, sampleRate } = decodeWav(
      readFileSync(join(directory, entry.file))
    );
    const expected = plan.cues.length;
    const segments = segmentWordByEnergy(samples, sampleRate);
    const isExact = segments.length === expected;
    if (isExact) matched += 1;

    console.log(
      `${entry.file}  ${entry.word}  expected ${expected}  found ${segments.length}  ${
        isExact ? "MATCH" : "MISMATCH"
      }`
    );

    segments.forEach((segment, index) => {
      const start = Math.floor(segment.startSeconds * sampleRate);
      const end = Math.floor(segment.endSeconds * sampleRate);
      const label = plan.cues[index]?.assetKey ?? `extra-${index}`;
      writeFileSync(
        join(sliceDirectory, `${entry.file}.${index}.${label}.wav`),
        encodeWav(samples.slice(start, end), sampleRate)
      );
    });
  }

  console.log(`\n${matched}/${entries.length} words segmented exactly.`);
  console.log(`Slices written to ${sliceDirectory}. Listen before deciding.`);
}

main();
```

- [x] **Step 2: Verify the script runs and reports a clean failure without input**

```bash
pnpm exec tsx scripts/measure-word-segmentation.ts
```

Expected: prints the usage line and exits 1.

- [x] **Step 3: Commit**

```bash
git commit -m "feat(pronunciation): phase 0 word-segmentation measurement script" -- scripts/measure-word-segmentation.ts
```

- [ ] **Step 4: Human gate. Austen records the Phase 0 sample.**

Ten words of mixed length (two of each: 2, 3, 4, 6, 8 letters), read as a
comma-separated list in his normal label-reading delivery, one WAV each, plus a
`words.json` naming them. Then run the script against that directory and listen
to `slices/`.

**Decision:** at least 8 of 10 exact matches AND slices that sound like clean
whole letters means energy segmentation is the segmenter and the recording-tool
plan needs no Python. Below that, the recording-tool plan adds forced alignment
as the primary segmenter. Nothing in Tasks 3 through 7 depends on the outcome,
so they proceed either way.

Best run after Task 5, which adds per-slice loudness and pitch to this script's
output. The same ten recordings then answer two questions at once: whether the
segmenter works, and whether the join-cost measurements are meaningful on
Austen's voice. If the recording happens sooner, keep the WAVs and re-run the
script after Task 5 lands.

---

### Task 3: Cue context fields

The selector needs to know how long a group is and where in it a cue sits.
`createPronunciationPlan` already has both values and discards them.

**Files:**
- Modify: `src/lib/shared/pronunciation/pronunciation-plan.ts:17-23,113-135`
- Test: `tests/unit/pronunciation/pronunciation-plan.test.ts`

- [x] **Step 1: Write the failing test**

Append to `tests/unit/pronunciation/pronunciation-plan.test.ts`, inside the
existing `describe("createPronunciationPlan", ...)` block:

```ts
  it("carries each cue's place inside its group", () => {
    const plan = createPronunciationPlan("AB·C");

    expect(plan).not.toBeNull();
    expect(plan!.cues).toMatchObject([
      { assetKey: "a", position: "initial", indexInGroup: 0, groupLength: 2 },
      { assetKey: "b", position: "final", indexInGroup: 1, groupLength: 2 },
      { assetKey: "c", position: "isolated", indexInGroup: 0, groupLength: 1 },
    ]);
  });
```

- [x] **Step 2: Run the test to verify it fails**

```bash
npm run test:ci -- tests/unit/pronunciation/pronunciation-plan.test.ts
```

Expected: FAIL. `indexInGroup` and `groupLength` are undefined on the cues.

- [x] **Step 3: Add the fields**

In `pronunciation-plan.ts`, extend the cue interface:

```ts
export interface PronunciationCue {
  letter: TkaLetter;
  spokenName: string;
  assetKey: string;
  position: PronunciationPosition;
  pauseAfterMs: number;
  indexInGroup: number;
  groupLength: number;
}
```

In `createPronunciationPlan`, add the two fields to the `cues.push` call. Every
other property stays exactly as it is:

```ts
      cues.push({
        letter,
        ...pronunciation,
        position: positionFor(letterIndex, group.length),
        indexInGroup: letterIndex,
        groupLength: group.length,
        pauseAfterMs: isLastInGroup
          ? isLastGroup
            ? 0
            : BETWEEN_GROUP_PAUSE_MS
          : WITHIN_GROUP_PAUSE_MS,
      });
```

- [x] **Step 4: Run the tests to verify they pass**

```bash
npm run test:ci -- tests/unit/pronunciation/
```

Expected: PASS. The pre-existing cue assertions use `toMatchObject`, so added
properties do not break them.

- [x] **Step 5: Commit**

```bash
git commit -m "feat(pronunciation): carry group position on every cue" -- src/lib/shared/pronunciation/pronunciation-plan.ts tests/unit/pronunciation/pronunciation-plan.test.ts
```

---

### Task 4: Manifest v2 types and parsing

**Files:**
- Modify: `src/lib/shared/pronunciation/pronunciation-plan.ts:30-37`
- Create: `src/lib/shared/pronunciation/pronunciation-manifest.ts`
- Test: `tests/unit/pronunciation/pronunciation-manifest.test.ts`

> **Amended after review (2026-08-16, `7779190f42`).** Three corrections to
> what this task originally specified:
>
> 1. **The token field is `groupLength`, not `wordLength`.** Task 6 computes
>    `Math.abs(token.groupLength - cue.groupLength)`. Under the original naming
>    that read `token.wordLength - cue.groupLength` — one quantity subtracted
>    from itself under two names. A recorded word carries no middle dot, so a
>    token's group *is* its source word; the two fields were always the same
>    thing. Every code block below and in the design doc uses the new name.
> 2. **The numeric predicates are tighter than `isFiniteNumber`.**
>    `indexInWord` is a non-negative integer, `groupLength` a positive integer,
>    `durationMs` positive (a 0 ms token plays nothing and silently drops a
>    letter). `rmsDb` stays plain finite — dBFS is negative. `f0StartHz` and
>    `f0EndHz` are non-negative rather than positive: **0 is the unvoiced
>    sentinel** Task 5 writes via `estimateF0Hz(...) ?? 0`, and rejecting it
>    would drop every unvoiced token from the bank.
> 3. **`position` and neighbour-nullness are checked against each other.** No
>    per-field predicate can express it, and the selector reads both as if they
>    agreed. `initial`/`isolated` require a null `previousLetter`;
>    `final`/`isolated` require a null `nextLetter`.
>
> Deliberately **not** added: an `indexInWord < groupLength` bounds check.
> `indexInWord` is provenance that nothing downstream reads, so validating it
> further guards nothing. Its own existing type check is already the ceiling of
> what that field earns.

- [x] **Step 1: Write the failing test**

Create `tests/unit/pronunciation/pronunciation-manifest.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { parsePronunciationManifest } from "$lib/shared/pronunciation/pronunciation-manifest";
import type { PronunciationToken } from "$lib/shared/pronunciation/pronunciation-plan";

const token: PronunciationToken = {
  path: "a/0f3a.wav",
  position: "medial",
  previousLetter: "B",
  nextLetter: "C",
  sourceWord: "BAC",
  indexInWord: 1,
  groupLength: 3,
  durationMs: 412,
  rmsDb: -19.4,
  f0StartHz: 118.2,
  f0EndHz: 121.7,
};

describe("parsePronunciationManifest", () => {
  it("accepts a version 1 manifest", () => {
    const parsed = parsePronunciationManifest({
      version: 1,
      recordings: { a: { initial: "a/initial.wav" } },
    });

    expect(parsed).toEqual({
      version: 1,
      recordings: { a: { initial: "a/initial.wav" } },
    });
  });

  it("accepts a version 2 token bank", () => {
    const parsed = parsePronunciationManifest({
      version: 2,
      tokens: { a: [token] },
    });

    expect(parsed?.version).toBe(2);
  });

  it("accepts an empty token bank", () => {
    expect(parsePronunciationManifest({ version: 2, tokens: {} })).toEqual({
      version: 2,
      tokens: {},
    });
  });

  it("rejects a token with an unknown position", () => {
    expect(
      parsePronunciationManifest({
        version: 2,
        tokens: { a: [{ ...token, position: "middle" }] },
      })
    ).toBeNull();
  });

  it("rejects a token with a non-finite measurement", () => {
    expect(
      parsePronunciationManifest({
        version: 2,
        tokens: { a: [{ ...token, f0StartHz: Number.NaN }] },
      })
    ).toBeNull();
  });

  it("rejects an unknown version and non-objects", () => {
    expect(parsePronunciationManifest({ version: 3, tokens: {} })).toBeNull();
    expect(parsePronunciationManifest("nope")).toBeNull();
    expect(parsePronunciationManifest(null)).toBeNull();
  });
});
```

- [x] **Step 2: Run the test to verify it fails**

```bash
npm run test:ci -- tests/unit/pronunciation/pronunciation-manifest.test.ts
```

Expected: FAIL. The module does not exist.

- [x] **Step 3: Add the v2 types**

In `pronunciation-plan.ts`, add below the existing `PronunciationManifest`:

```ts
export interface PronunciationToken {
  /** Path to the delivery WAV, relative to the manifest. */
  path: string;
  position: PronunciationPosition;
  /** The letter actually spoken before this one, null at a group edge. */
  previousLetter: string | null;
  /** The letter actually spoken after this one, null at a group edge. */
  nextLetter: string | null;
  sourceWord: string;
  indexInWord: number;
  groupLength: number;
  durationMs: number;
  rmsDb: number;
  f0StartHz: number;
  f0EndHz: number;
}

export interface PronunciationTokenBank {
  version: 2;
  tokens: Record<string, PronunciationToken[]>;
}

export type AnyPronunciationManifest =
  | PronunciationManifest
  | PronunciationTokenBank;
```

- [x] **Step 4: Write the parser**

Create `src/lib/shared/pronunciation/pronunciation-manifest.ts`:

```ts
import {
  PRONUNCIATION_POSITIONS,
  type AnyPronunciationManifest,
  type PronunciationManifest,
  type PronunciationToken,
  type PronunciationTokenBank,
} from "./pronunciation-plan";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isPosition(value: unknown): boolean {
  return PRONUNCIATION_POSITIONS.includes(
    value as (typeof PRONUNCIATION_POSITIONS)[number]
  );
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isNullableLetter(value: unknown): boolean {
  return value === null || isNonEmptyString(value);
}

export function isPronunciationManifestV1(
  value: unknown
): value is PronunciationManifest {
  if (!isObject(value) || value.version !== 1 || !isObject(value.recordings)) {
    return false;
  }

  return Object.values(value.recordings).every((recordingSet) => {
    if (!isObject(recordingSet)) return false;
    return Object.entries(recordingSet).every(
      ([position, path]) => isPosition(position) && isNonEmptyString(path)
    );
  });
}

function isToken(value: unknown): value is PronunciationToken {
  if (!isObject(value)) return false;
  return (
    isNonEmptyString(value.path) &&
    isPosition(value.position) &&
    isNullableLetter(value.previousLetter) &&
    isNullableLetter(value.nextLetter) &&
    typeof value.sourceWord === "string" &&
    isFiniteNumber(value.indexInWord) &&
    isFiniteNumber(value.groupLength) &&
    isFiniteNumber(value.durationMs) &&
    isFiniteNumber(value.rmsDb) &&
    isFiniteNumber(value.f0StartHz) &&
    isFiniteNumber(value.f0EndHz)
  );
}

export function isPronunciationTokenBank(
  value: unknown
): value is PronunciationTokenBank {
  if (!isObject(value) || value.version !== 2 || !isObject(value.tokens)) {
    return false;
  }

  return Object.values(value.tokens).every(
    (tokens) => Array.isArray(tokens) && tokens.every(isToken)
  );
}

/**
 * Parse either manifest format. Returning null keeps a malformed manifest from
 * silently degrading playback into a half-loaded bank; the player falls through
 * to speech synthesis instead.
 */
export function parsePronunciationManifest(
  value: unknown
): AnyPronunciationManifest | null {
  if (isPronunciationTokenBank(value)) return value;
  if (isPronunciationManifestV1(value)) return value;
  return null;
}
```

- [x] **Step 5: Run the tests to verify they pass**

```bash
npm run test:ci -- tests/unit/pronunciation/pronunciation-manifest.test.ts
```

Expected: PASS, 6 tests.

- [x] **Step 6: Commit**

```bash
git commit -m "feat(pronunciation): version 2 token bank format and parser" -- src/lib/shared/pronunciation/pronunciation-plan.ts src/lib/shared/pronunciation/pronunciation-manifest.ts tests/unit/pronunciation/pronunciation-manifest.test.ts
```

---

### Task 5: Audio feature measurement

Loudness and edge pitch are the join-cost inputs. Pure functions over sample
data so they run identically in the browser recorder and in a Node script.

**Files:**
- Create: `src/lib/shared/pronunciation/domain/audio-features.ts`
- Test: `tests/unit/pronunciation/audio-features.test.ts`

- [x] **Step 1: Write the failing test**

Create `tests/unit/pronunciation/audio-features.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import {
  estimateF0Hz,
  measureRmsDb,
  measureTokenFeatures,
} from "$lib/shared/pronunciation/domain/audio-features";

const SAMPLE_RATE = 48_000;

function sine(frequencyHz: number, seconds: number, amplitude = 0.5) {
  const samples = new Float32Array(Math.round(SAMPLE_RATE * seconds));
  for (let index = 0; index < samples.length; index++) {
    samples[index] =
      amplitude * Math.sin((2 * Math.PI * frequencyHz * index) / SAMPLE_RATE);
  }
  return samples;
}

describe("measureRmsDb", () => {
  it("measures a known amplitude", () => {
    // RMS of a 0.5-amplitude sine is 0.3536, which is -9.03 dBFS.
    expect(measureRmsDb(sine(200, 0.5))).toBeCloseTo(-9.03, 1);
  });

  it("floors silence instead of returning negative infinity", () => {
    expect(measureRmsDb(new Float32Array(1000))).toBe(-100);
  });
});

describe("estimateF0Hz", () => {
  it("recovers a pitch inside the speech range", () => {
    const estimate = estimateF0Hz(sine(120, 0.3), SAMPLE_RATE);

    expect(estimate).not.toBeNull();
    expect(estimate!).toBeGreaterThan(117);
    expect(estimate!).toBeLessThan(123);
  });

  it("returns null for noise with no periodicity", () => {
    const samples = new Float32Array(SAMPLE_RATE * 0.3);
    let seed = 1;
    for (let index = 0; index < samples.length; index++) {
      seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
      samples[index] = seed / 1_073_741_824 - 1;
    }

    expect(estimateF0Hz(samples, SAMPLE_RATE)).toBeNull();
  });

  it("returns null when the buffer is too short to hold a period", () => {
    expect(estimateF0Hz(sine(120, 0.005), SAMPLE_RATE)).toBeNull();
  });
});

describe("measureTokenFeatures", () => {
  it("measures loudness once and pitch at both edges", () => {
    const features = measureTokenFeatures(sine(150, 0.4), SAMPLE_RATE);

    expect(features.rmsDb).toBeCloseTo(-9.03, 1);
    expect(features.f0StartHz).toBeGreaterThan(145);
    expect(features.f0EndHz).toBeGreaterThan(145);
    expect(features.durationMs).toBeCloseTo(400, 0);
  });

  it("falls back to zero pitch when no periodicity is found", () => {
    const features = measureTokenFeatures(new Float32Array(4800), SAMPLE_RATE);

    expect(features.f0StartHz).toBe(0);
    expect(features.f0EndHz).toBe(0);
  });
});
```

- [x] **Step 2: Run the test to verify it fails**

```bash
npm run test:ci -- tests/unit/pronunciation/audio-features.test.ts
```

Expected: FAIL. The module does not exist.

- [x] **Step 3: Write the implementation**

Create `src/lib/shared/pronunciation/domain/audio-features.ts`:

```ts
/** Quietest value reported, so silence never produces negative infinity. */
const SILENCE_FLOOR_DB = -100;

/** Human speech F0 range. Narrow enough to reject octave errors on noise. */
const MIN_F0_HZ = 70;
const MAX_F0_HZ = 350;

/** Correlation below this reads as unvoiced rather than a weak pitch. */
const MIN_CORRELATION = 0.3;

/** Window measured at each edge for the join cost. */
const EDGE_WINDOW_SECONDS = 0.06;

export interface TokenFeatures {
  durationMs: number;
  rmsDb: number;
  f0StartHz: number;
  f0EndHz: number;
}

export function measureRmsDb(samples: Float32Array): number {
  if (samples.length === 0) return SILENCE_FLOOR_DB;

  let sumSquares = 0;
  for (let index = 0; index < samples.length; index++) {
    const sample = samples[index] ?? 0;
    sumSquares += sample * sample;
  }

  const rms = Math.sqrt(sumSquares / samples.length);
  if (rms <= 0) return SILENCE_FLOOR_DB;
  return Math.max(SILENCE_FLOOR_DB, 20 * Math.log10(rms));
}

/**
 * Normalised autocorrelation pitch estimate. Normalising by the energy of both
 * windows keeps the score comparable across lags, so a loud low-frequency lag
 * cannot outscore the true period.
 */
export function estimateF0Hz(
  samples: Float32Array,
  sampleRate: number
): number | null {
  const minLag = Math.floor(sampleRate / MAX_F0_HZ);
  const maxLag = Math.floor(sampleRate / MIN_F0_HZ);
  if (samples.length < maxLag * 2) return null;

  let mean = 0;
  for (let index = 0; index < samples.length; index++) {
    mean += samples[index] ?? 0;
  }
  mean /= samples.length;

  const centred = new Float32Array(samples.length);
  for (let index = 0; index < samples.length; index++) {
    centred[index] = (samples[index] ?? 0) - mean;
  }

  let bestLag = -1;
  let bestScore = MIN_CORRELATION;

  for (let lag = minLag; lag <= maxLag; lag++) {
    let product = 0;
    let energyLeft = 0;
    let energyRight = 0;

    for (let index = 0; index + lag < centred.length; index++) {
      const left = centred[index] ?? 0;
      const right = centred[index + lag] ?? 0;
      product += left * right;
      energyLeft += left * left;
      energyRight += right * right;
    }

    const denominator = Math.sqrt(energyLeft * energyRight);
    if (denominator <= 0) continue;

    const score = product / denominator;
    if (score > bestScore) {
      bestScore = score;
      bestLag = lag;
    }
  }

  return bestLag > 0 ? sampleRate / bestLag : null;
}

export function measureTokenFeatures(
  samples: Float32Array,
  sampleRate: number
): TokenFeatures {
  const window = Math.min(
    samples.length,
    Math.round(sampleRate * EDGE_WINDOW_SECONDS)
  );

  return {
    durationMs: (samples.length / sampleRate) * 1000,
    rmsDb: measureRmsDb(samples),
    f0StartHz: estimateF0Hz(samples.slice(0, window), sampleRate) ?? 0,
    f0EndHz:
      estimateF0Hz(samples.slice(samples.length - window), sampleRate) ?? 0,
  };
}
```

- [x] **Step 4: Run the tests to verify they pass**

```bash
npm run test:ci -- tests/unit/pronunciation/audio-features.test.ts
```

Expected: PASS, 7 tests.

Watch the edge-window arithmetic. `maxLag` at 48 kHz is 685 samples, so
`estimateF0Hz` needs at least 1370 samples, and a 60 ms window is 2880. If the
`measureTokenFeatures` pitch assertions fail because a window is too short,
widen `EDGE_WINDOW_SECONDS` to 0.08 rather than lowering `MIN_F0_HZ`; lowering
the floor lets octave errors through.

- [x] **Step 5: Report the measured features from the Phase 0 script**

Nothing else in this plan consumes these functions, and a join cost built on
measurements nobody has looked at is a guess. Wire them into the Phase 0 output
so the numbers get checked against Austen's real voice before the selector is
trusted with them.

In `scripts/measure-word-segmentation.ts`, add the import:

```ts
import { measureTokenFeatures } from "../src/lib/shared/pronunciation/domain/audio-features";
```

Then inside the `result.segments.forEach` callback, after computing `start`,
`end`, and `label`, add the measurement and log line:

```ts
      const slice = samples.slice(start, end);
      const features = measureTokenFeatures(slice, sampleRate);
      console.log(
        `    ${label}  ${features.durationMs.toFixed(0)} ms  ${features.rmsDb.toFixed(1)} dB  f0 ${features.f0StartHz.toFixed(0)}->${features.f0EndHz.toFixed(0)} Hz`
      );
```

and change the existing `writeFileSync` call to reuse that slice:

```ts
      writeFileSync(
        join(sliceDirectory, `${entry.file}.${index}.${label}.wav`),
        encodeWav(slice, sampleRate)
      );
```

**What to look for when Austen runs it:** F0 values in the 80 to 180 Hz range and
changing gradually across a word, and RMS values clustered within a few dB.

Three failure signatures, and what each one means:

- **Zeros for F0 on most slices** — the correlation floor is too strict for his
  voice. Lower `MIN_CORRELATION`, not the frequency bounds.
- **Values pegged near 70 or 350 Hz** — the estimator has locked onto a harmonic
  or a subharmonic rather than the fundamental. Measured on synthetic
  harmonic-rich signals: a true 50 Hz fundamental reports 350 Hz, a true 400 Hz
  reports 200 Hz. A bounded-lag search cannot return null for an out-of-range
  fundamental, so it returns a confident wrong number instead; a cluster at
  either bound is the tell, never a plausible reading.
- **Wildly swinging RMS** — the join cost will dominate the target cost, and the
  weights in Task 6 need rebalancing before the bank is recorded.

For calibration, the estimator was verified on synthetic voice-shaped signals
before Austen recorded anything: exact within 0.2 Hz for fundamentals of 85,
100, 120, 145, 180, and 220 Hz, stable under additive noise, sample-rate
invariant from 16 kHz to 96 kHz, and on a token gliding 140 to 100 Hz it reports
136 to 103 — the edge windows average over 60 ms, so a contour reads slightly
pulled in at both ends. That inward pull is expected and is not drift.

- [x] **Step 6: Commit**

```bash
git commit -m "feat(pronunciation): measure token loudness and edge pitch" -- src/lib/shared/pronunciation/domain/audio-features.ts tests/unit/pronunciation/audio-features.test.ts scripts/measure-word-segmentation.ts
```

---

### Task 6: Token selection

**Files:**
- Create: `src/lib/shared/pronunciation/domain/token-selection.ts`
- Test: `tests/unit/pronunciation/token-selection.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/pronunciation/token-selection.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { selectTokenPath } from "$lib/shared/pronunciation/domain/token-selection";
import { createPronunciationPlan } from "$lib/shared/pronunciation/pronunciation-plan";
import type {
  PronunciationToken,
  PronunciationTokenBank,
} from "$lib/shared/pronunciation/pronunciation-plan";

function token(
  overrides: Partial<PronunciationToken> & Pick<PronunciationToken, "path">
): PronunciationToken {
  return {
    position: "initial",
    previousLetter: null,
    nextLetter: null,
    sourceWord: "AB",
    indexInWord: 0,
    groupLength: 2,
    durationMs: 300,
    rmsDb: -18,
    f0StartHz: 120,
    f0EndHz: 120,
    ...overrides,
  };
}

function cuesFor(word: string) {
  const plan = createPronunciationPlan(word);
  if (!plan) throw new Error(`Invalid test word: ${word}`);
  return plan.cues;
}

describe("selectTokenPath", () => {
  it("rejects the word when a letter has no tokens", () => {
    const bank: PronunciationTokenBank = {
      version: 2,
      tokens: { a: [token({ path: "a/1.wav" })] },
    };

    expect(selectTokenPath(cuesFor("AB"), bank)).toBeNull();
  });

  it("rejects the word when tokens exist but never in the needed position", () => {
    const bank: PronunciationTokenBank = {
      version: 2,
      tokens: {
        a: [token({ path: "a/1.wav", position: "initial" })],
        b: [token({ path: "b/1.wav", position: "initial" })],
      },
    };

    // "AB" needs b in final position; only an initial b exists.
    expect(selectTokenPath(cuesFor("AB"), bank)).toBeNull();
  });

  it("prefers the token whose real neighbours match the target", () => {
    const bank: PronunciationTokenBank = {
      version: 2,
      tokens: {
        a: [
          token({ path: "a/wrong.wav", position: "initial", nextLetter: "C" }),
          token({ path: "a/right.wav", position: "initial", nextLetter: "B" }),
        ],
        b: [token({ path: "b/1.wav", position: "final", previousLetter: "A" })],
      },
    };

    const path = selectTokenPath(cuesFor("AB"), bank);

    expect(path?.map((entry) => entry.path)).toEqual([
      "a/right.wav",
      "b/1.wav",
    ]);
  });

  it("breaks a tie toward pitch continuity at the join", () => {
    const bank: PronunciationTokenBank = {
      version: 2,
      tokens: {
        a: [
          token({
            path: "a/only.wav",
            position: "initial",
            nextLetter: "B",
            f0EndHz: 130,
          }),
        ],
        b: [
          token({
            path: "b/jumpy.wav",
            position: "final",
            previousLetter: "A",
            f0StartHz: 180,
          }),
          token({
            path: "b/smooth.wav",
            position: "final",
            previousLetter: "A",
            f0StartHz: 132,
          }),
        ],
      },
    };

    const path = selectTokenPath(cuesFor("AB"), bank);

    expect(path?.map((entry) => entry.path)).toEqual([
      "a/only.wav",
      "b/smooth.wav",
    ]);
  });

  it("breaks a tie toward matching loudness at the join", () => {
    const bank: PronunciationTokenBank = {
      version: 2,
      tokens: {
        a: [
          token({
            path: "a/only.wav",
            position: "initial",
            nextLetter: "B",
            rmsDb: -18,
          }),
        ],
        b: [
          token({
            path: "b/loud.wav",
            position: "final",
            previousLetter: "A",
            rmsDb: -6,
          }),
          token({
            path: "b/level.wav",
            position: "final",
            previousLetter: "A",
            rmsDb: -18.5,
          }),
        ],
      },
    };

    const path = selectTokenPath(cuesFor("AB"), bank);

    expect(path?.map((entry) => entry.path)).toEqual([
      "a/only.wav",
      "b/level.wav",
    ]);
  });

  it("resolves an isolated group against isolated tokens", () => {
    const bank: PronunciationTokenBank = {
      version: 2,
      tokens: {
        a: [
          token({
            path: "a/solo.wav",
            position: "isolated",
            sourceWord: "A",
            groupLength: 1,
          }),
        ],
      },
    };

    const path = selectTokenPath(cuesFor("A"), bank);

    expect(path?.map((entry) => entry.path)).toEqual(["a/solo.wav"]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm run test:ci -- tests/unit/pronunciation/token-selection.test.ts
```

Expected: FAIL. The module does not exist.

- [ ] **Step 3: Write the implementation**

Create `src/lib/shared/pronunciation/domain/token-selection.ts`:

```ts
import type {
  PronunciationCue,
  PronunciationToken,
  PronunciationTokenBank,
} from "../pronunciation-plan";

/**
 * Weights are tuned by ear, not by test. A neighbour mismatch is the dominant
 * penalty because coarticulation is what the bank exists to preserve; the join
 * costs are deliberately small so they act as tie-breakers between tokens that
 * already match context, not as overrides of it.
 */
const NEIGHBOUR_MISMATCH_COST = 1;
const LENGTH_MISMATCH_COST = 0.15;
const F0_JOIN_COST_PER_HZ = 0.01;
const RMS_JOIN_COST_PER_DB = 0.1;

interface CueNeighbours {
  previousLetter: string | null;
  nextLetter: string | null;
}

/**
 * A cue's real neighbours inside its own group. Position already encodes the
 * group edges, so an initial cue reports no predecessor even when another group
 * precedes it; a token recorded at a word edge is the right match there.
 */
export function cueNeighbours(
  cues: readonly PronunciationCue[],
  index: number
): CueNeighbours {
  const cue = cues[index]!;
  const atStart = cue.position === "initial" || cue.position === "isolated";
  const atEnd = cue.position === "final" || cue.position === "isolated";

  return {
    previousLetter: atStart ? null : (cues[index - 1]?.letter ?? null),
    nextLetter: atEnd ? null : (cues[index + 1]?.letter ?? null),
  };
}

export function targetCost(
  token: PronunciationToken,
  cue: PronunciationCue,
  neighbours: CueNeighbours
): number {
  let cost = 0;
  if (token.previousLetter !== neighbours.previousLetter) {
    cost += NEIGHBOUR_MISMATCH_COST;
  }
  if (token.nextLetter !== neighbours.nextLetter) {
    cost += NEIGHBOUR_MISMATCH_COST;
  }
  cost += LENGTH_MISMATCH_COST * Math.abs(token.groupLength - cue.groupLength);
  return cost;
}

export function joinCost(
  left: PronunciationToken,
  right: PronunciationToken
): number {
  return (
    F0_JOIN_COST_PER_HZ * Math.abs(left.f0EndHz - right.f0StartHz) +
    RMS_JOIN_COST_PER_DB * Math.abs(left.rmsDb - right.rmsDb)
  );
}

/**
 * Cheapest path through the candidate tokens for a plan. Returns null when any
 * cue has no candidate, which keeps the caller's all-or-nothing rule intact so
 * a word never mixes recorded and synthetic voices.
 */
export function selectTokenPath(
  cues: readonly PronunciationCue[],
  bank: PronunciationTokenBank
): PronunciationToken[] | null {
  if (cues.length === 0) return null;

  const candidates = cues.map((cue) =>
    (bank.tokens[cue.assetKey] ?? []).filter(
      (token) => token.position === cue.position
    )
  );
  if (candidates.some((options) => options.length === 0)) return null;

  interface PathCost {
    cost: number;
    path: number[];
  }

  let frontier: PathCost[] = candidates[0]!.map((token, tokenIndex) => ({
    cost: targetCost(token, cues[0]!, cueNeighbours(cues, 0)),
    path: [tokenIndex],
  }));

  for (let index = 1; index < cues.length; index++) {
    const neighbours = cueNeighbours(cues, index);
    const previousOptions = candidates[index - 1]!;

    frontier = candidates[index]!.map((token, tokenIndex) => {
      let best: PathCost | null = null;

      for (const entry of frontier) {
        const leftToken = previousOptions[entry.path.at(-1)!]!;
        const cost = entry.cost + joinCost(leftToken, token);
        if (best === null || cost < best.cost) {
          best = { cost, path: [...entry.path, tokenIndex] };
        }
      }

      return {
        cost: best!.cost + targetCost(token, cues[index]!, neighbours),
        path: best!.path,
      };
    });
  }

  const winner = frontier.reduce((best, entry) =>
    entry.cost < best.cost ? entry : best
  );

  return winner.path.map((tokenIndex, index) => candidates[index]![tokenIndex]!);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npm run test:ci -- tests/unit/pronunciation/token-selection.test.ts
```

Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(pronunciation): select tokens by context match and join cost" -- src/lib/shared/pronunciation/domain/token-selection.ts tests/unit/pronunciation/token-selection.test.ts
```

---

### Task 7: Wire the player to both manifest versions

**Files:**
- Modify: `src/lib/shared/pronunciation/services/pronunciation-player.ts:1-14,33-55,65,149-215`
- Test: `tests/unit/pronunciation/pronunciation-player.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `tests/unit/pronunciation/pronunciation-player.test.ts`:

```ts
describe("PronunciationPlayer manifest versions", () => {
  function tokenBankResponse(tokens: Record<string, unknown[]>) {
    return {
      ok: true,
      status: 200,
      json: async () => ({ version: 2, tokens }),
    } as Response;
  }

  it("accepts a version 2 bank and still caches it across words", async () => {
    const speechFallback = {
      isSupported: () => true,
      speak: vi.fn().mockResolvedValue(undefined),
      cancel: vi.fn(),
    };
    const fetcher = vi.fn().mockResolvedValue(
      tokenBankResponse({
        a: [
          {
            path: "a/1.wav",
            position: "isolated",
            previousLetter: null,
            nextLetter: null,
            sourceWord: "A",
            indexInWord: 0,
            groupLength: 1,
            durationMs: 300,
            rmsDb: -18,
            f0StartHz: 120,
            f0EndHz: 120,
          },
        ],
      })
    );
    const player = new PronunciationPlayer({ speechFallback, fetcher });

    await player.speak("A");
    await player.speak("B");

    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("falls back to speech when a version 2 bank cannot cover the word", async () => {
    const speechFallback = {
      isSupported: () => true,
      speak: vi.fn().mockResolvedValue(undefined),
      cancel: vi.fn(),
    };
    const fetcher = vi.fn().mockResolvedValue(tokenBankResponse({}));
    const player = new PronunciationPlayer({ speechFallback, fetcher });

    await expect(player.speak("AB")).resolves.toEqual({ source: "synthetic" });
    expect(speechFallback.speak).toHaveBeenCalledWith("A, B.");
  });

  it("falls back to speech when the manifest shape is unrecognised", async () => {
    const speechFallback = {
      isSupported: () => true,
      speak: vi.fn().mockResolvedValue(undefined),
      cancel: vi.fn(),
    };
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ version: 9, whatever: true }),
    } as Response);
    const player = new PronunciationPlayer({ speechFallback, fetcher });

    await expect(player.speak("A")).resolves.toEqual({ source: "synthetic" });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm run test:ci -- tests/unit/pronunciation/pronunciation-player.test.ts
```

Expected: FAIL on the version 2 cases. The player's private
`isPronunciationManifest` rejects `version: 2`, so `loadManifest` resolves null
and the fetcher is retried rather than cached.

- [ ] **Step 3: Replace the private guard with the shared parser**

In `pronunciation-player.ts`, change the imports. Drop `PRONUNCIATION_POSITIONS`
and `PronunciationManifest`, add the parser, the selector, and the union type:

```ts
import { getTTSProvider } from "$lib/shared/voice-control/get-tts-provider";
import { selectTokenPath } from "../domain/token-selection";
import { parsePronunciationManifest } from "../pronunciation-manifest";
import {
  createPronunciationPlan,
  resolveRecordedCuePaths,
  type AnyPronunciationManifest,
  type PronunciationCue,
} from "../pronunciation-plan";
import type {
  IPronunciationPlayer,
  PronunciationPlaybackResult,
} from "./types";
```

Delete the now-unused local `isObject` and `isPronunciationManifest` functions
(lines 33 through 55).

Change the cached manifest field's type:

```ts
  private manifestPromise: Promise<AnyPronunciationManifest | null> | null =
    null;
```

In `loadManifest`, replace the shape check:

```ts
        const value: unknown = await response.json();
        const manifest = parsePronunciationManifest(value);
        if (!manifest) {
          throw new Error("Pronunciation manifest has an invalid shape");
        }
        return manifest;
```

In `tryRecordedPlayback`, replace the single `resolveRecordedCuePaths` call with
version dispatch:

```ts
    const paths =
      manifest.version === 2
        ? (selectTokenPath(cues, manifest)?.map((token) => token.path) ?? null)
        : resolveRecordedCuePaths(cues, manifest);
    if (!paths) return null;
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npm run test:ci -- tests/unit/pronunciation/
```

Expected: PASS across all pronunciation suites.

Note what these tests do and do not prove. jsdom has no `AudioContext`, so
`getAudioContext` returns null and every path ends at the speech fallback. These
assert manifest parsing, caching, and graceful degradation. Selection
correctness is proved by Task 6 against the pure function, and audible join
quality is proved only by the listening pass in the recording guide.

- [ ] **Step 5: Typecheck the touched surface**

```bash
npm run type-check
```

Expected: no errors. `svelte-check` only reads `.svelte` files, so plain
TypeScript modules need `type-check` to be covered.

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(pronunciation): resolve playback paths from either manifest version" -- src/lib/shared/pronunciation/services/pronunciation-player.ts tests/unit/pronunciation/pronunciation-player.test.ts
```

---

## Done when

- `npm run test:ci -- tests/unit/pronunciation/` passes.
- `npm run type-check` passes.
- A hand-authored `manifest.json` at version 2 plays a word through unit
  selection in the running app, returning `source: "recorded"`.
- Phase 0 has run and its result is recorded in the design document, naming the
  segmenter the recording-tool plan will use.

## Not in this plan

The Lab corpus recording mode, the coverage planner that generates the reading
script, the review screen for flagged words, and the v2 rewrite of
`scripts/build-pronunciation-manifest.ts`. Those form the second plan, written
once Phase 0 has settled the segmenter.
