export interface PerformerStagePosition {
  x: number;
  z: number;
}

export interface PerformerStageBounds {
  width: number;
  depth: number;
  zOffset: number;
}

const BASE_STAGE_WIDTH = 6;
const BASE_STAGE_DEPTH = 6;
const PERFORMER_BODY_PADDING = 1.5;

/**
 * Keep the environment's stage under the complete performer formation.
 * Multi-performer layouts grow away from the camera, so the environment
 * shifts by half of the added depth while the performers stay centered.
 */
export function getPerformerStageBounds(
  performers: readonly PerformerStagePosition[]
): PerformerStageBounds {
  if (performers.length <= 1) {
    return { width: BASE_STAGE_WIDTH, depth: BASE_STAGE_DEPTH, zOffset: 0 };
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const performer of performers) {
    minX = Math.min(minX, performer.x);
    maxX = Math.max(maxX, performer.x);
    minZ = Math.min(minZ, performer.z);
    maxZ = Math.max(maxZ, performer.z);
  }

  const width = Math.max(
    BASE_STAGE_WIDTH,
    maxX - minX + PERFORMER_BODY_PADDING * 2
  );
  const depth = Math.max(
    BASE_STAGE_DEPTH,
    maxZ - minZ + PERFORMER_BODY_PADDING * 2
  );

  return {
    width,
    depth,
    zOffset: -(depth - BASE_STAGE_DEPTH) / 2,
  };
}
