<!--
  PictographHistoryLab.svelte — Browse TKA pictographs rendered across 10 historical eras.

  Each era is a self-contained canvas renderer in static/retro-eras/.
  Cave painting, Egyptian, Greek mosaic, medieval manuscript, Renaissance,
  Japanese woodblock, blueprint, Art Deco, Bauhaus, line printer.

  Domain: Retro Labs
-->
<script lang="ts">
  const ERAS = [
    { id: 'cave', file: 'cave-painting.html', year: '~40,000 BC', title: 'Cave Painting', color: '#C17F3A' },
    { id: 'egypt', file: 'egyptian.html', year: '~3000 BC', title: 'Egyptian Hieroglyph', color: '#C5A54E' },
    { id: 'mosaic', file: 'greek-mosaic.html', year: '~500 BC', title: 'Greek Mosaic', color: '#7BA089' },
    { id: 'medieval', file: 'medieval.html', year: '~1200 AD', title: 'Illuminated Manuscript', color: '#D4AF37' },
    { id: 'renaissance', file: 'renaissance.html', year: '~1500 AD', title: 'Renaissance Diagram', color: '#8B7355' },
    { id: 'woodblock', file: 'woodblock.html', year: '~1800 AD', title: 'Japanese Woodblock', color: '#D14836' },
    { id: 'blueprint', file: 'blueprint.html', year: '~1850 AD', title: 'Technical Blueprint', color: '#4A90D9' },
    { id: 'deco', file: 'art-deco.html', year: '~1925 AD', title: 'Art Deco', color: '#D4AF37' },
    { id: 'bauhaus', file: 'bauhaus.html', year: '~1930 AD', title: 'Bauhaus', color: '#E63B2E' },
    { id: 'punch', file: 'punch-card.html', year: '~1976 AD', title: 'Line Printer', color: '#33AA55' },
  ] as const;

  let currentIndex = $state(0);
  let viewMode = $state<'gallery' | 'detail'>('gallery');

  const currentEra = $derived(ERAS[currentIndex]!);

  function selectEra(index: number) {
    currentIndex = index;
    viewMode = 'detail';
  }

  function navigate(dir: number) {
    currentIndex = (currentIndex + dir + ERAS.length) % ERAS.length;
  }

  function backToGallery() {
    viewMode = 'gallery';
  }

  function handleKeydown(e: KeyboardEvent) {
    if (viewMode === 'detail') {
      if (e.key === 'ArrowLeft') { navigate(-1); e.preventDefault(); }
      if (e.key === 'ArrowRight') { navigate(1); e.preventDefault(); }
      if (e.key === 'Escape') { backToGallery(); e.preventDefault(); }
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="history-lab">
  {#if viewMode === 'gallery'}
    <!-- Gallery grid -->
    <div class="gallery-header">
      <h2>Pictograph Through the Ages</h2>
      <p class="subtitle">The same notation across 40,000 years. Click any era to inspect.</p>
    </div>
    <div class="gallery-grid">
      {#each ERAS as era, i}
        <button class="era-card" onclick={() => selectEra(i)}>
          <div class="era-frame">
            <iframe
              src="/retro-eras/{era.file}?embed=1"
              title="{era.title}"
              loading="lazy"
            ></iframe>
          </div>
          <div class="era-label" style="color: {era.color}">
            <span class="era-year">{era.year}</span>
            <span class="era-title">{era.title}</span>
          </div>
        </button>
      {/each}
    </div>

  {:else}
    <!-- Detail view -->
    <div class="detail-view">
      <div class="detail-toolbar">
        <button class="back-btn" onclick={backToGallery}>
          <i class="fas fa-arrow-left" aria-hidden="true"></i>
          Gallery
        </button>
        <div class="detail-nav">
          <button class="nav-btn" onclick={() => navigate(-1)} aria-label="Previous era">
            <i class="fas fa-chevron-left" aria-hidden="true"></i>
          </button>
          <span class="nav-label" style="color: {currentEra.color}">
            {currentEra.year} — {currentEra.title}
          </span>
          <button class="nav-btn" onclick={() => navigate(1)} aria-label="Next era">
            <i class="fas fa-chevron-right" aria-hidden="true"></i>
          </button>
        </div>
        <div class="nav-hint">
          <kbd>&larr;</kbd> <kbd>&rarr;</kbd> navigate &middot; <kbd>Esc</kbd> gallery
        </div>
      </div>

      <div class="detail-content">
        {#key currentEra.id}
          <iframe
            class="detail-frame"
            src="/retro-eras/{currentEra.file}"
            title="{currentEra.title}"
          ></iframe>
        {/key}
      </div>
    </div>
  {/if}
</div>

<style>
  .history-lab {
    display: flex;
    flex-direction: column;
    height: 100%;
    color: var(--theme-text, #fff);
  }

  /* ── Gallery View ── */

  .gallery-header {
    text-align: center;
    padding: 12px 16px 8px;
    flex-shrink: 0;
  }
  .gallery-header h2 {
    font-size: 18px;
    font-weight: 300;
    letter-spacing: 3px;
    text-transform: uppercase;
    color: var(--theme-text, #fff);
    margin-bottom: 4px;
  }
  .subtitle {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
  }

  .gallery-grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    grid-template-rows: 1fr 1fr;
    gap: 8px;
    padding: 8px 12px;
    flex: 1;
    min-height: 0;
  }

  .era-card {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 8px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    min-height: 0;
    cursor: pointer;
    padding: 0;
    color: inherit;
    font: inherit;
    transition: border-color var(--duration-fast, 150ms) ease;
  }

  @media (hover: hover) {
    .era-card:hover {
      border-color: rgba(255, 255, 255, 0.2);
    }
  }

  .era-frame {
    flex: 1;
    min-height: 0;
    overflow: hidden;
    position: relative;
  }
  .era-frame iframe {
    width: 100%;
    height: 100%;
    border: none;
    pointer-events: none;
    display: block;
  }

  .era-label {
    padding: 4px 8px;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
    display: flex;
    flex-direction: column;
    gap: 1px;
    flex-shrink: 0;
  }
  .era-year {
    font-size: 8px;
    font-weight: 700;
    letter-spacing: 2px;
    text-transform: uppercase;
  }
  .era-title {
    font-size: 11px;
    font-weight: 500;
    color: var(--theme-text, #fff);
  }

  /* ── Detail View ── */

  .detail-view {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .detail-toolbar {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 12px;
    flex-shrink: 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  .back-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    background: none;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-compact, 12px);
    padding: 5px 10px;
    cursor: pointer;
    transition: color var(--duration-fast, 150ms) ease, border-color var(--duration-fast, 150ms) ease;
  }
  @media (hover: hover) {
    .back-btn:hover {
      color: var(--theme-text, #fff);
      border-color: rgba(255, 255, 255, 0.2);
    }
  }

  .detail-nav {
    display: flex;
    align-items: center;
    gap: 10px;
    flex: 1;
    justify-content: center;
  }

  .nav-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 50%;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: 12px;
    cursor: pointer;
    transition: border-color var(--duration-fast, 150ms) ease, color var(--duration-fast, 150ms) ease;
  }
  @media (hover: hover) {
    .nav-btn:hover {
      border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
      color: var(--theme-text, #fff);
    }
  }

  .nav-label {
    font-size: var(--font-size-min, 14px);
    font-weight: 500;
    letter-spacing: 1px;
    min-width: 200px;
    text-align: center;
  }

  .nav-hint {
    font-size: 10px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.3));
    flex-shrink: 0;
  }
  .nav-hint kbd {
    display: inline-block;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 3px;
    padding: 0 4px;
    font-size: 10px;
    font-family: "SF Mono", "Fira Code", monospace;
  }

  .detail-content {
    flex: 1;
    min-height: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 12px;
  }

  .detail-frame {
    width: 100%;
    height: 100%;
    max-width: 800px;
    max-height: 800px;
    aspect-ratio: 1;
    border: none;
    border-radius: 8px;
    background: #111;
  }

  @media (prefers-reduced-motion: reduce) {
    .era-card, .back-btn, .nav-btn {
      transition: none;
    }
  }
</style>
