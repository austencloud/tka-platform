<!--
SmartCollectionBuilderSheet.svelte

Build (or edit) a Smart Collection's rule. Same drill → filter → preview
scaffold as AddSequencesSheet, but the preview grid is read-only and the
footer names + saves the rule (create) or updates it (edit). Reuses the shared
browse engine so every filter the gallery offers is available here for free.
-->
<script lang="ts">
	import { onMount, onDestroy } from "svelte";
	import Drawer from "$lib/shared/foundation/ui/Drawer.svelte";
	import { createBrowseEngine } from "$lib/shared/browse/engine/create-browse-engine.svelte";
	import { loadCanonicalTnDSequences } from "$lib/features/browse/gallery-home/canonical-tnd-pool";
	import BrowsePanel from "$lib/shared/browse/components/BrowsePanel.svelte";
	import GalleryDrill from "$lib/features/browse/gallery-home/GalleryDrill.svelte";
	import GalleryFilterSheet from "$lib/features/browse/gallery-home/GalleryFilterSheet.svelte";
	import { collectionsState } from "$lib/features/library/state/collections-state.svelte";
	import { browseScrollState } from "$lib/shared/browse/state/browse-scroll-state.svelte";
	import { responsiveLayoutManager } from "$lib/shared/create/services/responsive-layout-manager";
	import {
		applySpecToEngine,
		buildFilterSpecFromEngine,
	} from "$lib/shared/browse/services/smart-filter-spec";
	import type { SmartFilterSpec } from "$lib/shared/library/domain/models/collection";
	import { toast } from "$lib/shared/toast/state/toast-state.svelte";

	let {
		mode,
		editCollectionId,
		initialSpec,
		onClose,
	}: {
		mode: "create" | "edit";
		/** Required in edit mode: the collection whose rule is being changed. */
		editCollectionId?: string;
		/** Edit mode: seed the engine with the existing rule. */
		initialSpec?: SmartFilterSpec;
		onClose: () => void;
	} = $props();

	// Ephemeral engine — both sources available so the builder can target the
	// community pool or the user's own library. Inject the canonical T&D alphabet
	// into the community pool (same as the main gallery / BrowseModule) so a rule
	// built against it previews the real matches instead of an empty grid.
	const engine = createBrowseEngine({
		persistKey: null,
		initialSource: initialSpec?.source ?? "community",
		minColumns: 2,
		extraCommunitySequences: loadCanonicalTnDSequences,
	});

	let drawerOpen = $state(false);
	let isSideBySide = $state(false);
	let layoutUnsubscribe: (() => void) | null = null;
	const placement = $derived(isSideBySide ? "right" : "bottom");

	let name = $state("");
	let saving = $state(false);

	onMount(() => {
		if (initialSpec) applySpecToEngine(engine, initialSpec);
		engine.initialize();

		isSideBySide = responsiveLayoutManager.shouldUseSideBySideLayout();
		layoutUnsubscribe = responsiveLayoutManager.onLayoutChange(() => {
			isSideBySide = responsiveLayoutManager.shouldUseSideBySideLayout();
		});

		browseScrollState.hideUI();
		requestAnimationFrame(() => (drawerOpen = true));

		return () => {
			engine.destroy();
			browseScrollState.showUI();
		};
	});

	onDestroy(() => layoutUnsubscribe?.());

	const CLOSE_ANIMATION_MS = 300;
	function requestClose() {
		if (!drawerOpen) return;
		drawerOpen = false;
		setTimeout(onClose, CLOSE_ANIMATION_MS);
	}

	// Two-stage flow like AddSequencesSheet: drill first, grid preview after.
	let view = $state<"drill" | "grid">(initialSpec ? "grid" : "drill");
	let filterSheetOpen = $state(false);

	function backToDrill() {
		engine.clearUserFilters();
		engine.setSearch("");
		view = "drill";
	}

	async function save() {
		const trimmed = name.trim();
		if (!engine.hasActiveFilters) {
			toast.error("Add at least one filter to define the rule.");
			return;
		}
		if (mode === "create" && !trimmed) {
			toast.error("Name your smart collection.");
			return;
		}
		if (saving) return;
		saving = true;
		const spec = buildFilterSpecFromEngine(engine);
		const matchCount = engine.resultCount;
		let ok = false;
		if (mode === "edit" && editCollectionId) {
			ok = await collectionsState.updateFilterSpec(editCollectionId, spec, matchCount);
		} else {
			ok = !!(await collectionsState.createSmart(trimmed, spec, matchCount));
		}
		saving = false;
		if (ok) {
			toast.success(mode === "edit" ? "Rule updated." : `Smart collection "${trimmed}" saved.`);
			requestClose();
		}
	}
</script>

<Drawer
	isOpen={drawerOpen}
	{placement}
	closeOnBackdrop={true}
	closeOnEscape={true}
	dismissible={true}
	showHandle={placement === "bottom"}
	ariaLabel={mode === "edit" ? "Edit rule" : "New smart collection"}
	class="smart-builder-drawer"
	onOpenChange={(open) => {
		if (!open) requestClose();
	}}
>
	<div class="sheet-content">
		<header class="panel-header">
			<div class="header-text">
				<h2 class="panel-title">
					{mode === "edit" ? "Edit rule" : "New smart collection"}
				</h2>
				<span class="panel-count">{engine.resultCount} match now</span>
			</div>
			{#if mode === "create"}
				<input
					type="text"
					class="name-field"
					placeholder="Name"
					aria-label="Smart collection name"
					bind:value={name}
					maxlength="60"
				/>
			{/if}
			<button
				type="button"
				class="save-btn"
				onclick={save}
				disabled={saving}
			>
				<i class="fas fa-wand-magic-sparkles" aria-hidden="true"></i>
				<span>{mode === "edit" ? "Save rule" : "Save"}</span>
			</button>
		</header>

		<div class="panel-body">
			{#if view === "drill"}
				<div class="drill-host">
					<GalleryDrill
						pool={engine.allSequences}
						getCount={(type, value) => engine.getFilteredCount(type, value)}
						onApply={(type, value, label, color) => {
							engine.addFilter(type, value, label, color ?? "#6aa0ff");
							view = "grid";
						}}
						onShowAll={() => (view = "grid")}
						onSearch={(q) => {
							engine.setSearch(q);
							view = "grid";
						}}
					/>
				</div>
			{:else}
				<BrowsePanel
					{engine}
					layout="compact"
					showSourceToggle
					onBack={backToDrill}
					backLabel="Start here"
					hideToolbarSearch
					onOpenFilters={() => (filterSheetOpen = true)}
				/>
			{/if}
		</div>

		<GalleryFilterSheet
			{engine}
			bind:isOpen={filterSheetOpen}
			isMobile={placement === "bottom"}
		/>
	</div>
</Drawer>

<style>
	:global(.smart-builder-drawer[data-placement="bottom"]) {
		height: 92dvh;
		--sheet-max-height: 92dvh;
	}

	:global(.smart-builder-drawer[data-placement="right"]) {
		--sheet-width: min(760px, 94vw);
	}

	.sheet-content {
		display: flex;
		flex-direction: column;
		height: 100%;
		min-height: 0;
		overflow: hidden;
	}

	.panel-header {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 8px 16px 12px;
		border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
		flex-shrink: 0;
	}

	.header-text {
		display: flex;
		flex-direction: column;
		gap: 1px;
		min-width: 0;
	}

	.panel-title {
		margin: 0;
		font-size: var(--font-size-lg, 18px);
		font-weight: 700;
		color: var(--theme-text, white);
		white-space: nowrap;
	}

	.panel-count {
		font-size: var(--font-size-compact, 12px);
		color: var(--theme-text-dim, rgba(255, 255, 255, 0.65));
		font-variant-numeric: tabular-nums;
	}

	.name-field {
		margin-left: auto;
		min-width: 0;
		max-width: 220px;
		height: 44px;
		padding: 0 14px;
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
		border: 1.5px solid color-mix(in srgb, var(--theme-accent) 45%, transparent);
		border-radius: 12px;
		color: var(--theme-text, white);
		font-size: var(--font-size-sm, 14px);
		font-family: inherit;
	}

	.save-btn {
		display: flex;
		align-items: center;
		gap: 8px;
		height: 44px;
		padding: 0 18px;
		flex-shrink: 0;
		border: 1px solid color-mix(in srgb, var(--theme-accent) 45%, transparent);
		border-radius: 12px;
		background: color-mix(in srgb, var(--theme-accent) 22%, transparent);
		color: var(--theme-text, white);
		font-size: var(--font-size-sm, 14px);
		font-weight: 600;
		cursor: pointer;
	}

	/* When there's no name field (edit mode), the save button is the first
	   right-aligned control. */
	.panel-header > .save-btn:nth-child(2) {
		margin-left: auto;
	}

	.save-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.panel-body {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
	}

	.panel-body > :global(*) {
		flex: 1;
		min-height: 0;
	}

	.drill-host {
		overflow-y: auto;
		padding: 12px;
	}
</style>
