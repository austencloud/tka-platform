import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { RotationStyleMatrix } from "$lib/features/lab/vtg-lab/services/resolve-rotation-style-matrices";
import type { FlowerStyle } from "../domain/flower-signature";

/**
 * The zero-turn two-hand archetype seed a flower is built from: pro spin →
 * isolation, anti spin → antispin. `buildFlowerSequence` applies the flower's
 * turns + orientation to this seed, so both hands must be present here. Pulled
 * out of `shape-matrix-flowers.ts` so the shape matrix and the Fuse VTG picker
 * resolve archetypes the same way.
 */
export function resolveFlowerArchetype(
  matrices: RotationStyleMatrix[],
  style: FlowerStyle,
): SequenceData {
  const id = style === "pro" ? "iso" : "antispin";
  const matrix = matrices.find((m) => m.style === id);
  if (!matrix) throw new Error(`no ${id} archetype matrix`);
  const base = matrix.byTurn.get("0|0");
  if (!base) throw new Error(`no 0-turn rep for ${id}`);
  return base;
}
