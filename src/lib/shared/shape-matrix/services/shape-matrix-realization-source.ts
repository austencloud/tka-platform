import {
  updateSequenceData,
  type SequenceData,
} from "$lib/shared/foundation/domain/models/sequence-data";
import type { ShapeMatrixTunnelSourceProvenance } from "$lib/shared/sequence-viewer/tunnel/tunnel-composition";
import { flowerKey, type Flower } from "../domain/flower-signature";
import type { VtgMode } from "./shape-matrix-realizations";

export interface ShapeMatrixRealizationSource {
  sequence: SequenceData;
  sourceSequenceId: string;
  provenance: ShapeMatrixTunnelSourceProvenance;
}

/**
 * Give a constructed realization its own stable identity while retaining the
 * catalog sequence and exact matrix choices that produced it. The realized
 * motions stay untouched; only the identity changes from the reusable base
 * word to this one cell-and-mode result.
 */
export function identifyShapeMatrixRealization(
  base: SequenceData,
  realized: SequenceData,
  pair: { blue: Flower; red: Flower },
  mode: VtgMode,
  propMode: VtgMode | null = null
): ShapeMatrixRealizationSource {
  const provenance: ShapeMatrixTunnelSourceProvenance = {
    kind: "shape-matrix-realization",
    version: 1,
    baseSequenceId: base.id,
    mode,
    ...(propMode ? { propMode } : {}),
    blueFlower: { ...pair.blue },
    redFlower: { ...pair.red },
  };
  const sequence = updateSequenceData(realized, {
    id: [
      "shape-matrix",
      encodeURIComponent(base.id),
      mode,
      ...(propMode ? [`props-${propMode}`] : []),
      flowerKey(pair.blue),
      flowerKey(pair.red),
    ].join(":"),
  });

  return {
    sequence,
    sourceSequenceId: base.id,
    provenance,
  };
}
