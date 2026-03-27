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
      // Infer prop type from motion data when no explicit intent exists
      // (deck sequences, imported sequences). The propType on the motions
      // IS the intended prop — the sequence was created with that prop.
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
}
