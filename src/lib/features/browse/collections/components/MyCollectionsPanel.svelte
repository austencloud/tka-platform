<!--
MyCollectionsPanel.svelte

The Browse > Collections tab: YOUR collections, not a directory of everyone's
libraries (that lives in the Creators tab). Favorites always leads — the
subscription orders by sortOrder and Favorites is pinned to the front.

List vs detail is derived straight from browseNavigationState's current
location, so the module's back/forward buttons and the localStorage restore
both work without any extra sync wiring: opening a collection pushes a
"detail" location, going back re-renders the list.

Signed out, collections have nowhere to live, so the tab explains itself
instead of showing an empty shell.
-->
<script lang="ts">
	import { authState } from "$lib/shared/auth/state/auth-state.svelte";
	import { collectionsState } from "$lib/features/library/state/collections-state.svelte";
	import {
		communityCollectionsState,
		type CommunityCollection,
	} from "../state/community-collections-state.svelte";
	import { browseNavigationState } from "$lib/shared/browse/state/browse-navigation-state.svelte";
	import SegmentedControl from "$lib/shared/3d/components/controls/SegmentedControl.svelte";
	import CollectionCard from "./CollectionCard.svelte";
	import CollectionDetailView from "./CollectionDetailView.svelte";

	const signedIn = $derived(!!authState.user);

	// Mine | Community. Local state survives the detail round-trip because the
	// panel stays mounted while detail replaces the list.
	let subView = $state<"mine" | "community">("mine");

	$effect(() => {
		if (signedIn) collectionsState.ensureStarted();
	});

	$effect(() => {
		if (subView === "community") {
			void communityCollectionsState.ensureLoaded();
		}
	});

	// Favorites stays pinned (sortOrder -1000); after that, most recently
	// touched first — adding or removing a sequence bumps updatedAt, so the
	// collection you're actively building floats to the front. All user
	// collections share sortOrder 0, so without this the tie-break is
	// whatever order Firestore returns.
	const collections = $derived(
		[...collectionsState.collections].sort(
			(a, b) =>
				a.sortOrder - b.sortOrder ||
				b.updatedAt.getTime() - a.updatedAt.getTime(),
		),
	);
	const loading = $derived(collectionsState.loading);

	// The nav state is the single source of truth for which view is showing.
	// Foreign (community) collections encode their owner in the contextId as
	// "ownerId:collectionId" — own collection ids never contain a colon
	// (Firestore auto-ids + "system_favorites").
	const detail = $derived.by(() => {
		const loc = browseNavigationState.currentLocation;
		if (loc?.tab !== "collections" || loc.view !== "detail" || !loc.contextId) {
			return null;
		}
		const sep = loc.contextId.indexOf(":");
		if (sep > 0) {
			return {
				id: loc.contextId.slice(sep + 1),
				ownerId: loc.contextId.slice(0, sep),
				ownerName: loc.filter?.displayName,
			};
		}
		// Your own collection needs you signed in; a stale restore while signed
		// out falls through to the list (which shows the sign-in prompt).
		if (!signedIn) return null;
		return { id: loc.contextId, ownerId: null, ownerName: undefined };
	});

	function openCollection(id: string, name: string) {
		browseNavigationState.viewCollectionDetail(id, name);
	}

	function openCommunityCollection(item: CommunityCollection) {
		browseNavigationState.navigateTo({
			tab: "collections",
			view: "detail",
			contextId: `${item.ownerId}:${item.collection.id}`,
			filter: {
				type: "collectionName",
				value: item.collection.name,
				displayName: item.ownerName,
			},
		});
	}

	function backToList() {
		// Leaving a community collection should land back on the Community view,
		// not flip the user over to Mine.
		if (detail?.ownerId) subView = "community";
		browseNavigationState.viewCollections();
	}

	// ── New collection (inline, same interaction as the picker's add tile) ──
	let showInput = $state(false);
	let newName = $state("");
	let creating = $state(false);

	async function handleCreate() {
		const name = newName.trim();
		if (!name || creating) return;
		creating = true;
		try {
			await collectionsState.create(name);
			newName = "";
			showInput = false;
		} finally {
			creating = false;
		}
	}

	function handleInputKeydown(e: KeyboardEvent) {
		if (e.key === "Enter") {
			e.preventDefault();
			void handleCreate();
		} else if (e.key === "Escape") {
			e.preventDefault();
			showInput = false;
			newName = "";
		}
	}
</script>

{#if detail}
	<CollectionDetailView
		collectionId={detail.id}
		foreignOwnerId={detail.ownerId}
		ownerName={detail.ownerName}
		onBack={backToList}
	/>
{:else}
	<div class="collections-list">
		<header class="list-header">
			<h2 class="list-title">Collections</h2>
			<SegmentedControl
				options={[
					{ value: "mine", label: "Mine" },
					{ value: "community", label: "Community" },
				]}
				value={subView}
				onchange={(v) => (subView = v)}
				color="accent"
				size="sm"
			/>
		</header>

		{#if subView === "mine"}
			{#if !signedIn}
				<div class="signed-out">
					<span class="signed-out-icon">
						<i class="fas fa-folder-open" aria-hidden="true"></i>
					</span>
					<p class="signed-out-title">Collections live in your account</p>
					<p class="signed-out-hint">
						Sign in to group sequences into collections and keep your favorites
						in one place. Community collections are open right now — take a
						look.
					</p>
				</div>
			{:else if loading && collections.length === 0}
				<div class="card-grid" aria-hidden="true">
					{#each Array(4) as _}
						<span class="tile-skeleton"></span>
					{/each}
				</div>
			{:else}
				<div class="card-grid">
					{#each collections as c (c.id)}
						<CollectionCard
							collection={c}
							onOpen={() => openCollection(c.id, c.name)}
						/>
					{/each}

					{#if showInput}
						<div class="new-tile-input">
							<!-- svelte-ignore a11y_autofocus -->
							<input
								type="text"
								class="name-field"
								placeholder="Collection name"
								aria-label="New collection name"
								bind:value={newName}
								onkeydown={handleInputKeydown}
								maxlength="60"
								autofocus
							/>
							<button
								type="button"
								class="confirm-create"
								onclick={handleCreate}
								disabled={!newName.trim() || creating}
								aria-label="Create collection"
							>
								<i class="fas fa-check" aria-hidden="true"></i>
							</button>
						</div>
					{:else}
						<button type="button" class="add-tile" onclick={() => (showInput = true)}>
							<span class="add-icon">
								<i class="fas fa-plus" aria-hidden="true"></i>
							</span>
							<span class="add-label">New collection</span>
						</button>
					{/if}
				</div>
			{/if}
		{:else if communityCollectionsState.loading}
			<div class="card-grid" aria-hidden="true">
				{#each Array(6) as _}
					<span class="tile-skeleton"></span>
				{/each}
			</div>
		{:else if communityCollectionsState.error}
			<div class="signed-out">
				<span class="signed-out-icon">
					<i class="fas fa-triangle-exclamation" aria-hidden="true"></i>
				</span>
				<p class="signed-out-title">{communityCollectionsState.error}</p>
			</div>
		{:else if communityCollectionsState.items.length === 0}
			<div class="signed-out">
				<span class="signed-out-icon">
					<i class="fas fa-globe" aria-hidden="true"></i>
				</span>
				<p class="signed-out-title">No public collections yet</p>
				<p class="signed-out-hint">
					Make one of yours public from its card menu and it shows up here for
					everyone.
				</p>
			</div>
		{:else}
			<div class="card-grid">
				{#each communityCollectionsState.items as item (item.ownerId + item.collection.id)}
					<CollectionCard
						collection={item.collection}
						ownerName={item.ownerName}
						readonly
						onOpen={() => openCommunityCollection(item)}
					/>
				{/each}
			</div>
		{/if}
	</div>
{/if}

<style>
	.collections-list {
		display: flex;
		flex-direction: column;
		gap: 14px;
		height: 100%;
		min-height: 0;
		overflow-y: auto;
		padding: clamp(12px, 3cqi, 28px);
		/* A handful of collections on a wide desktop panel otherwise huddles in
		   the top-left corner — cap the column and center it so the page reads
		   composed at any count. */
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

	/* Add tile: dashed, quieter, same footprint as a collection card. */
	.add-tile {
		display: flex;
		align-items: center;
		gap: 14px;
		min-height: 72px;
		padding: 14px 16px;
		text-align: left;
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
		border: 1.5px dashed var(--theme-stroke, rgba(255, 255, 255, 0.16));
		border-radius: 14px;
		color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
		cursor: pointer;
		font: inherit;
		transition:
			background var(--duration-fast, 150ms) ease,
			border-color var(--duration-fast, 150ms) ease;
	}

	.add-tile:hover {
		border-color: color-mix(in srgb, var(--theme-accent) 45%, transparent);
		background: color-mix(in srgb, var(--theme-accent) 6%, var(--theme-card-bg));
	}

	.add-tile:focus-visible {
		outline: 2px solid var(--theme-accent);
		outline-offset: 2px;
	}

	.add-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 44px;
		height: 44px;
		flex-shrink: 0;
		border-radius: 12px;
		background: color-mix(in srgb, var(--theme-text-dim, #888) 14%, transparent);
		font-size: 15px;
	}

	.add-label {
		font-size: var(--font-size-sm, 14px);
		font-weight: 600;
	}

	.new-tile-input {
		display: flex;
		align-items: center;
		gap: 8px;
		min-height: 72px;
	}

	.name-field {
		flex: 1;
		min-width: 0;
		height: 44px;
		padding: 0 14px;
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
		border: 1.5px solid color-mix(in srgb, var(--theme-accent) 45%, transparent);
		border-radius: 12px;
		color: var(--theme-text, white);
		font-size: var(--font-size-sm, 14px);
		font-family: inherit;
	}

	.name-field:focus {
		outline: none;
		border-color: color-mix(in srgb, var(--theme-accent) 70%, transparent);
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--theme-accent) 14%, transparent);
	}

	.name-field::placeholder {
		color: color-mix(in srgb, var(--theme-text-dim, #888) 70%, transparent);
	}

	.confirm-create {
		flex-shrink: 0;
		width: 44px;
		height: 44px;
		display: flex;
		align-items: center;
		justify-content: center;
		border: 1px solid color-mix(in srgb, var(--theme-accent) 45%, transparent);
		border-radius: 50%;
		background: color-mix(in srgb, var(--theme-accent) 22%, transparent);
		color: var(--theme-text, white);
		cursor: pointer;
		transition: background var(--duration-fast, 150ms) ease;
	}

	.confirm-create:hover:not(:disabled) {
		background: color-mix(in srgb, var(--theme-accent) 34%, transparent);
	}

	.confirm-create:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.confirm-create:focus-visible {
		outline: 2px solid var(--theme-accent);
		outline-offset: 2px;
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

	.signed-out {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 10px;
		padding: clamp(40px, 12cqh, 96px) 24px;
		text-align: center;
	}

	.signed-out-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 64px;
		height: 64px;
		border-radius: 18px;
		background: color-mix(in srgb, var(--theme-accent) 14%, transparent);
		color: color-mix(in srgb, var(--theme-accent) 80%, white);
		font-size: 24px;
	}

	.signed-out-title {
		margin: 0;
		font-size: var(--font-size-base, 16px);
		font-weight: 600;
		color: var(--theme-text, white);
	}

	.signed-out-hint {
		margin: 0;
		max-width: 380px;
		font-size: var(--font-size-sm, 14px);
		line-height: 1.5;
		color: var(--theme-text-dim, rgba(255, 255, 255, 0.65));
	}

	@media (prefers-reduced-motion: reduce) {
		.add-tile,
		.confirm-create {
			transition: none;
		}
		.tile-skeleton {
			animation: none;
		}
	}
</style>
