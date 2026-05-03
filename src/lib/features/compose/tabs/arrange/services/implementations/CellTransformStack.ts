/**
 * CellTransformStack - Non-destructive transform replay
 *
 * Receives ArrangeLayerTransformer via constructor injection.
 * Replays an ordered stack of transforms against the original sequence
 * to produce the effective (displayed) result. The original is never mutated.
 *
 * Failed transforms are silently skipped so the user always sees
 * the best available result rather than losing all transforms.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { AppliedTransform } from "$lib/features/compose/compose/domain/types";
import type { ArrangeLayerTransformer } from "../implementations/ArrangeLayerTransformer";

export class CellTransformStack {
  constructor(private readonly transformer: ArrangeLayerTransformer) {}

  async computeEffective(
    original: SequenceData,
    stack: AppliedTransform[]
  ): Promise<SequenceData> {
    if (stack.length === 0) return original;

    let current = original;
    for (const transform of stack) {
      const result = await this.transformer.applyTransform(
        current,
        transform.type
      );
      if (result.success && result.transformed) {
        current = result.transformed;
      }
    }
    return current;
  }

  push(
    stack: AppliedTransform[],
    type: AppliedTransform["type"],
    hand: AppliedTransform["hand"]
  ): AppliedTransform[] {
    return [...stack, { type, hand, timestamp: Date.now() }];
  }

  pop(stack: AppliedTransform[]): AppliedTransform[] {
    return stack.slice(0, -1);
  }

  clear(): AppliedTransform[] {
    return [];
  }
}
