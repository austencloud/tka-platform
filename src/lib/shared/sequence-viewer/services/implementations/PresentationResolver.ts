import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type {
  IPresentationResolver,
  ViewingContext,
  ResolvedPresentation,
} from "../contracts/IPresentationResolver";

export class PresentationResolver implements IPresentationResolver {
  resolve(
    sequence: SequenceData,
    viewingContext: ViewingContext,
    viewerBlue: PropType,
    viewerRed: PropType,
    viewerCatDog: boolean
  ): ResolvedPresentation {
    const intent = sequence.creatorIntent;
    const legacyProp = sequence.intendedProp;

    // Effort is always from creator intent (choreographic, not a preference)
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
    }

    return {
      bluePropType: viewerBlue,
      redPropType: viewerRed,
      catDogMode: viewerCatDog,
      effortTimeline,
      source: "viewer-settings",
    };
  }
}
