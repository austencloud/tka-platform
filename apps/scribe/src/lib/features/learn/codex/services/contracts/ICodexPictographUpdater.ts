import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
import type { CodexTransformationOperation } from "../../domain/types/codex-types";

export interface ICodexPictographUpdater {
  rotateAllPictographs(pictographs: PictographData[]): PictographData[];
  mirrorAllPictographs(pictographs: PictographData[]): PictographData[];
  colorSwapAllPictographs(pictographs: PictographData[]): PictographData[];
  applyOperation(
    pictographs: PictographData[],
    operation: CodexTransformationOperation
  ): PictographData[];
}
