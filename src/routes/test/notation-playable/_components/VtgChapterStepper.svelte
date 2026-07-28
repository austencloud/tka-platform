<!--
  Vulcan Tech Gospel artifact: VTG 1's five chapters, stepped by hand.

  Two decisions this component exists to hold:

  1. NOTHING ADVANCES ON A TIMER. An auto-crossfade takes the plate away while
     you are still reading it, and these plates take reading. Stepping is an
     action the viewer performs, so the transition can also be an instant cut —
     you chose the moment, so there is nothing to soften.

  2. THE STEPS ARE THE DOCUMENT'S OWN TABLE OF CONTENTS, not a sequence anyone
     here curated. Five chapters, five authors, in VTG V.1's printed order. The
     rail deliberately echoes the archive's 2009–2022 timeline: this is that
     timeline zoomed into one entry, not a second competing timeline.

  Every plate is cropped from the source PDF. Provenance and quotes:
  ../_lib/vtg-chronicle.ts
-->
<script lang="ts">
	import { VTG1_CHAPTERS, vtgChapter } from "../_lib/vtg-chronicle.svelte";

	let { active = false }: { active?: boolean } = $props();

	const chapters = VTG1_CHAPTERS;
	// Shared across every instance on the page — see vtgChapter's own comment.
	const step = $derived(vtgChapter.index);
	const current = $derived(chapters[step] ?? chapters[0]!);

	function go(n: number) {
		vtgChapter.index = (n + chapters.length) % chapters.length;
	}

	function onKeydown(event: KeyboardEvent) {
		if (event.key === "ArrowRight" || event.key === "ArrowDown") {
			event.preventDefault();
			go(step + 1);
		} else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
			event.preventDefault();
			go(step - 1);
		} else if (event.key === "Home") {
			event.preventDefault();
			go(0);
		} else if (event.key === "End") {
			event.preventDefault();
			go(chapters.length - 1);
		}
	}

	/* Ghost sizers: the title and the credit both change length between
	   chapters, and without a reserved box the rail below them would jump on
	   every step (.claude/rules/no-layout-shift.md). */
	const widestTitle = chapters.reduce(
		(a, c) => (c.title.length > a.length ? c.title : a),
		""
	);
	const widestPeople = chapters.reduce(
		(a, c) => (c.people.length > a.length ? c.people : a),
		""
	);
	const widestNote = chapters.reduce(
		(a, c) => (c.note.length > a.length ? c.note : a),
		""
	);
</script>

<div class="vtg">
	<figure class="stage">
		<!-- No crossfade: an instant swap is correct for a hand-driven stepper,
		     and overlapping two dense line lattices produces moiré anyway. -->
		<img
			src={`/images/notation/vtg/figures/${current.figure}.webp`}
			alt={`${current.title}, from the Vulcan Tech Gospel V.1`}
			decoding="async"
		/>
	</figure>

	<figcaption class="label">
		<span class="title">
			<span class="sizer" aria-hidden="true">{widestTitle}</span>
			<span class="live">{current.title}</span>
		</span>
		<span class="people">
			<span class="sizer" aria-hidden="true">{widestPeople}</span>
			<span class="live">{current.people}</span>
		</span>
		<!-- Only rendered on a tall tile (see .note's container query). A 4K hero
		     is 1702px tall and one landscape plate cannot fill it; rather than
		     stretch the artwork, the room goes to Yee's own account of who wrote
		     the chapter and where. -->
		<span class="note">
			<span class="sizer" aria-hidden="true">{widestNote}</span>
			<span class="live">{current.note}</span>
		</span>
	</figcaption>

	<!-- The rail. Tabs semantics rather than a listbox: each stop selects which
	     plate is on the stage, which is exactly what a tablist does. -->
	<div
		class="rail"
		role="tablist"
		aria-label="Vulcan Tech Gospel volume 1, chapters"
		tabindex="-1"
		onkeydown={onKeydown}
	>
		{#each chapters as chapter, n (chapter.figure)}
			<button
				type="button"
				role="tab"
				class="stop"
				class:on={n === step}
				class:done={n < step}
				aria-selected={n === step}
				tabindex={n === step ? 0 : -1}
				title={`${n + 1}. ${chapter.title}`}
				aria-label={`Chapter ${n + 1} of ${chapters.length}: ${chapter.title}, ${chapter.people}`}
				onclick={() => go(n)}
			>
				<span class="tick" aria-hidden="true"></span>
			</button>
		{/each}

		<span class="count" aria-hidden="true">{step + 1}<i>/</i>{chapters.length}</span>
	</div>
</div>

<style>
	.vtg {
		width: 100%;
		height: 100%;
		min-height: 0;
		box-sizing: border-box;
		display: grid;
		/* All three rows hug their content and the GROUP centres, rather than
		   the stage absorbing the slack. Every VTG page is landscape and this
		   tile is portrait, so a stage that takes the leftover height strands
		   the plate in mid-air with the credit and rail marooned at the bottom
		   edge. Centring the group puts equal void above and below one
		   composed unit — plate, title, rail — which is what a plate on a wall
		   looks like. */
		grid-template-rows: auto auto auto;
		align-content: center;
		gap: clamp(0.35rem, 1.6cqi, 0.8rem);
		padding: clamp(0.5rem, 2.5cqi, 1.4rem);
	}

	.stage {
		margin: 0;
		min-height: 0;
		display: grid;
		place-items: center;
	}

	/* The paper is the FIGURE's rectangle, not the tile's. Every VTG page is
	   landscape and this tile is portrait, so a paper ground stretched to fill
	   would be ~40% blank page. Capping by max-* keeps the plate's own
	   proportions, which carry information: an isolation really is a dot beside
	   a full-size extension. */
	/* The cap is in cqh, NOT `max-height: 100%`. Once the stage stopped being a
	   `minmax(0, 1fr)` row it became auto-sized, which makes a percentage height
	   on its child indefinite — `max-height: 100%` silently stops binding and
	   the plate grows past the tile (caught at 960x412, where a 269px tile held
	   a 275px plate). 62cqh leaves room for the title, credit and rail beneath
	   it at every tile size. */
	.stage img {
		max-width: 100%;
		max-height: 62cqh;
		width: auto;
		height: auto;
		display: block;
		box-sizing: border-box;
		padding: clamp(0.4rem, 2cqi, 1rem);
		border-radius: 12px;
		background: oklch(0.96 0.008 90 / 0.95);
		border: 1px solid oklch(0.72 0.13 40 / 0.28);
		box-shadow: 0 10px 34px oklch(0.1 0.02 275 / 0.45);
	}

	.label {
		display: grid;
		justify-items: center;
		gap: 0.15rem;
		text-align: center;
		min-width: 0;
	}

	.title,
	.people {
		display: inline-grid;
		max-width: 100%;
	}

	/* The cqi COEFFICIENT is what binds here, not the ceiling — the hero tile is
	   508cqi wide at 1080 and 794cqi at 4K, so a 2.3cqi title tops out at 18px
	   even with a 2.1rem cap it can never reach. Raising the coefficient is what
	   actually scales this; the cap only stops it running away on an ultrawide. */
	.title {
		font-size: clamp(0.8rem, 3.6cqi, 2.2rem);
		font-weight: 600;
		letter-spacing: -0.005em;
		color: oklch(0.9 0.02 80);
	}

	.people {
		font-size: clamp(0.6rem, 2.6cqi, 1.6rem);
		font-style: italic;
		color: oklch(0.7 0.04 70);
	}

	.note {
		display: none;
		max-width: 44em;
		margin-top: 0.6rem;
		font-size: clamp(0.72rem, 2.2cqi, 1.4rem);
		line-height: 1.5;
		color: oklch(0.66 0.02 75);
	}

	/* Tall tiles only. The 1080 hero (~730px) has no room to spare; the 4K hero
	   (~1700px) has more void than plate. */
	@container (min-height: 900px) {
		.note {
			display: inline-grid;
		}
	}

	.sizer,
	.live {
		grid-area: 1 / 1;
	}

	/* The sizer WRAPS, deliberately. What has to be reserved here is HEIGHT, not
	   width: the label is centred with the rail below it, so a wider string
	   moves nothing sideways, but a string that wraps to two lines pushes the
	   rail down. A `nowrap` sizer reserves the longest credit's full unwrapped
	   width instead, which overflows a 257px tile and clips the live text.
	   Wrapping it reserves exactly the tallest case at the current width. */
	.sizer {
		visibility: hidden;
	}

	.live {
		min-width: 0;
	}

	/* Deliberately the archive timeline's own vocabulary — hairline ticks that
	   grow when chosen — so this reads as that rail magnified onto one entry. */
	.rail {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.1rem;
	}

	.stop {
		display: grid;
		place-items: center;
		/* 44px touch floor, kept as px on purpose: a target must not shrink with
		   the type ramp (.claude/rules/4k-native-layout.md). */
		width: 44px;
		height: 44px;
		padding: 0;
		border: 0;
		background: transparent;
		cursor: pointer;
	}

	.tick {
		width: 2px;
		height: 0.85rem;
		border-radius: 2px;
		background: oklch(0.45 0.02 270);
		transition: background 240ms ease, height 240ms ease, width 240ms ease;
	}

	.stop.done .tick {
		background: oklch(0.6 0.09 40);
	}

	.stop.on .tick {
		width: 3px;
		height: 1.5rem;
		background: oklch(0.78 0.16 40);
		box-shadow: 0 0 12px oklch(0.78 0.16 40 / 0.6);
	}

	.stop:hover .tick {
		background: oklch(0.72 0.13 40);
	}

	.stop:focus-visible {
		outline: 2px solid oklch(0.78 0.16 40);
		outline-offset: -6px;
		border-radius: 10px;
	}

	.count {
		margin-left: 0.5rem;
		font-size: clamp(0.55rem, 1.6cqi, 0.82rem);
		/* The step number changes width between 1 and 5 in a proportional face;
		   tabular figures stop the rail shifting under it. */
		font-variant-numeric: tabular-nums;
		color: oklch(0.62 0.03 70);
	}

	.count i {
		font-style: normal;
		margin: 0 0.1em;
		opacity: 0.55;
	}

	/* Small tile: the plate is the artifact. Credit and rail stand down rather
	   than squeezing it out of the tile — the stepper is a hero-tile affordance
	   and there is no room to hit a 44px target here anyway. */
	/* Threshold set from the archive's measured tiles: hero is 764 tall, the
	   small tiles ~378. At 378 a five-stop rail of 44px targets plus a wrapped
	   credit eats the plate, and the small tiles are posters you click, not
	   controls you operate — the stepper belongs to the hero. Keeping the
	   chapter title, which is the one thing worth reading at that size. */
	@container (max-height: 460px) {
		.people,
		.rail {
			display: none;
		}
	}

	@container (max-width: 200px) {
		.label {
			display: none;
		}
	}
</style>
