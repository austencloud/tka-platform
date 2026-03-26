<script lang="ts">
	/**
	 * Fuse Shuffle Card
	 *
	 * Loads full sequences and displays one prop at a time using
	 * existing ChoreoCard with browseViewMode filtering.
	 * User shuffles until they find a prop path they like.
	 */

	import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
	import type { IBrowseLoader } from "$lib/features/browse/sequences/display/services/contracts/IBrowseLoader";
	import type { BrowseViewMode } from "$lib/features/browse/shared/domain/BrowseViewMode";
	import ChoreoCard from "$lib/shared/sequence-viewer/components/ChoreoCard.svelte";
	import { container } from "$lib/shared/di";
	import { getSettings } from "$lib/shared/application/state/app-state.svelte";
	import { getFuseContext } from "../context/fuse-context";

	const { state: fuseState } = getFuseContext();

	let {
		side,
		length = 8,
		onSelect,
		picked = false,
	}: {
		side: "left" | "right";
		length?: number;
		onSelect: (seq: SequenceData) => void;
		picked?: boolean;
	} = $props();

	const propColor = $derived<"blue" | "red">(side === "left" ? "blue" : "red");

	// Build the view mode for single-prop rendering (always solo props)
	const viewMode = $derived<BrowseViewMode>({
		subject: "props",
		granularity: "solo",
		color: propColor,
	});

	const highlightedStep = $derived.by(() => {
		if (!currentItem?.steps?.length) return null;
		const stepCount = currentItem.steps.length;
		return Math.floor(fuseState.currentBeat) % stepCount;
	});

	let pool = $state<SequenceData[]>([]);
	let currentItem = $state<SequenceData | null>(null);
	let loading = $state(true);
	let poolIndex = $state(0);

	const browseLoader: IBrowseLoader = container.items.browseLoader;

	async function loadPool() {
		loading = true;
		try {
			const allSequences = await browseLoader.loadSequenceMetadata();

			let filtered = allSequences;
			if (length > 0) {
				filtered = allSequences.filter((s: SequenceData) => {
					const seqLen = s.sequenceLength ?? s.steps?.length ?? 0;
					return seqLen === length;
				});
				if (filtered.length === 0) filtered = allSequences;
			}

			// Shuffle
			for (let i = filtered.length - 1; i > 0; i--) {
				const j = Math.floor(Math.random() * (i + 1));
				[filtered[i], filtered[j]] = [filtered[j]!, filtered[i]!];
			}

			pool = filtered;
			poolIndex = 0;
			currentItem = pool[0] ?? null;
			if (pool.length > 0) {
				fuseState.startClock();
			}

			// Pre-load full step data for the first item
			if (currentItem) {
				loadFullData(currentItem);
			}
		} catch (err) {
			console.error("Failed to load sequences for fuse shuffle:", err);
			pool = [];
			currentItem = null;
		} finally {
			loading = false;
		}
	}

	async function loadFullData(item: SequenceData) {
		if (item.steps && item.steps.length > 0) return;
		try {
			const full = await browseLoader.loadFullSequenceData(
				item.word || item.name,
				item.id
			);
			if (full) {
				// Replace in pool
				const idx = pool.indexOf(item);
				if (idx >= 0) pool[idx] = full;
				if (currentItem === item) currentItem = full;
			}
		} catch {
			// Keep metadata-only version
		}
	}

	function shuffle() {
		if (pool.length === 0) return;
		poolIndex = (poolIndex + 1) % pool.length;
		currentItem = pool[poolIndex] ?? null;
		if (currentItem) loadFullData(currentItem);
	}

	function handlePick() {
		if (currentItem) onSelect(currentItem);
	}

	$effect(() => {
		void length;
		loadPool();
	});
</script>

<div class="shuffle-card">
	{#if loading}
		<div class="state-msg">
			<i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
			<span>Loading...</span>
		</div>
	{:else if !currentItem}
		<div class="state-msg">
			<span>No sequences found for this length.</span>
			<span class="hint">Try a different beat count.</span>
		</div>
	{:else}
		<div class="card-display">
			{#key currentItem.id ?? poolIndex}
				{#if currentItem.steps && currentItem.steps.length > 0}
					<div class="choreo-card-wrap">
						<ChoreoCard
							sequence={currentItem}
							browseViewMode={viewMode}
							showWord={false}
							showStepNumbers={true}
							showDifficultyLevel={false}
							showCreatorName={false}
							showNotes={false}
							showBirthday={false}
							showLoopGlyph={false}
							darkMode={true}
							bluePropType={getSettings().bluePropType}
							redPropType={getSettings().redPropType}
							highlightedStepIndex={highlightedStep}
							showHighlight={highlightedStep !== null}
						/>
					</div>
				{:else}
					<div class="loading-steps">
						<i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
						<span>Loading steps...</span>
					</div>
				{/if}
			{/key}

			<div class="card-info-row">
				<span class="card-word">
					{propColor === "blue" ? "Blue" : "Red"} Prop
				</span>
				<span class="card-counter">{poolIndex + 1} / {pool.length}</span>
			</div>
		</div>

		<div class="card-actions">
			{#if picked}
				<button
					class="picked-btn"
					disabled
					aria-label="Already picked"
				>
					<i class="fas fa-check-circle" aria-hidden="true"></i>
					Picked
				</button>
			{:else}
				<button
					class="shuffle-btn"
					onclick={shuffle}
					aria-label="Shuffle to next"
					disabled={pool.length <= 1}
				>
					<i class="fas fa-shuffle" aria-hidden="true"></i>
					Shuffle
				</button>

				<button
					class="select-btn"
					onclick={handlePick}
					aria-label="Pick this {propColor} prop path"
				>
					<i class="fas fa-check" aria-hidden="true"></i>
					Pick
				</button>
			{/if}
		</div>
	{/if}
</div>

<style>
	.shuffle-card {
		display: flex;
		flex-direction: column;
		height: 100%;
		padding: var(--spacing-sm, 8px);
		gap: var(--spacing-sm, 8px);
	}

	.card-display {
		flex: 1;
		display: flex;
		flex-direction: column;
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
		border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
		border-radius: var(--radius-md, 12px);
		overflow: hidden;
		min-height: 120px;
	}

	.choreo-card-wrap {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		padding: var(--spacing-xs, 4px);
	}

	.loading-steps {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 8px;
		color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
		font-size: var(--font-size-sm, 14px);
	}

	.card-info-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--spacing-xs, 4px) var(--spacing-sm, 8px);
		border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
		flex-shrink: 0;
	}

	.card-word {
		font-size: var(--font-size-compact, 12px);
		font-weight: 600;
		color: var(--theme-text, #ffffff);
		letter-spacing: 0.05em;
	}

	.card-counter {
		font-size: 11px;
		color: var(--theme-text-dim, rgba(255, 255, 255, 0.35));
	}

	.card-actions {
		display: flex;
		gap: var(--spacing-sm, 8px);
		flex-shrink: 0;
	}

	.shuffle-btn,
	.select-btn {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--spacing-xs, 4px);
		padding: 10px 16px;
		border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
		border-radius: var(--radius-md, 8px);
		font-size: var(--font-size-min, 14px);
		font-weight: 500;
		cursor: pointer;
		min-height: 48px;
		transition: border-color 150ms ease, background 150ms ease;
	}

	.shuffle-btn {
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
		color: var(--theme-text, #ffffff);
	}

	.shuffle-btn:hover:not(:disabled) {
		border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
		background: rgba(255, 255, 255, 0.06);
	}

	.shuffle-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.select-btn {
		background: linear-gradient(135deg, #fb923c 0%, #f97316 50%, #ea580c 100%);
		color: #ffffff;
		border-color: transparent;
	}

	.select-btn:hover {
		filter: brightness(1.1);
	}

	.picked-btn {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--spacing-xs, 4px);
		padding: 10px 16px;
		border: 1.5px solid rgba(34, 197, 94, 0.4);
		border-radius: var(--radius-md, 8px);
		font-size: var(--font-size-min, 14px);
		font-weight: 600;
		cursor: default;
		min-height: 48px;
		background: rgba(34, 197, 94, 0.15);
		color: rgb(134, 239, 172);
	}

	.state-msg {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 8px;
		color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
		font-size: var(--font-size-sm, 14px);
		text-align: center;
	}

	.hint {
		font-size: var(--font-size-compact, 12px);
	}

	@media (prefers-reduced-motion: reduce) {
		.shuffle-btn,
		.select-btn {
			transition: none;
		}
	}
</style>
