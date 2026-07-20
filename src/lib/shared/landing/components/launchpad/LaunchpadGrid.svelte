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
  import {
    LAUNCHPAD_TILES,
    STRIP_LINKS,
    type LaunchpadTileDef,
  } from "./launchpad-tiles";

  // Every prop defaults to the homepage's current behavior, so `<LaunchpadGrid />`
  // (the +page.svelte call site) renders byte-identically to before this became
  // reusable. Consumers like the composer bento override tiles/strip/label/
  // variant and supply an `onActivate` to drive action-mode tiles.
  let {
    tiles = LAUNCHPAD_TILES,
    stripLinks = STRIP_LINKS,
    ariaLabel = "TKA destinations",
    showStrip = true,
    variant = "home",
    onActivate,
  }: {
    tiles?: LaunchpadTileDef[];
    stripLinks?: { label: string; href: string }[];
    ariaLabel?: string;
    showStrip?: boolean;
    variant?: "home" | "composer";
    onActivate?: (tile: LaunchpadTileDef) => void;
  } = $props();

  let bentoEl: HTMLUListElement | undefined = $state();
  let visible = $state<Set<string>>(new Set());
  let jsReady = $state(false);

  onMount(() => {
    jsReady = true;

    const nodes =
      bentoEl?.querySelectorAll<HTMLLIElement>("li.tile[data-tile-id]") ?? [];
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
      { rootMargin: "200px" }
    );
    nodes.forEach((node) => observer.observe(node));

    return () => observer.disconnect();
  });
</script>

<nav class="launchpad variant-{variant}" aria-label={ariaLabel}>
  <div class="launchpad-group">
    <ul class="bento" class:js-ready={jsReady} bind:this={bentoEl}>
      {#each tiles as tile, i (tile.id)}
        <LaunchpadTile
          {tile}
          active={visible.has(tile.id)}
          index={i}
          {variant}
          {onActivate}
        />
      {/each}
    </ul>

    {#if showStrip}
      <ul class="strip">
        {#each stripLinks as link (link.href)}
          <li>
            <a href={link.href}>
              <h3>{link.label}</h3>
            </a>
          </li>
        {/each}
      </ul>
    {/if}
  </div>
</nav>

<style>
  .launchpad {
    container-name: launchpad;
    container-type: inline-size;
    max-width: 1180px;
    margin: 0 auto;
    padding: 0 1.4rem 3rem;
  }
  .launchpad-group {
    width: 100%;
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

  /* A tablet has room for the complete front door, but six full-width rows
	   read as a wall of panels. Four visual bands restore the bento hierarchy:
	   the primary routes stay wide, related destinations share a row, and the
	   whole group can breathe around the hero without leaving the first screen. */
  @media (min-width: 760px) and (max-width: 1679px) and (min-height: 500px) {
    .launchpad.variant-home {
      height: 100%;
      min-height: 0;
      max-width: none;
      padding: 0;
    }
    .launchpad.variant-home .launchpad-group {
      display: grid;
      grid-template-rows: auto auto;
      align-content: center;
      row-gap: clamp(1rem, 1.8svh, 1.5rem);
      height: 100%;
      min-height: 0;
    }
    .launchpad.variant-home .bento {
      align-self: center;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      grid-template-rows:
        clamp(8rem, 16svh, 11.5rem)
        clamp(8rem, 15svh, 10.5rem)
        clamp(8rem, 16svh, 11.5rem)
        clamp(6.75rem, 12svh, 8.5rem);
      grid-auto-rows: 0;
      grid-auto-flow: row;
      gap: clamp(1.125rem, 1.8svh, 1.5rem);
      width: 100%;
      min-height: 0;
      margin: 0;
    }
    .launchpad.variant-home .bento :global(.t-composer),
    .launchpad.variant-home .bento :global(.t-notation) {
      grid-column: 1 / -1;
    }
    .launchpad.variant-home .bento :global(.t-composer) {
      grid-row: 1;
    }
    .launchpad.variant-home .bento :global(.t-choreo-cards),
    .launchpad.variant-home .bento :global(.t-guide) {
      grid-row: 2;
    }
    .launchpad.variant-home .bento :global(.t-choreo-cards),
    .launchpad.variant-home .bento :global(.t-faq) {
      grid-column: 1;
    }
    .launchpad.variant-home .bento :global(.t-guide),
    .launchpad.variant-home .bento :global(.t-glossary) {
      grid-column: 2;
    }
    .launchpad.variant-home .bento :global(.t-notation) {
      grid-row: 3;
    }
    .launchpad.variant-home .bento :global(.t-faq),
    .launchpad.variant-home .bento :global(.t-glossary) {
      grid-row: 4;
    }
    .launchpad.variant-home .strip a {
      padding-inline: 0.5rem;
    }
    .launchpad.variant-home .strip h3 {
      font-size: 0.85rem;
      white-space: nowrap;
    }
  }

  /* Short landscape tablets use the same four bands but divide the remaining
	   height proportionally. The tile component removes supporting copy at this
	   height, leaving large, stable destination buttons instead of overflow. */
  @media (min-width: 760px) and (max-width: 1679px) and (min-height: 500px) and (max-height: 850px) {
    .launchpad.variant-home .launchpad-group {
      grid-template-rows: minmax(0, 1fr) auto;
      align-content: stretch;
    }
    .launchpad.variant-home .bento {
      align-self: stretch;
      grid-template-rows:
        minmax(0, 1.15fr)
        minmax(0, 1fr)
        minmax(0, 1.15fr)
        minmax(0, 0.9fr);
      height: 100%;
      gap: 0.75rem;
    }
  }

  /* When the right pane itself is narrow, two-up cards stop being useful.
	   The container fallback becomes a compact six-button rail. The utility
	   strip switches to two columns slightly sooner so its long labels never
	   wrap inside four undersized segments. */
  @media (min-width: 760px) and (max-width: 1679px) and (min-height: 500px) {
    @container launchpad (max-width: 22rem) {
      .launchpad.variant-home .launchpad-group {
        grid-template-rows: minmax(0, 1fr) auto;
        align-content: stretch;
      }
      .launchpad.variant-home .bento {
        align-self: stretch;
        grid-template-columns: 1fr;
        grid-template-rows: repeat(6, minmax(0, 1fr));
        height: 100%;
        gap: 0.75rem;
      }
      .launchpad.variant-home .bento :global(.tile) {
        grid-column: 1;
        grid-row: auto;
        min-height: 0;
      }
    }
    @container launchpad (max-width: 38rem) {
      .launchpad.variant-home .strip {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }
  }

  /* On a short Fold, six equal destinations read faster than two oversized
	   banner cards. The secondary links return to one compact row, leaving the
	   bento three generous rows while every control keeps its 44px target. */
  @media (min-width: 760px) and (max-width: 1180px) and (min-height: 500px) and (max-height: 649px) {
    .launchpad.variant-home .launchpad-group {
      row-gap: 0.5rem;
    }
    .launchpad.variant-home .bento {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      grid-template-rows: repeat(3, minmax(0, 1fr));
      grid-auto-rows: 0;
      grid-auto-flow: row;
      gap: 0.5rem;
    }
    .launchpad.variant-home .bento :global(.tile) {
      grid-column: auto;
      grid-row: auto;
      min-height: 0;
    }
    .launchpad.variant-home .strip {
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 0.5rem;
    }
    .launchpad.variant-home .strip a {
      padding-inline: 0.25rem;
    }
    .launchpad.variant-home .strip h3 {
      font-size: var(--font-size-compact, 0.75rem);
    }
  }

  /* Split tier (one-viewport composition, see +page.svelte): the right pane
	   owns width and spacing, and rows become height-keyed so three rows plus
	   the strip always fit the viewport beside the hero. */
  @media (min-width: 1680px) {
    .launchpad {
      max-width: none;
      padding: 0;
    }
    .bento {
      grid-auto-rows: clamp(10.625rem, 21.5svh, 21.25rem);
    }
  }

  @media (max-width: 640px) {
    .bento {
      grid-template-columns: 1fr;
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
  /* Four segments become two rows of two on narrower grids. These sit AFTER
	   the base .strip rule on
	   purpose — an earlier under-640 override lost the same-specificity
	   cascade to the base block and was silently dead. */
  @media (min-width: 641px) and (max-width: 1020px) {
    .strip {
      grid-template-columns: repeat(2, 1fr);
    }
  }
  @media (max-width: 640px) {
    .strip {
      grid-template-columns: repeat(2, 1fr);
    }
  }
  .strip li {
    margin: 0;
  }
  .strip a {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    min-height: 2.75rem;
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
