<!--
  VillageLabTab — Lab tab root for the TKA Village cultural simulation.
  Mounts Threlte canvas with village scene + control panel sidebar.
-->
<script lang="ts">
	import { onDestroy } from "svelte";
	import { Canvas } from "@threlte/core";
	import { container } from "$lib/shared/di";
	import VillageScene from "./components/VillageScene.svelte";
	import VillageControls from "./components/VillageControls.svelte";
	import { createVillageState, type VillageState } from "./state/village-state.svelte";
	import { setVillageContext } from "./state/village-context";
	import {
		MUSEUM_EXHIBIT_SEQUENCES,
	} from "$lib/features/museum/data/museum-exhibit-sequences";
	import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
	import type { StepData } from "$lib/features/create/shared/domain/models/StepData";

	// Build seed sequences from museum exhibits (first 3)
	function buildSeedSequences(): SequenceData[] {
		const entries = Object.entries(MUSEUM_EXHIBIT_SEQUENCES).slice(0, 3);
		return entries.map(([id, museumSeq]) => ({
			id: `village-seed-${id}`,
			word: museumSeq.word,
			steps: museumSeq.steps as readonly StepData[],
			isCircular: true,
		} as SequenceData));
	}

	const propInterpolator = container.items.propStateInterpolator;
	const sequenceConverter = container.items.sequenceConverter;

	// Create state synchronously during component init — required for setContext
	let villageState: VillageState | null = null;
	if (propInterpolator && sequenceConverter) {
		const seeds = buildSeedSequences();
		villageState = createVillageState(
			{ propInterpolator, sequenceConverter },
			seeds,
			{ targetPopulation: 6 },
		);
		setVillageContext(villageState);
	}

	onDestroy(() => {
		villageState?.destroy();
	});
</script>

{#if villageState}
	<div class="village-lab">
		<div class="viewport">
			<Canvas>
				<VillageScene />
			</Canvas>
		</div>
		<VillageControls />
	</div>
{:else}
	<div class="village-loading">
		<p>3D services not available</p>
	</div>
{/if}

<style>
	.village-lab {
		display: flex;
		height: 100%;
		width: 100%;
		overflow: hidden;
	}

	.viewport {
		flex: 1;
		position: relative;
		min-height: 0;
	}

	.village-loading {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100%;
		color: var(--theme-text, #fff);
		font-size: var(--font-size-min, 14px);
	}
</style>
