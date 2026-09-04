<script lang="ts">
	import { pressSpring } from "$lib/actions/press-spring";
	import {
		ARCHIVE_ENTRIES,
		archiveClusterForEntry,
		archiveLane,
		type ArchiveEntry,
	} from "./_lib/archive-ledger";
	import { archiveAccent } from "./_lib/archive-appearance";

	let {
		activeEntryId,
		onselect,
	}: {
		activeEntryId: string;
		onselect: (entry: ArchiveEntry) => void;
	} = $props();
</script>

<section class="chronological-index" aria-labelledby="chronological-index-title">
	<header>
		<div>
			<p>All {ARCHIVE_ENTRIES.length} documented traces</p>
			<h2 id="chronological-index-title">Chronological index</h2>
		</div>
		<span
			>Documented traces, not a definitive history. Select a record to open its
			artifact, claims, and sources.</span
		>
	</header>

	<ol>
		{#each ARCHIVE_ENTRIES as entry (entry.id)}
			{@const lane = archiveLane(entry.lane)}
			{@const cluster = archiveClusterForEntry(entry.id)}
			<li style:--entry-accent={archiveAccent(entry.id)}>
				<span class="year" aria-hidden="true">{entry.firstDocumentedYear}</span>
				<a
					href={`#archive-record-${entry.id}`}
					class:is-active={entry.id === activeEntryId}
					aria-current={entry.id === activeEntryId ? "true" : undefined}
					onclick={(event) => {
						event.preventDefault();
						onselect(entry);
					}}
					use:pressSpring
				>
					<span class="record-copy">
						<span class="record-meta">{entry.dateLabel} · {lane.label} · {entry.citations.length} {entry.citations.length === 1 ? "source" : "sources"}</span>
						<strong>{entry.title}</strong>
						<small>{entry.people}</small>
						{#if cluster}
							<small class="group-meta">Part of the {cluster.dateLabel} group of four related records</small>
						{/if}
					</span>
					<span class="open-label">Open <span aria-hidden="true">→</span></span>
				</a>
			</li>
		{/each}
	</ol>
</section>

<style>
	.chronological-index {
		display: grid;
		gap: 1rem;
	}

	header {
		display: grid;
		gap: 0.5rem;
	}

	header p,
	header h2,
	header > span {
		margin: 0;
	}

	header p {
		color: var(--theme-accent, oklch(0.76 0.13 290));
		font-size: var(--font-size-min, 0.875rem);
		font-weight: 750;
		letter-spacing: 0.11em;
		text-transform: uppercase;
	}

	header h2 {
		margin-top: 0.15rem;
		font: italic 650 clamp(1.55rem, 8vw, 2.4rem) / 1.05 "Fraunces", Georgia, serif;
		color: var(--theme-text, oklch(0.95 0.01 270));
	}

	header > span {
		color: var(--theme-text-dim, oklch(0.74 0.02 270));
		font-size: var(--font-size-min, 0.875rem);
		line-height: 1.45;
	}

	ol {
		display: grid;
		gap: 0.65rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	li {
		position: relative;
		display: grid;
		grid-template-columns: 3.6rem minmax(0, 1fr);
		gap: 0.65rem;
		align-items: stretch;
	}

	li:not(:last-child)::after {
		content: "";
		position: absolute;
		top: 2.8rem;
		bottom: -0.9rem;
		left: 1.75rem;
		width: 1px;
		background: color-mix(in oklch, var(--entry-accent) 45%, var(--theme-stroke, oklch(1 0 0 / 0.12)));
	}

	.year {
		position: relative;
		z-index: 1;
		display: grid;
		width: 3.6rem;
		height: 3.6rem;
		place-items: center;
		border: 1px solid color-mix(in oklch, var(--entry-accent) 70%, transparent);
		border-radius: 50%;
		background: var(--theme-page-bg, oklch(0.115 0.008 270));
		color: var(--theme-text, oklch(0.95 0.01 270));
		font-size: var(--font-size-compact, 0.75rem);
		font-variant-numeric: tabular-nums;
		font-weight: 750;
	}

	a {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: 0.8rem;
		align-items: center;
		min-height: 5.5rem;
		padding: 0.65rem;
		border: 1px solid var(--theme-stroke, oklch(1 0 0 / 0.14));
		border-radius: var(--radius-2026-lg, 18px);
		background: var(--theme-card-bg, oklch(0.16 0.012 270));
		color: var(--theme-text, oklch(0.95 0.01 270));
		text-decoration: none;
		transition: border-color var(--duration-fast, 150ms) ease, background var(--duration-fast, 150ms) ease;
	}

	a:hover,
	a:focus-visible,
	a.is-active {
		border-color: var(--entry-accent);
		background: color-mix(in oklch, var(--entry-accent) 12%, var(--theme-card-bg, oklch(0.16 0.012 270)));
		outline: none;
	}

	.record-copy {
		display: grid;
		min-width: 0;
		gap: 0.18rem;
	}

	.record-copy > strong {
		font-size: 1rem;
		font-weight: 750;
		line-height: 1.25;
		white-space: normal;
	}

	.record-meta,
	.record-copy small {
		overflow: hidden;
		color: var(--theme-text-dim, oklch(0.74 0.02 270));
		font-size: var(--font-size-min, 0.875rem);
		line-height: 1.35;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.record-meta {
		overflow: visible;
		color: var(--entry-accent);
		font-variant-numeric: tabular-nums;
		font-weight: 700;
		text-overflow: clip;
		white-space: normal;
	}

	.group-meta {
		color: var(--theme-accent, oklch(0.76 0.13 290));
		font-weight: 650;
	}

	.open-label {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		min-height: 2.75rem;
		padding-inline: 0.8rem;
		border: 1px solid color-mix(in oklch, var(--entry-accent) 55%, transparent);
		border-radius: 999px;
		font-size: var(--font-size-min, 0.875rem);
		font-weight: 700;
	}

	@media (max-width: 520px) {
		li {
			grid-template-columns: 3rem minmax(0, 1fr);
		}

		.year {
			width: 3rem;
			height: 3rem;
		}

		li:not(:last-child)::after {
			left: 1.45rem;
		}

		a {
			grid-template-columns: minmax(0, 1fr) auto;
			gap: 0.55rem;
			min-height: 5.25rem;
			padding: 0.55rem;
		}

		.open-label {
			justify-self: end;
			min-height: 2.25rem;
			padding-inline: 0;
			border: 0;
		}
	}

	@media (min-width: 700px) and (max-height: 560px) {
		.chronological-index {
			grid-template-rows: auto minmax(0, 1fr);
			height: 100%;
			min-height: 0;
		}

		header {
			grid-template-columns: minmax(0, 1fr) minmax(16rem, 0.8fr);
			align-items: end;
			gap: 1rem;
		}

		ol {
			min-height: 0;
			overflow-y: auto;
			padding-right: 0.5rem;
			scrollbar-gutter: stable;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		a {
			transition: none;
		}
	}
</style>
