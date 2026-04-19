<script lang="ts">
	import { container } from "$lib/shared/di";
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
		LIGHT_BLUE_STROKE,
		LIGHT_RED_STROKE,
		LIGHT_BLUE_FILL,
		LIGHT_RED_FILL,
		LIGHT_PURPLE_STROKE,
		LIGHT_PURPLE_FILL,
	} from "../domain/mandala-constants";
	import type { IMandalaGeometryCalculator } from "../services/contracts/IMandalaGeometryCalculator";
	import type { IMandalaRenderer } from "../services/contracts/IMandalaRenderer";

	interface Props {
		// SequenceData — typed as any to avoid circular import issues across module boundaries
		sequence: any;
		mode?: MandalaMode;
		style?: "stroke" | "filled";
		show?: "blue" | "red" | "both";
		size?: number;
		currentStep?: number;
		/**
		 * When true, keep the default dark-mode palette. When false, use the
		 * light-mode prop hues so the mandala matches --prop-blue / --prop-red
		 * on a light background.
		 * Defaults to the app's dark-mode setting.
		 */
		darkMode?: boolean;
	}

	let {
		sequence,
		mode = "gallery",
		style = "stroke",
		show = "both",
		size = MANDALA_DEFAULT_SIZE,
		currentStep,
		darkMode,
	}: Props = $props();

	const LIGHT_PALETTE: MandalaPalette = {
		blueStroke: LIGHT_BLUE_STROKE,
		blueFill: LIGHT_BLUE_FILL,
		redStroke: LIGHT_RED_STROKE,
		redFill: LIGHT_RED_FILL,
		purpleStroke: LIGHT_PURPLE_STROKE,
		purpleFill: LIGHT_PURPLE_FILL,
	};

	let calculator: IMandalaGeometryCalculator | null = $state(null);
	let renderer: IMandalaRenderer | null = $state(null);

	onMount(() => {
		calculator = container.items.mandalaGeometryCalculator;
		renderer = container.items.mandalaRenderer;
	});

	// Derive geometry from sequence steps — recomputes whenever sequence or
	// prop type changes, so switching from staff to fan redraws the mandala
	// with the fan's 5-tip geometry instead of the staff's 2-tip geometry.
	const paths = $derived.by((): MandalaPaths | null => {
		if (!calculator || !sequence?.steps) return null;
		const blueProp = settingsService.settings.bluePropType;
		const redProp = settingsService.settings.redPropType;
		return calculator.calculate(sequence.steps, blueProp, redProp);
	});

	// Effective dark-mode flag — explicit prop wins, otherwise fall back to global settings.
	const effectiveDarkMode = $derived(darkMode ?? settingsService.settings.darkMode);

	// Derive render options — card-back mode omits grid dots and background for a clean embed.
	// In light mode, swap to the light-mode prop palette so hues match --prop-blue / --prop-red.
	const renderOptions = $derived.by((): MandalaRenderOptions => {
		const isCardBack = mode === "card-back";
		return {
			size,
			style,
			showGridDots: !isCardBack,
			show,
			transparentBackground: isCardBack,
			palette: effectiveDarkMode ? undefined : LIGHT_PALETTE,
		};
	});

	// Generate SVG markup string from geometry + options
	const svgString = $derived.by((): string => {
		if (!renderer || !paths) return "";
		return renderer.renderSVG(paths, renderOptions);
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
