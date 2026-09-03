<script lang="ts">
	import { pressSpring } from "$lib/actions/press-spring";
	import {
		ARCHIVE_CLUSTERS,
		ARCHIVE_LANES,
		ARCHIVE_YEAR_TICKS,
		archiveEntry,
		entriesForLane,
		historicalYearPosition,
		placeArchiveEntries,
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

	let openClusterId = $state<string | null>(ARCHIVE_CLUSTERS[0]?.id ?? null);

	function toggleCluster(clusterId: string) {
		openClusterId = openClusterId === clusterId ? null : clusterId;
	}

	function entryHref(entry: ArchiveEntry) {
		return `#archive-record-${entry.id}`;
	}
</script>

<section class="time-map" aria-labelledby="archive-time-map-title">
	<header class="map-heading">
		<div>
			<p class="eyebrow">Chronological overview</p>
			<h2 id="archive-time-map-title">Four kinds of record, on one clock</h2>
		</div>
		<p class="scale-note">
			<span aria-hidden="true"></span>
			Position marks the first documented year. Spacing is proportional. A
			dotted line reaches a record's latest verified trace.
		</p>
	</header>

	<div class="year-axis" aria-hidden="true">
		<span class="axis-label">Calendar year</span>
		<div class="axis-track">
			{#each ARCHIVE_YEAR_TICKS as year}
				<span
					class="year-tick"
					class:at-start={historicalYearPosition(year) === 0}
					class:at-end={historicalYearPosition(year) === 100}
					style:left={`${historicalYearPosition(year)}%`}>{year}</span
				>
			{/each}
		</div>
	</div>

	<div class="lane-list">
		{#each ARCHIVE_LANES as lane (lane.id)}
			{@const cluster = ARCHIVE_CLUSTERS.find((item) => item.lane === lane.id)}
			{@const clusterIds = new Set(cluster?.entryIds ?? [])}
			{@const placements = placeArchiveEntries(
				entriesForLane(lane.id).filter((entry) => !clusterIds.has(entry.id))
			)}
			{@const trackCount = Math.max(1, ...placements.map((item) => item.track + 1))}
			<section class="lane" style:--track-count={trackCount} aria-labelledby={`lane-${lane.id}`}>
				<header class="lane-heading">
					<h3 id={`lane-${lane.id}`}>{lane.label}</h3>
					<p>{lane.description}</p>
				</header>

				<div class="lane-track">
					{#each ARCHIVE_YEAR_TICKS as year}
						<span
							class="calendar-guide"
							aria-hidden="true"
							style:left={`${historicalYearPosition(year)}%`}
						></span>
					{/each}

					<!--
					  Two verified endpoints, not a lifespan: the dotted connector runs
					  from entry.activity's documented year to its last verified trace.
					  A solid bar would claim uninterrupted activity no source supports.
					-->
					{#each placements.filter((placement) => placement.entry.activity && placement.spanEnd > placement.position) as placement (`span-${placement.entry.id}`)}
						<span
							class="observation-connector"
							aria-hidden="true"
							style:left={`${placement.position}%`}
							style:width={`${placement.spanEnd - placement.position}%`}
							style:--track={placement.track}
							style:--entry-accent={archiveAccent(placement.entry.id)}
						></span>
					{/each}

					{#if cluster}
						<span
							class="cluster-range"
							aria-hidden="true"
							style:left={`${historicalYearPosition(cluster.startYear)}%`}
							style:width={`${historicalYearPosition(cluster.endYear) - historicalYearPosition(cluster.startYear)}%`}
						></span>
						<button
							type="button"
							class="cluster-marker"
							class:is-active={cluster.entryIds.includes(activeEntryId)}
							style:left={`${historicalYearPosition((cluster.startYear + cluster.endYear) / 2)}%`}
							aria-expanded={openClusterId === cluster.id}
							aria-controls={`cluster-${cluster.id}`}
							onclick={() => toggleCluster(cluster.id)}
							use:pressSpring
						>
							<span>{cluster.dateLabel}</span>
							<strong>{cluster.label}</strong>
							<small>{openClusterId === cluster.id ? "Hide records" : "Show records"}</small>
						</button>
					{/if}

					<ol>
						{#each placements as placement (placement.entry.id)}
							<li
								class:at-start={placement.position < 3}
								class:at-end={placement.position > 97}
								style:left={`${placement.position}%`}
								style:--track={placement.track}
							>
								<a
									href={entryHref(placement.entry)}
									class:is-active={placement.entry.id === activeEntryId}
									style:--entry-accent={archiveAccent(placement.entry.id)}
									aria-current={placement.entry.id === activeEntryId ? "true" : undefined}
									onclick={(event) => {
										event.preventDefault();
										onselect(placement.entry);
									}}
									use:pressSpring
								>
									<span>{placement.entry.dateLabel}</span>
									<strong>{placement.entry.shortTitle}</strong>
								</a>
							</li>
						{/each}
					</ol>
				</div>
			</section>
		{/each}
	</div>

	<div class="cluster-slot">
		{#each ARCHIVE_CLUSTERS as cluster (cluster.id)}
			{#if openClusterId === cluster.id}
				<section id={`cluster-${cluster.id}`} class="cluster-tray" aria-label={`${cluster.dateLabel} cluster`}>
					<div class="cluster-title">
						<span>{cluster.dateLabel}</span>
						<strong>Dense period, separated for readability</strong>
					</div>
					<ol>
						{#each cluster.entryIds as entryId}
							{@const entry = archiveEntry(entryId)}
							<li>
								<a
									href={entryHref(entry)}
									class:is-active={entry.id === activeEntryId}
									style:--entry-accent={archiveAccent(entry.id)}
									aria-current={entry.id === activeEntryId ? "true" : undefined}
									onclick={(event) => {
										event.preventDefault();
										onselect(entry);
									}}
									use:pressSpring
								>
									<span>{entry.dateLabel}</span>
									<strong>{entry.shortTitle}</strong>
								</a>
							</li>
						{/each}
					</ol>
				</section>
			{/if}
		{/each}
	</div>
</section>

<style>
	.time-map {
		--archive-track-size: 3rem;
		display: grid;
		grid-template-rows: auto auto minmax(min-content, 1fr) auto;
		min-width: 0;
		gap: 0.45rem;
		container-type: inline-size;
	}

	.map-heading {
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: 1rem;
	}

	.map-heading p,
	.map-heading h2,
	.lane-heading h3,
	.lane-heading p,
	.scale-note {
		margin: 0;
	}

	.eyebrow {
		color: var(--theme-accent, oklch(0.76 0.13 290));
		font-size: var(--font-size-min, 0.875rem);
		font-weight: 750;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}

	.map-heading h2 {
		margin-top: 0.18rem;
		font: italic 650 clamp(1.15rem, 1.7vw, 1.7rem) / 1.1 "Fraunces", Georgia, serif;
		color: var(--theme-text, oklch(0.95 0.01 270));
	}

	.scale-note {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		color: var(--theme-text-dim, oklch(0.74 0.02 270));
		font-size: var(--font-size-min, 0.875rem);
		line-height: 1.35;
	}

	.scale-note > span {
		width: 2.5rem;
		height: 1px;
		background: var(--theme-accent, oklch(0.76 0.13 290));
	}

	.year-axis,
	.lane {
		display: grid;
		grid-template-columns: clamp(10.5rem, 18vw, 16rem) minmax(0, 1fr);
		gap: clamp(0.65rem, 1.5vw, 1.4rem);
		min-width: 0;
	}

	.year-axis {
		align-items: end;
		min-height: 1.5rem;
	}

	.axis-label {
		align-self: center;
		color: var(--theme-text-dim, oklch(0.74 0.02 270));
		font-size: var(--font-size-compact, 0.75rem);
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	.axis-track,
	.lane-track {
		position: relative;
		min-width: 0;
	}

	.axis-track::after {
		content: "";
		position: absolute;
		inset: auto 0 0;
		height: 1px;
		background: var(--theme-stroke-strong, oklch(1 0 0 / 0.24));
	}

	.year-tick {
		position: absolute;
		bottom: 0.35rem;
		translate: -50% 0;
		color: var(--theme-text-dim, oklch(0.74 0.02 270));
		font-size: var(--font-size-compact, 0.75rem);
		font-variant-numeric: tabular-nums;
	}

	.year-tick::after {
		content: "";
		position: absolute;
		left: 50%;
		top: calc(100% + 0.18rem);
		width: 1px;
		height: 0.35rem;
		background: var(--theme-stroke-strong, oklch(1 0 0 / 0.24));
	}

	.year-tick.at-start {
		translate: 0 0;
	}

	.year-tick.at-start::after {
		left: 0;
	}

	.year-tick.at-end {
		translate: -100% 0;
	}

	.year-tick.at-end::after {
		left: 100%;
	}

	.lane-list {
		display: flex;
		flex-direction: column;
		/* Flex, not `grid-template-rows: repeat(4, minmax(min-content, 1fr))`.
		   Equal `fr` rows look equivalent but size the grid's own intrinsic
		   height to four times the TALLEST lane: four 3-track rows, 611px, for
		   464px of content. The room is a fixed viewport, so those 147 wasted
		   pixels pushed the cluster tray under the fold where `overflow:
		   hidden` ate it and no scroll could reach it.

		   Each lane instead grows in proportion to the chip tracks it carries
		   and shrinks no further than that stack, so a 1-track lane no longer
		   reserves a 3-track lane's height. */
		min-height: 0;
		border-top: 1px solid var(--theme-stroke, oklch(1 0 0 / 0.12));
	}

	.lane {
		/* min-content floor: a lane can never squeeze below its track stack, so
		   chips stay inside their own lane at every tier. */
		flex: var(--track-count) 1 auto;
		min-height: calc(var(--track-count) * var(--archive-track-size) + 0.5rem);
		align-items: center;
		border-bottom: 1px solid var(--theme-stroke, oklch(1 0 0 / 0.12));
	}

	.lane-heading {
		display: grid;
		align-content: center;
		gap: 0.15rem;
		padding-block: 0.45rem;
	}

	.lane-heading h3 {
		color: var(--theme-text, oklch(0.95 0.01 270));
		font-size: var(--font-size-min, 0.875rem);
		font-weight: 750;
	}

	.lane-heading p {
		display: -webkit-box;
		overflow: hidden;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
		color: var(--theme-text-dim, oklch(0.74 0.02 270));
		font-size: var(--font-size-compact, 0.75rem);
		line-height: 1.35;
	}

	.lane-track {
		align-self: center;
		height: calc(var(--track-count) * var(--archive-track-size) + 0.5rem);
		min-height: calc(var(--track-count) * var(--archive-track-size) + 0.5rem);
	}

	.calendar-guide {
		position: absolute;
		inset-block: 0;
		width: 1px;
		background: var(--theme-stroke, oklch(1 0 0 / 0.08));
		pointer-events: none;
	}

	.observation-connector {
		position: absolute;
		top: calc(var(--track) * var(--archive-track-size) + 1.725rem);
		height: 0;
		border-top: 2px dotted
			color-mix(in oklch, var(--entry-accent) 55%, transparent);
		pointer-events: none;
	}

	.observation-connector::after {
		content: "";
		position: absolute;
		top: -1px;
		right: 0;
		width: 0.4rem;
		height: 0.4rem;
		border-radius: 50%;
		background: var(--entry-accent);
		translate: 0 -50%;
	}

	.lane-track ol,
	.cluster-tray ol {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.lane-track li {
		position: absolute;
		top: calc(var(--track) * var(--archive-track-size) + 0.35rem);
		/* Absolutely positioned boxes shrink-to-fit against the space right of
		   `left`, so chips near the 2026 edge collapse to a sliver without this. */
		width: max-content;
		translate: -50% 0;
	}

	.lane-track li.at-start {
		translate: 0 0;
	}

	.lane-track li.at-end {
		translate: -100% 0;
	}

	.lane-track a,
	.cluster-tray a,
	.cluster-marker {
		display: grid;
		min-height: 2.75rem;
		align-content: center;
		padding: 0.25rem 0.7rem;
		border: 1px solid var(--theme-stroke, oklch(1 0 0 / 0.16));
		border-radius: 999px;
		background: var(--theme-card-bg, oklch(0.17 0.012 270));
		box-sizing: border-box;
		color: var(--theme-text, oklch(0.95 0.01 270));
		font: inherit;
		line-height: 1.05;
		text-align: left;
		text-decoration: none;
		white-space: nowrap;
		cursor: pointer;
		transition: border-color var(--duration-fast, 150ms) ease, background var(--duration-fast, 150ms) ease;
	}

	.lane-track a {
		max-width: 8.5rem;
		border-left: 0.28rem solid var(--entry-accent);
	}

	.lane-track a span,
	.cluster-tray a span,
	.cluster-marker span,
	.cluster-marker small {
		color: var(--theme-text-dim, oklch(0.74 0.02 270));
		font-size: var(--font-size-compact, 0.75rem);
		font-variant-numeric: tabular-nums;
	}

	.lane-track a strong,
	.cluster-tray a strong,
	.cluster-marker strong {
		overflow: hidden;
		font-size: var(--font-size-min, 0.875rem);
		font-weight: 750;
		text-overflow: ellipsis;
	}

	.lane-track a:hover,
	.lane-track a:focus-visible,
	.cluster-tray a:hover,
	.cluster-tray a:focus-visible {
		border-color: var(--entry-accent);
		background: var(--theme-card-hover-bg, oklch(0.21 0.018 270));
		outline: none;
	}

	.lane-track a.is-active,
	.cluster-tray a.is-active {
		border-color: var(--entry-accent);
		background: color-mix(in oklch, var(--entry-accent) 18%, var(--theme-card-bg, oklch(0.17 0.012 270)));
		box-shadow: inset 0 0 0 1px color-mix(in oklch, var(--entry-accent) 55%, transparent);
	}

	.cluster-range {
		position: absolute;
		top: 1.65rem;
		height: 2px;
		min-width: 1.25rem;
		border-radius: 999px;
		background: var(--theme-accent, oklch(0.76 0.13 290));
	}

	.cluster-marker {
		position: absolute;
		top: 0.35rem;
		translate: -50% 0;
		border-color: color-mix(in oklch, var(--theme-accent, oklch(0.76 0.13 290)) 62%, transparent);
	}

	.cluster-marker small {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
	}

	.cluster-marker:hover,
	.cluster-marker:focus-visible,
	.cluster-marker.is-active {
		border-color: var(--theme-accent, oklch(0.76 0.13 290));
		background: color-mix(in oklch, var(--theme-accent, oklch(0.76 0.13 290)) 16%, var(--theme-card-bg, oklch(0.17 0.012 270)));
		outline: none;
	}

	.cluster-slot {
		min-height: 4rem;
	}

	.cluster-tray {
		display: grid;
		grid-template-columns: clamp(10.5rem, 18vw, 16rem) minmax(0, 1fr);
		gap: clamp(0.65rem, 1.5vw, 1.4rem);
		min-height: 4rem;
		align-items: center;
		padding: 0.35rem 0.55rem;
		border: 1px solid color-mix(in oklch, var(--theme-accent, oklch(0.76 0.13 290)) 35%, transparent);
		border-radius: var(--radius-2026-lg, 18px);
		background: color-mix(in oklch, var(--theme-accent, oklch(0.76 0.13 290)) 7%, var(--theme-card-bg, oklch(0.15 0.012 270)));
		box-sizing: border-box;
	}

	.cluster-title {
		display: grid;
		gap: 0.12rem;
	}

	.cluster-title span {
		color: var(--theme-accent, oklch(0.76 0.13 290));
		font-size: var(--font-size-min, 0.875rem);
		font-variant-numeric: tabular-nums;
		font-weight: 750;
	}

	.cluster-title strong {
		color: var(--theme-text, oklch(0.95 0.01 270));
		font-size: var(--font-size-compact, 0.75rem);
		font-weight: 650;
	}

	.cluster-tray ol {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 0.45rem;
	}

	.cluster-tray a {
		border-left: 0.28rem solid var(--entry-accent);
	}

	@container (max-width: 58rem) {
		.map-heading {
			align-items: start;
		}

		.scale-note {
			max-width: 18rem;
		}

		.year-axis,
		.lane,
		.cluster-tray {
			grid-template-columns: 9.5rem minmax(0, 1fr);
		}

		.lane-heading p {
			display: none;
		}

		.cluster-tray ol {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}

		.cluster-slot,
		.cluster-tray {
			min-height: 7rem;
		}
	}

	@media (min-width: 2600px) {
		.time-map {
			--archive-track-size: 3.5rem;
		}

		.observation-connector {
			top: calc(var(--track) * var(--archive-track-size) + 1.975rem);
		}

		.eyebrow,
		.scale-note,
		.axis-label,
		.year-tick,
		.lane-heading p,
		.lane-track a span,
		.cluster-tray a span,
		.cluster-marker span,
		.cluster-title span,
		.cluster-title strong {
			font-size: 1rem;
		}

		.map-heading h2 {
			font-size: 2.2rem;
		}

		.lane-heading h3,
		.lane-track a strong,
		.cluster-tray a strong,
		.cluster-marker strong {
			font-size: 1.1rem;
		}

		.lane-track a,
		.cluster-tray a,
		.cluster-marker {
			min-height: 3.25rem;
			padding-inline: 0.9rem;
		}

		/* Title font steps to 1.1rem here; the cap grows with it so no title
		   ellipsizes at 4K while shorter labels keep their content width. */
		.lane-track a {
			max-width: 11rem;
		}

		/* The stepped-up font needs a third line for full lane descriptions. */
		.lane-heading p {
			-webkit-line-clamp: 3;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.lane-track a,
		.cluster-tray a,
		.cluster-marker {
			transition: none;
		}
	}
</style>
