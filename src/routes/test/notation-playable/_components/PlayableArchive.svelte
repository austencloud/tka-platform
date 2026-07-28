<!--
  The playable archive: nine notation systems on a one-screen, horizontal
  focus-and-context rail. One artifact is live in the center; neighbors stay
  visible as tangible objects; the sourced prose appears only after the
  visitor asks for it (Inspect / Enter). Chronology is spatial, never causal.

  Spec: docs/superpowers/specs/2026-07-27-notation-playable-archive-design.md
  Movement engine: Embla. Feedback: existing tilt / pressSpring / magnetic /
  haptic primitives. Select re-tiles and the detail morph run on the native
  View Transition API (CSS-timed), with reduced-motion and no-support
  fallbacks.
-->
<script lang="ts">
	import { tick } from "svelte";
	import { MediaQuery } from "svelte/reactivity";
	import type { EmblaCarouselType } from "embla-carousel";
	import emblaCarouselSvelte from "embla-carousel-svelte";
	import { Popover } from "bits-ui";
	import { NOTATION_CATALOG } from "$lib/shared/notation/notation-catalog";
	import { tilt } from "$lib/actions/tilt";
	import { cursorGlow } from "$lib/actions/cursor-glow";
	import { pressSpring } from "$lib/actions/press-spring";
	import { magnetic } from "$lib/actions/magnetic";
	import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
	import Drawer from "$lib/shared/foundation/ui/Drawer.svelte";
	import ArtifactVisual from "./ArtifactVisual.svelte";
	import ArtifactDetail from "./ArtifactDetail.svelte";
	import {
		closeDetail,
		initialState,
		openDetail,
		select,
	} from "../_lib/archive-state";

	const entries = NOTATION_CATALOG;
	const count = entries.length;

	/** Per-entry accent, keyed by what the source material itself looks like. */
	const ACCENTS: Record<string, string> = {
		caps: "oklch(0.78 0.13 230)",
		trochoid: "oklch(0.78 0.09 250)",
		"unit-circle": "oklch(0.8 0.13 180)",
		vtg: "oklch(0.74 0.15 40)",
		"nine-square": "oklch(0.68 0.17 25)",
		qft: "oklch(0.68 0.17 295)",
		lorq: "oklch(0.8 0.14 80)",
		poinotation: "oklch(0.78 0.14 150)",
		tka: "oklch(0.74 0.15 305)",
	};

	let archive = $state(initialState(count));
	const activeIndex = $derived(archive.activeIndex);
	const activeEntry = $derived(entries[activeIndex]!);
	const accent = $derived(ACCENTS[activeEntry.id] ?? "oklch(0.7 0.1 270)");

	const reduceMotion = new MediaQuery("(prefers-reduced-motion: reduce)");
	const isMobile = new MediaQuery("(max-width: 760px)");
	/* The site-wide big-screen seam: above it all nine artifacts fit at once,
	   so the rail becomes a no-scroll accordion instead of a carousel. */
	const wideRail = new MediaQuery("(min-width: 1680px)");

	let emblaApi = $state<EmblaCarouselType | null>(null);
	let flourish = $state(false);
	let announcement = $state("");
	let slideButtons: (HTMLButtonElement | null)[] = $state(Array(count).fill(null));
	let railRegion = $state<HTMLElement | null>(null);

	function onEmblaInit(event: CustomEvent<EmblaCarouselType>) {
		emblaApi = event.detail;
		emblaApi.on("select", () => {
			const snap = emblaApi?.selectedScrollSnap();
			if (snap != null && snap !== archive.activeIndex) applySelect(snap);
		});
	}

	function applySelect(index: number) {
		const commit = () => {
			const result = select(archive, index, count);
			archive = result.state;
			const entry = entries[archive.activeIndex]!;
			announcement = `${entry.year}, ${entry.system}, ${archive.activeIndex + 1} of ${count}`;
			if (result.firstVisit) getHapticFeedback().trigger("selection");
			if (result.justCompleted) {
				flourish = true;
				getHapticFeedback().trigger("success");
				setTimeout(() => (flourish = false), 1600);
			}
			if (
				!wideRail.current &&
				emblaApi &&
				emblaApi.selectedScrollSnap() !== archive.activeIndex
			) {
				emblaApi.scrollTo(archive.activeIndex, reduceMotion.current);
			}
		};
		/* In bento mode a selection re-tiles the grid; the NATIVE View Transition
		   morphs every tile to its new cell (each tile keeps its OWN transition
		   name, so no system's visual ever morphs into another's — canon
		   guardrail). Timing lives in CSS on the pseudo-groups. motion's
		   animateView is deliberately NOT used: its WAAPI takeover arrived
		   ~300ms late behind the artifact mounts, after the browser's default
		   animation had already finished — the tile visibly snapped back and
		   replayed the journey (instrumented 2026-07-27). */
		if (
			wideRail.current &&
			!reduceMotion.current &&
			typeof document !== "undefined" &&
			"startViewTransition" in document
		) {
			document.startViewTransition(async () => {
				commit();
				await tick();
			});
		} else {
			commit();
		}
	}

	function onSlideClick(index: number) {
		if (index === archive.activeIndex) {
			openDetailView();
		} else {
			applySelect(index);
		}
	}

	/**
	 * The detail must visibly originate from the active artifact. The stage and
	 * the detail hero swap one view-transition-name inside the update, so the
	 * native shared-element morph carries the object across. Degrades to a
	 * plain state change where the API is unsupported, on mobile (the Drawer
	 * owns that motion), and under reduced motion (per contract).
	 *
	 * `soloMorph` narrows the cast first. Every tile and stage normally carries
	 * a name (they must, so a select re-tile pairs each with itself). But a name
	 * present in BOTH states still gets captured and cross-faded, so opening the
	 * detail was animating all eighteen groups — the whole board shimmered while
	 * one object flew. Stripping the other names BEFORE the transition starts
	 * means old and new agree there is nothing there to animate, so exactly one
	 * group moves. Tiles drop their names outright for this transition — the
	 * grid does not re-tile when the detail opens, so a tile group could only
	 * cross-fade in place. Measured: 55 pseudo-animations down to 3.
	 */
	let soloMorph = $state(false);

	function canMorph() {
		return (
			!isMobile.current &&
			!reduceMotion.current &&
			typeof document !== "undefined" &&
			"startViewTransition" in document
		);
	}

	/** Run `update` as a solo morph: only the active entry keeps a name. */
	async function morphDetail(update: () => Promise<void>, after?: () => void) {
		if (!canMorph()) {
			await update();
			after?.();
			return;
		}
		soloMorph = true;
		await tick(); // names are off the other tiles before the snapshot
		const vt = document.startViewTransition(update);
		after?.();
		try {
			await vt.finished;
		} finally {
			soloMorph = false;
		}
	}

	function openDetailView() {
		void morphDetail(async () => {
			archive = openDetail(archive);
			await tick();
		});
	}

	function closeDetailView() {
		void morphDetail(
			async () => {
				archive = closeDetail(archive);
				await tick();
			},
			() => setTimeout(() => slideButtons[archive.activeIndex]?.focus(), 60),
		);
	}

	function onRailKeydown(event: KeyboardEvent) {
		if (archive.detailOpen) return;
		switch (event.key) {
			case "ArrowLeft":
				event.preventDefault();
				applySelect(archive.activeIndex - 1);
				break;
			case "ArrowRight":
				event.preventDefault();
				applySelect(archive.activeIndex + 1);
				break;
			case "Home":
				event.preventDefault();
				applySelect(0);
				break;
			case "End":
				event.preventDefault();
				applySelect(count - 1);
				break;
			case "Enter":
			case " ":
				if (document.activeElement === slideButtons[archive.activeIndex]) {
					event.preventDefault();
					openDetailView();
				}
				break;
		}
	}

	function onDetailKeydown(event: KeyboardEvent) {
		if (event.key === "Escape") {
			event.preventDefault();
			closeDetailView();
		}
	}

	const primarySource = $derived(activeEntry.sources[0]);
	const desktopDetailOpen = $derived(archive.detailOpen && !isMobile.current);
	let drawerOpen = $state(false);
	$effect(() => {
		drawerOpen = archive.detailOpen && isMobile.current;
	});
</script>

<section
	class="room"
	class:flourish
	style:--artifact-accent={accent}
	aria-label="Writing flow arts down: nine notation systems, 2009 to 2022"
>
	<!-- ROW 1: the masthead -->
	<header class="room-header">
		<div class="masthead">
			<p class="kicker">Nine systems &middot; 2009&ndash;2022</p>
			<h1 class="room-title">Writing flow arts down</h1>
		</div>
		<div class="room-header-side">
			<Popover.Root>
				<Popover.Trigger class="loans-trigger">Two borrowed ideas</Popover.Trigger>
				<Popover.Portal>
					<Popover.Content class="loans-popover" sideOffset={10}>
						<p>
							Two ideas came in from outside. Cutting a continuous flow into
							beats and giving each one a symbol is
							<a
								href="https://jugglinglab.org/html/ssnotation.html"
								target="_blank"
								rel="noopener">siteswap</a
							>, from juggling. Writing a performance as a compact score at all
							is music notation. Neither was built for props, and neither is on
							this list. It starts where flow arts notation starts.
						</p>
					</Popover.Content>
				</Popover.Portal>
			</Popover.Root>
			<span class="discovered" aria-live="off">
				<span class="discovered-count">{archive.visited.size} of {count}</span>
				discovered
			</span>
		</div>
	</header>

	{#snippet slideCard(entry: (typeof entries)[number], i: number)}
		{@const isActive = i === activeIndex}
		<!-- The card div is a pointer convenience; the accessible path is the
		     label button below (roving tabindex) and the Inspect action. Live
		     artifacts own their pointer surface, so the card only opens detail
		     when the click was not on an interactive child. -->
		<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
		<div
			class="artifact"
			style:--slide-accent={ACCENTS[entry.id]}
			use:tilt={{ maxDegrees: isActive ? 3 : 2 }}
			use:cursorGlow
			onclick={(e) => {
				if ((e.target as HTMLElement).closest("button, a")) return;
				onSlideClick(i);
			}}
		>
			<span class="ghost-year" aria-hidden="true">{entry.year}</span>
			<!-- The name is PERSISTENT on every stage so that during a select
			     re-tile each stage pairs with itself and travels with its tile.
			     Active-only naming left the names unpaired across the transition,
			     so the new hero's visual entered at its final position while the
			     tile was still morphing. Only the open detail hands its name off
			     (to the panel), which is what powers the Inspect morph. -->
			<span
				class="artifact-stage"
				style:view-transition-name={(archive.detailOpen && isActive) ||
				(soloMorph && !isActive)
					? undefined
					: `stage-${entry.id}`}
			>
				<ArtifactVisual {entry} active={isActive && !archive.detailOpen} />
			</span>
			<button
				bind:this={slideButtons[i]}
				type="button"
				class="artifact-label"
				tabindex={isActive ? 0 : -1}
				aria-label={isActive
					? `${entry.system}, ${entry.year}. Open detail`
					: `Select ${entry.system}, ${entry.year}`}
				aria-current={isActive ? "true" : undefined}
				use:pressSpring
				onclick={() => onSlideClick(i)}
			>
				<span class="artifact-year">{entry.year}</span>
				<span class="artifact-name">{entry.system}</span>
			</button>

			<!-- THE RECORD. Every entry's sourced prose and every citation link
			     live here unconditionally, in every state, for all nine systems —
			     the overlay is presentation, not the content's only existence.
			     Clipped visually (the room is one screen by design), never
			     display:none, never aria-hidden: crawlers index it and screen
			     readers read the real catalog in chronological order instead of
			     nine bare labels. The open overlay is aria-modal, so the
			     background is out of the a11y tree and nothing is read twice. -->
			<section class="tile-record">
				<h2>
					<span class="record-system">{entry.system}</span>,
					<span class="record-year">{entry.year}</span>
				</h2>
				<p class="record-people">{entry.people}</p>
				<p class="record-records">{entry.records}</p>
				{#if entry.subWorks?.length}
					<ul>
						{#each entry.subWorks as work (work.name)}
							<li><strong>{work.name}</strong> {work.note}</li>
						{/each}
					</ul>
				{/if}
				<ul class="record-sources">
					{#each entry.sources as source (source.href)}
						<li>
							<a
								href={source.href}
								tabindex="-1"
								target={source.href.startsWith("/") ? undefined : "_blank"}
								rel={source.href.startsWith("/") ? undefined : "noopener"}
							>{source.label}</a>
						</li>
					{/each}
				</ul>
				{#if entry.videos?.length}
					<ul class="record-videos">
						{#each entry.videos as video (video.id)}
							<li>{video.title} — {video.creator}, {video.year}. {video.note}</li>
						{/each}
					</ul>
				{/if}
			</section>
		</div>
	{/snippet}

	<!-- ROW 2: the artifact rail. The keydown here is the roving-tabindex
	     pattern: focus lives on the artifact buttons; the container routes
	     arrow keys so navigation works from any of them.

	     Above the 1680 seam every artifact fits on screen at once, so nothing
	     scrolls: the row is a focus-and-context accordion — all nine objects
	     visible and pickable, the selected one expands in place. Below the
	     seam the Embla carousel takes over and scrolling earns its keep. -->
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<div
		class="rail"
		role="group"
		aria-roledescription={wideRail.current ? undefined : "carousel"}
		aria-label="Notation systems in chronological order"
		bind:this={railRegion}
		onkeydown={onRailKeydown}
	>
		{#if wideRail.current}
			<ol class="gallery-row">
				{#each entries as entry, i (entry.id)}
					<li
						class="g-slide"
						class:is-active={i === activeIndex}
						class:visited={archive.visited.has(i)}
						style:view-transition-name={soloMorph
							? undefined
							: `tile-${entry.id}`}
					>
						{@render slideCard(entry, i)}
					</li>
				{/each}
			</ol>
		{:else}
			<div
				class="rail-viewport"
				use:emblaCarouselSvelte={{
					options: { align: "center", skipSnaps: false, containScroll: false },
					plugins: [],
				}}
				onemblaInit={onEmblaInit}
			>
				<ol class="rail-track">
					{#each entries as entry, i (entry.id)}
						<li
							class="slide"
							class:is-active={i === activeIndex}
							class:visited={archive.visited.has(i)}
						>
							{@render slideCard(entry, i)}
						</li>
					{/each}
				</ol>
			</div>
		{/if}
	</div>

	<!-- ROW 3: actions for the active artifact (reserved boxes, no shift) -->
	<div class="stage-meta">
		<p class="stage-people">{activeEntry.people}</p>
		<div class="stage-actions">
			<button
				type="button"
				class="action primary"
				use:magnetic={!reduceMotion.current}
				use:pressSpring
				onclick={openDetailView}
			>
				Inspect
			</button>
			{#if primarySource}
				<a
					class="action"
					href={primarySource.href}
					target={primarySource.href.startsWith("/") ? undefined : "_blank"}
					rel={primarySource.href.startsWith("/") ? undefined : "noopener"}
				>
					Read the source <span class="action-arrow" aria-hidden="true">&nearr;</span>
				</a>
			{/if}
			{#if activeEntry.videos?.length}
				<button type="button" class="action" onclick={openDetailView}>
					Watch the series
				</button>
			{/if}
		</div>
	</div>

	<!-- ROW 4: the timeline -->
	<nav class="timeline" aria-label="Timeline, 2009 to 2022">
		<span class="timeline-year">2009</span>
		<div class="stops" role="group">
			{#each entries as entry, i (entry.id)}
				<button
					type="button"
					class="stop"
					class:on={i === activeIndex}
					class:seen={archive.visited.has(i)}
					class:span={entry.id === "vtg"}
					aria-label={entry.id === "vtg"
						? `${entry.system}, 2010 to 2011, five chapters`
						: `${entry.system}, ${entry.year}`}
					aria-current={i === activeIndex ? "true" : undefined}
					onclick={() => applySelect(i)}
				>
					<span class="stop-dot" aria-hidden="true"></span>
				</button>
			{/each}
		</div>
		<span class="timeline-year">2022</span>
		<div class="steppers">
			<button
				type="button"
				class="stepper"
				aria-label="Previous system"
				disabled={activeIndex === 0}
				onclick={() => applySelect(activeIndex - 1)}
			>
				<i class="fas fa-arrow-left" aria-hidden="true"></i>
			</button>
			<button
				type="button"
				class="stepper"
				aria-label="Next system"
				disabled={activeIndex === count - 1}
				onclick={() => applySelect(activeIndex + 1)}
			>
				<i class="fas fa-arrow-right" aria-hidden="true"></i>
			</button>
		</div>
	</nav>

	<p class="sr-only" aria-live="polite">{announcement}</p>

	<!-- Desktop focused detail -->
	{#if desktopDetailOpen}
		<div
			class="detail-overlay"
			role="dialog"
			aria-modal="true"
			aria-label={`${activeEntry.system}, detail`}
			tabindex="-1"
			onkeydown={onDetailKeydown}
		>
			<button class="overlay-backdrop" aria-label="Close detail" onclick={closeDetailView}
			></button>
			<!-- The PANEL does not carry the stage name. Naming it meant the whole
			     wide panel — chrome, prose and all — morphed out of the tile's
			     small square, stretching text across the flight. The name lives
			     on the detail's own visual stage (ArtifactDetail), so the
			     artifact travels tile → panel while the panel itself just
			     arrives. -->
			<div class="detail-panel">
				<button type="button" class="close-btn" onclick={closeDetailView} use:pressSpring>
					<span class="close-mark" aria-hidden="true">&times;</span>
					Close
				</button>
				<ArtifactDetail entry={activeEntry} index={activeIndex} {count} />
			</div>
		</div>
	{/if}
</section>

<!-- Mobile focused detail: the existing bottom drawer, stage stays mounted behind -->
<Drawer
	bind:isOpen={drawerOpen}
	placement="bottom"
	ariaLabel={`${activeEntry.system}, detail`}
	onclose={() => (archive = closeDetail(archive))}
>
	<div class="drawer-body">
		<ArtifactDetail entry={activeEntry} index={activeIndex} {count} showVisual={false} />
	</div>
</Drawer>

<style>
	.room {
		display: grid;
		grid-template-rows: auto minmax(0, 1fr) auto auto;
		gap: clamp(0.4rem, 1.2vh, 1rem);
		height: 100%;
		max-width: var(--shell-w, min(1720px, 92vw));
		margin-inline: auto;
		padding: clamp(0.6rem, 1.6vh, 1.4rem) clamp(0.8rem, 2vw, 2rem);
		box-sizing: border-box;
		overflow: hidden;
	}

	/* Grid children default to min-width auto, so the embla track's intrinsic
	   width (nine slides wide) would inflate the whole column and push the
	   room off-canvas. Every row clamps to the grid. */
	.room > * {
		min-width: 0;
		max-width: 100%;
	}

	/* VIEW-TRANSITION TIMING — declared in CSS so it drives the morph from
	   frame one. Scoped by view-transition-class to this archive's groups
	   only; the pseudo-elements live on :root, hence :global. */
	.g-slide,
	.artifact-stage,
	.detail-panel {
		view-transition-class: notation-archive;
	}

	:global(::view-transition-group(.notation-archive)) {
		animation-duration: 0.45s;
		animation-timing-function: cubic-bezier(0.22, 1, 0.36, 1);
	}

	:global(::view-transition-old(.notation-archive)),
	:global(::view-transition-new(.notation-archive)) {
		animation-duration: 0.45s;
	}

	/* The modal's chrome — panel, backdrop, prose, close — rides the ROOT
	   snapshot, which defaults to 250ms. Against a 450ms artifact morph the
	   modal was fully present a fifth of a second before the object landed in
	   it, which is what read as the animation not belonging to the modal.
	   Same duration, same curve: they arrive together. */
	:global(::view-transition-group(root)),
	:global(::view-transition-old(root)),
	:global(::view-transition-new(root)) {
		animation-duration: 0.45s;
		animation-timing-function: cubic-bezier(0.22, 1, 0.36, 1);
	}

	/* HEADER */
	.room-header {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 1rem;
	}

	.masthead {
		display: grid;
		gap: 0.15rem;
	}

	.kicker {
		margin: 0;
		font-size: clamp(0.62rem, 0.55rem + 0.2vw, 0.8rem);
		font-weight: 650;
		letter-spacing: 0.22em;
		text-transform: uppercase;
		color: oklch(0.58 0.03 270);
	}

	.room-title {
		margin: 0;
		font-family: "Fraunces", Georgia, serif;
		font-style: italic;
		font-weight: 700;
		font-size: clamp(1.5rem, 1.1rem + 1.6vw, 3.2rem);
		line-height: 1.05;
		letter-spacing: -0.015em;
		color: oklch(0.95 0.015 270);
	}

	.room-header-side {
		display: flex;
		align-items: center;
		gap: clamp(0.7rem, 1.5vw, 1.4rem);
	}

	:global(.loans-trigger) {
		min-height: 44px;
		padding: 0 1rem;
		border-radius: 11px;
		border: 1px solid oklch(0.5 0.05 270 / 0.4);
		background: oklch(0.3 0.04 270 / 0.25);
		color: oklch(0.85 0.02 270);
		font: inherit;
		font-size: 0.9rem;
		font-weight: 600;
		cursor: pointer;
		transition: background 160ms ease;
	}

	:global(.loans-trigger:hover) {
		background: oklch(0.34 0.05 270 / 0.4);
	}

	:global(.loans-popover) {
		z-index: 60;
		max-width: 26rem;
		padding: 1rem 1.2rem;
		border-radius: 14px;
		border: 1px solid oklch(0.5 0.05 270 / 0.4);
		background: oklch(0.17 0.02 270 / 0.97);
		color: oklch(0.85 0.02 270);
		font-size: 0.92rem;
		line-height: 1.6;
		box-shadow: 0 18px 44px oklch(0 0 0 / 0.5);
	}

	:global(.loans-popover p) {
		margin: 0;
	}

	:global(.loans-popover a) {
		color: oklch(0.8 0.1 230);
	}

	.discovered {
		font-size: 0.9rem;
		color: oklch(0.68 0.03 270);
		white-space: nowrap;
	}

	.discovered-count {
		font-variant-numeric: tabular-nums;
		font-weight: 700;
		color: oklch(0.88 0.05 270);
	}

	/* RAIL */
	.rail {
		min-height: 0;
	}

	/* WIDE MODE: the bento. A 6×2 grid fills the canvas — the active entry is
	   a 2×2 hero tile, the other eight are full tiles whose visuals fill
	   their cells. Selecting re-tiles the grid through a native View
	   Transition; every tile morphs to its new cell under its own name. */
	.gallery-row {
		display: grid;
		grid-template-columns: repeat(6, minmax(0, 1fr));
		grid-template-rows: repeat(2, minmax(0, 1fr));
		grid-auto-flow: dense;
		gap: clamp(0.7rem, 0.9vw, 1.3rem);
		height: 100%;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.g-slide {
		min-width: 0;
		min-height: 0;
		display: grid;
	}

	/* The hero anchors top-left (visual order only — DOM stays chronological
	   for reading and tab order). With the 2×2 placed first, the eight
	   singles always fill the remaining 8 cells exactly: no trailing holes. */
	.g-slide.is-active {
		grid-column: span 2;
		grid-row: span 2;
		order: -1;
	}

	/* Bento tiles: flat ink specimens. A faint accent breath at the plaque
	   edge; the rule brightens on hover; the hero earns one deep shadow. */
	.g-slide .artifact {
		opacity: 1;
		scale: 1;
		overflow: hidden;
		background:
			radial-gradient(
				130% 70% at 50% 112%,
				color-mix(in oklch, var(--slide-accent, oklch(0.5 0.06 270)) 8%, transparent),
				transparent 55%
			),
			oklch(0.145 0.012 270);
		transition: border-color 240ms ease, box-shadow 240ms ease, translate 240ms ease;
	}

	.g-slide .artifact:hover {
		border-color: color-mix(in oklch, var(--slide-accent, oklch(0.6 0.05 270)) 55%, transparent);
		translate: 0 -3px;
	}

	.g-slide.is-active .artifact {
		border-color: color-mix(in oklch, var(--slide-accent, oklch(0.6 0.05 270)) 28%, oklch(1 0 0 / 0.08));
		box-shadow: 0 30px 70px oklch(0 0 0 / 0.5);
	}

	/* Small tiles: label pinned to the bottom edge like a plaque. */
	.g-slide:not(.is-active) .artifact-name {
		font-size: clamp(0.78rem, 0.6rem + 0.28vw, 1.05rem);
	}

	@media (prefers-reduced-motion: reduce) {
		.g-slide .artifact {
			transition: none;
		}
		.g-slide .artifact:hover {
			translate: none;
		}
	}

	.rail-viewport {
		overflow: hidden;
		height: 100%;
	}

	.rail-track {
		display: flex;
		align-items: stretch;
		height: 100%;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.slide {
		flex: 0 0 var(--slide-w, min(64rem, 48vw));
		min-width: 0;
		padding-inline: clamp(0.4rem, 1vw, 1.1rem);
		display: grid;
	}

	/* Flat ink, hairline rule, no glass. The accent stays scarce: the ghost
	   numeral, the plaque year, and the hover rule carry it. */
	.artifact {
		position: relative;
		display: grid;
		grid-template-rows: minmax(0, 1fr) auto;
		gap: 0.55rem;
		width: 100%;
		height: 100%;
		padding: clamp(0.6rem, 1.4vh, 1.1rem);
		border-radius: 18px;
		border: 1px solid oklch(1 0 0 / 0.07);
		background: oklch(0.145 0.012 270);
		cursor: pointer;
		font: inherit;
		color: inherit;
		text-align: center;
		box-sizing: border-box;
		container-type: inline-size;
		opacity: 0.42;
		scale: 0.88;
		transition:
			opacity 380ms ease,
			scale 380ms cubic-bezier(0.3, 1.1, 0.4, 1),
			border-color 380ms ease,
			box-shadow 380ms ease;
	}

	/* The year as a graphic: oversized Fraunces numeral bleeding from the
	   tile's top corner. Data as ornament — nothing invented. */
	.ghost-year {
		position: absolute;
		top: -0.12em;
		left: 0.06em;
		z-index: 0;
		font-family: "Fraunces", Georgia, serif;
		font-style: italic;
		font-weight: 700;
		font-size: clamp(2.6rem, 26cqi, 7rem);
		line-height: 1;
		letter-spacing: -0.04em;
		color: color-mix(in oklch, var(--slide-accent, oklch(0.6 0.05 270)) 55%, transparent);
		opacity: 0.16;
		pointer-events: none;
		user-select: none;
	}

	.g-slide.is-active .ghost-year {
		font-size: clamp(4rem, 18cqi, 10rem);
		opacity: 0.13;
	}

	.slide.is-active .artifact {
		opacity: 1;
		scale: 1;
		border-color: color-mix(in oklch, var(--slide-accent, oklch(0.6 0.05 270)) 65%, transparent);
		box-shadow:
			0 22px 60px oklch(0 0 0 / 0.45),
			0 0 44px color-mix(in oklch, var(--slide-accent, oklch(0.6 0.05 270)) 22%, transparent);
	}

	.artifact:focus-visible {
		outline: 3px solid var(--slide-accent, oklch(0.7 0.1 270));
		outline-offset: 3px;
	}

	.artifact-stage {
		position: relative;
		z-index: 1;
		display: block;
		min-height: 0;
		container-type: size;
		/* Safety net: at short viewports a content-sized visual could grow past
		   its row and paint over the tile's own label. Visuals size themselves
		   with cqh (this element is a size container, so cqh is valid here);
		   this guarantees nothing ever escapes the stage even if one doesn't. */
		overflow: hidden;
	}

	/* The plaque: left-set like a specimen label, year carrying the accent. */
	.artifact-label {
		position: relative;
		z-index: 1;
		display: flex;
		justify-content: flex-start;
		gap: 0.6rem;
		min-height: 44px;
		align-items: center;
		padding: 0 0.45rem;
		border: 0;
		background: transparent;
		font: inherit;
		color: inherit;
		cursor: pointer;
		border-radius: 10px;
		text-align: left;
	}

	.artifact-label:focus-visible {
		outline: 2px solid var(--slide-accent, oklch(0.7 0.1 270));
		outline-offset: 2px;
	}

	.artifact-year {
		font-variant-numeric: tabular-nums;
		font-weight: 700;
		font-size: clamp(0.85rem, 0.8rem + 0.3vw, 1.1rem);
		color: var(--slide-accent, oklch(0.75 0.05 270));
	}

	.artifact-name {
		font-size: clamp(0.85rem, 0.8rem + 0.3vw, 1.1rem);
		font-weight: 600;
		color: oklch(0.88 0.02 270);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.slide.visited .artifact-year {
		text-shadow: 0 0 12px color-mix(in oklch, var(--slide-accent) 60%, transparent);
	}

	/* STAGE META */
	.stage-meta {
		display: grid;
		gap: 0.5rem;
		justify-items: center;
	}

	/* Reserved single line; the longest people string ellipsizes, nothing shifts. */
	.stage-people {
		margin: 0;
		max-width: min(60ch, 92%);
		height: 1.5em;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: clamp(0.82rem, 0.78rem + 0.2vw, 1rem);
		color: oklch(0.7 0.03 270);
	}

	.stage-actions {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0.7rem;
	}

	.action {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		min-height: 44px;
		padding: 0 1.35rem;
		border-radius: 999px;
		border: 1px solid oklch(1 0 0 / 0.14);
		background: transparent;
		color: oklch(0.88 0.02 270);
		font: inherit;
		font-size: 0.85rem;
		font-weight: 650;
		letter-spacing: 0.09em;
		text-transform: uppercase;
		text-decoration: none;
		cursor: pointer;
		translate: var(--mag-x, 0px) var(--mag-y, 0px);
		transition: background 160ms ease, border-color 160ms ease, color 160ms ease;
	}

	.action:hover {
		border-color: oklch(1 0 0 / 0.32);
	}

	.action-arrow {
		font-size: 1.05em;
		translate: 0 -1px;
	}

	/* The one filled control on the page: the active entry's accent, solid. */
	.action.primary {
		border-color: transparent;
		background: var(--artifact-accent);
		color: oklch(0.13 0.01 270);
	}

	.action.primary:hover {
		background: color-mix(in oklch, var(--artifact-accent) 86%, white);
	}

	/* TIMELINE */
	.timeline {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: clamp(0.6rem, 1.5vw, 1.2rem);
	}

	.timeline-year {
		font-family: "Fraunces", Georgia, serif;
		font-style: italic;
		font-variant-numeric: tabular-nums;
		font-size: 0.95rem;
		font-weight: 700;
		color: oklch(0.62 0.03 270);
	}

	.stops {
		display: flex;
		align-items: center;
		overflow-x: auto;
		scrollbar-width: none;
	}

	.stop {
		display: grid;
		place-items: center;
		width: 44px;
		height: 44px;
		flex: 0 0 44px;
		padding: 0;
		border: 0;
		background: transparent;
		cursor: pointer;
	}

	/* Timeline stops as ticks: hairline marks that grow when chosen. */
	.stop-dot {
		width: 2px;
		height: 0.85rem;
		border-radius: 2px;
		background: oklch(0.42 0.02 270);
		transition: background 260ms ease, height 260ms ease, width 260ms ease;
	}

	/* VTG is the one entry on this rail that is not a moment. It was written
	   across 2010 and released through 2011 in five chapters and four dated
	   drops, so it gets a span rather than a tick — and the tile's own chapter
	   rail is this span magnified. Every other entry stays a tick, which is
	   what makes the difference legible.

	   Kept to a hairline BAR, not a wide block: the rail's whole vocabulary is
	   2px marks, and a heavy span would read as the selected state. */
	.stop.span .stop-dot {
		width: 14px;
		border-radius: 2px;
	}

	.stop.span.on .stop-dot {
		width: 16px;
	}

	.stop.seen .stop-dot {
		background: color-mix(in oklch, var(--artifact-accent) 70%, oklch(0.6 0.03 270));
	}

	.stop.on .stop-dot {
		width: 3px;
		height: 1.5rem;
		background: var(--artifact-accent);
		box-shadow: 0 0 12px color-mix(in oklch, var(--artifact-accent) 60%, transparent);
	}

	.stop:focus-visible {
		outline: 2px solid var(--artifact-accent);
		outline-offset: -4px;
		border-radius: 10px;
	}

	.room.flourish .stop-dot {
		animation: stop-flourish 1.4s ease;
	}

	@keyframes stop-flourish {
		0%,
		100% {
			filter: brightness(1);
		}
		40% {
			filter: brightness(2.1);
		}
	}

	.steppers {
		display: flex;
		gap: 0.45rem;
		margin-left: clamp(0.4rem, 1.4vw, 1.4rem);
	}

	.stepper {
		display: grid;
		place-items: center;
		width: 44px;
		height: 44px;
		border-radius: 12px;
		border: 1px solid oklch(0.5 0.05 270 / 0.4);
		background: oklch(0.3 0.04 270 / 0.25);
		color: oklch(0.88 0.02 270);
		cursor: pointer;
		transition: background 160ms ease;
	}

	.stepper:hover:not(:disabled) {
		background: oklch(0.34 0.05 270 / 0.4);
	}

	.stepper:disabled {
		opacity: 0.35;
		cursor: default;
	}

	/* DETAIL OVERLAY (desktop) */
	.detail-overlay {
		position: fixed;
		inset: 0;
		z-index: 50;
		display: grid;
		place-items: center;
		padding: clamp(1rem, 4vh, 3.5rem) clamp(1rem, 5vw, 5rem);
	}

	.overlay-backdrop {
		position: absolute;
		inset: 0;
		border: 0;
		background: oklch(0.05 0.005 270 / 0.82);
		cursor: pointer;
	}

	/* Same surface language as the tiles: flat ink, hairline rule, accent
	   only as a whisper in the border — the panel is a bigger tile, not a
	   different material. */
	.detail-panel {
		position: relative;
		width: min(100%, 92rem);
		height: auto;
		max-height: 100%;
		padding: clamp(1.1rem, 2.4vh, 2.2rem);
		border-radius: 18px;
		border: 1px solid color-mix(in oklch, var(--artifact-accent) 28%, oklch(1 0 0 / 0.08));
		background: oklch(0.145 0.012 270);
		box-shadow: 0 30px 90px oklch(0 0 0 / 0.6);
		display: grid;
		grid-template-rows: auto minmax(0, 1fr);
		gap: 0.8rem;
	}

	.close-btn {
		justify-self: start;
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		min-height: 44px;
		padding: 0 1.35rem;
		border-radius: 999px;
		border: 1px solid oklch(1 0 0 / 0.14);
		background: transparent;
		color: oklch(0.88 0.02 270);
		font: inherit;
		font-size: 0.85rem;
		font-weight: 650;
		letter-spacing: 0.09em;
		text-transform: uppercase;
		cursor: pointer;
		transition: border-color 160ms ease;
	}

	.close-btn:hover {
		border-color: oklch(1 0 0 / 0.32);
	}

	.close-mark {
		font-size: 1.2em;
		line-height: 1;
		translate: 0 -1px;
	}

	.drawer-body {
		padding: 1.1rem 1.2rem 2rem;
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

	/* Clipped, not removed: real content in the DOM for crawlers and screen
	   readers. The links keep tabindex="-1" in markup so the visual room's
	   focus order stays the rail's roving pattern. */
	.tile-record {
		position: absolute;
		width: 1px;
		height: 1px;
		margin: -1px;
		padding: 0;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
		border: 0;
	}

	/* RESPONSIVE COMPOSITION */

	/* 4K at 100%: five objects in frame, and scale steps up — nothing else
	   is scaling for us at 3840 (4k-native-layout.md). */
	@media (min-width: 2600px) {
		/* 28vw: the active object plus two full neighbors plus real outer hints.
		   Wider cards also mean square visuals fill the vertical instead of
		   floating in a portrait void. */
		.slide {
			--slide-w: 28vw;
		}
		.room-title {
			font-size: 3.8rem;
		}
		.kicker {
			font-size: 1rem;
		}
		.artifact-year,
		.artifact-name {
			font-size: 1.5rem;
		}
		.stage-people {
			font-size: 1.3rem;
			/* Room to spare at 4K: show the full credit line, no ellipsis.
			   Two reserved lines so long credits (VTG) never truncate or shift. */
			white-space: normal;
			height: auto;
			min-height: 1.5em;
			max-height: 3.1em;
			text-align: center;
		}
		.action {
			min-height: 56px;
			padding: 0 1.7rem;
			font-size: 1.2rem;
		}
		:global(.loans-trigger) {
			min-height: 56px;
			font-size: 1.15rem;
		}
		.discovered {
			font-size: 1.15rem;
		}
		.timeline-year {
			font-size: 1.1rem;
		}
		.stop-dot {
			width: 1.1rem;
			height: 1.1rem;
		}
		/* This tier turns the ticks into squares, so the VTG span has to be
		   restated against THAT shape. Left at its base 14px it came out
		   narrower than a normal stop here — the span reading as smaller than
		   the moments it contains. */
		.stop.span .stop-dot {
			width: 2.6rem;
		}
		.stop.span.on .stop-dot {
			width: 2.9rem;
		}
		.stop.span {
			width: 72px;
			flex-basis: 72px;
		}
		.stop {
			width: 56px;
			height: 56px;
			flex-basis: 56px;
		}
		.stepper {
			width: 56px;
			height: 56px;
		}
	}

	/* 1440 and down: center dominates, peeks remain */
	@media (max-width: 1500px) {
		.slide {
			--slide-w: min(44rem, 62vw);
		}
	}

	/* Tablet portrait */
	@media (max-width: 900px) {
		.slide {
			--slide-w: 72vw;
		}
	}

	/* Phone: one object + neighbor peek */
	@media (max-width: 560px) {
		.slide {
			--slide-w: 84vw;
		}
		.room-title {
			font-size: 1.35rem;
			line-height: 1.05;
		}
		/* Stacked: side by side, the title wrapped to three lines against a
		   three-line pill. The masthead gets the full width and the meta row
		   sits under it. */
		.room-header {
			flex-direction: column;
			align-items: flex-start;
			gap: 0.4rem;
		}
		.room-header-side {
			width: 100%;
			justify-content: space-between;
		}
		:global(.loans-trigger) {
			padding: 0 0.7rem;
			font-size: 0.8rem;
			white-space: nowrap;
		}
		.stage-people {
			display: none;
		}
		.stage-actions .action {
			padding: 0 0.9rem;
			font-size: 0.85rem;
		}
		.steppers {
			display: none;
		}
	}

	/* Short landscape (Fold 960×412): stage left, meta right, rail below.
	   Designed directly, not shrunk-portrait. */
	@media (max-height: 520px) and (min-width: 700px) {
		.room {
			grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr);
			grid-template-rows: auto minmax(0, 1fr) auto;
			grid-template-areas:
				"rail head"
				"rail meta"
				"timeline timeline";
			column-gap: 1rem;
		}
		/* The masthead moves into the right column rather than disappearing:
		   hiding it took the page's only h1 out of the render tree and left
		   the reader with no idea what they were looking at. It also fills
		   the dead space that sat above the credit line. */
		.room-header {
			grid-area: head;
			flex-direction: column;
			align-items: flex-start;
			gap: 0.4rem;
		}
		.room-title {
			font-size: 1.45rem;
		}
		.room-header-side {
			gap: 0.6rem;
		}
		.rail {
			grid-area: rail;
		}
		.stage-meta {
			grid-area: meta;
			align-content: center;
			justify-items: start;
		}
		.stage-people {
			white-space: normal;
			height: auto;
			max-height: 3.2em;
			text-align: left;
		}
		.stage-actions {
			justify-content: flex-start;
		}
		.timeline {
			grid-area: timeline;
		}
		.slide {
			--slide-w: 52vw;
		}
		/* Compact, not hidden — the object still has to say what it is. */
		.artifact-label {
			padding: 0.3rem 0.55rem;
			font-size: 0.8rem;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.artifact,
		.stop-dot,
		.action,
		.stepper {
			transition: none;
		}
		.room.flourish .stop-dot {
			animation: none;
		}
	}
</style>
