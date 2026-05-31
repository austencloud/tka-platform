/**
 * EraRendererBase - Shared utilities for era-native pictograph renderers.
 *
 * Extracts the SVG wrapping, image loading, color tinting, coordinate scaling,
 * and element transforms that every era renderer needs. The 1995 (pixel) and
 * 2003 (XP-style vector) renderers both extend this.
 *
 * Key contracts:
 * - wrapSvgContent mirrors Canvas2DDirectRenderer exactly (arrow overflow expansion)
 * - drawElementWithTransform mirrors Canvas2DDirectRenderer exactly (transform order)
 * - drawTintedImage mirrors Canvas2DDirectRenderer.drawColoredImage (OffscreenCanvas tint)
 */

import type { PictographPreparer } from "$lib/shared/pictograph/shared/services/pictograph-preparer";
import type { PreparedRenderData } from "$lib/shared/pictograph/shared/domain/models/prepared-pictograph-data";
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";
import type { MotionData } from "$lib/shared/pictograph/shared/domain/models/motion-data";
import { createMotionData } from "$lib/shared/pictograph/shared/domain/models/motion-data";
import type { RetroPictographData, RetroHandData } from "../domain/pictograph-types";
import { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
import { getSvgImageCache, type DrawableImage } from "$lib/shared/render/services/svg-image-cache";
import type { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { Letter } from "$lib/shared/foundation/domain/models/letter";

// The canonical viewBox size used throughout the TKA rendering system
const VIEWBOX_SIZE = 950;

// How much to expand the viewBox when capturing overflowing arrow tips.
// SVG's overflow:visible is NOT respected when rasterizing to canvas, so we
// expand the coordinate space instead.
const OVERFLOW_EXPANSION = 0.15;

export abstract class EraRendererBase {
	protected preparer: PictographPreparer;

	constructor(preparer: PictographPreparer) {
		this.preparer = preparer;
	}

	// -------------------------------------------------------------------------
	// Data conversion
	// -------------------------------------------------------------------------

	/**
	 * Convert retro pictograph data to the modern PictographData format that
	 * PictographPreparer understands.
	 */
	protected convertToModernData(data: RetroPictographData): PictographData {
		const blueMotion = this.handToMotionData(data.blueHand, MotionColor.BLUE, data.gridMode);
		const redMotion = this.handToMotionData(data.redHand, MotionColor.RED, data.gridMode);

		return {
			id: `retro_${data.letter}_${Date.now()}`,
			letter: data.letter as unknown as Letter,
			motions: {
				[MotionColor.BLUE]: blueMotion,
				[MotionColor.RED]: redMotion,
			},
			gridMode: data.gridMode,
		};
	}

	/**
	 * Convert a single hand's retro data into a MotionData object.
	 */
	private handToMotionData(
		hand: RetroHandData,
		color: MotionColor,
		gridMode: GridMode
	): MotionData {
		return createMotionData({
			motionType: hand.motionType,
			rotationDirection: hand.rotationDirection,
			startLocation: hand.location,
			endLocation: hand.endLocation,
			turns: hand.turns,
			startOrientation: hand.orientation,
			// End orientation is not stored in RetroHandData - default to the same as start
			endOrientation: hand.orientation,
			isVisible: true,
			propType: PropType.STAFF,
			color,
			gridMode,
		});
	}

	// -------------------------------------------------------------------------
	// Preparation
	// -------------------------------------------------------------------------

	/**
	 * Run PictographPreparer on retro data to get fully-positioned render data.
	 * Always uses dark theme and staff props (era renderers handle their own colour).
	 * Returns null on any failure so callers can fall back to a placeholder.
	 */
	protected async prepare(data: RetroPictographData): Promise<PreparedRenderData | null> {
		try {
			const modern = this.convertToModernData(data);
			const prepared = await this.preparer.prepareSingle(modern, {
				themeMode: "dark",
				bluePropType: PropType.STAFF,
				redPropType: PropType.STAFF,
			});
			return prepared._prepared ?? null;
		} catch {
			return null;
		}
	}

	// -------------------------------------------------------------------------
	// SVG wrapping
	// -------------------------------------------------------------------------

	/**
	 * Wrap inner SVG path/group content in a complete <svg> element.
	 *
	 * Returns both the SVG string AND the expansion offsets so callers can
	 * adjust the element's draw position to compensate for the extra padding.
	 *
	 * This mirrors Canvas2DDirectRenderer.wrapSvgContent exactly - arrow
	 * positioning depends on this being bit-for-bit compatible.
	 *
	 * @param innerContent  Raw SVG paths/groups (NOT a full <svg> element)
	 * @param viewBoxWidth  Intrinsic width of the content's coordinate space
	 * @param viewBoxHeight Intrinsic height of the content's coordinate space
	 * @param expandViewBox When true, adds 15% padding in every direction so
	 *                      arrow tips that overflow their bounds are not clipped
	 * @param fullViewBox   Optional "minX minY width height" string (arrows often
	 *                      have a negative-origin viewBox from the preparer)
	 */
	protected wrapSvgContent(
		innerContent: string,
		viewBoxWidth: number,
		viewBoxHeight: number,
		expandViewBox: boolean = false,
		fullViewBox?: string
	): { svg: string; offsetX: number; offsetY: number; newWidth: number; newHeight: number } {
		// Parse viewBox origin if caller provides the full "minX minY w h" string
		// (e.g. "-296 -2937 2784 3091" for a positioned arrow)
		let minX = 0;
		let minY = 0;
		if (fullViewBox) {
			const parts = fullViewBox.split(/\s+/);
			minX = parseFloat(parts[0] ?? "0") || 0;
			minY = parseFloat(parts[1] ?? "0") || 0;
		}

		if (!expandViewBox) {
			return {
				svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${viewBoxWidth} ${viewBoxHeight}" width="${viewBoxWidth}" height="${viewBoxHeight}">${innerContent}</svg>`,
				offsetX: 0,
				offsetY: 0,
				newWidth: viewBoxWidth,
				newHeight: viewBoxHeight,
			};
		}

		// Expand viewBox by OVERFLOW_EXPANSION in all directions so arrow tips
		// that extend beyond the nominal bounds are captured rather than clipped
		const expandX = viewBoxWidth * OVERFLOW_EXPANSION;
		const expandY = viewBoxHeight * OVERFLOW_EXPANSION;
		const newWidth = viewBoxWidth + expandX * 2;
		const newHeight = viewBoxHeight + expandY * 2;

		const newMinX = minX - expandX;
		const newMinY = minY - expandY;

		return {
			svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${newMinX} ${newMinY} ${newWidth} ${newHeight}" width="${newWidth}" height="${newHeight}">${innerContent}</svg>`,
			offsetX: expandX,
			offsetY: expandY,
			newWidth,
			newHeight,
		};
	}

	// -------------------------------------------------------------------------
	// Element rendering
	// -------------------------------------------------------------------------

	/**
	 * Draw a prop or arrow image onto the canvas with the correct 2D transform.
	 *
	 * Transform order is identical to the SVG system (and Canvas2DDirectRenderer):
	 *   translate(x, y) → rotate(angle) → scale(-1,1) if mirror → scale(vb→canvas) → translate(-center)
	 *
	 * Getting this order wrong shifts every arrow, so do not reorder these steps.
	 */
	protected drawElementWithTransform(
		ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
		img: DrawableImage,
		params: {
			x: number;
			y: number;
			rotation: number;
			centerX: number;
			centerY: number;
			viewBoxWidth: number;
			viewBoxHeight: number;
			scale: number;
			shouldMirror: boolean;
		}
	): void {
		const { x, y, rotation, centerX, centerY, viewBoxWidth, viewBoxHeight, scale, shouldMirror } =
			params;

		ctx.save();

		// 1. Translate to the element's position on the canvas
		ctx.translate(x, y);

		// 2. Rotate around that position
		ctx.rotate((rotation * Math.PI) / 180);

		// 3. Mirror (only for red hand props)
		if (shouldMirror) {
			ctx.scale(-1, 1);
		}

		// 4. Scale from the SVG viewBox coordinate space to canvas pixels
		ctx.scale(scale, scale);

		// 5. Translate back by the element's centre so it is centred at (x, y)
		ctx.translate(-centerX, -centerY);

		// 6. Draw the image at its natural viewBox dimensions
		ctx.drawImage(img, 0, 0, viewBoxWidth, viewBoxHeight);

		ctx.restore();
	}

	// -------------------------------------------------------------------------
	// Image loading
	// -------------------------------------------------------------------------

	/**
	 * Convert an SVG string to a drawable image, using the shared cache so each
	 * unique SVG is only rasterised once per session.
	 */
	protected loadSvgImage(svgString: string, cacheKey: string): Promise<DrawableImage> {
		return getSvgImageCache().getImage(svgString, cacheKey);
	}

	// -------------------------------------------------------------------------
	// Color tinting
	// -------------------------------------------------------------------------

	/**
	 * Draw an image with a flat colour applied to every opaque pixel.
	 *
	 * Uses an OffscreenCanvas + "source-in" composite so the shape's alpha is
	 * preserved while the colour is replaced. This mirrors
	 * Canvas2DDirectRenderer.drawColoredImage (line 1012) exactly.
	 */
	protected drawTintedImage(
		ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
		img: DrawableImage,
		x: number,
		y: number,
		width: number,
		height: number,
		color: string
	): void {
		const offscreen = new OffscreenCanvas(Math.ceil(width), Math.ceil(height));
		const offCtx = offscreen.getContext("2d");

		if (!offCtx) {
			// Fallback: draw without tint if OffscreenCanvas is unavailable
			ctx.drawImage(img, x, y, width, height);
			return;
		}

		// Draw the image at natural size into the scratch canvas
		offCtx.drawImage(img, 0, 0, width, height);

		// Flood-fill with the target colour, but only where the image was opaque
		offCtx.globalCompositeOperation = "source-in";
		offCtx.fillStyle = color;
		offCtx.fillRect(0, 0, width, height);

		// Composite the tinted scratch canvas onto the main canvas
		ctx.drawImage(offscreen, x, y);
	}

	// -------------------------------------------------------------------------
	// Coordinate helpers
	// -------------------------------------------------------------------------

	/**
	 * Scale factor to map the 950-unit TKA viewBox to an era canvas of `eraSize` px.
	 */
	protected getScale(eraSize: number): number {
		return eraSize / VIEWBOX_SIZE;
	}

	// -------------------------------------------------------------------------
	// Placeholder
	// -------------------------------------------------------------------------

	/**
	 * Render a plain gray placeholder with a "?" so the caller has something
	 * to show before assets load or when preparation fails.
	 */
	renderPlaceholder(canvas: HTMLCanvasElement, size: number = 128): void {
		canvas.width = size;
		canvas.height = size;

		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		ctx.fillStyle = "#444444";
		ctx.fillRect(0, 0, size, size);

		ctx.fillStyle = "#888888";
		ctx.font = `bold ${Math.round(size * 0.4)}px monospace`;
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		ctx.fillText("?", size / 2, size / 2);
	}
}
