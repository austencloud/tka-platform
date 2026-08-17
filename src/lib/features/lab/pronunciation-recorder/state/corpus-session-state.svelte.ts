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
  const keys = options.words.map((word) => word.join(" "));
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

  async function handleSpeechEnd(
    seconds: number,
    span: ReturnType<IAudioRingCapture["readSeconds"]>
  ): Promise<void> {
    const word = wordOf(currentKey);
    if (!word || status !== "running") return;

    const syllables = syllablesInWord(word);
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
          // Read the ring HERE, not inside the queued step. Uploads are the slow
          // link now, and a queue that has backed up behind one would push this
          // read past the point where the ring has overwritten the samples — the
          // word would be lost to a network hiccup rather than a bad read.
          const audio = options.capture.readSeconds(
            span.startSeconds - LEAD_IN_SECONDS,
            span.endSeconds + TAIL_SECONDS
          );
          // Serialised: two words must never be written concurrently, or their
          // ids interleave and words.json disagrees with the stored session.
          pending = pending.then(() =>
            handleSpeechEnd(span.endSeconds - span.startSeconds, audio)
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
