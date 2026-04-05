<!--
  VillageControls — Sidebar control panel for the village simulation.
  Time controls, population stats, and avatar inspector.
-->
<script lang="ts">
	import { getVillageContext } from "../state/village-context";

	const villageState = getVillageContext();

	const stats = $derived(villageState.stats);
	const isRunning = $derived(villageState.isRunning);
	const speed = $derived(villageState.speed);
	const selectedId = $derived(villageState.selectedAvatarId);

	const selectedEntity = $derived(
		selectedId
			? villageState.orchestrator.inspectAvatar(selectedId)
			: null,
	);

	const speedOptions = [0.5, 1, 2, 5, 10, 50];
</script>

<div class="controls">
	<div class="section">
		<h3>Time</h3>
		<div class="row">
			<button class="control-btn" onclick={() => villageState.togglePlay()}>
				{isRunning ? "Pause" : "Play"}
			</button>
			<button class="control-btn" onclick={() => villageState.reset()}>
				Reset
			</button>
		</div>
		<span class="label">Speed</span>
		<div class="speed-buttons">
			{#each speedOptions as s}
				<button
					class="speed-btn"
					class:active={speed === s}
					onclick={() => villageState.setSpeed(s)}
				>
					{s}x
				</button>
			{/each}
		</div>
		<div class="stat">
			Tick: {villageState.orchestrator.currentTick}
		</div>
		<div class="stat">
			Gen: {stats.currentGeneration}
		</div>
	</div>

	<div class="section">
		<h3>Population</h3>
		<div class="stat">Alive: {stats.alive}</div>
		<div class="stat">Avg Age: {(stats.averageAge * 100).toFixed(0)}%</div>
		<div class="stat">Total Knowledge: {stats.totalKnowledge}</div>
		<div class="stat">Unique Sequences: {stats.uniqueSequences}</div>
		<div class="stat">Extinct: {stats.extinctionCount}</div>
	</div>

	{#if selectedEntity}
		<div class="section">
			<h3>{selectedEntity.identity.name}</h3>
			<div class="stat">Gen {selectedEntity.identity.generation}</div>
			<div class="stat">Age: {(selectedEntity.lifecycle.currentAge * 100).toFixed(0)}% ({selectedEntity.lifecycle.phase})</div>
			<div class="stat">State: {selectedEntity.social.state}</div>
			<div class="stat">Knows: {selectedEntity.knowledge.knownSequences.size} sequences</div>
			<div class="traits">
				<div>Learn: {selectedEntity.personality.learnSpeed.toFixed(2)}</div>
				<div>Social: {selectedEntity.personality.sociability.toFixed(2)}</div>
				<div>Create: {selectedEntity.personality.creativity.toFixed(2)}</div>
				<div>Patience: {selectedEntity.personality.patience.toFixed(2)}</div>
				<div>Curious: {selectedEntity.personality.curiosity.toFixed(2)}</div>
			</div>
			<button
				class="control-btn"
				onclick={() => villageState.selectAvatar(null)}
			>
				Deselect
			</button>
		</div>
	{/if}
</div>

<style>
	.controls {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 12px;
		background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
		border-left: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
		overflow-y: auto;
		width: 250px;
		min-width: 250px;
		font-size: var(--font-size-min, 14px);
		color: var(--theme-text, #fff);
	}

	.section {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	h3 {
		margin: 0;
		font-size: var(--font-size-min, 14px);
		color: #e8a87c;
		border-bottom: 1px solid rgba(232, 168, 124, 0.2);
		padding-bottom: 4px;
	}

	.row {
		display: flex;
		gap: 6px;
		align-items: center;
		flex-wrap: wrap;
	}

	.label {
		font-size: var(--font-size-compact, 12px);
		opacity: 0.7;
	}

	.stat {
		font-size: var(--font-size-compact, 12px);
		opacity: 0.8;
	}

	.traits {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 2px;
		font-size: var(--font-size-compact, 12px);
		opacity: 0.7;
	}

	.control-btn {
		padding: 4px 10px;
		border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
		color: var(--theme-text, #fff);
		border-radius: 4px;
		cursor: pointer;
		font-size: var(--font-size-compact, 12px);
	}

	.control-btn:hover {
		border-color: #e8a87c;
	}

	.speed-buttons {
		display: flex;
		gap: 3px;
		flex-wrap: wrap;
	}

	.speed-btn {
		padding: 2px 6px;
		border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
		background: transparent;
		color: var(--theme-text, #fff);
		border-radius: 3px;
		cursor: pointer;
		font-size: 11px;
	}

	.speed-btn.active {
		background: rgba(232, 168, 124, 0.2);
		border-color: #e8a87c;
	}
</style>
