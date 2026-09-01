import type { PictographData } from "../../../../shared/domain/models/pictograph-data";
import type { MotionData } from "../../../../shared/domain/models/motion-data";
import { deriveGridMode as _deriveGridMode } from "../../../../grid/services/grid-mode-deriver";
import { GridMode } from "../../../../grid/domain/enums/grid-enums";
import {
  generateOrientationKey,
  resolveEffectiveOriKey,
} from "../../key-generation/services/special-placement-ori-key-generator";
import { generateTurnsTuple } from "../../key-generation/services/turns-tuple-key-generator";
import { getKeyFromArrow } from "../../key-generation/services/attribute-key-generator";
import { generateSpecialOverrideKey } from "../domain/special-arrow-placement";
import { createCanonicalPlacementContext } from "../../calculation/services/canonical-placement-frame";
import { placementFrameForGridMode } from "../../placement/domain/placement-frame";

/**
 * The single source of truth for a pictograph arrow's special-override key.
 * Used by render lookup, the migration (write + verify), and the editor dock —
 * so write-key === read-key by construction (parity-safe).
 */
export function computeSpecialOverrideKey(
  pictographData: PictographData,
  motionData: MotionData,
  arrowColor: string
): string {
  const canonicalContext = createCanonicalPlacementContext(
    pictographData,
    motionData
  );
  pictographData = canonicalContext.pictographData;
  motionData = canonicalContext.motionData;
  const displayGrid =
    motionData.gridMode ??
    (pictographData.motions.left && pictographData.motions.right
      ? _deriveGridMode(pictographData.motions.left, pictographData.motions.right)
      : GridMode.DIAMOND);
  const placementFrame = placementFrameForGridMode(displayGrid);
  const oriFolder = resolveEffectiveOriKey(
    generateOrientationKey(motionData, pictographData),
    pictographData
  );
  const turnsTuple = generateTurnsTuple(pictographData).join(",");
  const attributeKey = getKeyFromArrow(
    {
      id: "temp",
      arrowLocation: null,
      positionX: 0,
      positionY: 0,
      rotationAngle: 0,
      coordinates: { x: 0, y: 0 },
      svgCenter: { x: 0, y: 0 },
      svgMirrored: false,
      isVisible: true,
      isSelected: false,
    } as never,
    pictographData,
    arrowColor
  );
  return generateSpecialOverrideKey({
    placementFrame: String(placementFrame),
    oriFolder,
    letter: pictographData.letter || "",
    turnsTuple,
    motionType: motionData.motionType?.toLowerCase() || "",
    attributeKey,
    propType: motionData.propType?.toLowerCase() || "staff",
  });
}
