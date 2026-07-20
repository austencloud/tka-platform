<script lang="ts">
	/**
	 * LaunchpadGrid
	 *
	 * Homepage semantic routing hub: a real SSR bento grid of destination
	 * links (LaunchpadTile) plus a compact secondary link strip. A single
	 * IntersectionObserver marks tiles visible as they scroll in — that drives
	 * both the subtle reveal transition and each tile's `active` prop, which
	 * lazy-mounts its living media (mandala/choreo-card/pictograph).
	 *
	 * Every tile is fully readable and navigable with JS disabled: the reveal
	 * transition only ever applies once `jsReady` (client-only, set in
	 * onMount) is true, so a no-JS render never ships hidden content.
	 */
	import { onMount } from "svelte";
	import LaunchpadTile from "./LaunchpadTile.svelte";
	import { LAUNCHPAD_TILES, STRIP_LINKS } from "./launchpad-tiles";

	let bentoEl: HTMLUListElement | undefined = $state();
	let visible = $state<Set<string>>(new Set());
	let jsReady = $state(false);

	onMount(() => {
		jsReady = true;

		const nodes = bentoEl?.querySelectorAll<HTMLLIElement>("li.tile[data-tile-id]") ?? [];
		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (!entry.isIntersecting) continue;
					const id = (entry.target as HTMLElement).dataset.tileId;
					if (!id) continue;
					// One-shot reveal: once a tile has mounted its media, stop
					// watching it — there's nothing left to react to.
					observer.unobserve(entry.target);
					const next = new Set(visible);
					next.add(id);
					visible = next;
				}
			},
			{ rootMargin: "200px" },
		);
		nodes.forEach((node) => observer.observe(node));

		return () => observer.disconnect();
	});
</script>

<nav class="launchpad" aria-label="TKA destinations">
	<ul class="bento" class:js-ready={jsReady} bind:this={bentoEl}>
		{#each LAUNCHPAD_TILES as tile, i (tile.id)}
			<LaunchpadTile {tile} active={visible.has(tile.id)} index={i} />
		{/each}
	</ul>

	<ul class="strip">
		{#each STRIP_LINKS as link (link.href)}
			<li>
				<a href={link.href}>
					<h3>{link.label}</h3>
				</a>
			</li>
		{/each}
	</ul>
</nav>

<style>
	.launchpad {
		max-width: 1180px;
		margin: 0 auto;
		padding: 0 1.4rem 3rem;
	}

	/* ---- bento grid ---- */
	.bento {
		list-style: none;
		margin: 0 0 1.4rem;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		grid-auto-rows: clamp(150px, 17vw, 210px);
		grid-auto-flow: dense;
		gap: 1rem;
	}

	@media (max-width: 1020px) {
		.bento {
			grid-template-columns: repeat(2, 1fr);
		}
	}

	/* Split tier (one-viewport composition, see +page.svelte): the right pane
	   owns width and spacing, and rows become height-keyed so four rows plus
	   the strip always fit the viewport beside the hero. Budget at the 19vh
	   term: 76px header pad + 4 rows + 3 gaps + bento margin + 44px strip
	   lands inside 100svh down to ~800px-tall windows (min-height on the
	   composition lets anything shorter scroll instead of clip). */
	@media (min-width: 1680px) {
		.launchpad {
			max-width: none;
			padding: 0;
		}
		.bento {
			grid-auto-rows: clamp(150px, 19vh, 300px);
		}
	}

	/* 4K tier: scale the furniture one step (type ramps live in LaunchpadTile). */
	@media (min-width: 2200px) {
		.bento {
			gap: 1.25rem;
			margin-bottom: 1.6rem;
		}
		.strip a {
			min-height: 52px;
			padding: 0 1.3rem;
		}
		.strip h3 {
			font-size: 1.1rem;
		}
	}

	@media (max-width: 640px) {
		.bento {
			grid-template-columns: 1fr;
		}
		.strip {
			grid-template-columns: repeat(2, 1fr);
		}
		/* Full-width single column: every span still reads as one row-wide
		   card; the 2x2 tile keeps its extra height (two rows tall) rather
		   than collapsing to the same height as a 1x1. */
		.bento :global(.s-2x2) {
			grid-column: span 1;
			grid-row: span 2;
		}
		.bento :global(.s-2x1) {
			grid-column: span 1;
			grid-row: span 1;
		}
	}

	/* Spotlight-and-dim: hovering one tile gently recedes its neighbors.
	   Fine-pointer + motion-ok only — a held touch shouldn't dim siblings,
	   and reduced-motion users get zero movement here too. */
	@media (hover: hover) and (prefers-reduced-motion: no-preference) {
		/* Enter/exit easing comes from the tile's own consolidated transition
		   (LaunchpadTile .tile), so un-hovering eases back instead of snapping. */
		.bento:has(:global(.tile:hover)) :global(.tile:not(:hover)) {
			opacity: 0.6;
			filter: saturate(0.7);
		}
	}

	/* Reveal-on-scroll: ONLY applies once jsReady (set client-side in
	   onMount) — a no-JS render never hides tile content, per the no-layout
	   -shift / progressive-enhancement contract. */
	.bento.js-ready :global(.tile) {
		opacity: 0;
		translate: 0 16px;
	}
	.bento.js-ready :global(.tile.visible) {
		opacity: 1;
		translate: 0 0;
	}
	@media (prefers-reduced-motion: reduce) {
		.bento.js-ready :global(.tile) {
			opacity: 1;
			translate: 0 0;
			transition: none;
		}
	}

	/* ---- secondary strip ----
	   The bento's baseboard: a full-width row of equal-width segments flush
	   with the bento's left and right edges, instead of a left-aligned flex
	   wrap that left dead space to the right (feedback 2026-07-19). */
	.strip {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 0.6rem;
	}
	.strip li {
		margin: 0;
	}
	.strip a {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		min-height: 44px;
		padding: 0 1rem;
		border-radius: 12px;
		border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.09));
		background: var(--theme-card-bg, oklch(0.18 0.018 270 / 0.32));
		text-decoration: none;
		transition:
			border-color 0.2s ease,
			background 0.2s ease,
			transform 0.2s ease;
	}
	.strip a:hover,
	.strip a:focus-visible {
		border-color: rgba(255, 255, 255, 0.24);
		background: var(--theme-card-bg-hover, oklch(0.22 0.02 270 / 0.4));
		transform: translateY(-2px);
	}
	.strip h3 {
		margin: 0;
		font-size: 0.95rem;
		font-weight: 600;
		color: var(--theme-text-dim, rgba(255, 255, 255, 0.72));
	}
	.strip a:hover h3,
	.strip a:focus-visible h3 {
		color: var(--theme-text, #f2f1fb);
	}

	@media (prefers-reduced-motion: reduce) {
		.strip a {
			transition: none;
		}
		.strip a:hover,
		.strip a:focus-visible {
			transform: none;
		}
	}
</style>
