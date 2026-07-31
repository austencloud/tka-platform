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
	import DrawerHeader from "$lib/shared/foundation/ui/DrawerHeader.svelte";
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
	import SegmentedControl from "$lib/shared/ui/components/SegmentedControl.svelte";
	import PanelButton from "$lib/shared/components/panel/PanelButton.svelte";
	import PanelState from "$lib/shared/components/panel/PanelState.svelte";
	import FilterChipBase from "$lib/shared/browse/components/filter-chips/FilterChipBase.svelte";

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

	const SOURCE_OPTIONS = [
		{ value: "community", label: "Community" },
		{ value: "my-library", label: "My Library" },
	] as const;

	const currentSpec = $derived.by(() => buildFilterSpecFromEngine(engine));
	const canSave = $derived(
		engine.hasActiveFilters &&
			(mode === "edit" || name.trim().length > 0) &&
			!saving,
	);
	const matchStatus = $derived(
		engine.error
			? "Matches unavailable"
			: engine.isLoading
				? "Checking matches"
				: `${engine.resultCount} ${engine.resultCount === 1 ? "match" : "matches"}`,
	);

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

	let filterSheetOpen = $state(false);
	let previewExpanded = $state(false);

	async function save() {
		const trimmed = name.trim();
		if (!engine.hasActiveFilters) {
			toast.error("Add at least one filter to define the rule.");
			return;
		}
		if (mode === "create" && !trimmed) {
			toast.error("Name this Smart Collection.");
			return;
		}
		if (saving) return;
		saving = true;
		const matchCount = engine.resultCount;
		let ok = false;
		if (mode === "edit" && editCollectionId) {
			ok = await collectionsState.updateFilterSpec(
				editCollectionId,
				currentSpec,
				matchCount,
			);
		} else {
			ok = !!(await collectionsState.createSmart(
				trimmed,
				currentSpec,
				matchCount,
			));
		}
		saving = false;
		if (ok) {
			toast.success(
				mode === "edit"
					? "Rule updated."
					: `Smart Collection "${trimmed}" saved.`,
			);
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
		<div class="builder-header">
			<DrawerHeader
				title={mode === "edit" ? "Edit Smart Collection" : "New Smart Collection"}
				subtitle={mode === "edit"
					? "Change the source or filters."
					: "Name it, then add one or more filters."}
				icon="fa-wand-magic-sparkles"
				iconColor="var(--theme-accent)"
				onClose={requestClose}
			/>
		</div>

		<div class="rule-setup" class:rule-selected={engine.hasActiveFilters}>
			{#if mode === "create"}
				<label class="field-group" for="smart-builder-name">
					<span>Collection name</span>
					<input
						id="smart-builder-name"
						name="smart-collection-name"
						type="text"
						class="name-field"
						placeholder="Example: Level 1 practice"
						aria-label="Smart Collection name"
						bind:value={name}
						maxlength="60"
						autocomplete="off"
					/>
				</label>
			{/if}

			<div class="field-group source-field">
				<span id="smart-source-label">Look for matches in</span>
				<SegmentedControl
					options={[...SOURCE_OPTIONS]}
					value={engine.source}
					onchange={(source) => void engine.setSource(source)}
					color="accent"
					semantics="radiogroup"
					ariaLabelledby="smart-source-label"
				/>
			</div>
		</div>

		<div class="panel-body">
			{#if !engine.hasActiveFilters}
				<div class="drill-host">
					<GalleryDrill
						pool={engine.allSequences}
						persistSection={false}
						showCollections={false}
						showAll={false}
						chooserTitle="Add the first filter"
						chooserHint="Choose one way to narrow the collection."
						getCount={(type, value) => engine.getFilteredCount(type, value)}
						onApply={(type, value, label, color) => {
							engine.addFilter(type, value, label, color ?? "#6aa0ff");
						}}
					/>
				</div>
			{:else}
				<section class="filter-step" aria-labelledby="smart-filter-step-title">
					<header class="filter-step-head">
						<div class="filter-step-copy">
							<span class="step-label">Filters</span>
							<h3 id="smart-filter-step-title">What belongs here</h3>
							<p>Every filter below must match.</p>
						</div>
						<div class="filter-step-action">
							<PanelButton
								variant="primary"
								onclick={() => {
									previewExpanded = false;
									filterSheetOpen = true;
								}}
							>
								<i class="fas fa-plus" aria-hidden="true"></i>
								Add another filter
							</PanelButton>
						</div>
					</header>

					<div class="applied-filters" role="list" aria-label="Applied filters">
						{#each currentSpec.filters as filter (filter.key)}
							<span role="listitem">
								<FilterChipBase
									label={filter.label}
									icon="fas fa-xmark"
									active
									mode="action"
									size="sm"
									chipColor={filter.chipColor}
									ariaLabel={`Remove ${filter.label} filter`}
									onclick={() => {
										engine.removeFilter(filter.key);
										if (!engine.hasActiveFilters) previewExpanded = false;
									}}
								/>
							</span>
						{/each}
					</div>
				</section>

				<section
					class="preview-stage"
					class:preview-collapsed={!previewExpanded}
					aria-label="Matching sequence preview"
				>
					{#if previewExpanded}
						<header class="preview-head">
							<div>
								<span class="step-label">Live preview</span>
								<h3>{matchStatus}</h3>
							</div>
							<PanelButton
								variant="secondary"
								ariaLabel="Hide matching sequence preview"
								onclick={() => (previewExpanded = false)}
							>
								<i class="fas fa-eye-slash" aria-hidden="true"></i>
								Hide preview
							</PanelButton>
						</header>
						<div class="preview-grid">
							<BrowsePanel
								{engine}
								layout="compact"
								showToolbar={false}
								showFilterBar={false}
							/>
						</div>
					{:else if engine.error}
						<PanelState
							type="error"
							title="Couldn't update the matches"
							message="Check your connection, then try again."
							onretry={() => engine.refresh()}
							compact
						/>
					{:else if engine.isLoading}
						<PanelState
							type="loading"
							title="Checking the filters"
							message="The match count will update when the source is ready."
							compact
						/>
					{:else}
						<PanelState
							type="info"
							icon="fa-eye"
							compact
							title={`${engine.resultCount} ${
								engine.resultCount === 1
									? "sequence matches this rule"
									: "sequences match this rule"
							}`}
						>
							{#snippet actions()}
								<PanelButton
									variant="secondary"
									onclick={() => (previewExpanded = true)}
								>
									<i class="fas fa-eye" aria-hidden="true"></i>
									Show matching sequences
								</PanelButton>
							{/snippet}
						</PanelState>
					{/if}
				</section>
			{/if}
		</div>

		<footer class="save-footer">
			<p>
				{#if !engine.hasActiveFilters}
					Add a filter to continue.
				{:else if mode === "create" && !name.trim()}
					Add a name to save.
				{:else}
					{engine.resultCount}
					{engine.resultCount === 1 ? "sequence matches" : "sequences match"} now.
				{/if}
			</p>
			<PanelButton
				variant="primary"
				disabled={!canSave}
				onclick={() => void save()}
			>
				<i
					class={`fas ${saving ? "fa-circle-notch fa-spin" : "fa-wand-magic-sparkles"}`}
					aria-hidden="true"
				></i>
				{saving
					? "Saving"
					: mode === "edit"
						? "Save rule"
						: "Save Smart Collection"}
			</PanelButton>
		</footer>

		<GalleryFilterSheet
			{engine}
			bind:isOpen={filterSheetOpen}
			isMobile={placement === "bottom"}
			allowSearch={false}
			allowShowAll={false}
			title="Add another filter"
			chooserTitle="Choose what to filter by"
			chooserHint="Your current filters stay applied."
		/>
	</div>
</Drawer>

<style>
	:global(.smart-builder-drawer[data-placement="bottom"]) {
		height: 92dvh;
		--sheet-max-height: 92dvh;
	}

	:global(.smart-builder-drawer[data-placement="right"]) {
		--sheet-width: min(clamp(760px, 42vw, 1760px), 94vw);
	}

	.sheet-content {
		display: flex;
		flex-direction: column;
		height: 100%;
		min-height: 0;
		overflow: hidden;
	}

	.builder-header {
		flex: 0 0 auto;
	}

	.rule-setup {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 12px;
		padding: 12px 16px;
		border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
		flex-shrink: 0;
		background: color-mix(
			in srgb,
			var(--theme-panel-bg, #11131a) 92%,
			transparent
		);
	}

	.field-group {
		display: flex;
		min-width: 0;
		flex-direction: column;
		gap: 6px;
		color: var(--theme-text, white);
		font-size: var(--font-size-sm, 14px);
		font-weight: 650;
	}

	.name-field {
		width: 100%;
		min-width: 0;
		height: var(--min-touch-target, 44px);
		padding: 0 14px;
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
		border: 1.5px solid color-mix(in srgb, var(--theme-accent) 45%, transparent);
		border-radius: 12px;
		color: var(--theme-text, white);
		font-size: var(--font-size-sm, 14px);
		font-family: inherit;
	}

	.name-field::placeholder {
		color: var(--theme-text-dim, rgba(255, 255, 255, 0.52));
	}

	.name-field:focus-visible {
		border-color: var(--theme-accent);
		outline: none;
		box-shadow: 0 0 0 3px
			color-mix(in srgb, var(--theme-accent) 16%, transparent);
	}

	.panel-body {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
	}

	.drill-host {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
	}

	.filter-step {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		flex: 0 0 auto;
		gap: 12px 16px;
		padding: 14px 16px;
		border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
		background: color-mix(
			in srgb,
			var(--theme-accent) 6%,
			var(--theme-panel-bg, #11131a)
		);
	}

	.filter-step-head {
		display: contents;
	}

	.filter-step-copy {
		min-width: 0;
	}

	.step-label {
		display: block;
		margin-bottom: 2px;
		color: var(--theme-accent);
		font-size: var(--font-size-compact, 12px);
		font-weight: 750;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}

	.filter-step h3,
	.preview-head h3 {
		margin: 0;
		color: var(--theme-text, white);
		font-size: var(--font-size-base, 16px);
		font-weight: 700;
	}

	.filter-step p {
		margin: 3px 0 0;
		color: var(--theme-text-dim, rgba(255, 255, 255, 0.65));
		font-size: var(--font-size-sm, 14px);
	}

	.filter-step-action {
		display: flex;
		grid-column: 2;
		grid-row: 1;
		align-items: center;
	}

	.applied-filters {
		display: flex;
		grid-column: 1 / -1;
		flex-wrap: wrap;
		gap: 8px;
	}

	.preview-stage {
		display: flex;
		flex: 1;
		min-height: 0;
		flex-direction: column;
		overflow: hidden;
	}

	.preview-stage.preview-collapsed {
		flex: 0 0 auto;
		border-bottom: 1px solid
			var(--theme-stroke, rgba(255, 255, 255, 0.1));
	}

	.preview-head {
		display: flex;
		flex: 0 0 auto;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 10px 16px;
		border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
	}

	.preview-grid {
		flex: 1;
		min-height: 0;
	}

	.save-footer {
		display: flex;
		flex: 0 0 auto;
		align-items: center;
		justify-content: flex-end;
		gap: 16px;
		padding: 12px 16px;
		border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
		background: color-mix(
			in srgb,
			var(--theme-panel-bg, #11131a) 96%,
			transparent
		);
	}

	.save-footer p {
		min-width: 0;
		flex: 1;
		margin: 0;
		color: var(--theme-text-dim, rgba(255, 255, 255, 0.65));
		font-size: var(--font-size-sm, 14px);
		font-variant-numeric: tabular-nums;
		line-height: 1.35;
		text-align: right;
	}

	@media (max-width: 560px) {
		.rule-setup {
			grid-template-columns: 1fr;
			gap: 10px;
			padding: 10px 12px;
		}

		.rule-setup.rule-selected {
			grid-template-columns: repeat(2, minmax(0, 1fr));
			align-items: end;
			gap: 8px;
			padding: 8px 10px;
		}

		.rule-selected .field-group {
			gap: 4px;
			font-size: var(--font-size-compact, 12px);
		}

		.save-footer {
			gap: 10px;
			padding: 10px 12px;
		}

		.save-footer p {
			max-width: 120px;
			font-size: var(--font-size-compact, 12px);
		}

		.save-footer :global(.panel-btn) {
			flex: 1;
		}

		.filter-step {
			grid-template-columns: 1fr;
			gap: 10px;
			padding: 12px;
		}

		.filter-step-action {
			grid-column: 1;
			grid-row: auto;
		}

		.filter-step-action :global(.panel-btn) {
			width: 100%;
		}

		.preview-head {
			padding: 8px 12px;
		}
	}

	@media (min-width: 700px) and (max-height: 520px) {
		:global(.smart-builder-drawer[data-placement="bottom"]) {
			height: 100dvh;
			--sheet-max-height: 100dvh;
		}

		.sheet-content {
			display: grid;
			grid-template-columns: minmax(280px, 34%) minmax(0, 1fr);
			grid-template-rows: auto minmax(0, 1fr) auto;
		}

		.builder-header {
			grid-column: 1 / -1;
			grid-row: 1;
		}

		.builder-header :global(.drawer-header) {
			padding: 8px 14px;
		}

		.builder-header :global(.drawer-header-subtitle) {
			display: none;
		}

		.rule-setup {
			grid-column: 1;
			grid-row: 2;
			grid-template-columns: 1fr;
			align-content: start;
			overflow-y: auto;
			padding: 8px 10px;
			border-right: 1px solid
				var(--theme-stroke, rgba(255, 255, 255, 0.1));
			border-bottom: 0;
		}

		.panel-body {
			grid-column: 2;
			grid-row: 2;
		}

		.save-footer {
			grid-column: 1 / -1;
			grid-row: 3;
			padding: 8px 12px;
		}
	}

	@media (min-width: 2600px) and (min-height: 720px) {
		.sheet-content {
			--font-size-compact: clamp(12px, 0.38vw, 16px);
			--font-size-sm: clamp(14px, 0.44vw, 18px);
			--font-size-base: clamp(16px, 0.5vw, 20px);
			--font-size-md: var(--font-size-base);
			--font-size-lg: clamp(18px, 0.56vw, 22px);
			--font-size-xl: clamp(20px, 0.66vw, 26px);
			--font-size-2xl: clamp(24px, 0.78vw, 32px);
			--min-touch-target: clamp(44px, 1.35vw, 56px);
		}

		.builder-header :global(.drawer-header) {
			padding: clamp(20px, 0.7vw, 28px) clamp(24px, 0.85vw, 34px);
		}

		.rule-setup {
			gap: clamp(12px, 0.45vw, 18px);
			padding: clamp(12px, 0.55vw, 22px) clamp(16px, 0.75vw, 30px);
		}

		.field-group {
			gap: clamp(6px, 0.24vw, 10px);
		}

		.name-field {
			padding-inline: clamp(14px, 0.5vw, 20px);
			border-radius: clamp(12px, 0.36vw, 15px);
		}

		.save-footer {
			gap: clamp(16px, 0.55vw, 22px);
			padding: clamp(12px, 0.5vw, 20px) clamp(16px, 0.75vw, 30px);
		}
	}
</style>
