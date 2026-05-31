import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { EffortTimeline } from "$lib/shared/effort/domain/effort-timeline-types";

export type ViewingContext = "notation" | "creator-expression";

export interface ResolvedPresentation {
  readonly bluePropType: PropType;
  readonly redPropType: PropType;
  readonly catDogMode: boolean;
  readonly effortTimeline: EffortTimeline | null;
  readonly source: "creator-intent" | "viewer-settings";
}

export function resolvePresentation(
  sequence: SequenceData,
  viewingContext: ViewingContext,
  viewerBlue: PropType,
  viewerRed: PropType,
  viewerCatDog: boolean
): ResolvedPresentation {
  const intent = sequence.creatorIntent;
  const legacyProp = sequence.intendedProp;

  const effortTimeline =
    intent?.effortTimeline ?? sequence.effortTimeline ?? null;

  if (viewingContext === "creator-expression") {
    if (intent?.propConfig) {
      return {
        bluePropType: intent.propConfig.bluePropType,
        redPropType: intent.propConfig.redPropType,
        catDogMode: intent.propConfig.catDogMode,
        effortTimeline,
        source: "creator-intent",
      };
    }
    if (legacyProp) {
      return {
        bluePropType: legacyProp.bluePropType,
        redPropType: legacyProp.redPropType,
        catDogMode: legacyProp.catDogMode,
        effortTimeline,
        source: "creator-intent",
      };
    }
    if (sequence.steps?.length) {
      const firstStep = sequence.steps[0];
      const blueMotion = firstStep?.motions?.blue;
      const redMotion = firstStep?.motions?.red;
      const blueProp = blueMotion?.propType as string | undefined;
      const redProp = redMotion?.propType as string | undefined;
      if (blueProp && redProp && blueProp !== "hand" && redProp !== "hand") {
        return {
          bluePropType: blueProp as PropType,
          redPropType: redProp as PropType,
          catDogMode: viewerCatDog,
          effortTimeline,
          source: "creator-intent",
        };
      }
    }
  }

  return {
    bluePropType: viewerBlue,
    redPropType: viewerRed,
    catDogMode: viewerCatDog,
    effortTimeline,
    source: "viewer-settings",
  };
}
