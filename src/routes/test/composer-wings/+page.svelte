<script lang="ts">
  // Test harness for the composer-page "five wings" rework. Mounts the REAL
  // section components (built to reuse existing primitives) so the layout can
  // be evaluated with actual rendered content, not a wireframe. Not shipping to
  // /composer yet.
  //
  // 4K composition: this page adopts the shared public-editorial width system
  // (.editorial + .has-duo / .breakout.cinema / .breakout.wide). Prose keeps the
  // readable essay measure; the live demos break OUT of it and fill the canvas.
  // The big-screen tier engages at 1680px CSS (a 4K monitor at Windows 200%
  // reports ~1904 CSS px — a 2200 query never fires; see the composer-4k spec).
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
    connect: () => import("./_sections/ConnectSection.svelte"),
    library: () => import("./_sections/LibrarySection.svelte"),
  };

  // Component refs, filled once each slot scrolls near.
  const comp = $state<Record<string, Component | null>>({
    construct: null,
    generate: null,
    mandala: null,
    games: null,
    connect: null,
    library: null,
  });

  function whenNear(node: HTMLElement, key: string) {
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          const loader = loaders[key];
          if (loader) void loader().then((m) => (comp[key] = m.default));
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
  <div class="editorial">
    <header class="test-head">
      <p class="eyebrow">Test harness · not the live /composer page</p>
      <h1>Composer page — five wings, real components</h1>
      <p class="lede-line">
        Each section mounts the actual primitives and breaks out of the reading column to fill the
        canvas. Scroll to load them.
      </p>
    </header>

    <!-- WING 1: CREATE -->
    <div class="wing-band" style="--wc:#8b8cff">
      <span class="wn">①</span><span class="wname">Create</span>
      <span class="wtag">make it</span>
    </div>

    <!-- Construct: prose in the column, the live picker as a wide centered stage. -->
    <section class="editorial-section" style="--accent:#8b8cff">
      <span class="section-kicker">Construct</span>
      <h2 class="section-title">Build it step by step</h2>
      <div class="prose"><p>Pick a starting position, then tap the valid next steps and watch the sequence grow.</p></div>
      <div class="breakout wide slot" use:whenNear={"construct"}>
        {#if comp.construct}
          {@const Section = comp.construct}
          <Section />
        {:else}
          <div class="ph">loading on scroll…</div>
        {/if}
      </div>
    </section>

    <!-- Generate: stacked below 1680, prose|demo split on 4K (duo-uw + duo-max). -->
    <section class="editorial-section has-duo duo-uw duo-max" style="--accent:#ec4899">
      <div class="section-duo">
        <div class="duo-copy">
          <span class="section-kicker">Generate</span>
          <h2 class="section-title">Or skip the building</h2>
          <div class="prose"><p>Set a few parameters, hit generate, watch the result. No mandala here anymore.</p></div>
        </div>
        <div class="duo-demo slot" use:whenNear={"generate"}>
          {#if comp.generate}
            {@const Section = comp.generate}
            <Section />
          {:else}
            <div class="ph">loading on scroll…</div>
          {/if}
        </div>
      </div>
    </section>

    <!-- WING 2: OUTPUTS -->
    <div class="wing-band" style="--wc:#ec6ba8">
      <span class="wn">②</span><span class="wname">Outputs</span>
      <span class="wtag">what it becomes</span>
    </div>

    <!-- Mandala: the star. Prose in the column, the Shape Matrix + chosen wall
         break out to a full cinema band. -->
    <section class="editorial-section" style="--accent:#ec6ba8">
      <span class="section-kicker">Mandala</span>
      <h2 class="section-title">The shape decides the mandala</h2>
      <div class="prose"><p>A mandala is the path a sequence traces. Change the movement and the shape changes with it, and the Kinetic Alphabet reaches shapes older systems couldn't hold.</p></div>
      <div class="breakout cinema slot" use:whenNear={"mandala"}>
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

    <!-- Games: the arcade strip as a wide grid band. -->
    <section class="editorial-section" style="--accent:#f0a83c">
      <span class="section-kicker">Play</span>
      <h2 class="section-title">A whole arcade, not one game</h2>
      <div class="prose"><p>The arcade's own animated preview tiles. The four that need no alphabet knowledge lead.</p></div>
      <div class="breakout wide slot" use:whenNear={"games"}>
        {#if comp.games}
          {@const Section = comp.games}
          <Section />
        {:else}
          <div class="ph">loading on scroll…</div>
        {/if}
      </div>
    </section>

    <p class="note-line">Guide tease (cover emblem + spine) and Practice tease (tempo-ramp cockpit) come next in this wing.</p>

    <!-- WING 4: CONNECT -->
    <div class="wing-band" style="--wc:#35c7d6">
      <span class="wn">④</span><span class="wname">Connect</span>
      <span class="wtag">share it</span>
    </div>

    <section class="editorial-section" style="--accent:#35c7d6">
      <span class="section-kicker">Follow</span>
      <h2 class="section-title">Follow the flow you like</h2>
      <div class="prose"><p>Follow the people whose flow you like. Their new sequences surface when you come back — a set of creators worth watching, not a feed to scroll.</p></div>
      <div class="breakout wide slot" use:whenNear={"connect"}>
        {#if comp.connect}
          {@const Section = comp.connect}
          <Section />
        {:else}
          <div class="ph">loading on scroll…</div>
        {/if}
      </div>
    </section>

    <!-- WING 5: LIBRARY & BROWSE -->
    <div class="wing-band" style="--wc:#5bd6a8">
      <span class="wn">⑤</span><span class="wname">Library &amp; Browse</span>
      <span class="wtag">find it</span>
    </div>

    <section class="editorial-section" style="--accent:#5bd6a8">
      <span class="section-kicker">Browse</span>
      <h2 class="section-title">Everyone's sequences, yours to collect</h2>
      <div class="prose"><p>Browse everything the community has shared, filter it down, and drop what you like into a collection. Smart Collections fill themselves from a rule you set once.</p></div>
      <div class="breakout wide slot" use:whenNear={"library"}>
        {#if comp.library}
          {@const Section = comp.library}
          <Section />
        {:else}
          <div class="ph">loading on scroll…</div>
        {/if}
      </div>
    </section>

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

  /* Header keeps the harness voice; it rides inside the .editorial reading column. */
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

  /* Demo cell inside a duo centers its content vertically. */
  .duo-demo.slot {
    display: flex;
    flex-direction: column;
    justify-content: center;
  }
  /* Reserve scroll height on the PLACEHOLDER only, so the observers don't all
     fire at once before load — once a section mounts, the slot sizes to its
     content and leaves no dead gap under short sections. */
  .ph {
    min-height: 42vh;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #6b7099;
    font-size: 0.85rem;
    text-align: center;
  }

  .note-line {
    color: #6b7099;
    font-size: 0.85rem;
    font-style: italic;
    margin: 1.2rem 0 0;
  }
  .tail { height: 30vh; }
</style>
