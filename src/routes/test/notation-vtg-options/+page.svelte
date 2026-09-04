<!--
  Options page for the Vulcan Tech Gospel artifact.

  The archive can only show one thing in the VTG tile. This page puts the
  candidates side by side at the size the decision actually happens — the hero
  tile — so the choice is made by looking rather than by reading a description.

  Every figure on this page is cropped out of a source PDF (Vulcan Tech Gospel
  V.1, or Vulcan Tech Gospel #2 chapters 1 and 2, both published at noelyee.com).
  Nothing here is redrawn or reconstructed.

  Prototype route. Not linked from anywhere, not production.
-->
<script lang="ts">
  import VtgFigureCycle, {
    type Figure,
  } from "./_components/VtgFigureCycle.svelte";
  import VtgCorpusWall from "./_components/VtgCorpusWall.svelte";
  import VtgMinimalBeatShapes from "../../(public)/history/_components/archive/VtgMinimalBeatShapes.svelte";

  type Candidate = {
    id: string;
    title: string;
    source: string;
    pitch: string;
    cost: string;
  };

  const SHEETS: Figure[] = [
    { file: "trans-split-same", label: "Split Same Hands" },
    { file: "trans-split-opp", label: "Split Opposite Hands" },
    { file: "trans-tog-same", label: "Together Same Hands" },
    { file: "trans-tog-opp", label: "Together Opposite Hands" },
  ];

  const RINGS: Figure[] = [
    { file: "ring-spin-horizontal", label: "Horizontal 2-Petal Spin Flower" },
    { file: "ring-spin-vertical", label: "Vertical 2-Petal Spin Flower" },
    { file: "ring-antispin-diamond", label: "Diamond Antispin Flower" },
    { file: "ring-antispin-box", label: "Box Antispin Flower" },
    {
      file: "ring-hybrid-dia-vert",
      label: "Diamond Antispin vs Vertical Spin",
    },
    {
      file: "ring-hybrid-dia-horiz",
      label: "Diamond Antispin vs Horizontal Spin",
    },
    { file: "ring-hybrid-box-vert", label: "Box Antispin vs Vertical Spin" },
    { file: "ring-hybrid-box-horiz", label: "Box Antispin vs Horizontal Spin" },
  ];

  // The system's own argument, in the order VTG makes it.
  const ARC: Figure[] = [
    { file: "beat-shapes-page", label: "Ten minimal beat shapes" },
    { file: "patterns-40-a", label: "…combine into forty patterns" },
    { file: "trans-split-same", label: "…which transition between each other" },
    { file: "hybrid-3d", label: "…and leave the wall plane: 144 total" },
  ];

  const ALL_FIGURES = [
    "beat-shapes-page",
    "patterns-40-a",
    "patterns-40-b",
    "transition-theory",
    "trans-split-same",
    "trans-split-opp",
    "trans-tog-same",
    "trans-tog-opp",
    "hybrid-3d",
    "ring-spin-horizontal",
    "ring-spin-vertical",
    "ring-antispin-diamond",
    "ring-antispin-box",
    "ring-hybrid-dia-vert",
    "ring-hybrid-dia-horiz",
    "ring-hybrid-box-vert",
    "ring-hybrid-box-horiz",
  ];

  const CANDIDATES: Candidate[] = [
    {
      id: "shapes",
      title: "A · Ten Minimal Beat Shapes",
      source: "VTG V.1, page 2",
      pitch:
        "What ships today. The alphabet, in VTG's own hand. Reads instantly and never moves.",
      cost: "One plate. Says nothing about how deep the system goes.",
    },
    {
      id: "sheets",
      title: "B · The four transition sheets",
      source: "VTG V.1, pages 6–9 · David “Tankboy” Cantor",
      pitch:
        "One sheet per VTG category, cycling. Dense lattices tagged S/S, T/S, S/O, T/O — unmistakably a notation, not a diagram.",
      cost: "Too fine to read at tile size; it reads as texture until you open it.",
    },
    {
      id: "rings",
      title: "C · The transition rings",
      source: "VTG #2, chapters 1–2 · Cantor & Yee",
      pitch:
        "A flower at the centre, its four legal transitions ringed around it. Eight of them. The prettiest pages in the corpus and already slideshow-shaped.",
      cost: "The centre flower does look flower-ish — the thing you flagged.",
    },
    {
      id: "arc",
      title: "D · The system's own argument",
      source: "VTG V.1, pages 2 → 3 → 6 → 10",
      pitch:
        "Ten shapes → forty patterns → transitions → 144 in three dimensions. Four slides that make VTG's case in VTG's order.",
      cost: "Needs its captions to land; a viewer who ignores them sees four unrelated plates.",
    },
    {
      id: "wall",
      title: "E · The whole corpus",
      source: "Every plate in V.1 and #2",
      pitch:
        "Seventeen plates tiled, one lit at a time. The claim is “this system has a literature,” which no single page can make.",
      cost: "Nothing is legible. It's a texture that means volume, not a readable artifact.",
    },
  ];

  let scale = $state<"hero" | "tile">("hero");
  let running = $state(true);
</script>

<svelte:head><title>VTG artifact options</title></svelte:head>

<main>
  <header>
    <p class="kicker">Notation archive · artifact options</p>
    <h1>What should the Vulcan tile show?</h1>
    <p class="lede">
      Five treatments, all built from figures cropped out of the source PDFs.
      Compare them at the size the tile actually is.
    </p>

    <div class="controls">
      <div class="seg" role="group" aria-label="Preview size">
        <button
          type="button"
          class:on={scale === "hero"}
          onclick={() => (scale = "hero")}>Hero tile</button
        >
        <button
          type="button"
          class:on={scale === "tile"}
          onclick={() => (scale = "tile")}>Small tile</button
        >
      </div>
      <button type="button" class="ghost" onclick={() => (running = !running)}>
        {running ? "Pause cycling" : "Resume cycling"}
      </button>
    </div>
  </header>

  <div class="deck-scroll">
    <section class="deck" class:small={scale === "tile"}>
      {#each CANDIDATES as c (c.id)}
        <article class="candidate">
          <div class="frame">
            {#if c.id === "shapes"}
              <VtgMinimalBeatShapes active={running} />
            {:else if c.id === "sheets"}
              <!-- Paired: the four sheets are peers, and two landscape
						     sheets stacked fill a portrait tile that one leaves
						     two-thirds empty. -->
              <VtgFigureCycle
                figures={SHEETS}
                active={running}
                perView={2}
                interval={3400}
                alt="The four Vulcan Tech Gospel transition sheets."
              />
            {:else if c.id === "rings"}
              <VtgFigureCycle
                figures={RINGS}
                active={running}
                perView={2}
                interval={3000}
                alt="Vulcan Tech Gospel transition rings: a flower with its four legal transitions."
              />
            {:else if c.id === "arc"}
              <!-- Paired two-up rather than one plate at a time: every VTG
						     page is landscape and this tile is portrait, so a lone
						     plate floats in a two-thirds-empty box. Two per slide
						     keeps the argument in order (1→2, then 3→4) AND reads
						     down the tile as a progression. -->
              <VtgFigureCycle
                figures={ARC}
                active={running}
                perView={2}
                interval={3800}
                alt="The Vulcan Tech Gospel argument: ten shapes, forty patterns, transitions, 144 in three dimensions."
              />
            {:else if c.id === "wall"}
              <!-- 3 columns, not 4: 17 plates against 4 columns strands a final row
						     of one (.claude/rules/4k-native-layout.md). 17 % 3 = 2. -->
              <VtgCorpusWall files={ALL_FIGURES} active={running} cols={3} />
            {/if}
          </div>

          <h2>{c.title}</h2>
          <p class="source">{c.source}</p>
          <p class="pitch">{c.pitch}</p>
          <p class="cost"><span>Costs you:</span> {c.cost}</p>
        </article>
      {/each}
    </section>
  </div>
</main>

<style>
  /* The frames are pinned to the archive's real tile size, so at 4K the
	   content genuinely is shorter than the viewport and cannot be scaled up
	   without lying about the size being judged. Centre it rather than
	   stranding it against the top edge over a screen of void. */
  main {
    min-height: 100vh;
    display: grid;
    align-content: center;
    box-sizing: border-box;
    padding: clamp(1.5rem, 3vw, 3rem);
    background:
      radial-gradient(
        120% 90% at 50% 0%,
        oklch(0.22 0.03 280),
        transparent 70%
      ),
      oklch(0.14 0.02 275);
    color: oklch(0.92 0.01 90);
    font-family: system-ui, sans-serif;
  }

  header {
    max-width: var(--shell-w, min(1720px, 92vw));
    margin: 0 auto clamp(1.5rem, 3vw, 3rem);
  }

  .kicker {
    margin: 0;
    font-size: 0.78rem;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: oklch(0.75 0.13 40);
  }

  h1 {
    margin: 0.3rem 0 0.5rem;
    font-size: clamp(1.8rem, 3.2vw, 3.2rem);
    font-weight: 700;
    letter-spacing: -0.02em;
  }

  .lede {
    margin: 0;
    max-width: none;
    font-size: clamp(0.95rem, 1.1vw, 1.35rem);
    color: oklch(0.74 0.02 80);
  }

  .controls {
    margin-top: 1.4rem;
    display: flex;
    flex-wrap: wrap;
    gap: 0.8rem;
    align-items: center;
  }

  .seg {
    display: flex;
    gap: 2px;
    padding: 3px;
    border-radius: 999px;
    background: oklch(0.24 0.02 275);
    border: 1px solid oklch(0.4 0.03 275);
  }

  .seg button,
  .ghost {
    min-height: 44px;
    padding: 0 1.1rem;
    border-radius: 999px;
    border: 0;
    background: transparent;
    color: oklch(0.8 0.02 80);
    font: inherit;
    font-size: 0.92rem;
    cursor: pointer;
    transition:
      background-color 200ms ease,
      color 200ms ease;
  }

  .seg button.on {
    background: oklch(0.72 0.15 40);
    color: oklch(0.16 0.02 40);
    font-weight: 600;
  }

  .ghost {
    border: 1px solid oklch(0.42 0.03 275);
  }

  .seg button:hover:not(.on),
  .ghost:hover {
    background: oklch(0.3 0.03 275);
  }

  /* Fixed candidate width, wrapping — NOT fluid columns. The whole point of
	   this page is judging each treatment at the size the archive actually
	   renders it; fluid columns make the frame track the viewport instead, and
	   a plate that reads fine at 345px can be unreadable at the real 538px (or
	   vice versa — candidate A's two-column form only appears above 420px).
	   Measured off the archive at 1920: hero 538x764, small tile 257x378. */
  /* Explicit column counts, never `wrap` or `auto-fill`. Five fixed-width
	   candidates wrapped freely land on 4+1 at 2560 — a stranded row of one
	   (.claude/rules/4k-native-layout.md). Allowed counts for five items are
	   5, 3, 2 and 1; each breakpoint below is the width that count needs, so a
	   4+1 can never occur. The two modes need their own ladders because the
	   frame width differs and a media query can't read --frame-w. */
  .deck {
    --frame-w: 538px;
    --frame-h: 764px;
    --gap: 2rem;
    --cols: 1;
    margin: 0 auto;
    display: grid;
    grid-template-columns: repeat(var(--cols), var(--frame-w));
    /* `safe` matters: plain `center` inside the scroller clips BOTH edges
		   once the columns are wider than the viewport, so the first candidate
		   is cut off and unreachable. `safe` falls back to start-alignment
		   exactly when overflow would occur. */
    justify-content: safe center;
    gap: var(--gap);
  }

  /* hero: 538 + 32 gap. 3 columns hold from 620 up even though three true-size
	   heroes need 1678px — below that the DECK scrolls sideways inside its own
	   scroller rather than the frames shrinking. Shrinking would defeat the one
	   job of this page (judge each treatment at the archive's real tile size),
	   and the document itself never scrolls horizontally. */
  @media (min-width: 620px) {
    .deck {
      --cols: 3;
    }
  }
  @media (min-width: 2900px) {
    .deck {
      --cols: 5;
    }
  }

  /* small: 257 + 32 gap */
  .deck.small {
    --frame-w: 257px;
    --frame-h: 378px;
    --cols: 1;
  }
  @media (min-width: 620px) {
    .deck.small {
      --cols: 3;
    }
  }
  @media (min-width: 1520px) {
    .deck.small {
      --cols: 5;
    }
  }

  .deck-scroll {
    overflow-x: auto;
    overflow-y: hidden;
    padding-bottom: 0.5rem;
  }

  .candidate {
    width: var(--frame-w);
    min-width: 0;
    display: grid;
    grid-template-rows: auto auto auto auto auto;
    gap: 0.4rem;
  }

  .frame {
    container-type: size;
    width: var(--frame-w);
    height: var(--frame-h);
    border-radius: 18px;
    background:
      radial-gradient(90% 70% at 50% 0%, oklch(0.26 0.04 280), transparent 70%),
      oklch(0.17 0.02 275);
    border: 1px solid oklch(0.38 0.03 275);
    overflow: hidden;
  }

  /* Narrower than one true-size hero: shrink the frame rather than overflow
	   the document. Proportion is preserved even though the size no longer
	   matches the archive. */
  @media (max-width: 620px) {
    .deck {
      /* 84vw, not 88: `main`'s own padding already eats ~13vw at 375, and
			   88 left the deck scroller with a few px of stray sideways scroll. */
      --frame-w: min(538px, 84vw);
      --frame-h: calc(min(538px, 84vw) / 0.7);
    }
  }

  h2 {
    margin: 0.6rem 0 0;
    font-size: clamp(0.95rem, 1vw, 1.2rem);
    font-weight: 650;
  }

  .source {
    margin: 0;
    font-size: 0.82rem;
    color: oklch(0.75 0.12 40);
  }

  .pitch,
  .cost {
    margin: 0;
    font-size: 0.88rem;
    line-height: 1.45;
    color: oklch(0.76 0.02 80);
  }

  .cost {
    color: oklch(0.66 0.02 80);
  }

  .cost span {
    color: oklch(0.78 0.11 40);
    font-weight: 600;
  }
</style>
