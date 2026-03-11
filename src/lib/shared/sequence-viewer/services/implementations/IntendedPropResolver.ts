import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { IIntendedPropResolver, ResolvedPropConfig } from "../contracts/IIntendedPropResolver";

export class IntendedPropResolver implements IIntendedPropResolver {
  resolve(
    sequence: SequenceData,
    creatorFavoriteProp: PropType | null,
    viewerBlue: PropType,
    viewerRed: PropType,
    viewerCatDog: boolean
  ): ResolvedPropConfig {
    if (sequence.intendedProp) {
      return {
        bluePropType: sequence.intendedProp.bluePropType,
        redPropType: sequence.intendedProp.redPropType,
        catDogMode: sequence.intendedProp.catDogMode,
        source: "intended",
      };
    }
    if (creatorFavoriteProp) {
      return {
        bluePropType: creatorFavoriteProp,
        redPropType: creatorFavoriteProp,
        catDogMode: false,
        source: "creator-favorite",
      };
    }
    return {
      bluePropType: viewerBlue,
      redPropType: viewerRed,
      catDogMode: viewerCatDog,
      source: "viewer-settings",
    };
  }
}
