import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import { rotateSequence, mirrorSequence } from "$lib/shared/create/services/sequence-transforms";
import { motionQueryHandler } from "$lib/shared/pictograph/shared/services/motion-query-handler";
import { rotAmountsFor, type TunnelConfig } from "./tunnel-fold-math";

/**
 * Build the overlaid layer sequences (everything beyond the base) for a tunnel
 * config: one rotated copy per amount, plus a mirrored copy of the whole
 * rotational stack (base + rotated) when mirror is on. Returns layers in the
 * order the canvas should overlay them.
 */
export async function buildTunnelLayers(
  base: SequenceData,
  config: TunnelConfig,
): Promise<SequenceData[]> {
  const amounts = rotAmountsFor(config.fold);
  const rotExtras = await Promise.all(
    amounts.map((amt) => rotateSequence(base, amt, motionQueryHandler)),
  );
  const layers: SequenceData[] = [...rotExtras];

  if (config.mirror) {
    const mirroredBase = await mirrorSequence(base, motionQueryHandler);
    const mirroredExtras = await Promise.all(
      rotExtras.map((r) => mirrorSequence(r, motionQueryHandler)),
    );
    layers.push(mirroredBase, ...mirroredExtras);
  }

  return layers;
}
