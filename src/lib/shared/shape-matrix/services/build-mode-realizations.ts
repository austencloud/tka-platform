import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import { loadDiamondEdges } from "$lib/features/choreo-card/services/pictograph-letter-lookup";
import {
  TND_BY_FAMILY,
  type TnDElement,
} from "$lib/features/choreo-card/domain/tnd-element";
import { loadBaseIndex, resolveBase } from "./build-realization-sequence";
import { verifyAndCorrect } from "./verify-realization-parity";
import {
  MODE_ORDER,
  MODE_LABEL,
  type VtgMode,
} from "./shape-matrix-realizations";
import type { CellOverlay } from "./build-realization-cards";
import { type Flower } from "../domain/flower-signature";
import {
  identifyShapeMatrixRealization,
  type ShapeMatrixRealizationSource,
} from "./shape-matrix-realization-source";

/** VTG mode → TnD family id. DIAMOND-GRID ONLY: same-direction elements
 *  (water/earth/sun) are grid-mode invariant, but the opposite-direction trio
 *  permutes in box mode (air/fire ↔ moon). The shape matrix is diamond, so
 *  this static map is valid here — do not reuse it for a box-mode surface. */
export const FAMILY_BY_MODE: Record<VtgMode, string> = {
  SS: "split-same",
  TS: "tog-same",
  QS: "quarter-same",
  SO: "split-opp",
  TO: "tog-opp",
  QO: "quarter-opp",
};

export interface ModeRealization {
  mode: VtgMode;
  modeLabel: string;
  /** Base word, simplified at DISPLAY time (e.g. "AAAA" → shown as "A"). */
  word: string;
  element: TnDElement;
  /** Parity-corrected sequence — feeds the animation player directly. */
  seq: SequenceData;
  /** Stable realization identity plus the base/cell/mode lineage that built it. */
  source: ShapeMatrixRealizationSource;
}

/**
 * The public drill's builder: buildModeCards minus the PNG card bakes (that
 * ~14s cost and its lab bake import stay on the lab QA path). Parity
 * auto-correction still runs; the verdict is not surfaced (QA detail).
 */
export async function buildModeRealizations(
  pair: { blue: Flower; red: Flower },
  overlay: CellOverlay
): Promise<ModeRealization[]> {
  const [idx, edges] = await Promise.all([loadBaseIndex(), loadDiamondEdges()]);
  const out: ModeRealization[] = [];
  for (const mode of MODE_ORDER) {
    const base = resolveBase(idx, mode, pair.blue.style, pair.red.style);
    if (!base) continue;
    const element = TND_BY_FAMILY[FAMILY_BY_MODE[mode]];
    if (!element) continue;
    try {
      const parity = verifyAndCorrect(
        base,
        pair,
        overlay.blue,
        overlay.red,
        edges,
        overlay.clubTipDx
      );
      const source = identifyShapeMatrixRealization(
        base,
        parity.sequence,
        pair,
        mode
      );
      out.push({
        mode,
        modeLabel: MODE_LABEL[mode],
        word: (base.word ?? mode).toUpperCase(),
        element,
        seq: source.sequence,
        source,
      });
    } catch {
      // A mode whose realization cannot be built is dropped, never substituted.
    }
  }
  return out;
}
