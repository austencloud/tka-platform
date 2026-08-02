<!--
CollectionDetailView.svelte

Inside one collection: header (back, icon, name, count, options) above the
same sequence grid the gallery uses, showing just this collection's members.

The collection doc is a live subscription for both owned and community
collections, so changes from another device update the member list immediately.
Members are re-sorted to match the collection's own sequenceIds order because
batched Firestore reads return them shuffled. If the collection disappears or
becomes private while open, we bail back to the list instead of showing a ghost.
-->
<script lang="ts">
	import { untrack } from "svelte";
	import type { LibraryCollection } from "$lib/shared/library/domain/models/collection";
	import { isSystemCollection } from "$lib/shared/library/domain/models/collection";
	import type { LibrarySequence } from "$lib/shared/library/domain/models/library-sequence";
	import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
	import {
		subscribeToCollection,
		getCollectionSequences,
	} from "$lib/shared/library/services/collection-manager";
	import {
		getUserCollectionSequences,
		subscribeToPublicCollection,
	} from "$lib/features/library/services/public-collection-loader";
	import { collectionsState } from "$lib/features/library/state/collections-state.svelte";
	import { followedCollectionsState } from "$lib/features/library/state/followed-collections-state.svelte";
	import { communityCollectionsState } from "../state/community-collections-state.svelte";
	import { openSequenceViewer } from "$lib/shared/sequence-viewer/services/sequence-viewer-navigator";
	import BrowseGrid from "$lib/features/browse/sequences/display/components/BrowseGrid.svelte";
	import ContextMenu from "$lib/shared/components/context-menu/ContextMenu.svelte";
	import type {
		ContextMenuEntry,
		ContextMenuState,
	} from "$lib/shared/components/context-menu/context-menu-types";
	import ConfirmDialog from "$lib/shared/foundation/ui/ConfirmDialog.svelte";
	import AddSequencesSheet from "./AddSequencesSheet.svelte";
	import ScanCardSheet from "./ScanCardSheet.svelte";
	import { consumePendingScanIntent } from "$lib/features/browse/state/pending-scan-intent.svelte";
	import SelectionToolbar from "$lib/shared/components/selection/SelectionToolbar.svelte";
	import { createMultiSelectionState } from "$lib/shared/selection/state/create-multi-selection-state.svelte";
	import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
	import { openCollectionPickerForSequences } from "$lib/features/library/state/collection-picker-state.svelte";
	import { getLibraryRepository } from "$lib/shared/library/get-library-repository";
	import { authState } from "$lib/shared/auth/state/auth-state.svelte";
	import { toast } from "$lib/shared/toast/state/toast-state.svelte";

	let {
		collectionId,
		onBack,
		foreignOwnerId = null,
		ownerName,
		showBack = true,
	}: {
		collectionId: string;
		onBack: () => void;
		/**
		 * The desktop split view keeps the collection rail on screen, so a back
		 * arrow would be a second way to do what the rail already does — hide it.
		 * (onBack stays wired: a deleted collection still needs somewhere to go.)
		 */
		showBack?: boolean;
		/**
		 * Set when viewing someone ELSE's public collection (Community view).
		 * Read-only: no rename/delete/remove, but still live across devices.
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
	let memberLoadEpoch = 0;

	const selectionState = createMultiSelectionState({
		getAllIds: () => members.map((member) => member.id),
		onModeChange: () => getHapticFeedback()?.trigger("selection"),
	});

	const isSystem = $derived(!!collection && isSystemCollection(collection));
	const tileColor = $derived(collection?.color ?? "var(--theme-accent)");

	$effect(() => {
		const id = collectionId;
		const owner = foreignOwnerId;
		firstSnapshotSeen = false;
		collection = null;
		members = [];
		loadingMembers = true;
		untrack(() => selectionState.exit());
		memberLoadEpoch++;

		if (owner) {
			// Follow state powers the header button; idempotent if already live.
			followedCollectionsState.ensureStarted();
			let previousFingerprint: string | null = null;
			const unsubscribe = subscribeToPublicCollection(
				owner,
				id,
				(col) => {
					firstSnapshotSeen = true;
					if (!col) {
						memberLoadEpoch++;
						onBack();
						return;
					}

					collection = col;
					const fingerprint =
						`${col.updatedAt.getTime()}:${col.sequenceCount}:` +
						col.sequenceIds.join("\u0000");
					if (fingerprint !== previousFingerprint) {
						previousFingerprint = fingerprint;
						void loadForeignMembers(owner, id, col);
					}
				},
				(err) => {
					console.error("[CollectionDetail] Public collection subscription failed:", err);
					loadingMembers = false;
				},
			);
			return () => {
				memberLoadEpoch++;
				unsubscribe();
			};
		}

		const unsubscribe = subscribeToCollection(id, (col) => {
			const wasFirst = !firstSnapshotSeen;
			firstSnapshotSeen = true;

			if (!col) {
				// Deleted (or never existed) — a detail view of nothing helps no one.
				memberLoadEpoch++;
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
				memberLoadEpoch++;
				members = sortByCollectionOrder(
					members.filter((m) => col.sequenceIds.includes(m.id)),
					col.sequenceIds,
				);
				loadingMembers = false;
			}
		});

		return () => {
			memberLoadEpoch++;
			unsubscribe();
		};
	});

	async function loadForeignMembers(
		owner: string,
		id: string,
		col: LibraryCollection,
	) {
		const epoch = ++memberLoadEpoch;
		loadingMembers = true;
		try {
			const fetched = await getUserCollectionSequences(owner, id);
			if (
				epoch !== memberLoadEpoch ||
				id !== collectionId ||
				owner !== foreignOwnerId
			) return;
			members = sortByCollectionOrder(fetched, col.sequenceIds);
		} catch (err) {
			console.error("[CollectionDetail] Failed to load public collection:", err);
		} finally {
			if (
				epoch === memberLoadEpoch &&
				id === collectionId &&
				owner === foreignOwnerId
			) {
				loadingMembers = false;
			}
		}
	}

	async function loadMembers(id: string, col: LibraryCollection) {
		const epoch = ++memberLoadEpoch;
		loadingMembers = true;
		try {
			const fetched = await getCollectionSequences(id);
			// Guard against a stale response after the user navigated to another
			// collection while this fetch was in flight.
			if (epoch !== memberLoadEpoch || id !== collectionId) return;
			members = sortByCollectionOrder(fetched, col.sequenceIds);
		} catch (err) {
			console.error("[CollectionDetail] Failed to load members:", err);
		} finally {
			if (epoch === memberLoadEpoch && id === collectionId) {
				loadingMembers = false;
			}
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

	function toggleSelection(sequence: SequenceData): void {
		selectionState.toggle(sequence.id);
		getHapticFeedback()?.trigger("selection");
	}

	function selectAllMembers(): void {
		selectionState.selectAll();
		getHapticFeedback()?.trigger("selection");
	}

	function clearSelection(): void {
		selectionState.clear();
		getHapticFeedback()?.trigger("selection");
	}

	function openAddSelectedToCollection(): void {
		if (selectionState.selectedCount === 0) return;
		openCollectionPickerForSequences({
			sequenceIds: [...selectionState.selectedIds],
			onComplete: () => selectionState.exit(),
		});
	}

	let removingSelected = $state(false);

	async function removeSelectedFromCollection(): Promise<void> {
		if (removingSelected || selectionState.selectedCount === 0) return;
		const selectedIds = [...selectionState.selectedIds];
		removingSelected = true;

		try {
			const result = await collectionsState.removeMany(selectedIds, collectionId);
			if (!result) return;

			selectionState.removeIds([
				...result.removedSequenceIds,
				...result.alreadyAbsentSequenceIds,
			]);
			if (
				result.unprocessedSequenceIds.length === 0 ||
				selectionState.selectedCount === 0
			) {
				selectionState.exit();
			}
		} finally {
			removingSelected = false;
		}
	}

	let sequenceDeleteConfirmOpen = $state(false);
	let sequenceDeleteTargets = $state<string[]>([]);
	let deletingSequences = $state(false);

	const sequenceDeleteTitle = $derived(
		sequenceDeleteTargets.length === 1
			? "Permanently delete this sequence?"
			: `Permanently delete ${sequenceDeleteTargets.length} sequences?`,
	);
	const sequenceDeleteMessage = $derived(
		sequenceDeleteTargets.length === 1
			? "This removes the sequence from your library, this device, and the community gallery. It can't be undone."
			: "This removes the selected sequences from your library, this device, and the community gallery. It can't be undone.",
	);

	function openSequenceDelete(): void {
		const selectedIds = [...selectionState.selectedIds];
		if (selectedIds.length === 0) return;

		const currentUserId = authState.effectiveUserId;
		const includesSharedSequence = selectedIds.some((sequenceId) => {
			const member = members.find((sequence) => sequence.id === sequenceId);
			return !!member?.ownerId && member.ownerId !== currentUserId;
		});
		if (includesSharedSequence) {
			toast.info(
				"Shared sequences can be filed into your collections, but only your own sequences can be permanently deleted.",
			);
			return;
		}

		sequenceDeleteTargets = selectedIds;
		sequenceDeleteConfirmOpen = true;
	}

	async function deleteSelectedSequences(): Promise<void> {
		if (deletingSequences || sequenceDeleteTargets.length === 0) return;
		const ids = [...sequenceDeleteTargets];
		deletingSequences = true;

		try {
			await getLibraryRepository().deleteSequences(ids);
			toast.success(
				ids.length === 1
					? "Sequence permanently deleted"
					: `${ids.length} sequences permanently deleted`,
			);
			selectionState.exit();
			sequenceDeleteTargets = [];
		} catch (error) {
			console.error("[CollectionDetail] Permanent delete failed:", error);
			toast.error(
				ids.length === 1
					? "Sequence wasn't deleted. Try again."
					: "Some sequences weren't deleted. Try again.",
			);
		} finally {
			deletingSequences = false;
		}
	}

	function cancelSequenceDelete(): void {
		sequenceDeleteConfirmOpen = false;
		sequenceDeleteTargets = [];
	}

	// Build-from-inside: the add-sequences browser overlay.
	let addSheetOpen = $state(false);
	// File physical cards: the camera scan sheet. A phone that arrived via the
	// desktop's handoff QR (?scan=1 deep link) has a pending intent stashed —
	// consume it (one-shot) and open the scanner straight away. Foreign
	// (read-only) collections never scan.
	const pendingScan = consumePendingScanIntent();
	let scanSheetOpen = $state(pendingScan === collectionId && !foreignOwnerId);

	// ── Header options (rename / delete) ─────────────────────────────
	let menuState: ContextMenuState = $state({ open: false });
	let renaming = $state(false);
	let renameValue = $state("");
	let deleteConfirmOpen = $state(false);

	const menuItems: ContextMenuEntry[] = $derived.by(() => {
		const items: ContextMenuEntry[] = [
			{
				id: "select-sequences",
				label: "Select sequences",
				icon: "fa-check-double",
				disabled: loadingMembers || members.length === 0,
				action() {
					menuState = { open: false };
					selectionState.enter();
				},
			},
		];

		if (!isSystem) {
			items.push(
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
				{ type: "separator" },
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
			);
		}

		return items;
	});

	function handleOptions(e: MouseEvent) {
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		menuState = { open: true, x: rect.right, y: rect.bottom + 4 };
	}

	async function commitRename() {
		const name = renameValue.trim();
		renaming = false;
		if (!collection || !name || name === collection.name) return;
		const wasPublic = collection.isPublic;
		const ok = await collectionsState.rename(collectionId, name);
		// A public collection's name is showing in the Community feed too.
		if (ok && wasPublic) communityCollectionsState.invalidate();
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
		const wasPublic = collection?.isPublic ?? false;
		const ok = await collectionsState.remove(collectionId);
		if (ok) {
			// A deleted public collection would ghost in the cached Community feed.
			if (wasPublic) communityCollectionsState.invalidate();
			onBack();
		}
	}

	function countLabel(n: number): string {
		return `${n} ${n === 1 ? "sequence" : "sequences"}`;
	}

	// Foreign collections arrive with sequenceCount already normalized to
	// PUBLIC members (public-collection-loader module invariant), so the
	// header shows it immediately — no blank while members stream in. Owners
	// see their own full-id count.
	const visibleCount = $derived(
		foreignOwnerId
			? (collection?.sequenceCount ?? null)
			: (collection?.sequenceIds.length ?? null),
	);
</script>

<div class="collection-detail" style="--tile-color: {tileColor};">
	{#if selectionState.active}
		<SelectionToolbar
			selectedCount={selectionState.selectedCount}
			totalCount={members.length}
			primaryLabel="Remove from this collection"
			primaryIcon="fa-folder-minus"
			onPrimaryAction={removeSelectedFromCollection}
			primaryBusy={removingSelected}
			secondaryLabel="Add to collection…"
			secondaryIcon="fa-folder-plus"
			onSecondaryAction={openAddSelectedToCollection}
			dangerLabel="Delete permanently"
			dangerIcon="fa-trash"
			onDangerAction={openSequenceDelete}
			onSelectAll={selectAllMembers}
			onClearSelection={clearSelection}
			showClearAction={false}
			actionsDisabled={removingSelected}
			onExitSelection={selectionState.exit}
		/>
	{:else}
		<header class="detail-header">
		{#if showBack}
			<button type="button" class="back-btn" aria-label="Back to collections" onclick={onBack}>
				<i class="fas fa-arrow-left" aria-hidden="true"></i>
			</button>
		{/if}

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
					{#if ownerName}by {ownerName} · {/if}{visibleCount !== null
						? countLabel(visibleCount)
						: ""}
				</span>
			</div>
		{/if}

		{#if collection && foreignOwnerId}
			{@const following = followedCollectionsState.isFollowed(foreignOwnerId, collectionId)}
			<button
				type="button"
				class="add-btn follow-btn"
				class:following
				aria-pressed={following}
				onclick={() => {
					if (following) {
						void followedCollectionsState.unfollow(foreignOwnerId, collectionId);
					} else {
						void followedCollectionsState.follow(foreignOwnerId, collectionId);
					}
				}}
			>
				<i class={`fas ${following ? "fa-check" : "fa-plus"}`} aria-hidden="true"></i>
				<span>{following ? "Following" : "Follow"}</span>
			</button>
		{/if}

		{#if collection && !renaming && !foreignOwnerId}
			<button
				type="button"
				class="add-btn"
				aria-label="Add"
				onclick={() => (addSheetOpen = true)}
			>
				<i class="fas fa-plus" aria-hidden="true"></i>
				<span>Add</span>
			</button>
			<button
				type="button"
				class="scan-btn"
				aria-label="Scan"
				onclick={() => (scanSheetOpen = true)}
			>
				<i class="fas fa-qrcode" aria-hidden="true"></i>
				<span>Scan</span>
			</button>
		{/if}

		{#if collection && !renaming && !foreignOwnerId}
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
	{/if}

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
						Hunt through your library or the community gallery and tap
						sequences to add them.
					{/if}
				</p>
				{#if !foreignOwnerId}
					<button
						type="button"
						class="empty-cta"
						onclick={() => (addSheetOpen = true)}
					>
						<i class="fas fa-plus" aria-hidden="true"></i>
						<span>Add sequences</span>
					</button>
					<button
						type="button"
						class="empty-cta"
						onclick={() => (scanSheetOpen = true)}
					>
						<i class="fas fa-qrcode" aria-hidden="true"></i>
						<span>Scan a card</span>
					</button>
				{/if}
			</div>
		{:else}
			<BrowseGrid
				sequences={members}
				thumbnailService={null}
				onAction={handleSequenceAction}
				selectedIds={selectionState.selectedIds}
				selectionMode={selectionState.active}
				onSelectionToggle={toggleSelection}
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

<ConfirmDialog
	bind:isOpen={sequenceDeleteConfirmOpen}
	title={sequenceDeleteTitle}
	message={sequenceDeleteMessage}
	confirmText="Delete permanently"
	cancelText="Keep"
	variant="danger"
	onConfirm={deleteSelectedSequences}
	onCancel={cancelSequenceDelete}
/>

{#if addSheetOpen && !foreignOwnerId}
	<AddSequencesSheet {collectionId} onClose={() => (addSheetOpen = false)} />
{/if}

{#if scanSheetOpen && !foreignOwnerId}
	<ScanCardSheet {collectionId} onClose={() => (scanSheetOpen = false)} />
{/if}

<style>
	.collection-detail {
		display: flex;
		flex-direction: column;
		height: 100%;
		min-height: 0;
		container-type: inline-size;
		container-name: gallery;
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

	/* The add button is the first right-aligned control; options follows it.
	   (Options never renders without add, so the auto margin lives here.) */
	.add-btn {
		margin-left: auto;
		display: flex;
		align-items: center;
		gap: 8px;
		height: 44px;
		padding: 0 16px;
		flex-shrink: 0;
		border: 1px solid color-mix(in srgb, var(--tile-color) 45%, transparent);
		border-radius: 12px;
		background: color-mix(in srgb, var(--tile-color) 18%, transparent);
		color: var(--theme-text, white);
		font-size: var(--font-size-sm, 14px);
		font-weight: 600;
		cursor: pointer;
		transition: background var(--duration-fast, 150ms) ease;
	}

	.add-btn:hover {
		background: color-mix(in srgb, var(--tile-color) 30%, transparent);
	}

	.add-btn:focus-visible {
		outline: 2px solid var(--tile-color);
		outline-offset: 2px;
	}

	/* Follow/Following swap: reserve the wider state so the button's edge
	   doesn't jump when the label changes. */
	.follow-btn {
		min-width: 128px;
		justify-content: center;
	}

	.follow-btn.following {
		background: color-mix(in srgb, var(--tile-color) 32%, transparent);
	}

	/* Same look as .add-btn, minus the auto margin (Add stays the first
	   right-aligned control; Scan sits between it and options). */
	.scan-btn {
		display: flex;
		align-items: center;
		gap: 8px;
		height: 44px;
		padding: 0 16px;
		flex-shrink: 0;
		border: 1px solid color-mix(in srgb, var(--tile-color) 45%, transparent);
		border-radius: 12px;
		background: color-mix(in srgb, var(--tile-color) 18%, transparent);
		color: var(--theme-text, white);
		font-size: var(--font-size-sm, 14px);
		font-weight: 600;
		cursor: pointer;
		transition: background var(--duration-fast, 150ms) ease;
	}

	.scan-btn:hover {
		background: color-mix(in srgb, var(--tile-color) 30%, transparent);
	}

	.scan-btn:focus-visible {
		outline: 2px solid var(--tile-color);
		outline-offset: 2px;
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
		flex: 1 1 auto;
		min-width: 0;
		overflow: hidden;
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
		display: block;
		min-width: 0;
		overflow: hidden;
		font-size: var(--font-size-compact, 12px);
		line-height: 1.2;
		color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
		font-variant-numeric: tabular-nums;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	@container gallery (max-width: 520px) {
		.detail-header {
			gap: 8px;
			padding-inline: 8px;
		}

		.add-btn,
		.scan-btn {
			width: 44px;
			padding: 0;
			justify-content: center;
		}

		.add-btn span,
		.scan-btn span {
			display: none;
		}
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

	.empty-cta {
		display: flex;
		align-items: center;
		gap: 8px;
		height: 44px;
		padding: 0 20px;
		margin-top: 6px;
		border: 1px solid color-mix(in srgb, var(--tile-color) 45%, transparent);
		border-radius: 12px;
		background: color-mix(in srgb, var(--tile-color) 18%, transparent);
		color: var(--theme-text, white);
		font-size: var(--font-size-sm, 14px);
		font-weight: 600;
		cursor: pointer;
		transition: background var(--duration-fast, 150ms) ease;
	}

	.empty-cta:hover {
		background: color-mix(in srgb, var(--tile-color) 30%, transparent);
	}

	.empty-cta:focus-visible {
		outline: 2px solid var(--tile-color);
		outline-offset: 2px;
	}

	@media (prefers-reduced-motion: reduce) {
		.back-btn,
		.options-btn,
		.scan-btn {
			transition: none;
		}
		.card-skeleton {
			animation: none;
		}
	}
</style>
