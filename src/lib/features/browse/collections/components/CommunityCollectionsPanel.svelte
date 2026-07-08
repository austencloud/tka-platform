<!--
CommunityCollectionsPanel.svelte

The Browse > Collections tab: discovery of OTHER people's public collections.
One collection-group feed (newest-first, capped) lists every public collection
from every creator as a grid; tapping one opens it read-only, where the Follow
button lands it in your Library's Following shelf.

This is the single home for community-collection discovery — it lifts the
rendering that used to be buried in the Gallery drill's "Collections" section
into a first-class sub-tab. List ↔ detail is a plain local selection (no history
push): a discovery browse shouldn't clutter the module's back-stack.
-->
<script lang="ts">
	import { onMount } from "svelte";
	import {
		communityCollectionsState,
		type CommunityCollection,
	} from "../state/community-collections-state.svelte";
	import CollectionCard from "./CollectionCard.svelte";
	import CollectionDetailView from "./CollectionDetailView.svelte";

	// Lazy: the feed only loads the first time this tab is opened. Cached for the
	// session, so re-entering the tab is instant.
	onMount(() => {
		void communityCollectionsState.ensureLoaded();
	});

	// The open collection, or null for the grid. Local — a discovery browse
	// stays out of the module history (Follow is the durable action).
	let selected = $state<CommunityCollection | null>(null);

	const items = $derived(communityCollectionsState.items);
	const loading = $derived(communityCollectionsState.loading);
	const error = $derived(communityCollectionsState.error);
</script>

{#if selected}
	<CollectionDetailView
		collectionId={selected.collection.id}
		foreignOwnerId={selected.ownerId}
		ownerName={selected.ownerName}
		onBack={() => (selected = null)}
	/>
{:else}
	<div class="discover-list">
		<header class="list-header">
			<h2 class="list-title">Collections</h2>
		</header>

		{#if loading && items.length === 0}
			<div class="card-grid" aria-hidden="true">
				{#each Array(4) as _}
					<span class="tile-skeleton"></span>
				{/each}
			</div>
		{:else if error}
			<p class="discover-message">{error}</p>
		{:else if items.length === 0}
			<p class="discover-message">
				No public collections yet. Make one of yours public from its card menu
				in Library and it shows up here for everyone.
			</p>
		{:else}
			<div class="card-grid">
				{#each items as item (item.ownerId + item.collection.id)}
					<CollectionCard
						collection={item.collection}
						ownerName={item.ownerName}
						readonly
						onOpen={() => (selected = item)}
					/>
				{/each}
			</div>
		{/if}
	</div>
{/if}

<style>
	.discover-list {
		display: flex;
		flex-direction: column;
		gap: 14px;
		height: 100%;
		min-height: 0;
		overflow-y: auto;
		padding: clamp(12px, 3cqi, 28px);
		/* A handful of collections on a narrow panel otherwise huddles in the
		   top-left corner — cap the column and center it so the page reads composed
		   at any count. */
		width: 100%;
		max-width: 880px;
		margin-inline: auto;
	}

	.list-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		flex-wrap: wrap;
	}

	.list-title {
		margin: 0;
		font-size: clamp(17px, 2.6cqi, 22px);
		font-weight: 700;
		color: var(--theme-text, white);
	}

	.card-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
		gap: 10px;
		align-content: start;
	}

	.tile-skeleton {
		min-height: 72px;
		border-radius: 14px;
		background: color-mix(in srgb, var(--theme-text-dim, #888) 12%, transparent);
		animation: skeleton-pulse 1.2s ease-in-out infinite;
	}

	@keyframes skeleton-pulse {
		0%,
		100% {
			opacity: 0.5;
		}
		50% {
			opacity: 0.85;
		}
	}

	.discover-message {
		margin: 0 auto;
		max-width: 380px;
		text-align: center;
		font-size: var(--font-size-sm, 14px);
		line-height: 1.5;
		color: var(--theme-text-dim, rgba(255, 255, 255, 0.65));
	}

	@media (prefers-reduced-motion: reduce) {
		.tile-skeleton {
			animation: none;
		}
	}
</style>
