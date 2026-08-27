import {
  PRESET_VALID_COUNTS,
  createFormationFromPreset,
  type FormationPreset,
} from "@austencloud/scene-3d";

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

/** A stage a host authors itself, in metres, centered on the scene origin. */
export interface StageExtent {
  width: number;
  depth: number;
}

export interface StageCenterOffset {
  x: number;
  z: number;
}

const BASE_STAGE_WIDTH = 6;
const BASE_STAGE_DEPTH = 6;
export const BASE_PERFORMER_STAGE_RADIUS =
  Math.min(BASE_STAGE_WIDTH, BASE_STAGE_DEPTH) / 2;
export const ADDED_PERFORMER_STAGE_GROWTH = 0.5;
export const DEFAULT_PERFORMER_STAGE_CLEARANCE = 1.5;

/**
 * Scale the floor clearance with the same avatar scale that drives the rig.
 * The default 1.5 m radius covers a performer's body and active prop space.
 */
export function getPerformerStageClearance(avatarScale: number): number {
  return DEFAULT_PERFORMER_STAGE_CLEARANCE * avatarScale;
}

/** The visible expansion earned by the cast above a scene's solo deck. */
export function getAddedPerformerStageGrowth(performerCount: number): number {
  const count = Math.max(0, Math.floor(performerCount));
  return Math.max(0, count - 1) * ADDED_PERFORMER_STAGE_GROWTH;
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
  let radius = BASE_PERFORMER_STAGE_RADIUS;

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
  centerOffset: StageCenterOffset = { x: 0, z: 0 },
  stageRadiusGrowth = 0
): number {
  return Math.max(
    minimumRadius + stageRadiusGrowth,
    performerRadius + Math.hypot(centerOffset.x, centerOffset.z)
  );
}

/**
 * The deck a host authored, used as given.
 *
 * A host that owns a stage — the Stage module draws one on its drill chart and
 * clamps every spot to it — already knows how big the floor is. Its cast walking
 * from one side to the other does not make the venue bigger. The circular deck
 * circumscribes the rectangle so a performer standing in a corner is still on it.
 */
export function getStageBoundsForExtent(
  extent: StageExtent
): PerformerStageBounds {
  return {
    width: extent.width,
    depth: extent.depth,
    radius: Math.hypot(extent.width / 2, extent.depth / 2),
    zOffset: 0,
  };
}

const canonicalPositionsByCount = new Map<
  number,
  readonly PerformerStagePosition[]
>();

/**
 * Every spot a cast of this size can be asked to stand on.
 *
 * Sizing a deck from where performers happen to be standing makes the floor
 * breathe under them: it grows as a formation opens out and shrinks as it
 * closes, so the venue appears to move while the cast walks. Sizing it from the
 * union of every formation this many performers can form gives one canonical
 * deck per count — it does not change while they walk, and it does not jump when
 * the formation changes, because every formation already fits.
 *
 * Read from the preset generators rather than transcribed into a table here, so
 * a preset that changes its spacing cannot silently outgrow the floor.
 *
 * Accumulated across every smaller cast too, because some presets are capped at
 * a count: stage-lr splits two performers to opposite wings and is invalid at
 * three, so counting only the presets valid at exactly three would hand a trio a
 * SMALLER stage than a duo. Adding a performer never shrinks the venue.
 */
export function getCanonicalStagePositions(
  performerCount: number
): readonly PerformerStagePosition[] {
  const count = Math.max(0, Math.floor(performerCount));
  const cached = canonicalPositionsByCount.get(count);
  if (cached) return cached;

  const positions: PerformerStagePosition[] = [];
  for (let cast = 1; cast <= count; cast += 1) {
    for (const [preset, validCounts] of Object.entries(PRESET_VALID_COUNTS)) {
      // "custom" is whatever the user dragged; it has no canonical footprint.
      if (preset === "custom" || !validCounts.includes(cast)) continue;
      for (const slot of createFormationFromPreset(
        preset as FormationPreset,
        cast
      ).slots) {
        positions.push({ x: slot.position.x, z: slot.position.z });
      }
    }
  }

  canonicalPositionsByCount.set(count, positions);
  return positions;
}

/**
 * One stable deck size for a cast count, large enough for every formation.
 *
 * Formation envelopes alone can plateau: a trio can fit inside the same raw
 * bounds as a duo, which makes Add performer look broken. Each added performer
 * therefore earns another half metre on every stage edge. The raw formation
 * envelope can still make a larger jump whenever a preset actually needs it.
 */
export function getCanonicalPerformerStageBounds(
  performerCount: number,
  options: PerformerStageBoundsOptions = {}
): PerformerStageBounds {
  const count = Math.max(0, Math.floor(performerCount));
  if (count <= 1) {
    return getPerformerStageBounds(getCanonicalStagePositions(count), options);
  }

  let bounds = getPerformerStageBounds(getCanonicalStagePositions(1), options);
  for (let cast = 2; cast <= count; cast += 1) {
    const formationBounds = getPerformerStageBounds(
      getCanonicalStagePositions(cast),
      options
    );
    bounds = {
      width: Math.max(
        formationBounds.width,
        bounds.width + ADDED_PERFORMER_STAGE_GROWTH * 2
      ),
      depth: Math.max(
        formationBounds.depth,
        bounds.depth + ADDED_PERFORMER_STAGE_GROWTH * 2
      ),
      radius: Math.max(
        formationBounds.radius,
        bounds.radius + ADDED_PERFORMER_STAGE_GROWTH
      ),
      zOffset: 0,
    };
  }

  return bounds;
}
