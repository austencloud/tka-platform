<!--
CollectionPickerContent.svelte

The add-to-collection picker body, with no sheet chrome so it can live inside
the Drawer-based CollectionPickerSheet (browse card menu) OR inline inside the
save dialog. Collections render as toggle chips (FilterChipBase, aria-pressed —
no checkboxes); Favorites sorts first via its sortOrder. An inline "New
collection" row creates and selects in one step.

Two modes:
  - live   → operates on a real, saved sequenceId; toggles write to Firestore
             immediately through collections-state.
  - select → operates on a bindable selectedIds list (the sequence isn't saved
             yet, e.g. the save dialog); the parent applies membership on save.
-->
<script lang="ts">
	import FilterChipBase from "$lib/shared/browse/components/filter-chips/FilterChipBase.svelte";
	import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
	import { collectionsState } from "$lib/features/library/state/collections-state.svelte";
	import type { LibraryCollection } from "$lib/shared/library/domain/models/collection";

	let {
		mode = "live",
		sequenceId,
		selectedIds = $bindable<string[]>([]),
		onChange,
		sequenceLabel,
	}: {
		mode?: "live" | "select";
		/** Required in live mode: the saved sequence to file. */
		sequenceId?: string;
		/** Select mode: the collection ids chosen so far (parent-owned). */
		selectedIds?: string[];
		/** Select mode: fired with the new id list on every change. */
		onChange?: (ids: string[]) => void;
		/** Optional name of the sequence being filed, shown in the header. */
		sequenceLabel?: string;
	} = $props();

	$effect(() => {
		collectionsState.ensureStarted();
	});

	const collections = $derived(collectionsState.collections);
	const loading = $derived(collectionsState.loading);

	let showInput = $state(false);
	let newName = $state("");
	let creating = $state(false);

	function isMember(c: LibraryCollection): boolean {
		return mode === "live"
			? !!sequenceId && collectionsState.isIn(sequenceId, c.id)
			: selectedIds.includes(c.id);
	}

	function handleToggle(c: LibraryCollection): void {
		getHapticFeedback()?.trigger("selection");
		if (mode === "live") {
			if (sequenceId) void collectionsState.toggle(sequenceId, c.id);
			return;
		}
		const next = isMember(c)
			? selectedIds.filter((id) => id !== c.id)
			: [...selectedIds, c.id];
		selectedIds = next;
		onChange?.(next);
	}

	async function handleCreate(): Promise<void> {
		const name = newName.trim();
		if (!name || creating) return;
		creating = true;
		try {
			if (mode === "live") {
				if (sequenceId) await collectionsState.createAndAdd(name, sequenceId);
			} else {
				const created = await collectionsState.create(name);
				if (created) {
					const next = [...selectedIds, created.id];
					selectedIds = next;
					onChange?.(next);
				}
			}
			newName = "";
			showInput = false;
		} finally {
			creating = false;
		}
	}

	function handleInputKeydown(e: KeyboardEvent): void {
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

<div class="collection-picker">
	{#if sequenceLabel}
		<p class="picker-subtitle">Filing <strong>{sequenceLabel}</strong></p>
	{/if}

	{#if loading && collections.length === 0}
		<div class="chip-grid" aria-hidden="true">
			{#each Array(4) as _}
				<span class="chip-skeleton"></span>
			{/each}
		</div>
	{:else}
		{#if collections.length === 0}
			<p class="picker-empty">No collections yet. Name your first one below.</p>
		{:else}
			<div class="chip-grid" role="group" aria-label="Collections">
				{#each collections as c (c.id)}
					<FilterChipBase
						mode="toggle"
						label={c.name}
						icon={c.icon}
						active={isMember(c)}
						count={c.sequenceCount}
						chipColor={c.color}
						onclick={() => handleToggle(c)}
					/>
				{/each}
			</div>
		{/if}

		<!-- Reserved-height slot: the action chip and the input occupy the same
		     row so expanding to type never shifts the chips above it. -->
		<div class="new-collection-slot">
			{#if showInput}
				<div class="new-collection-input">
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
				<FilterChipBase
					mode="action"
					label="New collection"
					icon="fa-plus"
					onclick={() => (showInput = true)}
				/>
			{/if}
		</div>
	{/if}
</div>

<style>
	.collection-picker {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 4px;
	}

	.picker-subtitle {
		margin: 0;
		font-size: var(--font-size-sm, 14px);
		color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
	}

	.picker-subtitle strong {
		color: var(--theme-text, white);
		font-weight: 600;
	}

	.picker-empty {
		margin: 0;
		font-size: var(--font-size-sm, 14px);
		color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
	}

	.chip-grid {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}

	.chip-skeleton {
		width: 96px;
		height: var(--min-touch-target, 44px);
		border-radius: 100px;
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

	/* Reserve the row height so switching between the action chip and the text
	   input never reflows the chips above (no-layout-shift). */
	.new-collection-slot {
		min-height: var(--min-touch-target, 44px);
		display: flex;
		align-items: center;
	}

	.new-collection-input {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
	}

	.name-field {
		flex: 1;
		min-width: 0;
		height: var(--min-touch-target, 44px);
		padding: 0 14px;
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
		border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
		border-radius: 100px;
		color: var(--theme-text, white);
		font-size: var(--font-size-sm, 14px);
		font-family: inherit;
	}

	.name-field:focus {
		outline: none;
		border-color: color-mix(in srgb, var(--theme-accent) 50%, transparent);
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--theme-accent) 12%, transparent);
	}

	.name-field::placeholder {
		color: color-mix(in srgb, var(--theme-text-dim, #888) 70%, transparent);
	}

	.confirm-create {
		flex-shrink: 0;
		width: var(--min-touch-target, 44px);
		height: var(--min-touch-target, 44px);
		display: flex;
		align-items: center;
		justify-content: center;
		border: 1px solid color-mix(in srgb, var(--theme-accent) 40%, transparent);
		border-radius: 50%;
		background: color-mix(in srgb, var(--theme-accent) 20%, transparent);
		color: var(--theme-text, white);
		cursor: pointer;
		transition: background var(--duration-fast, 150ms) ease;
	}

	.confirm-create:hover:not(:disabled) {
		background: color-mix(in srgb, var(--theme-accent) 32%, transparent);
	}

	.confirm-create:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.confirm-create:focus-visible {
		outline: 2px solid var(--theme-accent);
		outline-offset: 2px;
	}

	@media (prefers-reduced-motion: reduce) {
		.chip-skeleton {
			animation: none;
		}
		.confirm-create {
			transition: none;
		}
	}
</style>
