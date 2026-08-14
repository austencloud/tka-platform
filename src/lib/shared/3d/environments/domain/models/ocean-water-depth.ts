/** The deck sits 2.5 m above the seabed datum. */
export const OCEAN_STAGE_DECK_OFFSET_METERS = 2.5;

/** The deeper waterline that preceded the requested 25-foot increase. */
export const OCEAN_BASE_WATER_DEPTH_METERS = 16;

/** The requested increase, converted from feet into scene metres. */
export const OCEAN_ADDED_DEPTH_METERS = 25 * 0.3048;

/** Total seabed-to-surface depth after moving the waterline farther overhead. */
export const OCEAN_WATER_DEPTH_METERS =
  OCEAN_BASE_WATER_DEPTH_METERS + OCEAN_ADDED_DEPTH_METERS;

export const OCEAN_STAGE_TO_SURFACE_METERS =
  OCEAN_WATER_DEPTH_METERS - OCEAN_STAGE_DECK_OFFSET_METERS;
