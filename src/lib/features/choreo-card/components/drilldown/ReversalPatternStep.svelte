<script lang="ts">
	import type { Deck } from '../../domain/models/Deck';
	import type { BreadcrumbSegment } from '../../state/deck-drilldown-types';
	import { getReversalPattern } from '../../domain/reversal-patterns';

	interface Props {
		decks: Deck[];
		breadcrumbs: BreadcrumbSegment[];
		onSelectDeck: (deck: Deck) => void;
	}

	let { decks, breadcrumbs, onSelectDeck }: Props = $props();

	interface CardData {
		deck: Deck;
		label: string;
		description: string;
		symbols: string[];
		showEllipsis: boolean;
	}

	// Deduplicate by reversal pattern — one card per unique pattern
	const cards: CardData[] = $derived.by(() => {
		const seen = new Map<string, Deck>();
		for (const deck of decks) {
			const key = deck.reversalPattern.toLowerCase();
			if (!seen.has(key)) seen.set(key, deck);
		}
		return [...seen.values()].map((deck) => {
			const pattern = getReversalPattern(deck.reversalPattern);
			const label = pattern?.label ?? deck.reversalPattern;
			const description =
				pattern?.description ?? 'No description available.';
			const period = pattern?.period ?? 4;
			const seq = pattern?.sequence ?? deck.reversalPattern;
			const symbols = seq
				.slice(0, Math.min(8, period))
				.split('');
			const showEllipsis = period > 8;
			return { deck, label, description, symbols, showEllipsis };
		});
	});

	const canonicalPrefix = $derived(
		breadcrumbs
			.slice(1)
			.map((b) => b.label)
			.join(' \u00B7 ')
	);

	function getDotPair(symbol: string): [boolean, boolean] {
		switch (symbol) {
			case 'P':
				return [true, true];
			case 'R':
				return [true, false];
			case 'B':
				return [false, true];
			default:
				return [false, false];
		}
	}

	function formatCount(n: number): string {
		if (n >= 1000) {
			return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
		}
		return String(n);
	}
</script>

<div class="reversal-step">
	<h2 class="step-title">Pick a reversal pattern</h2>

	<div class="card-grid">
		{#each cards as card, i}
			<button
				type="button"
				class="card"
				style="--stagger: {i * 50}ms"
				aria-label="Open {card.label} deck with {card.deck.totalSequences} sequences"
				onclick={() => onSelectDeck(card.deck)}
			>
				<div class="dots-row">
					{#each card.symbols as symbol}
						{@const [redDot, blueDot] = getDotPair(symbol)}
						<div class="dot-pair">
							<div
								class="dot"
								class:red={redDot}
								class:active={redDot}
								class:empty={!redDot}
								aria-hidden="true"
							></div>
							<div
								class="dot"
								class:blue={blueDot}
								class:active={blueDot}
								class:empty={!blueDot}
								aria-hidden="true"
							></div>
						</div>
					{/each}
					{#if card.showEllipsis}
						<span class="ellipsis">...</span>
					{/if}
				</div>

				<span class="card-label">{card.label}</span>
				<span class="card-description">{card.description}</span>

				<div class="card-footer">
					<span class="card-count"
						>{formatCount(card.deck.totalSequences)} sequences</span
					>
					<span class="card-families"
						>{card.deck.families.length} families</span
					>
				</div>
			</button>
		{/each}
	</div>

	<div class="canon">
		<small>Each card above is one printable deck</small>
		<span>Click a card to open</span>
	</div>
</div>

<style>
	.reversal-step {
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

	.card {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 28px 22px;
		background: rgba(255, 255, 255, 0.015);
		border: 1.5px solid rgba(255, 255, 255, 0.07);
		border-radius: 16px;
		cursor: pointer;
		color: var(--theme-text, #ffffff);
		text-align: center;
		min-height: 160px;
		animation: card-enter 0.35s ease both;
		animation-delay: var(--stagger, 0ms);
		transition:
			border-color 0.15s ease,
			transform 0.15s ease,
			box-shadow 0.15s ease;
	}

	@keyframes card-enter {
		from {
			opacity: 0;
			transform: translateY(12px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.card:hover {
		border-color: rgba(255, 255, 255, 0.15);
		transform: translateY(-4px);
		box-shadow:
			0 6px 20px rgba(0, 0, 0, 0.25),
			0 0 12px rgba(var(--theme-accent-rgb, 108, 142, 232), 0.12);
	}

	.card:focus-visible {
		outline: 2px solid var(--theme-accent, #6c8ee8);
		outline-offset: 2px;
	}

	@keyframes dot-pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.7;
		}
	}

	.card:hover .dot.active {
		animation: dot-pulse 1.5s ease-in-out infinite;
	}

	.dots-row {
		display: flex;
		align-items: center;
		gap: 4px;
		justify-content: center;
	}

	.dot-pair {
		display: flex;
		flex-direction: column;
		gap: 1.5px;
		align-items: center;
	}

	.dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.dot.red {
		background: #e74c3c;
	}

	.dot.blue {
		background: #3498db;
	}

	.dot.empty {
		background: rgba(255, 255, 255, 0.06);
	}

	.ellipsis {
		font-size: var(--font-size-compact, 12px);
		color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
	}

	.card-label {
		font-size: 16px;
		font-weight: 600;
		line-height: 1.2;
	}

	.card-description {
		font-size: var(--font-size-compact, 12px);
		color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
		line-height: 1.4;
		max-width: 220px;
	}

	.card-footer {
		display: flex;
		gap: 12px;
		align-items: center;
		margin-top: 4px;
	}

	.card-count,
	.card-families {
		font-size: var(--font-size-compact, 12px);
		color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
	}

	.canon {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		padding: 12px 22px;
		background: rgba(232, 197, 71, 0.03);
		border: 1px solid rgba(232, 197, 71, 0.08);
		border-radius: 10px;
		color: rgba(232, 197, 71, 0.6);
		text-align: center;
	}

	.canon small {
		font-size: var(--font-size-compact, 12px);
		opacity: 0.7;
	}

	.canon span {
		font-size: var(--font-size-min, 14px);
	}

	@media (prefers-reduced-motion: reduce) {
		.card {
			animation: none;
			transition: none;
		}
		.card:hover {
			transform: none;
		}
		.card:hover .dot.active {
			animation: none;
		}
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
