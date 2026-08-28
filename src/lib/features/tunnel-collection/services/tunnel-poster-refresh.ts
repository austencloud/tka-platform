import { tunnelCollectionState } from "../state/tunnel-collection-state.svelte";
import { renderTunnelPoster } from "./tunnel-discovery-poster";
import type { CollectedTunnel } from "../domain/tunnel-collection-types";
import { needsTunnelPosterRefresh } from "../domain/tunnel-artifact-migration";

export type TunnelPosterRefreshResult =
  | "refreshed"
  | "already-current"
  | "unavailable"
  | "failed";

let refreshQueue: Promise<void> = Promise.resolve();
const inFlight = new Map<string, Promise<TunnelPosterRefreshResult>>();

function posterSubjectKey(tunnel: CollectedTunnel): string {
  return [
    tunnel.id,
    tunnel.currentRevisionId ?? "legacy",
    tunnel.currentContentDigest ?? "unknown",
    tunnel.currentRevisionCreatedAt ?? tunnel.createdAt,
  ].join(":");
}

async function refreshTunnelPosterNow(
  tunnel: CollectedTunnel
): Promise<TunnelPosterRefreshResult> {
  try {
    const poster = await renderTunnelPoster(tunnel);
    // An empty render means the offscreen stage never drew — keep what we have.
    if (!poster) return "unavailable";

    // The poster is presentation for one exact revision. If the user edited
    // and saved while the offscreen renderer was drawing, do not attach the old
    // picture to the new choreography; the next queued pass will render the new
    // revision instead.
    const current = tunnelCollectionState.collection.find(
      (candidate) => candidate.id === tunnel.id
    );
    if (!current || posterSubjectKey(current) !== posterSubjectKey(tunnel)) {
      return "unavailable";
    }

    const saved = await tunnelCollectionState.updatePresentation(tunnel.id, {
      poster,
      posterRenderVersion: 1,
    });
    return saved ? "refreshed" : "failed";
  } catch {
    return "failed";
  }
}

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
  const key = posterSubjectKey(tunnel);
  const existing = inFlight.get(key);
  if (existing) return existing;

  // TunnelDetailPreview temporarily applies renderer globals. One canonical
  // queue makes background backfills, save-time refreshes, and explicit retries
  // cooperate instead of mounting several competing stages at once.
  const queued = refreshQueue.then(
    () => refreshTunnelPosterNow(tunnel),
    () => refreshTunnelPosterNow(tunnel)
  );
  refreshQueue = queued.then(
    () => undefined,
    () => undefined
  );
  inFlight.set(key, queued);
  void queued.finally(() => inFlight.delete(key));
  return queued;
}
