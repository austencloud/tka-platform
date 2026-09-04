<!--
  The archive uses overview + detail, not a carousel. Calendar position owns
  the horizontal axis, all four evidence lanes remain visible, and the dense
  2009–2010 period expands inside the lane that owns it. Compact screens receive
  the same records as a vertical chronology. Viewports without room for the
  persistent detail panel open one record in the shared Drawer primitive.

  Spec: docs/superpowers/specs/shipped/2026-07-27-notation-playable-archive-design.md
-->
<script lang="ts">
	import { onMount } from "svelte";
	import { MediaQuery } from "svelte/reactivity";
	import { pushState } from "$app/navigation";
	import { tilt } from "$lib/actions/tilt";
	import { cursorGlow } from "$lib/actions/cursor-glow";
	import { pressSpring } from "$lib/actions/press-spring";
	import { magnetic } from "$lib/actions/magnetic";
	import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
	import Crossfade from "$lib/shared/components/Crossfade.svelte";
	import PanelButton from "$lib/shared/components/panel/PanelButton.svelte";
	import BaseModal from "$lib/shared/foundation/ui/modal/BaseModal.svelte";
	import Drawer from "$lib/shared/foundation/ui/Drawer.svelte";
	import { DURATION } from "$lib/shared/transitions/transitions";
	import {
		ARCHIVE_END_YEAR,
		ARCHIVE_ENTRIES,
		ARCHIVE_START_YEAR,
		archiveEntry,
		archiveLane,
		type ArchiveEntry,
	} from "./_lib/archive-ledger";
	import { archiveAccent } from "./_lib/archive-appearance";
	import ArchiveTimeMap from "./ArchiveTimeMap.svelte";
	import ArchiveChronologicalIndex from "./ArchiveChronologicalIndex.svelte";
	import ArchiveRecordVisual from "./ArchiveRecordVisual.svelte";
	import ArchiveEntryDetail, { type InspectorScreen } from "./ArchiveEntryDetail.svelte";
	import ResearchSubmissionGuide from "./ResearchSubmissionGuide.svelte";

	const HASH_PREFIX = "#archive-record-";
	const DEFAULT_ENTRY_ID = "playpoi";

	let activeEntry = $state<ArchiveEntry>(archiveEntry(DEFAULT_ENTRY_ID));
	let recordDrawerOpen = $state(false);
	let drawerInspectorScreen = $state<InspectorScreen>("overview");
	let submissionOpen = $state(false);
	let announcement = $state("");

	const isCompact = new MediaQuery(
		"(max-width: 760px), (max-height: 560px)"
	);
	const isShortWide = new MediaQuery(
		"(min-width: 700px) and (max-height: 560px)"
	);
	const usesRecordDrawer = new MediaQuery(
		"(max-width: 980px), (max-height: 560px)"
	);
	const usesSideDrawer = new MediaQuery("(min-width: 700px)");
	const reduceMotion = new MediaQuery("(prefers-reduced-motion: reduce)");

	const activeIndex = $derived(
		ARCHIVE_ENTRIES.findIndex((entry) => entry.id === activeEntry.id)
	);
	const lane = $derived(archiveLane(activeEntry.lane));
	const accent = $derived(archiveAccent(activeEntry.id));
	const previousEntry = $derived(
		activeIndex > 0 ? ARCHIVE_ENTRIES[activeIndex - 1] : undefined
	);
	const nextEntry = $derived(
		activeIndex < ARCHIVE_ENTRIES.length - 1
			? ARCHIVE_ENTRIES[activeIndex + 1]
			: undefined
	);

	$effect(() => {
		if (!usesRecordDrawer.current) {
			recordDrawerOpen = false;
			drawerInspectorScreen = "overview";
		}
	});

	function entryFromHash(hash: string): ArchiveEntry | undefined {
		if (!hash.startsWith(HASH_PREFIX)) return undefined;
		const entryId = decodeURIComponent(hash.slice(HASH_PREFIX.length));
		return ARCHIVE_ENTRIES.find((entry) => entry.id === entryId);
	}

	function writeEntryHistory(entry: ArchiveEntry) {
		if (typeof window === "undefined") return;
		const nextHash = `${HASH_PREFIX}${encodeURIComponent(entry.id)}`;
		if (window.location.hash === nextHash) return;
		pushState(nextHash, { archiveRecord: entry.id });
	}

	function applyEntry(entry: ArchiveEntry, openSelectedRecord: boolean) {
		activeEntry = entry;
		drawerInspectorScreen = "overview";
		if (openSelectedRecord && usesRecordDrawer.current) recordDrawerOpen = true;
		announcement = `${entry.dateLabel}, ${entry.title}. ${archiveLane(entry.lane).label}. Record ${ARCHIVE_ENTRIES.findIndex((candidate) => candidate.id === entry.id) + 1} of ${ARCHIVE_ENTRIES.length}.`;
		getHapticFeedback().trigger("selection");
	}

	function selectEntry(entry: ArchiveEntry) {
		if (entry.id !== activeEntry.id) {
			applyEntry(entry, true);
		} else if (usesRecordDrawer.current) {
			drawerInspectorScreen = "overview";
			recordDrawerOpen = true;
		}
		writeEntryHistory(entry);
	}

	function selectNeighbor(entry: ArchiveEntry | undefined) {
		if (!entry) return;
		selectEntry(entry);
	}

	onMount(() => {
		const linkedEntry = entryFromHash(window.location.hash);
		if (linkedEntry) {
			activeEntry = linkedEntry;
			drawerInspectorScreen = "overview";
			if (usesRecordDrawer.current) recordDrawerOpen = true;
		}

		const restoreFromHistory = () => {
			const restoredEntry = entryFromHash(window.location.hash);
			if (restoredEntry) {
				activeEntry = restoredEntry;
				drawerInspectorScreen = "overview";
				if (usesRecordDrawer.current) recordDrawerOpen = true;
				return;
			}
			activeEntry = archiveEntry(DEFAULT_ENTRY_ID);
			drawerInspectorScreen = "overview";
			recordDrawerOpen = false;
		};

		window.addEventListener("popstate", restoreFromHistory);
		return () => window.removeEventListener("popstate", restoreFromHistory);
	});
</script>

<section
	class="archive-room"
	style:--artifact-accent={accent}
	aria-label={`Flow arts knowledge archive, ${ARCHIVE_START_YEAR} to ${ARCHIVE_END_YEAR}`}
>
	<header class="archive-header">
		<div>
			<p>{ARCHIVE_START_YEAR}–{ARCHIVE_END_YEAR}</p>
			<h1>Flow arts history</h1>
			<p class="premise">
				{ARCHIVE_ENTRIES.length} sourced records of how people documented flow arts and passed the knowledge on.
			</p>
		</div>
		<PanelButton
			variant="secondary"
			ariaLabel="Contribute or correct an archive record"
			onclick={() => (submissionOpen = true)}
		>
			Contribute
		</PanelButton>
	</header>

	{#if isCompact.current}
		<div class="compact-archive">
			<ArchiveChronologicalIndex
				activeEntryId={activeEntry.id}
				onselect={selectEntry}
			/>
		</div>
	{:else}
		<div class="large-archive">
			<ArchiveTimeMap
				activeEntryId={activeEntry.id}
				onselect={selectEntry}
			/>

			<!-- No id anchor here: selection is applied from the hash in onMount.
			     A native anchor jump would scroll the overflow-hidden room and
			     strand the layout partly off-screen on deep-link loads. -->
			{#if !usesRecordDrawer.current}
				<section
					class="selected-record"
					aria-label={`Selected record: ${activeEntry.title}`}
				>
				<header class="record-toolbar">
					<p aria-live="polite">
						<span>Selected record</span>
						<strong>{activeEntry.dateLabel} · {lane.label} · {activeIndex + 1} of {ARCHIVE_ENTRIES.length}</strong>
					</p>
					<nav aria-label="Previous and next archive records">
						<PanelButton
							variant="secondary"
							disabled={!previousEntry}
							ariaLabel={previousEntry ? `Previous record: ${previousEntry.title}` : "No previous record"}
							onclick={() => selectNeighbor(previousEntry)}
						>
							<span aria-hidden="true">←</span>
							<span class="neighbor-label">{previousEntry?.shortTitle ?? "Previous"}</span>
						</PanelButton>
						<PanelButton
							variant="secondary"
							disabled={!nextEntry}
							ariaLabel={nextEntry ? `Next record: ${nextEntry.title}` : "No next record"}
							onclick={() => selectNeighbor(nextEntry)}
						>
							<span class="neighbor-label">{nextEntry?.shortTitle ?? "Next"}</span>
							<span aria-hidden="true">→</span>
						</PanelButton>
					</nav>
				</header>

				<div class="record-body">
					<section
						class="artifact-stage"
						aria-label={`${activeEntry.title} artifact`}
						use:tilt={{ maxDegrees: 1.6 }}
						use:cursorGlow
					>
						<div class="artifact-viewport">
							<ArchiveRecordVisual entry={activeEntry} active />
						</div>
						<div class="artifact-actions">
							{#if activeEntry.catalogEntry?.explore}
								<a
									class="artifact-action primary"
									href={activeEntry.catalogEntry.explore.href}
									use:magnetic={!reduceMotion.current}
									use:pressSpring
								>
									{activeEntry.catalogEntry.explore.label}
									<span aria-hidden="true">→</span>
								</a>
							{:else if !activeEntry.documents?.length && activeEntry.citations[0]}
								<a
									class="artifact-action"
									href={activeEntry.citations[0].href}
									target={activeEntry.citations[0].href.startsWith("/") ? undefined : "_blank"}
									rel={activeEntry.citations[0].href.startsWith("/") ? undefined : "noopener"}
									use:pressSpring
								>
									Open primary source <span aria-hidden="true">↗</span>
								</a>
							{/if}
						</div>
					</section>

					<div class="record-inspector-host" aria-label={`${activeEntry.title} record details`}>
						{#key activeEntry.id}
							<ArchiveEntryDetail entry={activeEntry} contained />
						{/key}
					</div>
				</div>
				</section>
			{/if}
		</div>
	{/if}

	<p class="sr-only" aria-live="polite">{announcement}</p>
</section>

<Drawer
	bind:isOpen={recordDrawerOpen}
	placement={usesSideDrawer.current ? "right" : "bottom"}
	ariaLabel={`${activeEntry.title}, artifact, record, and sources`}
	showHandle={!usesSideDrawer.current}
>
	<div
		class="record-drawer"
		class:is-drilled={drawerInspectorScreen !== "overview"}
		style:--artifact-accent={accent}
	>
		<header>
			<p><span>{activeEntry.dateLabel}</span>{lane.label}</p>
			<PanelButton
				variant="secondary"
				onclick={() => {
					recordDrawerOpen = false;
					drawerInspectorScreen = "overview";
				}}
			>
				Close
			</PanelButton>
		</header>
		<div class="drawer-context">
			<Crossfade
				key={drawerInspectorScreen === "overview"}
				animateHeight
				mode="swap"
				motion="step"
				direction={drawerInspectorScreen === "overview" ? -1 : 1}
				duration={DURATION.normal}
			>
				{#if drawerInspectorScreen === "overview"}
					<div class="drawer-context-content">
						<section class="drawer-artifact" aria-label={`${activeEntry.title} artifact`}>
							<ArchiveRecordVisual entry={activeEntry} active />
						</section>
						<nav class="drawer-neighbors" aria-label="Previous and next archive records">
							<PanelButton
								variant="secondary"
								disabled={!previousEntry}
								ariaLabel={previousEntry ? `Previous record: ${previousEntry.title}` : "No previous record"}
								onclick={() => selectNeighbor(previousEntry)}
							>
								<span aria-hidden="true">←</span> {previousEntry?.shortTitle ?? "Previous"}
							</PanelButton>
							<PanelButton
								variant="secondary"
								disabled={!nextEntry}
								ariaLabel={nextEntry ? `Next record: ${nextEntry.title}` : "No next record"}
								onclick={() => selectNeighbor(nextEntry)}
							>
								{nextEntry?.shortTitle ?? "Next"} <span aria-hidden="true">→</span>
							</PanelButton>
						</nav>
					</div>
				{:else}
					<div class="drawer-context-empty" aria-hidden="true"></div>
				{/if}
			</Crossfade>
		</div>
		<div class="drawer-detail">
			{#key activeEntry.id}
				<ArchiveEntryDetail entry={activeEntry} bind:screen={drawerInspectorScreen} />
			{/key}
		</div>
	</div>
</Drawer>

{#if !isCompact.current}
	<BaseModal
		bind:open={submissionOpen}
		size="lg"
		labelledBy="archive-contribute-title"
	>
		{#snippet header()}
			<div class="submission-header">
				<h2 id="archive-contribute-title">Add to the research</h2>
				<PanelButton variant="secondary" onclick={() => (submissionOpen = false)}>
					Close
				</PanelButton>
			</div>
		{/snippet}
		<div class="submission-body"><ResearchSubmissionGuide /></div>
	</BaseModal>
{:else}
	<Drawer
		bind:isOpen={submissionOpen}
		placement={isShortWide.current ? "right" : "bottom"}
		ariaLabel="Contribute an archive record"
		showHandle={!isShortWide.current}
	>
		<div class="submission-drawer"><ResearchSubmissionGuide /></div>
	</Drawer>
{/if}

<style>
	.archive-room {
		display: grid;
		grid-template-rows: auto minmax(0, 1fr);
		gap: clamp(0.65rem, 1.2vh, 1rem);
		height: 100%;
		max-width: var(--shell-w, min(1720px, 92vw));
		margin-inline: auto;
		padding: clamp(0.65rem, 1.4vh, 1.2rem) clamp(0.8rem, 2vw, 2rem);
		box-sizing: border-box;
		overflow: hidden;
	}

	.archive-header {
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: 1rem;
	}

	.archive-header p,
	.archive-header h1,
	.record-toolbar p {
		margin: 0;
	}

	.archive-header p {
		color: var(--theme-accent, oklch(0.76 0.13 290));
		font-size: var(--font-size-min, 0.875rem);
		font-weight: 750;
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}

	.archive-header .premise {
		margin-top: 0.35rem;
		color: var(--theme-text-dim, oklch(0.74 0.02 270));
		font-size: var(--font-size-min, 0.875rem);
		font-weight: 400;
		letter-spacing: normal;
		line-height: 1.45;
		text-transform: none;
	}

	.archive-header h1 {
		margin-top: 0.15rem;
		font: italic 700 clamp(1.75rem, 2.4vw, 3rem) / 1 "Fraunces", Georgia, serif;
		letter-spacing: -0.025em;
		color: var(--theme-text, oklch(0.96 0.01 270));
	}

	.archive-header :global(.panel-btn) {
		border-radius: 999px;
		white-space: nowrap;
	}

	.large-archive {
		display: grid;
		grid-template-columns: minmax(0, 1.35fr) minmax(26rem, 0.65fr);
		grid-template-rows: minmax(0, 1fr);
		column-gap: clamp(1.25rem, 1.5vw, 2rem);
		min-width: 0;
		min-height: 0;
	}

	.selected-record {
		display: grid;
		grid-template-rows: auto minmax(0, 1fr);
		min-width: 0;
		min-height: 0;
		overflow: hidden;
		border: 1px solid color-mix(in oklch, var(--artifact-accent) 35%, var(--theme-stroke, oklch(1 0 0 / 0.12)));
		border-radius: var(--radius-2026-xl, 24px);
		background: var(--theme-card-bg, oklch(0.145 0.012 270));
		box-shadow: 0 1.5rem 4rem oklch(0 0 0 / 0.22);
		container: selected-record / inline-size;
	}

	.record-toolbar {
		display: flex;
		min-height: 3.4rem;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.45rem 0.6rem 0.45rem 1rem;
		border-bottom: 1px solid var(--theme-stroke, oklch(1 0 0 / 0.12));
	}

	.record-toolbar p {
		display: grid;
		min-width: 0;
		gap: 0.08rem;
	}

	.record-toolbar p span {
		color: var(--artifact-accent);
		font-size: var(--font-size-compact, 0.75rem);
		font-weight: 750;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	.record-toolbar p strong {
		overflow: hidden;
		color: var(--theme-text, oklch(0.95 0.01 270));
		font-size: var(--font-size-min, 0.875rem);
		font-variant-numeric: tabular-nums;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.record-toolbar nav,
	.drawer-neighbors {
		display: flex;
		gap: 0.45rem;
	}

	.record-toolbar :global(.panel-btn) {
		max-width: 12rem;
		border-radius: 999px;
	}

	.neighbor-label {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.record-body {
		display: grid;
		grid-template-rows: minmax(16rem, 0.8fr) minmax(0, 1.2fr);
		min-width: 0;
		min-height: 0;
	}

	.artifact-stage {
		display: grid;
		grid-template-rows: minmax(0, 1fr) auto;
		min-width: 0;
		min-height: 0;
		padding: clamp(0.7rem, 1.4vw, 1.2rem);
		border-bottom: 1px solid var(--theme-stroke, oklch(1 0 0 / 0.12));
		box-sizing: border-box;
		background: color-mix(in oklch, var(--artifact-accent) 4%, var(--theme-card-bg, oklch(0.145 0.012 270)));
	}

	.artifact-viewport {
		display: grid;
		min-width: 0;
		min-height: 0;
		place-items: center;
		container-type: size;
		overflow: hidden;
	}

	.artifact-actions {
		display: flex;
		justify-content: center;
		padding-top: 0.45rem;
	}

	.artifact-action {
		display: inline-flex;
		min-height: 2.75rem;
		align-items: center;
		gap: 0.45rem;
		padding-inline: 1rem;
		border: 1px solid color-mix(in oklch, var(--artifact-accent) 62%, transparent);
		border-radius: 999px;
		color: var(--theme-text, oklch(0.95 0.01 270));
		font-size: var(--font-size-min, 0.875rem);
		font-weight: 700;
		text-decoration: none;
		translate: var(--mag-x, 0px) var(--mag-y, 0px);
	}

	.artifact-action:hover,
	.artifact-action:focus-visible {
		border-color: var(--artifact-accent);
		background: color-mix(in oklch, var(--artifact-accent) 15%, transparent);
		outline: none;
	}

	.artifact-action.primary {
		background: var(--artifact-accent);
		color: oklch(0.13 0.01 270);
	}

	.record-inspector-host {
		min-width: 0;
		min-height: 0;
		overflow: hidden;
		padding: clamp(0.9rem, 1.6vw, 1.4rem);
	}

	.compact-archive {
		min-width: 0;
	}

	.record-drawer {
		display: grid;
		gap: 1rem;
		padding: 0.5rem clamp(1rem, 4vw, 1.5rem) 2rem;
	}

	.drawer-context {
		min-width: 0;
	}

	.drawer-context-content {
		display: grid;
		gap: 1rem;
	}

	.drawer-context-empty {
		/* ResizeObserver does not deliver a box that disappears to exactly zero in
		   every engine. One device pixel keeps Crossfade's height measurement alive
		   while remaining visually empty. */
		height: 1px;
	}

	.record-drawer > header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		position: sticky;
		top: 0;
		z-index: 2;
		padding-block: 0.5rem;
		background: var(--sheet-bg, rgb(15, 15, 20));
	}

	.record-drawer > header p {
		display: grid;
		margin: 0;
		color: var(--theme-text, oklch(0.95 0.01 270));
		font-size: var(--font-size-min, 0.875rem);
		font-weight: 700;
	}

	.record-drawer > header p span {
		color: var(--artifact-accent);
		font-variant-numeric: tabular-nums;
	}

	.record-drawer :global(.panel-btn) {
		border-radius: 999px;
	}

	.drawer-artifact {
		display: grid;
		height: clamp(17rem, 46vh, 34rem);
		min-height: 0;
		place-items: center;
		padding: 0.8rem;
		border: 1px solid color-mix(in oklch, var(--artifact-accent) 35%, var(--theme-stroke, oklch(1 0 0 / 0.12)));
		border-radius: var(--radius-2026-xl, 24px);
		background: color-mix(in oklch, var(--artifact-accent) 5%, var(--theme-card-bg, oklch(0.145 0.012 270)));
		container-type: size;
		overflow: hidden;
	}

	.drawer-neighbors {
		justify-content: space-between;
	}

	.drawer-detail {
		padding-top: 0.5rem;
	}

	.submission-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.8rem 1rem;
		border-bottom: 1px solid var(--theme-stroke, oklch(1 0 0 / 0.13));
	}

	.submission-header h2 {
		margin: 0;
		font: italic 650 clamp(1.25rem, 2vw, 1.8rem) / 1.1 "Fraunces", Georgia, serif;
	}

	.submission-body,
	.submission-drawer {
		padding: clamp(1rem, 2vw, 1.5rem);
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		margin: -1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}

	@media (max-width: 980px) and (min-height: 561px) {
		.large-archive {
			grid-template-columns: minmax(0, 1fr);
			grid-template-rows: minmax(0, 1fr);
		}

		/* The map owns this tier. Selecting a trace opens its record in a right
		   drawer, so the answer appears immediately instead of being stacked below
		   the viewport. Keep this CSS guard for the server-rendered first frame;
		   the media query then removes the panel from the hydrated DOM. */
		.selected-record {
			display: none;
		}
	}

	@media (max-width: 760px), (max-height: 560px) {
		.archive-room {
			display: block;
			height: auto;
			min-height: 100%;
			overflow: visible;
			padding: 0.8rem;
		}

		.archive-header {
			align-items: center;
			margin-bottom: 1rem;
		}

		.archive-header h1 {
			font-size: clamp(1.55rem, 7vw, 2.25rem);
		}

		.archive-header p {
			font-size: var(--font-size-compact, 0.75rem);
			letter-spacing: 0.09em;
		}

		.archive-header :global(.panel-btn) {
			padding-inline: 0.75rem;
		}
	}

	@media (max-width: 520px) {
		.archive-header {
			flex-direction: column;
			align-items: start;
			gap: 0.55rem;
		}

		.archive-header :global(.panel-btn) {
			max-width: 8.5rem;
			white-space: normal;
		}

		.record-drawer {
			gap: 0.75rem;
			padding-bottom: 1rem;
		}

		.drawer-context-content {
			gap: 0.75rem;
		}

		/* The bottom sheet opens to the record's decisions, not a nearly
		   full-screen repeat of the artifact the user just selected. */
		.drawer-artifact {
			height: clamp(10.5rem, 27vh, 12rem);
		}
	}

	@media (min-width: 700px) and (max-height: 560px) {
		.archive-room {
			display: grid;
			grid-template-columns: minmax(14rem, 0.34fr) minmax(0, 1.66fr);
			grid-template-rows: minmax(0, 1fr);
			gap: clamp(1rem, 3vw, 2rem);
			height: 100%;
			padding: 0.8rem 1rem;
			overflow: hidden;
		}

		.archive-header {
			flex-direction: column;
			align-items: flex-start;
			justify-content: flex-start;
			gap: 0.75rem;
			margin: 0;
		}

		.archive-header h1 {
			font-size: clamp(1.8rem, 4vw, 2.6rem);
		}

		.compact-archive {
			min-height: 0;
			overflow: hidden;
		}

		.record-drawer {
			gap: 0.5rem;
			padding-bottom: 0.5rem;
		}

		.drawer-context-content {
			gap: 0.5rem;
		}

		/* In a short landscape window the artifact is a label-sized preview;
		   the overview and its drill-downs are the reason the drawer opened. */
		.drawer-artifact {
			height: 7rem;
		}
	}

	@media (min-width: 2600px) {
		.archive-room {
			padding-inline: 2.5rem;
		}

		.archive-header p {
			font-size: 1rem;
		}

		.archive-header .premise {
			font-size: 1.05rem;
		}

		.archive-header h1 {
			font-size: 3.8rem;
		}

		.record-toolbar p span {
			font-size: 0.9rem;
		}

		.record-toolbar p strong,
		.artifact-action {
			font-size: 1rem;
		}

		.archive-header :global(.panel-btn),
		.record-toolbar :global(.panel-btn) {
			min-height: 3.25rem;
			font-size: 1rem;
		}
	}

	@container selected-record (min-width: 70rem) {
		.record-body {
			grid-template-columns: minmax(0, 1.1fr) minmax(28rem, 0.9fr);
			grid-template-rows: minmax(0, 1fr);
		}

		.artifact-stage {
			border-right: 1px solid var(--theme-stroke, oklch(1 0 0 / 0.12));
			border-bottom: 0;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.artifact-action {
			transition: none;
		}
	}
</style>
