<script lang="ts">
  import { onMount } from "svelte";
  import { MediaQuery } from "svelte/reactivity";
  import { activateWhenNear } from "$lib/actions/activate-when-near";
  import LazyMount from "$lib/shared/components/LazyMount.svelte";
  import Seo from "$lib/shared/components/Seo.svelte";
  import { isWebGL2Available } from "$lib/shared/3d/capabilities/webgl-capabilities";
  import { viewportFits3D } from "$lib/shared/3d/capabilities/viewport-3d-gate.svelte";
  import SequenceHeroDemo from "$lib/shared/landing/components/SequenceHeroDemo.svelte";
  import { FALLBACK_DEMO } from "$lib/shared/landing/data/per-visit-demo";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import ComposerGenerateDemo from "../_components/ComposerGenerateDemo.svelte";
  import "$lib/shared/landing/styles/editorial-measure.css";

  let sequence = $state<SequenceData>(FALLBACK_DEMO);
  const reduceMotion = new MediaQuery("(prefers-reduced-motion: reduce)");
  let constructActive = $state(false);
  let outputsActive = $state(false);
  let shelfActive = $state(false);
  let composed = $state(false);
  let webglChecked = $state(false);
  let webglAvailable = $state(false);

  const canShow3D = $derived(
    webglChecked && webglAvailable && viewportFits3D()
  );

  onMount(() => {
    webglAvailable = isWebGL2Available();
    webglChecked = true;
  });

  function carrySequence(next: SequenceData): void {
    sequence = next;
    composed = true;
  }

  function activateConstruct(node: HTMLElement) {
    return activateWhenNear(node, {
      activate: () => (constructActive = true),
      rootMargin: "420px",
      deferUntilIdle: true,
    });
  }

  function activateOutputs(node: HTMLElement) {
    return activateWhenNear(node, {
      activate: () => (outputsActive = true),
      rootMargin: "420px",
      deferUntilIdle: true,
    });
  }

  function activateShelf(node: HTMLElement) {
    return activateWhenNear(node, {
      activate: () => (shelfActive = true),
      rootMargin: "420px",
      deferUntilIdle: true,
    });
  }
</script>

<Seo
  title="Flow Arts Composer | Free Flow Arts Software for Choreography"
  description="Flow Arts Composer is free flow arts software for building, animating, saving, and sharing choreography in your browser with The Kinetic Alphabet."
  canonical="https://tkaflowarts.com/composer"
  noindex
/>

{#snippet tunnelPlaceholder()}
  <div class="tunnel-placeholder" aria-hidden="true">
    <div class="placeholder-square"></div>
    <div class="placeholder-control"></div>
  </div>
{/snippet}

{#snippet constructPlaceholder()}
  <div class="construct-placeholder" aria-hidden="true">
    <div class="placeholder-pane"></div>
    <div class="placeholder-pane"></div>
  </div>
{/snippet}

{#snippet constructLoadError(_error: unknown, retry: () => void)}
  <div class="demo-load-error construct-error" role="alert">
    <p>The step-by-step demonstration did not load.</p>
    <button type="button" onclick={retry}>Try the builder again</button>
  </div>
{/snippet}

{#snippet viewerPlaceholder()}
  <div class="viewer-placeholder">
    {#if outputsActive}
      <span class="sr-only" role="status">Loading the live 3D performance.</span
      >
    {/if}
    <!-- The viewer's controls now live on a rail INSIDE the stage, so the
         skeleton reserves the stage alone. Reserving control rows under it
         would leave a gap that collapses on activation. -->
    <div aria-hidden="true">
      <div class="placeholder-wide"></div>
    </div>
  </div>
{/snippet}

{#snippet tunnelLoadError(_error: unknown, retry: () => void)}
  <div class="demo-load-error" role="alert">
    <p>The tunnel demonstration did not load.</p>
    <button type="button" onclick={retry}>Try the tunnel again</button>
  </div>
{/snippet}

{#snippet viewerLoadError(_error: unknown, retry: () => void)}
  <div class="demo-load-error" role="alert">
    <p>The 3D demonstration did not load.</p>
    <button type="button" onclick={retry}>Try the 3D viewer again</button>
  </div>
{/snippet}

{#snippet shelfPlaceholder()}
  <div class="shelf-placeholder" aria-hidden="true">
    {#each Array.from({ length: 10 }, (_, i) => i) as i (i)}
      <div class="placeholder-card"></div>
    {/each}
  </div>
{/snippet}

{#snippet shelfLoadError(_error: unknown, retry: () => void)}
  <div class="demo-load-error" role="alert">
    <p>The gallery shelf did not load.</p>
    <button type="button" onclick={retry}>Try the shelf again</button>
  </div>
{/snippet}

<main class="composer-page">
  <section class="opening" aria-labelledby="composer-title">
    <div class="opening-copy">
      <p class="opening-line">Write flow arts choreography. See it move.</p>
      <h1 id="composer-title">Flow Arts <span>Composer</span></h1>
      <!-- The cut sentence described where the pictographs sit relative to the
           animation — which the demo two inches to the right is doing. -->
      <p class="opening-lede">
        Build a sequence one step at a time, or generate a starting point.
      </p>

      <div class="opening-actions">
        <a href="/create" class="primary-action" data-sveltekit-reload>
          Start composing
          <i class="fas fa-arrow-right" aria-hidden="true"></i>
        </a>
        <a href="/browse" class="secondary-action">Browse sequences</a>
      </div>

      <p class="opening-note">
        Free in your browser. Guest saves stay on this device.
      </p>
    </div>

    <div class="opening-player">
      <SequenceHeroDemo
        {sequence}
        note="a real sequence playing in Composer"
        showNotationStrip={true}
        showWordHeader={true}
        autoPlay={!reduceMotion.current}
        cornerToggle={true}
        loadPriority="immediate"
      />
    </div>
  </section>

  <!-- One heading, then the thing itself. An earlier version explained Build and
       Generate in a two-column definition list directly above the two demos that
       ARE build and generate — narration sitting on top of the working control it
       narrates. The demos carry their own labels; the page does not need to
       introduce them twice. -->
  <section class="making" aria-labelledby="making-title">
    <h2 id="making-title" class="making-title">Write it step by step</h2>

    <div class="making-demos" use:activateConstruct>
      <div class="construct-surface">
        <LazyMount
          loader={() => import("../_sections/ConstructSection.svelte")}
          active={constructActive}
          props={{
            presentationMode: "guided-build",
            onComposed: carrySequence,
          }}
          error={constructLoadError}
          debugName="composer guided construct"
        >
          {#snippet placeholder()}
            {@render constructPlaceholder()}
          {/snippet}
        </LazyMount>
      </div>
      <div class="generator-surface">
        <ComposerGenerateDemo {sequence} onGenerated={carrySequence} />
      </div>
    </div>
  </section>

  <section
    class="changing"
    aria-labelledby="changing-title"
    use:activateOutputs
  >
    <!-- The tunnel is a square, so it rides beside the heading instead of
         leaving a rail of empty space there and forcing the 3D viewer to share
         a row it is too wide for. The viewer then gets the full band below. -->
    <div class="changing-head">
      <div class="changing-intro">
        <h2 id="changing-title">One sequence, new views.</h2>
        <p>
          The same steps multiply into a tunnel of copies, or perform in the 3D
          viewer on supported larger screens.
        </p>
      </div>

      <figure class="tunnel-output">
        <div class="product-frame square-frame">
          {#key sequence.id}
            <LazyMount
              loader={() => import("../_components/ComposerTunnelDemo.svelte")}
              active={outputsActive}
              props={{ sequence }}
              error={tunnelLoadError}
              debugName="composer tunnel"
            >
              {#snippet placeholder()}
                {@render tunnelPlaceholder()}
              {/snippet}
            </LazyMount>
          {/key}
        </div>
        <figcaption>
          <strong>Tunnel</strong>
          <span>Two, four, or eight copies around the ring.</span>
        </figcaption>
      </figure>
    </div>

    <figure class="viewer-output">
      <div class="product-frame wide-frame">
        {#if webglChecked && !webglAvailable}
          <div class="viewer-unavailable" role="status">
            <i class="fas fa-cube" aria-hidden="true"></i>
            <p>3D is unavailable in this browser.</p>
          </div>
        {:else}
          {#key sequence.id}
            <LazyMount
              loader={() => import("../_components/Composer3DViewerDemo.svelte")}
              active={outputsActive && canShow3D}
              props={{ sequence }}
              error={viewerLoadError}
              debugName="composer 3D viewer"
            >
              {#snippet placeholder()}
                {@render viewerPlaceholder()}
              {/snippet}
            </LazyMount>
          {/key}
        {/if}
      </div>
      <figcaption>
        <strong>3D viewer</strong>
        <span>Performers, formation, camera, and scene — from the rail.</span>
      </figcaption>
    </figure>

    <p class="small-screen-3d-note">
      The 3D viewer needs WebGL2 and a screen at least 600px in both directions.
    </p>
  </section>

  <section class="keeping" aria-labelledby="keeping-title" use:activateShelf>
    <div class="keeping-intro">
      <h2 id="keeping-title">Your sequence, next to theirs.</h2>
      <div class="keeping-lede">
        <p>
          The sequence carried through this page renders as a gallery card
          below, shelved with real public work from the community. Guests save
          up to three sequences on this device. A full account adds downloads,
          publishing, and creators to follow.
        </p>
        <div class="keeping-actions">
          <a href="/browse" class="secondary-action">Open the Gallery</a>
          <a href="/browse/library" class="secondary-action">Open the Library</a>
        </div>
      </div>
    </div>

    <div class="keeping-shelf">
      <LazyMount
        loader={() => import("../_components/ComposerGalleryShelf.svelte")}
        active={shelfActive}
        props={{ sequence, composed }}
        error={shelfLoadError}
        debugName="composer gallery shelf"
      >
        {#snippet placeholder()}
          {@render shelfPlaceholder()}
        {/snippet}
      </LazyMount>
    </div>
  </section>

  <!-- The "foundation" section that used to close the page is gone (2026-08-25).
       It set "Composer is an instrument built for The Kinetic Alphabet" over a
       paragraph beginning "The notation begins with double staves", and both its
       links pointed at /notation. /notation has not been a TKA explainer since
       it was rebuilt on 2026-07-27 as the Flow Arts Notation Archive — an index
       of eight notation systems, seven of them other people's. So the section
       made a dated claim and then sent the reader somewhere that does not
       explain it. Do not restore it with the copy rewritten in place: any
       replacement is a TKA claim and goes through MCP grounding and Austen's
       approval first (.claude/rules/mcp-ground-truth.md). -->
</main>

<style>
  :global(html:has(.composer-page)) {
    scroll-behavior: smooth;
  }

  .composer-page {
    position: relative;
    width: min(100%, var(--shell-w, min(1720px, 92vw)));
    margin-inline: auto;
    padding: 5.25rem 1rem 5rem;
    color: var(--theme-text, #fff);
    font-family: "Inter", system-ui, sans-serif;
  }

  .opening {
    min-height: min(50rem, calc(100svh - 6.5rem));
    display: grid;
    grid-template-columns: minmax(0, 0.86fr) minmax(0, 1.14fr);
    align-items: center;
    gap: clamp(2rem, 4.5vw, 80px);
    padding: clamp(1rem, 2.5vw, 36px) 0 clamp(3rem, 6vw, 100px);
  }

  .opening-copy {
    position: relative;
    z-index: 1;
  }

  .opening-line {
    margin: 0 0 1rem;
    color: oklch(0.77 0.12 275);
    font-size: clamp(0.9rem, 0.85rem + 0.18vw, 1.08rem);
    font-weight: 650;
    letter-spacing: 0.02em;
  }

  h1,
  h2 {
    font-family: var(--page-title-font, "Fraunces", Georgia, serif);
    font-style: italic;
    font-variation-settings:
      "opsz" 144,
      "wght" 700,
      "SOFT" 0,
      "WONK" 1;
    letter-spacing: -0.035em;
  }

  /* Display-type ceilings are in PX, deliberately, and every one of them on this
     page follows this rule. They are art-directed optical caps rather than body
     roles, and remain independent of the surrounding composition band. Nothing
     on a 4K screen needs 156px display type merely because the canvas is wider.

     A px ceiling stops the growth where it should stop. The floor stays in rem
     so a reader who has raised their browser font size still gets it. */
  h1 {
    margin: 0;
    max-width: 10ch;
    color: oklch(0.97 0.012 270);
    font-size: clamp(3rem, 2rem + 4vw, 104px);
    line-height: 0.92;
  }

  h1 span {
    display: block;
    color: oklch(0.79 0.15 278);
  }

  /* Measure comes from the shared semantic token rather than another local
     width decision. See editorial-measure.css. */
  .opening-lede {
    max-inline-size: var(--measure-lede);
    margin: 1.55rem 0 0;
    color: oklch(0.79 0.015 270);
    font-size: clamp(1rem, 0.94rem + 0.32vw, 1.28rem);
    line-height: 1.65;
  }

  .opening-actions,
  .keeping-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.7rem;
    margin-top: 1.55rem;
  }

  .primary-action,
  .secondary-action,
  .demo-load-error button {
    min-height: max(var(--min-touch-target, 48px), 48px);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.65rem;
    box-sizing: border-box;
    padding: 0.72em 1.15em;
    border-radius: var(--settings-radius-lg, 0.85rem);
    color: #fff;
    font: inherit;
    font-size: var(--font-size-min, 0.875rem);
    font-weight: 680;
    text-decoration: none;
    cursor: pointer;
    transition:
      transform 160ms ease,
      border-color 160ms ease,
      background 160ms ease,
      box-shadow 160ms ease;
  }

  .primary-action {
    border: 1px solid oklch(0.73 0.16 277 / 0.9);
    background: oklch(0.54 0.18 278);
    box-shadow: 0 1rem 2.5rem oklch(0.35 0.16 278 / 0.28);
  }

  .secondary-action,
  .demo-load-error button {
    border: 1px solid var(--theme-stroke-strong, oklch(0.58 0.04 270 / 0.34));
    background: var(--theme-card-bg, oklch(0.18 0.025 270 / 0.75));
  }

  .primary-action:hover,
  .secondary-action:hover,
  .demo-load-error button:hover {
    transform: translateY(-2px);
  }

  .primary-action:hover {
    box-shadow: 0 1.25rem 3rem oklch(0.38 0.18 278 / 0.4);
  }

  .secondary-action:hover,
  .demo-load-error button:hover {
    border-color: oklch(0.72 0.12 277 / 0.65);
    background: var(--theme-card-bg-hover, oklch(0.23 0.04 270 / 0.86));
  }

  .primary-action:focus-visible,
  .secondary-action:focus-visible,
  .demo-load-error button:focus-visible {
    outline: 2px solid var(--theme-accent, #8b8cff);
    outline-offset: 3px;
  }

  .opening-note {
    max-inline-size: var(--measure-note);
    margin: 0.9rem 0 0;
    color: oklch(0.74 0.018 270);
    font-size: var(--font-size-min, 0.875rem);
  }

  .opening-player {
    position: relative;
    width: min(100%, 45rem);
    margin-inline: auto;
  }

  .opening-player::before {
    content: "";
    position: absolute;
    inset: 12% 10%;
    z-index: -1;
    border-radius: 50%;
    background: radial-gradient(
      circle,
      oklch(0.55 0.18 278 / 0.24),
      transparent 68%
    );
    filter: blur(1.5rem);
  }

  /* px ceilings on section padding and gutters — see the note on h1. Every one
     of these was a rem ceiling riding the root ramp, so the page banked more
     empty space the wider the screen got: 216px of padding per section edge and
     192px between columns at 3840. Section rhythm should be constant once it is
     generous; it is the CONTENT that gets the extra 4K width. */
  .keeping {
    padding-block: clamp(3rem, 7vw, 112px);
  }

  .keeping-intro {
    display: grid;
    grid-template-columns: minmax(0, 1.1fr) minmax(18rem, 0.9fr);
    gap: clamp(2rem, 6vw, 96px);
    align-items: end;
    margin-bottom: clamp(2.5rem, 4.5vw, 80px);
  }

  .keeping-lede > p {
    margin: 0;
  }

  .keeping-intro .keeping-actions {
    margin-top: 1.35rem;
  }

  .keeping-shelf {
    container-type: inline-size;
    min-width: 0;
  }

  .making {
    padding-block: clamp(3rem, 7vw, 112px);
    border-top: 1px solid var(--theme-stroke, oklch(0.45 0.03 270 / 0.2));
  }

  .making-title {
    max-width: 18ch;
  }

  /* px ceiling — see the note on h1. Was 5rem, which the root ramp turned into
     120px at 4K; "One sequence, new views." ran 1862px wide as a result. */
  h2 {
    margin: 0;
    color: oklch(0.96 0.012 270);
    font-size: clamp(2.45rem, 1.8rem + 2.5vw, 74px);
    line-height: 1;
  }

  /* Body copy is capped in characters, not in rem, and is NOT centered: it
     stays on the same left grid line as the heading above it. A narrow block
     centered inside a wide section is the stranded-ribbon failure, which is a
     different bug from this one, not its cure. */
  .changing-intro > p,
  .keeping-lede > p {
    max-inline-size: var(--measure-prose);
    margin: 1.25rem 0 0;
    color: oklch(0.76 0.014 270);
    font-size: clamp(1rem, 0.94rem + 0.24vw, 1.18rem);
    line-height: 1.7;
  }

  .generator-surface {
    container-type: inline-size;
    min-width: 0;
    padding: clamp(1rem, 2.5vw, 2.1rem);
    border: 1px solid var(--theme-stroke, oklch(0.45 0.03 270 / 0.2));
    border-radius: clamp(1.1rem, 2vw, 1.8rem);
    background: var(--theme-panel-bg, oklch(0.13 0.025 270 / 0.92));
    box-shadow: 0 2rem 5rem oklch(0.04 0.03 270 / 0.35);
  }

  /* The two demos are separated by a gap, not by a tracked-out uppercase rule
     saying "or draw another". Each panel already says what it is — one has a
     picker and a play button, the other a Generate button. */
  .making-demos {
    display: grid;
    gap: clamp(1.5rem, 3vw, 3rem);
    min-width: 0;
    margin-top: clamp(2rem, 4vw, 4rem);
  }

  .construct-surface {
    min-width: 0;
  }

  .construct-placeholder {
    min-height: clamp(36rem, 52vw, 46rem);
    display: grid;
    grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
    gap: clamp(1.5rem, 3vw, 3rem);
    padding: clamp(1rem, 2.2vw, 1.75rem);
    border: 1px solid var(--theme-stroke, oklch(0.45 0.03 270 / 0.2));
    border-radius: 1.5rem;
    background: var(--theme-panel-bg, oklch(0.13 0.025 270 / 0.92));
  }

  .placeholder-pane {
    min-width: 0;
    border: 1px solid var(--theme-stroke, oklch(0.45 0.03 270 / 0.16));
    border-radius: 1.1rem;
    background: radial-gradient(
      circle at 50% 42%,
      oklch(0.22 0.04 278),
      oklch(0.1 0.02 270) 72%
    );
  }

  .construct-error {
    min-height: clamp(36rem, 52vw, 46rem);
  }

  /* `.making` already ends on 9rem of padding; a matching 8rem here stacked to
     17rem of nothing between the two sections — most of a screen at 4K, where
     the root ramp scales every rem. The seam is one generous gap, not two. */
  .changing {
    padding: clamp(2.5rem, 3.5vw, 56px) 0 clamp(3rem, 8vw, 128px);
  }

  /* The tunnel is a square stage that fills its column, so a wide column makes
     this row as tall as that column is wide — 676px at 1920 against 133px of
     heading and one line of copy, which is the dead space this section was
     called out for. The column ratio, not a cap on the figure, is what sizes
     the row: the demo measures itself against the box it is given. */
  .changing-head {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 0.3fr);
    gap: clamp(2rem, 4vw, 4.5rem);
    align-items: center;
    margin-bottom: clamp(2.5rem, 4vw, 4rem);
  }

  .changing-intro {
    min-width: 0;
  }

  figure {
    min-width: 0;
    margin: 0;
  }

  .product-frame {
    min-width: 0;
    padding: clamp(0.75rem, 1.7vw, 1.4rem);
    border: 1px solid var(--theme-stroke, oklch(0.45 0.03 270 / 0.2));
    border-radius: clamp(1rem, 1.5vw, 1.5rem);
    background: var(--theme-panel-bg, oklch(0.13 0.025 270 / 0.94));
    box-shadow: 0 1.5rem 4rem oklch(0.04 0.03 270 / 0.3);
  }

  figcaption {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.95rem 0.35rem 0;
  }

  figcaption strong {
    color: oklch(0.9 0.06 278);
    font-size: var(--font-size-min, 0.875rem);
  }

  figcaption span {
    color: oklch(0.74 0.018 270);
    font-size: var(--font-size-compact, 0.75rem);
    text-align: right;
  }

  .placeholder-square,
  .placeholder-wide {
    border-radius: 1rem;
    background: radial-gradient(
      circle at 50% 42%,
      oklch(0.24 0.05 278),
      oklch(0.1 0.02 270) 72%
    );
  }

  .placeholder-square {
    width: min(100%, 30rem);
    aspect-ratio: 1;
    margin-inline: auto;
  }

  .placeholder-wide {
    width: 100%;
    aspect-ratio: 16 / 9;
  }

  .placeholder-control {
    width: min(100%, 24rem);
    height: 3.25rem;
    margin: 1rem auto 0;
    border-radius: 0.85rem;
    background: var(--theme-card-bg, oklch(0.2 0.025 270 / 0.75));
  }

  .viewer-unavailable,
  .demo-load-error {
    min-height: clamp(18rem, 34vw, 34rem);
    display: grid;
    place-content: center;
    justify-items: center;
    gap: 0.8rem;
    text-align: center;
    color: oklch(0.72 0.02 270);
  }

  .viewer-unavailable i {
    color: oklch(0.69 0.11 278);
    font-size: 2.2rem;
  }

  .viewer-unavailable p,
  .demo-load-error p {
    margin: 0;
    font-size: var(--font-size-min, 0.875rem);
  }

  .small-screen-3d-note {
    display: none;
    max-inline-size: var(--measure-note);
    margin: 1.4rem 0 0;
    color: oklch(0.74 0.018 270);
    font-size: var(--font-size-min, 0.875rem);
    line-height: 1.55;
  }

  .keeping {
    border-top: 1px solid var(--theme-stroke, oklch(0.45 0.03 270 / 0.2));
    border-bottom: 1px solid var(--theme-stroke, oklch(0.45 0.03 270 / 0.2));
  }

  /* Same tracks the shelf renders into, so the LazyMount swap cannot shift
     layout. Keep the breakpoints in step with ComposerGalleryShelf. */
  .shelf-placeholder {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: clamp(0.8rem, 1.4vw, 1.4rem);
  }

  .shelf-placeholder > :nth-child(n + 5) {
    display: none;
  }

  @container (min-width: 800px) {
    .shelf-placeholder {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
    .shelf-placeholder > :nth-child(n + 5) {
      display: block;
    }
    .shelf-placeholder > :nth-child(n + 7) {
      display: none;
    }
  }

  @container (min-width: 1200px) {
    .shelf-placeholder {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }
    .shelf-placeholder > :nth-child(n + 7) {
      display: block;
    }
    .shelf-placeholder > :nth-child(n + 9) {
      display: none;
    }
  }

  @container (min-width: 1600px) {
    .shelf-placeholder {
      grid-template-columns: repeat(5, minmax(0, 1fr));
    }
    .shelf-placeholder > :nth-child(n + 9) {
      display: block;
    }
  }

  .placeholder-card {
    /* Matches SHELF_CARD_ASPECT_RATIO — the shape a gallery card actually
       renders at, so the shelf does not resize when the cards arrive. */
    aspect-ratio: 0.73;
    border-radius: 0.9rem;
    background: radial-gradient(
      circle at 50% 42%,
      oklch(0.22 0.04 278),
      oklch(0.1 0.02 270) 72%
    );
  }

  @media (max-width: 70rem) {
    .opening,
    .making {
      grid-template-columns: 1fr;
    }

    .keeping-intro {
      grid-template-columns: 1fr;
      gap: 1.25rem;
    }

    .opening {
      min-height: 0;
      gap: 2.5rem;
      padding-top: 1.5rem;
    }

    .opening-copy {
      text-align: center;
    }

    h1,
    .opening-lede {
      margin-inline: auto;
    }

    .opening-actions {
      justify-content: center;
    }

    .opening-player {
      width: min(100%, 38rem);
    }

    .construct-placeholder {
      min-height: 38rem;
      grid-template-columns: 1fr;
    }

    .placeholder-pane:last-child {
      display: none;
    }

    .changing-head {
      grid-template-columns: 1fr;
      gap: 2.5rem;
    }
  }

  @media (max-width: 50rem) {
    .composer-page {
      padding-inline: 0.9rem;
    }
  }

  @media (max-width: 37.4375rem), (max-height: 37.4375rem) {
    .viewer-output {
      display: none;
    }

    .small-screen-3d-note {
      display: block;
    }
  }

  @media (min-width: 48rem) and (max-height: 35rem) {
    .composer-page {
      padding-top: 4.55rem;
    }

    .opening {
      min-height: calc(100svh - 4.8rem);
      grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
      gap: 1.8rem;
      padding: 0.25rem 0 1rem;
    }

    .opening-copy {
      text-align: left;
    }

    h1 {
      margin-inline: 0;
      font-size: clamp(2.4rem, 6.2vw, 4rem);
    }

    .opening-line {
      margin-bottom: 0.55rem;
      font-size: var(--font-size-min, 0.875rem);
    }

    .opening-lede {
      max-inline-size: var(--measure-lede);
      margin: 0.8rem 0 0;
      font-size: var(--font-size-min, 0.875rem);
      line-height: 1.45;
    }

    .opening-actions {
      justify-content: flex-start;
      margin-top: 0.9rem;
    }

    .opening-note {
      margin-top: 0.55rem;
      font-size: var(--font-size-compact, 0.75rem);
    }

    .opening-player {
      width: min(100%, 18rem);
    }
  }

  @media (min-width: 105rem) {
    .composer-page {
      padding-inline: 1.5rem;
    }

    .opening {
      min-height: min(58rem, calc(100svh - 7rem));
    }

    .opening-player {
      width: min(100%, 52rem);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    :global(html:has(.composer-page)) {
      scroll-behavior: auto;
    }

    .primary-action,
    .secondary-action,
    .demo-load-error button {
      transition: none;
    }
  }
</style>
