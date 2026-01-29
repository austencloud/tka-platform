<!--
  MorphChip.svelte - Individual morphing chip component

  Renders a chip that morphs between collapsed (label + value) and
  expanded (label + options) states. Uses absolute positioning over
  a placeholder to enable smooth expansion animations.
-->
<script lang="ts" generics="T = string">
	import { onMount, onDestroy } from "svelte";
	import { getMorphChipContext } from "./morph-chip-context.svelte.ts";
	import type { MorphChipProps } from "./types";

	let {
		id,
		label,
		expandedLabel,
		value = $bindable(),
		options,
		onchange,
		collapseDelay = 150,
	}: MorphChipProps<T> = $props();

	const ctx = getMorphChipContext();

	// Register this chip on mount
	let chipIndex = $state(-1);

	onMount(() => {
		chipIndex = ctx.registerChip(id);
	});

	onDestroy(() => {
		ctx.unregisterChip(id);
	});

	// Derived state
	let isExpanding = $derived(ctx.expandedId === id);
	let isFaded = $derived(ctx.expandedId !== null && !isExpanding);

	// Use expanded label if provided, otherwise fall back to label
	let displayLabel = $derived(expandedLabel ?? label);

	// Local morph progress (only applies to expanding chip)
	let localMorphProgress = $derived(isExpanding ? ctx.morphProgress : 0);

	function handleChipClick() {
		if (!isExpanding && !ctx.expandedId) {
			ctx.expand(id);
		}
	}

	function handleLabelClick(e: MouseEvent) {
		if (isExpanding) {
			e.stopPropagation();
			ctx.collapse();
		}
	}

	function handleOptionSelect(e: MouseEvent, optionValue: T) {
		e.stopPropagation();
		value = optionValue;
		onchange?.(optionValue);
		// Delay collapse for visual feedback
		setTimeout(() => ctx.collapse(), collapseDelay);
	}

	// Calculate position based on chip count
	// Each chip takes 1/n of the width minus gap adjustments
	function getChipStyle(index: number, count: number, gap: number): string {
		if (count === 0) return "";

		const widthPercent = 100 / count;
		// Total gap space = (count - 1) * gap
		// Each chip's share of gap reduction = ((count - 1) * gap) / count
		const gapAdjustment = ((count - 1) * gap) / count;
		const leftOffset = index * (widthPercent + gap / count);

		return `
			left: calc(${leftOffset}%);
			width: calc(${widthPercent}% - ${gapAdjustment}px);
		`;
	}
</script>

<!-- Placeholder maintains layout space -->
<div class="chip-placeholder"></div>

<!-- The actual chip - positioned absolutely -->
<div
	class="chip"
	class:expanding={isExpanding}
	class:faded={isFaded}
	style:--morph-progress={localMorphProgress}
	style:--chip-index={chipIndex}
	style={chipIndex >= 0 ? getChipStyle(chipIndex, ctx.chipCount, ctx.gap) : ""}
	onclick={handleChipClick}
	onkeydown={(e) => e.key === "Enter" && handleChipClick()}
	role="button"
	tabindex={isFaded ? -1 : 0}
>
	<!-- Label - stays centered, color morphs via CSS -->
	<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
	<span
		class="chip-label"
		onclick={handleLabelClick}
		onkeydown={(e) => e.key === "Enter" && handleLabelClick(e as unknown as MouseEvent)}
		role={isExpanding ? "button" : undefined}
		tabindex={isExpanding ? 0 : -1}
	>
		{label}
	</span>

	<!-- Value - stays centered, fades out -->
	<span class="chip-value" style:opacity={1 - localMorphProgress}>
		{String(value)}
	</span>

	<!-- Options - slide in from bottom -->
	<div
		class="options-row"
		style:opacity={localMorphProgress}
		style:pointer-events={isExpanding && localMorphProgress > 0.5 ? "auto" : "none"}
	>
		{#each options as option}
			<button
				class="option-btn"
				class:selected={value === option.value}
				onclick={(e) => handleOptionSelect(e, option.value)}
				tabindex={isExpanding ? 0 : -1}
			>
				{option.label}
			</button>
		{/each}
	</div>
</div>

<style>
	/* Placeholder maintains layout space */
	.chip-placeholder {
		flex: 1;
		min-height: 56px;
	}

	/* The actual chip - positioned absolutely over the placeholder */
	.chip {
		position: absolute;
		top: 0;
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
		border-radius: 18px;
		color: var(--theme-text, #fff);
		overflow: hidden;
		cursor: pointer;
		height: 56px;

		/* Spring-driven border color */
		border: 1.5px solid
			color-mix(
				in srgb,
				var(--theme-stroke, rgba(255, 255, 255, 0.1))
					calc(100% - var(--morph-progress, 0) * 100%),
				var(--theme-accent, #6366f1) calc(var(--morph-progress, 0) * 100%)
			);

		/* Smooth transitions */
		transition:
			left 300ms cubic-bezier(0.34, 1.2, 0.64, 1),
			width 300ms cubic-bezier(0.34, 1.2, 0.64, 1),
			height 300ms cubic-bezier(0.34, 1.2, 0.64, 1),
			opacity 200ms ease,
			box-shadow 200ms ease;
	}

	.chip.expanding {
		/* Expand to cover entire container */
		left: 0 !important;
		width: 100% !important;
		height: var(--expanded-height, 132px);
		z-index: 10;
		cursor: default;
		box-shadow:
			0 4px 20px rgba(99, 102, 241, 0.15),
			0 0 0 1px rgba(99, 102, 241, 0.1);
	}

	.chip.faded {
		opacity: 0;
		pointer-events: none;
	}

	/* Label - stays centered in both states, only color changes */
	.chip-label {
		position: absolute;
		white-space: nowrap;
		cursor: pointer;

		/* ALWAYS centered at top */
		top: 12px;
		left: 50%;
		transform: translateX(-50%);
		font-size: 12px;
		font-weight: 600;

		/* Color morphs smoothly via CSS custom property */
		color: color-mix(
			in srgb,
			var(--theme-text-muted, rgba(255, 255, 255, 0.6))
				calc(100% - var(--morph-progress, 0) * 100%),
			var(--theme-accent, #6366f1) calc(var(--morph-progress, 0) * 100%)
		);
		transition: color 300ms ease;
	}

	.chip.expanding .chip-label:hover {
		text-decoration: underline;
	}

	/* Value - centered below label, fades out when expanded */
	.chip-value {
		position: absolute;
		top: 30px;
		left: 50%;
		transform: translateX(-50%);
		font-size: 14px;
		font-weight: 600;
		white-space: nowrap;
		color: var(--theme-text, #fff);
		pointer-events: none;
		transition: opacity 200ms ease;
	}

	/* Options - positioned at bottom, slide up */
	.options-row {
		position: absolute;
		bottom: 8px;
		left: 8px;
		right: 8px;
		display: flex;
		gap: 4px;
		transition: opacity 200ms ease;
	}

	.chip:not(.expanding) .options-row {
		bottom: -100px;
		opacity: 0;
	}

	.option-btn {
		flex: 1;
		min-height: 48px;
		background: var(--theme-panel-bg, rgba(18, 18, 28, 0.6));
		border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
		border-radius: 12px;
		color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
		cursor: pointer;
		font-weight: 600;
		font-size: 14px;
	}

	.option-btn:hover {
		border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
		color: var(--theme-text, #fff);
	}

	.option-btn.selected {
		background: color-mix(in srgb, var(--theme-accent) 25%, var(--theme-card-bg));
		border-color: var(--theme-accent, #6366f1);
		color: var(--theme-text, #fff);
	}

	/* Respect reduced motion preferences */
	@media (prefers-reduced-motion: reduce) {
		.chip,
		.chip-label {
			transition: none !important;
		}
	}
</style>
