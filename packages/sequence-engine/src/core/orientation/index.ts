/**
 * Core Orientation - Re-exports all orientation primitives
 */
export {
  calculateEndOrientation,
  calculateOrientations,
  getHandpathDirection,
  switchOrientation,
} from "./OrientationCalculator.js";
export type { Orientation, OrientationInput } from "./OrientationCalculator.js";

export type {
  IOrientationCalculator,
  IOrientationPropagator,
} from "./IOrientationPropagator.js";

export { OrientationCalculator, OrientationPropagator } from "./OrientationPropagator.js";
