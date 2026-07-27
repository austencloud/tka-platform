<!--
  The playable archive: nine notation systems on a one-screen, horizontal
  focus-and-context rail. One artifact is live in the center; neighbors stay
  visible as tangible objects; the sourced prose appears only after the
  visitor asks for it (Inspect / Enter). Chronology is spatial, never causal.

  Spec: docs/superpowers/specs/2026-07-27-notation-playable-archive-design.md
  Movement engine: Embla. Feedback: existing tilt / pressSpring / magnetic /
  haptic primitives. Detail morph: motion's animateView over the native View
  Transition API, with reduced-motion and no-support fallbacks.
-->
<script lang="ts">
	import { tick } from "svelte";
	import { MediaQuery } from "svelte/reactivity";
	import type { EmblaCarouselType } from "embla-carousel";
	import emblaCarouselSvelte from "embla-carousel-svelte";
	import { animateView } from "motion";
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
		/* In bento mode a selection re-tiles the grid; animateView morphs every
		   tile to its new cell (each tile keeps its OWN transition name, so no
		   system's visual ever morphs into another's — canon guardrail). */
		if (
			wideRail.current &&
			!reduceMotion.current &&
			typeof document !== "undefined" &&
			"startViewTransition" in document
		) {
			animateView(async () => {
				commit();
				await tick();
			}, { duration: 0.5 });
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
	 * native shared-element morph carries the object across; animateView adds
	 * spring + interruption handling and degrades to a plain state change where
	 * the API is unsupported, on mobile (the Drawer owns that motion), and under
	 * reduced motion (opacity only, per contract).
	 */
	function openDetailView() {
		const update = async () => {
			archive = openDetail(archive);
			await tick();
		};
		if (isMobile.current || reduceMotion.current || typeof document === "undefined" || !("startViewTransition" in document)) {
			void update();
		} else {
			animateView(update, { duration: 0.42 });
		}
	}

	function closeDetailView() {
		const update = async () => {
			archive = closeDetail(archive);
			await tick();
		};
		const finish = () => slideButtons[archive.activeIndex]?.focus();
		if (isMobile.current || reduceMotion.current || typeof document === "undefined" || !("startViewTransition" in document)) {
			void update().then(finish);
		} else {
			animateView(update, { duration: 0.38 });
			setTimeout(finish, 60);
		}
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
	<!-- ROW 1: title, borrowed-ideas popover, discovery count -->
	<header class="room-header">
		<h1 class="room-title">Writing flow arts down</h1>
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
			<span
				class="artifact-stage"
				style:view-transition-name={isActive && !archive.detailOpen
					? `stage-${entry.id}`
					: undefined}
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
						style:view-transition-name={`tile-${entry.id}`}
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
				<i class="fas fa-magnifying-glass" aria-hidden="true"></i>
				Inspect
			</button>
			{#if primarySource}
				<a
					class="action"
					href={primarySource.href}
					target={primarySource.href.startsWith("/") ? undefined : "_blank"}
					rel={primarySource.href.startsWith("/") ? undefined : "noopener"}
				>
					Read the source
					<i class="fas fa-arrow-up-right-from-square" aria-hidden="true"></i>
				</a>
			{/if}
			{#if activeEntry.videos?.length}
				<button type="button" class="action" onclick={openDetailView}>
					<i class="fas fa-play" aria-hidden="true"></i>
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
					aria-label={`${entry.system}, ${entry.year}`}
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
			<div class="detail-panel" style:view-transition-name={`stage-${activeEntry.id}`}>
				<button type="button" class="close-btn" onclick={closeDetailView} use:pressSpring>
					<i class="fas fa-xmark" aria-hidden="true"></i>
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

	/* HEADER */
	.room-header {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 1rem;
	}

	.room-title {
		margin: 0;
		font-size: clamp(1.15rem, 1rem + 1vw, 2.1rem);
		letter-spacing: -0.01em;
		color: oklch(0.94 0.02 270);
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
	   their cells. Selecting re-tiles the grid through animateView; every
	   tile morphs to its new cell under its own transition name. */
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

	/* Bento tiles: every one a finished object — glass, an accent wash
	   rising from the label edge, and a lit border. The cursor glow rides
	   --glow-x/--glow-y from the shared action. */
	.g-slide .artifact {
		opacity: 1;
		scale: 1;
		position: relative;
		overflow: hidden;
		background:
			radial-gradient(
				140% 90% at 50% 108%,
				color-mix(in oklch, var(--slide-accent, oklch(0.5 0.06 270)) 16%, transparent),
				transparent 55%
			),
			oklch(0.16 0.02 270 / 0.55);
		border-color: color-mix(in oklch, var(--slide-accent, oklch(0.6 0.05 270)) 26%, transparent);
		transition: border-color 240ms ease, box-shadow 240ms ease, translate 240ms ease;
	}

	.g-slide .artifact:hover {
		border-color: color-mix(in oklch, var(--slide-accent, oklch(0.6 0.05 270)) 60%, transparent);
		box-shadow:
			0 14px 40px oklch(0 0 0 / 0.4),
			0 0 30px color-mix(in oklch, var(--slide-accent, oklch(0.6 0.05 270)) 20%, transparent);
		translate: 0 -3px;
	}

	.g-slide.is-active .artifact {
		border-color: color-mix(in oklch, var(--slide-accent, oklch(0.6 0.05 270)) 70%, transparent);
		box-shadow:
			0 22px 60px oklch(0 0 0 / 0.45),
			0 0 44px color-mix(in oklch, var(--slide-accent, oklch(0.6 0.05 270)) 24%, transparent);
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

	.artifact {
		display: grid;
		grid-template-rows: minmax(0, 1fr) auto;
		gap: 0.55rem;
		width: 100%;
		height: 100%;
		padding: clamp(0.6rem, 1.4vh, 1.1rem);
		border-radius: 22px;
		border: 1px solid color-mix(in oklch, var(--slide-accent, oklch(0.6 0.05 270)) 30%, transparent);
		background: oklch(0.15 0.018 270 / 0.5);
		backdrop-filter: blur(10px);
		cursor: pointer;
		font: inherit;
		color: inherit;
		text-align: center;
		box-sizing: border-box;
		opacity: 0.42;
		scale: 0.88;
		transition:
			opacity 380ms ease,
			scale 380ms cubic-bezier(0.3, 1.1, 0.4, 1),
			border-color 380ms ease,
			box-shadow 380ms ease;
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
		display: block;
		min-height: 0;
		container-type: size;
	}

	.artifact-label {
		display: flex;
		align-items: baseline;
		justify-content: center;
		gap: 0.6rem;
		min-height: 44px;
		align-items: center;
		padding: 0;
		border: 0;
		background: transparent;
		font: inherit;
		color: inherit;
		cursor: pointer;
		border-radius: 10px;
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
		gap: 0.55rem;
		min-height: 44px;
		padding: 0 1.25rem;
		border-radius: 12px;
		border: 1px solid oklch(0.5 0.05 270 / 0.4);
		background: oklch(0.3 0.04 270 / 0.25);
		color: oklch(0.9 0.02 270);
		font: inherit;
		font-size: 0.95rem;
		font-weight: 650;
		text-decoration: none;
		cursor: pointer;
		translate: var(--mag-x, 0px) var(--mag-y, 0px);
		transition: background 160ms ease, border-color 160ms ease;
	}

	.action:hover {
		background: oklch(0.34 0.05 270 / 0.4);
	}

	.action.primary {
		border-color: color-mix(in oklch, var(--artifact-accent) 70%, transparent);
		background: color-mix(in oklch, var(--artifact-accent) 20%, transparent);
	}

	.action.primary:hover {
		background: color-mix(in oklch, var(--artifact-accent) 32%, transparent);
	}

	/* TIMELINE */
	.timeline {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: clamp(0.6rem, 1.5vw, 1.2rem);
	}

	.timeline-year {
		font-variant-numeric: tabular-nums;
		font-size: 0.85rem;
		font-weight: 700;
		color: oklch(0.6 0.03 270);
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

	.stop-dot {
		width: 0.65rem;
		height: 0.65rem;
		border-radius: 50%;
		background: oklch(0.45 0.03 270);
		transition: background 260ms ease, scale 260ms ease, box-shadow 260ms ease;
	}

	.stop.seen .stop-dot {
		background: color-mix(in oklch, var(--artifact-accent) 65%, oklch(0.6 0.03 270));
		box-shadow: 0 0 10px color-mix(in oklch, var(--artifact-accent) 45%, transparent);
	}

	.stop.on .stop-dot {
		scale: 1.7;
		background: var(--artifact-accent);
		box-shadow: 0 0 14px var(--artifact-accent);
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
		background: oklch(0.08 0.01 270 / 0.72);
		backdrop-filter: blur(6px);
		cursor: pointer;
	}

	.detail-panel {
		position: relative;
		width: min(100%, 92rem);
		height: auto;
		max-height: 100%;
		padding: clamp(1.1rem, 2.4vh, 2.2rem);
		border-radius: 24px;
		border: 1px solid color-mix(in oklch, var(--artifact-accent) 45%, transparent);
		background: oklch(0.14 0.018 270 / 0.97);
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
		padding: 0 1.1rem;
		border-radius: 11px;
		border: 1px solid oklch(0.5 0.05 270 / 0.4);
		background: oklch(0.3 0.04 270 / 0.3);
		color: oklch(0.9 0.02 270);
		font: inherit;
		font-weight: 650;
		cursor: pointer;
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
			font-size: 2.6rem;
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
			font-size: 1.05rem;
		}
		.room-header {
			align-items: center;
		}
		:global(.loans-trigger) {
			padding: 0 0.7rem;
			font-size: 0.8rem;
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
			grid-template-rows: minmax(0, 1fr) auto;
			grid-template-areas:
				"rail meta"
				"timeline timeline";
			column-gap: 1rem;
		}
		.room-header {
			display: none;
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
		.artifact-label {
			display: none;
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
