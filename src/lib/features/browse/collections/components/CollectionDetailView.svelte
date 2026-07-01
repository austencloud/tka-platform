<!--
CollectionDetailView.svelte

Inside one collection: header (back, icon, name, count, options) above the
same sequence grid the gallery uses, showing just this collection's members.

The collection doc is a live subscription, so a remove (from a card's menu,
here or anywhere else) updates the member list immediately. Members are
fetched once and re-sorted to match the collection's own sequenceIds order —
the batched Firestore reads return them shuffled otherwise. If the collection
disappears while open (deleted on another device), we bail back to the list
instead of showing a ghost.
-->
<script lang="ts">
	import type { LibraryCollection } from "$lib/shared/library/domain/models/collection";
	import { isSystemCollection } from "$lib/shared/library/domain/models/collection";
	import type { LibrarySequence } from "$lib/shared/library/domain/models/library-sequence";
	import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
	import {
		subscribeToCollection,
		getCollectionSequences,
	} from "$lib/shared/library/services/collection-manager";
	import {
		getUserPublicCollections,
		getUserCollectionSequences,
	} from "$lib/features/library/services/public-collection-loader";
	import { collectionsState } from "$lib/features/library/state/collections-state.svelte";
	import { openSequenceViewer } from "$lib/shared/sequence-viewer/services/sequence-viewer-navigator";
	import BrowseGrid from "$lib/features/browse/sequences/display/components/BrowseGrid.svelte";
	import ContextMenu from "$lib/shared/components/context-menu/ContextMenu.svelte";
	import type {
		ContextMenuEntry,
		ContextMenuState,
	} from "$lib/shared/components/context-menu/context-menu-types";
	import ConfirmDialog from "$lib/shared/foundation/ui/ConfirmDialog.svelte";

	let {
		collectionId,
		onBack,
		foreignOwnerId = null,
		ownerName,
	}: {
		collectionId: string;
		onBack: () => void;
		/**
		 * Set when viewing someone ELSE's public collection (Community view).
		 * Read-only: no rename/delete/remove, one-shot fetch instead of a live
		 * subscription (you can't edit it, so there's nothing to stay live for).
		 */
		foreignOwnerId?: string | null;
		/** Creator credit shown under the name for foreign collections. */
		ownerName?: string;
	} = $props();

	let collection = $state<LibraryCollection | null>(null);
	let members = $state<LibrarySequence[]>([]);
	let loadingMembers = $state(true);
	// The subscription's first answer decides "exists" vs "deleted"; until it
	// lands we can't tell the difference, so we hold off on the bail-out.
	let firstSnapshotSeen = $state(false);

	const isSystem = $derived(!!collection && isSystemCollection(collection));
	const tileColor = $derived(collection?.color ?? "var(--theme-accent)");

	$effect(() => {
		const id = collectionId;
		const owner = foreignOwnerId;
		firstSnapshotSeen = false;
		collection = null;
		members = [];
		loadingMembers = true;

		// Someone else's public collection: one-shot read, nothing to keep live.
		if (owner) {
			void loadForeign(owner, id);
			return;
		}

		const unsubscribe = subscribeToCollection(id, (col) => {
			const wasFirst = !firstSnapshotSeen;
			firstSnapshotSeen = true;

			if (!col) {
				// Deleted (or never existed) — a detail view of nothing helps no one.
				onBack();
				return;
			}

			const previousIds = collection?.sequenceIds;
			collection = col;

			if (wasFirst) {
				void loadMembers(id, col);
				return;
			}

			// Live update after the initial load. Removals we can apply locally;
			// an addition means a sequence we haven't fetched yet, so refetch.
			const hasNewId = col.sequenceIds.some(
				(sid) => !previousIds?.includes(sid),
			);
			if (hasNewId) {
				void loadMembers(id, col);
			} else {
				members = sortByCollectionOrder(
					members.filter((m) => col.sequenceIds.includes(m.id)),
					col.sequenceIds,
				);
			}
		});

		return unsubscribe;
	});

	async function loadForeign(owner: string, id: string) {
		try {
			// The loader only serves public collections, so a private/deleted one
			// comes back missing — bail to the list rather than render a ghost.
			const publicCollections = await getUserPublicCollections(owner);
			if (id !== collectionId) return;
			const col = publicCollections.find((c) => c.id === id) ?? null;
			if (!col) {
				onBack();
				return;
			}
			collection = col;

			const fetched = await getUserCollectionSequences(owner, id);
			if (id !== collectionId) return;
			members = sortByCollectionOrder(fetched, col.sequenceIds);
		} catch (err) {
			console.error("[CollectionDetail] Failed to load public collection:", err);
		} finally {
			if (id === collectionId) loadingMembers = false;
		}
	}

	async function loadMembers(id: string, col: LibraryCollection) {
		loadingMembers = true;
		try {
			const fetched = await getCollectionSequences(id);
			// Guard against a stale response after the user navigated to another
			// collection while this fetch was in flight.
			if (id !== collectionId) return;
			members = sortByCollectionOrder(fetched, col.sequenceIds);
		} catch (err) {
			console.error("[CollectionDetail] Failed to load members:", err);
		} finally {
			if (id === collectionId) loadingMembers = false;
		}
	}

	function sortByCollectionOrder(
		seqs: LibrarySequence[],
		orderedIds: readonly string[],
	): LibrarySequence[] {
		const rank = new Map(orderedIds.map((sid, i) => [sid, i]));
		return [...seqs].sort(
			(a, b) => (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity),
		);
	}

	function handleSequenceAction(action: string, sequence: SequenceData) {
		if (action === "view-detail") {
			openSequenceViewer(sequence, {
				returnPath: "/browse",
				returnLabel: collection?.name ?? "Collection",
			});
		}
	}

	function handleRemoveFromCollection(sequenceId: string) {
		// toggle() sees the sequence is a member and removes it; the collection
		// subscription then drops it from the grid.
		void collectionsState.toggle(sequenceId, collectionId);
	}

	// ── Header options (rename / delete) ─────────────────────────────
	let menuState: ContextMenuState = $state({ open: false });
	let renaming = $state(false);
	let renameValue = $state("");
	let deleteConfirmOpen = $state(false);

	const menuItems: ContextMenuEntry[] = $derived.by(() => [
		{
			id: "rename",
			label: "Rename",
			icon: "fa-pen",
			action() {
				menuState = { open: false };
				renameValue = collection?.name ?? "";
				renaming = true;
			},
		},
		{ type: "separator" } as ContextMenuEntry,
		{
			id: "delete",
			label: "Delete collection",
			icon: "fa-trash",
			danger: true,
			action() {
				menuState = { open: false };
				deleteConfirmOpen = true;
			},
		},
	]);

	function handleOptions(e: MouseEvent) {
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		menuState = { open: true, x: rect.right, y: rect.bottom + 4 };
	}

	async function commitRename() {
		const name = renameValue.trim();
		renaming = false;
		if (!collection || !name || name === collection.name) return;
		await collectionsState.rename(collectionId, name);
	}

	function handleRenameKeydown(e: KeyboardEvent) {
		if (e.key === "Enter") {
			e.preventDefault();
			void commitRename();
		} else if (e.key === "Escape") {
			e.preventDefault();
			renaming = false;
		}
	}

	async function performDelete() {
		deleteConfirmOpen = false;
		const ok = await collectionsState.remove(collectionId);
		if (ok) onBack();
	}

	function countLabel(n: number): string {
		return `${n} ${n === 1 ? "sequence" : "sequences"}`;
	}
</script>

<div class="collection-detail" style="--tile-color: {tileColor};">
	<header class="detail-header">
		<button type="button" class="back-btn" aria-label="Back to collections" onclick={onBack}>
			<i class="fas fa-arrow-left" aria-hidden="true"></i>
		</button>

		<span class="header-icon">
			<i class={`fas ${collection?.icon ?? "fa-folder"}`} aria-hidden="true"></i>
		</span>

		{#if renaming}
			<!-- svelte-ignore a11y_autofocus -->
			<input
				type="text"
				class="rename-field"
				aria-label="Collection name"
				bind:value={renameValue}
				onkeydown={handleRenameKeydown}
				onblur={() => void commitRename()}
				maxlength="60"
				autofocus
			/>
		{:else}
			<div class="header-text">
				<h2 class="header-name">{collection?.name ?? ""}</h2>
				<span class="header-count">
					{#if ownerName}by {ownerName} · {/if}{collection
						? countLabel(collection.sequenceIds.length)
						: ""}
				</span>
			</div>
		{/if}

		{#if collection && !isSystem && !renaming && !foreignOwnerId}
			<button
				type="button"
				class="options-btn"
				aria-label="Collection options"
				onclick={handleOptions}
			>
				<i class="fas fa-ellipsis-vertical" aria-hidden="true"></i>
			</button>
		{/if}
	</header>

	<div class="detail-body">
		{#if loadingMembers}
			<div class="skeleton-grid" aria-hidden="true">
				{#each Array(6) as _}
					<span class="card-skeleton"></span>
				{/each}
			</div>
		{:else if members.length === 0}
			<div class="empty-state">
				<span class="empty-icon">
					<i class={`fas ${collection?.icon ?? "fa-folder-open"}`} aria-hidden="true"></i>
				</span>
				<p class="empty-title">Nothing here yet</p>
				<p class="empty-hint">
					{#if foreignOwnerId}
						This collection doesn't have any public sequences right now.
					{:else}
						Add sequences from the gallery — right-click (or long-press) a card
						and choose "Add to collection…", or file one while saving.
					{/if}
				</p>
			</div>
		{:else}
			<BrowseGrid
				sequences={members}
				thumbnailService={null}
				onAction={handleSequenceAction}
				collectionContext={foreignOwnerId
					? undefined
					: {
							id: collectionId,
							name: collection?.name ?? "this collection",
							onRemove: handleRemoveFromCollection,
						}}
			/>
		{/if}
	</div>
</div>

<ContextMenu {menuState} items={menuItems} onClose={() => (menuState = { open: false })} />

<ConfirmDialog
	bind:isOpen={deleteConfirmOpen}
	title={`Delete "${collection?.name ?? "collection"}"?`}
	message="The collection goes away, but every sequence in it stays in your library."
	confirmText="Delete"
	cancelText="Keep"
	variant="danger"
	onConfirm={performDelete}
	onCancel={() => (deleteConfirmOpen = false)}
/>

<style>
	.collection-detail {
		display: flex;
		flex-direction: column;
		height: 100%;
		min-height: 0;
	}

	.detail-header {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 10px 12px;
		flex-shrink: 0;
	}

	.back-btn,
	.options-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 44px;
		height: 44px;
		flex-shrink: 0;
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
		border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
		border-radius: 12px;
		color: var(--theme-text, white);
		cursor: pointer;
		transition:
			background var(--duration-fast, 150ms) ease,
			border-color var(--duration-fast, 150ms) ease;
	}

	.back-btn:hover,
	.options-btn:hover {
		border-color: color-mix(in srgb, var(--tile-color) 45%, transparent);
		background: color-mix(in srgb, var(--tile-color) 10%, var(--theme-card-bg));
	}

	.back-btn:focus-visible,
	.options-btn:focus-visible {
		outline: 2px solid var(--tile-color);
		outline-offset: 2px;
	}

	.options-btn {
		margin-left: auto;
	}

	.header-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 40px;
		height: 40px;
		flex-shrink: 0;
		border-radius: 11px;
		background: color-mix(in srgb, var(--tile-color) 20%, transparent);
		color: var(--tile-color);
		font-size: 16px;
	}

	.header-text {
		display: flex;
		flex-direction: column;
		gap: 1px;
		min-width: 0;
	}

	.header-name {
		margin: 0;
		font-size: clamp(16px, 2.4cqi, 20px);
		font-weight: 700;
		color: var(--theme-text, white);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.header-count {
		font-size: var(--font-size-compact, 12px);
		color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
		font-variant-numeric: tabular-nums;
	}

	.rename-field {
		flex: 1;
		min-width: 0;
		height: 44px;
		padding: 0 14px;
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
		border: 1.5px solid color-mix(in srgb, var(--tile-color) 45%, transparent);
		border-radius: 12px;
		color: var(--theme-text, white);
		font-size: var(--font-size-sm, 14px);
		font-family: inherit;
	}

	.rename-field:focus {
		outline: none;
		border-color: color-mix(in srgb, var(--tile-color) 70%, transparent);
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--tile-color) 14%, transparent);
	}

	.detail-body {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		padding: 4px 12px 16px;
	}

	.skeleton-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
		gap: var(--spacing-sm, 8px);
	}

	.card-skeleton {
		aspect-ratio: 1;
		border-radius: 8px;
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

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 10px;
		padding: clamp(32px, 10cqh, 80px) 24px;
		text-align: center;
	}

	.empty-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 64px;
		height: 64px;
		border-radius: 18px;
		background: color-mix(in srgb, var(--tile-color) 14%, transparent);
		color: color-mix(in srgb, var(--tile-color) 80%, white);
		font-size: 24px;
	}

	.empty-title {
		margin: 0;
		font-size: var(--font-size-base, 16px);
		font-weight: 600;
		color: var(--theme-text, white);
	}

	.empty-hint {
		margin: 0;
		max-width: 380px;
		font-size: var(--font-size-sm, 14px);
		line-height: 1.5;
		color: var(--theme-text-dim, rgba(255, 255, 255, 0.65));
	}

	@media (prefers-reduced-motion: reduce) {
		.back-btn,
		.options-btn {
			transition: none;
		}
		.card-skeleton {
			animation: none;
		}
	}
</style>
