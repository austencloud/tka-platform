<script lang="ts">
	import type { DrillPath } from '../../state/deck-drilldown-types';
	import TurnPatternCard from './TurnPatternCard.svelte';

	interface Props {
		stepCount: number;
		path: DrillPath;
		onSelectPattern: (pattern: string) => void;
		onSelectUniform: () => void;
	}

	let { stepCount, path, onSelectPattern, onSelectUniform }: Props = $props();

	const showComplex = $derived(stepCount >= 8);

	// -- Simple tier ----------------------------------------------------------

	const uniformEntries = [
		{ blue: 1, red: 1 },
		{ blue: 1, red: 1 },
		{ blue: 1, red: 1 },
		{ blue: 1, red: 1 },
	];

	const alternatingEntries = [
		{ blue: 0, red: 0 },
		{ blue: 1, red: 1 },
		{ blue: 0, red: 0 },
		{ blue: 1, red: 1 },
	];

	// -- Medium tier ----------------------------------------------------------

	const altOppositionEntries = [
		{ blue: 0, red: 1 },
		{ blue: 1, red: 0 },
		{ blue: 0, red: 1 },
		{ blue: 1, red: 0 },
	];

	const blueLeadsEntries = [
		{ blue: 2, red: 1 },
		{ blue: 2, red: 1 },
		{ blue: 2, red: 1 },
		{ blue: 2, red: 1 },
	];

	const redLeadsEntries = [
		{ blue: 1, red: 2 },
		{ blue: 1, red: 2 },
		{ blue: 1, red: 2 },
		{ blue: 1, red: 2 },
	];

	// -- Complex tier ---------------------------------------------------------

	const pyramidEntries = [
		{ blue: 0, red: 0 },
		{ blue: 1, red: 1 },
		{ blue: 2, red: 2 },
		{ blue: 3, red: 3 },
		{ blue: 3, red: 3 },
		{ blue: 2, red: 2 },
		{ blue: 1, red: 1 },
		{ blue: 0, red: 0 },
	];

	const contrastEntries = [
		{ blue: 3, red: 0 },
		{ blue: 0, red: 3 },
		{ blue: 3, red: 0 },
		{ blue: 0, red: 3 },
		{ blue: 3, red: 0 },
		{ blue: 0, red: 3 },
		{ blue: 3, red: 0 },
		{ blue: 0, red: 3 },
	];

	const floatWaveEntries = [
		{ blue: 1, red: 1 },
		{ blue: 2, red: 2 },
		{ blue: 0, red: 0 },
		{ blue: 0, red: 0 },
		{ blue: 0, red: 0 },
		{ blue: 0, red: 0 },
		{ blue: 2, red: 2 },
		{ blue: 1, red: 1 },
	];
</script>

<div class="turn-pattern-step" style="--accent-rgb: 99,183,205;">
	<h2 class="step-title">Choose a turn pattern</h2>

	<!-- Simple tier -->
	<div class="tier">
		<div class="tier-header">
			<span class="tier-name">Simple</span>
			<span class="tier-line"></span>
		</div>
		<div class="card-grid">
			<TurnPatternCard
				name="Uniform"
				description="Same turn value on both hands, every step. Pick a specific value."
				entries={uniformEntries}
				meta="0T through 3T &middot; 7 variations &rarr;"
				onClick={onSelectUniform}
			/>
			<TurnPatternCard
				name="Alternating"
				description="Both hands alternate 0T and 1T each step. Symmetric."
				entries={alternatingEntries}
				meta="0T, 1T, 0T, 1T"
				onClick={() => onSelectPattern('Alternating')}
			/>
		</div>
	</div>

	<!-- Medium tier -->
	<div class="tier">
		<div class="tier-header">
			<span class="tier-name">Medium</span>
			<span class="tier-line"></span>
		</div>
		<div class="card-grid">
			<TurnPatternCard
				name="Alt. Opposition"
				description="When blue is 0T, red is 1T and vice versa. Hands swap each step."
				entries={altOppositionEntries}
				meta="B:0T R:1T, B:1T R:0T"
				onClick={() => onSelectPattern('Alternating Opposition')}
			/>
			<TurnPatternCard
				name="Blue Leads"
				description="Blue 2T every step, red 1T every step. Blue always double."
				entries={blueLeadsEntries}
				meta="B:2T R:1T every step"
				onClick={() => onSelectPattern('Blue Leads')}
			/>
			<TurnPatternCard
				name="Red Leads"
				description="Red 2T every step, blue 1T every step. Red always double."
				entries={redLeadsEntries}
				meta="B:1T R:2T every step"
				onClick={() => onSelectPattern('Red Leads')}
			/>
		</div>
	</div>

	<!-- Complex tier (only for stepCount >= 8) -->
	{#if showComplex}
		<div class="tier">
			<div class="tier-header">
				<span class="tier-name">Complex</span>
				<span class="tier-line"></span>
			</div>
			<div class="card-grid">
				<TurnPatternCard
					name="Pyramid"
					description="Both hands ramp 0T→1T→2T→3T then back down."
					entries={pyramidEntries}
					meta="0T, 1T, 2T, 3T, 3T, 2T, 1T, 0T"
					onClick={() => onSelectPattern('Pyramid')}
				/>
				<TurnPatternCard
					name="Contrast"
					description="Blue 3T when red is 0T and vice versa. Maximum opposition."
					entries={contrastEntries}
					meta="B:3T R:0T alternating"
					onClick={() => onSelectPattern('Contrast')}
				/>
				<TurnPatternCard
					name="Float Wave"
					description="1T, 2T, then float for 4 steps, then 2T, 1T. Purple = float."
					entries={floatWaveEntries}
					meta="1T, 2T, fl, fl, fl, fl, 2T, 1T"
					onClick={() => onSelectPattern('Float Wave')}
				/>
			</div>
		</div>
	{/if}

	<!-- My Patterns tier -->
	<div class="tier">
		<div class="tier-header">
			<span class="tier-name">My Patterns</span>
			<span class="tier-line"></span>
		</div>
		<p class="empty-hint">Save a custom turn pattern in Create to use it here.</p>
	</div>
</div>

<style>
	.turn-pattern-step {
		width: 100%;
		max-width: 880px;
		display: flex;
		flex-direction: column;
		gap: 32px;
		align-items: center;
		padding: 32px 16px;
	}

	.step-title {
		font-size: 28px;
		font-weight: 300;
		color: rgba(255, 255, 255, 0.55);
		margin: 0 0 12px;
	}

	.tier {
		width: 100%;
	}

	.tier-header {
		display: flex;
		align-items: center;
		gap: 10px;
		margin-bottom: 16px;
	}

	.tier-name {
		font-size: 12px;
		font-weight: 600;
		color: rgba(255, 255, 255, 0.4);
		text-transform: uppercase;
		letter-spacing: 1px;
		white-space: nowrap;
	}

	.tier-line {
		flex: 1;
		height: 1px;
		background: rgba(255, 255, 255, 0.05);
	}

	.card-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 16px;
	}

	.empty-hint {
		font-size: 13px;
		color: rgba(255, 255, 255, 0.2);
		padding: 20px 0;
	}

	@media (max-width: 680px) {
		.card-grid {
			grid-template-columns: repeat(2, 1fr);
		}
	}

	@media (max-width: 440px) {
		.card-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
