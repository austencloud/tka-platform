import type { StepData } from "$lib/features/create/shared/domain/models/StepData";
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
import type { StartPositionData } from "$lib/features/create/shared/domain/models/StartPositionData";
import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";

export interface IPictographFilter {
  filterByContinuity(
    options: PictographData[],
    lastStep: StepData | StartPositionData | null
  ): PictographData[];
  filterByRotation(
    options: PictographData[],
    blueRotationDirection: string,
    redRotationDirection: string
  ): PictographData[];
  filterStartPositions(options: PictographData[]): PictographData[];
  filterStaticType6(options: PictographData[], level: number): PictographData[];
  /** Filter pictographs by required end position (for freeform end position constraint) */
  filterByEndPosition(
    options: PictographData[],
    requiredEndPosition: string
  ): PictographData[];
  /** Filter pictographs by prop type */
  filterByPropType(
    options: PictographData[],
    propType: PropType
  ): PictographData[];
  selectRandom<T>(array: T[]): T;
}
