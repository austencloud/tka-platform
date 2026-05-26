<script lang="ts">
	import { getMandalaGeometryCalculator } from "../getMandalaGeometryCalculator";
	import { renderMandalaSVG } from "$lib/shared/mandala/services/mandala-renderer";
	import { onMount } from "svelte";
	import { cubicInOut } from "svelte/easing";
	import { settingsService } from "$lib/shared/settings/state/SettingsState.svelte";
	import type {
		MandalaMode,
		MandalaRenderOptions,
		MandalaPaths,
		MandalaPalette,
		MandalaPathShape,
		UndulationEasing,
	} from "../domain/mandala-types";
	import {
		MANDALA_DEFAULT_SIZE,
		MANDALA_STANDARD_TIP_DX,
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
	import type { MandalaGeometryCalculator } from "../services/implementations/MandalaGeometryCalculator";
	import type { MandalaPathOptions } from "../services/contracts/types";

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

	let calculator: MandalaGeometryCalculator | null = $state(null);
	let animatedDx: number = $state(MANDALA_STANDARD_TIP_DX);
	let rotationDeg: number = $state(0);
	let rafId: number = 0;

	onMount(() => {
		calculator = getMandalaGeometryCalculator();
		return () => {
			if (rafId) cancelAnimationFrame(rafId);
		};
	});

	$effect(() => {
		if (!animate) {
			if (rafId) {
				cancelAnimationFrame(rafId);
				rafId = 0;
			}
			return;
		}

		const minDx = animateMin;
		const maxDx = animateMax;
		const period = animatePeriod;
		const rotPerCycle = animateRotation;
		const easeFn = EASING_FNS[animateEasing];
		let startTime: number | null = null;
		let lastPhase = 0;

		function tick(time: number) {
			if (startTime === null) startTime = time;
			const elapsed = (time - startTime) / 1000;
			const phase = (elapsed % period) / period;
			const triangle = phase < 0.5 ? phase * 2 : 2 - phase * 2;
			const eased = easeFn(triangle);
			animatedDx = minDx + (maxDx - minDx) * eased;

			if (rotPerCycle !== 0) {
				const dt = phase >= lastPhase ? phase - lastPhase : phase + (1 - lastPhase);
				rotationDeg += dt * rotPerCycle;
			}
			lastPhase = phase;

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

	const pathOptions = $derived.by((): MandalaPathOptions | undefined => {
		if (pathShape === "motion-aware") return { motionAware: true };
		if (pathShape !== "arc") return { pathShape };
		return undefined;
	});

	const paths = $derived.by((): MandalaPaths | null => {
		if (!calculator || !sequence?.steps) return null;
		return calculator.calculate(
			sequence.steps,
			bluePropType,
			redPropType,
			pathOptions,
			{ dx: effectiveDx, dy: 0 }
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

	const svgString = $derived.by((): string => {
		if (!paths) return "";
		return renderMandalaSVG(paths, renderOptions);
	});
</script>

{#if svgString}
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
</style>
