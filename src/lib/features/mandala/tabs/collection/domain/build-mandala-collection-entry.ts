import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
import { simplifyRepeatedWord } from "$lib/shared/foundation/utils/word-simplifier";
import type {
  MandalaPathShape,
  MandalaRenderOptions,
} from "$lib/shared/mandala/domain/mandala-types";
import type { CollectedMandala } from "./mandala-collection-types";

export interface SaveMandalaInput {
  steps: readonly StepData[];
  variant: MandalaRenderOptions["show"];
  bluePropType: string;
  redPropType: string;
  pathShape: MandalaPathShape;
  sequenceWord: string;
}

export function buildMandalaCollectionEntry(
  input: SaveMandalaInput,
  existingCount: number
): Omit<CollectedMandala, "id" | "createdAt"> {
  const sourceWord = simplifyRepeatedWord(input.sequenceWord);
  const name = sourceWord || `Mandala #${existingCount + 1}`;

  return {
    name,
    steps: [...input.steps],
    variant: input.variant,
    bluePropType: input.bluePropType,
    redPropType: input.redPropType,
    pathShape: input.pathShape,
    source: "sequence",
    ...(sourceWord ? { sourceWord } : {}),
  };
}
