<script lang="ts">
	interface Props {
		entries: { blue: number; red: number }[];
		animate?: boolean;
	}

	let { entries, animate = true }: Props = $props();
</script>

<div class="bar-chart" class:animate>
	{#each entries as entry, i}
		<div
			class="bar-group"
			style="--stagger: {i * 30}ms;"
		>
			<div
				class="bar blue"
				style="--h: {Math.max(entry.blue * 7, 2)}px;"
			></div>
			<div
				class="bar red"
				style="--h: {Math.max(entry.red * 7, 2)}px;"
			></div>
		</div>
	{/each}
</div>

<style>
	.bar-chart {
		display: flex;
		align-items: flex-end;
		height: 24px;
		gap: 3px;
	}

	.bar-group {
		display: flex;
		align-items: flex-end;
		gap: 1.5px;
	}

	.bar {
		width: 4px;
		border-radius: 2px 2px 0 0;
		height: var(--h);
	}

	.bar.blue {
		background: #3498db;
	}

	.bar.red {
		background: #e74c3c;
	}

	/* Animation: bars grow from 0 */
	.animate .bar {
		animation: grow-bar 300ms ease-out var(--stagger) both;
	}

	@keyframes grow-bar {
		from {
			height: 0;
		}
		to {
			height: var(--h);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.animate .bar {
			animation: none;
		}
	}
</style>
