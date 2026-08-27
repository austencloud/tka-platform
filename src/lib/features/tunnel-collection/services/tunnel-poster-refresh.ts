import { tunnelCollectionState } from "../state/tunnel-collection-state.svelte";
import { renderTunnelPoster } from "./tunnel-discovery-poster";
import type { CollectedTunnel } from "../domain/tunnel-collection-types";
import { needsTunnelPosterRefresh } from "../domain/tunnel-artifact-migration";

export type TunnelPosterRefreshResult =
  | "refreshed"
  | "already-current"
  | "unavailable"
  | "failed";

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
 * The write uses the collection's presentation path, never its normal update
 * path. A poster is regenerated material, so it must not mint or replace an
 * immutable choreography revision.
 */
export async function refreshTunnelPoster(
  tunnel: CollectedTunnel
): Promise<TunnelPosterRefreshResult> {
  if (!needsTunnelPosterRefresh(tunnel)) return "already-current";
  try {
    const poster = await renderTunnelPoster(tunnel);
    // An empty render means the offscreen stage never drew — keep what we have.
    if (!poster) return "unavailable";
    const saved = await tunnelCollectionState.updatePresentation(tunnel.id, {
      poster,
      posterRenderVersion: 1,
    });
    return saved ? "refreshed" : "failed";
  } catch {
    return "failed";
  }
}
