<!--
CollectionCard.svelte

One collection in the My Collections grid. Clicking the card opens the
collection; the kebab button (or a right-click) opens Rename / Delete.
Favorites is a system collection — it can't be renamed or deleted, so its
kebab is hidden entirely rather than showing a menu of disabled entries.

Renaming swaps the card body for an inline input (Enter saves, Escape
cancels) so the user never leaves the grid. Deleting asks for confirmation
first and only removes the folder — the sequences inside stay in the library.
-->
<script lang="ts">
	import type { LibraryCollection } from "$lib/shared/library/domain/models/collection";
	import { isSystemCollection } from "$lib/shared/library/domain/models/collection";
	import { collectionsState } from "$lib/features/library/state/collections-state.svelte";
	import ContextMenu from "$lib/shared/components/context-menu/ContextMenu.svelte";
	import type {
		ContextMenuEntry,
		ContextMenuState,
	} from "$lib/shared/components/context-menu/context-menu-types";
	import ConfirmDialog from "$lib/shared/foundation/ui/ConfirmDialog.svelte";
	import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";

	let {
		collection,
		onOpen,
	}: {
		collection: LibraryCollection;
		onOpen: () => void;
	} = $props();

	const isSystem = $derived(isSystemCollection(collection));
	const tileColor = $derived(collection.color ?? "var(--theme-accent)");

	let menuState: ContextMenuState = $state({ open: false });
	let renaming = $state(false);
	let renameValue = $state("");
	let saving = $state(false);
	let deleteConfirmOpen = $state(false);

	const menuItems: ContextMenuEntry[] = $derived.by(() => [
		{
			id: "rename",
			label: "Rename",
			icon: "fa-pen",
			action() {
				menuState = { open: false };
				renameValue = collection.name;
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

	function openMenuAt(x: number, y: number) {
		if (isSystem) return;
		menuState = { open: true, x, y };
	}

	function handleKebab(e: MouseEvent) {
		e.stopPropagation();
		const target = e.currentTarget as HTMLElement;
		const rect = target.getBoundingClientRect();
		openMenuAt(rect.left, rect.bottom + 4);
	}

	function handleContextMenu(e: MouseEvent) {
		if (isSystem) return;
		e.preventDefault();
		openMenuAt(e.clientX, e.clientY);
	}

	async function commitRename() {
		if (saving) return;
		const name = renameValue.trim();
		if (!name || name === collection.name) {
			renaming = false;
			return;
		}
		saving = true;
		try {
			await collectionsState.rename(collection.id, name);
		} finally {
			saving = false;
			renaming = false;
		}
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
		await collectionsState.remove(collection.id);
	}

	function countLabel(n: number): string {
		return `${n} ${n === 1 ? "sequence" : "sequences"}`;
	}
</script>

{#if renaming}
	<div class="collection-card rename-mode" style="--tile-color: {tileColor};">
		<span class="tile-icon">
			<i class={`fas ${collection.icon ?? "fa-folder"}`} aria-hidden="true"></i>
		</span>
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
	</div>
{:else}
	<div class="collection-card" style="--tile-color: {tileColor};">
		<button
			type="button"
			class="card-main"
			onclick={() => {
				getHapticFeedback()?.trigger("selection");
				onOpen();
			}}
			oncontextmenu={handleContextMenu}
		>
			<span class="tile-icon">
				<i class={`fas ${collection.icon ?? "fa-folder"}`} aria-hidden="true"></i>
			</span>
			<span class="tile-text">
				<span class="tile-name">{collection.name}</span>
				<span class="tile-count">{countLabel(collection.sequenceCount)}</span>
			</span>
		</button>

		{#if !isSystem}
			<button
				type="button"
				class="kebab"
				aria-label={`Options for ${collection.name}`}
				onclick={handleKebab}
			>
				<i class="fas fa-ellipsis-vertical" aria-hidden="true"></i>
			</button>
		{/if}
	</div>
{/if}

<ContextMenu {menuState} items={menuItems} onClose={() => (menuState = { open: false })} />

<ConfirmDialog
	bind:isOpen={deleteConfirmOpen}
	title={`Delete "${collection.name}"?`}
	message="The collection goes away, but every sequence in it stays in your library."
	confirmText="Delete"
	cancelText="Keep"
	variant="danger"
	onConfirm={performDelete}
	onCancel={() => (deleteConfirmOpen = false)}
/>

<style>
	.collection-card {
		display: flex;
		align-items: stretch;
		min-height: 72px;
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
		border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
		border-radius: 14px;
		overflow: hidden;
		transition:
			background var(--duration-fast, 150ms) ease,
			border-color var(--duration-fast, 150ms) ease,
			transform var(--duration-fast, 150ms) ease;
	}

	.collection-card:hover {
		border-color: color-mix(in srgb, var(--tile-color) 45%, transparent);
		background: color-mix(in srgb, var(--tile-color) 8%, var(--theme-card-bg));
	}

	.collection-card:active {
		transform: scale(0.98);
	}

	.card-main {
		flex: 1;
		min-width: 0;
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 14px 16px;
		text-align: left;
		background: none;
		border: none;
		color: var(--theme-text, white);
		cursor: pointer;
		font: inherit;
	}

	.card-main:focus-visible {
		outline: 2px solid var(--tile-color);
		outline-offset: -2px;
		border-radius: 14px;
	}

	.tile-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 44px;
		height: 44px;
		flex-shrink: 0;
		border-radius: 12px;
		background: color-mix(in srgb, var(--tile-color) 20%, transparent);
		color: var(--tile-color);
		font-size: 17px;
	}

	.tile-text {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}

	.tile-name {
		font-size: var(--font-size-sm, 14px);
		font-weight: 600;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.tile-count {
		font-size: var(--font-size-compact, 12px);
		color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
		font-variant-numeric: tabular-nums;
	}

	.kebab {
		flex-shrink: 0;
		width: 44px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: none;
		border: none;
		color: var(--theme-text-dim, rgba(255, 255, 255, 0.55));
		cursor: pointer;
		transition: color var(--duration-fast, 150ms) ease;
	}

	.kebab:hover {
		color: var(--theme-text, white);
	}

	.kebab:focus-visible {
		outline: 2px solid var(--tile-color);
		outline-offset: -2px;
		border-radius: 10px;
	}

	.rename-mode {
		align-items: center;
		gap: 14px;
		padding: 14px 16px;
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

	@media (prefers-reduced-motion: reduce) {
		.collection-card,
		.kebab {
			transition: none;
		}
		.collection-card:active {
			transform: none;
		}
	}
</style>
