/**
 * Grid Rotation State
 *
 * Ephemeral UI state to track the last grid rotation direction.
 * This allows GridSvg components to animate in the correct direction
 * when sequence rotations are applied.
 */

// Global rotation direction state (1 = clockwise, -1 = counterclockwise)
let globalRotationDirection = $state<1 | -1>(1);
let rotationEpoch = $state(0);

export function getGridRotationDirection(): 1 | -1 {
  return globalRotationDirection;
}

export function getRotationEpoch(): number {
  return rotationEpoch;
}

export function setGridRotationDirection(direction: 1 | -1) {
  globalRotationDirection = direction;
  rotationEpoch++;
}
