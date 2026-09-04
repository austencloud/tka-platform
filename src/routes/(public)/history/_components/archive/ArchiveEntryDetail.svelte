<script lang="ts">
	import {
		EVIDENCE_BASIS_LABELS,
		activityLabel,
		archiveLane,
		type ArchiveEntry,
	} from "./_lib/archive-ledger";

	let {
		entry,
		index,
		count,
	}: { entry: ArchiveEntry; index: number; count: number } = $props();

	const lane = $derived(archiveLane(entry.lane));
	const activity = $derived(activityLabel(entry));
</script>

<article class="entry-detail">
	<header class="entry-heading">
		<p>
			<span>{entry.dateLabel}</span>
			{#if activity}<span class="activity-label">{activity}</span>{/if}
			<span>{lane.label}</span>
			<span>{index + 1}/{count}</span>
		</p>
		<h2>{entry.title}</h2>
		<strong>{entry.people}</strong>
	</header>

	<p class="summary">{entry.summary}</p>

	{#if entry.catalogEntry?.subWorks?.length}
		<section class="supporting-record">
			<h3>Included works</h3>
			<ul>
				{#each entry.catalogEntry.subWorks as work (work.name)}
					<li><strong>{work.name}</strong> {work.note}</li>
				{/each}
			</ul>
		</section>
	{/if}

	{#if entry.catalogEntry?.videos?.length}
		<section class="supporting-record">
			<h3>Video record</h3>
			<ul>
				{#each entry.catalogEntry.videos as video (video.id)}
					<li>
						<a
							href={`https://www.youtube.com/watch?v=${video.id}`}
							target="_blank"
							rel="noopener">{video.title}</a
						>
						<span>{video.creator}{video.year ? `, ${video.year}` : ""}</span>
						{#if video.note}<p>{video.note}</p>{/if}
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	{#if entry.evidenceNote || entry.activity}
		<section class="editorial-note" data-status={entry.evidenceBasis}>
			<h3><span aria-hidden="true">●</span>{entry.evidenceLabel}</h3>
			<div>
				{#if entry.evidenceNote}<p>{entry.evidenceNote}</p>{/if}
				{#if entry.activity}
					<p class="activity-note">{entry.activity.note}</p>
				{/if}
			</div>
		</section>
	{/if}

	<section class="sources" aria-labelledby={`sources-${entry.id}`}>
		<h3 id={`sources-${entry.id}`}>Sources</h3>
		<ol>
			{#each entry.citations as citation, sourceIndex (citation.href)}
				<li>
					<span class="source-number">[{sourceIndex + 1}]</span>
					<div>
						<strong>{citation.label}</strong>
						<p>{citation.supports}</p>
						<small>{EVIDENCE_BASIS_LABELS[citation.basis]}</small>
					</div>
					<a
						href={citation.href}
						target={citation.href.startsWith("/") ? undefined : "_blank"}
						rel={citation.href.startsWith("/") ? undefined : "noopener"}
						>Open source</a
					>
				</li>
			{/each}
		</ol>
	</section>
</article>

<style>
	.entry-detail {
		display: grid;
		gap: clamp(1rem, 2vh, 1.5rem);
		color: var(--theme-text, oklch(0.95 0.01 270));
	}

	.entry-heading p,
	.entry-heading h2,
	.entry-heading strong,
	.summary,
	.editorial-note h3,
	.editorial-note p,
	.sources h3,
	.sources p,
	.supporting-record h3,
	.supporting-record p {
		margin: 0;
	}

	.entry-heading p {
		display: flex;
		gap: 0.8rem;
		color: var(--theme-text-dim, oklch(0.74 0.02 270));
		font-size: var(--font-size-min, 0.875rem);
		font-variant-numeric: tabular-nums;
	}

	.entry-heading p span:first-child {
		color: var(--artifact-accent, var(--theme-accent, oklch(0.76 0.13 270)));
	}

	.entry-heading h2 {
		margin-top: 0.4rem;
		font:
			650 clamp(2rem, 4vw, 4rem) / 0.98 "Fraunces",
			Georgia,
			serif;
		letter-spacing: -0.035em;
	}

	.entry-heading strong {
		display: block;
		margin-top: 0.45rem;
		color: var(--theme-text-dim, oklch(0.74 0.02 270));
		font-size: var(--font-size-min, 0.875rem);
		line-height: 1.5;
	}

	.summary {
		color: var(--theme-text, oklch(0.9 0.015 270));
		font-size: clamp(1rem, 1.2vw, 1.2rem);
		line-height: 1.6;
	}

	.editorial-note,
	.supporting-record,
	.sources {
		padding-top: 1rem;
		border-top: 1px solid var(--theme-stroke, oklch(1 0 0 / 0.13));
	}

	.editorial-note {
		display: grid;
		grid-template-columns: minmax(10rem, 0.3fr) minmax(0, 1fr);
		gap: 1rem;
	}

	.editorial-note[data-status="unresolved"] h3 {
		color: oklch(0.82 0.12 80);
	}

	.activity-label {
		color: var(--theme-text, oklch(0.95 0.01 270));
		font-weight: 700;
	}

	.activity-note {
		margin-top: 0.45rem;
	}

	.editorial-note h3 {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
	}

	.editorial-note h3 span {
		color: var(--artifact-accent, var(--theme-accent, oklch(0.76 0.13 270)));
		font-size: 0.75rem;
	}

	.editorial-note h3,
	.supporting-record h3,
	.sources h3 {
		font-size: var(--font-size-min, 0.875rem);
		font-weight: 750;
	}

	.editorial-note p,
	.supporting-record li,
	.sources li p,
	.sources li small {
		color: var(--theme-text-dim, oklch(0.74 0.02 270));
		font-size: var(--font-size-min, 0.875rem);
		line-height: 1.5;
	}

	.supporting-record ul,
	.sources ol {
		margin: 0.65rem 0 0;
		padding: 0;
		list-style: none;
	}

	.supporting-record li {
		padding: 0.65rem 0;
		border-top: 1px solid var(--theme-stroke, oklch(1 0 0 / 0.1));
	}

	.supporting-record li:first-child {
		border-top: 0;
	}

	.supporting-record li > a,
	.supporting-record li > strong {
		color: var(--theme-text, oklch(0.95 0.01 270));
		font-weight: 700;
	}

	.supporting-record li > a {
		text-underline-offset: 0.2em;
	}

	.supporting-record li > span {
		display: block;
		margin-top: 0.15rem;
	}

	.supporting-record li > p {
		margin-top: 0.2rem;
	}

	.sources ol {
		display: grid;
		gap: 0.65rem;
	}

	.sources li {
		display: grid;
		grid-template-columns: 3rem minmax(0, 1fr) auto;
		gap: 0.75rem;
		align-items: start;
		padding: 0.9rem;
		border: 1px solid var(--theme-stroke, oklch(1 0 0 / 0.12));
		border-radius: var(--radius-2026-md, 14px);
		background: var(--theme-card-bg, oklch(0.18 0.015 270));
	}

	.source-number {
		color: var(--artifact-accent, var(--theme-accent, oklch(0.76 0.13 270)));
		font-size: var(--font-size-min, 0.875rem);
		font-variant-numeric: tabular-nums;
	}

	.sources li strong {
		display: block;
		font-size: var(--font-size-min, 0.875rem);
	}

	.sources li p {
		margin-top: 0.2rem;
	}

	.sources li small {
		display: block;
		margin-top: 0.25rem;
		font-size: var(--font-size-compact, 0.75rem);
	}

	.sources li > a {
		display: inline-flex;
		min-height: 2.75rem;
		align-items: center;
		padding: 0 0.75rem;
		border: 1px solid var(--theme-stroke, oklch(1 0 0 / 0.13));
		border-radius: 999px;
		color: var(--theme-text, oklch(0.95 0.01 270));
		font-size: var(--font-size-min, 0.875rem);
		text-decoration: none;
	}

	.sources li > a:hover,
	.sources li > a:focus-visible {
		border-color: var(
			--artifact-accent,
			var(--theme-accent, oklch(0.76 0.13 270))
		);
		outline: none;
	}

	@media (max-width: 700px) {
		.editorial-note {
			grid-template-columns: 1fr;
			gap: 0.35rem;
		}

		.sources li {
			grid-template-columns: 2.5rem minmax(0, 1fr);
		}

		.sources li > a {
			grid-column: 2;
			justify-self: start;
		}
	}

	@media (min-width: 2600px) {
		.entry-heading p,
		.entry-heading strong,
		.editorial-note h3,
		.supporting-record h3,
		.sources h3,
		.editorial-note p,
		.supporting-record li,
		.sources li p,
		.sources li small,
		.sources li strong,
		.sources li > a,
		.source-number {
			font-size: 1rem;
		}
	}
</style>
