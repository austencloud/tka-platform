<script lang="ts">
	import TurnPatternCard from './TurnPatternCard.svelte';

	interface Props {
		onSelect: (pattern: string) => void;
	}

	let { onSelect }: Props = $props();

	const values: { label: string; value: number; meta: string; desc: string }[] = [
		{ label: '0t', value: 0, meta: '1:1', desc: 'No rotation. Positions only.' },
		{ label: '0.5t', value: 0.5, meta: '2:1', desc: 'Quarter turn every step. Subtle movement.' },
		{ label: '1t', value: 1, meta: '3:1', desc: 'Both hands 1 full turn every step.' },
		{ label: '1.5t', value: 1.5, meta: '4:1', desc: 'One and a half turns per step.' },
		{ label: '2t', value: 2, meta: '5:1', desc: 'Two full turns every step.' },
		{ label: '2.5t', value: 2.5, meta: '6:1', desc: 'Two and a half turns per step.' },
		{ label: '3t', value: 3, meta: '7:1', desc: 'Three full turns every step. Maximum rotation.' },
	];

	function entriesFor(v: number): { blue: number; red: number }[] {
		return [
			{ blue: v, red: v },
			{ blue: v, red: v },
			{ blue: v, red: v },
			{ blue: v, red: v },
		];
	}
</script>

<div class="uniform-sub" style="--accent-rgb: 99,183,205;">
	<h2 class="step-title">Pick a uniform turn value</h2>

	<div class="card-grid">
		{#each values as v}
			<TurnPatternCard
				name={v.label}
				description={v.desc}
				entries={entriesFor(v.value)}
				meta={v.meta}
				onClick={() => onSelect(v.label)}
			/>
		{/each}
	</div>
</div>

<style>
	.uniform-sub {
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

	.card-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 16px;
		width: 100%;
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
