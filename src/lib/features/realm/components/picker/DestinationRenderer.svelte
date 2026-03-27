<script lang="ts">
	/**
	 * Destination Renderer - Loads and renders the active 3D destination
	 *
	 * Handles:
	 * - Lazy loading of destination components
	 * - Loading states
	 * - Error handling
	 * - ESC key to return to picker
	 */

	import { getDestination } from "$lib/shared/3d/destinations/definitions";
	import type { Destination } from "$lib/shared/3d/destinations/types";

	interface Props {
		destinationId: string;
		onReturn: () => void;
	}

	let { destinationId, onReturn }: Props = $props();

	// Destination metadata
	const destination: Destination | undefined = $derived(
		getDestination(destinationId),
	);

	// Component loading state
	let isLoading = $state(true);
	let loadError = $state<string | null>(null);
	let DestinationComponent = $state<any>(null);

	// Load the destination component
	async function loadDestination() {
		if (!destination) {
			loadError = `Destination not found: ${destinationId}`;
			isLoading = false;
			return;
		}

		isLoading = true;
		loadError = null;

		try {
			const module = await destination.component();
			DestinationComponent = module.default;
			isLoading = false;
		} catch (err) {
			console.error(`Failed to load destination ${destinationId}:`, err);
			loadError = err instanceof Error ? err.message : "Failed to load destination";
			isLoading = false;
		}
	}

	// Load on mount and when destination changes
	$effect(() => {
		loadDestination();
	});

	// ESC key handler to return to picker
	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === "Escape") {
			onReturn();
		}
	}

	$effect(() => {
		window.addEventListener("keydown", handleKeyDown);
		return () => {
			window.removeEventListener("keydown", handleKeyDown);
		};
	});
</script>

<div class="destination-renderer">
	{#if isLoading}
		<!-- Loading state -->
		<div class="loading-state">
			<div class="loading-spinner">
				<i class="fas fa-circle-notch fa-spin" aria-hidden="true"></i>
			</div>
			<p class="loading-text">Loading {destination?.name ?? "destination"}...</p>
		</div>
	{:else if loadError}
		<!-- Error state -->
		<div class="error-state">
			<i class="fas fa-exclamation-triangle error-icon" aria-hidden="true"></i>
			<h2>Failed to Load Destination</h2>
			<p class="error-message">{loadError}</p>
			<button class="back-button" onclick={onReturn}>
				<i class="fas fa-arrow-left" aria-hidden="true"></i>
				<span>Return to Destination Picker</span>
			</button>
		</div>
	{:else if DestinationComponent}
		<!-- Render the destination -->
		<DestinationComponent />

		<!-- Return hint (overlay) -->
		<div class="return-hint">
			<kbd>ESC</kbd>
			<span>Return to destinations</span>
		</div>
	{/if}
</div>

<style>
	.destination-renderer {
		position: relative;
		width: 100%;
		height: 100vh;
		background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
		color: var(--theme-text, #ffffff);
	}

	/* Loading state */
	.loading-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100%;
		gap: 1.5rem;
	}

	.loading-spinner {
		font-size: 3rem;
		color: var(--theme-accent, #8b5cf6);
	}

	.loading-text {
		font-size: var(--font-size-min, 14px);
		opacity: 0.7;
	}

	/* Error state */
	.error-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100%;
		gap: 1.5rem;
		padding: 2rem;
		text-align: center;
	}

	.error-icon {
		font-size: 4rem;
		color: var(--semantic-error, #ef4444);
	}

	.error-state h2 {
		font-size: 1.5rem;
		margin: 0;
	}

	.error-message {
		font-size: var(--font-size-min, 14px);
		opacity: 0.7;
		max-width: 500px;
	}

	.back-button {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem 1.5rem;
		background: var(--theme-accent, #8b5cf6);
		border: none;
		border-radius: 0.5rem;
		color: white;
		font-size: var(--font-size-min, 14px);
		font-weight: 600;
		cursor: pointer;
		transition: all var(--duration-normal) ease;
	}

	.back-button:hover {
		opacity: 0.9;
		transform: translateY(-2px);
	}

	/* Return hint */
	.return-hint {
		position: fixed;
		bottom: 2rem;
		right: 2rem;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem 1rem;
		background: rgba(0, 0, 0, 0.7);
		backdrop-filter: blur(8px);
		border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
		border-radius: 0.5rem;
		font-size: var(--font-size-compact, 12px);
		opacity: 0.7;
		transition: opacity var(--duration-normal) ease;
		pointer-events: none;
	}

	.return-hint:hover {
		opacity: 1;
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
		.return-hint {
			bottom: 1rem;
			right: 1rem;
			font-size: 0.75rem;
		}
	}
</style>
