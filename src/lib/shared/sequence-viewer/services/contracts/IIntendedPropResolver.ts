import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";

export interface ResolvedPropConfig {
  bluePropType: PropType;
  redPropType: PropType;
  catDogMode: boolean;
  source: "intended" | "creator-favorite" | "viewer-settings";
}

export interface IIntendedPropResolver {
  resolve(
    sequence: SequenceData,
    creatorFavoriteProp: PropType | null,
    viewerBlue: PropType,
    viewerRed: PropType,
    viewerCatDog: boolean
  ): ResolvedPropConfig;
}
