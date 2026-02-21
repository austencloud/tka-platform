/**
 * FireTipTracker
 *
 * Tracks prop fire-point positions across frames and computes velocity vectors
 * via finite differencing. Supports variable tip counts per prop type by
 * reading from PropFirePoints configuration.
 *
 * Zero-alloc hot path: reuses StoredTip and output arrays each frame.
 */

import type { PropState } from "../../domain/PropState";
import type { PropTipData } from "../../domain/types/FireTypes";
import { getFirePoints, type FirePoint } from "../../domain/types/PropFirePoints";
import type {
	IFireTipTracker,
	FireTipTrackerConfig,
} from "../contracts/IFireTipTracker";
import { PropPositionCalculator } from "./PropPositionCalculator";
import type { PropEndpointConfig } from "../contracts/IPropPositionCalculator";

/** Minimum dt to avoid velocity spikes on first frame or pauses */
const MIN_DT_SECONDS = 1 / 120;

/** Maximum velocity magnitude to clamp physics outliers */
const MAX_SPEED = 5000;

/** Maximum fire points across both props (performance cap for the shader) */
const MAX_TOTAL_TIPS = 16;

interface StoredTip {
	x: number;
	y: number;
	time: number;
	valid: boolean;
}

function createStoredTip(): StoredTip {
	return { x: 0, y: 0, time: 0, valid: false };
}

/** Viewbox size for coordinate calculations (matches PropPositionCalculator) */
const VIEWBOX_SIZE = 950;

export class FireTipTracker implements IFireTipTracker {
	private positionCalculator = new PropPositionCalculator();

	/**
	 * Previous frame positions. Fixed-size pool, indexed by a stable key
	 * derived from (propIndex, tipIndex). Max 16 tips total.
	 */
	private prevTips: StoredTip[] = [];

	/** Output array reused each frame */
	private outputTips: PropTipData[] = [];

	constructor() {
		// Pre-allocate stored tips pool
		for (let i = 0; i < MAX_TOTAL_TIPS; i++) {
			this.prevTips.push(createStoredTip());
		}
	}

	update(
		blueProp: PropState | null,
		redProp: PropState | null,
		config: FireTipTrackerConfig,
		currentTime: number
	): PropTipData[] {
		this.outputTips.length = 0;
		let totalTips = 0;

		if (blueProp) {
			totalTips = this.emitPropTips(
				blueProp,
				config.canvasSize,
				config.bluePropDimensions,
				config.bluePropType ?? null,
				0, // propIndex
				0, // prevTipOffset
				currentTime,
				totalTips
			);
		} else {
			// Invalidate blue prop stored tips
			this.invalidateRange(0, MAX_TOTAL_TIPS / 2);
		}

		if (redProp) {
			totalTips = this.emitPropTips(
				redProp,
				config.canvasSize,
				config.redPropDimensions,
				config.redPropType ?? null,
				1, // propIndex
				MAX_TOTAL_TIPS / 2, // prevTipOffset (red starts at slot 8)
				currentTime,
				totalTips
			);
		} else {
			// Invalidate red prop stored tips
			this.invalidateRange(MAX_TOTAL_TIPS / 2, MAX_TOTAL_TIPS);
		}

		return this.outputTips;
	}

	reset(): void {
		for (let i = 0; i < this.prevTips.length; i++) {
			this.prevTips[i]!.valid = false;
		}
		this.outputTips.length = 0;
	}

	/**
	 * Emit fire tips for a single prop based on its fire point configuration.
	 */
	private emitPropTips(
		prop: PropState,
		canvasSize: number,
		propDimensions: { width: number; height: number },
		propType: string | null,
		propIndex: 0 | 1,
		prevTipOffset: number,
		currentTime: number,
		outputStartIndex: number
	): number {
		const fireConfig = getFirePoints(propType);
		const firePoints = fireConfig.points;

		if (firePoints.length === 0) return outputStartIndex;

		// Compute prop center position (same as PropPositionCalculator)
		const endpointConfig: PropEndpointConfig = {
			canvasSize,
			propDimensions,
		};
		const center = this.positionCalculator.calculateCenter(prop, endpointConfig);
		const gridScaleFactor = canvasSize / VIEWBOX_SIZE;
		const angle = prop.staffRotationAngle;
		const cosA = Math.cos(angle);
		const sinA = Math.sin(angle);

		let outputIndex = outputStartIndex;

		for (let i = 0; i < firePoints.length && outputIndex < MAX_TOTAL_TIPS; i++) {
			const fp: FirePoint = firePoints[i]!;
			const prevSlot = prevTipOffset + i;

			// Transform fire point from prop-local to canvas space
			const worldX = center.x + (fp.dx * cosA - fp.dy * sinA) * gridScaleFactor;
			const worldY = center.y + (fp.dx * sinA + fp.dy * cosA) * gridScaleFactor;

			this.emitTip(
				this.prevTips[prevSlot]!,
				worldX,
				worldY,
				propIndex,
				i,
				fp.flameScale,
				currentTime,
				outputIndex
			);
			outputIndex++;
		}

		// Invalidate any remaining prev slots for this prop (if prop type changed to fewer tips)
		for (let i = firePoints.length; i < MAX_TOTAL_TIPS / 2; i++) {
			const prevSlot = prevTipOffset + i;
			if (prevSlot < this.prevTips.length) {
				this.prevTips[prevSlot]!.valid = false;
			}
		}

		return outputIndex;
	}

	private emitTip(
		prev: StoredTip,
		x: number,
		y: number,
		propIndex: 0 | 1,
		tipIndex: number,
		flameScale: number,
		currentTime: number,
		outputIndex: number
	): void {
		let velocityX = 0;
		let velocityY = 0;
		let speed = 0;

		if (prev.valid) {
			const dt = Math.max((currentTime - prev.time) / 1000, MIN_DT_SECONDS);
			velocityX = (x - prev.x) / dt;
			velocityY = (y - prev.y) / dt;
			speed = Math.sqrt(velocityX * velocityX + velocityY * velocityY);

			// Clamp to prevent physics outliers
			if (speed > MAX_SPEED) {
				const scale = MAX_SPEED / speed;
				velocityX *= scale;
				velocityY *= scale;
				speed = MAX_SPEED;
			}
		}

		// Update stored position
		prev.x = x;
		prev.y = y;
		prev.time = currentTime;
		prev.valid = true;

		// Reuse or create output tip
		const existing = this.outputTips[outputIndex];
		if (existing) {
			existing.x = x;
			existing.y = y;
			existing.velocityX = velocityX;
			existing.velocityY = velocityY;
			existing.speed = speed;
			existing.propIndex = propIndex;
			existing.tipIndex = tipIndex;
			existing.flameScale = flameScale;
		} else {
			this.outputTips.push({
				x,
				y,
				velocityX,
				velocityY,
				speed,
				propIndex,
				tipIndex,
				flameScale,
			});
		}
	}

	private invalidateRange(start: number, end: number): void {
		for (let i = start; i < end && i < this.prevTips.length; i++) {
			this.prevTips[i]!.valid = false;
		}
	}
}
