<!--
AddSequencesSheet.svelte

Build a collection from inside it. A Drawer — slide-up bottom sheet on
mobile, right-side drawer on desktop (the app's standard panel pattern) —
hosting the full Browse experience: the same GalleryDrill front door the
gallery uses ("hunt for what you're looking for"), handing off to
BrowsePanel's filtered grid of real pictograph cards. Tapping a card
toggles it in and out of the target collection immediately — cards already
in the collection wear the selected outline, and the header count ticks
live so every tap has visible feedback.

While the sheet is up the app navigation hides (browseScrollState drives
both the bottom nav and the sidebar): picking sequences is a focused task,
and the chrome behind the scrim is just noise.

Membership writes go through collections-state (cap guard + latency
compensation), so the detail view behind this sheet updates on its own.
-->
<script lang="ts">
	import { onMount, onDestroy } from "svelte";
	import Drawer from "$lib/shared/foundation/ui/Drawer.svelte";
	import { createBrowseEngine } from "$lib/shared/browse/engine/create-browse-engine.svelte";
	import BrowsePanel from "$lib/shared/browse/components/BrowsePanel.svelte";
	import GalleryDrill from "$lib/features/browse/gallery-home/GalleryDrill.svelte";
	import GalleryFilterSheet from "$lib/features/browse/gallery-home/GalleryFilterSheet.svelte";
	import { collectionsState } from "$lib/features/library/state/collections-state.svelte";
	import { browseScrollState } from "$lib/shared/browse/state/browse-scroll-state.svelte";
	import { responsiveLayoutManager } from "$lib/shared/create/services/responsive-layout-manager";
	import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
	import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";

	let {
		collectionId,
		onClose,
	}: {
		collectionId: string;
		onClose: () => void;
	} = $props();

	$effect(() => {
		collectionsState.ensureStarted();
	});

	// Live view of the target collection: name for the title, member ids for
	// the selected outlines and the ticking count.
	const target = $derived(
		collectionsState.collections.find((c) => c.id === collectionId) ?? null,
	);
	const memberIds = $derived(new Set(target?.sequenceIds ?? []));

	// Ephemeral engine (no persistKey): the hunt starts fresh every time the
	// sheet opens. My Library first — filing your own work is the common case —
	// with the Community source a toggle away.
	const engine = createBrowseEngine({
		persistKey: null,
		initialSource: "my-library",
		minColumns: 2,
	});

	// The parent mounts this component on demand, so the Drawer starts closed
	// and opens a frame later — that's what makes the slide-in animate.
	let drawerOpen = $state(false);

	// Bottom sheet on mobile, right drawer on desktop (CollectionPickerSheet's
	// exact placement logic).
	let isSideBySide = $state(false);
	let layoutUnsubscribe: (() => void) | null = null;
	const placement = $derived(isSideBySide ? "right" : "bottom");

	onMount(() => {
		engine.initialize();

		isSideBySide = responsiveLayoutManager.shouldUseSideBySideLayout();
		layoutUnsubscribe = responsiveLayoutManager.onLayoutChange(() => {
			isSideBySide = responsiveLayoutManager.shouldUseSideBySideLayout();
		});

		// Focus mode: hide the bottom nav / sidebar while picking.
		browseScrollState.hideUI();

		requestAnimationFrame(() => {
			drawerOpen = true;
		});

		return () => {
			engine.destroy();
			browseScrollState.showUI();
		};
	});

	onDestroy(() => layoutUnsubscribe?.());

	// Let the Drawer's slide-out finish before the parent unmounts us.
	const CLOSE_ANIMATION_MS = 300;
	function requestClose() {
		if (!drawerOpen) return;
		drawerOpen = false;
		setTimeout(onClose, CLOSE_ANIMATION_MS);
	}

	// Same two-stage flow as the gallery tab: drill first, grid after.
	let view = $state<"drill" | "grid">("drill");

	// Grid view carries the gallery's Filters pill → the shared drill filter
	// sheet (stacked drawer; the Drawer stack handles z-order and Escape).
	let filterSheetOpen = $state(false);

	function backToDrill() {
		// Fresh drill each time, mirroring BrowseModule's "← Start here".
		engine.clearUserFilters();
		engine.setSearch("");
		view = "drill";
	}

	function handleSelect(seq: SequenceData) {
		getHapticFeedback()?.trigger("selection");
		void collectionsState.toggle(seq.id, collectionId);
	}

	function countLabel(n: number): string {
		return `${n} ${n === 1 ? "sequence" : "sequences"}`;
	}
</script>

<Drawer
	isOpen={drawerOpen}
	{placement}
	closeOnBackdrop={true}
	closeOnEscape={true}
	dismissible={true}
	showHandle={placement === "bottom"}
	ariaLabel="Add sequences"
	class="add-sequences-drawer"
	onOpenChange={(open) => {
		if (!open) requestClose();
	}}
>
	<div class="sheet-content">
		<header class="panel-header">
			<div class="header-text">
				<h2 class="panel-title">
					Add to {target?.name ?? "collection"}
				</h2>
				<span class="panel-count">{countLabel(memberIds.size)} inside</span>
			</div>
			<button type="button" class="done-btn" aria-label="Done" onclick={requestClose}>
				<i class="fas fa-check" aria-hidden="true"></i>
				<span>Done</span>
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
					selectedIds={memberIds}
					onSelect={handleSelect}
					onBack={backToDrill}
					backLabel="Start here"
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
	/* Near-full-height bottom sheet: the browse grid needs room, and a fixed
	   height (not content-sized) lets the panel body flex-fill. */
	:global(.add-sequences-drawer[data-placement="bottom"]) {
		height: 92dvh;
		--sheet-max-height: 92dvh;
	}

	:global(.add-sequences-drawer[data-placement="right"]) {
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
		justify-content: space-between;
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
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.panel-count {
		font-size: var(--font-size-compact, 12px);
		color: var(--theme-text-dim, rgba(255, 255, 255, 0.65));
		font-variant-numeric: tabular-nums;
	}

	.done-btn {
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
		transition: background var(--duration-fast, 150ms) ease;
	}

	.done-btn:hover {
		background: color-mix(in srgb, var(--theme-accent) 34%, transparent);
	}

	.done-btn:focus-visible {
		outline: 2px solid var(--theme-accent);
		outline-offset: 2px;
	}

	.panel-body {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
	}

	/* BrowsePanel's root is height:100%; the drill scrolls on its own. */
	.panel-body > :global(*) {
		flex: 1;
		min-height: 0;
	}

	.drill-host {
		overflow-y: auto;
		padding: 12px;
	}

	@media (prefers-reduced-motion: reduce) {
		.done-btn {
			transition: none;
		}
	}
</style>
