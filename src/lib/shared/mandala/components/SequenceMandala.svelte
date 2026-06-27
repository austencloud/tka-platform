<script lang="ts">
	import { renderMandalaSVG, renderMandalaToCanvas } from "$lib/shared/mandala/services/mandala-renderer";
	import { onMount } from "svelte";
	import { cubicInOut } from "svelte/easing";
	import { settingsService } from "$lib/shared/settings/state/settings-state.svelte";
	import type {
		MandalaMode,
		MandalaRenderOptions,
		MandalaPaths,
		MandalaPalette,
		MandalaPathShape,
		UndulationEasing,
	} from "../domain/mandala-types";
	import { DEFAULT_OVERLAP_CONFIG } from "../domain/mandala-types";
	import {
		MANDALA_DEFAULT_SIZE,
		MANDALA_STANDARD_TIP_DX,
		MANDALA_GRID_RADIUS,
		ENGINE_GRID_RADIUS,
		DARK_MOTION_BLUE_STROKE,
		DARK_MOTION_RED_STROKE,
		DARK_MOTION_BLUE_FILL,
		DARK_MOTION_RED_FILL,
		DARK_MOTION_PURPLE_STROKE,
		DARK_MOTION_PURPLE_FILL,
		LIGHT_MOTION_BLUE_STROKE,
		LIGHT_MOTION_RED_STROKE,
		LIGHT_MOTION_BLUE_FILL,
		LIGHT_MOTION_RED_FILL,
		LIGHT_MOTION_PURPLE_STROKE,
		LIGHT_MOTION_PURPLE_FILL,
	} from "../domain/mandala-constants";
	import { calculate as calculateMandalaGeometry, calculateMorphed as calculateMandalaMorphed } from "../services/mandala-geometry-calculator";
	import type { MandalaPathOptions } from "../services/types";

	export type { MandalaPathShape, UndulationEasing } from "../domain/mandala-types";

	function softElasticEase(t: number): number {
		if (t === 0 || t === 1) return t;
		const base = (1 - Math.cos(t * Math.PI)) / 2;
		const wobble = Math.sin(t * Math.PI * 3) * t * (1 - t) * 0.35;
		return base + wobble;
	}

	function breatheEase(t: number): number {
		return Math.pow(Math.sin(t * Math.PI / 2), 1.6);
	}

	function heartbeatEase(t: number): number {
		if (t < 0.3) return Math.pow(t / 0.3, 2) * 1.08;
		if (t < 0.45) return 1.08 - 0.18 * ((t - 0.3) / 0.15);
		return 0.9 + 0.1 * (1 - Math.pow(1 - (t - 0.45) / 0.55, 2));
	}

	function driftEase(t: number): number {
		const base = (1 - Math.cos(t * Math.PI)) / 2;
		const wander = Math.sin(t * Math.PI * 5) * Math.pow(t * (1 - t), 1.5) * 0.18;
		return base + wander;
	}

	function bloomEase(t: number): number {
		return 1 - Math.pow(1 - t, 3.5);
	}

	function tidalEase(t: number): number {
		const primary = (1 - Math.cos(t * Math.PI)) / 2;
		const secondary = Math.sin(t * Math.PI * 2) * 0.1 * (1 - Math.abs(2 * t - 1));
		return primary + secondary;
	}

	const EASING_FNS: Record<UndulationEasing, (t: number) => number> = {
		sine: (t: number) => (1 - Math.cos(t * Math.PI)) / 2,
		ease: cubicInOut,
		"soft-elastic": softElasticEase,
		breathe: breatheEase,
		heartbeat: heartbeatEase,
		drift: driftEase,
		bloom: bloomEase,
		tidal: tidalEase,
	};

	interface Props {
		sequence: any;
		mode?: MandalaMode;
		style?: "stroke" | "filled";
		show?: "blue" | "red" | "both";
		size?: number;
		currentStep?: number;
		darkMode?: boolean;
		bluePropType?: string;
		redPropType?: string;
		/** Animate the mandala by oscillating tip point distance */
		animate?: boolean;
		/** Min dx for animation oscillation (default 80) */
		animateMin?: number;
		/** Max dx for animation oscillation (default 170) */
		animateMax?: number;
		/** Seconds per full oscillation cycle (default 4) */
		animatePeriod?: number;
		/** Easing curve: "sine" (natural), "ease" (cubicInOut), "elastic" (overshoot), "linear" (constant speed) */
		animateEasing?: UndulationEasing;
		/** Degrees to rotate the whole mandala per undulation cycle (0 = no rotation) */
		animateRotation?: number;
		/** Path interpolation shape for hand movement */
		pathShape?: MandalaPathShape;
		/** Fixed tip dx override (bypasses standard and animation) */
		tipDx?: number;
		/** Override palette colors */
		palette?: MandalaPalette;
		/** Override stroke width (default 2.5) */
		strokeWidth?: number;
		/** Per-path gradient colors for gradient color mode */
		gradient?: { blue: [string, string]; red: [string, string]; purple: [string, string] };
		/** Prop ends traced: 2 = staff (both tips), 1 = club (one tip). Default 2. */
		tipEnds?: 1 | 2;
	}

	let {
		sequence,
		mode = "gallery",
		style = "stroke",
		show = "both",
		size = MANDALA_DEFAULT_SIZE,
		currentStep,
		darkMode,
		bluePropType,
		redPropType,
		animate = false,
		animateMin = 0,
		animateMax = 250,
		animatePeriod = 5,
		animateEasing = "sine",
		animateRotation = 90,
		pathShape = "arc",
		tipDx,
		palette: paletteOverride,
		strokeWidth,
		gradient,
		tipEnds = 2,
	}: Props = $props();

	const DARK_MOTION_PALETTE: MandalaPalette = {
		blueStroke: DARK_MOTION_BLUE_STROKE,
		blueFill: DARK_MOTION_BLUE_FILL,
		redStroke: DARK_MOTION_RED_STROKE,
		redFill: DARK_MOTION_RED_FILL,
		purpleStroke: DARK_MOTION_PURPLE_STROKE,
		purpleFill: DARK_MOTION_PURPLE_FILL,
	};

	const LIGHT_MOTION_PALETTE: MandalaPalette = {
		blueStroke: LIGHT_MOTION_BLUE_STROKE,
		blueFill: LIGHT_MOTION_BLUE_FILL,
		redStroke: LIGHT_MOTION_RED_STROKE,
		redFill: LIGHT_MOTION_RED_FILL,
		purpleStroke: LIGHT_MOTION_PURPLE_STROKE,
		purpleFill: LIGHT_MOTION_PURPLE_FILL,
	};

	let calcReady: boolean = $state(false);
	let animatedDx: number = $state(MANDALA_STANDARD_TIP_DX);
	let rotationDeg: number = $state(0);
	let rafId: number = 0;

	// Live render target. While animating (undulation or shape-morph) the mandala
	// is painted to a persistent <canvas> via renderMandalaToCanvas — the same
	// Path2D + single-shadow-blur renderer the MP4 export uses — instead of
	// re-serializing the full SVG string and re-parsing it through {@html} every
	// frame. {@html} tore down and rebuilt the entire filtered SVG subtree (three
	// feGaussianBlur filters + mask + bloom) 60×/sec, which is what made the
	// animation stutter. Static consumers (gallery, card back, guide) never set
	// `animate`, so they keep the unchanged SVG-string path.
	const GLOW_STDDEV = 3;
	let canvasEl: HTMLCanvasElement | undefined = $state();
	// Reused offscreen scratch for the glow + purple-overlap mask passes, sized to
	// the device-pixel backing store, so the hot loop allocates nothing per frame.
	let scratch: { a: OffscreenCanvas; b: OffscreenCanvas } | null = null;

	// Fixed reference period (seconds) for rotation. animateRotation is "degrees
	// per this many seconds" — independent of the undulation period. Matches the
	// default animatePeriod (5) so existing default speed is unchanged.
	const ROTATION_REF_PERIOD = 5;

	// Shape-morph state: when pathShape changes, geometry lerps from the old shape
	// to the new one over MORPH_MS instead of snapping, while the breathing/rotation
	// animation keeps running.
	const MORPH_MS = 1200;
	let morphRafId: number = 0;
	let lastShape: MandalaPathShape = pathShape;
	let activeMorph: { from: MandalaPathShape; t: number } | null = $state(null);

	onMount(() => {
		calcReady = true;
		return () => {
			if (rafId) cancelAnimationFrame(rafId);
			if (morphRafId) cancelAnimationFrame(morphRafId);
		};
	});

	function optionsFor(shape: MandalaPathShape): MandalaPathOptions | undefined {
		const base: MandalaPathOptions = {};
		if (shape === "hybrid") base.motionAware = true;
		else if (shape !== "arc") base.pathShape = shape;
		if (tipEnds === 1) base.tipEnds = 1;
		return Object.keys(base).length > 0 ? base : undefined;
	}

	// Drive a morph whenever pathShape changes. Reads pathShape (tracked); lastShape
	// is non-reactive so reassigning it doesn't retrigger. activeMorph is set inside
	// the rAF (outside tracking), so updating progress never re-runs this effect.
	$effect(() => {
		const target = pathShape;
		if (target === lastShape) return;
		const from = lastShape;
		lastShape = target;

		if (morphRafId) cancelAnimationFrame(morphRafId);
		let start: number | null = null;
		const stepMorph = (ts: number) => {
			if (start === null) start = ts;
			const lin = Math.min(1, (ts - start) / MORPH_MS);
			activeMorph = { from, t: EASING_FNS.bloom(lin) };
			if (lin < 1) {
				morphRafId = requestAnimationFrame(stepMorph);
			} else {
				activeMorph = null;
				morphRafId = 0;
			}
		};
		morphRafId = requestAnimationFrame(stepMorph);
	});

	// Animation loop depends ONLY on `animate`. Every tunable (min/max dx, period,
	// rotation, easing) is read live inside the rAF tick — which runs outside the
	// reactive tracking context — so adjusting speed/spin/depth retunes the motion
	// in place without re-running the effect or restarting the cycle. Phase is
	// accumulated from frame deltas, so changing the period only changes the rate,
	// never the position (no jump, fully continuous).
	$effect(() => {
		if (!animate) {
			if (rafId) {
				cancelAnimationFrame(rafId);
				rafId = 0;
			}
			return;
		}

		let lastTime: number | null = null;
		let phaseAccum = 0;

		function tick(time: number) {
			if (lastTime === null) lastTime = time;
			const dtSec = (time - lastTime) / 1000;
			lastTime = time;

			const period = animatePeriod > 0 ? animatePeriod : 5;
			const cyclesElapsed = dtSec / period;
			phaseAccum = (phaseAccum + cyclesElapsed) % 1;

			const triangle = phaseAccum < 0.5 ? phaseAccum * 2 : 2 - phaseAccum * 2;
			const eased = EASING_FNS[animateEasing](triangle);
			animatedDx = animateMin + (animateMax - animateMin) * eased;

			if (animateRotation !== 0) {
				// Rotation runs on its own fixed-rate clock (ROTATION_REF_PERIOD),
				// fully decoupled from animatePeriod so the undulation-speed slider
				// never changes how fast the mandala spins.
				rotationDeg += (dtSec / ROTATION_REF_PERIOD) * animateRotation;
			}

			rafId = requestAnimationFrame(tick);
		}

		rafId = requestAnimationFrame(tick);
		return () => {
			if (rafId) {
				cancelAnimationFrame(rafId);
				rafId = 0;
			}
		};
	});

	const effectiveDx = $derived(
		tipDx ?? (animate ? animatedDx : MANDALA_STANDARD_TIP_DX)
	);

	const pathOptions = $derived(optionsFor(pathShape));

	const paths = $derived.by((): MandalaPaths | null => {
		if (!calcReady || !sequence?.steps) return null;
		const tip = { dx: effectiveDx, dy: 0 };
		const morph = activeMorph;
		if (morph) {
			return calculateMandalaMorphed(
				sequence.steps,
				bluePropType,
				redPropType,
				optionsFor(morph.from),
				pathOptions,
				morph.t,
				tip
			);
		}
		return calculateMandalaGeometry(
			sequence.steps,
			bluePropType,
			redPropType,
			pathOptions,
			tip
		);
	});

	const effectiveDarkMode = $derived(darkMode ?? settingsService.settings.darkMode);

	const renderOptions = $derived.by((): MandalaRenderOptions => {
		return {
			size,
			style,
			show,
			palette: paletteOverride ?? (effectiveDarkMode ? DARK_MOTION_PALETTE : LIGHT_MOTION_PALETTE),
			tipDx: effectiveDx,
			strokeWidth,
			gradient,
		};
	});

	// Canvas while motion is live (undulation or shape-morph), SVG when fully
	// static. `svgString` is lazy — it isn't read in the canvas branch, so the
	// expensive SVG-string build is skipped entirely during animation.
	const useCanvas = $derived(animate || activeMorph !== null);

	const svgString = $derived.by((): string => {
		if (useCanvas || !paths) return "";
		return renderMandalaSVG(paths, renderOptions);
	});

	// Paint the canvas whenever any visual input changes. During animation
	// `paths` (driven by animatedDx) and `palette`/`gradient` (driven by the
	// controller's color loop) produce fresh values each frame, so this effect
	// re-runs ~once per frame and redraws. Rotation is intentionally NOT read
	// here — it stays a CSS transform on the wrapper (compositor-cheap, never
	// forces a canvas repaint).
	$effect(() => {
		if (!useCanvas) return;
		const canvas = canvasEl;
		const p = paths;
		if (!canvas || !p) return;
		const opts = renderOptions;

		const ratio =
			typeof window !== "undefined"
				? Math.min(3, Math.max(1, window.devicePixelRatio || 1))
				: 1;
		const device = Math.max(1, Math.round(size * ratio));
		if (canvas.width !== device || canvas.height !== device) {
			canvas.width = device;
			canvas.height = device;
		}

		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		// Persistent device-sized scratch for the glow/mask passes (allocate only
		// on first paint or size change).
		if (typeof OffscreenCanvas !== "undefined") {
			if (!scratch || scratch.a.width !== device || scratch.a.height !== device) {
				scratch = { a: new OffscreenCanvas(device, device), b: new OffscreenCanvas(device, device) };
			}
		}

		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.clearRect(0, 0, device, device);
		ctx.scale(ratio, ratio);

		// Device-space glow blur that matches the SVG `#glow` feGaussianBlur, whose
		// stdDeviation lives inside the scaled <g> (so its device size is
		// stdDeviation × renderScale × dpr). Mirrors mandala-frame-renderer.
		const effTip = Math.max(opts.tipDx ?? MANDALA_STANDARD_TIP_DX, MANDALA_STANDARD_TIP_DX);
		const tipReach = (effTip * MANDALA_GRID_RADIUS) / ENGINE_GRID_RADIUS;
		const renderScale = size / 2 / ((MANDALA_GRID_RADIUS + tipReach) * 1.05);

		renderMandalaToCanvas(ctx, p, {
			...opts,
			size,
			glow: {
				blur: GLOW_STDDEV * renderScale * ratio,
				bloomBlur: DEFAULT_OVERLAP_CONFIG.bloomBlur * renderScale * ratio,
			},
			offsetX: 0,
			offsetY: 0,
			maskScratch: scratch ?? undefined,
		});
	});
</script>

{#if useCanvas}
	<div
		class="mandala-container"
		style="width: {size}px; height: {size}px; transform: rotate({rotationDeg}deg);"
	>
		<canvas bind:this={canvasEl} class="mandala-canvas"></canvas>
	</div>
{:else if svgString}
	<div
		class="mandala-container"
		style="width: {size}px; height: {size}px; transform: rotate({rotationDeg}deg);"
	>
		{@html svgString}
	</div>
{/if}

<style>
	.mandala-container {
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
	}

	.mandala-container :global(svg) {
		width: 100%;
		height: 100%;
	}

	.mandala-canvas {
		width: 100%;
		height: 100%;
		display: block;
	}
</style>
