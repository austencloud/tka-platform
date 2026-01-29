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
		expandedContent,
		displayValue,
	}: MorphChipProps<T> = $props();

	// Display value: use override, or convert value to string
	let chipDisplayValue = $derived(displayValue ?? String(value));

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

	// Staggered border progress - stays blue longer during collapse
	// Border stays at 1 (blue) until morphProgress drops below 0.3, then fades
	let staggeredBorderProgress = $derived(
		isExpanding || localMorphProgress > 0.3 ? 1 : localMorphProgress / 0.3
	);

	function handleChipClick() {
		if (isExpanding) {
			// Clicking anywhere on expanded chip (not a button) collapses it
			ctx.collapse();
		} else if (!ctx.expandedId) {
			ctx.expand(id);
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
	// Uses CSS calc to properly combine percentages and pixels
	function getChipStyle(index: number, count: number, gap: number): string {
		if (count === 0) return "";

		// Total gaps = (count - 1) * gap
		// Each chip width = (100% - total gaps) / count
		// Each chip left = index * (chip width + gap)
		const totalGaps = (count - 1) * gap;

		return `
			left: calc(${index} * ((100% - ${totalGaps}px) / ${count} + ${gap}px));
			width: calc((100% - ${totalGaps}px) / ${count});
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
	style:--border-progress={staggeredBorderProgress}
	style:--chip-index={chipIndex}
	style={chipIndex >= 0 ? getChipStyle(chipIndex, ctx.chipCount, ctx.gap) : "left: 0; width: 100%;"}
	onclick={handleChipClick}
	onkeydown={(e) => e.key === "Enter" && handleChipClick()}
	role="button"
	tabindex={isFaded ? -1 : 0}
>
	<!-- Collapsed content: label + value, centered with flexbox -->
	<div class="chip-content">
		<span class="chip-label">
			{label}
		</span>
		<span class="chip-value" style:opacity={1 - localMorphProgress}>
			{chipDisplayValue}
		</span>
	</div>

	<!-- Custom expanded content or default options-row -->
	{#if expandedContent}
		<!-- Custom content for complex chips (like Loop) -->
		<div
			class="custom-content"
			style:opacity={localMorphProgress}
			style:pointer-events={isExpanding && localMorphProgress > 0.5 ? "auto" : "none"}
		>
			{@render expandedContent({ collapse: ctx.collapse, morphProgress: localMorphProgress })}
		</div>
	{:else}
		<!-- Default options - slide in from bottom when expanded -->
		<!-- pointer-events:none on container, auto on buttons only - clicks pass through to chip -->
		<div
			class="options-row"
			style:opacity={localMorphProgress}
		>
			{#each options as option}
				<button
					class="option-btn"
					class:selected={value === option.value}
					onclick={(e) => handleOptionSelect(e, option.value)}
					tabindex={isExpanding ? 0 : -1}
					style:pointer-events={isExpanding && localMorphProgress > 0.5 ? "auto" : "none"}
				>
					{option.label}
				</button>
			{/each}
		</div>
	{/if}
</div>

<style>
	/* Placeholder maintains layout space */
	.chip-placeholder {
		flex: 1;
		min-height: 56px;
		pointer-events: none; /* Never capture clicks - let them pass to chips */
	}

	/* The actual chip - positioned absolutely over the placeholder */
	.chip {
		position: absolute;
		top: 0;
		z-index: 1;
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
		border-radius: 18px;
		color: var(--theme-text, #fff);
		overflow: hidden;
		cursor: pointer;
		min-height: 56px;

		/* Border color - uses staggered progress so it stays blue longer during collapse */
		border: 1.5px solid
			color-mix(
				in srgb,
				var(--theme-stroke, rgba(255, 255, 255, 0.1))
					calc(100% - var(--border-progress, 0) * 100%),
				var(--theme-accent, #6366f1) calc(var(--border-progress, 0) * 100%)
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
		cursor: pointer; /* Click anywhere to collapse */
		box-shadow:
			0 4px 20px rgba(99, 102, 241, 0.15),
			0 0 0 1px rgba(99, 102, 241, 0.1);
	}

	.chip.faded {
		opacity: 0;
		pointer-events: none;
	}

	/* Content container - uses flexbox to center label + value like Option C */
	.chip-content {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 4px;
		padding: 8px 12px;
		min-height: 56px;
		pointer-events: none; /* Clicks pass through to chip */
	}

	/* Label - centered via flexbox, color morphs */
	.chip-label {
		white-space: nowrap;
		font-size: 12px;
		font-weight: 500;

		/* Color morphs smoothly via CSS custom property */
		color: color-mix(
			in srgb,
			var(--theme-text-muted, rgba(255, 255, 255, 0.6))
				calc(100% - var(--morph-progress, 0) * 100%),
			var(--theme-accent, #6366f1) calc(var(--morph-progress, 0) * 100%)
		);
		transition: color 300ms ease;
	}

	/* Value - centered via flexbox, fades out when expanded */
	.chip-value {
		font-size: 14px;
		font-weight: 600;
		white-space: nowrap;
		color: var(--theme-text, #fff);
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
		pointer-events: none; /* Clicks pass through to chip; buttons have pointer-events:auto */
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

	/* Custom expanded content container */
	.custom-content {
		position: absolute;
		top: 44px; /* Below the header */
		left: 8px;
		right: 8px;
		bottom: 8px;
		transition: opacity 200ms ease;
	}

	.chip:not(.expanding) .custom-content {
		opacity: 0;
		pointer-events: none;
	}

	/* Respect reduced motion preferences */
	@media (prefers-reduced-motion: reduce) {
		.chip,
		.chip-label {
			transition: none !important;
		}
	}
</style>
