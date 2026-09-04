/**
 * Record trail points accepted while Tunnel copies are travelling to their
 * formation. Production playback pays only the flag check; the transition
 * review turns the counter on when it needs proof that composition stayed out
 * of performed-motion history.
 */
export function recordTunnelFormationTrailCaptures(count: number): void {
  if (count <= 0 || typeof document === "undefined") return;
  const capture = document.documentElement;
  if (capture.dataset.captureTunnelPaint !== "true") return;
  const previous = Number(capture.dataset.tunnelFormationTrailCaptures) || 0;
  capture.dataset.tunnelFormationTrailCaptures = String(previous + count);
}
