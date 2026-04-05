<script lang="ts">
	import type { CategorySelections } from '../../state/deck-drilldown-types';
	import { VTG_ELEMENTAL_THEMES } from '../../domain/elemental-theme';
	import ElementalFamilyCard from './ElementalFamilyCard.svelte';
	import GridModeCard from './GridModeCard.svelte';

	interface Props {
		onContinue: (category: CategorySelections) => void;
	}

	let { onContinue }: Props = $props();

	const FAMILY_LABELS: Record<string, string> = {
		'split-same': 'Split-Same',
		'tog-same': 'Tog-Same',
		'quarter-same': 'Quarter-Same',
		'split-opp': 'Split-Opp',
		'tog-opp': 'Tog-Opp',
		'quarter-opp': 'Quarter-Opp'
	};

	const GRID_OPTIONS = ['Diamond', 'Box'] as const;

	const sameFamilies = VTG_ELEMENTAL_THEMES.filter((t) =>
		t.familyId.endsWith('-same')
	);
	const oppFamilies = VTG_ELEMENTAL_THEMES.filter((t) =>
		t.familyId.endsWith('-opp')
	);

	let selectedFamily = $state<string>('');
	let selectedGrid = $state<string>('Diamond');

	function selectFamily(familyId: string): void {
		selectedFamily = familyId;
	}

	function selectGrid(g: string): void {
		selectedGrid = g;
	}

	let canContinue = $derived(selectedFamily !== '' && selectedGrid !== '');

	function handleContinue(): void {
		if (!canContinue) return;
		onContinue({
			vtgFamily: selectedFamily,
			gridMode: selectedGrid.toLowerCase()
		});
	}
</script>

<div class="category-step" style="--accent: #b763cd; --accent-rgb: 183,99,205;">
	<h2 class="step-title">Choose a category</h2>

	<!-- VTG Family section -->
	<div class="section">
		<span class="section-label">VTG FAMILY</span>

		<span class="direction-label">Same Direction</span>
		<div class="elemental-grid">
			{#each sameFamilies as theme, i}
				<div style="animation-delay: {i * 50}ms;">
					<ElementalFamilyCard
						familyId={theme.familyId}
						familyLabel={FAMILY_LABELS[theme.familyId] ?? theme.familyId}
						element={theme.element}
						accentColor={theme.accentColor}
						selected={selectedFamily === theme.familyId}
						onClick={() => selectFamily(theme.familyId)}
					/>
				</div>
			{/each}
		</div>

		<span class="direction-label">Opposite Direction</span>
		<div class="elemental-grid">
			{#each oppFamilies as theme, i}
				<div style="animation-delay: {(i + 3) * 50}ms;">
					<ElementalFamilyCard
						familyId={theme.familyId}
						familyLabel={FAMILY_LABELS[theme.familyId] ?? theme.familyId}
						element={theme.element}
						accentColor={theme.accentColor}
						selected={selectedFamily === theme.familyId}
						onClick={() => selectFamily(theme.familyId)}
					/>
				</div>
			{/each}
		</div>
	</div>

	<!-- Grid section -->
	<div class="section">
		<span class="section-label">GRID</span>
		<div class="grid-mode-row">
			<GridModeCard mode="diamond" selected={selectedGrid === 'Diamond'} onClick={() => selectGrid('Diamond')} />
			<GridModeCard mode="box" selected={selectedGrid === 'Box'} onClick={() => selectGrid('Box')} />
		</div>
	</div>

	<!-- Continue button -->
	<button
		class="continue-btn"
		class:disabled={!canContinue}
		disabled={!canContinue}
		onclick={handleContinue}
	>
		Continue
	</button>
</div>

<style>
	.category-step {
		width: 100%;
		max-width: 960px;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: 32px;
		align-items: center;
		padding: 32px 16px;
	}

	.step-title {
		font-size: 1.3rem;
		font-weight: 700;
		color: var(--theme-text, #ffffff);
		margin: 0;
	}

	.section {
		display: flex;
		flex-direction: column;
		align-items: center;
		width: 100%;
	}

	.section-label {
		font-size: 10px;
		text-transform: uppercase;
		letter-spacing: 2.5px;
		color: rgba(255, 255, 255, 0.25);
		margin-bottom: 18px;
	}

	.direction-label {
		font-size: 9px;
		text-transform: uppercase;
		letter-spacing: 2.5px;
		color: rgba(255, 255, 255, 0.12);
		margin-bottom: 10px;
	}

	.elemental-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		grid-auto-rows: 1fr;
		gap: 14px;
		width: 100%;
		max-width: 900px;
		margin-bottom: 22px;
	}

	/* Ensure cards stretch to fill grid row height */
	/* Wrapper divs and cards must stretch to fill grid cells */
	.elemental-grid > :global(div) {
		display: flex;
	}

	.elemental-grid > :global(div > .elemental-card) {
		flex: 1;
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

	.continue-btn:hover:not(:disabled) {
		border-color: rgba(var(--accent-rgb), 0.45);
		background: rgba(var(--accent-rgb), 0.12);
	}

	.continue-btn:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	.continue-btn.disabled {
		opacity: 0.35;
		cursor: default;
	}

	@media (prefers-reduced-motion: reduce) {
		.continue-btn {
			transition: none;
		}
	}
</style>
