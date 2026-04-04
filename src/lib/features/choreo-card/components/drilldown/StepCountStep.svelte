<script lang="ts">
	import DrillPill from './DrillPill.svelte';

	interface Props {
		availableCounts: number[];
		onSelect: (count: number) => void;
	}

	let { availableCounts, onSelect }: Props = $props();

	let selectedCount = $state<number | null>(null);

	$effect(() => {
		if (selectedCount === null && availableCounts.length > 0) {
			selectedCount = availableCounts[0]!;
		}
	});

	function handleSelect(count: number): void {
		selectedCount = count;
		onSelect(count);
	}
</script>

<div class="step-count-step" style="--accent: #63b7cd; --accent-rgb: 99,183,205;">
	<h2 class="step-title">Choose step count</h2>

	<div class="pill-group">
		<span class="group-label">STEPS PER SEQUENCE</span>
		<div class="pill-row">
			{#each availableCounts as count}
				<DrillPill
					label={String(count)}
					selected={selectedCount === count}
					onClick={() => handleSelect(count)}
				/>
			{/each}
		</div>
	</div>
</div>

<style>
	.step-count-step {
		width: 100%;
		max-width: 700px;
		display: flex;
		flex-direction: column;
		gap: 36px;
		align-items: center;
		padding: 32px 16px;
	}

	.step-title {
		font-size: 28px;
		font-weight: 300;
		color: rgba(255, 255, 255, 0.55);
		margin: 0 0 44px;
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
</style>
