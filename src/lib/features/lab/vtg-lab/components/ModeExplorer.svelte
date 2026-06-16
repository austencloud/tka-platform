<script lang="ts">
	/**
	 * ModeExplorer - displays the ChoreoCard matrix for a selected VTG mode,
	 * with a mode-description header.
	 */

	import { VTG_MODE_INFO } from "$lib/features/learn/domain/constants/vtg-experience-data";
	import type { VtgModeGroup } from "../domain/vtg-lab-types";
	import { VTG_MODE_TO_TND_FAMILY } from "../domain/vtg-tnd-family-map";
	import VtgModeMatrix from "./VtgModeMatrix.svelte";

	interface Props {
		modeGroup: VtgModeGroup;
	}

	const { modeGroup }: Props = $props();

	const modeInfo = $derived(VTG_MODE_INFO[modeGroup.mode]);
	const modeColor = $derived(modeInfo.color);
	const familyId = $derived(VTG_MODE_TO_TND_FAMILY[modeGroup.mode]);
</script>

<section class="mode-explorer">
	<!-- Mode description header -->
	<div class="mode-header">
		<div class="mode-title-row">
			<i class="fas {modeInfo.icon}" style:color={modeColor} aria-hidden="true"></i>
			<h2>{modeGroup.name}</h2>
			<span class="letter-type">{modeGroup.letterType}</span>
		</div>
		<p class="mode-description">{modeInfo.description}</p>
		<div class="tka-mapping">
			<span class="label">TKA Position:</span>
			<span class="value">{modeGroup.tkaPositionDescription}</span>
		</div>
		<div class="tka-mapping">
			<span class="label">TKA Motion:</span>
			<span class="value">{modeGroup.tkaMotionDescription}</span>
		</div>
		{#if modeGroup.hasPositionDependentLetters && modeGroup.positionDependenceNote}
			<div class="position-warning">
				<i class="fas fa-exclamation-triangle" aria-hidden="true"></i>
				{modeGroup.positionDependenceNote}
			</div>
		{/if}
	</div>

	<VtgModeMatrix {familyId} />
</section>

<style>
	.mode-explorer {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	/* Mode header */
	.mode-header {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.mode-title-row {
		display: flex;
		align-items: center;
		gap: 0.625rem;
	}

	.mode-title-row i {
		font-size: 1.25rem;
	}

	h2 {
		margin: 0;
		font-size: 1.25rem;
		font-weight: 600;
		color: var(--theme-text, #fff);
	}

	.letter-type {
		font-size: var(--font-size-compact, 12px);
		font-weight: 500;
		padding: 0.125rem 0.5rem;
		border-radius: 4px;
		background: rgba(255, 255, 255, 0.08);
		color: var(--theme-text-secondary, #888);
	}

	.mode-description {
		margin: 0;
		font-size: var(--font-size-min, 14px);
		color: var(--theme-text-secondary, #888);
	}

	.tka-mapping {
		font-size: var(--font-size-min, 14px);
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.tka-mapping .label {
		font-weight: 600;
		color: var(--theme-text-secondary, #888);
	}

	.tka-mapping .value {
		color: var(--theme-text, #fff);
	}

	.position-warning {
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
		padding: 0.625rem 0.75rem;
		border-radius: 8px;
		background: rgba(245, 158, 11, 0.1);
		border: 1px solid rgba(245, 158, 11, 0.25);
		font-size: var(--font-size-compact, 12px);
		color: #fbbf24;
		line-height: 1.4;
	}

	.position-warning i {
		margin-top: 1px;
		flex-shrink: 0;
	}
</style>
