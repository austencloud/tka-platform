/**
 * FireTipTracker
 *
 * Tracks prop fire-point positions across frames and computes velocity vectors
 * via finite differencing. Supports variable tip counts per prop type by
 * reading from PropTipPoints configuration.
 *
 * Zero-alloc hot path: reuses StoredTip and output arrays each frame.
 */

import type { PropState } from "$lib/shared/foundation/domain/types/PropState";
import type { PropTipData, RenderedPropTransform } from "../domain/types/FireTypes";
import { getTipPoints, type TipPoint } from "../domain/types/PropTipPoints";
import {
  calculatePropCenter,
  type PropEndpointConfig,
} from "./prop-position-calculator";

export interface FireTipTrackerConfig {
  canvasSize: number;
  bluePropDimensions: { width: number; height: number };
  redPropDimensions: { width: number; height: number };
  bluePropType?: string;
  redPropType?: string;
  /** Transforms from the Canvas2D renderer. When provided, used instead of recomputing positions. */
  renderedTransforms?: {
    blue: RenderedPropTransform | null;
    red: RenderedPropTransform | null;
  };
}

export interface FireTipUpdateResult {
  tips: PropTipData[];
  /** True when a time gap was detected (HMR, tab switch, frame drop). Caller should clear the fire simulation. */
  gapDetected: boolean;
}

/** Minimum dt to avoid velocity spikes on first frame or pauses */
const MIN_DT_SECONDS = 1 / 120;

/** Maximum velocity magnitude to clamp physics outliers */
const MAX_SPEED = 5000;

/** Maximum fire points across both props (performance cap for the shader) */
const MAX_TOTAL_TIPS = 16;

/**
 * If the time between consecutive update() calls exceeds this threshold,
 * we treat it as a disruption (HMR, tab switch, frame drop burst) and
 * invalidate all stored positions. This prevents velocity spikes that
 * push flames away from prop tips.
 */
const GAP_THRESHOLD_MS = 200;

interface StoredTip {
	x: number;
	y: number;
	velocityX: number;
	velocityY: number;
	time: number;
	valid: boolean;
}

function createStoredTip(): StoredTip {
	return { x: 0, y: 0, velocityX: 0, velocityY: 0, time: 0, valid: false };
}

/** Viewbox size for coordinate calculations (matches PropPositionCalculator) */
const VIEWBOX_SIZE = 950;

export class FireTipTracker {

	/**
	 * Previous frame positions. Fixed-size pool, indexed by a stable key
	 * derived from (propIndex, tipIndex). Max 16 tips total.
	 */
	private prevTips: StoredTip[] = [];

	/** Output array reused each frame */
	private outputTips: PropTipData[] = [];

	/** Timestamp of the last update() call. Used for gap detection. */
	private lastUpdateTime = 0;

	/** Reusable result object to avoid allocation per frame */
	private result: FireTipUpdateResult = { tips: this.outputTips, gapDetected: false };

	/** Skip the first few frames after reset to let canvas size and prop
	 *  positions settle. Mirrors TrailOverlayCanvas warmup logic. */
	private warmupFramesRemaining = 3;
	private static readonly WARMUP_FRAMES = 3;

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
	): FireTipUpdateResult {
		// Let canvas size and prop positions settle before tracking.
		// Without this, the first frame can compute tip positions at a
		// stale canvas size, producing a velocity spike to the correct
		// position that pushes flames/charcoal away from the prop.
		if (this.warmupFramesRemaining > 0) {
			this.warmupFramesRemaining--;
			this.lastUpdateTime = currentTime;
			this.result.tips = this.outputTips;
			this.result.gapDetected = false;
			return this.result;
		}

		// Detect time gaps (HMR, tab switch, long frame drops).
		// When a gap is detected, invalidate all stored tips so the first
		// post-gap frame starts with zero velocity instead of a spike.
		let gapDetected = false;
		if (this.lastUpdateTime > 0) {
			const elapsed = currentTime - this.lastUpdateTime;
			if (elapsed > GAP_THRESHOLD_MS) {
				gapDetected = true;
				this.reset();
			}
		}
		this.lastUpdateTime = currentTime;

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
				totalTips,
				config.renderedTransforms?.blue
			);
		} else {
			// Invalidate blue prop stored tips
			this.invalidateRange(0, MAX_TOTAL_TIPS / 2);
		}

		if (redProp) {
			totalTips = this.emitPropTips( // eslint-disable-line @typescript-eslint/no-unused-vars
				redProp,
				config.canvasSize,
				config.redPropDimensions,
				config.redPropType ?? null,
				1, // propIndex
				MAX_TOTAL_TIPS / 2, // prevTipOffset (red starts at slot 8)
				currentTime,
				totalTips,
				config.renderedTransforms?.red
			);
		} else {
			// Invalidate red prop stored tips
			this.invalidateRange(MAX_TOTAL_TIPS / 2, MAX_TOTAL_TIPS);
		}

		this.result.tips = this.outputTips;
		this.result.gapDetected = gapDetected;
		return this.result;
	}

	reset(): void {
		for (let i = 0; i < this.prevTips.length; i++) {
			this.prevTips[i]!.valid = false;
		}
		this.outputTips.length = 0;
		this.lastUpdateTime = 0;
		this.warmupFramesRemaining = FireTipTracker.WARMUP_FRAMES;
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
		outputStartIndex: number,
		renderedTransform?: RenderedPropTransform | null
	): number {
		const tipConfig = getTipPoints(propType);
		const tipPoints = tipConfig.points;

		if (tipPoints.length === 0) return outputStartIndex;

		let centerX: number;
		let centerY: number;
		let angle: number;
		let gridScaleFactor: number;

		if (renderedTransform) {
			// Use the exact position the Canvas2D renderer drew the prop at
			centerX = renderedTransform.centerX;
			centerY = renderedTransform.centerY;
			angle = renderedTransform.angle;
			gridScaleFactor = renderedTransform.scaleFactor;
		} else {
			// Fallback: compute independently (legacy path)
			const endpointConfig: PropEndpointConfig = {
				canvasSize,
				propDimensions,
			};
			const center = calculatePropCenter(prop, endpointConfig);
			centerX = center.x;
			centerY = center.y;
			gridScaleFactor = canvasSize / VIEWBOX_SIZE;
			angle = prop.staffRotationAngle;
		}

		const cosA = Math.cos(angle);
		const sinA = Math.sin(angle);

		let outputIndex = outputStartIndex;

		for (let i = 0; i < tipPoints.length && outputIndex < MAX_TOTAL_TIPS; i++) {
			const tp: TipPoint = tipPoints[i]!;
			const prevSlot = prevTipOffset + i;

			// Transform tip point from prop-local to canvas space
			const worldX = centerX + (tp.dx * cosA - tp.dy * sinA) * gridScaleFactor;
			const worldY = centerY + (tp.dx * sinA + tp.dy * cosA) * gridScaleFactor;

			this.emitTip(
				this.prevTips[prevSlot]!,
				worldX,
				worldY,
				propIndex,
				i,
				1.0,
				currentTime,
				outputIndex
			);
			outputIndex++;
		}

		// Invalidate any remaining prev slots for this prop (if prop type changed to fewer tips)
		for (let i = tipPoints.length; i < MAX_TOTAL_TIPS / 2; i++) {
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
		let jerk = 0;

		// Capture previous position before overwriting (for sub-frame interpolation)
		const prevX = prev.valid ? prev.x : x;
		const prevY = prev.valid ? prev.y : y;

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

			// Compute jerk (acceleration magnitude) from velocity delta
			const dvx = velocityX - prev.velocityX;
			const dvy = velocityY - prev.velocityY;
			jerk = Math.sqrt(dvx * dvx + dvy * dvy) / dt;
		}

		// Update stored position and velocity
		prev.x = x;
		prev.y = y;
		prev.velocityX = velocityX;
		prev.velocityY = velocityY;
		prev.time = currentTime;
		prev.valid = true;

		// Reuse or create output tip
		const existing = this.outputTips[outputIndex];
		if (existing) {
			existing.x = x;
			existing.y = y;
			existing.prevX = prevX;
			existing.prevY = prevY;
			existing.velocityX = velocityX;
			existing.velocityY = velocityY;
			existing.speed = speed;
			existing.propIndex = propIndex;
			existing.tipIndex = tipIndex;
			existing.flameScale = flameScale;
			existing.jerk = jerk;
		} else {
			this.outputTips.push({
				x,
				y,
				prevX,
				prevY,
				velocityX,
				velocityY,
				speed,
				propIndex,
				tipIndex,
				flameScale,
				jerk,
			});
		}
	}

	private invalidateRange(start: number, end: number): void {
		for (let i = start; i < end && i < this.prevTips.length; i++) {
			this.prevTips[i]!.valid = false;
		}
	}

	/** Snapshot of internal state for diagnostic reports. */
	getDiagnostics(): Record<string, unknown> {
		const validTips = this.prevTips.filter(t => t.valid);
		return {
			lastUpdateTime: this.lastUpdateTime,
			validTipCount: validTips.length,
			tipPositions: validTips.map(t => ({
				x: Math.round(t.x),
				y: Math.round(t.y),
				vx: Math.round(t.velocityX),
				vy: Math.round(t.velocityY),
			})),
			currentOutputCount: this.outputTips.length,
		};
	}
}
