/** Header height = 1/3 of cell size (from app's ImageComposer) */
export function calculateHeaderHeight(stepSize: number): number {
  return Math.floor(stepSize / 3);
}

/** Footer height = 1/7 of cell size (from app's ImageComposer) */
export function calculateFooterHeight(stepSize: number): number {
  return Math.floor(stepSize / 7);
}
