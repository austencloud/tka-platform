<!--
SmartCollectionDetailView.svelte

A Smart Collection's detail view. Members are NOT stored — they derive live
from the saved filter rule. An ephemeral BrowseEngine loads the rule's target
pool (community or my-library), the saved filters are replayed onto it, and
the shared BrowsePanel renders the result. The rule shows as chips in the
header; "Edit rule" reopens the builder to change it.
-->
<script lang="ts">
	import { onMount, untrack } from "svelte";
	import type { LibraryCollection } from "$lib/shared/library/domain/models/collection";
	import { subscribeToCollection } from "$lib/shared/library/services/collection-manager";
	import { collectionsState } from "$lib/features/library/state/collections-state.svelte";
	import { createBrowseEngine } from "$lib/shared/browse/engine/create-browse-engine.svelte";
	import { applySpecToEngine } from "$lib/shared/browse/services/smart-filter-spec";
	import BrowsePanel from "$lib/shared/browse/components/BrowsePanel.svelte";
	import ContextMenu from "$lib/shared/components/context-menu/ContextMenu.svelte";
	import type {
		ContextMenuEntry,
		ContextMenuState,
	} from "$lib/shared/components/context-menu/context-menu-types";
	import ConfirmDialog from "$lib/shared/foundation/ui/ConfirmDialog.svelte";
	import SmartCollectionBuilderSheet from "./SmartCollectionBuilderSheet.svelte";
	import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
	import VariationPickerDrawer from "../../sequences/display/components/VariationPickerDrawer.svelte";
	import {
		getVariationPickerState,
		openVariationPicker,
		closeVariationPicker,
	} from "../../shared/state/variation-picker-state.svelte";
	import { openSequenceViewer } from "$lib/shared/sequence-viewer/services/sequence-viewer-navigator";
	import { browseScrollState } from "$lib/shared/browse/state/browse-scroll-state.svelte";
	import {
		loadCanonicalTnDSequences,
		loadCanonicalBookVariations,
	} from "$lib/features/browse/gallery-home/canonical-tnd-pool";
	import {
		isFoundingId,
		getFoundingCollection,
		toSyntheticCollection,
	} from "$lib/features/browse/collections/config/founding-collections";

	let {
		collectionId,
		onBack,
		showBack = true,
	}: {
		collectionId: string;
		onBack: () => void;
		showBack?: boolean;
	} = $props();

	let collection = $state<LibraryCollection | null>(null);

	const isFounding = $derived(!!collection && isFoundingId(collection.id));
	const tileColor = $derived(collection?.color ?? "var(--theme-accent)");
	const spec = $derived(collection?.filterSpec ?? null);
	const sourceLabel = $derived(spec?.source === "my-library" ? "My Library" : "Community");

	// One ephemeral engine for this view; its source is fixed to the rule's pool.
	// Rebuilt filters live in the engine — a rule edit clears + re-applies them.
	let engine = $state<ReturnType<typeof createBrowseEngine> | null>(null);

	// Subscribe to the collection doc so a rule edit / rename / delete elsewhere
	// reflects here. A deleted (or non-smart) doc bails to the list.
	$effect(() => {
		const id = collectionId;
		collection = null;

		// Founding collections are config-defined, not Firestore docs.
		if (isFoundingId(id)) {
			const founding = getFoundingCollection(id);
			if (!founding) {
				onBack();
				return;
			}
			collection = toSyntheticCollection(founding);
			return; // no subscription to tear down
		}

		const unsubscribe = subscribeToCollection(id, (col) => {
			if (!col || col.kind !== "smart") {
				onBack();
				return;
			}
			collection = col;
		});
		return unsubscribe;
	});

	// Build the engine once the first spec is known; re-apply filters whenever
	// the rule changes. specSignature keys the effect so an Edit-rule write
	// re-derives without recreating the engine.
	const specSignature = $derived(spec ? JSON.stringify(spec) : "");
	onMount(() => {
		return () => engine?.destroy();
	});
	$effect(() => {
		const s = spec;
		void specSignature; // re-run when the rule content changes
		if (!s) return;
		untrack(() => {
			if (!engine) {
				engine = createBrowseEngine({
					persistKey: null,
					initialSource: s.source,
					minColumns: 2,
					// Group into sections (letters / dates / levels per the rule's
					// sort) so the section-index rail populates and the grid renders
					// its headers — the read-only nav the rule view keeps.
					sections: true,
					// Inject the canonical T&D alphabet into the community pool, same
					// as the main gallery (BrowseModule). Without this a community
					// rule — e.g. a founding deck filtering AUTHOR "T&D Alphabet" —
					// sees only user sequences and matches nothing. The Book deck needs
					// the book reversal variants instead of the continuous alphabet.
					extraCommunitySequences:
						collectionId === "founding_book"
							? loadCanonicalBookVariations
							: loadCanonicalTnDSequences,
					// Founding decks (TKA 1/2/3) are the T&D alphabet — group the grid
					// by canonical TnD family (Split-Same · Water, …) in groups of 3–4
					// rather than one section per letter. Other smart collections keep
					// their sort-driven grouping.
					defaultSectionGroupBy: isFoundingId(collectionId) ? "tnd-family" : undefined,
				});
				applySpecToEngine(engine, s);
				void engine.initialize();
				return;
			}
			if (engine.source !== s.source) {
				void engine.setSource(s.source);
			}
			engine.clearUserFilters();
			applySpecToEngine(engine, s);
		});
	});

	// Self-heal the rail's cached count: once the engine finishes loading, the
	// live match count is authoritative. If the cached `sequenceCount` differs
	// (legacy smart docs stamped 0, or drift as the community pool grows), write
	// the fresh count back so the collection card reads correctly next time.
	// Best-effort; the subscribe above delivers the corrected doc, so the guard
	// prevents a re-write loop.
	$effect(() => {
		const eng = engine;
		const col = collection;
		if (!eng || !col || eng.isLoading) return;
		if (isFoundingId(col.id)) return; // config-defined, nothing to write
		const live = eng.resultCount;
		if (live !== col.sequenceCount) {
			void collectionsState.syncSmartCount(col.id, live);
		}
	});

	// ── Open a sequence in the viewer (same path as AllLibraryView) ─────────
	const pickerState = getVariationPickerState();

	function openViewer(sequence: SequenceData) {
		openSequenceViewer(sequence, {
			returnPath: "/browse/library",
			returnLabel: collection?.name ?? "Library",
			scrollY: browseScrollState.lastScrollY,
			handPathMode: engine?.viewMode.subject === "hands",
		});
	}

	function handleSelect(sequence: SequenceData, variations?: SequenceData[]) {
		if (variations && variations.length > 1) {
			openVariationPicker(variations);
		} else {
			openViewer(sequence);
		}
	}

	// ── Options menu (rename / edit rule / delete) ──────────────────────────
	let menuState: ContextMenuState = $state({ open: false });
	let renaming = $state(false);
	let renameValue = $state("");
	let deleteConfirmOpen = $state(false);
	let editOpen = $state(false);

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
</script>

<div class="collection-detail" style="--tile-color: {tileColor};">
	<header class="detail-header">
		{#if showBack}
			<button type="button" class="back-btn" aria-label="Back to collections" onclick={onBack}>
				<i class="fas fa-arrow-left" aria-hidden="true"></i>
			</button>
		{/if}

		<span class="header-icon">
			<i class={`fas ${collection?.icon ?? "fa-wand-magic-sparkles"}`} aria-hidden="true"></i>
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
					Smart · {sourceLabel}{#if engine} · {engine.resultCount} now{/if}
				</span>
			</div>
		{/if}

		{#if collection && !renaming && !isFounding}
			<button type="button" class="edit-btn" onclick={() => (editOpen = true)}>
				<i class="fas fa-sliders" aria-hidden="true"></i>
				<span>Edit rule</span>
			</button>
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

	{#if spec && spec.filters.length > 0}
		<div class="rule-chips" aria-label="Rule">
			{#each spec.filters as f (f.key)}
				<span class="rule-chip" style="--chip-color: {f.chipColor};">{f.label}</span>
			{/each}
		</div>
	{/if}

	<div class="detail-body">
		{#if engine}
			<!-- Read-only: the rule is shown as chips in the header and edited via
			     "Edit rule". Hiding BrowsePanel's toolbar + filter bar stops the
			     rule from being mutated in place (which would silently diverge from
			     the saved rule) and drops the duplicate filter chips. The section
			     rail stays on — it's read-only navigation (jump to letter / date /
			     level), not rule mutation. -->
			<BrowsePanel
				{engine}
				layout="compact"
				showToolbar={false}
				showFilterBar={false}
				showSidebar={true}
				onSelect={handleSelect}
			/>
		{/if}
	</div>
</div>

<ContextMenu {menuState} items={menuItems} onClose={() => (menuState = { open: false })} />

<VariationPickerDrawer
	isOpen={pickerState.isOpen}
	variations={pickerState.variations}
	onSelect={openViewer}
	onClose={closeVariationPicker}
/>

<ConfirmDialog
	bind:isOpen={deleteConfirmOpen}
	title={`Delete "${collection?.name ?? "collection"}"?`}
	message="The rule goes away. The sequences it matched stay in the community library."
	confirmText="Delete"
	cancelText="Keep"
	variant="danger"
	onConfirm={performDelete}
	onCancel={() => (deleteConfirmOpen = false)}
/>

{#if editOpen && collection}
	<SmartCollectionBuilderSheet
		mode="edit"
		editCollectionId={collectionId}
		initialSpec={collection.filterSpec}
		onClose={() => (editOpen = false)}
	/>
{/if}

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

	.edit-btn {
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

	.rule-chips {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		padding: 0 12px 8px;
		flex-shrink: 0;
	}

	.rule-chip {
		display: inline-flex;
		align-items: center;
		padding: 4px 12px;
		min-height: 28px;
		background: color-mix(in srgb, var(--chip-color) 12%, transparent);
		border: 1px solid color-mix(in srgb, var(--chip-color) 30%, transparent);
		border-radius: 100px;
		color: var(--theme-text);
		font-size: var(--font-size-compact, 12px);
		font-weight: 500;
		white-space: nowrap;
	}

	.detail-body {
		flex: 1;
		min-height: 0;
		overflow: hidden;
	}
</style>
