import {
  createSequenceData,
  type SequenceData,
} from "$lib/shared/foundation/domain/models/sequence-data";
import {
  createDerivedTunnelPerformer,
  createIndependentTunnelPerformer,
  createTunnelComposition,
  type TunnelComposition,
} from "$lib/shared/sequence-viewer/tunnel/tunnel-composition";
import { imageCount } from "$lib/shared/sequence-viewer/tunnel/tunnel-config";
import type { CollectedTunnel } from "./tunnel-collection-types";

/**
 * How to read a saved tunnel back into the things that can perform it.
 *
 * A tunnel saved before the Tunnel creator existed has no `composition` — the
 * concept did not exist yet. What it has is `steps`, the one sequence it was
 * built from, plus the formation that multiplied it. Every surface that reopens
 * a tunnel therefore has to reconstruct the cast, and each one that did it
 * privately got a different answer: the viewer rebuilt a one-performer cast and
 * showed the tunnel correctly, while the creator read `composition` straight
 * off the entry, found nothing, and opened an empty picker that still called
 * itself "Edit tunnel". One owner, so a legacy tunnel means the same thing
 * wherever it is opened.
 */

/** The sequence a saved tunnel was built from.
 *
 *  The steps were captured from a live, already-hydrated viewer sequence, so
 *  each carries motions.blue/red — the orchestrator's hydrateSequence
 *  short-circuits on hasMotionData() and uses them verbatim rather than
 *  re-deriving from compositional fields the collection does not store.
 *  gridMode is recovered off the steps so the right grid renders. */
export function collectedTunnelSequence(tunnel: CollectedTunnel): SequenceData {
  return createSequenceData({
    id: tunnel.id,
    name: tunnel.name,
    word: tunnel.name,
    steps: [...tunnel.steps],
    gridMode: tunnel.steps.find((step) => step.gridMode)?.gridMode,
  });
}

/**
 * The authored cast, or the cast a legacy tunnel implies.
 *
 * The reconstruction is a lead holding the saved sequence and a partner derived
 * from it with no transforms. That second performer is not invention: layer
 * plans assign arms `arm % performers.length`, and a partner that resolves to
 * the same sequence with the same ops paints exactly what one performer across
 * every arm painted — the pixels do not move. What it buys is a tunnel the
 * creator can actually edit, since its two slots and its linked/separate mode
 * are expressed in performers, and an identity copy reads back as the default
 * relationship. A formation with only one image has no room for the partner, so
 * that degenerate case stays a solo cast.
 */
export function collectedTunnelComposition(
  tunnel: CollectedTunnel
): TunnelComposition {
  if (tunnel.composition) return tunnel.composition;

  const sequence = collectedTunnelSequence(tunnel);
  const formation = tunnel.snapshot.tunnel.config;
  const lead = createIndependentTunnelPerformer(sequence, 0);
  const performers =
    imageCount(formation) > 1
      ? [lead, createDerivedTunnelPerformer(lead.id, 1, [])]
      : [lead];

  return createTunnelComposition(performers, {
    id: tunnel.id,
    name: tunnel.name,
    formation,
  });
}
