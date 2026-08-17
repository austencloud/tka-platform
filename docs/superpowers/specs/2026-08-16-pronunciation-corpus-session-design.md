# Pronunciation corpus recording session

Status: draft — replaces the 2026-08-16 version of this file wholesale
Date: 2026-08-16
Supersedes parts of: `2026-08-16-pronunciation-corpus-design.md`

## Problem

The corpus design settles what the bank is and how selection reads it. Its
capture stage is one paragraph: "displays one word at a time and advances
without per-word approval." Everything that makes that sentence true was
unspecified.

The requirement, in Austen's words: open the page, press one start button, read
the words aloud, and have it move to the next word by itself and finish on its
own.

## Why this document was rewritten

The first version of this spec invented its own mechanism for both halves of the
job, and both inventions were wrong.

**The live gate could not work as written.** It advanced when a live energy
analyser had counted as many speech islands as the prompted word had letters,
claiming the live count and the offline count "agree by construction." They
cannot. `voice-activity-trimmer.ts:74` sets its threshold as
`max(0.0015, noiseFloor * 3.2, peak * 0.055)`, where `noiseFloor` is the 20th
percentile of frame energies across the whole word and `peak` is the maximum
across the whole word. Both are known only after the word is over. A streaming
detector has neither, so the two detectors disagree by construction, and the
count gate was the entire hands-free mechanism.

**Segmenting was the wrong problem.** Finding letter boundaries by hunting for
energy islands is segmentation — looking for units blind. We are not blind: the
prompt tells us exactly which letters were spoken, in order. That is forced
alignment, a different and much better-conditioned problem, and it has a mature
offline answer. Using it changes the requirements on the recording itself: the
200 ms inter-letter gap the energy segmenter needs disappears, so Austen reads
naturally at his own pace, and the tokens carry the coarticulation the join and
neighbour costs were priced for. The old design destroyed that coarticulation to
make its own segmenter work.

**Nobody checked for prior art.** Two projects already do the prompting side of
this — [piper-recording-studio](https://github.com/rhasspy/piper-recording-studio)
and [mimic-recording-studio](https://github.com/MycroftAI/mimic-recording-studio).
Their formats and flow are borrowed below rather than reinvented.

## Architecture in one line

The browser captures audio and decides only *when he has finished a word*.
Everything about *where the letters are inside that word* happens offline, from
the transcript, with a forced aligner.

## Part 1 — the browser

### Advance detection: Silero VAD, not an energy meter

`@ricky0123/vad-web` runs Silero v5 through ONNX Runtime Web in an AudioWorklet.
It is a small neural VAD with recurrent state, so it is causal by construction —
frame *n*'s decision uses frames 0..*n* and nothing later. That is the property
the energy detector could not have.

```js
const vad = await MicVAD.new({
  getStream: async () => stream,  // the same MediaStream the capture holds
  model: "v5",
  redemptionMs: WORD_END_SILENCE_MS,
  preSpeechPadMs: 300,
  minSpeechMs: 200,
  baseAssetPath: "/vad/",
  onnxWASMBasePath: "/vad/",
  onSpeechStart, onSpeechEnd, onVADMisfire,
});
```

Silero v5 runs 512-sample frames at 16 kHz — 32 ms each. `redemptionMs` is how
long non-speech must hold before the utterance is declared over, so it *is* the
end-of-word silence: `WORD_END_SILENCE_MS = 700`, down from the library's 1400 ms
default, which is tuned for conversational turn-taking rather than for a list of
short words. That single number is the only silence threshold in the design,
because there is no longer an inter-letter threshold for it to collide with.

`positiveSpeechThreshold` and `negativeSpeechThreshold` stay at the library
defaults (0.3 / 0.25). They are the two knobs Phase 0 is allowed to move if the
VAD proves trigger-happy on breath noise in Austen's room.

The VAD's own downsampled audio is used **only** for the advance decision and
for segment timestamps. It is never the recording. Assets (`vad.worklet.bundle.min.js`,
`silero_vad_v5.onnx`, the onnxruntime-web WASM) are vendored under
`static/vad/` rather than loaded from a CDN, so the tool works offline and does
not depend on a third-party host during a 40-minute session.

Selected over TEN VAD, which benchmarks better but carries a licence term
barring use in products competing with Agora — unacceptable for a commercial
app — and over FireRedVAD, whose browser story is unverified. Silero is MIT and
is the one with a maintained, proven browser binding.

### Capture: an AudioWorklet ring, no chunking

The previous design held 60-second `mediabunny` takes and called
`decodeAudioData` at each rollover, which puts an unbounded decode on the path
between two words and needs a whole rollover state machine to hide it.

Instead a capture worklet writes 48 kHz mono `Float32` into a ring of
`RING_SECONDS = 30`. At each advance the session drains
`[speechStart − LEAD_IN, speechEnd + TAIL]` (`LEAD_IN = TAIL = 0.25 s`) out of
the ring and encodes it directly to a 24-bit PCM WAV. There is no decode step
anywhere, no chunk boundary, no rollover, and the word audio and the VAD
timestamps share one sample clock. A word is roughly 2 s ≈ 380 KB; nothing
accumulates.

`PronunciationRecorder`'s device enumeration, permission handling and gain
configuration are kept. Its `mediabunny` capture path and `renderDelivery` are
not used by this tool — one `MediaStream` feeds two consumers, the capture
worklet and the VAD.

### The in-session plausibility check

Forced alignment is offline, so the session still needs a cheap local answer to
"did he actually read the whole word." It has one that does not require counting
anything: **expected duration**.

Every TKA letter name has a known syllable count. The session maintains a
running median seconds-per-syllable, seeded from the first three words and
updated thereafter, and compares each word's captured speech duration against
`syllables × rate`. Under `DURATION_SHORTFALL = 0.6` of expectation, the word is
re-queued — he stopped part-way, or the VAD ended the utterance on a swallowed
breath. Over `DURATION_OVERRUN = 1.8`, it is also re-queued, because that is a
stumble or a restart.

This is a coarse filter and is meant to be. The real check is offline, where the
aligner either places every letter or does not.

### The queue

Unchanged from the approved decisions: a flagged word goes back
`REQUEUE_DISTANCE = 8` places rather than interrupting, so it gets a different
run-up; `MAX_ATTEMPTS = 3` retires it to the end-of-session report; he is never
asked about any of it.

### Early abort — new

The old design would keep re-queueing through a broken microphone for forty
minutes. Random failure and systematic failure need different responses, and
only the second is worth stopping for:

- `ABORT_EARLY_FAILURES = 3` failures inside the first `ABORT_EARLY_WINDOW = 8`
  words, or
- `ABORT_CONSECUTIVE_FAILURES = 4` in a row at any point

stops the session and shows what was measured — input level, noise floor,
selected device — because those are the three things that are actually wrong
when every word fails. Everything recorded so far is already on disk.

If `WORD_ABANDON_SILENCE = 3.0` s pass with no speech at all after a prompt
appears, the session pauses rather than failing the word. He walked away; that
is not a bad take.

### The screen

Borrowed from piper-recording-studio: current prompt large and centred, the next
prompt small and dim beneath it so there is no cold start on the next word, a
progress figure, an input-level meter, and one button. The button is Start
before the session and Pause during it. Nothing else is on the screen, and
nothing else needs to be touched.

Layout follows the required viewports in `visual-verification-mandatory.md` and
is verified with screenshots before it is called done. `SegmentedControl` and
`FilterChipBase` own any selector that appears (device picker); no raw chip
buttons, no checkboxes.

### Output — an MFA corpus, directly

Into the folder chosen at session start:

```
01.wav   01.lab      # "Alpha Beta Gamma"
02.wav   02.lab
...
words.json           # [{ file, word }]  — the existing harness contract
session.json         # coverage counts, retired words, rate estimate
```

`<id>.wav` + `<id>.lab` beside each other **is** the Montreal Forced Aligner
corpus format, so the offline stage runs on the session output with no
conversion. `words.json` is the contract `scripts/measure-word-segmentation.ts:26`
already reads. Both are written per word, not at the end, so a closed tab leaves
a directory both tools can still read.

No File System Access support falls back to the existing zip path.

## Part 2 — offline

### Forced alignment: MFA 3.0

MFA 3.0 reports mean boundary errors below 15 ms and is state of the art or near
it across the datasets in arXiv:2606.18466, benchmarked against both classic and
neural aligners. It is worth being explicit about why the modern-sounding option
is the wrong one here: end-to-end neural ASR with word timestamps (Whisper and
its derivatives) is *worse* at this, because it is trained to get the string
right, not the frame. MFA keeps an HMM-GMM acoustic model precisely for
boundary precision.

`tools/pronunciation/align.py`:

```
mfa validate  <corpus> tka_letters english_us_arpa
mfa align     <corpus> tka_letters english_us_arpa <out> --clean --fine_tune
```

MFA installs through conda (`conda install -c conda-forge montreal-forced-aligner`)
because it ships Kaldi binaries. It stays entirely out of the app: it is a
developer tool that runs over a session directory, the way the Blender export
scripts are.

**The dictionary.** `tka_letters` extends `english_us_arpa`. Most TKA letter
names are already in it — alpha, beta, gamma, sigma, psi, theta, tau, phi, chi,
xi, omega, dash, and the Latin letters. `mfa validate` writes the remainder to
`oovs_found.txt`, and those get hand-written ARPAbet entries in
`tools/pronunciation/tka-letters.dict`. That file is checked in; it is small,
stable, and it is the thing that makes the whole offline stage reproducible.

The aligner emits a TextGrid per word with word-level and phone-level intervals.
Word intervals are the letter boundaries. `tools/pronunciation/cut-tokens.py`
reads them, cuts each letter's span out of the 48 kHz WAV with a small symmetric
margin, and writes the token WAVs plus the v2 bank entries — `position`,
`previousLetter`, `nextLetter`, `sourceWord`, `indexInWord`, `groupLength`. The
features (`durationMs`, `rmsDb`, `f0StartHz`, `f0EndHz`) continue to come from
`audio-features.ts`, which is already tested to the level this needs.

### Misread detection — reopened

The old spec declared this out of scope, on the grounds that it needs
recognition. It does need recognition, and recognition is now available: with
Python in the project, `tools/pronunciation/verify.py` runs faster-whisper over
each word WAV and compares the transcript against the known letter names. Where
they disagree, the word is listed for a re-read.

This is not a boundary tool and is not used as one — it is a second opinion on
*what was said*, which is exactly the failure the count gate could never see and
the aligner will happily paper over by forcing the expected letters onto
whatever audio it was given. It runs after alignment, over material already on
disk, and costs nothing in the session.

The listening pass remains the final gate.

## What the corpus design must change

The parent spec is amended in three places, and the amendments are larger than
the previous set because the alignment decision reaches back into capture.

1. **§2 Capture — the inter-letter gap requirement is deleted.** Reading with
   deliberate 200 ms gaps existed only to feed the energy segmenter. Austen
   reads naturally.
2. **§3 Segmentation — replaced by forced alignment.** `segmentWordByEnergy`
   stays in the tree as the Phase 0 diagnostic and as the fallback when MFA is
   not installed, but it is no longer the corpus's segmenter.
3. **The coarticulation premise is repaired.** `NEIGHBOUR_MISMATCH_COST = 1`
   assumes tokens carry the influence of the letters beside them. Natural
   reading produces that; gap-separated reading did not. The review's sharpest
   finding is answered by the recording method rather than by re-pricing the
   cost.

The carrier-phrase fallback removal stands, for the reason established
previously: a carrier take cannot satisfy `hasCoherentContext`
(`pronunciation-manifest.ts:80`), and `parsePronunciationManifest` never merges
v1 into v2. Starved cells are filled by constructed words from the planner.

## The word plan

Unchanged in substance. 54 letters × 4 positions = 216 cells, target depth K=3.
`selectTokenPath` (`token-selection.ts:101`) returns null when any cue has no
candidate at its exact position, so coverage is a correctness requirement, not a
quality target.

A word of length L yields one `initial`, one `final`, and L−2 `medial` tokens,
so initials and finals bind at one per word: about 160 words at K=3. `isolated`
comes only from a single-letter group (`pronunciation-plan.ts:114`) and needs
its own pass of 54 solo reads.

The planner greedily picks the word filling the most under-served cells, mixing
lengths, from a checked-in pool built from generated TKA sequences. Where the
pool starves a cell it constructs a filler word placing that letter in the
position it lacks.

## What is deleted

`domain/recording-jobs.ts`, `domain/recording-manifest.ts`, and the job-mode UI
in `RecordingWorkspace.svelte` / `RecordingInventory.svelte` — the 216
carrier-phrase model, whose output cannot enter a v2 bank.

`TakeWaveform.svelte` stays; the end-of-session report shows flagged words.

## Testing

Pure units get real fixtures. The standard of proof is mutation: a test that has
not been observed to fail is not evidence.

- **Planner** — biases toward starved cells, mixes lengths, terminates, emits
  filler words only when the pool cannot cover a cell, reaches all 216 cells at
  K=3 from empty.
- **Queue** — re-queues at a distance, retires at three attempts, reports
  retired words.
- **Plausibility check** — flags a word cut short, flags a stumble, passes a
  normal read, and tracks a rate that drifts across a session. Removing the
  duration comparison must fail a test.
- **Early abort** — fires on the early window and on the consecutive run, and
  does not fire on the same number of failures spread across a long session.
- **Ring drain** — a word straddling the ring's wrap point comes out with its
  samples in order and its lead-in intact. This is the failure that would
  corrupt audio silently.
- **Session machine** — against a fake VAD and a fake store: every advance
  writes a WAV, a `.lab`, and a `words.json` entry before the next prompt shows.
- **Output contract** — a completed fake session produces a directory that
  `measure-word-segmentation.ts` reads without error and that `mfa validate`
  accepts.

The aligner itself is not unit-tested; it is a pinned external tool. What is
checked is that `cut-tokens.py` reproduces known boundaries from a hand-written
TextGrid, and that the bank it writes parses under `isPronunciationTokenBank`.

## Open

Phase 0 has not run. It is now a sanity check rather than a go/no-go: record ten
words, run the aligner, listen to the cut tokens. The decision it used to gate —
whether energy segmentation is good enough — has been made by choosing not to
depend on it.

The MFA dictionary's OOV set is unknown until `mfa validate` runs once. That
list is the first concrete task.
