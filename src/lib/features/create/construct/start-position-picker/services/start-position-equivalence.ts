import { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import type { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";

interface HandBoundary {
  location: string;
  orientation: string;
  visible: boolean;
}

function getGridMode(position: PictographData): GridMode | null {
  return (
    position.gridMode ??
    position.motions[MotionColor.BLUE]?.gridMode ??
    position.motions[MotionColor.RED]?.gridMode ??
    null
  );
}

function getHandBoundary(
  position: PictographData,
  color: MotionColor
): HandBoundary | null {
  const motion = position.motions[color];
  if (!motion) return null;

  return {
    location: motion.endLocation,
    orientation: motion.endOrientation,
    visible: motion.isVisible,
  };
}

function hasSameHandBoundary(
  first: PictographData,
  second: PictographData,
  color: MotionColor
): boolean {
  const firstBoundary = getHandBoundary(first, color);
  const secondBoundary = getHandBoundary(second, color);

  return (
    firstBoundary?.location === secondBoundary?.location &&
    firstBoundary?.orientation === secondBoundary?.orientation &&
    firstBoundary?.visible === secondBoundary?.visible
  );
}

/**
 * Compares the held pose, not render metadata or object identity. Canonical
 * positions carry a numbered startPosition; custom positions fall back to the
 * two hand boundaries that define the pose.
 */
export function areStartPositionsEquivalent(
  first: PictographData | null,
  second: PictographData | null
): boolean {
  if (first === second) return true;
  if (!first || !second) return false;
  if (getGridMode(first) !== getGridMode(second)) return false;

  if (first.startPosition || second.startPosition) {
    return (
      first.startPosition === second.startPosition &&
      first.letter === second.letter
    );
  }

  return (
    hasSameHandBoundary(first, second, MotionColor.BLUE) &&
    hasSameHandBoundary(first, second, MotionColor.RED)
  );
}
