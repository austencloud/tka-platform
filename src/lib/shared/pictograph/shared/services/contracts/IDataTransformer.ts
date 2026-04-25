/**
 * Data Transformation Service Interface
 */

import type { PictographData } from "../../domain/models/PictographData";
import type {
  GridPointData as RawGridData,
  GridData,
} from "../../../grid/domain/models/grid-models";
import type { GridMode } from "../../../grid/domain/enums/grid-enums";
import type { StepData } from "$lib/features/create/shared/domain/models/StepData";

export interface IDataTransformer {
  stepToPictographData(beat: StepData): PictographData;
  adaptGridData(rawGridData: RawGridData, mode: GridMode): GridData;
}
