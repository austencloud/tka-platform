/**
 * IntendedPropResolver Unit Tests
 *
 * The 3-level cascade (intendedProp → creatorFavorite → viewerSettings)
 * determines which props render on-screen. A bug here silently shows
 * the wrong prop type — the viewer has no way to know it's wrong.
 */

import { describe, it, expect } from "vitest";
import { IntendedPropResolver } from "../../../src/lib/shared/sequence-viewer/services/implementations/IntendedPropResolver";
import { PropType } from "../../../src/lib/shared/pictograph/prop/domain/enums/PropType";
import type { SequenceData } from "../../../src/lib/shared/foundation/domain/models/SequenceData";

function makeSequence(intendedProp?: SequenceData["intendedProp"]): SequenceData {
  return {
    id: "test-1",
    word: "TEST",
    steps: [],
    intendedProp,
  } as unknown as SequenceData;
}

describe("IntendedPropResolver", () => {
  const resolver = new IntendedPropResolver();

  const VIEWER_BLUE = PropType.FAN;
  const VIEWER_RED = PropType.FAN;
  const VIEWER_CATDOG = false;

  describe("cascade priority", () => {
    it("uses intendedProp when present (highest priority)", () => {
      const seq = makeSequence({
        bluePropType: PropType.STAFF,
        redPropType: PropType.STAFF,
        catDogMode: false,
      });

      const result = resolver.resolve(seq, PropType.CLUB, VIEWER_BLUE, VIEWER_RED, VIEWER_CATDOG);

      expect(result.source).toBe("intended");
      expect(result.bluePropType).toBe(PropType.STAFF);
      expect(result.redPropType).toBe(PropType.STAFF);
      expect(result.catDogMode).toBe(false);
    });

    it("falls back to creator favorite when no intendedProp", () => {
      const seq = makeSequence(undefined);

      const result = resolver.resolve(seq, PropType.CLUB, VIEWER_BLUE, VIEWER_RED, VIEWER_CATDOG);

      expect(result.source).toBe("creator-favorite");
      expect(result.bluePropType).toBe(PropType.CLUB);
      expect(result.redPropType).toBe(PropType.CLUB);
      expect(result.catDogMode).toBe(false);
    });

    it("falls back to viewer settings when no intendedProp and no creator favorite", () => {
      const seq = makeSequence(undefined);

      const result = resolver.resolve(seq, null, VIEWER_BLUE, VIEWER_RED, true);

      expect(result.source).toBe("viewer-settings");
      expect(result.bluePropType).toBe(PropType.FAN);
      expect(result.redPropType).toBe(PropType.FAN);
      expect(result.catDogMode).toBe(true);
    });
  });

  describe("intendedProp catdog mode", () => {
    it("preserves different blue/red prop types from intendedProp", () => {
      const seq = makeSequence({
        bluePropType: PropType.STAFF,
        redPropType: PropType.FAN,
        catDogMode: true,
      });

      const result = resolver.resolve(seq, null, VIEWER_BLUE, VIEWER_RED, VIEWER_CATDOG);

      expect(result.bluePropType).toBe(PropType.STAFF);
      expect(result.redPropType).toBe(PropType.FAN);
      expect(result.catDogMode).toBe(true);
    });
  });

  describe("creator favorite always sets both hands same", () => {
    it("sets both blue and red to the favorite prop", () => {
      const seq = makeSequence(undefined);

      const result = resolver.resolve(seq, PropType.BUUGENG, VIEWER_BLUE, VIEWER_RED, true);

      expect(result.bluePropType).toBe(PropType.BUUGENG);
      expect(result.redPropType).toBe(PropType.BUUGENG);
      expect(result.catDogMode).toBe(false);
    });
  });

  describe("intendedProp takes priority over creator favorite", () => {
    it("ignores creator favorite when intendedProp exists", () => {
      const seq = makeSequence({
        bluePropType: PropType.TRIAD,
        redPropType: PropType.TRIAD,
        catDogMode: false,
      });

      const result = resolver.resolve(seq, PropType.FAN, PropType.CLUB, PropType.CLUB, true);

      expect(result.source).toBe("intended");
      expect(result.bluePropType).toBe(PropType.TRIAD);
      expect(result.redPropType).toBe(PropType.TRIAD);
    });
  });
});
