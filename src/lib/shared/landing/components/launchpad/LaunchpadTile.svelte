<script lang="ts">
	/**
	 * LaunchpadTile
	 *
	 * One bento tile in the homepage Launchpad grid: a real SSR `<a>` (heading +
	 * descriptor always in the markup) with a lazy-mounted living media layer
	 * that only activates once the tile scrolls into view (`active`, driven by
	 * the parent's IntersectionObserver).
	 *
	 * Chips (LOOP Deck, Staves, ...) are real `<a>` elements and must be
	 * siblings of the main tile link, never nested inside it — nested
	 * interactive elements are invalid HTML and break keyboard/AT navigation.
	 */
	import { tilt } from "$lib/actions/tilt";
	import { cursorGlow } from "$lib/actions/cursor-glow";
	import { pressSpring } from "$lib/actions/press-spring";
	import { magnetic } from "$lib/actions/magnetic";
	import LazyMount from "$lib/shared/components/LazyMount.svelte";
	import type { LaunchpadTileDef } from "./launchpad-tiles";
	import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
	import demoJson from "$lib/shared/landing/data/demo-sequence.json";

	let {
		tile,
		active,
		index,
		onActivate,
	}: {
		tile: LaunchpadTileDef;
		active: boolean;
		index: number;
		/** Supplied by action-mode consumers; combined with `tile.activate` it swaps the anchor for a button. */
		onActivate?: (tile: LaunchpadTileDef) => void;
	} = $props();

	// Action mode: an opted-in tile with a handler renders its primary control as
	// a <button> that fires onActivate (opening a takeover) instead of navigating.
	// Homepage tiles never set `activate`, so they stay anchors — no behavior
	// change on the front page.
	const isAction = $derived(tile.activate === true && typeof onActivate === "function");

	// Shared demo fixture backing every live media embed on the grid — the same
	// composer/mandala/pictograph preview data used elsewhere on marketing
	// surfaces (SequenceHeroDemo). Cast once at module evaluation; the JSON was
	// authored directly against the SequenceData/StepData shape.
	const demoSequence = demoJson as unknown as SequenceData;
	const demoStep = demoSequence.steps[0];
</script>

<li
	class="tile s-{tile.span} t-{tile.id}"
	class:visible={active}
	style="--c: {tile.color}; --i: {index}"
	data-tile-id={tile.id}
>
	<div class="card" use:tilt use:cursorGlow use:pressSpring use:magnetic={tile.magnetic ?? false}>
		{#snippet primary()}
			<i class="mark fas {tile.icon}" aria-hidden="true"></i>

			{#if tile.media || tile.mediaLoader}
				<span class="media media-{tile.media ?? 'custom'}" aria-hidden="true">
					{#if tile.media === "mandala"}
						<span class="mandala-box">
							<LazyMount
								loader={() => import("$lib/shared/mandala/components/SequenceMandala.svelte")}
								{active}
								props={{ sequence: demoSequence, style: "stroke", animate: false, show: "both", size: 510 }}
							/>
						</span>
					{:else if tile.media === "choreo-card"}
						<span class="choreo-card-box">
							<LazyMount
								loader={() => import("$lib/shared/sequence-viewer/components/ChoreoCard.svelte")}
								{active}
								props={{
									sequence: demoSequence,
									showQRCode: false,
									showNotes: false,
									showCreatorName: false,
									showBirthday: false,
								}}
							/>
						</span>
					{:else if tile.media === "pictograph"}
						<span class="pictograph-box">
							<LazyMount
								loader={() =>
									import("$lib/shared/pictograph/shared/components/PictographContainer.svelte")}
								{active}
								props={{
									pictographData: demoStep,
									disableTransitions: true,
									darkMode: true,
									transparentBackground: true,
								}}
							/>
						</span>
					{:else if tile.media === "pictograph-fade"}
						<span class="pictograph-fade-box">
							<LazyMount
								loader={() => import("./PictographFadeCard.svelte")}
								{active}
								props={{ steps: demoSequence.steps.slice(0, 4), startDelayMs: index * 900 }}
							/>
						</span>
					{:else if tile.media === "dictionary"}
						<span class="dictionary-box">
							<LazyMount
								loader={() => import("./GlossaryDictionaryCard.svelte")}
								{active}
								props={{ startDelayMs: index * 900 }}
							/>
						</span>
					{:else if tile.media === "guide-cover"}
						<span class="guide-cover-box">
							<LazyMount
								loader={() => import("$lib/features/store/components/BookCoverArt.svelte")}
								{active}
								props={{ width: "100%" }}
							/>
						</span>
					{:else if tile.media === "alphabet-strip"}
						<span class="alphabet-box">
							<LazyMount loader={() => import("./AlphabetMarquee.svelte")} {active} />
						</span>
					{:else if tile.mediaLoader}
						<LazyMount loader={tile.mediaLoader} {active} props={tile.mediaProps} />
					{/if}
				</span>
			{/if}

			<span class="body">
				<h2>{tile.heading}</h2>
				<p>{tile.descriptor}</p>
			</span>
		{/snippet}

		{#if isAction}
			<button type="button" class="tile-link" onclick={() => onActivate?.(tile)}>
				{@render primary()}
			</button>
		{:else}
			<a class="tile-link" href={tile.href}>
				{@render primary()}
			</a>
		{/if}

		<div class="glow" aria-hidden="true"></div>

		{#if tile.chips}
			<ul class="chips">
				{#each tile.chips as chip (chip.href)}
					<li><a class="chip" href={chip.href}>{chip.label}</a></li>
				{/each}
			</ul>
		{/if}
	</div>
</li>

<style>
	/* ---- grid placement (the <li> is a direct child of the parent's CSS
	   grid; span rules apply here even though the grid itself is declared in
	   LaunchpadGrid.svelte, because grid-column/grid-row are properties of
	   this element, not of its owning component). ---- */
	.tile {
		list-style: none;
		border-radius: 22px;
		/* Drop shadow lives here (not on .card, which is overflow:hidden for
		   media clipping) so it never gets clipped by that overflow. One
		   consolidated transition covers hover shadow, the reveal (opacity/
		   translate, values set by LaunchpadGrid) and the spotlight dim
		   (opacity/filter) — split declarations across the two components were
		   overriding each other, which made un-hover snap. */
		box-shadow: 0 18px 40px -28px rgba(0, 0, 0, 0.8);
		transition:
			box-shadow 0.3s ease,
			opacity 0.35s ease,
			filter 0.35s ease,
			translate 0.5s ease;
		/* Near-imperceptible breathing, staggered per tile via --i. */
		animation: tileBreathe 7.5s ease-in-out infinite;
		animation-delay: calc(var(--i, 0) * -0.9s);
	}
	.tile:hover {
		box-shadow: 0 30px 56px -26px color-mix(in oklch, var(--c) 38%, black);
	}

	.s-2x2 {
		grid-column: span 2;
		grid-row: span 2;
	}
	.s-2x1 {
		grid-column: span 2;
		grid-row: span 1;
	}
	.s-1x1 {
		grid-column: span 1;
		grid-row: span 1;
	}

	@keyframes tileBreathe {
		0%,
		100% {
			scale: 1;
		}
		50% {
			scale: 1.006;
		}
	}

	/* ---- the card surface: border, glass fill, tilt/press/magnetic transform ---- */
	.card {
		position: relative;
		height: 100%;
		border-radius: 22px;
		overflow: hidden;
		isolation: isolate;
		/* Literal glass, matching SequenceHeroDemo's stage on this same page —
		   the cosmic theme pipeline sets --theme-card-bg to a near-opaque
		   content-panel black (rgba(0,0,0,.75)), which would render these as
		   heavy slabs instead of glass over the canvas. */
		border: 1px solid oklch(0.4 0.04 270 / 0.16);
		background: oklch(0.16 0.018 270 / 0.45);
		backdrop-filter: blur(14px);
		-webkit-backdrop-filter: blur(14px);
		box-shadow: 0 1px 0 0 rgba(255, 255, 255, 0.18) inset;
		transform: perspective(var(--rot-perspective, 800px)) rotateX(var(--rot-x, 0deg))
			rotateY(var(--rot-y, 0deg)) scale(var(--press, 1));
		translate: var(--mag-x, 0px) var(--mag-y, 0px);
		transition:
			border-color 0.3s ease,
			box-shadow 0.3s ease;
		will-change: transform;
	}
	/* Top specular sheen, matching the reference sketch's glass-card language. */
	.card::before {
		content: "";
		position: absolute;
		inset: 0;
		z-index: 3;
		pointer-events: none;
		background: linear-gradient(160deg, rgba(255, 255, 255, 0.5), transparent 32%);
		opacity: 0.1;
		mix-blend-mode: overlay;
	}
	.tile:hover .card {
		border-color: color-mix(in oklch, var(--c) 55%, rgba(255, 255, 255, 0.22));
	}

	/* Kill only the rotation components on coarse pointers (the package
	   already skips touch there; this is the belt-and-suspenders CSS-level
	   guarantee the project's constraints call for). Scale/translate from
	   press/magnetic are untouched. */
	@media (pointer: coarse) {
		.card {
			--rot-x: 0deg;
			--rot-y: 0deg;
		}
	}

	.tile-link {
		position: absolute;
		inset: 0;
		z-index: 1;
		display: block;
		color: inherit;
		text-decoration: none;
		/* Button-reset so action-mode tiles (rendered as a <button> instead of an
		   <a>) are pixel-identical to the anchor. Every value here is the anchor's
		   own default, so the homepage anchor path is unchanged. */
		appearance: none;
		margin: 0;
		padding: 0;
		border: 0;
		background: none;
		font: inherit;
		text-align: inherit;
		cursor: pointer;
	}
	/* Keyboard focus: the tile is the interactive unit, so the ring hugs the
	   card's rounded box (inside it — the card clips overflow). */
	.tile-link:focus-visible {
		outline: 2px solid var(--c);
		outline-offset: -3px;
		border-radius: 22px;
	}
	.card:has(.tile-link:focus-visible) {
		border-color: color-mix(in oklch, var(--c) 55%, rgba(255, 255, 255, 0.22));
	}

	.mark {
		position: absolute;
		top: 0.95rem;
		left: 1.05rem;
		z-index: 2;
		font-size: 1.15rem;
		color: var(--c);
		opacity: 0.92;
	}

	.media {
		position: absolute;
		inset: 0;
		z-index: 0;
		overflow: hidden;
		pointer-events: none;
	}

	.mandala-box {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		opacity: 0.92;
	}
	.mandala-box :global(.mandala-container) {
		max-width: min(21.25rem, 100%);
		max-height: min(21.25rem, 100%);
	}

	.choreo-card-box {
		position: absolute;
		right: -6%;
		top: 50%;
		width: 10.625rem;
		aspect-ratio: 5 / 7;
		transform: translateY(-50%) rotate(-6deg);
		box-shadow: 0 16px 32px -18px rgba(0, 0, 0, 0.6);
		opacity: 0.96;
	}

	.pictograph-box {
		position: absolute;
		right: 0;
		top: 0;
		bottom: 0;
		aspect-ratio: 1;
		opacity: 0.94;
	}

	/* Card framing lives here (not in PictographFadeCard.svelte), matching how
	   .choreo-card-box frames ChoreoCard.svelte above: the wrapper owns
	   position/rotation/shadow, the loaded component just fills the box. */
	.pictograph-fade-box {
		position: absolute;
		inset: 9% 11%;
		border-radius: 10px;
		overflow: hidden;
		background: #fdfcf9;
		box-shadow: 0 14px 30px -16px rgba(0, 0, 0, 0.55);
		rotate: -3deg;
	}

	/* Text stays clear of the corner mark (top) and the scrim/heading zone
	   (bottom) — see LaunchpadTile's .body/.mark for those reserved areas. */
	.dictionary-box {
		position: absolute;
		inset: 2.5rem 1.1rem 3.3rem;
	}

	.guide-cover-box {
		position: absolute;
		right: 8%;
		top: 50%;
		translate: 0 -50%;
		width: 8.75rem;
	}

	.alphabet-box {
		position: absolute;
		inset: 0;
		opacity: 0.9;
	}

	/* Scrim + text, bottom-anchored, sits above the media layer. */
	.body {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 2;
		padding: 1.05rem 1.15rem;
		/* Literal scrim for the same reason as the card fill above: the theme
		   panel var is a near-opaque content-panel color on cosmic. */
		background: linear-gradient(to top, oklch(0.13 0.02 270 / 0.88), transparent);
	}
	/* Reserve room below the descriptor for the chip row so it never overlaps
	   the body text (chips live outside the anchor, stacked on top). */
	.card:has(.chips) .body {
		padding-bottom: 2.9rem;
	}

	.body h2 {
		margin: 0;
		font-size: 1.05rem;
		font-weight: 720;
		letter-spacing: -0.01em;
		color: var(--theme-text, #f2f1fb);
	}
	.s-2x2 .body h2,
	.s-2x1 .body h2 {
		font-size: 1.4rem;
	}

	.body p {
		margin: 0.3rem 0 0;
		font-size: 0.875rem;
		line-height: 1.4;
		color: var(--theme-text-dim, rgba(255, 255, 255, 0.68));
		max-width: 34ch;
	}
	.s-2x2 .body p,
	.s-2x1 .body p {
		font-size: 0.95rem;
	}

	/* Cursor-glow overlay: sits above the content, blended so it never
	   obscures text, tinted per-tile via var(--c). */
	.glow {
		position: absolute;
		inset: 0;
		z-index: 4;
		pointer-events: none;
		opacity: var(--glow-opacity, 0);
		mix-blend-mode: overlay;
		background: radial-gradient(
			var(--glow-size, 120px) circle at var(--glow-x, 50%) var(--glow-y, 50%),
			color-mix(in oklch, var(--c) 55%, transparent),
			transparent 70%
		);
		transition: opacity 0.25s ease;
	}

	/* ---- chips: real links, siblings of .tile-link, stacked above it ---- */
	.chips {
		position: absolute;
		left: 1.15rem;
		right: 1.15rem;
		bottom: 1.05rem;
		z-index: 5;
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		pointer-events: none;
	}
	.chips li {
		margin: 0;
	}
	.chip {
		position: relative;
		pointer-events: auto;
		display: inline-flex;
		align-items: center;
		min-height: 32px;
		padding: 0.3rem 0.7rem;
		border-radius: 999px;
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--theme-text, #f2f1fb);
		text-decoration: none;
		border: 1px solid rgba(255, 255, 255, 0.22);
		background: oklch(0.16 0.018 270 / 0.6);
		transition:
			background 0.2s ease,
			border-color 0.2s ease,
			color 0.2s ease;
	}
	.chip:hover,
	.chip:focus-visible {
		color: var(--c);
		border-color: var(--c);
		background: color-mix(in oklch, var(--c) 16%, transparent);
	}
	/* Coarse-pointer hit-area extension: the visible pill stays compact
	   (~32px) on precise pointers, but touch gets a real 44px target via an
	   invisible generated-content overlay owned by the same <a>. */
	@media (pointer: coarse) {
		.chip::after {
			content: "";
			position: absolute;
			inset: -6px -2px;
		}
	}

	/* Tablet rail: the same destination cards become horizontal buttons. The
	   text owns the left side while each tile keeps a cropped piece of its
	   living media on the right, so the rail stays recognizable without asking
	   a tablet user to scroll past the hero. */
	@media (min-width: 760px) and (max-width: 1679px) and (min-height: 650px) {
		.tile,
		.card {
			border-radius: 1rem;
		}
		.tile-link:focus-visible {
			border-radius: 1rem;
		}
		.mark {
			top: 50%;
			left: 0.9rem;
			font-size: 1rem;
			transform: translateY(-50%);
		}
		.body {
			top: 0;
			display: flex;
			flex-direction: column;
			justify-content: center;
			padding: 0.8rem 0.9rem 0.8rem 3rem;
			background: linear-gradient(
				to right,
				oklch(0.13 0.02 270 / 0.96) 0%,
				oklch(0.13 0.02 270 / 0.82) 52%,
				transparent 100%
			);
		}
		.card:has(.chips) .body {
			padding-bottom: 2.85rem;
		}
		.body h2,
		.s-2x2 .body h2,
		.s-2x1 .body h2 {
			max-width: 65%;
			font-size: 1.05rem;
		}
		.body p,
		.s-2x2 .body p,
		.s-2x1 .body p {
			max-width: 65%;
			margin-top: 0.2rem;
			font-size: var(--font-size-min, 0.875rem);
			line-height: 1.3;
		}
		.t-faq .body h2,
		.t-faq .body p {
			max-width: 100%;
		}
		.chips {
			left: 3rem;
			right: 0.75rem;
			bottom: 0.6rem;
			flex-wrap: nowrap;
			gap: 0.3rem;
		}
		.chip {
			padding: 0.25rem 0.55rem;
			font-size: var(--font-size-compact, 0.75rem);
		}
		.mandala-box {
			inset: 0 0 0 auto;
			width: auto;
			height: 100%;
			aspect-ratio: 1;
			opacity: 0.78;
		}
		.mandala-box :global(.mandala-container) {
			max-width: 100%;
			max-height: 100%;
		}
		.choreo-card-box {
			right: 2%;
			width: 5.25rem;
		}
		.pictograph-box {
			opacity: 0.72;
		}
		.dictionary-box {
			inset: 0.75rem 0.75rem 0.75rem 52%;
		}
		.guide-cover-box {
			right: 5%;
			width: 5rem;
		}
	}

	/* Short tablet landscape still keeps all six primary destinations. The
	   rows become icon + title buttons; descriptors and deep-link chips remain
	   available on taller tablets and on each destination page. */
	@media (min-width: 760px) and (max-width: 1679px) and (min-height: 650px) and (max-height: 850px) {
		.mark {
			left: 0.8rem;
		}
		.body,
		.card:has(.chips) .body {
			padding: 0.5rem 0.75rem 0.5rem 2.7rem;
		}
		.body h2,
		.s-2x2 .body h2,
		.s-2x1 .body h2 {
			max-width: 68%;
			font-size: 1rem;
		}
		.body p,
		.chips,
		.dictionary-box {
			display: none;
		}
		.choreo-card-box {
			width: 4.25rem;
		}
		.guide-cover-box {
			width: 4rem;
		}
	}

	/* ---- reduced motion: freeze breathing/tilt/press/magnetic movement,
	   keep only color/opacity hover feedback. The effect packages already
	   guard themselves internally; this is the CSS-level backstop. ---- */
	@media (prefers-reduced-motion: reduce) {
		.tile {
			animation: none;
			/* Opacity fades stay (allowed under reduced motion); translate and
			   filter movement do not. */
			transition:
				box-shadow 0.3s ease,
				opacity 0.35s ease;
		}
		.card {
			--rot-x: 0deg;
			--rot-y: 0deg;
			--press: 1;
			--mag-x: 0px;
			--mag-y: 0px;
			transition: border-color 0.3s ease;
		}
		.glow {
			transition: none;
		}
		.chip {
			transition: none;
		}
	}
</style>
