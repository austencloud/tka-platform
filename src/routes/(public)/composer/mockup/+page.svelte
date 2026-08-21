<script lang="ts">
  import { onMount } from "svelte";
  import { activateWhenNear } from "$lib/actions/activate-when-near";
  import LazyMount from "$lib/shared/components/LazyMount.svelte";
  import Seo from "$lib/shared/components/Seo.svelte";
  import { isWebGL2Available } from "$lib/shared/3d/capabilities/webgl-capabilities";
  import { viewportFits3D } from "$lib/shared/3d/capabilities/viewport-3d-gate.svelte";
  import SequenceHeroDemo from "$lib/shared/landing/components/SequenceHeroDemo.svelte";
  import { FALLBACK_DEMO } from "$lib/shared/landing/data/per-visit-demo";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import ComposerGenerateDemo from "../_components/ComposerGenerateDemo.svelte";

  let sequence = $state<SequenceData>(FALLBACK_DEMO);
  let outputsActive = $state(false);
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
  }

  function activateOutputs(node: HTMLElement) {
    return activateWhenNear(node, {
      activate: () => (outputsActive = true),
      rootMargin: "420px",
      deferUntilIdle: true,
    });
  }
</script>

<Seo
  title="Composer presentation mockup"
  description="An unlisted working mockup for the Composer presentation page."
  canonical="https://tkaflowarts.com/composer"
  noindex
/>

{#snippet tunnelPlaceholder()}
  <div class="tunnel-placeholder" aria-hidden="true">
    <div class="placeholder-square"></div>
    <div class="placeholder-control"></div>
  </div>
{/snippet}

{#snippet viewerPlaceholder()}
  <div class="viewer-placeholder" aria-hidden="true">
    <div class="placeholder-wide"></div>
    <div class="placeholder-control"></div>
    <div class="placeholder-control short"></div>
  </div>
{/snippet}

{#snippet demoLoadError(_error: unknown, retry: () => void)}
  <div class="demo-load-error" role="alert">
    <p>This demonstration did not load.</p>
    <button type="button" onclick={retry}>Try again</button>
  </div>
{/snippet}

<main class="mockup-shell">
  <p class="review-note">Working layout study. This route is unlisted.</p>

  <section class="opening" aria-labelledby="composer-title">
    <div class="opening-copy">
      <p class="opening-line">Write flow arts choreography. See it move.</p>
      <h1 id="composer-title">Flow Arts <span>Composer</span></h1>
      <p class="opening-lede">
        Build a sequence one beat at a time or generate a starting point. The
        pictographs stay beside the animation while you work.
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
        loadPriority="immediate"
      />
    </div>
  </section>

  <section class="making" aria-labelledby="making-title">
    <div class="making-intro">
      <h2 id="making-title">Make a sequence.</h2>
      <p>
        Choose each beat in the full Composer, or ask the generator for a
        starting point. Try the generator here. Its result continues down the
        page.
      </p>

      <div class="making-paths" aria-label="Ways to begin a sequence">
        <div>
          <strong>Build</strong>
          <span>Pick the starting position and add each move.</span>
        </div>
        <div>
          <strong>Generate</strong>
          <span>Set a few movement choices and draw a sequence.</span>
        </div>
      </div>
    </div>

    <div class="generator-surface">
      <ComposerGenerateDemo {sequence} onGenerated={carrySequence} />
    </div>
  </section>

  <section
    class="changing"
    aria-labelledby="changing-title"
    use:activateOutputs
  >
    <div class="changing-intro">
      <h2 id="changing-title">Keep the sequence. Change the view.</h2>
      <p>
        The mandala beside the generator traces the movement. The same beats can
        multiply into a tunnel or play in the 3D viewer on supported larger
        screens.
      </p>
    </div>

    <div class="output-composition">
      <figure class="tunnel-output">
        <div class="product-frame square-frame">
          {#key sequence.id}
            <LazyMount
              loader={() => import("../_components/ComposerTunnelDemo.svelte")}
              active={outputsActive}
              props={{ sequence }}
              error={demoLoadError}
              debugName="composer mockup tunnel"
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

      <figure class="viewer-output">
        <div class="product-frame wide-frame">
          {#if webglChecked && !webglAvailable}
            <div class="viewer-unavailable">
              <i class="fas fa-cube" aria-hidden="true"></i>
              <p>3D is unavailable in this browser.</p>
            </div>
          {:else}
            {#key sequence.id}
              <LazyMount
                loader={() =>
                  import("../_components/Composer3DViewerDemo.svelte")}
                active={outputsActive && canShow3D}
                props={{ sequence }}
                error={demoLoadError}
                debugName="composer mockup 3D viewer"
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
          <span>Drag the stage, change the scene, or add performers.</span>
        </figcaption>
      </figure>
    </div>

    <p class="small-screen-3d-note">
      The 3D viewer needs WebGL2 and a screen at least 600px in both directions.
    </p>
  </section>

  <section class="keeping" aria-labelledby="keeping-title">
    <div class="keeping-copy">
      <h2 id="keeping-title">Keep what you make.</h2>
      <p>
        Save sequences to the Library, collect public work from the Gallery, or
        send a sequence link. Downloads and publishing open with a full account.
      </p>
      <div class="keeping-actions">
        <a href="/browse" class="secondary-action">Open the Gallery</a>
        <a href="/browse/library" class="secondary-action">Open the Library</a>
      </div>
    </div>

    <dl class="truth-ledger">
      <div>
        <dt>Guest</dt>
        <dd>Save up to three sequences on this device.</dd>
      </div>
      <div>
        <dt>Full account</dt>
        <dd>Download images or videos, publish work, and follow creators.</dd>
      </div>
      <div>
        <dt>Collections</dt>
        <dd>Organize saved sequences. Smart Collections build from a rule.</dd>
      </div>
      <div>
        <dt>QR</dt>
        <dd>
          Optional on eligible image exports. It does not appear on every
          export.
        </dd>
      </div>
    </dl>
  </section>

  <section class="foundation" aria-label="Relationship to The Kinetic Alphabet">
    <p class="foundation-statement">
      Composer is an instrument built for <a href="/notation"
        >The Kinetic Alphabet</a
      >.
    </p>
    <div class="foundation-detail">
      <p>
        The notation begins with double staves. Staff, club, fan, mini hoop,
        buugeng, and triad visuals can change the animation. A visual does not
        mean every movement transfers to every prop.
      </p>
      <a href="/notation" class="secondary-action">See how the notation works</a
      >
    </div>
  </section>

  <div class="closing">
    <p>Make the next sequence.</p>
    <a href="/create" class="primary-action" data-sveltekit-reload>
      Start composing
      <i class="fas fa-arrow-right" aria-hidden="true"></i>
    </a>
  </div>
</main>

<style>
  :global(html:has(.mockup-shell)) {
    scroll-behavior: smooth;
  }

  .mockup-shell {
    position: relative;
    width: min(100%, var(--shell-w, min(1720px, 92vw)));
    margin-inline: auto;
    padding: 5.25rem 1rem 5rem;
    color: var(--theme-text, #fff);
    font-family: "Inter", system-ui, sans-serif;
  }

  .review-note {
    margin: 0 0 1.15rem;
    color: var(--theme-text-dim, oklch(0.62 0.02 270));
    font-size: var(--font-size-compact, 0.75rem);
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .opening {
    min-height: min(50rem, calc(100svh - 6.5rem));
    display: grid;
    grid-template-columns: minmax(0, 0.86fr) minmax(0, 1.14fr);
    align-items: center;
    gap: clamp(2rem, 5vw, 6rem);
    padding: clamp(1rem, 2.5vw, 2.5rem) 0 clamp(4rem, 8vw, 7rem);
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
  h2,
  .foundation-statement,
  .closing p {
    font-family: var(--page-title-font, "Fraunces", Georgia, serif);
    font-style: italic;
    font-variation-settings:
      "opsz" 144,
      "wght" 700,
      "SOFT" 0,
      "WONK" 1;
    letter-spacing: -0.035em;
  }

  h1 {
    margin: 0;
    max-width: 10ch;
    color: oklch(0.97 0.012 270);
    font-size: clamp(3rem, 2rem + 4vw, 6.5rem);
    line-height: 0.92;
  }

  h1 span {
    display: block;
    color: oklch(0.79 0.15 278);
  }

  .opening-lede {
    max-width: 37rem;
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
    min-height: var(--min-touch-target, 48px);
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
    margin: 0.9rem 0 0;
    color: var(--theme-text-dim, oklch(0.62 0.02 270));
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

  .making,
  .keeping {
    display: grid;
    grid-template-columns: minmax(0, 0.74fr) minmax(0, 1.26fr);
    gap: clamp(2rem, 5vw, 6rem);
    align-items: center;
    padding-block: clamp(4.5rem, 9vw, 9rem);
  }

  .making {
    border-top: 1px solid var(--theme-stroke, oklch(0.45 0.03 270 / 0.2));
  }

  h2 {
    margin: 0;
    color: oklch(0.96 0.012 270);
    font-size: clamp(2.45rem, 1.8rem + 2.5vw, 5rem);
    line-height: 1;
  }

  .making-intro > p,
  .changing-intro > p,
  .keeping-copy > p,
  .foundation-detail p {
    margin: 1.25rem 0 0;
    color: oklch(0.76 0.014 270);
    font-size: clamp(1rem, 0.94rem + 0.24vw, 1.18rem);
    line-height: 1.7;
  }

  .making-paths {
    margin-top: 2rem;
    border-top: 1px solid var(--theme-stroke, oklch(0.45 0.03 270 / 0.2));
  }

  .making-paths > div {
    display: grid;
    grid-template-columns: minmax(5rem, 0.35fr) minmax(0, 1fr);
    gap: 1rem;
    padding: 1rem 0;
    border-bottom: 1px solid var(--theme-stroke, oklch(0.45 0.03 270 / 0.2));
  }

  .making-paths strong {
    color: oklch(0.86 0.1 278);
    font-size: var(--font-size-min, 0.875rem);
  }

  .making-paths span {
    color: oklch(0.69 0.016 270);
    font-size: var(--font-size-min, 0.875rem);
    line-height: 1.5;
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

  .changing {
    padding: clamp(4.5rem, 8vw, 8rem) 0 clamp(5rem, 10vw, 10rem);
  }

  .changing-intro {
    display: grid;
    grid-template-columns: minmax(0, 1.1fr) minmax(18rem, 0.9fr);
    gap: clamp(2rem, 7vw, 8rem);
    align-items: end;
    margin-bottom: clamp(2.5rem, 5vw, 5rem);
  }

  .changing-intro > p {
    margin: 0;
  }

  .output-composition {
    display: grid;
    grid-template-columns: minmax(0, 0.76fr) minmax(0, 1.24fr);
    gap: clamp(1.25rem, 3vw, 3.5rem);
    align-items: center;
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
    color: var(--theme-text-dim, oklch(0.62 0.02 270));
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

  .placeholder-control.short {
    width: min(100%, 30rem);
    margin-top: 0.8rem;
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
    margin: 1.4rem 0 0;
    color: var(--theme-text-dim, oklch(0.62 0.02 270));
    font-size: var(--font-size-min, 0.875rem);
    line-height: 1.55;
  }

  .keeping {
    border-top: 1px solid var(--theme-stroke, oklch(0.45 0.03 270 / 0.2));
    border-bottom: 1px solid var(--theme-stroke, oklch(0.45 0.03 270 / 0.2));
  }

  .truth-ledger {
    margin: 0;
    border-top: 1px solid var(--theme-stroke, oklch(0.45 0.03 270 / 0.2));
  }

  .truth-ledger > div {
    display: grid;
    grid-template-columns: minmax(7.5rem, 0.32fr) minmax(0, 1fr);
    gap: 1rem;
    padding: 1.15rem 0;
    border-bottom: 1px solid var(--theme-stroke, oklch(0.45 0.03 270 / 0.2));
  }

  .truth-ledger dt {
    color: oklch(0.84 0.09 278);
    font-size: var(--font-size-min, 0.875rem);
    font-weight: 680;
  }

  .truth-ledger dd {
    margin: 0;
    color: oklch(0.7 0.016 270);
    font-size: var(--font-size-min, 0.875rem);
    line-height: 1.55;
  }

  .foundation {
    display: grid;
    grid-template-columns: minmax(0, 1.15fr) minmax(18rem, 0.85fr);
    gap: clamp(2rem, 7vw, 8rem);
    align-items: center;
    padding-block: clamp(5rem, 11vw, 11rem);
  }

  .foundation-statement {
    margin: 0;
    color: oklch(0.94 0.018 270);
    font-size: clamp(2.25rem, 1.55rem + 2.7vw, 5.2rem);
    line-height: 1.03;
  }

  .foundation-statement a {
    color: oklch(0.79 0.15 278);
    text-decoration-color: oklch(0.79 0.15 278 / 0.38);
    text-underline-offset: 0.12em;
  }

  .foundation-detail .secondary-action {
    margin-top: 1.5rem;
  }

  .closing {
    min-height: 18rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 2rem;
    padding: clamp(2.25rem, 4vw, 4rem);
    border-radius: clamp(1.25rem, 2vw, 2rem);
    background:
      radial-gradient(
        circle at 80% 40%,
        oklch(0.56 0.17 278 / 0.25),
        transparent 42%
      ),
      var(--theme-panel-bg, oklch(0.13 0.025 270 / 0.96));
    border: 1px solid oklch(0.6 0.09 278 / 0.26);
  }

  .closing p {
    margin: 0;
    color: oklch(0.96 0.012 270);
    font-size: clamp(2.2rem, 1.7rem + 2vw, 4.5rem);
    line-height: 1;
  }

  @media (max-width: 70rem) {
    .opening,
    .making,
    .keeping,
    .foundation {
      grid-template-columns: 1fr;
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

    .making-intro {
      max-width: 48rem;
    }

    .changing-intro {
      grid-template-columns: 1fr;
      gap: 1.25rem;
    }

    .changing-intro > p {
      max-width: 48rem;
    }
  }

  @media (max-width: 50rem) {
    .mockup-shell {
      padding-inline: 0.9rem;
    }

    .output-composition {
      grid-template-columns: 1fr;
      gap: 3rem;
    }

    .closing {
      min-height: 16rem;
      flex-direction: column;
      align-items: flex-start;
      justify-content: center;
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
    .mockup-shell {
      padding-top: 4.55rem;
    }

    .review-note {
      margin-bottom: 0.35rem;
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
      max-width: 33rem;
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
    .mockup-shell {
      padding-inline: 1.5rem;
    }

    .opening {
      min-height: min(58rem, calc(100svh - 7rem));
    }

    .opening-player {
      width: min(100%, 52rem);
    }

    .making {
      grid-template-columns: minmax(22rem, 0.62fr) minmax(0, 1.38fr);
    }

    .keeping {
      grid-template-columns: minmax(24rem, 0.82fr) minmax(0, 1.18fr);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    :global(html:has(.mockup-shell)) {
      scroll-behavior: auto;
    }

    .primary-action,
    .secondary-action,
    .demo-load-error button {
      transition: none;
    }
  }
</style>
