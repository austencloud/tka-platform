<script lang="ts">
  // Test harness for the composer-page "five wings" rework. Mounts the REAL
  // section components (built to reuse existing primitives) so the layout can
  // be evaluated with actual rendered content, not a wireframe. Not shipping to
  // /composer yet.
  //
  // The section components are loaded via CLIENT-ONLY dynamic import (inside the
  // IntersectionObserver, which never runs server-side). A static top-level
  // import would drag the heavy pictograph graph — incl. special-arrow-placement
  // -> zod — through the dev SSR module runner, which throws "Cannot find module
  // 'zod'". Lazy client import is how /composer avoids the same trap.
  import "$lib/shared/landing/styles/public-editorial.css";
  import type { Component } from "svelte";

  const loaders: Record<string, () => Promise<{ default: Component }>> = {
    construct: () => import("./_sections/ConstructSection.svelte"),
    generate: () => import("./_sections/GenerateSection.svelte"),
    mandala: () => import("./_sections/MandalaSection.svelte"),
    games: () => import("./_sections/GamesStripSection.svelte"),
  };

  // Component refs, filled once each slot scrolls near.
  const comp = $state<Record<string, Component | null>>({
    construct: null,
    generate: null,
    mandala: null,
    games: null,
  });

  function whenNear(node: HTMLElement, key: string) {
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          void loaders[key]().then((m) => {
            comp[key] = m.default;
          });
        }
      },
      { rootMargin: "300px" }
    );
    io.observe(node);
    return { destroy: () => io.disconnect() };
  }
</script>

<svelte:head>
  <title>Composer wings — layout test</title>
</svelte:head>

<div class="page">
  <div class="container">
    <header class="test-head">
      <p class="eyebrow">Test harness · not the live /composer page</p>
      <h1>Composer page — five wings, real components</h1>
      <p class="lede-line">
        Each section below mounts the actual primitives. Scroll to load them. Tell me what
        renders, what breaks, and what to move.
      </p>
    </header>

    <!-- WING 1: CREATE -->
    <div class="wing-band" style="--wc:#8b8cff">
      <span class="wn">①</span><span class="wname">Create</span>
      <span class="wtag">make it</span>
    </div>

    <section class="editorial-section" style="--accent:#8b8cff">
      <span class="section-kicker">Construct</span>
      <h2 class="section-title">Build it step by step</h2>
      <div class="prose"><p>Pick a starting position, then tap the valid next steps and watch the sequence grow.</p></div>
      <div class="slot" use:whenNear={"construct"}>
        {#if comp.construct}
          {@const Section = comp.construct}
          <Section />
        {:else}
          <div class="ph">loading on scroll…</div>
        {/if}
      </div>
    </section>

    <section class="editorial-section" style="--accent:#ec4899">
      <span class="section-kicker">Generate</span>
      <h2 class="section-title">Or skip the building</h2>
      <div class="prose"><p>Set a few parameters, hit generate, watch the result. No mandala here anymore.</p></div>
      <div class="slot" use:whenNear={"generate"}>
        {#if comp.generate}
          {@const Section = comp.generate}
          <Section />
        {:else}
          <div class="ph">loading on scroll…</div>
        {/if}
      </div>
    </section>

    <!-- WING 2: OUTPUTS -->
    <div class="wing-band" style="--wc:#ec6ba8">
      <span class="wn">②</span><span class="wname">Outputs</span>
      <span class="wtag">what it becomes</span>
    </div>

    <section class="editorial-section" style="--accent:#ec6ba8">
      <span class="section-kicker">Mandala</span>
      <h2 class="section-title">The shape decides the mandala</h2>
      <div class="prose"><p>A mandala is the path a sequence traces. Change the movement and the shape changes with it, and the Kinetic Alphabet reaches shapes older systems couldn't hold.</p></div>
      <div class="slot" use:whenNear={"mandala"}>
        {#if comp.mandala}
          {@const Section = comp.mandala}
          <Section />
        {:else}
          <div class="ph">loading on scroll…</div>
        {/if}
      </div>
    </section>

    <p class="note-line">Tunnel · Card · 3D already exist as sections on /composer and would join this Outputs family here.</p>

    <!-- WING 3: LEARN -->
    <div class="wing-band" style="--wc:#f0a83c">
      <span class="wn">③</span><span class="wname">Learn</span>
      <span class="wtag">learn it &amp; get better</span>
    </div>

    <section class="editorial-section" style="--accent:#f0a83c">
      <span class="section-kicker">Play</span>
      <h2 class="section-title">A whole arcade, not one game</h2>
      <div class="prose"><p>The arcade's own animated preview tiles. The four that need no alphabet knowledge lead.</p></div>
      <div class="slot wide" use:whenNear={"games"}>
        {#if comp.games}
          {@const Section = comp.games}
          <Section />
        {:else}
          <div class="ph">loading on scroll…</div>
        {/if}
      </div>
    </section>

    <p class="note-line">Guide tease (cover emblem + spine) and Practice tease (tempo-ramp cockpit) come next in this wing.</p>

    <!-- WINGS 4 + 5: CONNECT + LIBRARY -->
    <div class="wing-band" style="--wc:#35c7d6">
      <span class="wn">④⑤</span><span class="wname">Connect + Library</span>
      <span class="wtag">share it · find it</span>
    </div>
    <p class="note-line">
      Real components exist and are next: a Featured-creators row (CreatorCard), a community browse
      grid with filter chips, and a collections shelf including a Smart Collection. Held back from this
      pass so you can react to the animated wings first.
    </p>

    <div class="tail"></div>
  </div>
</div>

<style>
  .page {
    min-height: 100vh;
    color: #e7e9f5;
    background:
      radial-gradient(120% 80% at 50% -8%, #171a3a 0%, #0e1024 45%, #0a0b16 100%);
    background-attachment: fixed;
    font-family: "Inter", system-ui, sans-serif;
  }
  .container {
    max-width: 1180px;
    margin: 0 auto;
    padding: 2.5rem 1.5rem 6rem;
  }
  .test-head {
    text-align: center;
    margin-bottom: 2.5rem;
  }
  .eyebrow {
    font-size: 0.72rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: #f0a83c;
    margin: 0 0 0.4rem;
  }
  .test-head h1 {
    font-size: clamp(1.6rem, 1.2rem + 1.4vw, 2.3rem);
    font-weight: 720;
    letter-spacing: -0.02em;
    margin: 0 0 0.4rem;
  }
  .lede-line {
    color: #9aa0c4;
    max-width: 42rem;
    margin: 0 auto;
  }

  .wing-band {
    display: flex;
    align-items: baseline;
    gap: 0.7rem;
    border-top: 2px solid var(--wc);
    padding-top: 0.6rem;
    margin: 2.8rem 0 0.4rem;
  }
  .wn { font-size: 1.4rem; font-weight: 800; color: var(--wc); }
  .wname { font-size: 1.1rem; font-weight: 720; }
  .wtag { color: #9aa0c4; font-style: italic; font-size: 0.9rem; }

  /* Give each mounted demo a reserved area so the page has scroll height before
     the observers fire (otherwise everything is "near" at once on a short page). */
  .slot {
    margin-top: 1rem;
    min-height: 60vh;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }
  .slot.wide {
    min-height: 40vh;
  }
  .ph {
    color: #6b7099;
    font-size: 0.85rem;
    text-align: center;
    padding: 3rem 0;
  }

  .note-line {
    color: #6b7099;
    font-size: 0.85rem;
    font-style: italic;
    margin: 1.2rem 0 0;
  }
  .tail { height: 30vh; }

  .editorial-section {
    border-top: 1px solid rgba(255, 255, 255, 0.12);
  }
</style>
