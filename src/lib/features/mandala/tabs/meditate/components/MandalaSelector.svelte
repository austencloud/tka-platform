<script lang="ts">
	import SequenceMandala from "$lib/shared/mandala/components/SequenceMandala.svelte";
	import { DEFAULT_MANDALAS } from "../domain/default-mandalas";
	import { mandalaCollectionState } from "$lib/features/mandala/tabs/collection/state/mandala-collection-state.svelte";
	import type { StepLike } from "$lib/shared/mandala/services/contracts/types";

	interface Props {
		onSelect: (steps: StepLike[], name: string, bluePropType: string, redPropType: string) => void;
	}

	let { onSelect }: Props = $props();

	const collectionMandalas = $derived(mandalaCollectionState.collection);
	const hasCollection = $derived(collectionMandalas.length > 0);

	function handleDefaultSelect(mandala: (typeof DEFAULT_MANDALAS)[number]) {
		onSelect(mandala.steps, mandala.name, mandala.bluePropType, mandala.redPropType);
	}

	function handleCollectionSelect(mandala: (typeof collectionMandalas)[number]) {
		onSelect(mandala.steps as StepLike[], mandala.name, mandala.bluePropType, mandala.redPropType);
	}

	function handleRandom() {
		const all = [
			...DEFAULT_MANDALAS,
			...collectionMandalas.map((m) => ({
				steps: m.steps as StepLike[],
				name: m.name,
				bluePropType: m.bluePropType,
				redPropType: m.redPropType,
			})),
		];
		if (all.length === 0) return;
		const pick = all[Math.floor(Math.random() * all.length)]!;
		onSelect(pick.steps, pick.name, pick.bluePropType, pick.redPropType);
	}
</script>

<div class="mandala-selector">
	<div class="selector-header">
		<h2 class="selector-title">Choose a Mandala</h2>
		<button
			type="button"
			class="random-btn"
			onclick={handleRandom}
			aria-label="Select a random mandala"
		>
			<i class="fas fa-shuffle" aria-hidden="true"></i>
			<span>Random</span>
		</button>
	</div>

	<section class="section">
		<h3 class="section-label">Curated</h3>
		<div class="mandala-grid">
			{#each DEFAULT_MANDALAS as mandala (mandala.id)}
				<button
					type="button"
					class="mandala-card"
					onclick={() => handleDefaultSelect(mandala)}
					aria-label="Select {mandala.name} mandala"
				>
					<div class="mandala-thumb">
						<SequenceMandala
							sequence={{ steps: mandala.steps }}
							size={80}
							show={mandala.variant}
							bluePropType={mandala.bluePropType}
							redPropType={mandala.redPropType}
						/>
					</div>
					<span class="mandala-name">{mandala.name}</span>
				</button>
			{/each}
		</div>
	</section>

	{#if hasCollection}
		<section class="section">
			<h3 class="section-label">Your Collection</h3>
			<div class="mandala-grid">
				{#each collectionMandalas as mandala (mandala.id)}
					<button
						type="button"
						class="mandala-card"
						onclick={() => handleCollectionSelect(mandala)}
						aria-label="Select {mandala.name} mandala"
					>
						<div class="mandala-thumb">
							<SequenceMandala
								sequence={{ steps: mandala.steps }}
								size={80}
								show={mandala.variant}
								bluePropType={mandala.bluePropType}
								redPropType={mandala.redPropType}
							/>
						</div>
						<span class="mandala-name">{mandala.name}</span>
					</button>
				{/each}
			</div>
		</section>
	{/if}
</div>

<style>
	.mandala-selector {
		display: flex;
		flex-direction: column;
		gap: 24px;
		padding: 24px;
		height: 100%;
		overflow-y: auto;
	}

	.selector-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.selector-title {
		font-size: 18px;
		font-weight: 600;
		color: var(--theme-text, white);
		margin: 0;
	}

	.random-btn {
		display: flex;
		align-items: center;
		gap: 6px;
		min-height: 44px;
		padding: 8px 16px;
		background: rgba(255, 255, 255, 0.06);
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 10px;
		color: rgba(255, 255, 255, 0.7);
		font-size: 13px;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.random-btn:hover {
		background: rgba(255, 255, 255, 0.1);
		border-color: rgba(255, 255, 255, 0.2);
		color: white;
	}

	.random-btn:active {
		transform: scale(0.95);
		transition-duration: 50ms;
	}

	.random-btn:focus-visible {
		outline: 2px solid color-mix(in srgb, var(--theme-accent, #6366f1) 50%, transparent);
		outline-offset: 2px;
	}

	.section {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.section-label {
		font-size: 12px;
		font-weight: 500;
		color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
		text-transform: uppercase;
		letter-spacing: 0.06em;
		margin: 0;
	}

	.mandala-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
		gap: 12px;
	}

	.mandala-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		padding: 12px 8px;
		background: rgba(255, 255, 255, 0.03);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 12px;
		cursor: pointer;
		transition: all 0.15s ease;
		min-height: 44px;
	}

	.mandala-card:hover {
		background: rgba(255, 255, 255, 0.07);
		border-color: color-mix(in srgb, var(--theme-accent, #6366f1) 40%, transparent);
		transform: translateY(-2px);
	}

	.mandala-card:active {
		transform: scale(0.95);
		transition-duration: 50ms;
	}

	.mandala-card:focus-visible {
		outline: 2px solid color-mix(in srgb, var(--theme-accent, #6366f1) 50%, transparent);
		outline-offset: 2px;
	}

	.mandala-thumb {
		width: 80px;
		height: 80px;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.mandala-name {
		font-size: 12px;
		font-weight: 500;
		color: rgba(255, 255, 255, 0.7);
		text-align: center;
		line-height: 1.3;
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	@media (prefers-reduced-motion: reduce) {
		.mandala-card,
		.random-btn {
			transition: none !important;
		}
		.mandala-card:hover {
			transform: none;
		}
		.mandala-card:active,
		.random-btn:active {
			transform: none;
		}
	}

	@media (max-width: 480px) {
		.mandala-selector {
			padding: 16px;
		}

		.mandala-grid {
			grid-template-columns: repeat(auto-fill, minmax(90px, 1fr));
			gap: 8px;
		}

		.mandala-card {
			padding: 8px 6px;
		}
	}
</style>
