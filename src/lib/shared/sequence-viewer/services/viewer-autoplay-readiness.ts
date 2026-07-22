export interface ViewerAutoplayReadiness {
  cloudBackedScan: boolean;
  loadedCells: number;
  totalCells: number;
  elapsedMs: number;
}

/**
 * A QR scan must never start moving while its static card is still resolving.
 * Other viewer entry points retain the existing fast-start behavior because
 * their cells are allowed to render locally in parallel with playback.
 */
export function isViewerReadyToAutoplay({
  cloudBackedScan,
  loadedCells,
  totalCells,
  elapsedMs,
}: ViewerAutoplayReadiness): boolean {
  const hasCard = totalCells > 0;
  if (cloudBackedScan) {
    return hasCard && loadedCells >= totalCells;
  }

  const minimumVisibleCells = Math.min(4, totalCells);
  return (
    (hasCard && loadedCells >= minimumVisibleCells) ||
    elapsedMs >= 500
  );
}
