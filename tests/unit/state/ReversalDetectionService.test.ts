/**
 * ReversalDetectionService Tests
 *
 * SUPER HIGH-VALUE: Determines when props reverse direction.
 * If broken: Wrong symbols shown, incorrect exports, impossible to debug.
 */

import { describe, expect, it, beforeEach } from "vitest";
import { ReversalDetectionService } from "../../../src/lib/features/create/shared/services/implementations/ReversalDetectionService";
import { MotionColor } from "../../../src/lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import type { BeatData } from "$lib/features/create/shared/domain/models/BeatData";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";

describe("ReversalDetectionService", () => {
  let service: ReversalDetectionService;

  beforeEach(() => {
    service = new ReversalDetectionService();
  });

  const createBeat = (
    num: number,
    blueDir: string | null = null,
    redDir: string | null = null,
    blank: boolean = false
  ): BeatData => ({
    id: `beat-${num}`,
    beatNumber: num,
    duration: 1.0,
    blueReversal: false,
    redReversal: false,
    isBlank: blank,
    letter: null,
    startPosition: null,
    endPosition: null,
    motions: {
      [MotionColor.BLUE]: blueDir
        ? ({ rotationDirection: blueDir } as any)
        : undefined,
      [MotionColor.RED]: redDir
        ? ({ rotationDirection: redDir } as any)
        : undefined,
    },
  });

  const createSeq = (beats: BeatData[]): SequenceData => ({
    id: "seq",
    name: "Test",
    word: "",
    beats,
    thumbnails: [],
    isFavorite: false,
    isCircular: false,
    level: 2,
    difficultyLevel: "intermediate",
    tags: [],
    metadata: {},
  });

  describe("processReversals", () => {
    it("should handle empty sequence", () => {
      const result = service.processReversals(createSeq([]));
      expect(result.beats).toHaveLength(0);
    });

    it("should have no reversal on first beat", () => {
      const beat = createBeat(1, "cw", "ccw");
      const result = service.processReversals(createSeq([beat]));

      expect(result.beats[0]!.blueReversal).toBe(false);
      expect(result.beats[0]!.redReversal).toBe(false);
    });

    it("should detect NO reversal when same direction", () => {
      const beats = [createBeat(1, "cw", "cw"), createBeat(2, "cw", "cw")];
      const result = service.processReversals(createSeq(beats));

      expect(result.beats[1]!.blueReversal).toBe(false);
      expect(result.beats[1]!.redReversal).toBe(false);
    });

    it("should detect reversal when direction changes", () => {
      const beats = [
        createBeat(1, "cw", "ccw"),
        createBeat(2, "ccw", "cw"), // Both reverse!
      ];
      const result = service.processReversals(createSeq(beats));

      expect(result.beats[1]!.blueReversal).toBe(true); // cw → ccw
      expect(result.beats[1]!.redReversal).toBe(true); // ccw → cw
    });

    it("should skip blank beats when detecting reversals", () => {
      const beats = [
        createBeat(1, "cw", "cw"),
        createBeat(2, null, null, true), // Blank
        createBeat(3, "ccw", "ccw"),
      ];
      const result = service.processReversals(createSeq(beats));

      // Beat 3 should reverse based on beat 1 (blank ignored)
      expect(result.beats[2]!.blueReversal).toBe(true);
      expect(result.beats[2]!.redReversal).toBe(true);
    });

    it("should handle mixed reversals (only one color)", () => {
      const beats = [
        createBeat(1, "cw", "cw"),
        createBeat(2, "cw", "ccw"), // Only red reverses
      ];
      const result = service.processReversals(createSeq(beats));

      expect(result.beats[1]!.blueReversal).toBe(false); // Blue stays cw
      expect(result.beats[1]!.redReversal).toBe(true); // Red reverses
    });

    it("should handle multiple reversals in sequence", () => {
      const beats = [
        createBeat(1, "cw", "cw"),
        createBeat(2, "ccw", "ccw"), // Reversal
        createBeat(3, "cw", "cw"), // Reversal again
      ];
      const result = service.processReversals(createSeq(beats));

      expect(result.beats[1]!.blueReversal).toBe(true);
      expect(result.beats[2]!.blueReversal).toBe(true);
    });

    it("should ignore noRotation direction", () => {
      const beats = [
        createBeat(1, "cw", "cw"),
        createBeat(2, "noRotation", "cw"),
      ];
      const result = service.processReversals(createSeq(beats));

      expect(result.beats[1]!.blueReversal).toBe(false);
      expect(result.beats[1]!.redReversal).toBe(false);
    });
  });

  describe("detectReversal", () => {
    it("should return no reversal for blank beat", () => {
      const blank = createBeat(1, null, null, true);
      const result = service.detectReversal([], blank);

      expect(result.blueReversal).toBe(false);
      expect(result.redReversal).toBe(false);
    });

    it("should detect reversal correctly", () => {
      const prev = createBeat(1, "cw", "ccw");
      const curr = createBeat(2, "ccw", "cw");
      const result = service.detectReversal([prev], curr);

      expect(result.blueReversal).toBe(true);
      expect(result.redReversal).toBe(true);
    });

    it("should look back past multiple blanks", () => {
      const prevBeats = [
        createBeat(1, "cw", "cw"),
        createBeat(2, null, null, true),
        createBeat(3, null, null, true),
      ];
      const curr = createBeat(4, "ccw", "ccw");
      const result = service.detectReversal(prevBeats, curr);

      expect(result.blueReversal).toBe(true);
      expect(result.redReversal).toBe(true);
    });
  });

  describe("Edge Cases", () => {
    it("should handle missing motion data", () => {
      const beat = { ...createBeat(1), motions: {} };
      const result = service.detectReversal([], beat);

      expect(result.blueReversal).toBe(false);
      expect(result.redReversal).toBe(false);
    });

    it("should process long sequences efficiently", () => {
      const beats: BeatData[] = [];
      for (let i = 0; i < 64; i++) {
        const dir = i % 2 === 0 ? "cw" : "ccw";
        beats.push(createBeat(i + 1, dir, dir));
      }

      const start = performance.now();
      const result = service.processReversals(createSeq(beats));
      const duration = performance.now() - start;

      expect(result.beats).toHaveLength(64);
      expect(duration).toBeLessThan(50); // Should be fast
    });
  });
});

/**
 * WHY VALUABLE:
 * - Catches wrong reversal detection (breaks every sequence)
 * - Tests blank beat handling (common bug)
 * - Tests edge cases (null/undefined data)
 * - Performance test (prevent UI freezes)
 */
