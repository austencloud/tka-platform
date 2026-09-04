<script module lang="ts">
	export type InspectorScreen =
		| "overview"
		| "sources"
		| "documents"
		| "works"
		| "work"
		| "videos"
		| "video";
</script>

<script lang="ts">
	import { tick } from "svelte";
	import Crossfade from "$lib/shared/components/Crossfade.svelte";
	import { DURATION } from "$lib/shared/transitions/transitions";
	import {
		EVIDENCE_BASIS_LABELS,
		activityLabel,
		type ArchiveEntry,
	} from "./_lib/archive-ledger";

	let {
		entry,
		contained = false,
		screen = $bindable<InspectorScreen>("overview"),
	}: { entry: ArchiveEntry; contained?: boolean; screen?: InspectorScreen } = $props();

	let direction = $state<-1 | 1>(1);
	let selectedWorkIndex = $state<number | null>(null);
	let selectedVideoIndex = $state<number | null>(null);
	let currentHeading: HTMLElement | null = null;

	const works = $derived(entry.catalogEntry?.subWorks ?? []);
	const videos = $derived(entry.catalogEntry?.videos ?? []);
	const documents = $derived(entry.documents ?? []);
	const documentPageTotal = $derived(
		documents.reduce((total, document) => total + document.pageCount, 0)
	);
	const activity = $derived(activityLabel(entry));
	const selectedWork = $derived(
		selectedWorkIndex === null ? undefined : works[selectedWorkIndex]
	);
	const selectedVideo = $derived(
		selectedVideoIndex === null ? undefined : videos[selectedVideoIndex]
	);

	/** Keep focus on the arriving screen without an outgoing keyed layer later
	 *  clearing the reference to the heading that replaced it. */
	function trackHeading(node: HTMLElement) {
		currentHeading = node;
		return {
			destroy() {
				if (currentHeading === node) currentHeading = null;
			},
		};
	}

	async function showScreen(next: InspectorScreen, nextDirection: -1 | 1 = 1) {
		if (screen === next) return;
		direction = nextDirection;
		screen = next;
		await tick();
		currentHeading?.focus();
	}

	function showWork(index: number) {
		selectedWorkIndex = index;
		void showScreen("work");
	}

	function showVideo(index: number) {
		selectedVideoIndex = index;
		void showScreen("video");
	}

	function plural(count: number, singular: string, pluralForm = `${singular}s`) {
		return `${count} ${count === 1 ? singular : pluralForm}`;
	}
</script>

<article class="record-inspector" class:contained>
	<div class="screen-stage">
		<Crossfade
			key={screen}
			fill={contained}
			animateHeight={!contained}
			mode="swap"
			motion="step"
			{direction}
			duration={DURATION.normal}
		>
			{#if screen === "overview"}
				<section class="inspector-screen overview-screen" aria-labelledby={`overview-${entry.id}`}>
					<header class="overview-heading">
						<h2 id={`overview-${entry.id}`} tabindex="-1" use:trackHeading>About this record</h2>
						{#if activity}<strong class="activity-label">{activity}</strong>{/if}
					</header>

					<p class="summary">{entry.summary}</p>

					{#if entry.evidenceNote || entry.activity}
						<section class="evidence-card" data-status={entry.evidenceBasis}>
							<h3><span aria-hidden="true">●</span>{entry.evidenceLabel}</h3>
							{#if entry.evidenceNote}<p>{entry.evidenceNote}</p>{/if}
							{#if entry.activity}<p>{entry.activity.note}</p>{/if}
						</section>
					{/if}

					<nav class="detail-doors" aria-label={`More about ${entry.title}`}>
						<button type="button" class="detail-door" onclick={() => showScreen("sources")}>
							<span>
								<strong>Sources</strong>
								<small>{plural(entry.citations.length, "cited source")}</small>
							</span>
							<span class="door-arrow" aria-hidden="true">→</span>
						</button>

						{#if documents.length}
							<button type="button" class="detail-door" onclick={() => showScreen("documents")}>
								<span>
									<strong>Complete documents</strong>
									<small>{plural(documents.length, "PDF")} · {plural(documentPageTotal, "page")}</small>
								</span>
								<span class="door-arrow" aria-hidden="true">→</span>
							</button>
						{/if}

						{#if works.length}
							<button type="button" class="detail-door" onclick={() => showScreen("works")}>
								<span>
									<strong>Included works</strong>
									<small>{plural(works.length, "work")} in this record</small>
								</span>
								<span class="door-arrow" aria-hidden="true">→</span>
							</button>
						{/if}

						{#if videos.length}
							<button type="button" class="detail-door" onclick={() => showScreen("videos")}>
								<span>
									<strong>Videos</strong>
									<small>{plural(videos.length, "archived video")}</small>
								</span>
								<span class="door-arrow" aria-hidden="true">→</span>
							</button>
						{/if}
					</nav>
				</section>
			{:else if screen === "sources"}
				<section class="inspector-screen detail-screen" aria-labelledby={`sources-${entry.id}`}>
					<header class="detail-screen-heading">
						<button
							type="button"
							class="back-button"
							aria-label={`Back to ${entry.title} overview`}
							onclick={() => showScreen("overview", -1)}
						>←</button>
						<div>
							<p>{entry.shortTitle}</p>
							<h2 id={`sources-${entry.id}`} tabindex="-1" use:trackHeading>Sources</h2>
						</div>
						<span class="screen-count">{entry.citations.length}</span>
					</header>

					<ol class="source-list">
						{#each entry.citations as citation, sourceIndex (citation.href)}
							<li>
								<a
									href={citation.href}
									target={citation.href.startsWith("/") ? undefined : "_blank"}
									rel={citation.href.startsWith("/") ? undefined : "noopener"}
									aria-label={`Open source: ${citation.label}`}
								>
									<span class="item-number">{sourceIndex + 1}</span>
									<span class="source-copy">
										<span class="source-title">
											<strong>{citation.label}</strong>
											<small>{EVIDENCE_BASIS_LABELS[citation.basis]}</small>
										</span>
										<span class="source-support">{citation.supports}</span>
									</span>
									<span class="external-arrow" aria-hidden="true">↗</span>
								</a>
							</li>
						{/each}
					</ol>
				</section>
			{:else if screen === "documents"}
				<section class="inspector-screen detail-screen" aria-labelledby={`documents-${entry.id}`}>
					<header class="detail-screen-heading">
						<button
							type="button"
							class="back-button"
							aria-label={`Back to ${entry.title} overview`}
							onclick={() => showScreen("overview", -1)}
						>←</button>
						<div>
							<p>{entry.shortTitle}</p>
							<h2 id={`documents-${entry.id}`} tabindex="-1" use:trackHeading>Complete documents</h2>
						</div>
						<span class="screen-count">{documents.length}</span>
					</header>

					<ol class="document-list">
						{#each documents as document, documentIndex (document.id)}
							<li>
								<a href={document.pdfHref} target="_blank" rel="noopener">
									<span class="item-number">{documentIndex + 1}</span>
									<span class="document-copy">
										<span class="document-title">
											<strong>{document.title}</strong>
											<small>{plural(document.pageCount, "page")}</small>
										</span>
										<span class="document-note">{document.note}</span>
									</span>
									<span class="external-arrow" aria-hidden="true">↗</span>
								</a>
							</li>
						{/each}
					</ol>
				</section>
			{:else if screen === "works"}
				<section class="inspector-screen detail-screen" aria-labelledby={`works-${entry.id}`}>
					<header class="detail-screen-heading">
						<button
							type="button"
							class="back-button"
							aria-label={`Back to ${entry.title} overview`}
							onclick={() => showScreen("overview", -1)}
						>←</button>
						<div>
							<p>{entry.shortTitle}</p>
							<h2 id={`works-${entry.id}`} tabindex="-1" use:trackHeading>Included works</h2>
						</div>
						<span class="screen-count">{works.length}</span>
					</header>

					<ol class="work-list">
						{#each works as work, workIndex (work.name)}
							<li>
								<button type="button" onclick={() => showWork(workIndex)}>
									<span class="item-number">{workIndex + 1}</span>
									<strong>{work.name}</strong>
									<span class="door-arrow" aria-hidden="true">→</span>
								</button>
							</li>
						{/each}
					</ol>
				</section>
			{:else if screen === "work" && selectedWork}
				<section class="inspector-screen detail-screen" aria-labelledby={`work-${entry.id}-${selectedWorkIndex}`}>
					<header class="detail-screen-heading">
						<button
							type="button"
							class="back-button"
							aria-label={`Back to ${entry.title} included works`}
							onclick={() => showScreen("works", -1)}
						>←</button>
						<div>
							<p>Included work</p>
							<h2 id={`work-${entry.id}-${selectedWorkIndex}`} tabindex="-1" use:trackHeading>{selectedWork.name}</h2>
						</div>
						<span class="screen-count">{(selectedWorkIndex ?? 0) + 1}/{works.length}</span>
					</header>

					<div class="work-note">
						<p>{selectedWork.note}</p>
					</div>
				</section>
			{:else if screen === "videos"}
				<section class="inspector-screen detail-screen" aria-labelledby={`videos-${entry.id}`}>
					<header class="detail-screen-heading">
						<button
							type="button"
							class="back-button"
							aria-label={`Back to ${entry.title} overview`}
							onclick={() => showScreen("overview", -1)}
						>←</button>
						<div>
							<p>{entry.shortTitle}</p>
							<h2 id={`videos-${entry.id}`} tabindex="-1" use:trackHeading>Videos</h2>
						</div>
						<span class="screen-count">{videos.length}</span>
					</header>

					<ol class="video-list">
						{#each videos as video, videoIndex (video.id)}
							<li>
								<button type="button" onclick={() => showVideo(videoIndex)}>
									<span class="item-number">{videoIndex + 1}</span>
									<strong>{video.title}</strong>
									<span class="door-arrow" aria-hidden="true">→</span>
								</button>
							</li>
						{/each}
					</ol>
				</section>
			{:else if screen === "video" && selectedVideo}
				<section class="inspector-screen detail-screen" aria-labelledby={`video-${entry.id}-${selectedVideoIndex}`}>
					<header class="detail-screen-heading">
						<button
							type="button"
							class="back-button"
							aria-label={`Back to ${entry.title} videos`}
							onclick={() => showScreen("videos", -1)}
						>←</button>
						<div>
							<p>Archived video</p>
							<h2 id={`video-${entry.id}-${selectedVideoIndex}`} tabindex="-1" use:trackHeading>{selectedVideo.title}</h2>
						</div>
						<span class="screen-count">{(selectedVideoIndex ?? 0) + 1}/{videos.length}</span>
					</header>

					<div class="video-note">
						<strong>{selectedVideo.creator}{selectedVideo.year ? ` · ${selectedVideo.year}` : ""}</strong>
						{#if selectedVideo.note}<p>{selectedVideo.note}</p>{/if}
						<a href={`https://www.youtube.com/watch?v=${selectedVideo.id}`} target="_blank" rel="noopener">
							Watch video <span aria-hidden="true">↗</span>
						</a>
					</div>
				</section>
			{/if}
		</Crossfade>
	</div>
</article>

<style>
	.record-inspector,
	.screen-stage {
		min-width: 0;
		color: var(--theme-text, oklch(0.95 0.01 270));
	}

	.record-inspector.contained,
	.record-inspector.contained .screen-stage {
		height: 100%;
		min-height: 0;
		overflow: hidden;
	}

	.inspector-screen {
		display: flex;
		min-width: 0;
		box-sizing: border-box;
		flex-direction: column;
		gap: clamp(0.7rem, 1.5vh, 1rem);
	}

	.contained .inspector-screen {
		height: 100%;
		min-height: 0;
	}

	/* The overview is one reading unit. Center that unit when the persistent
	   rail is taller than its contents; otherwise a flex auto-margin tears the
	   Sources door away from the evidence it opens and leaves a false void in
	   the middle of the inspector. `safe` falls back to the start edge if a
	   record ever needs more room than the rail provides. */
	.contained .overview-screen {
		justify-content: safe center;
	}

	.overview-heading h2,
	.summary,
	.evidence-card h3,
	.evidence-card p,
	.detail-screen-heading p,
	.detail-screen-heading h2 {
		margin: 0;
	}

	.overview-heading {
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.detail-screen-heading p {
		color: var(--artifact-accent, var(--theme-accent, oklch(0.76 0.13 270)));
		font-size: var(--font-size-compact, 0.75rem);
		font-weight: 750;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	.overview-heading h2,
	.detail-screen-heading h2 {
		margin-top: 0.15rem;
		font: italic 650 clamp(1.35rem, 2.2cqw, 1.8rem) / 1.1 "Fraunces", Georgia, serif;
		letter-spacing: -0.02em;
	}

	.overview-heading h2:focus,
	.detail-screen-heading h2:focus {
		outline: none;
	}

	.activity-label {
		color: var(--theme-text-dim, oklch(0.74 0.02 270));
		font-size: var(--font-size-compact, 0.75rem);
		font-weight: 700;
		text-align: right;
	}

	.summary {
		color: var(--theme-text, oklch(0.9 0.015 270));
		font-size: var(--font-size-min, 0.875rem);
		line-height: 1.55;
	}

	.evidence-card {
		display: grid;
		gap: 0.35rem;
		padding: 0.7rem 0.8rem;
		border: 1px solid var(--theme-stroke, oklch(1 0 0 / 0.12));
		border-radius: var(--radius-2026-md, 14px);
		background: color-mix(in oklch, var(--artifact-accent) 5%, transparent);
	}

	.evidence-card h3 {
		display: flex;
		align-items: baseline;
		gap: 0.45rem;
		font-size: var(--font-size-min, 0.875rem);
	}

	.evidence-card h3 span {
		color: var(--artifact-accent, var(--theme-accent, oklch(0.76 0.13 270)));
		font-size: 0.7rem;
	}

	.evidence-card[data-status="unresolved"] h3 {
		color: oklch(0.82 0.12 80);
	}

	.evidence-card p {
		color: var(--theme-text-dim, oklch(0.74 0.02 270));
		font-size: var(--font-size-min, 0.875rem);
		line-height: 1.45;
	}

	.detail-doors {
		display: grid;
		gap: 0.5rem;
		margin-top: clamp(0.15rem, 1.25cqh, 0.85rem);
	}

	.detail-door {
		display: flex;
		width: 100%;
		min-height: var(--min-touch-target, 2.75rem);
		align-items: center;
		justify-content: space-between;
		gap: 0.8rem;
		padding: 0.65rem 0.8rem;
		border: 1px solid var(--theme-stroke, oklch(1 0 0 / 0.13));
		border-radius: var(--radius-2026-md, 14px);
		background: var(--theme-card-bg, oklch(0.18 0.015 270));
		color: inherit;
		font: inherit;
		text-align: left;
		cursor: pointer;
		transition:
			background var(--duration-normal, 200ms) ease,
			border-color var(--duration-normal, 200ms) ease;
	}

	.detail-door > span:first-child {
		display: grid;
		min-width: 0;
		gap: 0.1rem;
	}

	.detail-door strong {
		font-size: var(--font-size-min, 0.875rem);
	}

	.detail-door small {
		overflow: hidden;
		color: var(--theme-text-dim, oklch(0.74 0.02 270));
		font-size: var(--font-size-compact, 0.75rem);
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.door-arrow {
		flex: 0 0 auto;
		color: var(--artifact-accent, var(--theme-accent, oklch(0.76 0.13 270)));
		font-size: 1.15rem;
	}

	.detail-door:hover,
	.detail-door:focus-visible {
		border-color: color-mix(in oklch, var(--artifact-accent) 65%, transparent);
		background: color-mix(in oklch, var(--artifact-accent) 10%, var(--theme-card-bg, oklch(0.18 0.015 270)));
		outline: none;
	}

	.detail-screen-heading {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		align-items: center;
		gap: 0.7rem;
		padding-bottom: 0.65rem;
		border-bottom: 1px solid var(--theme-stroke, oklch(1 0 0 / 0.12));
	}

	.back-button {
		display: grid;
		width: var(--min-touch-target, 2.75rem);
		height: var(--min-touch-target, 2.75rem);
		place-items: center;
		padding: 0;
		border: 1px solid var(--theme-stroke, oklch(1 0 0 / 0.15));
		border-radius: 50%;
		background: var(--theme-card-bg, oklch(0.18 0.015 270));
		color: var(--theme-text, oklch(0.95 0.01 270));
		font: 700 1.1rem/1 inherit;
		cursor: pointer;
	}

	.back-button:hover,
	.back-button:focus-visible {
		border-color: var(--artifact-accent, var(--theme-accent, oklch(0.76 0.13 270)));
		outline: none;
	}

	.screen-count {
		display: grid;
		min-width: 2rem;
		height: 2rem;
		place-items: center;
		border-radius: 999px;
		background: color-mix(in oklch, var(--artifact-accent) 13%, transparent);
		color: var(--artifact-accent, var(--theme-accent, oklch(0.76 0.13 270)));
		font-size: var(--font-size-compact, 0.75rem);
		font-weight: 750;
		font-variant-numeric: tabular-nums;
	}

	.source-list,
	.document-list,
	.work-list,
	.video-list {
		display: grid;
		gap: 0.5rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.source-list li,
	.document-list li,
	.work-list li,
	.video-list li {
		min-width: 0;
		border: 1px solid var(--theme-stroke, oklch(1 0 0 / 0.12));
		border-radius: var(--radius-2026-md, 14px);
		background: var(--theme-card-bg, oklch(0.18 0.015 270));
	}

	.work-list button,
	.video-list button {
		display: grid;
		width: 100%;
		min-height: var(--min-touch-target, 2.75rem);
		grid-template-columns: 1.75rem minmax(0, 1fr) auto;
		align-items: center;
		gap: 0.55rem;
		padding: 0.6rem 0.7rem;
		border: 0;
		border-radius: inherit;
		background: transparent;
		color: inherit;
		font: inherit;
		text-align: left;
		cursor: pointer;
		transition: background var(--duration-normal, 200ms) ease;
	}

	.work-list button:hover,
	.work-list button:focus-visible,
	.video-list button:hover,
	.video-list button:focus-visible {
		background: color-mix(in oklch, var(--artifact-accent) 8%, transparent);
		outline: none;
	}

	.work-note,
	.video-note {
		display: grid;
		min-height: 10rem;
		place-items: center;
		padding: clamp(1rem, 3cqw, 1.5rem);
		border: 1px solid var(--theme-stroke, oklch(1 0 0 / 0.12));
		border-radius: var(--radius-2026-md, 14px);
		background: color-mix(in oklch, var(--artifact-accent) 5%, transparent);
	}

	.work-note p,
	.video-note p {
		max-width: 34rem;
		margin: 0;
		color: var(--theme-text, oklch(0.9 0.015 270));
		font-size: clamp(1rem, 2.2cqw, 1.2rem);
		line-height: 1.55;
	}

	.video-note {
		place-items: start;
		align-content: center;
		gap: 0.55rem;
	}

	.video-note > strong {
		font-size: var(--font-size-min, 0.875rem);
	}

	.video-note > a {
		display: inline-flex;
		min-height: var(--min-touch-target, 2.75rem);
		align-items: center;
		gap: 0.35rem;
		margin-top: 0.35rem;
		padding-inline: 0.9rem;
		border: 1px solid color-mix(in oklch, var(--artifact-accent) 60%, transparent);
		border-radius: 999px;
		color: var(--theme-text, oklch(0.95 0.01 270));
		font-size: var(--font-size-min, 0.875rem);
		font-weight: 700;
		text-decoration: none;
	}

	.video-note > a:hover,
	.video-note > a:focus-visible {
		border-color: var(--artifact-accent, var(--theme-accent, oklch(0.76 0.13 270)));
		background: color-mix(in oklch, var(--artifact-accent) 8%, transparent);
		outline: none;
	}

	.item-number {
		color: var(--artifact-accent, var(--theme-accent, oklch(0.76 0.13 270)));
		font-size: var(--font-size-compact, 0.75rem);
		font-weight: 750;
		font-variant-numeric: tabular-nums;
	}

	.source-list strong,
	.document-list strong,
	.work-list strong,
	.video-list strong {
		display: block;
		font-size: var(--font-size-min, 0.875rem);
		line-height: 1.35;
	}

	.source-list small {
		display: block;
		margin-top: 0.15rem;
		color: var(--theme-text-dim, oklch(0.74 0.02 270));
		font-size: var(--font-size-compact, 0.75rem);
		line-height: 1.35;
	}

	.source-list li > a {
		display: grid;
		min-height: var(--min-touch-target, 2.75rem);
		grid-template-columns: 1.75rem minmax(0, 1fr) auto;
		align-items: start;
		gap: 0.55rem;
		padding: 0.55rem 0.65rem;
		color: var(--theme-text, oklch(0.95 0.01 270));
		text-decoration: none;
		transition: background var(--duration-normal, 200ms) ease;
	}

	.source-copy {
		display: grid;
		min-width: 0;
		gap: 0.1rem;
	}

	.document-copy {
		display: grid;
		min-width: 0;
		gap: 0.15rem;
	}

	.document-title {
		display: flex;
		min-width: 0;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.6rem;
	}

	.document-title small,
	.document-note {
		color: var(--theme-text-dim, oklch(0.74 0.02 270));
		font-size: var(--font-size-compact, 0.75rem);
		line-height: 1.35;
	}

	.document-title small {
		flex: 0 0 auto;
		white-space: nowrap;
	}

	.source-title {
		display: flex;
		min-width: 0;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.6rem;
	}

	.source-title small {
		flex: 0 0 auto;
		margin: 0;
		white-space: nowrap;
	}

	.source-support {
		color: var(--theme-text-dim, oklch(0.74 0.02 270));
		font-size: var(--font-size-min, 0.875rem);
		line-height: 1.3;
	}

	.source-list li > a:hover,
	.source-list li > a:focus-visible {
		background: color-mix(in oklch, var(--artifact-accent) 8%, transparent);
		outline: none;
	}

	.external-arrow {
		grid-column: 2;
		grid-row: 1 / span 2;
		align-self: center;
		color: var(--artifact-accent, var(--theme-accent, oklch(0.76 0.13 270)));
	}

	.source-list .external-arrow,
	.document-list .external-arrow {
		grid-column: 3;
		grid-row: 1;
	}

	@media (max-width: 560px) {
		/* Put the exits before the provenance note in a sheet. The user chose a
		   record to go somewhere; the optional context can follow below. */
		.overview-heading {
			order: 0;
		}

		.summary {
			order: 1;
		}

		.detail-doors {
			order: 2;
			margin-top: 0;
		}

		.evidence-card {
			order: 3;
		}
	}

	@media (min-width: 2600px) {
		.summary,
		.evidence-card h3,
		.evidence-card p,
		.detail-door strong,
		.source-list strong,
		.source-support,
		.work-list strong,
		.video-list strong,
		.source-list li > a {
			font-size: 1rem;
		}
	}

	.document-list li > a {
		display: grid;
		min-height: var(--min-touch-target, 2.75rem);
		grid-template-columns: 1.75rem minmax(0, 1fr) auto;
		align-items: center;
		gap: 0.55rem;
		padding: 0.65rem 0.7rem;
		color: var(--theme-text, oklch(0.95 0.01 270));
		text-decoration: none;
		transition: background var(--duration-normal, 200ms) ease;
	}

	.document-list li > a:hover,
	.document-list li > a:focus-visible {
		background: color-mix(in oklch, var(--artifact-accent) 8%, transparent);
		outline: none;
	}

	@media (prefers-reduced-motion: reduce) {
		.detail-door,
		.work-list button,
		.video-list button {
			transition: none;
		}
	}
</style>
