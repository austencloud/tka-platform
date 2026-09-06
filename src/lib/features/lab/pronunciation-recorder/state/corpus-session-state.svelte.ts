import { cellsCoveredBy, type CoverageCounts } from "../domain/corpus-plan";
import { syllablesInWord } from "../domain/letter-syllables";
import { createRateTracker } from "../domain/read-plausibility";
import { createAbortMonitor, type AbortReason } from "../domain/session-abort";
import { createSessionQueue } from "../domain/session-queue";
import { encodeWav24 } from "../domain/wav-encoder";
import type { CapturedSpan, IAudioRingCapture } from "../services/contracts/IAudioRingCapture";
import type { ICorpusSessionStore } from "../services/contracts/ICorpusSessionStore";
import type { ISpeechBoundaryDetector } from "../services/contracts/ISpeechBoundaryDetector";
import { nextWordId } from "../services/implementations/CorpusSessionStore";

/** Kept around each read so no consonant is clipped and the aligner has an anchor. */
const LEAD_IN_SECONDS = 0.25;
const TAIL_SECONDS = 0.25;

export type SessionStatus = "idle" | "running" | "finished" | "aborted" | "failed";

/**
 * Where the current read is in its life, as the screen reports it.
 *
 * The session used to say only whether the microphone was hearing something.
 * That leaves the two questions he actually asks out loud unanswered: has it
 * decided I am finished with this word, and did it keep what I said? The word
 * changing answered neither — it changed on a good read and sat still on a
 * rejected one, which reads identically to nothing happening at all.
 *
 * `saved` and `retry` are deliberately sticky: they hold until he starts the
 * next read. Nothing has to be timed out or held artificially, and the verdict
 * on the last word is on screen for exactly as long as he is not busy.
 */
export type ReadState = "waiting" | "hearing" | "heard" | "saved" | "retry";

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
  const keys = options.words.map((word) => word.join(" "));
  const byKey = new Map(keys.map((key, index) => [key, options.words[index]!]));
  const queue = createSessionQueue(keys);
  const rate = createRateTracker();
  const monitor = createAbortMonitor();
  const coverage: CoverageCounts = {};

  let status = $state<SessionStatus>("idle");
  let abortReason = $state<AbortReason | null>(null);
  let failure = $state<string | null>(null);
  // Whether the detector is hearing speech right now. The meter proves the
  // microphone is open; only this proves the half that ends words is awake.
  let hearing = $state(false);
  let readState = $state<ReadState>("waiting");
  // The word the verdict is about. Named on screen because by the time "saved"
  // is showing, the prompt has already moved on to the next one.
  let judgedKey = $state<string | null>(null);
  let folderName = $state<string | null>(null);
  let recorded = $state(0);
  let currentKey = $state<string | null>(null);
  let nextKey = $state<string | null>(null);
  let pending: Promise<void> = Promise.resolve();

  // The capture writes its peak to a plain field on the audio callback, a few
  // hundred times a second. Reading that field from the component gives Svelte
  // nothing to track, so the meter renders once and then sits still however
  // loud the room gets — which reads as a microphone that was never opened.
  // Sampling it into state once a frame is both reactive and the rate a meter
  // is actually watched at.
  let levelDb = $state(-100);
  let meterFrame: number | null = null;

  function pumpMeter(): void {
    // The meter is cosmetic; the session is not. Somewhere without a frame
    // callback it simply does not animate, rather than taking the recording
    // down with it.
    if (typeof requestAnimationFrame !== "function") return;
    levelDb = options.capture.levelDb;
    meterFrame = requestAnimationFrame(pumpMeter);
  }

  function stopMeter(): void {
    if (meterFrame !== null && typeof cancelAnimationFrame === "function") {
      cancelAnimationFrame(meterFrame);
    }
    meterFrame = null;
    levelDb = -100;
    hearing = false;
    readState = "waiting";
  }

  const wordOf = (key: string | null) => (key ? (byKey.get(key) ?? null) : null);

  const reasonFor = (error: unknown) => (error instanceof Error ? error.message : String(error));

  /**
   * Writes one word, or reports why it could not be written.
   *
   * Left to throw, a rejected upload ended the sitting without a word of
   * explanation: the queue never advanced, nothing changed on screen, and the
   * promise every later read was chained to stayed rejected — so none of those
   * reads ran either. A write that fails is a failed read like any other.
   */
  async function storeWord(word: readonly string[], span: CapturedSpan): Promise<boolean> {
    try {
      await options.store.writeWord(
        nextWordId(recorded),
        word,
        encodeWav24(span.samples, span.sampleRate)
      );
    } catch (error) {
      failure = `Could not save the recording. ${reasonFor(error)}`;
      return false;
    }

    recorded++;
    failure = null;
    return true;
  }

  function syncQueue(): SessionStatus {
    currentKey = queue.current;
    nextKey = queue.next;
    if (queue.current === null && status === "running") status = "finished";
    return status;
  }

  async function persist(): Promise<void> {
    await options.store.writeSession({
      version: 1,
      coverage,
      retired: [...queue.retired],
      wordsRecorded: recorded,
    });
  }

  async function handleSpeechEnd(
    seconds: number,
    span: ReturnType<IAudioRingCapture["readSeconds"]>
  ): Promise<void> {
    const word = wordOf(currentKey);
    if (!word || status !== "running") return;

    const syllables = syllablesInWord(word);
    const verdict = span === null ? "too-short" : rate.judge(syllables, seconds);

    if (verdict !== "ok" || span === null) {
      // Re-queued, and said so. Silent was the old behaviour, and it made a
      // thrown-away read look exactly like a kept one: same word, same screen,
      // no way to tell he had just recorded a cough.
      readState = "retry";
      monitor.record("fail");
      queue.requeue();
    } else if (await storeWord(word, span)) {
      readState = "saved";
      rate.observe(syllables, seconds);
      monitor.record("ok");
      for (const cell of cellsCoveredBy(word)) {
        coverage[cell] = (coverage[cell] ?? 0) + 1;
      }
      queue.accept();
    } else {
      // Said out loud by `storeWord`, and counted, so a run of rejected uploads
      // stops the session through the abort monitor rather than going quiet.
      readState = "retry";
      monitor.record("fail");
      queue.requeue();
    }

    try {
      await persist();
    } catch (error) {
      // Coverage is a convenience for the next sitting. Losing it is worth
      // reporting and not worth stopping for — the words themselves are already
      // written.
      failure = `Recorded, but could not save the session index. ${reasonFor(error)}`;
    }

    if (monitor.reason !== null) {
      abortReason = monitor.reason;
      status = "aborted";
      await stop();
      return;
    }

    const syncedStatus = syncQueue();
    if (syncedStatus === "finished") await stop();
  }

  async function start(deviceId?: string): Promise<void> {
    try {
      failure = null;
      const { stream } = await options.microphone.connect(deviceId);
      folderName = (await options.store.connect()).name;
      await options.capture.start(stream);
      pumpMeter();
      await options.detector.start({
        stream,
        context: options.capture.audioContext,
        clockSeconds: () => options.capture.clock / options.capture.sampleRate,
        handlers: {
          onSpeechStart: () => {
            hearing = true;
            // Clears the last word's verdict: he has moved on, and it has been
            // on screen since that word landed.
            readState = "hearing";
            judgedKey = currentKey;
          },
          onSpeechEnd: (span) => {
            hearing = false;
            // The moment the detector decides the word is over — the thing the
            // screen never showed. Set here rather than in the queued step so
            // it lands the instant it is true, not behind whatever upload is
            // still in flight.
            readState = "heard";
            // Read the ring HERE, not inside the queued step. Uploads are the
            // slow link now, and a queue that has backed up behind one would
            // push this read past the point where the ring has overwritten the
            // samples — the word would be lost to a network hiccup rather than
            // a bad read.
            const audio = options.capture.readSeconds(
              span.startSeconds - LEAD_IN_SECONDS,
              span.endSeconds + TAIL_SECONDS
            );
            // Serialised: two words must never be written concurrently, or
            // their ids interleave and words.json disagrees with the stored
            // session.
            pending = pending
              .then(() => handleSpeechEnd(span.endSeconds - span.startSeconds, audio))
              // Nothing may leave this chain rejected. A rejected `pending` is a
              // dead session: every later `.then` is skipped without running, so
              // one unexpected throw silences every word he reads after it.
              .catch((error) => {
                failure = reasonFor(error);
              });
          },
        },
      });
      status = "running";
      syncQueue();
    } catch (error) {
      stopMeter();
      // Carried to the screen. Swallowing it left "could not start" as the only
      // account of a microphone that was denied, a sign-in that had expired,
      // and a detector that never opened.
      failure = reasonFor(error);
      status = "failed";
    }
  }

  async function stop(): Promise<void> {
    stopMeter();
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
      return levelDb;
    },
    get hearing() {
      return hearing;
    },
    get readState() {
      return readState;
    },
    get judgedWord() {
      return wordOf(judgedKey);
    },
    get failure() {
      return failure;
    },
    start,
    stop,
    /** Test seam: resolves once every queued write has landed. */
    settled: () => pending,
  };
}
