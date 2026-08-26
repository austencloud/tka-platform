import { tunnelCollectionState } from "../state/tunnel-collection-state.svelte";
import { renderTunnelPoster } from "./tunnel-discovery-poster";
import type { CollectedTunnel } from "../domain/tunnel-collection-types";

/**
 * Replace a saved tunnel's thumbnail with the canonical poster.
 *
 * Saving grabs whatever frame the live stage is showing, because a save has to
 * feel instantaneous and the canonical still takes seconds to draw — it mounts
 * its own stage and holds it until the traced figure stops growing (see
 * `tunnel-discovery-poster.ts`). So the save keeps the fast frame and this runs
 * after it, off the critical path: the record lands immediately, and the
 * picture in the collection grid corrects itself a few seconds later.
 *
 * Deliberately quiet. A failed refresh leaves the fast frame in place, which is
 * exactly what the collection had before this existed; there is nothing for the
 * person who pressed Save to do about it, so there is nothing to tell them.
 */
export async function refreshTunnelPoster(
  tunnel: CollectedTunnel
): Promise<void> {
  try {
    const poster = await renderTunnelPoster(tunnel);
    // An empty render means the offscreen stage never drew — keep what we have.
    // An identical one means the fast frame was already canonical; writing it
    // back would mint a revision that changes nothing.
    if (!poster || poster === tunnel.poster) return;
    await tunnelCollectionState.update(tunnel.id, { poster });
  } catch {
    // Left as-is on purpose: see above.
  }
}
