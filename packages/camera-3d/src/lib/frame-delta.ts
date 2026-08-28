const MAX_CAMERA_FRAME_DELTA_SECONDS = 0.1;

export function normalizeCameraFrameDelta(
  delta: number,
  maximumSeconds = MAX_CAMERA_FRAME_DELTA_SECONDS
): number {
  if (!Number.isFinite(delta)) return 0;
  const finiteMaximum = Number.isFinite(maximumSeconds)
    ? Math.max(1 / 240, Math.min(maximumSeconds, 0.25))
    : MAX_CAMERA_FRAME_DELTA_SECONDS;
  return Math.min(Math.abs(delta), finiteMaximum);
}
