<script lang="ts">
	import { container } from "$lib/shared/di";
	import { onMount } from "svelte";
	import type {
		MandalaMode,
		MandalaRenderOptions,
		MandalaPaths,
	} from "../domain/mandala-types";
	import { MANDALA_DEFAULT_SIZE } from "../domain/mandala-constants";
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
	}

	let {
		sequence,
		mode = "gallery",
		style = "stroke",
		show = "both",
		size = MANDALA_DEFAULT_SIZE,
		currentStep,
	}: Props = $props();

	let calculator: IMandalaGeometryCalculator | null = $state(null);
	let renderer: IMandalaRenderer | null = $state(null);

	onMount(() => {
		calculator = container.items.mandalaGeometryCalculator;
		renderer = container.items.mandalaRenderer;
	});

	// Derive geometry from sequence steps — recomputes whenever sequence changes
	const paths = $derived.by((): MandalaPaths | null => {
		if (!calculator || !sequence?.steps) return null;
		return calculator.calculate(sequence.steps);
	});

	// Derive render options — card-back mode omits grid dots for a cleaner decorative look
	const renderOptions = $derived.by((): MandalaRenderOptions => {
		const showGridDots = mode !== "card-back";
		return { size, style, showGridDots, show };
	});

	// Generate SVG markup string from geometry + options
	const svgString = $derived.by((): string => {
		if (!renderer || !paths) return "";
		return renderer.renderSVG(paths, renderOptions);
	});
</script>

{#if svgString}
	{@html svgString}
{/if}
