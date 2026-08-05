<!--
  CombinatorLab — two cards in, the complete taxonomy of LOOPs they make.

  Reads `findLOOPCombinations` (Stage 1-4, src/lib/shared/combination/services/
  loop-combinator.ts). This surface is deliberately thin: it picks two cards,
  runs the engine, and renders what comes back. It decides nothing about what
  closes.

  The organising principle is the COUNT BUCKET — full circle length, which is
  unit length x the order of the closing transform — because that is the number
  a performer thinks in. LOOP type groups inside a bucket. Rows are flat and
  every one is auditable: a count you can see is the point.

  Rendering discipline: a bucket can hold 144 rows of up to 24 pictographs, so
  step art mounts through an IntersectionObserver and only for rows near the
  viewport. Nothing is silently dropped -- when a bucket is folded, the row says
  how many it is hiding (`.claude/rules` -> no silent caps).
-->
<script lang="ts">
	import { onMount } from "svelte";
	import FilterChipBase from "$lib/shared/browse/components/filter-chips/FilterChipBase.svelte";
	import PictographContainer from "$lib/shared/pictograph/shared/components/PictographContainer.svelte";
	import { BASE_SEQUENCES } from "$lib/shared/combination/domain/base-sequence-registry";
	import { findLOOPCombinations } from "$lib/shared/combination/services/loop-combinator";
	import type { LOOPCombinatorReport } from "$lib/shared/combination/services/loop-combinator";

	// Roster-confirmed bases first; placeholders stay selectable but read as
	// provisional, because their letter data is canon-grounded and only their
	// MEMBERSHIP is open (see base-sequence-registry).
	const ROSTER = [...BASE_SEQUENCES].sort(
		(a, b) => Number(b.rosterConfirmed) - Number(a.rosterConfirmed) || a.word.localeCompare(b.word),
	);

	let cardA = $state<string | null>("AA");
	let cardB = $state<string | null>("GG");
	let report = $state<LOOPCombinatorReport | null>(null);
	let running = $state(false);
	let error = $state<string | null>(null);
	let elapsedMs = $state(0);
	let expandedBuckets = $state<Set<number>>(new Set());

	const ROWS_PER_BUCKET_FOLDED = 6;

	const entryOf = (word: string | null) => ROSTER.find((b) => b.word === word) ?? null;
	const lettersOf = (word: string | null): ReadonlySet<string> =>
		new Set((entryOf(word)?.letters ?? []) as string[]);

	const ready = $derived(Boolean(cardA && cardB));

	function pick(slot: "a" | "b", word: string) {
		// At most one per slot, clearing on re-click. Chip toggles are the right
		// primitive for that shape; a SegmentedControl cannot express "none", and
		// 19 options in one would stretch to a progress bar.
		if (slot === "a") cardA = cardA === word ? null : word;
		else cardB = cardB === word ? null : word;
	}

	async function combine() {
		if (!ready || running) return;
		running = true;
		error = null;
		const t0 = performance.now();
		try {
			report = await findLOOPCombinations({
				cardALetters: lettersOf(cardA),
				cardBLetters: lettersOf(cardB),
			});
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
			report = null;
		} finally {
			elapsedMs = performance.now() - t0;
			running = false;
		}
	}

	function toggleBucket(count: number) {
		const next = new Set(expandedBuckets);
		if (next.has(count)) next.delete(count);
		else next.add(count);
		expandedBuckets = next;
	}

	/** Which card a step's letter came from, for the origin colouring. */
	function originOf(letter: string): "a" | "b" | "connector" {
		if (lettersOf(cardA).has(letter)) return "a";
		if (lettersOf(cardB).has(letter)) return "b";
		return "connector";
	}

	// Step art mounts only when a row nears the viewport.
	let observer: IntersectionObserver | null = null;
	let visibleRows = $state<Set<string>>(new Set());

	onMount(() => {
		observer = new IntersectionObserver(
			(entries) => {
				let changed = false;
				const next = new Set(visibleRows);
				for (const entry of entries) {
					const key = (entry.target as HTMLElement).dataset.rowKey;
					if (key && entry.isIntersecting && !next.has(key)) {
						next.add(key);
						changed = true;
					}
				}
				if (changed) visibleRows = next;
			},
			{ rootMargin: "400px 0px" },
		);
		return () => observer?.disconnect();
	});

	function watchRow(node: HTMLElement) {
		observer?.observe(node);
		return {
			destroy() {
				observer?.unobserve(node);
			},
		};
	}
</script>

<div class="combinator">
	<header class="head">
		<h1>Combinator</h1>
		<p class="lede">
			Two cards in, every LOOP they make out — bucketed by full circle count, complete inside the
			stated box.
		</p>
	</header>

	<section class="slots" aria-label="Card selection">
		{#each [{ id: "a", label: "Card A", value: cardA }, { id: "b", label: "Card B", value: cardB }] as slot (slot.id)}
			<div class="slot" data-slot={slot.id}>
				<div class="slot-head">
					<span class="slot-label">{slot.label}</span>
					<span class="slot-value" class:empty={!slot.value}>{slot.value ?? "none"}</span>
				</div>
				<div class="chips">
					{#each ROSTER as base (base.word)}
						<FilterChipBase
							mode="toggle"
							size="sm"
							label={base.word}
							active={slot.value === base.word}
							chipColor={slot.id === "a" ? "var(--semantic-blue, #60a5fa)" : "var(--semantic-red, #f87171)"}
							ariaLabel={`${slot.label}: ${base.word}${base.rosterConfirmed ? "" : " (provisional)"}`}
							onclick={() => pick(slot.id as "a" | "b", base.word)}
						/>
					{/each}
				</div>
			</div>
		{/each}

		<div class="actions">
			<button class="combine" disabled={!ready || running} onclick={combine}>
				{running ? "Combining…" : "Combine"}
			</button>
		</div>
	</section>

	{#if error}
		<p class="error" role="alert">{error}</p>
	{/if}

	{#if report}
		{@const distinctWords = new Set(report.combinations.map((c) => c.displayWord)).size}
		<section class="statement" aria-label="Completeness">
			<!--
				Altitude matters here. SHAPES lead, words are the drill-down, and the
				realization count (report.units.length — 7,217 for A+G) is diagnostic
				only. An early version of this line led with it and read as noise,
				which is the exact failure the redesign exists to fix.
			-->
			<p>
				<strong>{report.shapes.length}</strong>
				{report.shapes.length === 1 ? "shape" : "shapes"}
				· <strong>{distinctWords}</strong> words ·
				<strong>{report.buckets.length}</strong> count buckets.
			</p>
			<p class="fine">
				Complete within the box: unit ≤ {report.box.maxUnitLength} steps, ≤ {report.box
					.maxConnectors} connectors, both cards required. No truncation. Searched
				{report.rawUnitCount.toLocaleString()} closing walks in {Math.round(elapsedMs)}ms.
			</p>
		</section>

		<section class="buckets" aria-label="Results by circle count">
			{#each report.buckets as bucket (bucket.count)}
				{@const open = expandedBuckets.has(bucket.count)}
				{@const rows = open ? bucket.combinations : bucket.combinations.slice(0, ROWS_PER_BUCKET_FOLDED)}
				{@const hidden = bucket.combinations.length - rows.length}
				<article class="bucket">
					<h2 class="bucket-head">
						<span class="count">{bucket.count}</span>
						<span class="count-label">count</span>
						<!-- Words, not closures: this is the figure the oracle publishes
					     (A+G reads 4:10 5:18 6:60 8:32 10:80 12:144 16:12 20:50 24:54),
					     so a mismatch is visible rather than buried. -->
					<span class="bucket-n">
						{bucket.words.length}
						{bucket.words.length === 1 ? "word" : "words"}
					</span>
					</h2>

					<ul class="rows">
						<!--
							Keyed by POSITION, not by word+closure. Two distinct discoveries can
							share both: AJGF closing plain appears more than once in the 4-count
							bucket, because a word does not determine its realization (the same
							letters admit different variation choices, and phases of one cycle
							are separate rows). Keying on word+closure throws
							`each_key_duplicate` on the real A+G answer.
						-->
						{#each rows as combo, rowIndex (`${bucket.count}:${rowIndex}`)}
							{@const rowKey = `${bucket.count}:${rowIndex}`}
							<li class="row" data-row-key={rowKey} use:watchRow>
								<div class="row-head">
									<span class="badge" data-family={combo.closure.family}>{combo.closure.label}</span>
									<!-- Already simplified by the engine (LOOPCombination.displayWord),
									     which routes through simplifyRepeatedWord. -->
									<span class="word">{combo.displayWord}</span>
									<span class="meta">
										{combo.unit.steps.length}-step unit × {combo.closure.circleMultiplier}
									</span>
								</div>

								<ol class="steps" aria-label="Unit steps">
									{#each combo.unit.steps as step, i (i)}
										<li class="step" data-origin={originOf(step.letter)}>
											{#if visibleRows.has(rowKey)}
												<PictographContainer
													pictographData={step}
													darkMode={true}
													disableTransitions={true}
													disableContentTransitions={true}
												/>
											{/if}
										</li>
									{/each}
								</ol>
							</li>
						{/each}
					</ul>

					{#if hidden > 0 || open}
						<button class="fold" onclick={() => toggleBucket(bucket.count)}>
							{open ? `Show fewer` : `Show ${hidden} more`}
						</button>
					{/if}
				</article>
			{/each}
		</section>
	{:else if !running}
		<p class="empty-state">Pick two cards and press Combine.</p>
	{/if}
</div>

<style>
	/*
		The lab shell is `height: 100%; overflow: hidden` (LabModule .lab-module),
		so a tab that just grows gets CLIPPED — the results were unreachable below
		the fold with no scrollbar. The tab owns its own scrolling, as the sibling
		labs do. `min-height: 0` is load-bearing: without it a flex child refuses to
		shrink below its content and the overflow never engages.
	*/
	.combinator {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		padding: 1.5rem;
		width: 100%;
		height: 100%;
		min-height: 0;
		overflow-y: auto;
		overscroll-behavior: contain;
	}

	/* The band stays centred while the SCROLLER stays full-width, so the
	   scrollbar sits at the edge of the pane rather than mid-page. */
	.combinator > * {
		width: 100%;
		max-width: var(--shell-w, min(1720px, 92vw));
		margin-inline: auto;
		flex: 0 0 auto;
	}

	.head h1 {
		margin: 0;
		font-size: 1.75rem;
		font-weight: 700;
	}
	.lede {
		margin: 0.35rem 0 0;
		color: var(--theme-text-secondary, #9ca3af);
		font-size: 0.95rem;
	}

	.slots {
		display: grid;
		gap: 1rem;
		grid-template-columns: 1fr;
	}

	/*
		The two slots are otherwise identical walls of 19 chips, so the card they
		belong to has to be legible without reading the label: a tinted rail and a
		tinted value, blue for A and red for B, matching the step borders in the
		results below so origin colour means one thing on this page.
	*/
	.slot {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding-left: 0.75rem;
		border-left: 3px solid var(--slot-tint);
	}
	.slot[data-slot="a"] {
		--slot-tint: var(--semantic-blue, #60a5fa);
	}
	.slot[data-slot="b"] {
		--slot-tint: var(--semantic-red, #f87171);
	}

	.slot-head {
		display: flex;
		align-items: baseline;
		gap: 0.6rem;
	}
	.slot-label {
		font-weight: 600;
		font-size: 0.9rem;
	}
	/* Reserve the widest roster name so swapping cards never moves the row. */
	.slot-value {
		min-width: 5ch;
		font-variant-numeric: tabular-nums;
		color: var(--slot-tint);
		font-weight: 600;
	}
	.slot-value.empty {
		color: var(--theme-text-tertiary, #6b7280);
		font-weight: 400;
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}

	.actions {
		display: flex;
	}

	.combine {
		min-height: 44px;
		padding: 0 1.5rem;
		border-radius: 0.6rem;
		border: 1px solid var(--theme-accent, #a78bfa);
		background: var(--theme-accent, #a78bfa);
		color: #0b0b12;
		font-weight: 700;
		font-size: 1rem;
		cursor: pointer;
	}
	.combine:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}
	.combine:not(:disabled):hover {
		filter: brightness(1.1);
	}

	.statement {
		border: 1px solid var(--theme-border, #2b2b3a);
		border-radius: 0.75rem;
		padding: 0.9rem 1.1rem;
		background: var(--theme-surface-raised, rgba(255, 255, 255, 0.03));
	}
	.statement p {
		margin: 0;
	}
	.statement strong {
		font-variant-numeric: tabular-nums;
	}
	.fine {
		margin-top: 0.35rem !important;
		font-size: 0.85rem;
		color: var(--theme-text-secondary, #9ca3af);
	}

	.buckets {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	.bucket {
		border: 1px solid var(--theme-border, #2b2b3a);
		border-radius: 0.75rem;
		padding: 1rem;
	}

	.bucket-head {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
		margin: 0 0 0.75rem;
		font-size: 1rem;
	}
	.count {
		font-size: 1.6rem;
		font-weight: 800;
		font-variant-numeric: tabular-nums;
		color: var(--theme-accent, #a78bfa);
	}
	.count-label {
		color: var(--theme-text-secondary, #9ca3af);
		font-weight: 500;
	}
	.bucket-n {
		margin-left: auto;
		font-size: 0.85rem;
		color: var(--theme-text-secondary, #9ca3af);
		font-variant-numeric: tabular-nums;
	}

	/*
		A grid, not full-width rows. A 4-step unit is four pictographs wide; in a
		1700px row that left ~75% of the width empty with the meta marooned at the
		far edge. Still a flat list — one cell per closure, in reading order — just
		one that fills the canvas.

		Column counts are PINNED per tier rather than auto-filled: auto-fill against
		a min width produces more, thinner cells as the screen grows and orphans the
		last one (.claude/rules/4k-native-layout.md).
	*/
	.rows {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: 1fr;
		gap: 0.6rem;
	}

	.row {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		padding: 0.6rem;
		border-radius: 0.5rem;
		background: var(--theme-surface-raised, rgba(255, 255, 255, 0.04));
		border: 1px solid var(--theme-border, #2b2b3a);
	}

	.row-head {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.badge {
		font-size: 0.75rem;
		font-weight: 700;
		padding: 0.15rem 0.5rem;
		border-radius: 0.35rem;
		background: rgba(167, 139, 250, 0.18);
		color: var(--theme-accent, #a78bfa);
		white-space: nowrap;
	}
	.badge[data-family="plain"] {
		background: rgba(74, 222, 128, 0.16);
		color: #4ade80;
	}

	.word {
		font-weight: 700;
		font-size: 1.05rem;
		letter-spacing: 0.02em;
	}

	.meta {
		margin-left: auto;
		font-size: 0.8rem;
		color: var(--theme-text-secondary, #9ca3af);
		font-variant-numeric: tabular-nums;
	}

	.steps {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-wrap: wrap;
		gap: 0.3rem;
	}

	/* Fixed box so the row never reflows when the art mounts. */
	.step {
		width: 4.5rem;
		height: 4.5rem;
		border-radius: 0.35rem;
		overflow: hidden;
		border: 2px solid transparent;
		background: rgba(0, 0, 0, 0.25);
		flex: 0 0 auto;
	}
	.step[data-origin="a"] {
		border-color: var(--semantic-blue, #60a5fa);
	}
	.step[data-origin="b"] {
		border-color: var(--semantic-red, #f87171);
	}
	.step[data-origin="connector"] {
		border-color: var(--theme-text-tertiary, #6b7280);
		border-style: dashed;
	}

	.fold {
		margin-top: 0.75rem;
		min-height: 44px;
		padding: 0 1rem;
		border-radius: 0.5rem;
		border: 1px solid var(--theme-border, #2b2b3a);
		background: transparent;
		color: var(--theme-text, #e5e7eb);
		font-weight: 600;
		cursor: pointer;
	}
	.fold:hover {
		background: rgba(255, 255, 255, 0.05);
	}

	.error {
		color: #f87171;
	}
	.empty-state {
		color: var(--theme-text-secondary, #9ca3af);
	}

	/* Two card slots side by side once there is room for both chip rows. */
	@media (min-width: 900px) {
		.slots {
			grid-template-columns: 1fr 1fr;
		}
		.actions {
			grid-column: 1 / -1;
		}
		.rows {
			grid-template-columns: repeat(2, 1fr);
		}
	}

	/*
		Column counts are chosen so a cell always fits the BOX'S LONGEST UNIT
		(6 steps) on one line. At four columns a 6-step unit wrapped 5+1 and left a
		lone pictograph on its own row — the "never a row of one" failure. Three
		columns at the 1680 seam gives ~540px per cell against 6 x 4.5rem + gaps
		(~456px), so every strip is one line and every cell is the same height.
	*/

	/* The site-wide big-screen seam (.claude/rules/4k-native-layout.md). */
	@media (min-width: 1680px) {
		.combinator {
			padding: 2rem;
			gap: 2rem;
		}
		.rows {
			grid-template-columns: repeat(3, 1fr);
		}
	}

	/* Second tier: above here nothing is scaling for you, so element size steps. */
	@media (min-width: 2600px) {
		.rows {
			grid-template-columns: repeat(4, 1fr);
		}
		.step {
			width: 5.5rem;
			height: 5.5rem;
		}
	}
</style>
