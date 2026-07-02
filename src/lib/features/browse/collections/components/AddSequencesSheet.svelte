<!--
AddSequencesSheet.svelte

Build a collection from inside it. Overlay panel hosting the full Browse
experience: the same GalleryDrill front door the gallery uses ("hunt for
what you're looking for"), handing off to BrowsePanel's filtered grid of
real pictograph cards. Tapping a card toggles it in and out of the target
collection immediately — cards already in the collection wear the selected
outline, and the header count ticks live so every tap has visible feedback.

Membership writes go through collections-state (cap guard + latency
compensation), so the detail view behind this sheet updates on its own.
-->
<script lang="ts">
	import { onMount } from "svelte";
	import { createBrowseEngine } from "$lib/shared/browse/engine/create-browse-engine.svelte";
	import BrowsePanel from "$lib/shared/browse/components/BrowsePanel.svelte";
	import GalleryDrill from "$lib/features/browse/gallery-home/GalleryDrill.svelte";
	import { collectionsState } from "$lib/features/library/state/collections-state.svelte";
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

	onMount(() => {
		engine.initialize();
		return () => engine.destroy();
	});

	// Same two-stage flow as the gallery tab: drill first, grid after.
	let view = $state<"drill" | "grid">("drill");

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

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === "Escape") onClose();
	}

	function countLabel(n: number): string {
		return `${n} ${n === 1 ? "sequence" : "sequences"}`;
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div
	class="scrim"
	role="button"
	tabindex="-1"
	aria-label="Close"
	onclick={onClose}
	onkeydown={(e) => {
		if (e.key === "Enter" || e.key === " ") onClose();
	}}
></div>

<div class="panel" role="dialog" aria-modal="true" aria-label="Add sequences">
	<header class="panel-header">
		<div class="header-text">
			<h2 class="panel-title">
				Add to {target?.name ?? "collection"}
			</h2>
			<span class="panel-count">{countLabel(memberIds.size)} inside</span>
		</div>
		<button type="button" class="close-btn" aria-label="Done" onclick={onClose}>
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
			/>
		{/if}
	</div>
</div>

<style>
	.scrim {
		position: fixed;
		inset: 0;
		z-index: 90;
		background: var(--theme-overlay-scrim, rgba(8, 8, 14, 0.78));
		backdrop-filter: blur(6px);
		border: none;
	}

	.panel {
		position: fixed;
		z-index: 91;
		left: 50%;
		top: 50%;
		transform: translate(-50%, -50%);
		width: min(96vw, 960px);
		height: min(92dvh, 780px);
		display: flex;
		flex-direction: column;
		background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
		border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
		border-radius: 14px;
		overflow: hidden;
		box-shadow: var(--shadow-modal, 0 16px 48px rgba(0, 0, 0, 0.5));
	}

	.panel-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 12px 16px;
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

	.close-btn {
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

	.close-btn:hover {
		background: color-mix(in srgb, var(--theme-accent) 34%, transparent);
	}

	.close-btn:focus-visible {
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
		.close-btn {
			transition: none;
		}
	}
</style>
