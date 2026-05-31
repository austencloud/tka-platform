<script lang="ts">
	/**
	 * SequenceStrip - renders a 4-step VTG cycle as a horizontal strip
	 * of pictographs with beat labels, rotation badges, and position info.
	 */

	import PictographContainer from "$lib/shared/pictograph/shared/components/PictographContainer.svelte";
	import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
	import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";
	import type { RotationStyle } from "../domain/vtg-lab-types";

	interface Props {
		/** The 4 pictograph beats to render */
		beats: PictographData[];
		/** Display label (letter or compound name) */
		label: string;
		/** Compound mnemonic, if applicable */
		mnemonic?: string;
		/** Rotation style for badges */
		rotationStyle: RotationStyle;
		/** Mode accent color */
		modeColor: string;
	}

	const { beats, label, mnemonic, rotationStyle, modeColor }: Props = $props();

	const rotationLabels: Record<RotationStyle, { left: string; right: string }> = {
		"pro/pro": { left: "Pro", right: "Pro" },
		"anti/anti": { left: "Anti", right: "Anti" },
		hybrid: { left: "Anti", right: "Pro" },
	};

	const badges = $derived(rotationLabels[rotationStyle]);
	const isCompound = $derived(label.length > 1);
</script>

<div class="sequence-strip" style:--accent={modeColor}>
	<div class="strip-header">
		<div class="strip-label-row">
			<div class="accent-dot"></div>
			<span class="strip-label">{label}</span>
			{#if mnemonic}
				<span class="strip-mnemonic">{mnemonic}</span>
			{/if}
		</div>
		<div class="rotation-badges">
			<span class="badge blue">{badges.left}</span>
			<span class="badge red">{badges.right}</span>
		</div>
	</div>

	<div class="beats-row">
		{#each beats as beat, i (beat.id)}
			<div class="beat-cell">
				<span class="beat-number">{i + 1}</span>
				<div class="pictograph-wrapper">
					<PictographContainer
						pictographData={beat}
						gridMode={GridMode.DIAMOND}
					/>
				</div>
				{#if isCompound}
					<span class="beat-letter">{beat.letter}</span>
				{/if}
			</div>
		{/each}
	</div>
</div>

<style>
	.sequence-strip {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.75rem;
		border-radius: 10px;
		border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
		transition: border-color var(--duration-fast, 150ms) ease;
	}

	.sequence-strip:hover {
		border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
	}

	.strip-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.strip-label-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.accent-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--accent);
		flex-shrink: 0;
	}

	.strip-label {
		font-size: 1.125rem;
		font-weight: 700;
		color: var(--theme-text, #fff);
	}

	.strip-mnemonic {
		font-size: var(--font-size-compact, 12px);
		color: var(--theme-text-secondary, #888);
		font-style: italic;
	}

	.rotation-badges {
		display: flex;
		gap: 0.375rem;
	}

	.badge {
		font-size: var(--font-size-compact, 12px);
		font-weight: 600;
		padding: 0.125rem 0.5rem;
		border-radius: 4px;
	}

	.badge.blue {
		background: rgba(59, 130, 246, 0.2);
		color: #60a5fa;
	}

	.badge.red {
		background: rgba(239, 68, 68, 0.2);
		color: #f87171;
	}

	.beats-row {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 0.5rem;
	}

	.beat-number {
		font-size: var(--font-size-compact, 12px);
		font-weight: 600;
		color: var(--theme-text-secondary, #888);
		opacity: 0.6;
	}

	.pictograph-wrapper {
		width: 100%;
		aspect-ratio: 1;
	}

	.beat-letter {
		font-size: var(--font-size-compact, 12px);
		font-weight: 600;
		color: var(--accent);
	}

	@media (prefers-reduced-motion: reduce) {
		.sequence-strip {
			transition: none;
		}
	}
</style>
