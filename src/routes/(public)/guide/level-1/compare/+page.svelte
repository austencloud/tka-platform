<script lang="ts">
  import { onMount } from 'svelte';
  import ArtboardPage from '../_lib/ArtboardPage.svelte';
  import { pages } from '../_lib/page-manifest.ts';
  import { originalArtboards } from '../_lib/original-artboards';

  onMount(() => {
    const splash = document.getElementById('app-loading');
    if (splash) splash.style.display = 'none';
    (window as any).__tkaLoadProgress = () => {};
  });

  let activePage = $state(1);

  function jumpTo(n: number) {
    activePage = n;
    const el = document.getElementById(`compare-${n}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
</script>

<svelte:head>
  <title>Level 1 — Side-by-Side Comparison</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
  <link
    href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500;1,600;1,700&display=swap"
    rel="stylesheet"
  />
</svelte:head>

<div class="compare-shell">
  <aside class="toc">
    <div class="toc-header">
      <strong>Compare</strong>
      <a href="/guide/level-1" class="link">single view ›</a>
    </div>
    <ol class="toc-list">
      {#each pages as p}
        <li>
          <button
            class="toc-item"
            class:active={activePage === p.pageNumber}
            class:svelte={p.kind === 'svelte'}
            onclick={() => jumpTo(p.pageNumber)}
          >
            <span class="num">{p.pageNumber}</span>
            <span class="label">{p.label}</span>
            <span class="kind">{p.kind === 'svelte' ? '✎' : '🖼'}</span>
          </button>
        </li>
      {/each}
    </ol>
    <div class="toc-footer">
      <div>✎ converted to Svelte</div>
      <div>🖼 still showing artboard</div>
    </div>
  </aside>

  <main class="compare">
    <header class="compare-banner">
      <strong>Side-by-side parity check.</strong>
      Left = original PDF artboard. Right = HTML replacement. Pages still showing artboard on right are pending conversion.
    </header>

    {#each pages as p (p.pageNumber)}
      {@const artSrc = originalArtboards[p.pageNumber]}
      <section id="compare-{p.pageNumber}" class="compare-row">
        <header class="row-header">
          <span class="page-num">{p.pageNumber}</span>
          <span class="page-label">{p.label}</span>
          <span class="status" class:converted={p.kind === 'svelte'}>
            {p.kind === 'svelte' ? '✎ Svelte' : '🖼 Artboard (not converted)'}
          </span>
        </header>

        <div class="row-grid">
          <div class="pane original">
            <div class="pane-label">Original PDF</div>
            {#if artSrc}
              <ArtboardPage src={artSrc} pageNumber={p.pageNumber} label="Original page {p.pageNumber}" />
            {:else}
              <div class="missing">No artboard mapped</div>
            {/if}
          </div>

          <div class="pane replacement" class:pending={p.kind === 'artboard'}>
            <div class="pane-label">HTML replacement</div>
            {#if p.kind === 'svelte'}
              <p.component />
            {:else}
              <ArtboardPage src={p.src} pageNumber={p.pageNumber} label="Pending: {p.label}" />
              <div class="pending-overlay">awaiting Svelte conversion</div>
            {/if}
          </div>
        </div>
      </section>
    {/each}
  </main>
</div>

<style>
  :global(body) { background: #0d1117; margin: 0; color: #e6e8ec; }

  .compare-shell {
    display: grid;
    grid-template-columns: 280px 1fr;
    min-height: 100vh;
  }

  .toc {
    position: sticky;
    top: 0;
    align-self: start;
    height: 100vh;
    overflow-y: auto;
    background: #11151c;
    color: #e6e8ec;
    padding: 1rem;
    font-family: system-ui, sans-serif;
    font-size: 0.85rem;
    border-right: 1px solid #1f2530;
  }
  .toc-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    padding: 0.5rem 0.25rem 1rem;
    border-bottom: 1px solid #1f2530;
    margin-bottom: 0.5rem;
  }
  .link { color: #6cb6f0; text-decoration: none; font-size: 0.75rem; }

  .toc-list { list-style: none; padding: 0; margin: 0; }
  .toc-item {
    display: grid;
    grid-template-columns: 28px 1fr 18px;
    gap: 0.5rem;
    align-items: center;
    width: 100%;
    background: transparent;
    color: inherit;
    border: none;
    padding: 0.45rem 0.5rem;
    text-align: left;
    cursor: pointer;
    border-radius: 4px;
    font: inherit;
    line-height: 1.25;
  }
  .toc-item:hover { background: #1c222d; }
  .toc-item.active { background: #2a3344; }
  .toc-item .num { color: #6a7280; font-variant-numeric: tabular-nums; }
  .toc-item .kind { color: #5a6270; font-size: 0.8rem; text-align: right; }
  .toc-item.svelte .kind { color: #6cd97e; }

  .toc-footer {
    margin-top: 1rem;
    padding-top: 0.75rem;
    border-top: 1px solid #1f2530;
    color: #6a7280;
    font-size: 0.72rem;
    line-height: 1.6;
  }

  .compare {
    padding: 1.5rem 1rem 4rem;
    overflow-x: hidden;
  }
  .compare-banner {
    max-width: 1800px;
    margin: 0 auto 2rem;
    padding: 0.85rem 1rem;
    background: #1d2433;
    border: 1px solid #2a3344;
    border-radius: 6px;
    font-family: system-ui, sans-serif;
    font-size: 0.85rem;
    line-height: 1.4;
  }

  .compare-row {
    max-width: 1800px;
    margin: 0 auto 3rem;
    scroll-margin-top: 1rem;
  }
  .row-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.5rem 0.75rem;
    background: #11151c;
    border: 1px solid #1f2530;
    border-radius: 6px 6px 0 0;
    font-family: system-ui, sans-serif;
    font-size: 0.85rem;
  }
  .page-num {
    background: #2a3344;
    color: #d6dae3;
    padding: 0.15rem 0.55rem;
    border-radius: 3px;
    font-variant-numeric: tabular-nums;
  }
  .page-label { color: #cdd1d9; flex: 1; }
  .status { color: #5a6270; font-size: 0.75rem; }
  .status.converted { color: #6cd97e; }

  .row-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
    background: #161b22;
    border: 1px solid #1f2530;
    border-top: none;
    border-radius: 0 0 6px 6px;
    padding: 1rem;
  }

  .pane {
    background: #ececec;
    border-radius: 4px;
    padding: 0.5rem;
    position: relative;
    color: #1a1a1a;
  }
  .pane-label {
    position: absolute;
    top: 0.4rem;
    left: 0.6rem;
    font-family: system-ui, sans-serif;
    font-size: 0.7rem;
    color: #5a6270;
    background: rgba(255,255,255,0.85);
    padding: 0.1rem 0.4rem;
    border-radius: 3px;
    z-index: 5;
  }
  .pane.pending { opacity: 0.92; }
  .pending-overlay {
    position: absolute;
    bottom: 0.5rem;
    right: 0.5rem;
    background: rgba(255, 200, 0, 0.9);
    color: #1a1a1a;
    padding: 0.25rem 0.55rem;
    border-radius: 3px;
    font-family: system-ui, sans-serif;
    font-size: 0.7rem;
    font-weight: 600;
  }

  .missing {
    padding: 4rem 1rem;
    text-align: center;
    color: #888;
    font-family: system-ui, sans-serif;
    font-style: italic;
  }

  /* Pages render at full responsive width within their pane */
  .pane :global(.page),
  .pane :global(.text-page),
  .pane :global(.title-page),
  .pane :global(.artboard-page) {
    width: 100%;
    max-width: 100%;
    margin: 0;
    box-shadow: none;
  }
  .pane :global(.artboard) { width: 100%; height: auto; }

  @media (max-width: 1100px) {
    .compare-shell { grid-template-columns: 1fr; }
    .toc { position: static; height: auto; max-height: 40vh; }
    .row-grid { grid-template-columns: 1fr; }
  }
</style>
