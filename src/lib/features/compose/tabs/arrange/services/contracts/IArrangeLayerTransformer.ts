/**
 * IArrangeLayerTransformer - Contract for sequence transform operations
 *
 * Applies geometric transforms (rotate, mirror, flip, etc.) to a sequence
 * within an arrange grid layer. Each transform is async because the
 * underlying sequence transformer may need to recompute orientations.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { TransformType } from "../../../../compose/domain/types";

export interface TransformResult {
  success: boolean;
  transformed?: SequenceData;
  error?: string;
}

export interface IArrangeLayerTransformer {
  /**
   * Apply a transform to a sequence and return the result.
   * Does NOT mutate state - the caller is responsible for applying the result.
   */
  applyTransform(
    sequence: SequenceData,
    transformType: TransformType
  ): Promise<TransformResult>;
}
