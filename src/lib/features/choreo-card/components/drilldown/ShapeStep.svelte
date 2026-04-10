<script lang="ts">
	import type { Deck } from '../../domain/models/Deck';
	import type { ShapeSelections } from '../../state/deck-drilldown-types';
	import DrillPill from './DrillPill.svelte';
	import GridModeCard from './GridModeCard.svelte';

	interface Props {
		decks: Deck[];
		onContinue: (shape: ShapeSelections) => void;
	}

	let { decks, onContinue }: Props = $props();

	const LOOP_TYPE_ORDER = ['Rotated', 'Mirrored', 'Swapped', 'Inverted', 'Rewound'] as const;
	const SLICE_OPTIONS = ['Halved', 'Quartered'] as const;
	const GRID_OPTIONS = ['Diamond', 'Box'] as const;

	let availableLoopTypes = $derived(
		LOOP_TYPE_ORDER.filter((lt) =>
			decks.some((d) => d.loopType?.toLowerCase() === lt.toLowerCase())
		)
	);

	let availableGridModes = $derived(
		GRID_OPTIONS.filter((g) =>
			decks.some((d) => d.gridMode.toLowerCase() === g.toLowerCase())
		)
	);

	// Selection state
	let selectedLoopTypes = $state<string[]>([]);
	let selectedSlice = $state<string>('');
	let selectedGrid = $state<string>('');

	// Initialize selections when available values resolve
	$effect(() => {
		if (selectedLoopTypes.length === 0 && availableLoopTypes.length > 0) {
			selectedLoopTypes = [availableLoopTypes[0]!];
		}
	});

	$effect(() => {
		if (!selectedSlice && SLICE_OPTIONS.length > 0) {
			selectedSlice = 'Halved';
		}
	});

	$effect(() => {
		if (!selectedGrid && availableGridModes.length > 0) {
			selectedGrid = availableGridModes[0]!;
		}
	});

	// Quartered is only available when Rotated is selected
	let rotatedSelected = $derived(
		selectedLoopTypes.some((lt) => lt.toLowerCase() === 'rotated')
	);

	let quarteredLocked = $derived(!rotatedSelected);

	// Force Halved when Quartered becomes locked
	$effect(() => {
		if (quarteredLocked && selectedSlice === 'Quartered') {
			selectedSlice = 'Halved';
		}
	});

	function toggleLoopType(lt: string): void {
		const idx = selectedLoopTypes.indexOf(lt);
		if (idx >= 0) {
			// Don't allow deselecting the last one
			if (selectedLoopTypes.length > 1) {
				selectedLoopTypes = selectedLoopTypes.filter((_, i) => i !== idx);
			}
		} else {
			selectedLoopTypes = [...selectedLoopTypes, lt];
		}
	}

	function selectSlice(s: string): void {
		if (s === 'Quartered' && quarteredLocked) return;
		selectedSlice = s;
	}

	function selectGrid(g: string): void {
		selectedGrid = g;
	}

	function handleContinue(): void {
		onContinue({
			loopTypes: selectedLoopTypes.map((lt) => lt.toLowerCase()),
			sliceType: selectedSlice.toLowerCase() as 'halved' | 'quartered',
			gridMode: selectedGrid.toLowerCase()
		});
	}
</script>

<div class="shape-step" style="--accent: #63b7cd; --accent-rgb: 99,183,205;">
	<!-- Loop Type group -->
	<div class="pill-group">
		<span class="group-label">LOOP TYPE (multi-select)</span>
		<div class="pill-row">
			{#each availableLoopTypes as lt}
				<DrillPill
					label={lt}
					selected={selectedLoopTypes.includes(lt)}
					onClick={() => toggleLoopType(lt)}
				/>
			{/each}
		</div>
	</div>

	<!-- Slice group -->
	<div class="pill-group">
		<span class="group-label">SLICE</span>
		<div class="pill-row">
			{#each SLICE_OPTIONS as s}
				<DrillPill
					label={s}
					selected={selectedSlice === s}
					locked={s === 'Quartered' && quarteredLocked}
					onClick={() => selectSlice(s)}
				/>
			{/each}
		</div>
	</div>

	<!-- Grid group -->
	{#if availableGridModes.length > 0}
		<div class="pill-group">
			<span class="group-label">GRID</span>
			<div class="grid-mode-row">
				{#each availableGridModes as g}
					<GridModeCard
						mode={g.toLowerCase() as 'diamond' | 'box'}
						selected={selectedGrid === g}
						onClick={() => selectGrid(g)}
					/>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Continue button -->
	<button class="continue-btn" onclick={handleContinue}>
		Continue
	</button>
</div>

<style>
	.shape-step {
		width: 100%;
		max-width: 700px;
		display: flex;
		flex-direction: column;
		gap: 36px;
		align-items: center;
		padding: 32px 16px;
	}

	.pill-group {
		display: flex;
		flex-direction: column;
		align-items: center;
		width: 100%;
	}

	.group-label {
		font-size: 10px;
		text-transform: uppercase;
		letter-spacing: 2.5px;
		color: rgba(255, 255, 255, 0.25);
		margin-bottom: 14px;
	}

	.pill-row {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 10px;
	}

	.grid-mode-row {
		display: flex;
		justify-content: center;
		gap: 16px;
	}

	.continue-btn {
		padding: 13px 44px;
		border-radius: 12px;
		border: 1.5px solid rgba(var(--accent-rgb), 0.25);
		background: rgba(var(--accent-rgb), 0.06);
		color: var(--accent);
		font-family: inherit;
		font-size: var(--font-size-min, 14px);
		font-weight: 600;
		cursor: pointer;
		transition: all 0.18s ease;
	}

	.continue-btn:hover {
		border-color: rgba(var(--accent-rgb), 0.45);
		background: rgba(var(--accent-rgb), 0.12);
	}

	.continue-btn:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	@media (prefers-reduced-motion: reduce) {
		.continue-btn {
			transition: none;
		}
	}
</style>
