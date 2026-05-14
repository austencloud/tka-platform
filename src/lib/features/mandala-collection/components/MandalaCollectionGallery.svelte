<script lang="ts">
	import { mandalaCollectionState } from "../state/mandala-collection-state.svelte";
	import MandalaCollectionCard from "./MandalaCollectionCard.svelte";

	function handleDelete(id: string) {
		mandalaCollectionState.remove(id);
	}
</script>

<div class="gallery-container">
	{#if mandalaCollectionState.collection.length === 0}
		<div class="empty-state">
			<i class="fas fa-dharmachakra empty-icon" aria-hidden="true"></i>
			<p class="empty-text">No mandalas saved yet</p>
			<p class="empty-hint">Right-click a mandala in the step grid to add one</p>
		</div>
	{:else}
		<div class="gallery-grid">
			{#each mandalaCollectionState.collection as mandala (mandala.id)}
				<MandalaCollectionCard {mandala} onDelete={handleDelete} />
			{/each}
		</div>
	{/if}
</div>

<style>
	.gallery-container {
		width: 100%;
		height: 100%;
		overflow-y: auto;
		padding: 16px;
		box-sizing: border-box;
	}

	.gallery-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
		gap: 12px;
	}

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100%;
		gap: 8px;
		color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
	}

	.empty-icon {
		font-size: 48px;
		opacity: 0.3;
	}

	.empty-text {
		font-size: 16px;
		font-weight: 500;
		margin: 0;
	}

	.empty-hint {
		font-size: 13px;
		margin: 0;
		opacity: 0.7;
	}
</style>
