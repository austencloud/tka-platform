<script lang="ts">
	/**
	 * ModeExplorer - displays all VTG patterns for a selected mode
	 * as 4-step sequence strips, grouped by rotation style.
	 */

	import { VTG_MODE_INFO } from "$lib/features/learn/domain/constants/vtg-experience-data";
	import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
	import { getSettings } from "$lib/shared/application/state/app-state.svelte";
	import type { VtgModeGroup } from "../domain/vtg-lab-types";
	import { getModeChains, expandChain, type ChainDef } from "../domain/vtg-sequence-data";
	import SequenceStrip from "./SequenceStrip.svelte";

	interface Props {
		modeGroup: VtgModeGroup;
	}

	const { modeGroup }: Props = $props();

	const modeInfo = $derived(VTG_MODE_INFO[modeGroup.mode]);
	const modeColor = $derived(modeInfo.color);
	const chains = $derived(getModeChains(modeGroup.mode));

	const bluePropType = $derived.by(() => {
		const settings = getSettings();
		return (settings.bluePropType ?? settings.propType ?? PropType.STAFF) as PropType;
	});

	const redPropType = $derived.by(() => {
		const settings = getSettings();
		return (settings.redPropType ?? settings.propType ?? PropType.STAFF) as PropType;
	});

	/** Group chains by rotation style for display */
	const groupedChains = $derived.by(() => {
		const groups: { style: string; label: string; chains: ChainDef[] }[] = [];
		const styleOrder = ["pro/pro", "anti/anti", "hybrid"] as const;
		const labels: Record<string, string> = {
			"pro/pro": "Pro / Pro (Isolation)",
			"anti/anti": "Anti / Anti (Antispin)",
			hybrid: "Hybrid",
		};

		for (const style of styleOrder) {
			const matching = chains.filter((c) => c.rotationStyle === style);
			if (matching.length > 0) {
				groups.push({ style, label: labels[style] ?? style, chains: matching });
			}
		}

		return groups;
	});
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

	<!-- Sequence strips grouped by rotation style -->
	{#each groupedChains as group (group.style)}
		<div class="rotation-group">
			<h3 class="rotation-label">{group.label}</h3>
			<div class="strips-stack">
				{#each group.chains as chain (chain.label)}
					<SequenceStrip
						beats={expandChain(chain, bluePropType, redPropType)}
						label={chain.label}
						mnemonic={chain.mnemonic}
						rotationStyle={chain.rotationStyle}
						{modeColor}
					/>
				{/each}
			</div>
		</div>
	{/each}
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

	/* Rotation groups */
	.rotation-group {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.rotation-label {
		margin: 0;
		font-size: var(--font-size-min, 14px);
		font-weight: 600;
		color: var(--theme-text-secondary, #888);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.strips-stack {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
</style>
