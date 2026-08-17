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
    audioContext: null,
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
      async start(given) {
        handlers = given.handlers;
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
    // A fourth word, because the rate tracker only starts judging after three
    // seed reads: with the three-word list the queue is already empty by then
    // and the short read lands on a finished session instead of the re-queue.
    const { session, speak, written } = harness([...WORDS, [Letter.G, Letter.H]]);
    await session.start();

    await speak(2, 1.0);
    await speak(4, 1.0);
    await speak(6, 1.0);
    const before = written.length;
    await speak(8, 0.1);

    expect(written).toHaveLength(before);
    expect(session.retired).toEqual([]);
    expect(session.status).toBe("running");
    // Re-queued rather than dropped: the word is still the one being asked for.
    expect(session.currentWord).toEqual([Letter.G, Letter.H]);
    expect(session.remaining).toBe(1);
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
