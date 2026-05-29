/**
 * LedTipTracker
 *
 * Tracks LED point positions and computes velocities via finite differencing.
 * Applies the pattern engine to determine per-LED colors each frame.
 *
 * Architecture mirrors FireTipTracker:
 * - Pre-allocated storage to avoid GC pressure
 * - Reusable output array
 * - Velocity clamping for physics stability
 */

import type { LedTipData, LedOverlayConfig } from "../domain/types/LedTypes";
import { hexToLedColor, resolveHandColor } from "../domain/types/LedTypes";
import type { PropState } from "$lib/shared/foundation/domain/types/PropState";
import { getTipPoints } from "../domain/types/PropTipPoints";
import { evaluatePattern as evaluatePatternNew } from "../domain/patterns/evaluator";
import {
	createReusableContext,
	type TipEvaluationContext,
	type TipRelationData,
} from "../domain/patterns/context";
import {
  calculatePropCenter,
  type PropEndpointConfig,
} from "./prop-position-calculator";

export interface LedTipTrackerConfig {
	canvasSize: number;
	bluePropDimensions: { width: number; height: number };
	redPropDimensions: { width: number; height: number };
	bluePropType?: string;
	redPropType?: string;
}

/** Minimum dt to avoid velocity spikes on first frame or pauses */
const MIN_DT_SECONDS = 1 / 120;

/** Maximum velocity magnitude to clamp physics outliers */
const MAX_SPEED = 5000;

/** Maximum LED points across both props (16 per prop) */
const MAX_TOTAL_TIPS = 32;

/** Viewbox size for coordinate calculations (matches PropPositionCalculator) */
const VIEWBOX_SIZE = 950;

interface StoredTip {
	x: number;
	y: number;
	time: number;
	valid: boolean;
}

function createStoredTip(): StoredTip {
	return { x: 0, y: 0, time: 0, valid: false };
}

export class LedTipTracker {

	/**
	 * Previous frame positions. Fixed-size pool, indexed by a stable key
	 * derived from (propIndex, tipIndex). Max 32 tips total.
	 */
	private prevTips: StoredTip[] = [];

	/** Output array reused each frame */
	private outputTips: LedTipData[] = [];

	/** Reusable evaluation context to avoid allocations per LED per frame */
	private evalCtx: TipEvaluationContext = createReusableContext();

	/** Snapshot of previous frame tip positions for TKA-aware patterns (proximity, etc.) */
	private prevFrameSnapshot: TipRelationData[] = [];

	/** Skip first few frames after reset to let canvas size settle. */
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
		config: LedTipTrackerConfig,
		currentTime: number,
		ledConfig: LedOverlayConfig
	): LedTipData[] {
		// Let canvas size settle before emitting LED positions
		if (this.warmupFramesRemaining > 0) {
			this.warmupFramesRemaining--;
			return this.outputTips;
		}

		this.outputTips.length = 0;
		let totalTips = 0;

		// Resolve per-hand base colors from the color mode
		const blueBaseColor = hexToLedColor(resolveHandColor(ledConfig, 0));
		const redBaseColor = hexToLedColor(resolveHandColor(ledConfig, 1));

		// Secondary color is shared across both hands (default white if missing)
		const secondaryBaseColor = hexToLedColor(ledConfig.secondaryColor ?? "#ffffff");

		// Count total LEDs across both props for pattern evaluation
		const blueTipConfig = getTipPoints(config.bluePropType);
		const redTipConfig = getTipPoints(config.redPropType);
		const totalLedCount =
			(blueTipConfig?.points.length ?? 0) + (redTipConfig?.points.length ?? 0);

		// Time in seconds for pattern evaluation
		const timeSeconds = currentTime / 1000;

		if (blueProp) {
			totalTips = this.emitPropTips(
				blueProp,
				config.canvasSize,
				config.bluePropDimensions,
				config.bluePropType ?? null,
				0, // propIndex
				0, // prevTipOffset (blue = slots 0-15)
				currentTime,
				totalTips,
				blueBaseColor,
				secondaryBaseColor,
				ledConfig.patternSpeed,
				totalLedCount,
				timeSeconds,
				0, // ledGlobalOffset (blue LEDs start at 0)
				ledConfig
			);
		} else {
			this.invalidateRange(0, MAX_TOTAL_TIPS / 2);
		}

		if (redProp) {
			const blueLedCount = blueTipConfig?.points.length ?? 0;
			totalTips = this.emitPropTips( // eslint-disable-line @typescript-eslint/no-unused-vars
				redProp,
				config.canvasSize,
				config.redPropDimensions,
				config.redPropType ?? null,
				1, // propIndex
				MAX_TOTAL_TIPS / 2, // prevTipOffset (red = slots 16-31)
				currentTime,
				totalTips,
				redBaseColor,
				secondaryBaseColor,
				ledConfig.patternSpeed,
				totalLedCount,
				timeSeconds,
				blueLedCount, // ledGlobalOffset (red LEDs start after blue)
				ledConfig
			);
		} else {
			this.invalidateRange(MAX_TOTAL_TIPS / 2, MAX_TOTAL_TIPS);
		}

		// Snapshot current output for next frame's prevFrameTips (used by TKA-aware patterns)
		this.prevFrameSnapshot = this.outputTips.map((t) => ({
			x: t.x,
			y: t.y,
			propIndex: t.propIndex,
			tipIndex: t.tipIndex,
		}));

		return this.outputTips;
	}

	reset(): void {
		for (let i = 0; i < this.prevTips.length; i++) {
			this.prevTips[i]!.valid = false;
		}
		this.outputTips.length = 0;
		this.warmupFramesRemaining = LedTipTracker.WARMUP_FRAMES;
	}

	/**
	 * Emit LED tips for a single prop based on its LED point configuration.
	 * Computes velocity BEFORE pattern evaluation so TKA-aware patterns
	 * can use speed/position data in the evaluator context.
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
		baseColor: { r: number; g: number; b: number },
		secondaryBaseColor: { r: number; g: number; b: number },
		patternSpeed: number,
		totalLedCount: number,
		timeSeconds: number,
		ledGlobalOffset: number,
		ledConfig: LedOverlayConfig
	): number {
		const tipConfig = getTipPoints(propType);
		const points = tipConfig.points;

		if (points.length === 0) return outputStartIndex;

		// Compute prop center position
		const endpointConfig: PropEndpointConfig = {
			canvasSize,
			propDimensions,
		};
		const center = calculatePropCenter(prop, endpointConfig);
		const gridScaleFactor = canvasSize / VIEWBOX_SIZE;
		const angle = prop.staffRotationAngle;
		const cosA = Math.cos(angle);
		const sinA = Math.sin(angle);

		let outputIndex = outputStartIndex;

		for (let i = 0; i < points.length && outputIndex < MAX_TOTAL_TIPS; i++) {
			const lp = points[i]!;
			const prevSlot = prevTipOffset + i;
			const prev = this.prevTips[prevSlot]!;

			// Transform LED point from prop-local to canvas space
			const worldX = center.x + (lp.dx * cosA - lp.dy * sinA) * gridScaleFactor;
			const worldY = center.y + (lp.dx * sinA + lp.dy * cosA) * gridScaleFactor;

			// Compute velocity from previous frame BEFORE pattern evaluation
			// so TKA-aware patterns can use speed/position data
			let velocityX = 0;
			let velocityY = 0;
			let speedMagnitude = 0;
			if (prev.valid) {
				const dt = Math.max((currentTime - prev.time) / 1000, MIN_DT_SECONDS);
				velocityX = (worldX - prev.x) / dt;
				velocityY = (worldY - prev.y) / dt;
				speedMagnitude = Math.sqrt(velocityX * velocityX + velocityY * velocityY);
				if (speedMagnitude > MAX_SPEED) {
					const scale = MAX_SPEED / speedMagnitude;
					velocityX *= scale;
					velocityY *= scale;
					speedMagnitude = MAX_SPEED;
				}
			}

			// Build evaluation context and run the new pattern evaluator
			const ledGlobalIndex = ledGlobalOffset + i;
			const ctx = this.evalCtx;
			ctx.time = timeSeconds;
			ctx.ledIndex = ledGlobalIndex;
			ctx.totalLeds = totalLedCount;
			ctx.speed = patternSpeed;
			ctx.primaryColor = baseColor;
			ctx.secondaryColor = secondaryBaseColor;
			ctx.propIndex = propIndex;
			ctx.tipIndex = i;
			ctx.x = worldX;
			ctx.y = worldY;
			ctx.velocityX = velocityX;
			ctx.velocityY = velocityY;
			ctx.speedMagnitude = speedMagnitude;
			ctx.prevFrameTips = this.prevFrameSnapshot;
			ctx.stepNumber = -1;
			ctx.totalSteps = 0;
			const color = evaluatePatternNew(ledConfig.patternId, ctx);

			this.emitTip(
				prev,
				worldX,
				worldY,
				propIndex,
				i,
				1.0,
				color,
				currentTime,
				outputIndex,
				velocityX,
				velocityY,
				speedMagnitude
			);
			outputIndex++;
		}

		// Invalidate remaining prev slots for this prop
		for (let i = points.length; i < MAX_TOTAL_TIPS / 2; i++) {
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
		brightness: number,
		color: { r: number; g: number; b: number },
		currentTime: number,
		outputIndex: number,
		velocityX: number,
		velocityY: number,
		speed: number
	): void {
		// Update stored position for next frame's velocity computation
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
			existing.brightness = brightness;
			existing.r = color.r;
			existing.g = color.g;
			existing.b = color.b;
		} else {
			this.outputTips.push({
				x,
				y,
				velocityX,
				velocityY,
				speed,
				propIndex,
				tipIndex,
				brightness,
				r: color.r,
				g: color.g,
				b: color.b,
			});
		}
	}

	private invalidateRange(start: number, end: number): void {
		for (let i = start; i < end && i < this.prevTips.length; i++) {
			this.prevTips[i]!.valid = false;
		}
	}
}
