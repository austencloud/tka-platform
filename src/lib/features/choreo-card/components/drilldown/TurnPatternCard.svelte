<script lang="ts">
	import TurnBarChart from './TurnBarChart.svelte';

	interface Props {
		name: string;
		description: string;
		entries: { blue: number; red: number }[];
		meta: string;
		onClick: () => void;
	}

	let { name, description, entries, meta, onClick }: Props = $props();
</script>

<button
	class="turn-card"
	onclick={onClick}
	aria-label="{name} turn pattern"
>
	<div class="chart-area">
		<TurnBarChart {entries} />
	</div>
	<span class="card-name">{name}</span>
	<span class="card-desc">{description}</span>
	<span class="card-meta">{meta}</span>
</button>

<style>
	.turn-card {
		display: flex;
		flex-direction: column;
		padding: 28px 22px;
		background: rgba(255, 255, 255, 0.015);
		border: 1.5px solid rgba(255, 255, 255, 0.07);
		border-radius: 16px;
		text-align: left;
		cursor: pointer;
		font-family: inherit;
		color: var(--theme-text, #ffffff);
		transition:
			transform 0.2s ease-out,
			border-color 0.2s ease-out,
			box-shadow 0.2s ease-out;
		animation: card-enter 200ms ease-out both;
	}

	.turn-card:hover {
		transform: translateY(-4px);
		border-color: rgba(var(--accent-rgb, 99, 183, 205), 0.28);
		box-shadow: 0 12px 40px rgba(0, 0, 0, 0.22);
	}

	.turn-card:focus-visible {
		outline: 2px solid rgba(var(--accent-rgb, 99, 183, 205), 0.6);
		outline-offset: 2px;
	}

	.chart-area {
		margin-bottom: 16px;
	}

	.card-name {
		font-size: 16px;
		font-weight: 600;
		margin-bottom: 6px;
	}

	.card-desc {
		font-size: 12px;
		color: rgba(255, 255, 255, 0.32);
		line-height: 1.45;
		margin-bottom: 10px;
	}

	.card-meta {
		font-size: 11px;
		color: rgba(255, 255, 255, 0.18);
	}

	@keyframes card-enter {
		from {
			opacity: 0;
			transform: translateY(10px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.turn-card {
			animation: none;
			transition: none;
		}
		.turn-card:hover {
			transform: none;
		}
	}
</style>
