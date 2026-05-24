<script lang="ts">
	import { getMandalaGeometryCalculator } from "../getMandalaGeometryCalculator";
	import { renderMandalaSVG } from "$lib/shared/mandala/services/mandala-renderer";
	import { onMount } from "svelte";
	import { settingsService } from "$lib/shared/settings/state/SettingsState.svelte";
	import type {
		MandalaMode,
		MandalaRenderOptions,
		MandalaPaths,
		MandalaPalette,
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
		/** Fixed tip dx override (bypasses standard and animation) */
		tipDx?: number;
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
		animateMin = 80,
		animateMax = 170,
		animatePeriod = 4,
		tipDx,
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
		let startTime: number | null = null;

		function tick(time: number) {
			if (startTime === null) startTime = time;
			const elapsed = (time - startTime) / 1000;
			const t = (Math.sin((elapsed / period) * Math.PI * 2) + 1) / 2;
			animatedDx = minDx + (maxDx - minDx) * t;
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

	const paths = $derived.by((): MandalaPaths | null => {
		if (!calculator || !sequence?.steps) return null;
		return calculator.calculate(
			sequence.steps,
			bluePropType,
			redPropType,
			undefined,
			{ dx: effectiveDx, dy: 0 }
		);
	});

	const effectiveDarkMode = $derived(darkMode ?? settingsService.settings.darkMode);

	const renderOptions = $derived.by((): MandalaRenderOptions => {
		const isCardBack = mode === "card-back";
		return {
			size,
			style,
			showGridDots: !isCardBack,
			show,
			transparentBackground: isCardBack,
			palette: effectiveDarkMode ? DARK_MOTION_PALETTE : LIGHT_MOTION_PALETTE,
		};
	});

	const svgString = $derived.by((): string => {
		if (!paths) return "";
		return renderMandalaSVG(paths, renderOptions);
	});
</script>

{#if svgString}
	<div class="mandala-container" style="width: {size}px; height: {size}px;">
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
