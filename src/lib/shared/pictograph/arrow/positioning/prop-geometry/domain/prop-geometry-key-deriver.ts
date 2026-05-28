/**
 * Derive a PropGeometryKey from pictograph + motion context.
 *
 * Extracted from ArrowAdjustmentCalculator.lookupPropGeometryAdjustment so the
 * inspect-panel editor and the rendering pipeline build identical keys.
 * Returns null when the scenario can't form a full key (missing motion or endPosition).
 */
import { deriveGridMode as _deriveGridMode } from "$lib/shared/pictograph/grid/services/grid-mode-deriver";
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
import type { MotionData } from "$lib/shared/pictograph/shared/domain/models/MotionData";
import type { PropGeometryKey } from "./PropGeometryAdjustment";

export function derivePropGeometryKey(
  pictographData: PictographData,
  motionData: MotionData,
  arrowColor?: string
): PropGeometryKey | null {
  const blueMotion = pictographData.motions.blue;
  const redMotion = pictographData.motions.red;
  if (!blueMotion || !redMotion) return null;

  const gridMode = motionData.gridMode || _deriveGridMode(blueMotion, redMotion);

  const endPosition = pictographData.endPosition;
  if (!endPosition) return null;
  const positionType = endPosition.replace(/\d+$/, "");

  const color = arrowColor || motionData.color || "blue";
  const isBlue = color === "blue";
  const thisMotion = isBlue ? blueMotion : redMotion;
  const otherMotion = isBlue ? redMotion : blueMotion;

  return {
    gridMode,
    propType: thisMotion.propType?.toLowerCase() || "staff",
    otherPropType: otherMotion.propType?.toLowerCase() || "staff",
    positionType,
    endOrientation: thisMotion.endOrientation?.toLowerCase() || "in",
    otherEndOrientation: otherMotion.endOrientation?.toLowerCase() || "in",
    motionType: motionData.motionType?.toLowerCase() || "static",
    turns: String(motionData.turns ?? 0),
    arrowColor: color,
  };
}
