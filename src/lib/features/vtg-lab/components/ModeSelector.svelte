<script lang="ts">
	/**
	 * ModeSelector - horizontal row of VTG mode cards.
	 * Each card shows the mode abbreviation, full name, and letter count.
	 */

	import type { VTGMode } from "$lib/features/learn/domain/constants/vtg-experience-data";
	import {
		VTG_MODES,
		VTG_MODE_INFO,
	} from "$lib/features/learn/domain/constants/vtg-experience-data";
	import { VTG_MODE_GROUPS } from "../domain/vtg-pattern-data";

	interface Props {
		selectedMode: VTGMode;
		onSelect: (mode: VTGMode) => void;
	}

	const { selectedMode, onSelect }: Props = $props();

	function getLetterCount(mode: VTGMode): number {
		const group = VTG_MODE_GROUPS.find((g) => g.mode === mode);
		if (!group) return 0;
		return group.rotationGroups.reduce((sum, rg) => sum + rg.entries.length, 0);
	}
</script>

<div class="mode-selector" role="radiogroup" aria-label="VTG mode selection">
	{#each VTG_MODES as mode (mode)}
		{@const info = VTG_MODE_INFO[mode]}
		{@const isActive = mode === selectedMode}
		{@const letterCount = getLetterCount(mode)}
		<button
			class="mode-card"
			class:active={isActive}
			role="radio"
			aria-checked={isActive}
			onclick={() => onSelect(mode)}
			style:--mode-color={info.color}
		>
			<span class="mode-abbr">{mode}</span>
			<span class="mode-name">{info.name}</span>
			<span class="mode-count">{letterCount} letter{letterCount !== 1 ? "s" : ""}</span>
		</button>
	{/each}
</div>

<style>
	.mode-selector {
		display: flex;
		gap: 0.75rem;
		overflow-x: auto;
		padding: 0.5rem 0 1rem;
		scrollbar-width: thin;
		scrollbar-color: var(--scrollbar-thumb, rgba(255, 255, 255, 0.2)) transparent;
	}

	/* Prevent cards from shrinking on overflow */
	.mode-card {
		flex: 0 0 auto;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.375rem;
		padding: 0.75rem 1rem;
		min-width: 100px;
		min-height: 44px;
		border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
		border-radius: 10px;
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
		color: var(--theme-text-secondary, #888);
		cursor: pointer;
		transition: all var(--duration-fast, 150ms) ease;
	}

	@media (pointer: coarse) {
		.mode-card {
			min-height: var(--min-touch-target);
		}
	}

	.mode-card:hover {
		border-color: var(--mode-color);
		color: var(--theme-text, #fff);
	}

	.mode-card.active {
		border-color: var(--mode-color);
		background: color-mix(in srgb, var(--mode-color) 12%, transparent);
		color: var(--theme-text, #fff);
	}

	.mode-card:focus-visible {
		outline: 2px solid var(--theme-accent, #22d3ee);
		outline-offset: 2px;
	}

	.mode-abbr {
		font-size: 1.125rem;
		font-weight: 700;
		color: var(--mode-color);
	}

	.mode-name {
		font-size: var(--font-size-compact, 12px);
		white-space: nowrap;
	}

	.mode-count {
		font-size: var(--font-size-compact, 12px);
		opacity: 0.6;
	}

	@media (prefers-reduced-motion: reduce) {
		.mode-card {
			transition: none;
		}
	}
</style>
