<!--
  VillageControls — Sidebar control panel for the village simulation.
  Time controls, population stats, and avatar inspector.
-->
<script lang="ts">
	import { getVillageContext, getVillageVisualContext } from "../state/village-context";
	import VillageTimelineStrip from "./VillageTimelineStrip.svelte";
	import { DECAY_GRACE_PERIOD } from "../domain/village-constants";
	import type { VillageEntity } from "../domain/village-types";

	function getAverageStyle(entity: VillageEntity): { amplitudeScale: number; tempoOffset: number } {
		const sequences = [...entity.knowledge.knownSequences.values()];
		if (sequences.length === 0) return { amplitudeScale: 1.0, tempoOffset: 0 };
		let ampSum = 0;
		let tempoSum = 0;
		for (const seq of sequences) {
			ampSum += seq.style.amplitudeScale;
			tempoSum += seq.style.tempoOffset;
		}
		return {
			amplitudeScale: ampSum / sequences.length,
			tempoOffset: tempoSum / sequences.length,
		};
	}

	const villageState = getVillageContext();
	const visualState = getVillageVisualContext();

	const stats = $derived(villageState.stats);
	const isRunning = $derived(villageState.isRunning);
	const speed = $derived(villageState.speed);
	const selectedId = $derived(villageState.selectedAvatarId);

	const selectedEntity = $derived(
		selectedId
			? villageState.orchestrator.inspectAvatar(selectedId)
			: null,
	);

	const monumentCount = $derived(villageState.orchestrator.monuments.length);
	const activeJamCount = $derived(villageState.orchestrator.activeJams.length);
	const relitCount = $derived(
		villageState.orchestrator.monuments.filter(
			(m) => m.extinctAtTick === null && m.cohortsSurvived.size > 3,
		).length,
	);

	const currentTick = $derived(villageState.orchestrator.currentTick);

	// Timeline history tracking
	let knowledgeHistory = $state<number[]>([]);
	let timelineEvents = $state<{ tick: number; type: "extinction" | "invention" | "reincarnation" }[]>([]);
	let lastHistoryTick = 0;

	// Sample knowledge every 10 ticks for the sparkline
	$effect(() => {
		const tick = currentTick;
		if (tick - lastHistoryTick >= 10) {
			lastHistoryTick = tick;
			knowledgeHistory = [...knowledgeHistory.slice(-49), stats.totalKnowledge];
		}
	});

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
		<div class="stat">Monuments: {monumentCount}</div>
		<div class="stat">Active Jams: {activeJamCount}</div>
		<div class="stat">Schools: {villageState.orchestrator.schools?.length ?? 0}</div>
		<div class="stat">Season: {villageState.orchestrator.currentSeason ?? "normal"}</div>
		<div class="stat">Effect Circles: {villageState.orchestrator.effectCircles?.length ?? 0}</div>
		<div class="stat">Dropped Props: {villageState.orchestrator.droppedProps.length}</div>
		<div class="stat">Prop Wall: {villageState.orchestrator.propWall.length}</div>
		{#if relitCount > 0}
			<div class="stat">Recovered: {relitCount}</div>
		{/if}
	</div>

	{#if selectedEntity}
		<div class="section">
			<h3>{selectedEntity.identity.name}</h3>
			<div class="stat">Gen {selectedEntity.identity.generation}</div>
			<div class="stat">Age: {(selectedEntity.lifecycle.currentAge * 100).toFixed(0)}% ({selectedEntity.lifecycle.phase})</div>
			<div class="stat">State: {selectedEntity.social.state}</div>
			<div class="stat">Ego: {selectedEntity.personality.ego.toFixed(2)}</div>
			{#if selectedEntity.knowledge.knownSequences.size > 0}
				{@const avgStyle = getAverageStyle(selectedEntity)}
				<div class="stat">Style Amp: {avgStyle.amplitudeScale.toFixed(2)}</div>
				<div class="stat">Style Tempo: {avgStyle.tempoOffset.toFixed(3)}</div>
			{/if}
			<div class="stat">Effect: {selectedEntity.effect.affinity} ({(selectedEntity.effect.affinityStrength * 100).toFixed(0)}%)</div>
			{#if selectedEntity.prop.heldProp}
				<div class="stat">Prop: {selectedEntity.prop.heldProp.propType}</div>
				<div class="stat">Wear: {(selectedEntity.prop.heldProp.wear * 100).toFixed(0)}%</div>
				<div class="stat">Beats: {selectedEntity.prop.heldProp.totalBeatsPerformed}</div>
				<div class="stat">Owners: {selectedEntity.prop.heldProp.ownershipChain.length}</div>
			{:else}
				<div class="stat">Prop: none (seeking maker)</div>
			{/if}
			<div class="stat">Knows: {selectedEntity.knowledge.knownSequences.size} sequences</div>
			<div class="traits">
				<div>Learn: {selectedEntity.personality.learnSpeed.toFixed(2)}</div>
				<div>Social: {selectedEntity.personality.sociability.toFixed(2)}</div>
				<div>Create: {selectedEntity.personality.creativity.toFixed(2)}</div>
				<div>Patience: {selectedEntity.personality.patience.toFixed(2)}</div>
				<div>Curious: {selectedEntity.personality.curiosity.toFixed(2)}</div>
			</div>

			<!-- Sequence list with decay bars -->
			{#if selectedEntity.knowledge.knownSequences.size > 0}
				<div class="sequence-list">
					{#each [...selectedEntity.knowledge.knownSequences.entries()] as [seqId, seq]}
						<div class="sequence-row">
							<span class="seq-id" title={seqId}>{seqId.slice(0, 12)}</span>
							<span class="seq-prof">{(seq.proficiency * 100).toFixed(0)}%</span>
							<span class="seq-source">({seq.source})</span>
							<div class="decay-bar" title="Time until decay starts">
								<div
									class="decay-fill"
									style="width: {Math.max(0, Math.min(100, ((DECAY_GRACE_PERIOD - (currentTick - seq.lastUsedTick)) / DECAY_GRACE_PERIOD) * 100))}%"
								></div>
							</div>
						</div>
					{/each}
				</div>
			{/if}

			<button
				class="control-btn"
				onclick={() => villageState.selectAvatar(null)}
			>
				Deselect
			</button>
		</div>
	{/if}

	<!-- Toggles -->
	<div class="section">
		<h3>Display</h3>
		<label class="toggle">
			<input type="checkbox" checked={visualState.showToasts} onchange={(e) => visualState.setShowToasts(e.currentTarget.checked)} />
			Show toasts
		</label>
		<label class="toggle">
			<input type="checkbox" checked={visualState.showMonuments} onchange={(e) => visualState.setShowMonuments(e.currentTarget.checked)} />
			Show monuments
		</label>
		<label class="toggle">
			<input type="checkbox" checked={visualState.showCircleRings} onchange={(e) => visualState.setShowCircleRings(e.currentTarget.checked)} />
			Show circle rings
		</label>
		<label class="toggle">
			<input type="checkbox" checked={visualState.showReincarnationGlow} onchange={(e) => visualState.setShowReincarnationGlow(e.currentTarget.checked)} />
			Show reincarnation glow
		</label>
		<label class="toggle">
			<input type="checkbox" checked={visualState.showSchoolTints} onchange={(e) => visualState.setShowSchoolTints(e.currentTarget.checked)} />
			Show school tints
		</label>
	</div>

	<!-- LLM Decision Engine -->
	<div class="section">
		<h3>AI Decisions</h3>
		<label class="toggle">
			<input
				type="checkbox"
				checked={villageState.orchestrator.decisionEngine.enabled}
				onchange={(e) => villageState.orchestrator.decisionEngine.setEnabled(e.currentTarget.checked)}
			/>
			Enable LLM
		</label>
		<div class="stat">
			Provider: {villageState.orchestrator.decisionEngine.providerName}
			{#if villageState.orchestrator.decisionEngine.isLLMActive()}
				<span style="color: #4ade80;">connected</span>
			{/if}
		</div>
		<div class="stat">
			Pending: {villageState.orchestrator.decisionEngine.pendingDecisions.size}
		</div>
		{#if villageState.orchestrator.decisionEngine.debugLog.length > 0}
			<div class="llm-log">
				{#each villageState.orchestrator.decisionEngine.debugLog.slice(-8) as line}
					<div class="log-line">{line}</div>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Timeline strip -->
	<div class="section">
		<h3>Timeline</h3>
		<VillageTimelineStrip {knowledgeHistory} events={timelineEvents} />
	</div>
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

	.sequence-list {
		display: flex;
		flex-direction: column;
		gap: 3px;
		margin-top: 4px;
	}

	.sequence-row {
		display: flex;
		align-items: center;
		gap: 4px;
		font-size: 11px;
		opacity: 0.8;
	}

	.seq-id {
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.seq-prof {
		min-width: 32px;
		text-align: right;
	}

	.seq-source {
		opacity: 0.5;
		font-size: 10px;
	}

	.decay-bar {
		width: 40px;
		height: 4px;
		background: rgba(255, 255, 255, 0.1);
		border-radius: 2px;
		overflow: hidden;
	}

	.decay-fill {
		height: 100%;
		background: #4ade80;
		border-radius: 2px;
		transition: width 0.3s ease;
	}

	.toggle {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: var(--font-size-compact, 12px);
		opacity: 0.8;
		cursor: pointer;
	}

	.toggle input {
		cursor: pointer;
	}

	.llm-log {
		margin-top: 4px;
		max-height: 120px;
		overflow-y: auto;
		scrollbar-width: thin;
	}

	.log-line {
		font-size: 10px;
		font-family: monospace;
		opacity: 0.6;
		line-height: 1.3;
		word-break: break-all;
	}
</style>
