export interface PerformerStagePosition {
  x: number;
  z: number;
}

export interface PerformerStageBoundsOptions {
  performerClearance?: number;
}

export interface PerformerStageBounds {
  width: number;
  depth: number;
  radius: number;
  zOffset: number;
}

export interface StageCenterOffset {
  x: number;
  z: number;
}

const BASE_STAGE_WIDTH = 6;
const BASE_STAGE_DEPTH = 6;
export const DEFAULT_PERFORMER_STAGE_CLEARANCE = 1.5;

/**
 * Scale the floor clearance with the same avatar scale that drives the rig.
 * The default 1.5 m radius covers a performer's body and active prop space.
 */
export function getPerformerStageClearance(avatarScale: number): number {
  return DEFAULT_PERFORMER_STAGE_CLEARANCE * avatarScale;
}

/**
 * Keep every performer inside a stage centered on the scene origin.
 *
 * Formations can be edited off-center and they move continuously while a
 * transition is playing. Measuring each point from the origin makes the deck
 * follow both cases without sliding the environment out from under the cast.
 */
export function getPerformerStageBounds(
  performers: readonly PerformerStagePosition[],
  options: PerformerStageBoundsOptions = {}
): PerformerStageBounds {
  const performerClearance =
    options.performerClearance ?? DEFAULT_PERFORMER_STAGE_CLEARANCE;
  let halfWidth = BASE_STAGE_WIDTH / 2;
  let halfDepth = BASE_STAGE_DEPTH / 2;
  let radius = Math.min(BASE_STAGE_WIDTH, BASE_STAGE_DEPTH) / 2;

  for (const performer of performers) {
    halfWidth = Math.max(halfWidth, Math.abs(performer.x) + performerClearance);
    halfDepth = Math.max(halfDepth, Math.abs(performer.z) + performerClearance);
    radius = Math.max(
      radius,
      Math.hypot(performer.x, performer.z) + performerClearance
    );
  }

  return {
    width: halfWidth * 2,
    depth: halfDepth * 2,
    radius,
    zOffset: 0,
  };
}

/**
 * Fit a circular stage to the performer radius. An authored stage whose center
 * is offset from the scene origin gets the center distance as extra clearance,
 * which guarantees containment for every direction of formation growth.
 */
export function resolveCircularStageRadius(
  performerRadius: number,
  minimumRadius: number,
  centerOffset: StageCenterOffset = { x: 0, z: 0 }
): number {
  return Math.max(
    minimumRadius,
    performerRadius + Math.hypot(centerOffset.x, centerOffset.z)
  );
}
