import type { PictographData } from "../../../../shared/domain/models/PictographData";
import type { MotionData } from "../../../../shared/domain/models/MotionData";
import { deriveGridMode as _deriveGridMode } from "../../../../grid/services/grid-mode-deriver";
import { GridMode } from "../../../../grid/domain/enums/grid-enums";
import {
  generateOrientationKey,
  resolveEffectiveOriKey,
} from "../../key-generation/services/special-placement-ori-key-generator";
import { generateTurnsTuple } from "../../key-generation/services/turns-tuple-key-generator";
import { getKeyFromArrow } from "../../key-generation/services/attribute-key-generator";
import { generateSpecialOverrideKey } from "../domain/SpecialArrowPlacement";

/**
 * The single source of truth for a pictograph arrow's special-override key.
 * Used by render lookup, the migration (write + verify), and the editor dock —
 * so write-key === read-key by construction (parity-safe).
 */
export function computeSpecialOverrideKey(
  pictographData: PictographData,
  motionData: MotionData,
  arrowColor: string,
): string {
  const gridMode =
    motionData.gridMode ||
    (pictographData.motions.blue && pictographData.motions.red
      ? _deriveGridMode(pictographData.motions.blue, pictographData.motions.red)
      : GridMode.DIAMOND);
  const oriFolder = resolveEffectiveOriKey(
    generateOrientationKey(motionData, pictographData),
    pictographData,
  );
  const turnsTuple = generateTurnsTuple(pictographData).join(",");
  const attributeKey = getKeyFromArrow(
    {
      id: "temp", arrowLocation: null, positionX: 0, positionY: 0, rotationAngle: 0,
      coordinates: { x: 0, y: 0 }, svgCenter: { x: 0, y: 0 }, svgMirrored: false,
      isVisible: true, isSelected: false,
    } as never,
    pictographData,
    arrowColor,
  );
  return generateSpecialOverrideKey({
    gridMode: String(gridMode),
    oriFolder,
    letter: pictographData.letter || "",
    turnsTuple,
    motionType: motionData.motionType?.toLowerCase() || "",
    attributeKey,
    propType: motionData.propType?.toLowerCase() || "staff",
  });
}
