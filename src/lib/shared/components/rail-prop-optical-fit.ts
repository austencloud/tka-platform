import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";

const DEFAULT_RAIL_PROP_SCALE = 1.5;

/**
 * Extremely wide prop artwork carries more transparent space than round and
 * radial artwork. These optical scales equalize what the eye sees while the
 * rail's reserved box remains identical for every prop.
 */
const RAIL_PROP_SCALES: Partial<Record<PropType, number>> = {
  [PropType.BIGSTAFF]: 1.65,
  [PropType.CLUB]: 2.1,
  [PropType.CLASSIC_CLUB]: 2.1,
  [PropType.BIGHOOP]: 2,
  [PropType.BIGBUUGENG]: 1.6,
  [PropType.SWORD]: 1.6,
  [PropType.SICKLES]: 1.7,
  [PropType.CHICKEN]: 2.1,
  [PropType.UKULELE]: 1.7,
  [PropType.BIGEIGHTRINGS]: 1.6,
  [PropType.TORCH]: 2.1,
  [PropType.CONTACTBALL]: 1.55,
};

export function getRailPropOpticalScale(propType: PropType): number {
  return RAIL_PROP_SCALES[propType] ?? DEFAULT_RAIL_PROP_SCALE;
}
