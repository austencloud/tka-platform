<!--
  CapsHub: the single-viewport Bento hero for /notation/caps. Sides-only frame,
  live CAP demo centered and square, six compact destination tiles framing it,
  height-locked to one viewport (minus the 64px SiteHeader) so the depth
  sections start below the fold. Tiles anchor-scroll to those sections; the
  "CAPs and LOOPs" tile crosses to /notation/loops. Verified at 1920/2350/3840.
  No em dashes. No background fill: the cosmic BackgroundHost shows through.
-->
<script lang="ts">
  import { tick } from "svelte";
  import { fade } from "svelte/transition";
  import { MediaQuery } from "svelte/reactivity";
  import { animate } from "motion";
  import LaunchpadTile from "$lib/shared/landing/components/launchpad/LaunchpadTile.svelte";
  import type { LaunchpadTileDef } from "$lib/shared/landing/components/launchpad/launchpad-tiles";
  import YutaCapLiveDemo from "./YutaCapLiveDemo.svelte";
  import CapsCard from "./CapsCard.svelte";

  // DOM order == reading order (row by row across the demo). Left column = odd
  // entries, right column = even entries (placed in CSS).
  const TILES: LaunchpadTileDef[] = [
    {
      id: "what-is",
      href: "#what-is",
      heading: "What is a CAP?",
      descriptor: "One prop traces a closed loop built from two or more simpler patterns.",
      span: "1x1",
      color: "#38bdf8",
      icon: "fa-infinity",
      // Opt into action/button mode: clicking morphs the tile open into a
      // focused card (JS on); the href stays the no-JS / SEO fallback.
      activate: true,
    },
    {
      id: "breakdown",
      href: "#breakdown",
      heading: "How this CAP is built",
      descriptor: "Four steps, two halves.",
      span: "1x1",
      color: "#a78bfa",
      icon: "fa-scissors",
    },
    {
      id: "watch",
      href: "#watch",
      heading: "Watch CAPs",
      descriptor: "CAPs on video, 2009 to now.",
      span: "1x1",
      color: "#fbbf24",
      icon: "fa-circle-play",
    },
    {
      id: "relationship",
      href: "/notation/loops",
      heading: "CAPs and LOOPs",
      descriptor: "Parallel systems, different base units.",
      span: "1x1",
      color: "#22d3ee",
      icon: "fa-diagram-project",
    },
    {
      id: "math",
      href: "#math",
      heading: "Underlying math",
      descriptor: "Trochoids on nested circles.",
      span: "1x1",
      color: "#34d399",
      icon: "fa-compass-drafting",
    },
    {
      id: "origin",
      href: "#origin",
      heading: "Where it came from",
      descriptor: "Damien coined the term on Home of Poi in 2009.",
      span: "1x1",
      color: "#f472b6",
      icon: "fa-clock-rotate-left",
    },
  ];

  // ---- click-to-expand morph ----------------------------------------------
  // A tile springs open into a focused CapsCard (FLIP + Motion, the shop's
  // morph recipe), the rest of the hub dims behind. Reduced motion skips the
  // spring and just shows the card.
  const reduceMotion = new MediaQuery("(prefers-reduced-motion: reduce)");
  let activeId = $state<string | null>(null);
  let cardPanelEl = $state<HTMLElement | null>(null);
  let sourceRect: DOMRect | null = null;
  let morphControls: { stop: () => void } | null = null;

  const activeTile = $derived(activeId ? (TILES.find((t) => t.id === activeId) ?? null) : null);

  function flip(el: HTMLElement, from: DOMRect) {
    const to = el.getBoundingClientRect();
    return {
      dx: from.left - to.left,
      dy: from.top - to.top,
      sx: from.width / to.width,
      sy: from.height / to.height,
    };
  }

  async function openCard(tile: LaunchpadTileDef) {
    const el = document.querySelector<HTMLElement>(`.frame-grid .tile.t-${tile.id}`);
    sourceRect = el?.getBoundingClientRect() ?? null;
    activeId = tile.id;
    await tick();
    if (!cardPanelEl || !sourceRect || reduceMotion.current) return;
    const { dx, dy, sx, sy } = flip(cardPanelEl, sourceRect);
    cardPanelEl.style.transformOrigin = "top left";
    morphControls?.stop();
    morphControls = animate(
      cardPanelEl,
      { x: [dx, 0], y: [dy, 0], scaleX: [sx, 1], scaleY: [sy, 1] },
      { type: "spring", duration: 0.55, bounce: 0.16 },
    );
  }

  function closeCard() {
    if (cardPanelEl && sourceRect && !reduceMotion.current) {
      const { dx, dy, sx, sy } = flip(cardPanelEl, sourceRect);
      cardPanelEl.style.transformOrigin = "top left";
      morphControls?.stop();
      morphControls = animate(
        cardPanelEl,
        { x: [0, dx], y: [0, dy], scaleX: [1, sx], scaleY: [1, sy] },
        {
          type: "spring",
          duration: 0.4,
          bounce: 0.1,
          onComplete: () => {
            activeId = null;
            sourceRect = null;
          },
        },
      );
    } else {
      activeId = null;
      sourceRect = null;
    }
  }
</script>

<section class="caps-hub" class:hub-dimmed={!!activeTile} aria-label="What are CAPs">
  <a class="hub-back" href="/notation">← Flow Arts Notation</a>

  <header class="hub-head">
    <span class="eyebrow">Continuous Assembly Patterns</span>
    <h1>CAPs</h1>
    <p>A prop-spinning path assembled from pieces of simpler patterns, looped forever.</p>
  </header>

  <div class="hub-stage">
    <div class="frame-grid sides">
      <figure class="demo-cell">
        <span class="demo-hold"><YutaCapLiveDemo /></span>
        <figcaption>The bright path is traced by one prop.</figcaption>
      </figure>
      <ul class="tiles" role="list">
        {#each TILES as tile, i (tile.id)}
          <LaunchpadTile {tile} active={true} index={i} onActivate={openCard} />
        {/each}
      </ul>
    </div>
  </div>
</section>

{#if activeTile}
  <button
    class="card-backdrop"
    transition:fade={{ duration: 200 }}
    onclick={closeCard}
    aria-label="Close"
  ></button>
  <div class="card-morph">
    <div class="card-panel" bind:this={cardPanelEl}>
      <CapsCard
        id={activeTile.id}
        title={activeTile.heading}
        color={activeTile.color}
        onClose={closeCard}
      />
    </div>
  </div>
{/if}

<style>
  /* Height-lock to one viewport, minus the production SiteHeader (64px), so the
     depth sections start below the fold. No background fill: the page's cosmic
     BackgroundHost shows through. */
  .caps-hub {
    /* MarketingChrome's SiteHeader is position:fixed at 64px, so full-bleed
       content starts at y=0 underneath it. Offset the hub below the header with
       margin, and take the same height off, so it occupies exactly the first
       viewport (header + hub = 100dvh) and the depth begins right below. */
    --caps-chrome: 64px;
    position: relative;
    margin-top: var(--caps-chrome);
    height: calc(100dvh - var(--caps-chrome));
    overflow: hidden;
    display: flex;
    flex-direction: column;
    padding: clamp(0.5rem, 1.4vh, 1.2rem) clamp(1rem, 3vw, 2.5rem);
    color: #f2f1fb;
  }

  .hub-back {
    position: absolute;
    top: clamp(0.5rem, 1.4vh, 1.2rem);
    left: clamp(1rem, 3vw, 2.5rem);
    font-size: 0.85rem;
    color: rgba(255, 255, 255, 0.7);
    text-decoration: none;
    z-index: 2;
  }
  .hub-back:hover {
    color: #fff;
  }

  /* ---- click-to-expand: dim the hub, morph the focused card in over it ---- */
  .hub-head,
  .hub-stage {
    transition:
      opacity 0.4s ease,
      filter 0.4s ease;
  }
  .caps-hub.hub-dimmed .hub-head,
  .caps-hub.hub-dimmed .hub-stage {
    opacity: 0.16;
    filter: blur(3px);
    pointer-events: none;
  }

  .card-backdrop {
    position: fixed;
    inset: 0;
    z-index: 1000;
    border: 0;
    padding: 0;
    cursor: pointer;
    background: rgba(6, 8, 18, 0.55);
    backdrop-filter: blur(2px);
    -webkit-backdrop-filter: blur(2px);
  }
  .card-morph {
    position: fixed;
    inset: 0;
    z-index: 1001;
    display: grid;
    place-items: center;
    padding: clamp(1rem, 4vh, 3rem) clamp(1rem, 4vw, 3rem);
    /* Only the panel is interactive; clicks in the surrounding area fall through
       to the backdrop and close. */
    pointer-events: none;
  }
  .card-panel {
    pointer-events: auto;
    width: min(880px, 92vw);
    height: min(70vh, 640px);
    will-change: transform;
  }
  @media (prefers-reduced-motion: reduce) {
    .hub-head,
    .hub-stage {
      transition: none;
    }
  }

  .hub-head {
    flex: 0 0 auto;
    text-align: center;
    margin: 0 auto;
    padding-block: clamp(0.3rem, 1vh, 0.9rem);
  }
  .eyebrow {
    display: block;
    font-size: clamp(0.72rem, 0.9vw, 1.1rem);
    font-weight: 600;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: #38bdf8;
  }
  .hub-head h1 {
    margin: 0.1rem 0 0.3rem;
    font-size: clamp(2.2rem, 3.6vw, 5.2rem);
    line-height: 1;
    font-weight: 780;
    letter-spacing: -0.02em;
  }
  .hub-head p {
    margin: 0 auto;
    max-width: 56ch;
    font-size: clamp(0.9rem, 0.95vw, 1.15rem);
    color: rgba(255, 255, 255, 0.74);
  }

  .hub-stage {
    flex: 1 1 auto;
    min-height: 0;
    container-type: size;
    display: grid;
    place-items: center;
  }

  /* Largest 2:1 box that fits: sized by height (200cqh), capped by width
     (100cqw). Because it is 2:1 and the demo spans the center two of four
     columns across all three rows, the demo cell is inherently square. */
  .frame-grid {
    inline-size: min(100cqw, 200cqh);
    aspect-ratio: 2 / 1;
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    grid-template-rows: repeat(3, 1fr);
    gap: clamp(0.6rem, 1.1cqw, 1.4rem);
    list-style: none;
  }

  /* display:contents lifts the six <li> tiles into the band grid; role="list"
     guards Safari's contents-drops-list-semantics bug. */
  .tiles {
    display: contents;
  }

  .demo-cell {
    grid-column: 2 / 4;
    grid-row: 1 / 4;
    margin: 0;
    position: relative;
    container-type: size;
    display: grid;
    place-items: center;
    min-width: 0;
    min-height: 0;
  }
  /* Square bound on BOTH axes so it can never top-align in a too-tall wrapper. */
  .demo-hold {
    display: block;
    inline-size: min(100cqw, 100cqh);
    aspect-ratio: 1;
  }
  .demo-cell figcaption {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0.2rem;
    text-align: center;
    font-size: clamp(0.75rem, 0.85vw, 1rem);
    color: rgba(255, 255, 255, 0.6);
    pointer-events: none;
  }

  /* Side tiles nearly fill their rows so the gaps between the three stacked
     tiles stay tight (not big even bands), while still leaving a little breathing
     room top and bottom. */
  .frame-grid :global(.tile) {
    align-self: center;
    block-size: clamp(170px, 30cqh, 320px);
  }
  .frame-grid.sides :global(.tile.t-what-is) {
    grid-column: 1;
    grid-row: 1;
  }
  .frame-grid.sides :global(.tile.t-watch) {
    grid-column: 1;
    grid-row: 2;
  }
  .frame-grid.sides :global(.tile.t-math) {
    grid-column: 1;
    grid-row: 3;
  }
  .frame-grid.sides :global(.tile.t-breakdown) {
    grid-column: 4;
    grid-row: 1;
  }
  .frame-grid.sides :global(.tile.t-relationship) {
    grid-column: 4;
    grid-row: 2;
  }
  .frame-grid.sides :global(.tile.t-origin) {
    grid-column: 4;
    grid-row: 3;
  }

  @media (hover: hover) and (prefers-reduced-motion: no-preference) {
    .frame-grid:has(:global(.tile:hover)) :global(.tile:not(:hover)) {
      opacity: 0.6;
      filter: saturate(0.7);
    }
  }

  /* Narrow: drop fit-to-viewport, stack, allow scroll. */
  @media (max-width: 1020px) {
    .caps-hub {
      height: auto;
      min-height: 100dvh;
      overflow: visible;
    }
    .hub-stage {
      display: block;
      container-type: normal;
    }
    .frame-grid {
      inline-size: 100%;
      aspect-ratio: auto;
      grid-template-columns: repeat(2, 1fr);
      grid-template-rows: none;
      grid-auto-rows: clamp(150px, 30vw, 220px);
    }
    .frame-grid :global(.tile) {
      align-self: stretch;
      block-size: auto;
    }
    .frame-grid.sides :global(.tile) {
      grid-column: auto !important;
      grid-row: auto !important;
    }
    .demo-cell {
      grid-column: 1 / 3;
      grid-row: auto;
      aspect-ratio: 1;
    }
  }
  @media (max-width: 560px) {
    .frame-grid {
      grid-template-columns: 1fr;
    }
    .demo-cell {
      grid-column: 1;
    }
  }
</style>
