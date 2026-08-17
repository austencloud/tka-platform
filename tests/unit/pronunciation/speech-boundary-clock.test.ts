// tests/unit/pronunciation/speech-boundary-clock.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Letter } from "$lib/shared/foundation/domain/models/letter";
import { SampleRing } from "$lib/features/lab/pronunciation-recorder/domain/sample-ring";
import { createCorpusSession } from "$lib/features/lab/pronunciation-recorder/state/corpus-session-state.svelte";
import type { SpeechBoundaryHandlers } from "$lib/features/lab/pronunciation-recorder/services/contracts/ISpeechBoundaryDetector";

/**
 * The detector and the ring have to be on one timeline.
 *
 * The ring counts samples from zero at `capture.start()`. The detector reports
 * when a word began and ended. If those are measured against different origins
 * — a wall clock against a sample clock — the numbers still look like seconds,
 * the code still type-checks, and every single read comes back null. The
 * session re-queues each word without saying why, and stops a few words in.
 *
 * The existing session tests miss it because their fake capture returns samples
 * for any span asked of it. These use a real ring.
 */

const SAMPLE_RATE = 48_000;

/** A capture whose ring behaves like the real one and whose clock starts at zero. */
function ringCapture() {
  const ring = new SampleRing(SAMPLE_RATE * 30);
  return {
    sampleRate: SAMPLE_RATE,
    get clock() {
      return ring.writtenSamples;
    },
    levelDb: -20,
    async start() {},
    /** Advance the clock as if the microphone had been running that long. */
    advanceSeconds(seconds: number) {
      ring.write(new Float32Array(Math.round(seconds * SAMPLE_RATE)));
    },
    readSeconds(from: number, to: number) {
      const samples = ring.read(
        Math.max(0, Math.round(from * SAMPLE_RATE)),
        Math.round(to * SAMPLE_RATE)
      );
      return samples ? { samples, sampleRate: SAMPLE_RATE } : null;
    },
    async stop() {},
  };
}

function harness() {
  const capture = ringCapture();
  let handlers: SpeechBoundaryHandlers | null = null;
  let clockSeconds: (() => number) | null = null;
  const written: string[] = [];

  const session = createCorpusSession({
    words: [[Letter.A, Letter.B]],
    capture,
    detector: {
      async start(_stream, given, clock) {
        handlers = given;
        clockSeconds = clock;
      },
      async stop() {},
    },
    store: {
      supportsDirectSave: () => true,
      async connect() {
        return { name: "corpus", directSave: true };
      },
      async writeWord(id) {
        written.push(id);
      },
      async writeSession() {},
      async finish() {},
    },
    microphone: {
      async connect() {
        return { stream: {} as MediaStream, devices: [], settings: { label: "fake" } };
      },
    },
  });

  return {
    session,
    capture,
    written,
    get handlers() {
      return handlers!;
    },
    get clockSeconds() {
      return clockSeconds!;
    },
  };
}

describe("the detector's clock", () => {
  it("is the capture's clock, not the page's", async () => {
    const h = harness();
    await h.session.start();

    h.capture.advanceSeconds(3);

    // Whatever the page has been open for, the detector is told the microphone
    // has been running for three seconds.
    expect(h.clockSeconds()).toBeCloseTo(3, 3);
  });

  it("reports spans the ring can actually return", async () => {
    const h = harness();
    await h.session.start();

    // Two seconds of room tone, then a one-second word ending now.
    h.capture.advanceSeconds(3);
    const now = h.clockSeconds();
    h.handlers.onSpeechEnd({ startSeconds: now - 1, endSeconds: now - 0.5 });
    await h.session.settled();

    expect(h.written).toEqual(["001"]);
  });

  it("loses every word when the two clocks disagree", async () => {
    // The failure this file exists for, stated as a test: a detector timing
    // against page uptime hands over spans that are minutes past anything the
    // ring holds, and the session silently records nothing.
    const h = harness();
    await h.session.start();
    h.capture.advanceSeconds(3);

    const pageUptime = 240;
    h.handlers.onSpeechEnd({ startSeconds: pageUptime - 1, endSeconds: pageUptime });
    await h.session.settled();

    expect(h.written).toEqual([]);
  });
});

describe("SileroBoundaryDetector", () => {
  const config: { onSpeechStart?: () => void; onSpeechEnd?: () => void } = {};

  beforeEach(() => {
    vi.resetModules();
    for (const key of Object.keys(config)) delete config[key as keyof typeof config];
  });

  it("times its spans on the clock it was given", async () => {
    vi.doMock("@ricky0123/vad-web", () => ({
      MicVAD: {
        new: async (given: Record<string, unknown>) => {
          Object.assign(config, given);
          return { start() {}, destroy() {} };
        },
      },
    }));

    const { SileroBoundaryDetector } = await import(
      "$lib/features/lab/pronunciation-recorder/services/implementations/SileroBoundaryDetector"
    );

    let captureSeconds = 0;
    const spans: Array<{ startSeconds: number; endSeconds: number }> = [];
    const detector = new SileroBoundaryDetector();
    await detector.start(
      {} as MediaStream,
      { onSpeechStart: () => {}, onSpeechEnd: (span) => spans.push(span) },
      () => captureSeconds
    );

    captureSeconds = 5;
    config.onSpeechStart!();
    captureSeconds = 6.7;
    config.onSpeechEnd!();

    // The end is charged back by the redemption window, because the callback
    // only fires once that much non-speech has held.
    expect(spans).toEqual([{ startSeconds: 5, endSeconds: 6 }]);
  });
});
