/**
 * Geometry for the scan-capture animation.
 *
 * When a card's QR is recognized, the scan sheet lifts the QR's actual pixels
 * out of the camera frame and flies them into the "N cards added" counter.
 * These helpers answer the two questions that make that feel real:
 *
 * 1. Which frame pixels belong to the chip — the QR plus a slice of its white
 *    quiet zone, clamped to the frame (padQrBox).
 * 2. Where those pixels sit ON SCREEN — the viewfinder video renders with
 *    object-fit: cover, so the frame is uniformly scaled to fill the host and
 *    the overflow is cropped equally on both sides (frameBoxToScreenRect).
 */

export interface FrameBox {
	x: number;
	y: number;
	width: number;
	height: number;
}

export interface ScreenRect {
	left: number;
	top: number;
	width: number;
	height: number;
}

/**
 * Expand a detected QR bounding box to include its quiet zone, clamped to the
 * frame. Returns null when the box is too small to make a legible chip (a
 * detection sliver at the frame edge isn't worth animating).
 */
export function padQrBox(
	box: FrameBox,
	frameWidth: number,
	frameHeight: number,
	padRatio = 0.14,
): FrameBox | null {
	if (frameWidth <= 0 || frameHeight <= 0) return null;
	const pad = Math.round(Math.max(box.width, box.height) * padRatio);
	const x = Math.max(0, Math.floor(box.x - pad));
	const y = Math.max(0, Math.floor(box.y - pad));
	const width = Math.min(frameWidth - x, Math.ceil(box.width + pad * 2));
	const height = Math.min(frameHeight - y, Math.ceil(box.height + pad * 2));
	if (width < 8 || height < 8) return null;
	return { x, y, width, height };
}

/**
 * Map a frame-pixel box to viewport coordinates for a host element that draws
 * the frame with object-fit: cover (uniform scale that FILLS the host; the
 * overflowing dimension is cropped symmetrically).
 */
export function frameBoxToScreenRect(
	box: FrameBox,
	frameWidth: number,
	frameHeight: number,
	host: ScreenRect,
): ScreenRect | null {
	if (frameWidth <= 0 || frameHeight <= 0 || host.width <= 0 || host.height <= 0) {
		return null;
	}
	const scale = Math.max(host.width / frameWidth, host.height / frameHeight);
	const originLeft = host.left + (host.width - frameWidth * scale) / 2;
	const originTop = host.top + (host.height - frameHeight * scale) / 2;
	return {
		left: originLeft + box.x * scale,
		top: originTop + box.y * scale,
		width: box.width * scale,
		height: box.height * scale,
	};
}
