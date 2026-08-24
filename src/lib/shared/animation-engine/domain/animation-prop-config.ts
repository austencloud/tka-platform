import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";

export interface AnimationPropConfig {
  bluePropType: PropType;
  redPropType: PropType;
}

export type AnimationPropConfigProvider = () => AnimationPropConfig;

export const DEFAULT_ANIMATION_PROP_CONFIG: AnimationPropConfig = {
  bluePropType: PropType.STAFF,
  redPropType: PropType.STAFF,
};
