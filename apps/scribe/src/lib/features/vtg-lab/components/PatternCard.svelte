<script lang="ts">
	/**
	 * PatternCard — displays a single TKA letter within a VTG mode.
	 * Renders an actual pictograph plus rotation style badges and metadata.
	 */

	import PictographContainer from "$lib/shared/pictograph/shared/components/PictographContainer.svelte";
	import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
	import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
	import { getSettings } from "$lib/shared/application/state/app-state.svelte";
	import type { VtgPatternEntry } from "../domain/vtg-lab-types";
	import { getLetterPictograph } from "../domain/vtg-pictograph-data";

	interface Props {
		entry: VtgPatternEntry;
		modeColor: string;
	}

	const { entry, modeColor }: Props = $props();

	const rotationLabels: Record<string, { left: string; right: string }> = {
		"pro/pro": { left: "Pro", right: "Pro" },
		"anti/anti": { left: "Anti", right: "Anti" },
		hybrid: { left: "Anti", right: "Pro" },
	};

	const badges = $derived(rotationLabels[entry.rotationStyle] ?? { left: "Pro", right: "Pro" });

	const bluePropType = $derived.by(() => {
		const settings = getSettings();
		return (settings.bluePropType ?? settings.propType ?? PropType.STAFF) as PropType;
	});

	const redPropType = $derived.by(() => {
		const settings = getSettings();
		return (settings.redPropType ?? settings.propType ?? PropType.STAFF) as PropType;
	});

	const pictographData = $derived(getLetterPictograph(entry.letter, bluePropType, redPropType));
</script>

<div class="pattern-card" style:--accent={modeColor}>
	<div class="accent-bar"></div>
	<div class="card-body">
		{#if pictographData}
			<div class="pictograph-area">
				<PictographContainer
					{pictographData}
					gridMode={GridMode.DIAMOND}
				/>
			</div>
		{:else}
			<span class="letter-fallback">{entry.letter}</span>
		{/if}
		<div class="card-meta">
			<div class="rotation-badges">
				<span class="badge blue">{badges.left}</span>
				<span class="badge red">{badges.right}</span>
			</div>
			<span class="position-transition">{entry.positionTransition}</span>
			{#if entry.isPositionDependent}
				<span class="position-note" title={entry.positionNote}>
					<i class="fas fa-info-circle" aria-hidden="true"></i>
					Position-dependent
				</span>
			{/if}
		</div>
	</div>
</div>

<style>
	.pattern-card {
		display: flex;
		border-radius: 10px;
		border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
		overflow: hidden;
		transition: border-color var(--duration-fast, 150ms) ease;
	}

	.pattern-card:hover {
		border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
	}

	.accent-bar {
		width: 4px;
		flex-shrink: 0;
		background: var(--accent);
	}

	.card-body {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem;
		flex: 1;
	}

	.pictograph-area {
		width: 100%;
		aspect-ratio: 1;
		max-width: 180px;
	}

	.letter-fallback {
		font-size: 2rem;
		font-weight: 700;
		color: var(--theme-text, #fff);
		line-height: 1;
		padding: 1rem 0;
	}

	.card-meta {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.375rem;
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

	.position-transition {
		font-size: var(--font-size-compact, 12px);
		color: var(--theme-text-secondary, #888);
	}

	.position-note {
		font-size: var(--font-size-compact, 12px);
		color: #f59e0b;
		display: flex;
		align-items: center;
		gap: 0.25rem;
		cursor: help;
	}

	@media (prefers-reduced-motion: reduce) {
		.pattern-card {
			transition: none;
		}
	}
</style>
