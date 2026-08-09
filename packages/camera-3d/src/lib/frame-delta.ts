const MAX_CAMERA_FRAME_DELTA_SECONDS = 0.1;

export function normalizeCameraFrameDelta(delta: number): number {
	if (!Number.isFinite(delta)) return 0;
	return Math.min(Math.abs(delta), MAX_CAMERA_FRAME_DELTA_SECONDS);
}
