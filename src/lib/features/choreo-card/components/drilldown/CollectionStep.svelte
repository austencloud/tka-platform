<script lang="ts">
	import type { Deck } from '../../domain/models/Deck';
	import type { DrillPath } from '../../state/deck-drilldown-types';

	interface CollectionConfig {
		readonly path: DrillPath | null;
		readonly label: string;
		readonly description: string;
		readonly icon: string;
		readonly iconColor: string;
		readonly glowColor: string;
		readonly enabled: boolean;
	}

	const COLLECTIONS: readonly CollectionConfig[] = [
		{
			path: 'LOOPs',
			label: 'LOOPs',
			description: 'Algorithmic sequences that loop back to start',
			icon: 'fa-sync-alt',
			iconColor: '#63b7cd',
			glowColor: 'rgba(99,183,205,.07)',
			enabled: true
		},
		{
			path: 'VTG',
			label: 'VTG',
			description: 'Visual theory of groups pattern catalog',
			icon: 'fa-hands',
			iconColor: '#b763cd',
			glowColor: 'rgba(183,99,205,.07)',
			enabled: true
		},
		{
			path: null,
			label: 'My Decks',
			description: 'Your saved and custom decks',
			icon: 'fa-star',
			iconColor: '#e8c547',
			glowColor: 'rgba(232,197,71,.07)',
			enabled: false
		}
	];

	interface Props {
		decks: Deck[];
		onSelectPath: (path: DrillPath) => void;
	}

	let { decks, onSelectPath }: Props = $props();

	function countForCollection(collection: string): { decks: number; sequences: number } {
		const filtered = decks.filter((d) => d.collection === collection);
		const totalSequences = filtered.reduce((sum, d) => sum + d.totalSequences, 0);
		return { decks: filtered.length, sequences: totalSequences };
	}

	function handleClick(config: CollectionConfig): void {
		if (config.enabled && config.path) {
			onSelectPath(config.path);
		}
	}
</script>

<div class="collection-step">
	{#each COLLECTIONS as config, i}
		{@const stats = config.path ? countForCollection(config.path) : { decks: 0, sequences: 0 }}
		<button
			class="hero-card"
			class:disabled={!config.enabled}
			style="--glow-color: {config.glowColor}; --icon-color: {config.iconColor}; animation-delay: {i * 50}ms;"
			onclick={() => handleClick(config)}
			disabled={!config.enabled}
			aria-label="{config.label}: {stats.decks} decks, {stats.sequences} sequences"
		>
			<span class="glow"></span>
			<i class="fas {config.icon} hero-icon" aria-hidden="true"></i>
			<span class="hero-label">{config.label}</span>
			<span class="hero-description">{config.description}</span>
			<span class="hero-stats">
				{stats.decks} {stats.decks === 1 ? 'deck' : 'decks'} &middot; {stats.sequences}
				{stats.sequences === 1 ? 'sequence' : 'sequences'}
			</span>
		</button>
	{/each}
</div>

<style>
	.collection-step {
		display: flex;
		justify-content: center;
		align-items: stretch;
		gap: 24px;
		padding: 32px 16px;
		flex-wrap: wrap;
	}

	.hero-card {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		max-width: 320px;
		width: 100%;
		padding: 52px 36px;
		background: rgba(255, 255, 255, 0.03);
		border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
		border-radius: var(--radius-lg, 16px);
		cursor: pointer;
		transition:
			transform 0.2s ease-out,
			border-color 0.2s ease-out,
			box-shadow 0.2s ease-out;
		animation: card-enter 200ms ease-out both;
		overflow: hidden;
		color: var(--theme-text, #ffffff);
		font-family: inherit;
	}

	.hero-card:hover:not(:disabled) {
		transform: translateY(-6px);
		border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
		box-shadow: 0 24px 64px rgba(0, 0, 0, 0.3);
	}

	.hero-card:focus-visible {
		outline: 2px solid var(--theme-accent, #63b7cd);
		outline-offset: 2px;
	}

	.hero-card.disabled {
		opacity: 0.45;
		cursor: default;
	}

	/* Radial glow pseudo-element */
	.glow {
		position: absolute;
		inset: 0;
		border-radius: inherit;
		background: radial-gradient(ellipse at center, var(--glow-color) 0%, transparent 70%);
		opacity: 0;
		transition: opacity 0.2s ease-out;
		pointer-events: none;
	}

	.hero-card:hover:not(:disabled) .glow {
		opacity: 1;
	}

	.hero-icon {
		font-size: 2.5rem;
		color: var(--icon-color);
		margin-bottom: 20px;
	}

	.hero-label {
		font-size: 1.4rem;
		font-weight: 700;
		letter-spacing: 0.02em;
		margin-bottom: 8px;
	}

	.hero-description {
		font-size: var(--font-size-min, 14px);
		opacity: 0.6;
		line-height: 1.4;
		margin-bottom: 20px;
	}

	.hero-stats {
		font-size: var(--font-size-compact, 12px);
		opacity: 0.4;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	/* Staggered entrance animation */
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

	/* Reduced motion */
	@media (prefers-reduced-motion: reduce) {
		.hero-card {
			animation: none;
			transition: none;
		}
		.hero-card:hover:not(:disabled) {
			transform: none;
		}
		.glow {
			transition: none;
		}
	}
</style>
