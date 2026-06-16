import { describe, it, expect } from "vitest";
import { resolvePresentation } from "$lib/shared/sequence-viewer/services/presentation-resolver";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
import { createSequenceData } from "$lib/shared/foundation/domain/models/sequence-data";


function sequenceWithCreatorIntent() {
  return createSequenceData({
    word: "TEST",
    creatorIntent: {
      propConfig: {
        bluePropType: PropType.FAN,
        redPropType: PropType.FAN,
        catDogMode: false,
      },
      effortTimeline: {
        phrases: [{ id: "p1", effortId: "glide", startStep: 1, endStep: 4 }],
        transition: "hard",
      },
    },
  });
}

function sequenceWithLegacyIntendedProp() {
  return createSequenceData({
    word: "LEGACY",
    intendedProp: {
      bluePropType: PropType.CLUB,
      redPropType: PropType.CLUB,
      catDogMode: false,
    },
  });
}

function bareSequence() {
  return createSequenceData({ word: "BARE" });
}

describe("PresentationResolver", () => {
  const viewerBlue = PropType.STAFF;
  const viewerRed = PropType.STAFF;

  describe("creator-expression mode", () => {
    it("uses creatorIntent when present", () => {
      const result = resolvePresentation(
        sequenceWithCreatorIntent(),
        "creator-expression",
        viewerBlue, viewerRed, false
      );
      expect(result.bluePropType).toBe(PropType.FAN);
      expect(result.redPropType).toBe(PropType.FAN);
      expect(result.source).toBe("creator-intent");
      expect(result.effortTimeline?.phrases).toHaveLength(1);
    });

    it("falls back to legacy intendedProp", () => {
      const result = resolvePresentation(
        sequenceWithLegacyIntendedProp(),
        "creator-expression",
        viewerBlue, viewerRed, false
      );
      expect(result.bluePropType).toBe(PropType.CLUB);
      expect(result.source).toBe("creator-intent");
    });

    it("falls back to viewer settings when no intent exists", () => {
      const result = resolvePresentation(
        bareSequence(),
        "creator-expression",
        viewerBlue, viewerRed, false
      );
      expect(result.bluePropType).toBe(PropType.STAFF);
      expect(result.source).toBe("viewer-settings");
    });
  });

  describe("notation mode", () => {
    it("always uses viewer settings for props", () => {
      const result = resolvePresentation(
        sequenceWithCreatorIntent(),
        "notation",
        viewerBlue, viewerRed, false
      );
      expect(result.bluePropType).toBe(PropType.STAFF);
      expect(result.source).toBe("viewer-settings");
    });

    it("still includes effort from creator intent", () => {
      const result = resolvePresentation(
        sequenceWithCreatorIntent(),
        "notation",
        viewerBlue, viewerRed, false
      );
      expect(result.effortTimeline?.phrases).toHaveLength(1);
    });

    it("reads effort from top-level effortTimeline when no creatorIntent", () => {
      const seq = createSequenceData({
        word: "OLD",
        effortTimeline: {
          phrases: [{ id: "p2", effortId: "press", startStep: 1, endStep: 4 }],
          transition: "hard",
        },
      });
      const result = resolvePresentation(
        seq, "notation", viewerBlue, viewerRed, false
      );
      expect(result.effortTimeline?.phrases).toHaveLength(1);
      expect(result.effortTimeline?.phrases[0]?.effortId).toBe("press");
    });
  });
});
