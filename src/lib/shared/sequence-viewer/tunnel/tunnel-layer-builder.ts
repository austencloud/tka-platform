import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import {
  rotateSequence,
  mirrorSequence,
  flipSequence,
  invertSequence,
  colorSwapSequence,
  rewindSequence,
} from "$lib/shared/create/services/sequence-transforms";
import { motionQueryHandler } from "$lib/shared/pictograph/shared/services/motion-query-handler";
import type { CopyOp, TunnelLook } from "./tunnel-looks";

/** Apply one transform op to a sequence, dispatching to the canonical
 *  `sequence-transforms` function. No new transform math lives here. */
async function applyOp(seq: SequenceData, op: CopyOp): Promise<SequenceData> {
  switch (op.kind) {
    case "rotate":
      return rotateSequence(seq, op.amount, motionQueryHandler);
    case "mirror":
      return mirrorSequence(seq, motionQueryHandler);
    case "flip":
      return flipSequence(seq, motionQueryHandler);
    case "invert":
      return invertSequence(seq, motionQueryHandler);
    case "colorSwap":
      return colorSwapSequence(seq);
    case "rewind":
      return rewindSequence(seq, motionQueryHandler);
  }
}

/** Fold an ordered op chain onto the base to produce one overlaid copy. Ops
 *  compose left-to-right (order matters: rotate-then-mirror ≠ mirror-then-rotate). */
async function applyOps(base: SequenceData, ops: CopyOp[]): Promise<SequenceData> {
  let out = base;
  for (const op of ops) out = await applyOp(out, op);
  return out;
}

/**
 * Build the overlaid copies (everything beyond the always-drawn base) for a
 * look. Returns one SequenceData per `look.copies` entry, in overlay order. The
 * base is NOT included — the caller draws it as blueProp/redProp.
 */
export async function buildTunnelLayers(
  base: SequenceData,
  look: TunnelLook,
): Promise<SequenceData[]> {
  return Promise.all(look.copies.map((ops) => applyOps(base, ops)));
}
