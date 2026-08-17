# Pronunciation Corpus Recording Session Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A page Austen opens, presses one button, and reads aloud from — advancing itself word to word and finishing on its own — whose output is cut into a per-letter pronunciation token bank offline by a forced aligner.

**Architecture:** The browser captures 48 kHz mono audio into an AudioWorklet ring and decides only *when a word ended*, using Silero v5 through `@ricky0123/vad-web` (recurrent, therefore causal — unlike the energy detector this replaces, whose threshold needs the whole word first). Each advance drains the ring into a 24-bit WAV and writes `<id>.wav` + `<id>.lab` — the Montreal Forced Aligner corpus format — alongside the `words.json` the existing TS harness reads. Offline, MFA 3.0 aligns each known transcript to its audio and reports letter boundaries under 15 ms of error; Python cuts the tokens, TypeScript measures their features (one implementation of F0, the tested one), and faster-whisper flags misreads.

**Tech Stack:** SvelteKit 5 (runes) · TypeScript · AudioWorklet + Web Audio · `@ricky0123/vad-web` (Silero v5, ONNX Runtime Web) · File System Access API with a JSZip fallback · Vitest · Python 3.11 + Montreal Forced Aligner 3.0 (conda) + faster-whisper

**Spec:** `docs/superpowers/specs/2026-08-16-pronunciation-corpus-session-design.md`

---

## Status — 2026-08-16

Tasks 1 through 17 are landed. The pronunciation suite is green (126 tests,
15 files) and `svelte-check` reports 0 errors repo-wide. The corpus is 47
letters x 4 positions = 188 cells, not the 216 this plan was written against:
MCP `list_available_letters` returns 47, and the seven extra `Letter` enum
entries (zeta, eta, tau, terra, mu, nu, tau-) are position names that can
never sit inside a word. `planWords` now takes the letter list, and
`static/data/pronunciation-word-pool.json` carries it.

**Task 18 is the only one open, and it is blocked on two things Austen owns:**

1. **Miniconda is not installed.** MFA 3.0 ships compiled Kaldi binaries with
   no pip wheel, so Tasks 14-17 are written and typechecked but have never
   been run against a real alignment.
2. **No recording exists yet.** Step 2 is a real ten-word session in Austen's
   voice; nothing automated substitutes for listening to the token edges.

Step 1 (suite + typecheck) and Steps 3-4 (the amendment to the parent corpus
design) are done.

## File Structure

**New — pure domain (browser, all unit-tested):**

| File | Responsibility |
|---|---|
| `src/lib/features/lab/pronunciation-recorder/domain/letter-syllables.ts` | Syllable count per TKA letter. The only input to the plausibility check. |
| `.../domain/wav-encoder.ts` | `Float32Array` → 24-bit PCM WAV `Blob`. |
| `.../domain/sample-ring.ts` | Fixed-capacity sample ring with an absolute sample clock. |
| `.../domain/read-plausibility.ts` | Running seconds-per-syllable rate; verdict on one read. |
| `.../domain/session-queue.ts` | Word order, re-queue at a distance, retirement. |
| `.../domain/session-abort.ts` | Systematic-failure detection. |
| `.../domain/corpus-plan.ts` | 216-cell coverage planner over a word pool. |

**New — services (browser):**

| File | Responsibility |
|---|---|
| `static/worklets/pronunciation-capture-processor.js` | `AudioWorkletProcessor` posting raw frames. |
| `.../services/contracts/IAudioRingCapture.ts` | Capture interface. |
| `.../services/implementations/AudioRingCapture.ts` | Worklet graph + `SampleRing`. |
| `.../services/contracts/ISpeechBoundaryDetector.ts` | "Speech started / ended at T" interface. |
| `.../services/implementations/SileroBoundaryDetector.ts` | `MicVAD` wired to the shared stream. |
| `.../services/contracts/ICorpusSessionStore.ts` | Session output interface. |
| `.../services/implementations/CorpusSessionStore.ts` | Directory handle or zip; writes wav/lab/words.json/session.json. |

**New — UI and state (browser):**

| File | Responsibility |
|---|---|
| `.../state/corpus-session-state.svelte.ts` | The session machine. |
| `.../components/CorpusSessionScreen.svelte` | Prompt, next prompt, level meter, one button. |
| `.../components/SessionReport.svelte` | End-of-session retired/starved report. |

**New — scripts and offline tools:**

| File | Responsibility |
|---|---|
| `scripts/build-pronunciation-word-pool.ts` | Walks the engine's transition graph → `static/data/pronunciation-word-pool.json`. |
| `scripts/build-token-bank.ts` | Token WAVs + partial bank → v2 `PronunciationTokenBank`. |
| `tools/pronunciation/environment.yml` | Conda env: MFA 3.0, faster-whisper. |
| `tools/pronunciation/tka-letters.dict` | ARPAbet entries for OOV TKA letter names. |
| `tools/pronunciation/align.py` | `mfa validate` + `mfa align` over a session directory. |
| `tools/pronunciation/cut_tokens.py` | TextGrid → token WAVs + partial bank JSON. |
| `tools/pronunciation/verify.py` | faster-whisper misread flagging. |
| `tools/pronunciation/README.md` | The whole offline runbook. |

**Deleted:** `domain/recording-jobs.ts`, `domain/recording-manifest.ts`, `components/RecordingWorkspace.svelte`, `components/RecordingInventory.svelte`, `state/pronunciation-recorder-state.svelte.ts`, `services/contracts/IPronunciationTakeStore.ts`, `services/implementations/PronunciationTakeStore.ts`, `get-pronunciation-take-store.ts`, and the take methods on `IPronunciationRecorder`.

**Kept:** `voice-activity-trimmer.ts` (Phase 0 diagnostic and MFA-absent fallback), `TakeWaveform.svelte` (the report), `context/pronunciation-recorder-context.ts`, `IPronunciationRecorder.connect/listMicrophones/isSupported/dispose`.

---

## Task 1: Letter syllable table

The plausibility check needs to know how long a word *should* take. Syllables are the only per-letter quantity that predicts that, and they cannot be derived from the spoken name by rule — "W" is three syllables, "Psi" is one, "Omega" is three.

**Files:**
- Create: `src/lib/features/lab/pronunciation-recorder/domain/letter-syllables.ts`
- Test: `tests/unit/pronunciation/letter-syllables.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/pronunciation/letter-syllables.test.ts
import { describe, expect, it } from "vitest";

import { Letter } from "$lib/shared/foundation/domain/models/letter";
import { syllablesOf, syllablesInWord } from "$lib/features/lab/pronunciation-recorder/domain/letter-syllables";

describe("syllablesOf", () => {
  it("covers every letter in the alphabet", () => {
    // A missing letter would silently read as one syllable and make every word
    // containing it look overrun, so it would be re-queued until it retired.
    for (const letter of Object.values(Letter)) {
      expect(syllablesOf(letter), `missing ${letter}`).toBeGreaterThan(0);
    }
  });

  it("counts the names that a rule would get wrong", () => {
    expect(syllablesOf(Letter.W)).toBe(3); // "double-you"
    expect(syllablesOf(Letter.PSI)).toBe(1); // "sigh"
    expect(syllablesOf(Letter.OMEGA)).toBe(3);
    expect(syllablesOf(Letter.A)).toBe(1);
  });

  it("adds one syllable for the spoken dash", () => {
    expect(syllablesOf(Letter.W_DASH)).toBe(syllablesOf(Letter.W) + 1);
    expect(syllablesOf(Letter.SIGMA_DASH)).toBe(syllablesOf(Letter.SIGMA) + 1);
  });

  it("sums a word", () => {
    expect(syllablesInWord([Letter.ALPHA, Letter.W, Letter.PSI])).toBe(6);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/pronunciation/letter-syllables.test.ts`
Expected: FAIL — `Failed to resolve import ".../letter-syllables"`

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/features/lab/pronunciation-recorder/domain/letter-syllables.ts
import { Letter } from "$lib/shared/foundation/domain/models/letter";

/**
 * Syllables in each letter's spoken name, as `getLetterPronunciation` produces
 * it. Written out rather than derived: no rule turns "W" into three syllables
 * and "Psi" into one, and a wrong count does not fail loudly — it makes the
 * session re-queue a perfectly good read until the word retires.
 */
const SYLLABLES: Record<string, number> = {
  [Letter.A]: 1, [Letter.B]: 1, [Letter.C]: 1, [Letter.D]: 1, [Letter.E]: 1,
  [Letter.F]: 1, [Letter.G]: 1, [Letter.H]: 1, [Letter.I]: 1, [Letter.J]: 1,
  [Letter.K]: 1, [Letter.L]: 1, [Letter.M]: 1, [Letter.N]: 1, [Letter.O]: 1,
  [Letter.P]: 1, [Letter.Q]: 1, [Letter.R]: 1, [Letter.S]: 1, [Letter.T]: 1,
  [Letter.U]: 1, [Letter.V]: 1,

  [Letter.W]: 3, [Letter.X]: 1, [Letter.Y]: 1, [Letter.Z]: 1,
  [Letter.SIGMA]: 2, [Letter.DELTA]: 2, [Letter.THETA]: 2, [Letter.OMEGA]: 3,
  [Letter.MU]: 1, [Letter.NU]: 1,

  [Letter.W_DASH]: 4, [Letter.X_DASH]: 2, [Letter.Y_DASH]: 2, [Letter.Z_DASH]: 2,
  [Letter.SIGMA_DASH]: 3, [Letter.DELTA_DASH]: 3, [Letter.THETA_DASH]: 3,
  [Letter.OMEGA_DASH]: 4,

  [Letter.PHI]: 1, [Letter.PSI]: 1, [Letter.LAMBDA]: 2, [Letter.TAU_DASH]: 2,

  [Letter.PHI_DASH]: 2, [Letter.PSI_DASH]: 2, [Letter.LAMBDA_DASH]: 3,

  [Letter.ALPHA]: 2, [Letter.BETA]: 2, [Letter.GAMMA]: 2, [Letter.ZETA]: 2,
  [Letter.ETA]: 2, [Letter.TAU]: 1, [Letter.TERRA]: 2,
};

export function syllablesOf(letter: string): number {
  return SYLLABLES[letter] ?? 0;
}

export function syllablesInWord(letters: readonly string[]): number {
  return letters.reduce((total, letter) => total + syllablesOf(letter), 0);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/pronunciation/letter-syllables.test.ts`
Expected: PASS, 4 tests

- [ ] **Step 5: Commit**

```bash
git add tests/unit/pronunciation/letter-syllables.test.ts src/lib/features/lab/pronunciation-recorder/domain/letter-syllables.ts
git commit -m "feat(pronunciation): syllable counts per TKA letter" -- tests/unit/pronunciation/letter-syllables.test.ts src/lib/features/lab/pronunciation-recorder/domain/letter-syllables.ts
```

---

## Task 2: 24-bit PCM WAV encoder

The ring hands out `Float32Array`. MFA, `measure-word-segmentation.ts`, and the browser's own decoder all read WAV. Nothing in the tree encodes one from raw samples — `mediabunny` did it as part of the capture path this replaces.

**Files:**
- Create: `src/lib/features/lab/pronunciation-recorder/domain/wav-encoder.ts`
- Test: `tests/unit/pronunciation/wav-encoder.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/pronunciation/wav-encoder.test.ts
import { describe, expect, it } from "vitest";

import { encodeWav24 } from "$lib/features/lab/pronunciation-recorder/domain/wav-encoder";

async function bytesOf(blob: Blob): Promise<DataView> {
  return new DataView(await blob.arrayBuffer());
}

function ascii(view: DataView, offset: number, length: number): string {
  let text = "";
  for (let index = 0; index < length; index++) {
    text += String.fromCharCode(view.getUint8(offset + index));
  }
  return text;
}

describe("encodeWav24", () => {
  it("writes a canonical mono 24-bit header", async () => {
    const view = await bytesOf(encodeWav24(new Float32Array(10), 48_000));

    expect(ascii(view, 0, 4)).toBe("RIFF");
    expect(ascii(view, 8, 4)).toBe("WAVE");
    expect(view.getUint16(20, true)).toBe(1); // PCM, not float — Kaldi reads this
    expect(view.getUint16(22, true)).toBe(1); // mono
    expect(view.getUint32(24, true)).toBe(48_000);
    expect(view.getUint32(28, true)).toBe(48_000 * 3); // byte rate
    expect(view.getUint16(32, true)).toBe(3); // block align
    expect(view.getUint16(34, true)).toBe(24);
    expect(ascii(view, 36, 4)).toBe("data");
    expect(view.getUint32(40, true)).toBe(30);
    expect(view.byteLength).toBe(74);
  });

  it("round-trips positive and negative samples as little-endian two's complement", async () => {
    const view = await bytesOf(encodeWav24(new Float32Array([1, -1, 0]), 48_000));

    const read = (index: number) => {
      const offset = 44 + index * 3;
      const raw =
        view.getUint8(offset) |
        (view.getUint8(offset + 1) << 8) |
        (view.getUint8(offset + 2) << 16);
      return raw >= 0x800000 ? raw - 0x1000000 : raw;
    };

    expect(read(0)).toBe(8_388_607);
    expect(read(1)).toBe(-8_388_607);
    expect(read(2)).toBe(0);
  });

  it("clamps out-of-range samples instead of wrapping them", async () => {
    // A sample above 1.0 that wraps produces a full-scale click of the OPPOSITE
    // sign in the middle of a letter, which survives every downstream check.
    const view = await bytesOf(encodeWav24(new Float32Array([4, -4]), 48_000));
    const read = (index: number) => {
      const offset = 44 + index * 3;
      const raw =
        view.getUint8(offset) |
        (view.getUint8(offset + 1) << 8) |
        (view.getUint8(offset + 2) << 16);
      return raw >= 0x800000 ? raw - 0x1000000 : raw;
    };

    expect(read(0)).toBe(8_388_607);
    expect(read(1)).toBe(-8_388_607);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/pronunciation/wav-encoder.test.ts`
Expected: FAIL — cannot resolve `wav-encoder`

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/features/lab/pronunciation-recorder/domain/wav-encoder.ts
const BYTES_PER_SAMPLE = 3;
const HEADER_BYTES = 44;
const FULL_SCALE = 8_388_607; // 2^23 - 1

function writeAscii(view: DataView, offset: number, text: string): void {
  for (let index = 0; index < text.length; index++) {
    view.setUint8(offset + index, text.charCodeAt(index));
  }
}

/**
 * Mono 24-bit PCM WAV. 24-bit rather than 32-bit float because the aligner's
 * chain reaches Kaldi, whose WAV reader is reliable on integer PCM and is not
 * on IEEE-float WAV; and integer rather than 16-bit because these files are the
 * source the token bank is cut from, not a transcription input.
 */
export function encodeWav24(samples: Float32Array, sampleRate: number): Blob {
  const dataBytes = samples.length * BYTES_PER_SAMPLE;
  const buffer = new ArrayBuffer(HEADER_BYTES + dataBytes);
  const view = new DataView(buffer);

  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * BYTES_PER_SAMPLE, true);
  view.setUint16(32, BYTES_PER_SAMPLE, true);
  view.setUint16(34, 24, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, dataBytes, true);

  let offset = HEADER_BYTES;
  for (let index = 0; index < samples.length; index++) {
    const sample = samples[index] ?? 0;
    const clamped = Math.max(-1, Math.min(1, Number.isFinite(sample) ? sample : 0));
    const value = Math.round(clamped * FULL_SCALE);
    view.setUint8(offset, value & 0xff);
    view.setUint8(offset + 1, (value >> 8) & 0xff);
    view.setUint8(offset + 2, (value >> 16) & 0xff);
    offset += BYTES_PER_SAMPLE;
  }

  return new Blob([buffer], { type: "audio/wav" });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/pronunciation/wav-encoder.test.ts`
Expected: PASS, 3 tests

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(pronunciation): 24-bit PCM WAV encoder" -- tests/unit/pronunciation/wav-encoder.test.ts src/lib/features/lab/pronunciation-recorder/domain/wav-encoder.ts
```

---

## Task 3: The sample ring

Capture is continuous; words are cut out of it after the fact, using timestamps the VAD reports. A ring keeps memory flat (30 s ≈ 5.7 MB) while giving every sample an absolute index, so a word boundary is a number rather than a buffer identity. The wrap case is the one that corrupts audio silently, so it is tested first.

**Files:**
- Create: `src/lib/features/lab/pronunciation-recorder/domain/sample-ring.ts`
- Test: `tests/unit/pronunciation/sample-ring.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/pronunciation/sample-ring.test.ts
import { describe, expect, it } from "vitest";

import { SampleRing } from "$lib/features/lab/pronunciation-recorder/domain/sample-ring";

function ramp(from: number, count: number): Float32Array {
  const samples = new Float32Array(count);
  for (let index = 0; index < count; index++) samples[index] = from + index;
  return samples;
}

describe("SampleRing", () => {
  it("reads back a span written in one chunk", () => {
    const ring = new SampleRing(100);
    ring.write(ramp(0, 20));

    expect(Array.from(ring.read(5, 10)!)).toEqual([5, 6, 7, 8, 9]);
  });

  it("tracks an absolute sample clock across writes", () => {
    const ring = new SampleRing(100);
    ring.write(ramp(0, 20));
    ring.write(ramp(20, 20));

    expect(ring.writtenSamples).toBe(40);
    expect(Array.from(ring.read(18, 22)!)).toEqual([18, 19, 20, 21]);
  });

  it("reads a span that straddles the wrap point in order", () => {
    // The failure this exists for: a word that begins just before the ring
    // wraps comes back with its halves swapped. It still decodes, still has the
    // right duration, and is audibly wrong in a way no automated check catches.
    const ring = new SampleRing(10);
    ring.write(ramp(0, 8));
    ring.write(ramp(8, 6)); // wraps: absolute 4..13 now live

    expect(Array.from(ring.read(6, 12)!)).toEqual([6, 7, 8, 9, 10, 11]);
  });

  it("returns null for a span that has already been overwritten", () => {
    const ring = new SampleRing(10);
    ring.write(ramp(0, 25));

    expect(ring.read(0, 5)).toBeNull();
    expect(ring.read(20, 25)).not.toBeNull();
  });

  it("returns null for a span that runs past what has been written", () => {
    const ring = new SampleRing(100);
    ring.write(ramp(0, 20));

    expect(ring.read(15, 25)).toBeNull();
  });

  it("accepts a write larger than its own capacity", () => {
    const ring = new SampleRing(10);
    ring.write(ramp(0, 30));

    expect(ring.writtenSamples).toBe(30);
    expect(Array.from(ring.read(25, 30)!)).toEqual([25, 26, 27, 28, 29]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/pronunciation/sample-ring.test.ts`
Expected: FAIL — cannot resolve `sample-ring`

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/features/lab/pronunciation-recorder/domain/sample-ring.ts
/**
 * Fixed-capacity sample ring with an absolute sample clock.
 *
 * Capture runs for the whole session, but a word is a span of it. Holding the
 * session as one buffer costs half a gigabyte; holding it as chunks puts a
 * decode between two words. A ring does neither: memory is flat, and every
 * sample keeps a monotonic index, so the boundary the detector reports is
 * directly the boundary the encoder cuts at.
 */
export class SampleRing {
  private readonly buffer: Float32Array;
  private written = 0;

  constructor(private readonly capacity: number) {
    this.buffer = new Float32Array(capacity);
  }

  /** Total samples ever written — the absolute clock. */
  get writtenSamples(): number {
    return this.written;
  }

  write(chunk: Float32Array): void {
    // A chunk longer than the ring can only leave its tail behind, and copying
    // the head first would leave the ring holding the wrong end of it.
    const from = Math.max(0, chunk.length - this.capacity);
    for (let index = from; index < chunk.length; index++) {
      this.buffer[(this.written + index) % this.capacity] = chunk[index] ?? 0;
    }
    this.written += chunk.length;
  }

  /**
   * Samples in `[fromAbsolute, toAbsolute)`, or null when the span is not
   * entirely present — either already overwritten or not yet recorded. Null is
   * the honest answer; returning a partial span would emit a truncated word
   * that looks complete.
   */
  read(fromAbsolute: number, toAbsolute: number): Float32Array | null {
    const oldest = Math.max(0, this.written - this.capacity);
    if (fromAbsolute < oldest || toAbsolute > this.written) return null;
    if (toAbsolute <= fromAbsolute) return new Float32Array(0);

    const out = new Float32Array(toAbsolute - fromAbsolute);
    for (let index = 0; index < out.length; index++) {
      out[index] = this.buffer[(fromAbsolute + index) % this.capacity] ?? 0;
    }
    return out;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/pronunciation/sample-ring.test.ts`
Expected: PASS, 6 tests

- [ ] **Step 5: Prove the wrap test can fail**

Temporarily replace the index expression in `read` with `this.buffer[index]` and re-run. Expected: the wrap test fails. Restore the correct line and re-run to PASS. A ring test that has never been observed to fail is not evidence.

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(pronunciation): sample ring with an absolute clock" -- tests/unit/pronunciation/sample-ring.test.ts src/lib/features/lab/pronunciation-recorder/domain/sample-ring.ts
```

---

## Task 4: Read plausibility

The aligner is offline, so the session needs a local answer to "did he read the whole word." It uses expected duration rather than counting anything — the counting approach is what the spec rewrite removed.

**Files:**
- Create: `src/lib/features/lab/pronunciation-recorder/domain/read-plausibility.ts`
- Test: `tests/unit/pronunciation/read-plausibility.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/pronunciation/read-plausibility.test.ts
import { describe, expect, it } from "vitest";

import { createRateTracker } from "$lib/features/lab/pronunciation-recorder/domain/read-plausibility";

describe("createRateTracker", () => {
  it("passes everything until it has seen enough reads to have a rate", () => {
    // Seeding on the first reads is the point: Austen's pace is not known in
    // advance, and a guessed rate would reject his real one.
    const tracker = createRateTracker();

    expect(tracker.judge(4, 0.2)).toBe("ok");
    tracker.observe(4, 0.2);
    expect(tracker.judge(4, 9)).toBe("ok");
  });

  it("flags a read cut short once the rate is established", () => {
    const tracker = createRateTracker();
    for (const seconds of [1.2, 1.2, 1.2]) tracker.observe(4, seconds);

    expect(tracker.judge(4, 1.2)).toBe("ok");
    expect(tracker.judge(4, 0.5)).toBe("too-short");
  });

  it("flags a stumble or a restart", () => {
    const tracker = createRateTracker();
    for (const seconds of [1.2, 1.2, 1.2]) tracker.observe(4, seconds);

    expect(tracker.judge(4, 3.0)).toBe("too-long");
  });

  it("scales expectation with the word, not with a fixed duration", () => {
    const tracker = createRateTracker();
    for (const seconds of [1.2, 1.2, 1.2]) tracker.observe(4, seconds);

    expect(tracker.judge(12, 3.6)).toBe("ok");
    expect(tracker.judge(2, 3.6)).toBe("too-long");
  });

  it("follows a pace that drifts across a sitting", () => {
    // He speeds up as he settles in. A rate fixed at the first three words
    // would start calling every later read too short.
    const tracker = createRateTracker();
    for (const seconds of [1.6, 1.6, 1.6]) tracker.observe(4, seconds);
    for (const seconds of [0.8, 0.8, 0.8, 0.8, 0.8]) tracker.observe(4, seconds);

    expect(tracker.judge(4, 0.8)).toBe("ok");
  });

  it("ignores a zero-syllable word rather than dividing by it", () => {
    const tracker = createRateTracker();
    for (const seconds of [1.2, 1.2, 1.2]) tracker.observe(4, seconds);

    expect(tracker.judge(0, 1.2)).toBe("ok");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/pronunciation/read-plausibility.test.ts`
Expected: FAIL — cannot resolve `read-plausibility`

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/features/lab/pronunciation-recorder/domain/read-plausibility.ts
export type ReadVerdict = "ok" | "too-short" | "too-long";

/** Reads needed before the tracker will judge anything. */
const SEED_READS = 3;
/** How many recent reads the median is taken over, so a drifting pace is followed. */
const WINDOW = 8;

export const DURATION_SHORTFALL = 0.6;
export const DURATION_OVERRUN = 1.8;

export interface RateTracker {
  /** Median seconds per syllable, or null before the tracker is seeded. */
  readonly secondsPerSyllable: number | null;
  observe(syllables: number, seconds: number): void;
  judge(syllables: number, seconds: number): ReadVerdict;
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
    : (sorted[middle] ?? 0);
}

/**
 * Tracks how long Austen takes per syllable and judges each read against it.
 *
 * Median over a recent window rather than a mean over the session: one stumble
 * that ran four times long would drag a mean far enough to stop flagging real
 * failures, and the window is what lets the pace drift as he settles in.
 */
export function createRateTracker(): RateTracker {
  const rates: number[] = [];

  return {
    get secondsPerSyllable() {
      return rates.length >= SEED_READS ? median(rates) : null;
    },

    observe(syllables, seconds) {
      if (syllables <= 0 || !Number.isFinite(seconds) || seconds <= 0) return;
      rates.push(seconds / syllables);
      if (rates.length > WINDOW) rates.shift();
    },

    judge(syllables, seconds) {
      if (rates.length < SEED_READS || syllables <= 0) return "ok";
      const expected = median(rates) * syllables;
      if (seconds < expected * DURATION_SHORTFALL) return "too-short";
      if (seconds > expected * DURATION_OVERRUN) return "too-long";
      return "ok";
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/pronunciation/read-plausibility.test.ts`
Expected: PASS, 6 tests

- [ ] **Step 5: Prove the duration comparison is tested**

Temporarily make `judge` always return `"ok"` and re-run. Expected: three tests fail. Restore and re-run to PASS.

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(pronunciation): duration-based read plausibility" -- tests/unit/pronunciation/read-plausibility.test.ts src/lib/features/lab/pronunciation-recorder/domain/read-plausibility.ts
```

---

## Task 5: Session queue and early abort

**Files:**
- Create: `src/lib/features/lab/pronunciation-recorder/domain/session-queue.ts`
- Create: `src/lib/features/lab/pronunciation-recorder/domain/session-abort.ts`
- Test: `tests/unit/pronunciation/session-queue.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/pronunciation/session-queue.test.ts
import { describe, expect, it } from "vitest";

import { createSessionQueue, REQUEUE_DISTANCE, MAX_ATTEMPTS } from "$lib/features/lab/pronunciation-recorder/domain/session-queue";
import { createAbortMonitor, ABORT_CONSECUTIVE_FAILURES } from "$lib/features/lab/pronunciation-recorder/domain/session-abort";

const WORDS = Array.from({ length: 20 }, (_, index) => `w${index}`);

describe("createSessionQueue", () => {
  it("hands out words in order and shows the next one", () => {
    const queue = createSessionQueue(WORDS);

    expect(queue.current).toBe("w0");
    expect(queue.next).toBe("w1");
    queue.accept();
    expect(queue.current).toBe("w1");
  });

  it("re-queues at a distance rather than immediately", () => {
    // Re-reading the failed word straight away gives it the same run-up that
    // just failed. Eight places later it lands in a different rhythm and still
    // inside the same sitting.
    const queue = createSessionQueue(WORDS);
    queue.requeue();

    expect(queue.current).toBe("w1");
    const seen: string[] = [];
    while (queue.current && seen.length < 12) {
      seen.push(queue.current);
      queue.accept();
    }
    expect(seen[REQUEUE_DISTANCE - 1]).toBe("w0");
  });

  it("puts a late failure at the end when fewer words remain than the distance", () => {
    const queue = createSessionQueue(["a", "b"]);
    queue.requeue();

    expect(queue.current).toBe("b");
    queue.accept();
    expect(queue.current).toBe("a");
  });

  it("retires a word after three attempts and reports it", () => {
    const queue = createSessionQueue(["a"]);
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) queue.requeue();

    expect(queue.current).toBeNull();
    expect(queue.retired).toEqual(["a"]);
  });

  it("counts only accepted words as completed", () => {
    const queue = createSessionQueue(WORDS);
    queue.accept();
    queue.requeue();
    queue.accept();

    expect(queue.completed).toBe(2);
  });
});

describe("createAbortMonitor", () => {
  it("aborts when the opening of the session is mostly failures", () => {
    // Three failures in the first eight words is a wrong device or a wrong
    // gain, and no number of re-queues fixes either one.
    const monitor = createAbortMonitor();
    monitor.record("fail");
    monitor.record("ok");
    monitor.record("fail");
    monitor.record("ok");
    expect(monitor.reason).toBeNull();
    monitor.record("fail");

    expect(monitor.reason).toBe("early-failures");
  });

  it("aborts on a consecutive run later in the session", () => {
    const monitor = createAbortMonitor();
    for (let index = 0; index < 12; index++) monitor.record("ok");
    for (let index = 0; index < ABORT_CONSECUTIVE_FAILURES; index++) monitor.record("fail");

    expect(monitor.reason).toBe("consecutive-failures");
  });

  it("does not abort on the same failure count spread across a long session", () => {
    // Occasional failures are the design working. Only a run or a bad opening
    // means the rig is broken.
    const monitor = createAbortMonitor();
    for (let index = 0; index < 60; index++) {
      monitor.record(index % 7 === 0 && index > 8 ? "fail" : "ok");
    }

    expect(monitor.reason).toBeNull();
  });

  it("clears the consecutive run on a good read", () => {
    const monitor = createAbortMonitor();
    for (let index = 0; index < 12; index++) monitor.record("ok");
    monitor.record("fail");
    monitor.record("fail");
    monitor.record("fail");
    monitor.record("ok");
    monitor.record("fail");
    monitor.record("fail");

    expect(monitor.reason).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/pronunciation/session-queue.test.ts`
Expected: FAIL — cannot resolve `session-queue`

- [ ] **Step 3: Write both implementations**

```ts
// src/lib/features/lab/pronunciation-recorder/domain/session-queue.ts
/** How far down a failed word is reinserted, in words. */
export const REQUEUE_DISTANCE = 8;
/** Attempts before a word is retired to the end-of-session report. */
export const MAX_ATTEMPTS = 3;

export interface SessionQueue {
  readonly current: string | null;
  readonly next: string | null;
  readonly completed: number;
  readonly remaining: number;
  readonly retired: readonly string[];
  accept(): void;
  requeue(): void;
}

/**
 * The word order, and what happens when a read fails.
 *
 * Failure never interrupts: the word goes back into the list further down and
 * the session moves on, which is what makes "press start and talk" literally
 * true. Three failures retire it to a report he reads afterwards.
 */
export function createSessionQueue(words: readonly string[]): SessionQueue {
  const pending = [...words];
  const attempts = new Map<string, number>();
  const retired: string[] = [];
  let completed = 0;

  return {
    get current() {
      return pending[0] ?? null;
    },
    get next() {
      return pending[1] ?? null;
    },
    get completed() {
      return completed;
    },
    get remaining() {
      return pending.length;
    },
    get retired() {
      return retired;
    },

    accept() {
      if (pending.length === 0) return;
      pending.shift();
      completed++;
    },

    requeue() {
      const word = pending.shift();
      if (word === undefined) return;

      const attempted = (attempts.get(word) ?? 0) + 1;
      attempts.set(word, attempted);
      if (attempted >= MAX_ATTEMPTS) {
        retired.push(word);
        return;
      }

      pending.splice(Math.min(REQUEUE_DISTANCE - 1, pending.length), 0, word);
    },
  };
}
```

```ts
// src/lib/features/lab/pronunciation-recorder/domain/session-abort.ts
export type ReadOutcome = "ok" | "fail";
export type AbortReason = "early-failures" | "consecutive-failures";

export const ABORT_EARLY_WINDOW = 8;
export const ABORT_EARLY_FAILURES = 3;
export const ABORT_CONSECUTIVE_FAILURES = 4;

export interface AbortMonitor {
  readonly reason: AbortReason | null;
  record(outcome: ReadOutcome): void;
}

/**
 * Tells random failure apart from systematic failure.
 *
 * Re-queueing is the right answer to a fumbled read and the wrong answer to a
 * muted microphone: without this the session would spend forty minutes
 * discovering that every word fails. A bad opening or a run of failures means
 * the rig is wrong, and only a human can fix that.
 */
export function createAbortMonitor(): AbortMonitor {
  let seen = 0;
  let earlyFailures = 0;
  let consecutive = 0;
  let reason: AbortReason | null = null;

  return {
    get reason() {
      return reason;
    },

    record(outcome) {
      seen++;
      if (outcome === "fail") {
        consecutive++;
        if (seen <= ABORT_EARLY_WINDOW) earlyFailures++;
      } else {
        consecutive = 0;
      }

      if (reason !== null) return;
      if (seen <= ABORT_EARLY_WINDOW && earlyFailures >= ABORT_EARLY_FAILURES) {
        reason = "early-failures";
      } else if (consecutive >= ABORT_CONSECUTIVE_FAILURES) {
        reason = "consecutive-failures";
      }
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/pronunciation/session-queue.test.ts`
Expected: PASS, 9 tests

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(pronunciation): session queue and systematic-failure abort" -- tests/unit/pronunciation/session-queue.test.ts src/lib/features/lab/pronunciation-recorder/domain/session-queue.ts src/lib/features/lab/pronunciation-recorder/domain/session-abort.ts
```

---

## Task 6: Word pool from the transition graph

The pool must contain adjacencies a real TKA label can contain, because those adjacencies are the coarticulation the bank's join and neighbour costs are priced for. `TransitionGraph` in `packages/sequence-engine` already answers "which letters may follow this one," so the pool is a walk of that graph rather than a call into sequence generation.

**Files:**
- Create: `scripts/build-pronunciation-word-pool.ts`
- Create (generated, checked in): `static/data/pronunciation-word-pool.json`

**Verified 2026-08-16 against the repo** — the graph's real surface, so this task does not have to rediscover it:
`TransitionGraph` is at `packages/sequence-engine/src/core/transition-graph/TransitionGraph.ts` and its constructor **requires** an `ISequenceDataProvider`; there is no zero-argument form. In Node, the provider is a one-method literal reading `static/data/learn/letter-mappings.json` — the pattern
`packages/sequence-engine/tests/generation/turn-pattern-build.test.ts:92` already uses. `ITransitionGraph` really does expose `initialize(): Promise<void>`, `getValidSuccessors(letter): string[]`, and `getAllLetters(excludeLetters?: Set<string>): string[]`.

- [ ] **Step 1: Write the script**

```ts
// scripts/build-pronunciation-word-pool.ts
/**
 * Build the candidate word pool the corpus planner draws from.
 *
 * A pool word is a walk of the letter transition graph, so every adjacency it
 * contains is one a real TKA label can contain. That matters more than it
 * looks: the bank's neighbour and join costs assume tokens carry the influence
 * of the letters beside them, and an invented adjacency would put a join in the
 * bank that no label ever asks for.
 *
 * Run: pnpm exec tsx scripts/build-pronunciation-word-pool.ts
 */
import { readFileSync, writeFileSync } from "node:fs";

import { TransitionGraph } from "../packages/sequence-engine/src/core/transition-graph/TransitionGraph.js";

/**
 * Letter mappings only. The graph's `initialize` reads position groups from
 * this file; `loadLetterVariations` is never reached on the code paths this
 * script uses, so the pictograph CSV stays out of it.
 */
const MAPPINGS_PATH = "static/data/learn/letter-mappings.json";

const LENGTHS = [2, 3, 4, 5, 6, 8];
const WORDS_PER_LENGTH = 400;
const OUTPUT = "static/data/pronunciation-word-pool.json";

function walk(
  graph: TransitionGraph,
  start: string,
  length: number,
  pick: (options: string[], depth: number) => string | null
): string[] | null {
  const word = [start];
  while (word.length < length) {
    const successors = graph.getValidSuccessors(word[word.length - 1]!);
    const chosen = pick(successors, word.length);
    if (chosen === null) return null;
    word.push(chosen);
  }
  return word;
}

async function main(): Promise<void> {
  const graph = new TransitionGraph({
    loadLetterMappings: async () =>
      JSON.parse(readFileSync(MAPPINGS_PATH, "utf8")),
  } as never);
  await graph.initialize();

  const letters = graph.getAllLetters();
  const pool: string[][] = [];
  const seen = new Set<string>();

  for (const length of LENGTHS) {
    let attempts = 0;
    let produced = 0;
    // Deterministic rotation rather than randomness, so the checked-in pool is
    // reproducible and a diff on it means the graph changed.
    while (produced < WORDS_PER_LENGTH && attempts < WORDS_PER_LENGTH * 40) {
      const start = letters[attempts % letters.length]!;
      const offset = Math.floor(attempts / letters.length);
      const word = walk(graph, start, length, (options, depth) =>
        options.length === 0 ? null : options[(offset + depth) % options.length]!
      );
      attempts++;
      if (!word) continue;

      const key = word.join(" ");
      if (seen.has(key)) continue;
      seen.add(key);
      pool.push(word);
      produced++;
    }
    console.log(`length ${length}: ${produced} words in ${attempts} attempts`);
  }

  writeFileSync(OUTPUT, `${JSON.stringify({ version: 1, words: pool })}\n`);
  console.log(`wrote ${pool.length} words to ${OUTPUT}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

- [ ] **Step 2: Run it**

Run: `pnpm exec tsx scripts/build-pronunciation-word-pool.ts`
Expected: six `length N: ...` lines, then `wrote 2400 words to static/data/pronunciation-word-pool.json`. If a length produces far fewer words than asked, that is a real property of the graph — report the number, do not loosen the walk to hide it.

- [ ] **Step 3: Check the pool actually spans the alphabet**

Run:
```bash
node -e "const p=require('./static/data/pronunciation-word-pool.json').words; const s=new Set(p.flat()); console.log('distinct letters:', s.size, '| words:', p.length)"
```
Expected: 54 distinct letters. Fewer means the deterministic rotation never reaches some letters, and every cell they own would be left to constructed filler words — report the count and which letters are missing.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(pronunciation): word pool built from the transition graph" -- scripts/build-pronunciation-word-pool.ts static/data/pronunciation-word-pool.json
```

---

## Task 7: The corpus planner

**Files:**
- Create: `src/lib/features/lab/pronunciation-recorder/domain/corpus-plan.ts`
- Test: `tests/unit/pronunciation/corpus-plan.test.ts`

**Amended 2026-08-16, after Task 6 ran — the corpus covers 47 letters, not 54.**
Task 6's pool came back with 47 distinct letters, and that is not a thin walk:
MCP `list_available_letters` reports the TKA alphabet as exactly 47 (22 + 8 + 8
+ 3 + 3 + 3), and the graph's `getAllLetters()` matches it letter for letter.
The `Letter` enum in `src/lib/shared/foundation/domain/models/letter.ts` carries
54 because it also groups ζ η τ ⊕ (obtuse, acute, one-center, both-center) as
Type 6 and μ ν as Type 2 and τ- as Type 4 — MCP's Type 6 is α β γ, its Type 2
has no μ or ν, and its Type 4 has no τ-. Those seven are position names.

A position name cannot sit inside a word, so planning cells for one puts Austen
in front of a microphone reading labels that are not TKA words: `constructWord`
would emit `α ζ α` for him to say aloud. `planWords` therefore takes a `letters`
option — production passes the `letters` array now emitted by Task 6's pool
JSON, and the default stays the full enum so the tests below still describe 216
cells. **Real corpus: 47 × 4 = 188 cells.** Deriving the scope from the pool
rather than hardcoding 47 keeps it self-correcting; extend
`letter-mappings.json` and the corpus grows on the next regeneration.

Do not "fix" `letter.ts` as part of this task. Whether the enum should model
positions is a separate question, and other features read it.

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/pronunciation/corpus-plan.test.ts
import { describe, expect, it } from "vitest";

import { Letter } from "$lib/shared/foundation/domain/models/letter";
import { getLetterPronunciation, PRONUNCIATION_POSITIONS } from "$lib/shared/pronunciation/pronunciation-plan";
import { cellsCoveredBy, coverageKey, planWords, TARGET_DEPTH } from "$lib/features/lab/pronunciation-recorder/domain/corpus-plan";

const ALL_LETTERS = Object.values(Letter);

function allCells(): string[] {
  return ALL_LETTERS.flatMap((letter) =>
    PRONUNCIATION_POSITIONS.map((position) =>
      coverageKey(getLetterPronunciation(letter)!.assetKey, position)
    )
  );
}

describe("cellsCoveredBy", () => {
  it("gives a multi-letter word one initial, one final, and the rest medial", () => {
    const cells = cellsCoveredBy([Letter.A, Letter.B, Letter.C, Letter.D]);

    expect(cells).toEqual([
      coverageKey("a", "initial"),
      coverageKey("b", "medial"),
      coverageKey("c", "medial"),
      coverageKey("d", "final"),
    ]);
  });

  it("gives a single-letter word an isolated cell", () => {
    // Isolated cannot come from any multi-letter word, so without solo reads
    // 54 cells stay empty and every word using them falls back to synthesis.
    expect(cellsCoveredBy([Letter.SIGMA])).toEqual([coverageKey("sigma", "isolated")]);
  });
});

describe("planWords", () => {
  it("reaches every one of the 216 cells at the target depth", () => {
    const pool = [] as string[][];
    for (const letter of ALL_LETTERS) {
      for (const other of ALL_LETTERS) {
        pool.push([letter, other, letter]);
      }
    }

    const plan = planWords({ pool, coverage: {}, maxWords: 5000 });
    const counts = new Map<string, number>();
    for (const word of plan.words) {
      for (const cell of cellsCoveredBy(word)) {
        counts.set(cell, (counts.get(cell) ?? 0) + 1);
      }
    }

    expect(plan.starved).toEqual([]);
    for (const cell of allCells()) {
      expect(counts.get(cell) ?? 0, cell).toBeGreaterThanOrEqual(TARGET_DEPTH);
    }
  });

  it("prefers the word that fills the most under-served cells", () => {
    const plan = planWords({
      pool: [
        [Letter.A, Letter.A, Letter.A],
        [Letter.A, Letter.B, Letter.C],
      ],
      coverage: { [coverageKey("a", "initial")]: TARGET_DEPTH },
      maxWords: 1,
    });

    expect(plan.words[0]).toEqual([Letter.A, Letter.B, Letter.C]);
  });

  it("stops when every cell is served rather than draining the pool", () => {
    const pool = ALL_LETTERS.map((letter) => [letter]);
    const coverage: Record<string, number> = {};
    for (const cell of allCells()) coverage[cell] = TARGET_DEPTH;
    coverage[coverageKey("sigma", "isolated")] = 0;

    const plan = planWords({ pool, coverage, maxWords: 500 });

    expect(plan.words).toEqual([[Letter.SIGMA]]);
  });

  it("emits solo reads for isolated cells the pool cannot cover", () => {
    const plan = planWords({
      pool: [[Letter.A, Letter.B]],
      coverage: {},
      maxWords: 500,
    });

    expect(plan.words).toContainEqual([Letter.A]);
    expect(plan.words).toContainEqual([Letter.SIGMA]);
  });

  it("reports a cell no pool word and no construction can reach", () => {
    // Starvation must be visible. A silently missing cell sends every word that
    // uses it to synthesis, permanently, with nothing logged anywhere.
    const plan = planWords({
      pool: [[Letter.A, Letter.B]],
      coverage: {},
      maxWords: 500,
      construct: false,
    });

    expect(plan.starved).toContain(coverageKey("sigma", "medial"));
  });

  it("mixes word lengths instead of emitting one contour", () => {
    const pool = [] as string[][];
    for (const letter of ALL_LETTERS) {
      pool.push([letter, letter]);
      pool.push([letter, letter, letter, letter, letter, letter]);
    }

    const plan = planWords({ pool, coverage: {}, maxWords: 5000 });
    const lengths = new Set(plan.words.map((word) => word.length));

    expect(lengths.size).toBeGreaterThan(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/pronunciation/corpus-plan.test.ts`
Expected: FAIL — cannot resolve `corpus-plan`

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/features/lab/pronunciation-recorder/domain/corpus-plan.ts
import { Letter } from "$lib/shared/foundation/domain/models/letter";
import {
  getLetterPronunciation,
  PRONUNCIATION_POSITIONS,
  type PronunciationPosition,
} from "$lib/shared/pronunciation/pronunciation-plan";

/** Takes wanted per cell. */
export const TARGET_DEPTH = 3;

export type CoverageCounts = Record<string, number>;

export function coverageKey(assetKey: string, position: PronunciationPosition): string {
  return `${assetKey}:${position}`;
}

function positionAt(index: number, length: number): PronunciationPosition {
  if (length === 1) return "isolated";
  if (index === 0) return "initial";
  if (index === length - 1) return "final";
  return "medial";
}

/**
 * The cells one recorded word fills. Mirrors `positionFor` in
 * `pronunciation-plan.ts` deliberately: the selector matches on exact position
 * equality, so a token filed under a position the player never asks for is the
 * same as no token at all.
 */
export function cellsCoveredBy(word: readonly string[]): string[] {
  return word.map((letter, index) => {
    const pronunciation = getLetterPronunciation(letter as never);
    return coverageKey(pronunciation?.assetKey ?? letter, positionAt(index, word.length));
  });
}

function allCells(): string[] {
  return Object.values(Letter).flatMap((letter) => {
    const assetKey = getLetterPronunciation(letter)!.assetKey;
    return PRONUNCIATION_POSITIONS.map((position) => coverageKey(assetKey, position));
  });
}

/**
 * A word placing `letter` at `position`, built rather than drawn from the pool.
 *
 * Less honest than a real label and therefore the fallback, not the default —
 * but coverage is a correctness requirement, not a quality target:
 * `selectTokenPath` returns null when any cue has no candidate at its exact
 * position, so one empty cell sends every word using that letter to synthesis.
 */
function constructWord(letter: string, position: PronunciationPosition): string[] {
  const filler = letter === Letter.A ? Letter.B : Letter.A;
  switch (position) {
    case "isolated":
      return [letter];
    case "initial":
      return [letter, filler];
    case "final":
      return [filler, letter];
    case "medial":
      return [filler, letter, filler];
  }
}

export interface PlanOptions {
  pool: readonly (readonly string[])[];
  coverage: CoverageCounts;
  maxWords: number;
  /** Off only in tests that assert what the pool alone cannot reach. */
  construct?: boolean;
}

export interface CorpusPlan {
  words: string[][];
  starved: string[];
}

/**
 * Greedily pick the pool word that fills the most under-served cells, then
 * construct words for whatever the pool could not reach.
 *
 * Ties break toward the length seen least often so far, which is what keeps the
 * bank from being one contour: a greedy planner otherwise settles on whichever
 * length happens to score best and emits nothing else.
 */
export function planWords(options: PlanOptions): CorpusPlan {
  const { pool, maxWords, construct = true } = options;
  const coverage: CoverageCounts = { ...options.coverage };
  const lengthUse = new Map<number, number>();
  const words: string[][] = [];

  const deficit = (cell: string) => Math.max(0, TARGET_DEPTH - (coverage[cell] ?? 0));
  const score = (word: readonly string[]) =>
    cellsCoveredBy(word).reduce((total, cell) => total + deficit(cell), 0);

  const take = (word: readonly string[]) => {
    for (const cell of cellsCoveredBy(word)) {
      coverage[cell] = (coverage[cell] ?? 0) + 1;
    }
    lengthUse.set(word.length, (lengthUse.get(word.length) ?? 0) + 1);
    words.push([...word]);
  };

  while (words.length < maxWords) {
    let best: readonly string[] | null = null;
    let bestScore = 0;
    let bestLengthUse = Number.POSITIVE_INFINITY;

    for (const candidate of pool) {
      const candidateScore = score(candidate);
      if (candidateScore === 0) continue;
      const used = lengthUse.get(candidate.length) ?? 0;
      if (candidateScore > bestScore || (candidateScore === bestScore && used < bestLengthUse)) {
        best = candidate;
        bestScore = candidateScore;
        bestLengthUse = used;
      }
    }

    if (!best) break;
    take(best);
  }

  const starved: string[] = [];
  for (const cell of allCells()) {
    while (deficit(cell) > 0) {
      const [assetKey, position] = cell.split(":") as [string, PronunciationPosition];
      const letter = Object.values(Letter).find(
        (candidate) => getLetterPronunciation(candidate)!.assetKey === assetKey
      );
      if (!construct || !letter) {
        starved.push(cell);
        break;
      }
      take(constructWord(letter, position));
    }
  }

  return { words, starved };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/pronunciation/corpus-plan.test.ts`
Expected: PASS, 8 tests

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(pronunciation): 216-cell corpus planner" -- tests/unit/pronunciation/corpus-plan.test.ts src/lib/features/lab/pronunciation-recorder/domain/corpus-plan.ts
```

---

## Task 8: Capture worklet and ring service

**Files:**
- Create: `static/worklets/pronunciation-capture-processor.js`
- Create: `src/lib/features/lab/pronunciation-recorder/services/contracts/IAudioRingCapture.ts`
- Create: `src/lib/features/lab/pronunciation-recorder/services/implementations/AudioRingCapture.ts`

No unit test: this is a browser-graph adapter with no logic of its own — `SampleRing` holds the logic and is tested in Task 3. It is exercised end to end in Task 12.

- [ ] **Step 1: Write the worklet**

```js
// static/worklets/pronunciation-capture-processor.js
/**
 * Copies every input frame to the main thread. Deliberately does nothing else:
 * the audio thread must not allocate or decide, and the ring it feeds is plain
 * testable TypeScript rather than worklet code nobody can unit-test.
 */
class PronunciationCaptureProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (channel && channel.length > 0) {
      this.port.postMessage(channel.slice(0));
    }
    return true;
  }
}

registerProcessor("pronunciation-capture", PronunciationCaptureProcessor);
```

- [ ] **Step 2: Write the contract**

```ts
// src/lib/features/lab/pronunciation-recorder/services/contracts/IAudioRingCapture.ts
export interface CapturedSpan {
  samples: Float32Array;
  sampleRate: number;
}

export interface IAudioRingCapture {
  readonly sampleRate: number;
  /** Absolute samples written since capture started — the session clock. */
  readonly clock: number;
  /** Current input level in dBFS, for the meter. */
  readonly levelDb: number;
  start(stream: MediaStream): Promise<void>;
  /** Samples between two absolute times in seconds, or null if not fully held. */
  readSeconds(fromSeconds: number, toSeconds: number): CapturedSpan | null;
  stop(): Promise<void>;
}
```

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/features/lab/pronunciation-recorder/services/implementations/AudioRingCapture.ts
import { SampleRing } from "../../domain/sample-ring";
import type { CapturedSpan, IAudioRingCapture } from "../contracts/IAudioRingCapture";

const RING_SECONDS = 30;
const CAPTURE_SAMPLE_RATE = 48_000;

export class AudioRingCapture implements IAudioRingCapture {
  private context: AudioContext | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private node: AudioWorkletNode | null = null;
  private ring: SampleRing | null = null;
  private peak = 0;

  get sampleRate(): number {
    return this.context?.sampleRate ?? CAPTURE_SAMPLE_RATE;
  }

  get clock(): number {
    return this.ring?.writtenSamples ?? 0;
  }

  get levelDb(): number {
    return this.peak > 0 ? 20 * Math.log10(this.peak) : -100;
  }

  async start(stream: MediaStream): Promise<void> {
    const context = new AudioContext({ sampleRate: CAPTURE_SAMPLE_RATE });
    await context.audioWorklet.addModule("/worklets/pronunciation-capture-processor.js");

    this.ring = new SampleRing(Math.round(context.sampleRate * RING_SECONDS));
    this.source = context.createMediaStreamSource(stream);
    this.node = new AudioWorkletNode(context, "pronunciation-capture", {
      numberOfInputs: 1,
      numberOfOutputs: 0,
      channelCount: 1,
      channelCountMode: "explicit",
    });

    this.node.port.onmessage = (event: MessageEvent<Float32Array>) => {
      const frame = event.data;
      this.ring?.write(frame);

      // Decayed peak: a meter that only rises reads as clipping forever after
      // one loud syllable, and a meter that only shows the current frame is
      // unreadable at 48 kHz.
      let framePeak = 0;
      for (let index = 0; index < frame.length; index++) {
        const magnitude = Math.abs(frame[index] ?? 0);
        if (magnitude > framePeak) framePeak = magnitude;
      }
      this.peak = Math.max(framePeak, this.peak * 0.92);
    };

    this.source.connect(this.node);
    this.context = context;
  }

  readSeconds(fromSeconds: number, toSeconds: number): CapturedSpan | null {
    if (!this.ring) return null;
    const rate = this.sampleRate;
    const samples = this.ring.read(
      Math.max(0, Math.round(fromSeconds * rate)),
      Math.round(toSeconds * rate)
    );
    return samples ? { samples, sampleRate: rate } : null;
  }

  async stop(): Promise<void> {
    this.node?.port.close();
    this.source?.disconnect();
    this.node?.disconnect();
    await this.context?.close();
    this.context = null;
    this.source = null;
    this.node = null;
    this.ring = null;
    this.peak = 0;
  }
}
```

- [ ] **Step 4: Typecheck**

Run: `npx svelte-check --threshold error --output human 2>&1 | grep -i "pronunciation-recorder"`
Expected: no lines. Repo-wide errors outside this feature are pre-existing and are not yours to fix.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(pronunciation): AudioWorklet ring capture" -- static/worklets/pronunciation-capture-processor.js src/lib/features/lab/pronunciation-recorder/services/contracts/IAudioRingCapture.ts src/lib/features/lab/pronunciation-recorder/services/implementations/AudioRingCapture.ts
```

---

## Task 9: Silero speech-boundary detector

**Files:**
- Create: `src/lib/features/lab/pronunciation-recorder/services/contracts/ISpeechBoundaryDetector.ts`
- Create: `src/lib/features/lab/pronunciation-recorder/services/implementations/SileroBoundaryDetector.ts`
- Create: `static/vad/` (vendored assets)
- Modify: `package.json`

- [ ] **Step 1: Install and vendor the assets**

```bash
pnpm add @ricky0123/vad-web onnxruntime-web
```

```bash
mkdir -p static/vad && cp node_modules/@ricky0123/vad-web/dist/vad.worklet.bundle.min.js node_modules/@ricky0123/vad-web/dist/silero_vad_v5.onnx node_modules/onnxruntime-web/dist/*.wasm node_modules/onnxruntime-web/dist/*.mjs static/vad/
```

They are vendored rather than loaded from jsdelivr because a forty-minute session must not depend on a third-party host mid-read, and because the tool has to work offline.

- [ ] **Step 2: Write the contract**

```ts
// src/lib/features/lab/pronunciation-recorder/services/contracts/ISpeechBoundaryDetector.ts
export interface SpeechSpan {
  /** Seconds on the capture clock. */
  startSeconds: number;
  endSeconds: number;
}

export interface SpeechBoundaryHandlers {
  onSpeechStart(): void;
  /** One utterance finished: `redemptionMs` of non-speech has held. */
  onSpeechEnd(span: SpeechSpan): void;
}

export interface ISpeechBoundaryDetector {
  start(stream: MediaStream, handlers: SpeechBoundaryHandlers): Promise<void>;
  stop(): Promise<void>;
}
```

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/features/lab/pronunciation-recorder/services/implementations/SileroBoundaryDetector.ts
import { MicVAD } from "@ricky0123/vad-web";

import type {
  ISpeechBoundaryDetector,
  SpeechBoundaryHandlers,
} from "../contracts/ISpeechBoundaryDetector";

/**
 * How long non-speech must hold before a word counts as finished.
 *
 * The library default is 1400 ms, tuned for conversational turn-taking. This is
 * a list of short words, and 1400 ms of dead air between each is a worse
 * session than a rare early advance — which the offline aligner catches anyway,
 * because it has the transcript.
 */
const WORD_END_SILENCE_MS = 700;

export class SileroBoundaryDetector implements ISpeechBoundaryDetector {
  private vad: MicVAD | null = null;
  private startedAt = 0;

  async start(stream: MediaStream, handlers: SpeechBoundaryHandlers): Promise<void> {
    const clock = () => performance.now() / 1000;

    this.vad = await MicVAD.new({
      getStream: async () => stream,
      model: "v5",
      redemptionMs: WORD_END_SILENCE_MS,
      preSpeechPadMs: 300,
      minSpeechMs: 200,
      baseAssetPath: "/vad/",
      onnxWASMBasePath: "/vad/",
      onSpeechStart: () => {
        this.startedAt = clock();
        handlers.onSpeechStart();
      },
      onSpeechEnd: () => {
        handlers.onSpeechEnd({
          startSeconds: this.startedAt,
          // The callback fires after the redemption window has elapsed, so the
          // speech ended that long ago — charging it to now would put most of a
          // second of silence inside every word.
          endSeconds: clock() - WORD_END_SILENCE_MS / 1000,
        });
      },
      onVADMisfire: () => {
        // Too short to be a word. Not a failure; he cleared his throat.
      },
    });

    this.vad.start();
  }

  async stop(): Promise<void> {
    this.vad?.destroy();
    this.vad = null;
  }
}
```

- [ ] **Step 4: Typecheck**

Run: `npx svelte-check --threshold error --output human 2>&1 | grep -i "pronunciation-recorder"`
Expected: no lines.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(pronunciation): Silero v5 speech-boundary detector" -- package.json pnpm-lock.yaml static/vad src/lib/features/lab/pronunciation-recorder/services/contracts/ISpeechBoundaryDetector.ts src/lib/features/lab/pronunciation-recorder/services/implementations/SileroBoundaryDetector.ts
```

---

## Task 10: Session store

**Files:**
- Create: `src/lib/features/lab/pronunciation-recorder/services/contracts/ICorpusSessionStore.ts`
- Create: `src/lib/features/lab/pronunciation-recorder/services/implementations/CorpusSessionStore.ts`
- Test: `tests/unit/pronunciation/corpus-session-store.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/pronunciation/corpus-session-store.test.ts
import { describe, expect, it } from "vitest";

import { buildWordFiles, nextWordId } from "$lib/features/lab/pronunciation-recorder/services/implementations/CorpusSessionStore";

describe("buildWordFiles", () => {
  it("writes the TKA letters to words.json and the spoken names to the .lab", () => {
    // Two consumers, two formats: measure-word-segmentation.ts tokenizes the
    // TKA word, and the aligner needs English the dictionary can look up.
    const files = buildWordFiles("01", ["Σ-", "α"]);

    expect(files.wavName).toBe("01.wav");
    expect(files.labName).toBe("01.lab");
    expect(files.labText).toBe("Sigma dash Alpha");
    expect(files.entry).toEqual({ file: "01.wav", word: "Σ-α" });
  });

  it("handles a solo read", () => {
    const files = buildWordFiles("07", ["Ω"]);

    expect(files.labText).toBe("Omega");
    expect(files.entry).toEqual({ file: "07.wav", word: "Ω" });
  });
});

describe("nextWordId", () => {
  it("zero-pads so the directory sorts in reading order", () => {
    expect(nextWordId(0)).toBe("001");
    expect(nextWordId(41)).toBe("042");
    expect(nextWordId(999)).toBe("1000");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/pronunciation/corpus-session-store.test.ts`
Expected: FAIL — cannot resolve `CorpusSessionStore`

- [ ] **Step 3: Write the contract**

```ts
// src/lib/features/lab/pronunciation-recorder/services/contracts/ICorpusSessionStore.ts
import type { CoverageCounts } from "../../domain/corpus-plan";

export interface WordEntry {
  file: string;
  word: string;
}

export interface SessionRecord {
  version: 1;
  coverage: CoverageCounts;
  retired: string[];
  wordsRecorded: number;
}

export interface ConnectedSessionFolder {
  name: string;
  directSave: boolean;
}

export interface ICorpusSessionStore {
  supportsDirectSave(): boolean;
  connect(): Promise<ConnectedSessionFolder>;
  /** Writes `<id>.wav`, `<id>.lab`, and rewrites `words.json`. */
  writeWord(id: string, letters: readonly string[], wav: Blob): Promise<void>;
  writeSession(record: SessionRecord): Promise<void>;
  /** Zip fallback only; a no-op when saving directly. */
  finish(): Promise<void>;
}
```

- [ ] **Step 4: Write the implementation**

```ts
// src/lib/features/lab/pronunciation-recorder/services/implementations/CorpusSessionStore.ts
import { getLetterPronunciation } from "$lib/shared/pronunciation/pronunciation-plan";

import type {
  ConnectedSessionFolder,
  ICorpusSessionStore,
  SessionRecord,
  WordEntry,
} from "../contracts/ICorpusSessionStore";

export interface WordFiles {
  wavName: string;
  labName: string;
  labText: string;
  entry: WordEntry;
}

export function nextWordId(recorded: number): string {
  return String(recorded + 1).padStart(3, "0");
}

/**
 * The two representations one recorded word needs.
 *
 * `words.json` carries the TKA letters, which is what
 * `scripts/measure-word-segmentation.ts` already reads and tokenizes. The
 * `.lab` carries the spoken names, because that is what the aligner's
 * dictionary can look up — "Σ-" is not an English word and never will be.
 */
export function buildWordFiles(id: string, letters: readonly string[]): WordFiles {
  return {
    wavName: `${id}.wav`,
    labName: `${id}.lab`,
    labText: letters
      .map((letter) => getLetterPronunciation(letter as never)?.spokenName ?? letter)
      .join(" "),
    entry: { file: `${id}.wav`, word: letters.join("") },
  };
}

/**
 * Writes an MFA corpus directly: `<id>.wav` beside `<id>.lab` IS the aligner's
 * input format, so the offline stage runs on the session output with no
 * conversion step and no chance of the two drifting apart.
 *
 * `words.json` and `session.json` are rewritten after every word rather than at
 * the end, so a closed tab or a lost microphone leaves a directory both the
 * aligner and the TS harness can still read.
 */
export class CorpusSessionStore implements ICorpusSessionStore {
  private directory: FileSystemDirectoryHandle | null = null;
  private zipFiles = new Map<string, Blob>();
  private entries: WordEntry[] = [];

  supportsDirectSave(): boolean {
    return typeof window !== "undefined" && "showDirectoryPicker" in window;
  }

  async connect(): Promise<ConnectedSessionFolder> {
    if (!this.supportsDirectSave()) {
      return { name: "session.zip", directSave: false };
    }
    this.directory = await window.showDirectoryPicker({ mode: "readwrite" });
    return { name: this.directory.name, directSave: true };
  }

  async writeWord(id: string, letters: readonly string[], wav: Blob): Promise<void> {
    const files = buildWordFiles(id, letters);
    this.entries.push(files.entry);

    await this.write(files.wavName, wav);
    await this.write(files.labName, new Blob([files.labText], { type: "text/plain" }));
    await this.write(
      "words.json",
      new Blob([`${JSON.stringify(this.entries, null, 2)}\n`], { type: "application/json" })
    );
  }

  async writeSession(record: SessionRecord): Promise<void> {
    await this.write(
      "session.json",
      new Blob([`${JSON.stringify(record, null, 2)}\n`], { type: "application/json" })
    );
  }

  async finish(): Promise<void> {
    if (this.directory) return;

    const { default: JSZip } = await import("jszip");
    const zip = new JSZip();
    for (const [name, blob] of this.zipFiles) zip.file(name, blob);

    const archive = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(archive);
    const link = document.createElement("a");
    link.href = url;
    link.download = "pronunciation-session.zip";
    link.click();
    URL.revokeObjectURL(url);
  }

  private async write(name: string, blob: Blob): Promise<void> {
    if (!this.directory) {
      this.zipFiles.set(name, blob);
      return;
    }
    const handle = await this.directory.getFileHandle(name, { create: true });
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/unit/pronunciation/corpus-session-store.test.ts`
Expected: PASS, 3 tests

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(pronunciation): session store writing an MFA corpus" -- tests/unit/pronunciation/corpus-session-store.test.ts src/lib/features/lab/pronunciation-recorder/services/contracts/ICorpusSessionStore.ts src/lib/features/lab/pronunciation-recorder/services/implementations/CorpusSessionStore.ts
```

---

## Task 11: The session machine

Everything above is inert until something joins it: the detector says a word ended, the ring is drained, the read is judged, the queue advances or re-queues, the monitor decides whether to stop. This is the one place that logic lives, and it is driven by fakes in test so it is provable without a microphone.

**Files:**
- Create: `src/lib/features/lab/pronunciation-recorder/state/corpus-session-state.svelte.ts`
- Test: `tests/unit/pronunciation/corpus-session.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/pronunciation/corpus-session.test.ts
import { describe, expect, it } from "vitest";

import { Letter } from "$lib/shared/foundation/domain/models/letter";
import { createCorpusSession } from "$lib/features/lab/pronunciation-recorder/state/corpus-session-state.svelte";
import type { SpeechBoundaryHandlers } from "$lib/features/lab/pronunciation-recorder/services/contracts/ISpeechBoundaryDetector";

const WORDS = [
  [Letter.A, Letter.B],
  [Letter.C, Letter.D],
  [Letter.E, Letter.F],
];

function harness(words = WORDS) {
  let handlers: SpeechBoundaryHandlers | null = null;
  const written: Array<{ id: string; letters: readonly string[]; bytes: number }> = [];
  const sessions: unknown[] = [];

  const capture = {
    sampleRate: 48_000,
    clock: 0,
    levelDb: -20,
    async start() {},
    readSeconds(from: number, to: number) {
      return { samples: new Float32Array(Math.round((to - from) * 48_000)), sampleRate: 48_000 };
    },
    async stop() {},
  };

  const session = createCorpusSession({
    words,
    capture,
    detector: {
      async start(_stream, given) {
        handlers = given;
      },
      async stop() {},
    },
    store: {
      supportsDirectSave: () => true,
      async connect() {
        return { name: "corpus", directSave: true };
      },
      async writeWord(id, letters, wav) {
        written.push({ id, letters, bytes: wav.size });
      },
      async writeSession(record) {
        sessions.push(record);
      },
      async finish() {},
    },
    microphone: { async connect() {
      return { stream: {} as MediaStream, devices: [], settings: { label: "fake" } };
    } },
  });

  /** One spoken word of `seconds`, ending `at` on the capture clock. */
  const speak = async (at: number, seconds: number) => {
    handlers!.onSpeechStart();
    handlers!.onSpeechEnd({ startSeconds: at - seconds, endSeconds: at });
    await session.settled();
  };

  return { session, speak, written, sessions };
}

describe("createCorpusSession", () => {
  it("advances to the next word after each read and writes it before showing the next", async () => {
    const { session, speak, written } = harness();
    await session.start();

    expect(session.currentWord).toEqual([Letter.A, Letter.B]);
    expect(session.nextWord).toEqual([Letter.C, Letter.D]);

    await speak(2, 1.0);

    expect(written).toHaveLength(1);
    expect(written[0]!.id).toBe("001");
    expect(written[0]!.letters).toEqual([Letter.A, Letter.B]);
    expect(written[0]!.bytes).toBeGreaterThan(44);
    expect(session.currentWord).toEqual([Letter.C, Letter.D]);
  });

  it("cuts lead-in and tail around the reported speech", async () => {
    // Cutting exactly at the boundary clips the plosive the detector missed and
    // leaves the aligner nothing to anchor the first phone against.
    const { session, speak, written } = harness();
    await session.start();
    await speak(2, 1.0);

    const expectedSeconds = 1.0 + 0.25 * 2;
    expect(written[0]!.bytes).toBeCloseTo(44 + expectedSeconds * 48_000 * 3, -3);
  });

  it("re-queues a read that came in far too short, without asking", async () => {
    const { session, speak, written } = harness();
    await session.start();

    await speak(2, 1.0);
    await speak(4, 1.0);
    await speak(6, 1.0);
    const before = written.length;
    await speak(8, 0.1);

    expect(written).toHaveLength(before);
    expect(session.retired).toEqual([]);
    expect(session.status).toBe("running");
  });

  it("finishes on its own when the queue empties", async () => {
    const { session, speak } = harness();
    await session.start();
    await speak(2, 1.0);
    await speak(4, 1.0);
    await speak(6, 1.0);

    expect(session.status).toBe("finished");
    expect(session.currentWord).toBeNull();
  });

  it("stops early when every read fails, rather than reading into a dead microphone", async () => {
    const many = Array.from({ length: 30 }, () => [Letter.A, Letter.B, Letter.C, Letter.D]);
    const { session, speak } = harness(many);
    await session.start();

    await speak(2, 1.2);
    await speak(4, 1.2);
    await speak(6, 1.2);
    for (let index = 0; index < 4; index++) await speak(8 + index * 2, 0.05);

    expect(session.status).toBe("aborted");
    expect(session.abortReason).not.toBeNull();
  });

  it("persists coverage after every word so a closed tab can resume", async () => {
    const { session, speak, sessions } = harness();
    await session.start();
    await speak(2, 1.0);

    expect(sessions).toHaveLength(1);
    expect((sessions[0] as { wordsRecorded: number }).wordsRecorded).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/pronunciation/corpus-session.test.ts`
Expected: FAIL — cannot resolve `corpus-session-state.svelte`

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/features/lab/pronunciation-recorder/state/corpus-session-state.svelte.ts
import { cellsCoveredBy, type CoverageCounts } from "../domain/corpus-plan";
import { syllablesInWord } from "../domain/letter-syllables";
import { createRateTracker } from "../domain/read-plausibility";
import { createAbortMonitor, type AbortReason } from "../domain/session-abort";
import { createSessionQueue } from "../domain/session-queue";
import { encodeWav24 } from "../domain/wav-encoder";
import type { IAudioRingCapture } from "../services/contracts/IAudioRingCapture";
import type { ICorpusSessionStore } from "../services/contracts/ICorpusSessionStore";
import type { ISpeechBoundaryDetector } from "../services/contracts/ISpeechBoundaryDetector";
import { nextWordId } from "../services/implementations/CorpusSessionStore";

/** Kept around each read so no consonant is clipped and the aligner has an anchor. */
const LEAD_IN_SECONDS = 0.25;
const TAIL_SECONDS = 0.25;

export type SessionStatus = "idle" | "running" | "finished" | "aborted" | "failed";

interface MicrophoneSource {
  connect(deviceId?: string): Promise<{ stream: MediaStream }>;
}

export interface CorpusSessionOptions {
  words: readonly (readonly string[])[];
  capture: IAudioRingCapture;
  detector: ISpeechBoundaryDetector;
  store: ICorpusSessionStore;
  microphone: MicrophoneSource;
}

export function createCorpusSession(options: CorpusSessionOptions) {
  const keys = options.words.map((word) => word.join(" "));
  const byKey = new Map(keys.map((key, index) => [key, options.words[index]!]));
  const queue = createSessionQueue(keys);
  const rate = createRateTracker();
  const monitor = createAbortMonitor();
  const coverage: CoverageCounts = {};

  let status = $state<SessionStatus>("idle");
  let abortReason = $state<AbortReason | null>(null);
  let folderName = $state<string | null>(null);
  let recorded = $state(0);
  let currentKey = $state<string | null>(null);
  let nextKey = $state<string | null>(null);
  let pending: Promise<void> = Promise.resolve();

  const wordOf = (key: string | null) => (key ? (byKey.get(key) ?? null) : null);

  function syncQueue(): void {
    currentKey = queue.current;
    nextKey = queue.next;
    if (queue.current === null && status === "running") status = "finished";
  }

  async function persist(): Promise<void> {
    await options.store.writeSession({
      version: 1,
      coverage,
      retired: [...queue.retired],
      wordsRecorded: recorded,
    });
  }

  async function handleSpeechEnd(startSeconds: number, endSeconds: number): Promise<void> {
    const word = wordOf(currentKey);
    if (!word || status !== "running") return;

    const seconds = endSeconds - startSeconds;
    const syllables = syllablesInWord(word);
    const span = options.capture.readSeconds(
      startSeconds - LEAD_IN_SECONDS,
      endSeconds + TAIL_SECONDS
    );
    const verdict = span === null ? "too-short" : rate.judge(syllables, seconds);

    if (verdict !== "ok" || span === null) {
      // Silent re-queue. He is told nothing now; the report at the end carries
      // whatever never succeeded.
      monitor.record("fail");
      queue.requeue();
    } else {
      rate.observe(syllables, seconds);
      monitor.record("ok");

      const id = nextWordId(recorded);
      await options.store.writeWord(id, word, encodeWav24(span.samples, span.sampleRate));
      recorded++;
      for (const cell of cellsCoveredBy(word)) {
        coverage[cell] = (coverage[cell] ?? 0) + 1;
      }
      queue.accept();
    }

    await persist();

    if (monitor.reason !== null) {
      abortReason = monitor.reason;
      status = "aborted";
      await stop();
      return;
    }

    syncQueue();
    if (status === "finished") await stop();
  }

  async function start(deviceId?: string): Promise<void> {
    try {
      const { stream } = await options.microphone.connect(deviceId);
      folderName = (await options.store.connect()).name;
      await options.capture.start(stream);
      await options.detector.start(stream, {
        onSpeechStart: () => {},
        onSpeechEnd: (span) => {
          // Serialised: two words must never be written concurrently, or their
          // ids interleave and words.json disagrees with the directory.
          pending = pending.then(() =>
            handleSpeechEnd(span.startSeconds, span.endSeconds)
          );
        },
      });
      status = "running";
      syncQueue();
    } catch {
      status = "failed";
    }
  }

  async function stop(): Promise<void> {
    await options.detector.stop();
    await options.capture.stop();
    await options.store.finish();
  }

  return {
    get status() {
      return status;
    },
    get abortReason() {
      return abortReason;
    },
    get folderName() {
      return folderName;
    },
    get currentWord() {
      return wordOf(currentKey);
    },
    get nextWord() {
      return wordOf(nextKey);
    },
    get completed() {
      return queue.completed;
    },
    get remaining() {
      return queue.remaining;
    },
    get retired() {
      return queue.retired.map((key) => byKey.get(key)!).filter(Boolean);
    },
    get levelDb() {
      return options.capture.levelDb;
    },
    start,
    stop,
    /** Test seam: resolves once every queued write has landed. */
    settled: () => pending,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/pronunciation/corpus-session.test.ts`
Expected: PASS, 6 tests

- [ ] **Step 5: Prove the abort test can fail**

Temporarily make `monitor.reason` always return null and re-run. Expected: the early-stop test fails. Restore and re-run to PASS.

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(pronunciation): hands-free corpus session machine" -- tests/unit/pronunciation/corpus-session.test.ts src/lib/features/lab/pronunciation-recorder/state/corpus-session-state.svelte.ts
```

---

## Task 12: The screen

Prompt, next prompt, progress, level meter, one button. Nothing else, because the requirement is that nothing else is touched.

**Files:**
- Create: `src/lib/features/lab/pronunciation-recorder/components/CorpusSessionScreen.svelte`
- Create: `src/lib/features/lab/pronunciation-recorder/components/SessionReport.svelte`
- Modify: `src/lib/features/lab/pronunciation-recorder/PronunciationRecorderLab.svelte`

- [ ] **Step 1: Write the report component**

```svelte
<!-- src/lib/features/lab/pronunciation-recorder/components/SessionReport.svelte -->
<script lang="ts">
  import { getLetterPronunciation } from "$lib/shared/pronunciation/pronunciation-plan";

  interface Props {
    retired: readonly (readonly string[])[];
    recorded: number;
    folderName: string | null;
    abortReason: string | null;
  }

  let { retired, recorded, folderName, abortReason }: Props = $props();

  const spoken = (word: readonly string[]) =>
    word.map((letter) => getLetterPronunciation(letter as never)?.spokenName ?? letter).join(" ");
</script>

<section class="report">
  <h2>{abortReason ? "Session stopped" : "Session complete"}</h2>
  <p class="count">{recorded} words recorded{folderName ? ` into ${folderName}` : ""}.</p>

  {#if abortReason}
    <p class="abort">
      Stopped because {abortReason === "early-failures"
        ? "most of the opening reads failed"
        : "several reads failed in a row"} — check the input level and the selected
      microphone before running again. Everything recorded so far is on disk.
    </p>
  {/if}

  {#if retired.length > 0}
    <h3>Not captured after three attempts</h3>
    <ul>
      {#each retired as word (word.join(""))}
        <li>{spoken(word)}</li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  .report {
    display: grid;
    gap: 1rem;
    max-width: var(--shell-w, min(1720px, 92vw));
    margin-inline: auto;
    padding: 2rem;
  }

  .count {
    font-variant-numeric: tabular-nums;
  }

  ul {
    display: grid;
    gap: 0.5rem;
    margin: 0;
    padding-inline-start: 1.5rem;
  }
</style>
```

- [ ] **Step 2: Write the session screen**

```svelte
<!-- src/lib/features/lab/pronunciation-recorder/components/CorpusSessionScreen.svelte -->
<script lang="ts">
  import { getLetterPronunciation } from "$lib/shared/pronunciation/pronunciation-plan";

  import SessionReport from "./SessionReport.svelte";

  interface SessionView {
    status: string;
    abortReason: string | null;
    folderName: string | null;
    currentWord: readonly string[] | null;
    nextWord: readonly string[] | null;
    completed: number;
    remaining: number;
    retired: readonly (readonly string[])[];
    levelDb: number;
    start: () => Promise<void>;
  }

  let { session }: { session: SessionView } = $props();

  const spoken = (word: readonly string[] | null) =>
    word?.map((letter) => getLetterPronunciation(letter as never)?.spokenName ?? letter).join(" ") ?? "";

  // -60 dBFS reads as empty, 0 as full. A linear map of dBFS is the only meter
  // that shows a quiet microphone as quiet rather than as almost silent.
  const meter = $derived(Math.max(0, Math.min(1, (session.levelDb + 60) / 60)));
  const total = $derived(session.completed + session.remaining);
</script>

<div class="session">
  {#if session.status === "idle"}
    <button class="start" onclick={() => session.start()}>Start recording</button>
    <p class="hint">Pick a folder, then read each word aloud. It advances by itself.</p>
  {:else if session.status === "running"}
    <p class="progress" aria-live="off">{session.completed} of {total}</p>

    <p class="prompt" aria-live="polite">{spoken(session.currentWord)}</p>
    <p class="upcoming" aria-hidden="true">{spoken(session.nextWord)}</p>

    <div class="meter" role="img" aria-label="Input level">
      <span class="fill" style:transform={`scaleX(${meter})`}></span>
    </div>
  {:else if session.status === "failed"}
    <p class="prompt">Could not open the microphone or the folder.</p>
    <button class="start" onclick={() => session.start()}>Try again</button>
  {:else}
    <SessionReport
      retired={session.retired}
      recorded={session.completed}
      folderName={session.folderName}
      abortReason={session.abortReason}
    />
  {/if}
</div>

<style>
  .session {
    display: grid;
    align-content: center;
    justify-items: center;
    gap: 2rem;
    min-height: 100%;
    padding: 2rem;
    text-align: center;
  }

  .start {
    /* An action he presses once from across the room, not an inline link. */
    min-height: 44px;
    padding: 1.25rem 3rem;
    border: 1px solid var(--theme-accent, currentColor);
    border-radius: 999px;
    background: var(--theme-accent, transparent);
    color: var(--theme-on-accent, inherit);
    font-size: 1.5rem;
    cursor: pointer;
  }

  .progress {
    margin: 0;
    /* Changing digits with proportional figures shove the prompt sideways. */
    font-variant-numeric: tabular-nums;
    opacity: 0.6;
  }

  .prompt {
    margin: 0;
    font-size: clamp(3rem, 9vw, 9rem);
    font-weight: 700;
    line-height: 1.05;
    /* The box is sized by the viewport, not by the word, so a long word and a
       short one do not move the meter and the progress line between reads. */
    min-height: 1.1em;
  }

  .upcoming {
    margin: 0;
    font-size: clamp(1.25rem, 2.5vw, 2rem);
    min-height: 1.2em;
    opacity: 0.35;
  }

  .meter {
    width: min(40rem, 70vw);
    height: 0.5rem;
    border-radius: 999px;
    background: color-mix(in srgb, currentColor 15%, transparent);
    overflow: hidden;
  }

  .fill {
    display: block;
    width: 100%;
    height: 100%;
    background: var(--theme-accent, currentColor);
    transform-origin: left center;
    transition: transform 80ms linear;
  }
</style>
```

- [ ] **Step 3: Rewrite the lab tab to mount the session**

```svelte
<!-- src/lib/features/lab/pronunciation-recorder/PronunciationRecorderLab.svelte -->
<script lang="ts">
  import CorpusSessionScreen from "./components/CorpusSessionScreen.svelte";
  import { planWords } from "./domain/corpus-plan";
  import { getPronunciationRecorder } from "./get-pronunciation-recorder";
  import { AudioRingCapture } from "./services/implementations/AudioRingCapture";
  import { CorpusSessionStore } from "./services/implementations/CorpusSessionStore";
  import { SileroBoundaryDetector } from "./services/implementations/SileroBoundaryDetector";
  import { createCorpusSession } from "./state/corpus-session-state.svelte";

  // Fetched rather than imported. A static JSON import is inlined into the app
  // bundle, and 2400 words would ride along in every page load of the whole
  // product for one lab tab — the bundle lever this repo has been bitten by
  // before. `static/` is served at `/`.
  async function buildSession() {
    const response = await fetch("/data/pronunciation-word-pool.json");
    const { words: pool } = (await response.json()) as { words: string[][] };

    // Coverage starts empty. Resuming from a previous sitting reads session.json
    // back through the store; until that lands, a second sitting re-plans from
    // zero and simply over-serves the cells it already has.
    const plan = planWords({ pool, coverage: {}, maxWords: 400 });

    return createCorpusSession({
      words: plan.words,
      capture: new AudioRingCapture(),
      detector: new SileroBoundaryDetector(),
      store: new CorpusSessionStore(),
      microphone: getPronunciationRecorder(),
    });
  }
</script>

{#await buildSession() then session}
  <CorpusSessionScreen {session} />
{/await}
```

- [ ] **Step 4: Typecheck**

Run: `npx svelte-check --threshold error --output human 2>&1 | grep -i "pronunciation-recorder"`
Expected: no lines.

- [ ] **Step 5: Verify it in the browser, at every viewport**

Start or reuse the shared instance:

```bash
pwsh -NoProfile -File scripts/launch-chrome-debug.ps1 -Url about:blank
```

Open a task-owned background page at `https://localhost:5173/` and navigate to the Lab module's `pronunciation-recorder` tab. If the dev server is not up, ask Austen to start it from Agent Hub — never start it yourself.

For each of `1920x1080x1`, `2560x1440x1`, `3840x2160x1`, `1440x900x1`, `820x1180x1`, `960x412x1`, `375x667x1`: `emulate`, then `take_screenshot` with `format: "webp", quality: 70`, and read the frame.

Check, on every frame: the Start button sizes to its label rather than spanning the viewport (the single most common failure — a shared primitive's `width: 100%` beats a consumer's `flex: 0 0 auto`); the prompt is legible from across a room at 3840 and does not overflow at 375; the 960×412 fold does not push the meter off-screen; the page does not dead-end a third of the way down at 4K. Fix, reload, re-shoot until the frame is right. Clear the emulation and close only the task-owned page.

- [ ] **Step 6: Commit with the frames named in the message**

```bash
git commit -m "feat(pronunciation): hands-free recording screen" -- src/lib/features/lab/pronunciation-recorder/components/CorpusSessionScreen.svelte src/lib/features/lab/pronunciation-recorder/components/SessionReport.svelte src/lib/features/lab/pronunciation-recorder/PronunciationRecorderLab.svelte
```

---

## Task 13: Delete the carrier-phrase model

216 carrier takes cannot enter a v2 bank: a carrier take has no TKA neighbours, so it fails `hasCoherentContext` (`pronunciation-manifest.ts:80`), and `parsePronunciationManifest` returns v1 **or** v2 and never merges them. Leaving it in the tree leaves a second, incompatible way to record the same thing.

**Files:**
- Delete: `domain/recording-jobs.ts`, `domain/recording-manifest.ts`, `components/RecordingWorkspace.svelte`, `components/RecordingInventory.svelte`, `state/pronunciation-recorder-state.svelte.ts`, `services/contracts/IPronunciationTakeStore.ts`, `services/implementations/PronunciationTakeStore.ts`, `get-pronunciation-take-store.ts`
- Modify: `services/contracts/IPronunciationRecorder.ts`, `services/implementations/PronunciationRecorder.ts`

- [ ] **Step 1: Prove nothing outside the feature consumes them**

Run:
```bash
grep -rn "recording-jobs\|recording-manifest\|IPronunciationTakeStore\|PronunciationTakeStore\|RecordingWorkspace\|RecordingInventory\|pronunciation-recorder-state\|renderDelivery\|startTake\|finishTake\|discardTake" src tests scripts --include=*.ts --include=*.svelte
```
Expected: hits only inside `src/lib/features/lab/pronunciation-recorder/`. Any hit elsewhere is a real consumer — stop and report it rather than deleting.

- [ ] **Step 2: Delete the files**

```bash
git rm src/lib/features/lab/pronunciation-recorder/domain/recording-jobs.ts src/lib/features/lab/pronunciation-recorder/domain/recording-manifest.ts src/lib/features/lab/pronunciation-recorder/components/RecordingWorkspace.svelte src/lib/features/lab/pronunciation-recorder/components/RecordingInventory.svelte src/lib/features/lab/pronunciation-recorder/state/pronunciation-recorder-state.svelte.ts src/lib/features/lab/pronunciation-recorder/services/contracts/IPronunciationTakeStore.ts src/lib/features/lab/pronunciation-recorder/services/implementations/PronunciationTakeStore.ts src/lib/features/lab/pronunciation-recorder/get-pronunciation-take-store.ts
```

- [ ] **Step 3: Trim the recorder contract to what the session uses**

```ts
// src/lib/features/lab/pronunciation-recorder/services/contracts/IPronunciationRecorder.ts
export interface MicrophoneOption {
  deviceId: string;
  label: string;
}

export interface MicrophoneSettings {
  label: string;
  sampleRate?: number;
  sampleSize?: number;
  channelCount?: number;
  echoCancellation?: boolean;
  noiseSuppression?: boolean;
  autoGainControl?: boolean;
}

export interface ConnectedMicrophone {
  stream: MediaStream;
  devices: MicrophoneOption[];
  settings: MicrophoneSettings;
}

/**
 * Device access only. Capture moved to `IAudioRingCapture`: one `MediaStream`
 * now feeds two consumers — the capture ring and the VAD — and the take-based
 * encode/decode path in between was what put a `decodeAudioData` on the gap
 * between two words.
 */
export interface IPronunciationRecorder {
  isSupported(): boolean;
  listMicrophones(): Promise<MicrophoneOption[]>;
  connect(deviceId?: string): Promise<ConnectedMicrophone>;
  dispose(): Promise<void>;
}
```

Then delete `startTake`, `finishTake`, `discardTake`, `renderDelivery`, and every `mediabunny` import from `services/implementations/PronunciationRecorder.ts`, keeping `isSupported`, `listMicrophones`, `connect`, `dispose` exactly as they are.

- [ ] **Step 4: Typecheck and run the whole pronunciation suite**

Run: `npx svelte-check --threshold error --output human 2>&1 | grep -i "pronunciation"`
Expected: no lines.

Run: `npx vitest run tests/unit/pronunciation`
Expected: PASS, every file.

- [ ] **Step 5: Commit**

```bash
git commit -m "refactor(pronunciation): delete the carrier-phrase take model" -- src/lib/features/lab/pronunciation-recorder
```

---

## Task 14: Offline environment and dictionary

**Files:**
- Create: `tools/pronunciation/environment.yml`
- Create: `tools/pronunciation/tka-letters.dict`
- Create: `tools/pronunciation/README.md`

- [ ] **Step 1: Write the environment**

```yaml
# tools/pronunciation/environment.yml
# MFA ships Kaldi binaries, so conda is the supported install path — pip alone
# does not get you a working aligner.
#   conda env create -f tools/pronunciation/environment.yml
#   conda activate tka-pronunciation
name: tka-pronunciation
channels:
  - conda-forge
dependencies:
  - python=3.11
  - montreal-forced-aligner=3.*
  - pip
  - pip:
      - faster-whisper
      - praatio
      - soundfile
```

- [ ] **Step 2: Download the models and find the real OOV set**

```bash
mfa model download acoustic english_us_arpa && mfa model download dictionary english_us_arpa
```

Record one throwaway session of ten words through the page from Task 12, then:

```bash
mfa validate <session-dir> english_us_arpa english_us_arpa
```

Read the `oovs_found.txt` path it prints. Every name in it needs an entry. Do not guess which names will be OOV — most Greek letter names are already in `english_us_arpa`, and writing entries for words that are already there is how a custom dictionary starts overriding the model's own pronunciations.

- [ ] **Step 3: Write the dictionary**

Tab-delimited, word then space-delimited ARPAbet phones. Seed it with the names most likely to be missing and then extend it from the real OOV list:

```
Terra	T EH1 R AH0
Nu	N UW1
Mu	M Y UW1
Psi	S AY1
Phi	F AY1
```

Save as `tools/pronunciation/tka-letters.dict`. Re-run `mfa validate` with `tools/pronunciation/tka-letters.dict` in place of `english_us_arpa` for the dictionary argument until `oovs_found.txt` is empty.

- [ ] **Step 4: Write the runbook**

```markdown
<!-- tools/pronunciation/README.md -->
# Pronunciation corpus — offline stage

The browser writes an MFA corpus: `NNN.wav` + `NNN.lab` per word, plus
`words.json` and `session.json`.

    conda env create -f tools/pronunciation/environment.yml
    conda activate tka-pronunciation
    mfa model download acoustic english_us_arpa
    mfa model download dictionary english_us_arpa

    python tools/pronunciation/align.py <session-dir>
    python tools/pronunciation/cut_tokens.py <session-dir>
    pnpm exec tsx scripts/build-token-bank.ts <session-dir>
    python tools/pronunciation/verify.py <session-dir>

`align.py` writes TextGrids. `cut_tokens.py` cuts each letter out of the 48 kHz
WAV and writes a partial bank. `build-token-bank.ts` measures the features and
writes the v2 bank — in TypeScript, because `audio-features.ts` is the tested
implementation of F0 and a second one in Python would drift from it.
`verify.py` flags misreads and is advisory.

The dictionary is `tka-letters.dict`. If `mfa validate` reports OOVs, add them
there; a name the aligner cannot look up gets `<unk>` and its word aligns
against a phone set it never spoke.
```

- [ ] **Step 5: Commit**

```bash
git commit -m "chore(pronunciation): offline aligner environment and dictionary" -- tools/pronunciation/environment.yml tools/pronunciation/tka-letters.dict tools/pronunciation/README.md
```

---

## Task 15: Alignment and token cutting

**Files:**
- Create: `tools/pronunciation/align.py`
- Create: `tools/pronunciation/cut_tokens.py`
- Create: `tests/fixtures/pronunciation/sample.TextGrid`
- Test: `tools/pronunciation/test_cut_tokens.py`

- [ ] **Step 1: Write the aligner wrapper**

```python
# tools/pronunciation/align.py
"""Run MFA over a recording session directory.

MFA 3.0 keeps an HMM-GMM acoustic model, which is why it is here: its mean
boundary error is under 15 ms, where end-to-end neural ASR with word timestamps
is worse at frame-level placement because it is trained for string accuracy.
"""

import argparse
import pathlib
import subprocess
import sys

DICTIONARY = pathlib.Path(__file__).with_name("tka-letters.dict")
ACOUSTIC_MODEL = "english_us_arpa"


def run(command: list[str]) -> None:
    print(" ".join(command))
    result = subprocess.run(command, check=False)
    if result.returncode != 0:
        sys.exit(result.returncode)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("session", type=pathlib.Path)
    parser.add_argument("--out", type=pathlib.Path, default=None)
    args = parser.parse_args()

    out = args.out or args.session / "aligned"
    run(["mfa", "validate", str(args.session), str(DICTIONARY), ACOUSTIC_MODEL])
    run([
        "mfa", "align",
        str(args.session), str(DICTIONARY), ACOUSTIC_MODEL, str(out),
        "--clean", "--fine_tune",
    ])
    print(f"TextGrids in {out}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Write the failing test with a hand-written TextGrid**

```
File type = "ooTextFile"
Object class = "TextGrid"

xmin = 0
xmax = 1.5
tiers? <exists>
size = 1
item []:
    item [1]:
        class = "IntervalTier"
        name = "words"
        xmin = 0
        xmax = 1.5
        intervals: size = 4
        intervals [1]:
            xmin = 0
            xmax = 0.25
            text = ""
        intervals [2]:
            xmin = 0.25
            xmax = 0.70
            text = "Alpha"
        intervals [3]:
            xmin = 0.70
            xmax = 1.20
            text = "Sigma dash"
        intervals [4]:
            xmin = 1.20
            xmax = 1.5
            text = ""
```

Save as `tests/fixtures/pronunciation/sample.TextGrid`.

```python
# tools/pronunciation/test_cut_tokens.py
"""Run: conda activate tka-pronunciation && python -m pytest tools/pronunciation"""

import pathlib

from cut_tokens import spans_from_textgrid, token_records

FIXTURE = pathlib.Path(__file__).parents[2] / "tests/fixtures/pronunciation/sample.TextGrid"


def test_reads_word_spans_and_drops_the_silences():
    spans = spans_from_textgrid(FIXTURE)

    assert spans == [("Alpha", 0.25, 0.70), ("Sigma dash", 0.70, 1.20)]


def test_assigns_position_and_neighbours_from_order():
    # position and neighbour-nullness encode the same fact, and
    # hasCoherentContext rejects a token where they disagree — so a token whose
    # position says initial while carrying a previous letter never loads.
    records = token_records("001", ["α", "Σ-"], spans_from_textgrid(FIXTURE))

    assert records[0]["position"] == "initial"
    assert records[0]["previousLetter"] is None
    assert records[0]["nextLetter"] == "Σ-"
    assert records[1]["position"] == "final"
    assert records[1]["previousLetter"] == "α"
    assert records[1]["nextLetter"] is None
    assert all(record["groupLength"] == 2 for record in records)


def test_marks_a_single_letter_read_isolated():
    records = token_records("002", ["α"], [("Alpha", 0.25, 0.70)])

    assert records[0]["position"] == "isolated"
    assert records[0]["previousLetter"] is None
    assert records[0]["nextLetter"] is None


def test_refuses_a_grid_that_does_not_match_the_word():
    # Forcing two letters onto three aligned spans would file every token under
    # the wrong neighbours, and nothing downstream would notice.
    try:
        token_records("003", ["α"], spans_from_textgrid(FIXTURE))
    except ValueError:
        return
    raise AssertionError("expected a ValueError")
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `conda activate tka-pronunciation && python -m pytest tools/pronunciation -q`
Expected: FAIL — `ModuleNotFoundError: No module named 'cut_tokens'`

- [ ] **Step 4: Write the cutter**

```python
# tools/pronunciation/cut_tokens.py
"""Cut per-letter tokens out of aligned session audio.

Writes the token WAVs and a partial bank. The acoustic features are added by
scripts/build-token-bank.ts rather than here: audio-features.ts is the tested
implementation of F0 estimation, and a second one in Python would drift from it
in exactly the way that produces a bank that plays but selects badly.
"""

import argparse
import json
import pathlib

import soundfile
from praatio import textgrid

MARGIN_SECONDS = 0.02


def spans_from_textgrid(path: pathlib.Path) -> list[tuple[str, float, float]]:
    grid = textgrid.openTextgrid(str(path), includeEmptyIntervals=False)
    tier = grid.getTier("words")
    return [
        (entry.label, entry.start, entry.end)
        for entry in tier.entries
        if entry.label.strip()
    ]


def position_at(index: int, length: int) -> str:
    if length == 1:
        return "isolated"
    if index == 0:
        return "initial"
    if index == length - 1:
        return "final"
    return "medial"


def token_records(
    word_id: str,
    letters: list[str],
    spans: list[tuple[str, float, float]],
) -> list[dict]:
    if len(letters) != len(spans):
        raise ValueError(
            f"{word_id}: {len(letters)} letters but {len(spans)} aligned spans"
        )

    records = []
    for index, (letter, (_, start, end)) in enumerate(zip(letters, spans)):
        records.append({
            "letter": letter,
            "position": position_at(index, len(letters)),
            "previousLetter": letters[index - 1] if index > 0 else None,
            "nextLetter": letters[index + 1] if index < len(letters) - 1 else None,
            "sourceWord": "".join(letters),
            "indexInWord": index,
            "groupLength": len(letters),
            "startSeconds": start,
            "endSeconds": end,
        })
    return records


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("session", type=pathlib.Path)
    args = parser.parse_args()

    words = json.loads((args.session / "words.json").read_text(encoding="utf-8"))
    tokens_dir = args.session / "tokens"
    tokens_dir.mkdir(exist_ok=True)

    partial = []
    for entry in words:
        word_id = pathlib.Path(entry["file"]).stem
        grid_path = args.session / "aligned" / f"{word_id}.TextGrid"
        if not grid_path.exists():
            print(f"{word_id}: no TextGrid — alignment failed, skipping")
            continue

        audio, rate = soundfile.read(args.session / entry["file"], dtype="float32")
        spans = spans_from_textgrid(grid_path)
        letters = json.loads(entry["letters"]) if "letters" in entry else None
        if letters is None:
            raise SystemExit(
                f"{word_id}: words.json has no letters array; re-record or add one"
            )

        for record in token_records(word_id, letters, spans):
            start = max(0, int((record["startSeconds"] - MARGIN_SECONDS) * rate))
            end = min(len(audio), int((record["endSeconds"] + MARGIN_SECONDS) * rate))
            name = f"{word_id}-{record['indexInWord']}.wav"
            soundfile.write(tokens_dir / name, audio[start:end], rate, subtype="PCM_24")
            record["path"] = f"tokens/{name}"
            partial.append(record)

    (args.session / "tokens-partial.json").write_text(
        json.dumps(partial, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"cut {len(partial)} tokens into {tokens_dir}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 5: Add the `letters` array to `words.json`**

`cut_tokens.py` needs the letter array, and re-tokenizing "Σ-α" in Python would duplicate `tokenizeWord`. Extend the entry in `CorpusSessionStore.buildWordFiles` instead:

```ts
    entry: { file: `${id}.wav`, word: letters.join(""), letters: JSON.stringify([...letters]) },
```

and widen `WordEntry` in `ICorpusSessionStore.ts`:

```ts
export interface WordEntry {
  file: string;
  word: string;
  /** JSON array of the TKA letters, so the Python cutter need not re-tokenize. */
  letters: string;
}
```

Update the two `buildWordFiles` assertions in `tests/unit/pronunciation/corpus-session-store.test.ts` to expect the new field, and re-run `npx vitest run tests/unit/pronunciation/corpus-session-store.test.ts` — Expected: PASS.

- [ ] **Step 6: Run the Python test to verify it passes**

Run: `conda activate tka-pronunciation && python -m pytest tools/pronunciation -q`
Expected: PASS, 4 tests

- [ ] **Step 7: Commit**

```bash
git commit -m "feat(pronunciation): MFA alignment and token cutting" -- tools/pronunciation/align.py tools/pronunciation/cut_tokens.py tools/pronunciation/test_cut_tokens.py tests/fixtures/pronunciation/sample.TextGrid src/lib/features/lab/pronunciation-recorder/services/contracts/ICorpusSessionStore.ts src/lib/features/lab/pronunciation-recorder/services/implementations/CorpusSessionStore.ts tests/unit/pronunciation/corpus-session-store.test.ts
```

---

## Task 16: Build the v2 token bank

**Files:**
- Create: `scripts/build-token-bank.ts`
- Test: `tests/unit/pronunciation/build-token-bank.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/pronunciation/build-token-bank.test.ts
import { describe, expect, it } from "vitest";

import { isPronunciationTokenBank } from "$lib/shared/pronunciation/pronunciation-manifest";
import { assembleBank, type PartialToken } from "../../../scripts/build-token-bank";

const PARTIAL: PartialToken[] = [
  {
    letter: "α",
    path: "tokens/001-0.wav",
    position: "initial",
    previousLetter: null,
    nextLetter: "Σ-",
    sourceWord: "αΣ-",
    indexInWord: 0,
    groupLength: 2,
    startSeconds: 0.25,
    endSeconds: 0.7,
  },
  {
    letter: "Σ-",
    path: "tokens/001-1.wav",
    position: "final",
    previousLetter: "α",
    nextLetter: null,
    sourceWord: "αΣ-",
    indexInWord: 1,
    groupLength: 2,
    startSeconds: 0.7,
    endSeconds: 1.2,
  },
];

function voiced(seconds: number): Float32Array {
  const rate = 48_000;
  const samples = new Float32Array(Math.round(rate * seconds));
  for (let index = 0; index < samples.length; index++) {
    samples[index] = 0.3 * Math.sin((2 * Math.PI * 150 * index) / rate);
  }
  return samples;
}

describe("assembleBank", () => {
  it("produces a bank the app's own parser accepts", () => {
    // If this fails, playback silently falls through to speech synthesis for
    // every word — parsePronunciationManifest returns null and says nothing.
    const bank = assembleBank(PARTIAL, () => ({ samples: voiced(0.45), sampleRate: 48_000 }));

    expect(isPronunciationTokenBank(bank)).toBe(true);
    // measureTokenFeatures returns two edge-level fields the token type does not
    // carry. The parser ignores them, so nothing fails — the bank just doubles
    // its per-token field count for values nothing ever reads.
    expect(Object.keys(bank.tokens["alpha"]![0]!).sort()).toEqual([
      "durationMs", "f0EndHz", "f0StartHz", "groupLength", "indexInWord",
      "nextLetter", "path", "position", "previousLetter", "rmsDb", "sourceWord",
    ]);
  });

  it("keys tokens by asset key, and neighbours by letter value", () => {
    // The two namespaces are the trap: the bank is keyed "sigma-dash" while the
    // selector compares neighbours against "Σ-". Writing asset keys into the
    // neighbour fields parses and then mismatches on every single join.
    const bank = assembleBank(PARTIAL, () => ({ samples: voiced(0.45), sampleRate: 48_000 }));

    expect(Object.keys(bank.tokens).sort()).toEqual(["alpha", "sigma-dash"]);
    expect(bank.tokens["alpha"]![0]!.nextLetter).toBe("Σ-");
  });

  it("measures each token rather than copying one duration onto all of them", () => {
    const bank = assembleBank(PARTIAL, (token) => ({
      samples: voiced(token.endSeconds - token.startSeconds),
      sampleRate: 48_000,
    }));

    expect(bank.tokens["alpha"]![0]!.durationMs).toBeCloseTo(450, 0);
    expect(bank.tokens["sigma-dash"]![0]!.durationMs).toBeCloseTo(500, 0);
    expect(bank.tokens["alpha"]![0]!.f0StartHz).toBeGreaterThan(140);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/pronunciation/build-token-bank.test.ts`
Expected: FAIL — cannot resolve `scripts/build-token-bank`

- [ ] **Step 3: Write the script**

```ts
// scripts/build-token-bank.ts
/**
 * Turn cut tokens into the v2 bank the player loads.
 *
 * Run: pnpm exec tsx scripts/build-token-bank.ts <session-dir>
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { measureTokenFeatures } from "../src/lib/shared/pronunciation/domain/audio-features";
import { getLetterPronunciation } from "../src/lib/shared/pronunciation/pronunciation-plan";
import type {
  PronunciationPosition,
  PronunciationTokenBank,
} from "../src/lib/shared/pronunciation/pronunciation-plan";

export interface PartialToken {
  letter: string;
  path: string;
  position: PronunciationPosition;
  previousLetter: string | null;
  nextLetter: string | null;
  sourceWord: string;
  indexInWord: number;
  groupLength: number;
  startSeconds: number;
  endSeconds: number;
}

export interface DecodedToken {
  samples: Float32Array;
  sampleRate: number;
}

/**
 * Bank keys are asset keys ("sigma-dash"); neighbour fields are letter VALUES
 * ("Σ-"), because the selector compares them against `PronunciationCue.letter`.
 * The manifest parser enforces that neighbours normalise to real letters for
 * exactly this reason — an asset key there parses and then mismatches on every
 * join in the bank, silently.
 */
export function assembleBank(
  tokens: readonly PartialToken[],
  decode: (token: PartialToken) => DecodedToken
): PronunciationTokenBank {
  const bank: PronunciationTokenBank = { version: 2, tokens: {} };

  for (const token of tokens) {
    const assetKey = getLetterPronunciation(token.letter as never)?.assetKey;
    if (!assetKey) {
      throw new Error(`${token.path}: "${token.letter}" is not a TKA letter`);
    }

    const decoded = decode(token);
    // Destructured rather than spread: measureTokenFeatures also returns
    // rmsStartDb/rmsEndDb, which the token type does not carry and the parser
    // ignores. Spreading them would write two dead fields per token into every
    // bank — TypeScript does not flag excess properties that arrive by spread.
    const { durationMs, rmsDb, f0StartHz, f0EndHz } = measureTokenFeatures(
      decoded.samples,
      decoded.sampleRate
    );

    (bank.tokens[assetKey] ??= []).push({
      path: token.path,
      position: token.position,
      previousLetter: token.previousLetter,
      nextLetter: token.nextLetter,
      sourceWord: token.sourceWord,
      indexInWord: token.indexInWord,
      groupLength: token.groupLength,
      durationMs,
      rmsDb,
      f0StartHz,
      f0EndHz,
    });
  }

  return bank;
}

function decodeWav24(path: string): DecodedToken {
  const buffer = readFileSync(path);
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const sampleRate = view.getUint32(24, true);
  const bits = view.getUint16(34, true);
  if (bits !== 24) throw new Error(`${path}: expected 24-bit PCM, found ${bits}`);

  const dataBytes = view.getUint32(40, true);
  const samples = new Float32Array(dataBytes / 3);
  for (let index = 0; index < samples.length; index++) {
    const offset = 44 + index * 3;
    const raw =
      view.getUint8(offset) |
      (view.getUint8(offset + 1) << 8) |
      (view.getUint8(offset + 2) << 16);
    const signed = raw >= 0x800000 ? raw - 0x1000000 : raw;
    samples[index] = signed / 8_388_607;
  }
  return { samples, sampleRate };
}

function main(): void {
  const session = process.argv[2];
  if (!session) {
    console.error("usage: build-token-bank.ts <session-dir>");
    process.exit(1);
  }

  const partial: PartialToken[] = JSON.parse(
    readFileSync(join(session, "tokens-partial.json"), "utf-8")
  );
  const bank = assembleBank(partial, (token) => decodeWav24(join(session, token.path)));
  const output = join(session, "pronunciation-bank.json");

  writeFileSync(output, `${JSON.stringify(bank, null, 2)}\n`);
  console.log(`wrote ${partial.length} tokens to ${output}`);
}

if (process.argv[1]?.endsWith("build-token-bank.ts")) main();
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/pronunciation/build-token-bank.test.ts`
Expected: PASS, 3 tests

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(pronunciation): assemble the v2 token bank from cut tokens" -- scripts/build-token-bank.ts tests/unit/pronunciation/build-token-bank.test.ts
```

---

## Task 17: Misread verification

The aligner will force the expected letters onto whatever audio it is given, so a word read wrong aligns cleanly and enters the bank under the wrong letter. That is the one failure neither the session nor the aligner can see.

**Files:**
- Create: `tools/pronunciation/verify.py`

- [ ] **Step 1: Write it**

```python
# tools/pronunciation/verify.py
"""Flag words that were read as something other than what was prompted.

Forced alignment cannot catch this: it is told which letters are in the file and
will place them somewhere regardless. Recognition is a genuinely independent
opinion, which is the only kind that helps here. Advisory — it lists words to
listen to, it does not delete anything.
"""

import argparse
import difflib
import json
import pathlib

from faster_whisper import WhisperModel

MATCH_FLOOR = 0.6


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("session", type=pathlib.Path)
    parser.add_argument("--model", default="small.en")
    args = parser.parse_args()

    model = WhisperModel(args.model, compute_type="int8")
    words = json.loads((args.session / "words.json").read_text(encoding="utf-8"))

    suspect = []
    for entry in words:
        word_id = pathlib.Path(entry["file"]).stem
        expected = (args.session / f"{word_id}.lab").read_text(encoding="utf-8").strip()

        segments, _ = model.transcribe(
            str(args.session / entry["file"]), language="en", beam_size=5
        )
        heard = " ".join(segment.text for segment in segments).strip()

        ratio = difflib.SequenceMatcher(
            None, expected.lower(), heard.lower()
        ).ratio()
        if ratio < MATCH_FLOOR:
            suspect.append({"id": word_id, "expected": expected, "heard": heard,
                            "similarity": round(ratio, 2)})

    report = args.session / "misreads.json"
    report.write_text(
        json.dumps(suspect, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    print(f"{len(suspect)} of {len(words)} words look misread — see {report}")
    for item in suspect:
        print(f"  {item['id']}: expected {item['expected']!r}, heard {item['heard']!r}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Run it against the throwaway session from Task 14**

Run: `conda activate tka-pronunciation && python tools/pronunciation/verify.py <session-dir>`
Expected: a count and a `misreads.json`. Deliberately misread one word when recording the throwaway session — if that word is not in the report, `MATCH_FLOOR` is too low and the tool does nothing. Report the observed similarity values either way.

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(pronunciation): flag misread words with faster-whisper" -- tools/pronunciation/verify.py
```

---

## Task 18: End to end, and the amendment to the corpus design

- [ ] **Step 1: Run the full pronunciation suite and the typecheck**

Run: `npx vitest run tests/unit/pronunciation`
Expected: PASS across every file.

Run: `npm run check > /tmp/check.log 2>&1; grep -niE "pronunciation" /tmp/check.log`
Expected: no lines. Repo-wide errors elsewhere are pre-existing — count them, do not fix them here. Run this once; a cold check costs minutes and parallel runs share no cache.

- [ ] **Step 2: Record a real ten-word session and take it all the way through**

Ten words — two each at lengths 2, 3, 4, 6, 8 — plus five solo reads, through the page. Then:

```bash
python tools/pronunciation/align.py <session-dir> && python tools/pronunciation/cut_tokens.py <session-dir> && pnpm exec tsx scripts/build-token-bank.ts <session-dir> && python tools/pronunciation/verify.py <session-dir>
```

Then listen to the files in `<session-dir>/tokens/`. This is the gate the whole design exists to pass, and no automated check substitutes for it. Report: how many words aligned, how many tokens were cut, the durations, and what the tokens sound like at their edges.

- [ ] **Step 3: Amend the parent corpus design**

In `docs/superpowers/specs/2026-08-16-pronunciation-corpus-design.md`, add an amendment block at the top of §2 and §3:

> **Amended 2026-08-16** (see `2026-08-16-pronunciation-corpus-session-design.md`).
> §2: the deliberate inter-letter gap is removed. It existed only so an energy
> segmenter could find letter boundaries; forced alignment has the transcript
> and does not need it, and natural reading restores the coarticulation
> `NEIGHBOUR_MISMATCH_COST` is priced for.
> §3: `segmentWordByEnergy` is no longer the corpus's segmenter. MFA 3.0 places
> the boundaries; the energy segmenter remains as a diagnostic and as the
> fallback when the aligner is not installed.

- [ ] **Step 4: Commit**

```bash
git commit -m "docs(pronunciation): amend the corpus design for forced alignment" -- docs/superpowers/specs/2026-08-16-pronunciation-corpus-design.md
```

---

## Deferred, deliberately

Carried from the 25-finding review and **not** in scope here. Each is real; none blocks a recording session.

- `targetCost`'s length term is unbounded — at `groupLength` 16 a wrong-context token scores 2.1 against a right-context 2.0 and wins.
- The legacy alias `"Γ"` → `"γ"` validates and then never matches.
- Bank keys are not checked against known asset keys.
- `bufferPromises` caches roughly 90 MB unbounded.
- Six tests that cannot fail: the length term, `UNKNOWN_F0_JOIN_COST`'s value, `cueNeighbours`' group-edge guard, and three v2 player tests that pass with v2 removed.
- Resuming a session from `session.json` — Task 12 plans from zero coverage each sitting, which over-serves rather than under-serves and is safe.
