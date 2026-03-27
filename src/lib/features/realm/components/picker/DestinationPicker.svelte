<script lang="ts">
	/**
	 * Destination Picker - Visual grid of 3D destination cards
	 *
	 * Shows all available destinations (Stage, Gallery, Worlds, etc.) as
	 * cards with live 3D previews. Hover to trigger flythrough animations.
	 * Click to enter a destination.
	 *
	 * Design: Grid layout with live previews (Apple's app preview pattern)
	 */

	import { onMount } from "svelte";
	import { DESTINATIONS, DESTINATION_CATEGORIES } from "$lib/shared/3d/destinations/definitions";
	import type { Destination } from "$lib/shared/3d/destinations/types";
	import Mini3DPreview from "./Mini3DPreview.svelte";

	interface Props {
		onSelect: (destinationId: string) => void;
	}

	let { onSelect }: Props = $props();

	// Selected category filter (null = show all)
	let selectedCategory = $state<string | null>(null);

	// Hovered destination (for preview animation)
	let hoveredDestinationId = $state<string | null>(null);

	// Visible cards (lazy loading via IntersectionObserver)
	let visibleCards = $state<Set<string>>(new Set());

	// Loaded previews (tracks which previews have loaded successfully)
	let loadedPreviews = $state<Set<string>>(new Set());

	// Card element refs for IntersectionObserver
	let cardRefs = $state<Map<string, HTMLElement>>(new Map());

	// Filter to only enabled destinations (enabled defaults to true if not specified)
	const enabledDestinations = $derived(
		DESTINATIONS.filter((d) => d.enabled !== false),
	);

	// Filtered destinations (by category)
	const filteredDestinations = $derived(
		selectedCategory
			? enabledDestinations.filter((d) => d.category === selectedCategory)
			: enabledDestinations,
	);

	function handleDestinationClick(destination: Destination) {
		onSelect(destination.id);
	}

	function handleCategoryClick(categoryId: string | null) {
		selectedCategory = categoryId;
	}

	function handlePreviewReady(destinationId: string) {
		loadedPreviews = new Set([...loadedPreviews, destinationId]);
	}

	// Svelte action to track card elements for IntersectionObserver
	function trackCard(element: HTMLElement, destinationId: string) {
		cardRefs.set(destinationId, element);

		return {
			destroy() {
				cardRefs.delete(destinationId);
			}
		};
	}

	// IntersectionObserver for lazy loading
	onMount(() => {
		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					const id = entry.target.getAttribute("data-destination-id");
					if (!id) continue;

					if (entry.isIntersecting) {
						visibleCards = new Set([...visibleCards, id]);
					}
					// Note: We don't remove from visibleCards when scrolling away
					// to prevent unmount/remount flicker. The preview stays loaded.
				}
			},
			{
				rootMargin: "100px", // Start loading slightly before visible
				threshold: 0.1,
			}
		);

		// Observe all cards as they get added
		const unsubscribe = $effect.root(() => {
			$effect(() => {
				for (const [, element] of cardRefs) {
					observer.observe(element);
				}
			});
		});

		return () => {
			observer.disconnect();
			unsubscribe();
		};
	});
</script>

<div class="destination-picker">
	<!-- Header -->
	<header class="picker-header">
		<h1>Choose Your Destination</h1>
		<p class="subtitle">Select a 3D realm to explore</p>
	</header>

	<!-- Category filters -->
	<nav class="category-nav">
		<button
			class="category-chip"
			class:active={selectedCategory === null}
			onclick={() => handleCategoryClick(null)}
		>
			<i class="fas fa-globe" aria-hidden="true"></i>
			<span>All Destinations</span>
		</button>

		{#each DESTINATION_CATEGORIES as category} 
			<button
				class="category-chip"
				class:active={selectedCategory === category.id}
				onclick={() => handleCategoryClick(category.id)}
				style="--category-color: {category.color}"
			>
				<i class="fas {category.icon}" aria-hidden="true"></i>
				<span>{category.name}</span>
			</button>
		{/each}
	</nav>

	<!-- Destination grid -->
	<div class="destination-grid">
		{#each filteredDestinations as destination (destination.id)}
			<button
				class="destination-card"
				class:hovered={hoveredDestinationId === destination.id}
				style="--dest-color: {destination.color}"
				data-destination-id={destination.id}
				onclick={() => handleDestinationClick(destination)}
				onmouseenter={() => (hoveredDestinationId = destination.id)}
				onmouseleave={() => (hoveredDestinationId = null)}
				use:trackCard={destination.id}
			>
				<!-- Preview area with live 3D preview -->
				<div class="preview-area">
					{#if visibleCards.has(destination.id)}
						<!-- Live 3D preview (lazy loaded when visible) -->
						<Mini3DPreview
							destinationId={destination.id}
							isHovered={hoveredDestinationId === destination.id}
							onReady={() => handlePreviewReady(destination.id)}
						/>

						<!-- Fallback icon (shown while loading or on error) -->
						{#if !loadedPreviews.has(destination.id)}
							<div class="preview-placeholder preview-loading">
								<i class="fas {destination.icon} preview-icon" aria-hidden="true"></i>
							</div>
						{/if}
					{:else}
						<!-- Static placeholder (before intersection) -->
						<div class="preview-placeholder">
							<i class="fas {destination.icon} preview-icon" aria-hidden="true"></i>
						</div>
					{/if}

					<!-- Multiplayer badge -->
					{#if destination.supportsMultiplayer}
						<div class="badge multiplayer-badge">
							<i class="fas fa-users" aria-hidden="true"></i>
							<span>Multiplayer</span>
						</div>
					{/if}

					<!-- Physics badge -->
					{#if destination.supportsPhysics}
						<div class="badge physics-badge">
							<i class="fas fa-circle-notch" aria-hidden="true"></i>
							<span>Physics</span>
						</div>
					{/if}
				</div>

				<!-- Card content -->
				<div class="card-content">
					<h2 class="destination-name">{destination.name}</h2>
					<p class="destination-description">{destination.description}</p>

					<!-- Tags -->
					{#if destination.tags && destination.tags.length > 0}
						<div class="tags">
							{#each destination.tags.slice(0, 3) as tag}
								<span class="tag">{tag}</span>
							{/each}
						</div>
					{/if}

					<!-- Enter button -->
					<div class="enter-button">
						<span>Enter</span>
						<i class="fas fa-arrow-right" aria-hidden="true"></i>
					</div>
				</div>
			</button>
		{/each}
	</div>

	<!-- Keyboard hint -->
	<footer class="picker-footer">
		<p class="hint">
			<kbd>ESC</kbd> returns to this screen from any destination
		</p>
	</footer>
</div>

<style>
	.destination-picker {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 2rem;
		min-height: 100vh;
		background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
		color: var(--theme-text, #ffffff);
		gap: 2rem;
	}

	/* Header */
	.picker-header {
		text-align: center;
		max-width: 600px;
	}

	.picker-header h1 {
		font-size: clamp(2rem, 5vw, 3rem);
		font-weight: 700;
		margin: 0;
		background: linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%);
		-webkit-background-clip: text;
		background-clip: text;
		-webkit-text-fill-color: transparent;
	}

	.subtitle {
		font-size: var(--font-size-min, 14px);
		opacity: 0.7;
		margin-top: 0.5rem;
	}

	/* Category nav */
	.category-nav {
		display: flex;
		gap: 0.75rem;
		flex-wrap: wrap;
		justify-content: center;
	}

	.category-chip {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 1rem;
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
		border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
		border-radius: 2rem;
		font-size: var(--font-size-min, 14px);
		color: var(--theme-text, #ffffff);
		cursor: pointer;
		transition: all var(--duration-normal) ease;
	}

	.category-chip:hover {
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.08));
		border-color: var(--category-color, var(--theme-stroke-strong, rgba(255, 255, 255, 0.15)));
	}

	.category-chip.active {
		background: var(--category-color, var(--theme-accent, #8b5cf6));
		border-color: var(--category-color, var(--theme-accent, #8b5cf6));
		color: white;
	}

	.category-chip i {
		font-size: 1rem;
	}

	/* Destination grid */
	.destination-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
		gap: 1.5rem;
		width: 100%;
		max-width: 1400px;
	}

	/* Destination card */
	.destination-card {
		display: flex;
		flex-direction: column;
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
		border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
		border-radius: 1rem;
		overflow: hidden;
		cursor: pointer;
		transition: all var(--duration-emphasis) cubic-bezier(0.4, 0, 0.2, 1);
		text-align: left;
		color: var(--theme-text, #ffffff);
	}

	.destination-card:hover {
		transform: translateY(-4px);
		border-color: var(--dest-color, var(--theme-stroke-strong, rgba(255, 255, 255, 0.15)));
		box-shadow: 0 12px 24px rgba(0, 0, 0, 0.3),
			0 0 0 1px var(--dest-color, transparent);
	}

	.destination-card.hovered .preview-icon {
		transform: scale(1.1) rotate(5deg);
	}

	/* Preview area */
	.preview-area {
		position: relative;
		aspect-ratio: 16 / 9;
		background: linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(6, 182, 212, 0.1));
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
	}

	.preview-placeholder {
		display: flex;
		align-items: center;
		justify-content: center;
		transition: opacity var(--duration-emphasis) ease;
	}

	.preview-loading {
		position: absolute;
		inset: 0;
		background: linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(6, 182, 212, 0.1));
		z-index: 1;
	}

	.preview-icon {
		font-size: 4rem;
		color: var(--dest-color, var(--theme-accent, #8b5cf6));
		opacity: 0.4;
		transition: all var(--duration-emphasis) ease;
	}

	/* Badges */
	.badge {
		position: absolute;
		top: 0.75rem;
		padding: 0.25rem 0.5rem;
		background: rgba(0, 0, 0, 0.7);
		backdrop-filter: blur(8px);
		border-radius: 0.5rem;
		font-size: var(--font-size-compact, 12px);
		display: flex;
		align-items: center;
		gap: 0.25rem;
	}

	.multiplayer-badge {
		right: 0.75rem;
	}

	.physics-badge {
		right: 0.75rem;
		top: 3rem;
	}

	.badge i {
		font-size: 0.875rem;
	}

	/* Card content */
	.card-content {
		padding: 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		flex: 1;
	}

	.destination-name {
		font-size: 1.5rem;
		font-weight: 600;
		margin: 0;
		color: var(--dest-color, var(--theme-text, #ffffff));
	}

	.destination-description {
		font-size: var(--font-size-min, 14px);
		line-height: 1.5;
		opacity: 0.8;
		margin: 0;
		flex: 1;
	}

	/* Tags */
	.tags {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.tag {
		padding: 0.25rem 0.5rem;
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
		border-radius: 0.25rem;
		font-size: var(--font-size-compact, 12px);
		opacity: 0.7;
	}

	/* Enter button */
	.enter-button {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 0.75rem;
		background: var(--dest-color, var(--theme-accent, #8b5cf6));
		border-radius: 0.5rem;
		font-weight: 600;
		transition: all var(--duration-normal) ease;
	}

	.destination-card:hover .enter-button {
		gap: 0.75rem;
	}

	.enter-button i {
		transition: transform var(--duration-normal) ease;
	}

	.destination-card:hover .enter-button i {
		transform: translateX(4px);
	}

	/* Footer */
	.picker-footer {
		margin-top: auto;
		text-align: center;
	}

	.hint {
		font-size: var(--font-size-compact, 12px);
		opacity: 0.6;
	}

	kbd {
		padding: 0.25rem 0.5rem;
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.1));
		border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.2));
		border-radius: 0.25rem;
		font-family: monospace;
		font-size: var(--font-size-compact, 12px);
	}

	/* Responsive */
	@media (max-width: 768px) {
		.destination-picker {
			padding: 1rem;
		}

		.destination-grid {
			grid-template-columns: 1fr;
		}

		.category-nav {
			width: 100%;
			overflow-x: auto;
			justify-content: flex-start;
			padding-bottom: 0.5rem;
		}
	}
</style>
