<!--
  AsciiPictographLab.svelte — Lab for iterating on ASCII pictograph rendering.

  Content modes:
  - Single: prev/next through all pictograph variations from CSV
  - Sequence: type a word, generate via spell services, render side by side
  - Arrows: hard-coded test cases for PRO/ANTI/DASH arrow curvature

  View modes:
  - Raw: clean monospace render for character-level iteration (default)
  - CRT: DOS terminal with scanlines and phosphor glow for final look

  Domain: Retro DOS Terminal
-->
<script lang="ts">
  import { AsciiRenderer } from "$lib/features/retro/dos/services/implementations/AsciiRenderer";
  import FilterChipBase from "$lib/features/browse/sequences/filtering/components/inline-filter/FilterChipBase.svelte";
  import { createAsciiLabState } from "./ascii-pictograph-lab-state.svelte";
  import AsciiCrtPreview from "./AsciiCrtPreview.svelte";
  import AsciiRawPreview from "./AsciiRawPreview.svelte";
  import { GridMode } from "$lib/features/retro/shared/domain/pictograph-types";

  const lab = createAsciiLabState();
  const renderer = new AsciiRenderer();

  // ── Single mode rendering ──
  const singleHtml = $derived(
    lab.pictographData
      ? renderer.renderPictograph(lab.pictographData, { layers: lab.layers })
      : renderer.renderPlaceholder(),
  );
  const singleCompact = $derived(
    lab.pictographData ? renderer.renderCompact(lab.pictographData) : "",
  );

  // ── Sequence mode rendering ──
  const sequenceHtml = $derived(
    lab.sequenceSteps.length > 0
      ? renderer.renderSequence(lab.sequenceSteps, { layers: lab.layers })
      : [],
  );

  // ── Arrows mode rendering ──
  const arrowsHtml = $derived(
    renderer.renderSequence(lab.arrowTestCases, { layers: lab.layers }),
  );

  // Pick which lines to show based on mode
  const htmlLines = $derived(
    lab.mode === "arrows" ? arrowsHtml :
    lab.mode === "sequence" ? sequenceHtml :
    singleHtml,
  );
  const compact = $derived(lab.mode === "sequence" || lab.mode === "arrows" ? "" : singleCompact);

  $effect(() => {
    lab.loadData();
  });

  // Auto-regenerate sequence on mount if returning to a saved word
  $effect(() => {
    if (lab.mode === "sequence" && lab.wordInput.trim() && !lab.generating && lab.sequenceSteps.length === 0) {
      lab.generateSequence(lab.wordInput.trim());
    }
  });

  function handleKeydown(e: KeyboardEvent) {
    if (lab.mode !== "single") return;
    if (e.key === "ArrowLeft") { lab.prev(); e.preventDefault(); }
    if (e.key === "ArrowRight") { lab.next(); e.preventDefault(); }
  }

  function handleWordSubmit() {
    if (lab.wordInput.trim()) {
      lab.generateSequence(lab.wordInput.trim());
    }
  }

  function handleWordKeydown(e: KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleWordSubmit();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="ascii-lab">
  <div class="ascii-lab-controls">
    <!-- Mode toggle -->
    <div class="mode-chips">
      <FilterChipBase
        label="Single"
        icon="fas fa-image"
        active={lab.mode === "single"}
        mode="toggle"
        chipColor="#33ff33"
        onclick={() => lab.setMode("single")}
      />
      <FilterChipBase
        label="Sequence"
        icon="fas fa-images"
        active={lab.mode === "sequence"}
        mode="toggle"
        chipColor="#33ff33"
        onclick={() => lab.setMode("sequence")}
      />
      <FilterChipBase
        label="Arrows"
        icon="fas fa-long-arrow-alt-right"
        active={lab.mode === "arrows"}
        mode="toggle"
        chipColor="#33ff33"
        onclick={() => lab.setMode("arrows")}
      />
    </div>

    <!-- Grid mode filter (single mode only) -->
    {#if lab.mode === "single"}
      <div class="mode-chips">
        <FilterChipBase
          label="Diamond"
          icon="fas fa-gem"
          active={lab.gridModeFilter === GridMode.DIAMOND}
          mode="toggle"
          chipColor="#33ff33"
          onclick={() => lab.setGridModeFilter(GridMode.DIAMOND)}
        />
        <FilterChipBase
          label="Box"
          icon="fas fa-square"
          active={lab.gridModeFilter === GridMode.BOX}
          mode="toggle"
          chipColor="#33ff33"
          onclick={() => lab.setGridModeFilter(GridMode.BOX)}
        />
      </div>
    {/if}

    <!-- Single mode: nav bar -->
    {#if lab.mode === "single"}
      <div class="nav-bar">
        <button
          class="nav-btn"
          onclick={() => lab.prev()}
          disabled={lab.loading}
          aria-label="Previous pictograph"
        >
          <i class="fas fa-chevron-left" aria-hidden="true"></i>
        </button>
        <span class="nav-label">{lab.label}</span>
        <button
          class="nav-btn"
          onclick={() => lab.next()}
          disabled={lab.loading}
          aria-label="Next pictograph"
        >
          <i class="fas fa-chevron-right" aria-hidden="true"></i>
        </button>
      </div>
    {/if}

    <!-- Sequence mode: word input -->
    {#if lab.mode === "sequence"}
      <div class="word-input-row">
        <input
          class="word-input"
          type="text"
          placeholder="Type a word..."
          bind:value={lab.wordInput}
          onkeydown={handleWordKeydown}
          disabled={lab.generating}
          maxlength={12}
        />
        <button
          class="generate-btn"
          onclick={handleWordSubmit}
          disabled={lab.generating || !lab.wordInput.trim()}
        >
          {#if lab.generating}
            Generating...
          {:else}
            Generate
          {/if}
        </button>
      </div>
      {#if lab.sequenceWord}
        <span class="sequence-info">
          {lab.sequenceWord}
          {#if lab.sequenceExpanded !== lab.sequenceWord}
            &rarr; {lab.sequenceExpanded}
          {/if}
          &middot; {lab.sequenceSteps.length} beats
        </span>
      {/if}
    {/if}

    <!-- View mode: Raw vs CRT -->
    <div class="mode-chips">
      <FilterChipBase
        label="Raw"
        icon="fas fa-font"
        active={lab.viewMode === "raw"}
        mode="toggle"
        chipColor="#ff9800"
        onclick={() => lab.setViewMode("raw")}
      />
      <FilterChipBase
        label="CRT"
        icon="fas fa-tv"
        active={lab.viewMode === "crt"}
        mode="toggle"
        chipColor="#ff9800"
        onclick={() => lab.setViewMode("crt")}
      />
    </div>

    <!-- Layer toggles (both modes) -->
    <div class="layer-chips">
      <FilterChipBase
        label="Grid"
        icon="fas fa-border-all"
        active={lab.layers.grid}
        mode="toggle"
        chipColor="#33ff33"
        onclick={() => lab.toggleLayer("grid")}
      />
      <FilterChipBase
        label="Hands"
        icon="fas fa-hand-paper"
        active={lab.layers.hands}
        mode="toggle"
        chipColor="#33ff33"
        onclick={() => lab.toggleLayer("hands")}
      />
      <FilterChipBase
        label="Staves"
        icon="fas fa-grip-lines-vertical"
        active={lab.layers.staves}
        mode="toggle"
        chipColor="#33ff33"
        onclick={() => lab.toggleLayer("staves")}
      />
      <FilterChipBase
        label="Arrows"
        icon="fas fa-arrows-alt"
        active={lab.layers.arrows}
        mode="toggle"
        chipColor="#33ff33"
        onclick={() => lab.toggleLayer("arrows")}
      />
    </div>
  </div>

  {#if lab.loading}
    <div class="lab-status">Loading pictograph data...</div>
  {:else if lab.error}
    <div class="lab-status lab-error">{lab.error}</div>
  {:else if lab.mode === "sequence" && !lab.sequenceWord}
    <div class="lab-status">Type a word above and hit Generate</div>
  {:else}
    <div class="ascii-lab-preview">
      {#if lab.viewMode === "crt"}
        <AsciiCrtPreview {htmlLines} {compact} />
      {:else}
        <AsciiRawPreview {htmlLines} {compact} />
      {/if}
    </div>
  {/if}
</div>

<style>
  .ascii-lab {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: 1rem;
    gap: 1rem;
    color: var(--theme-text, #fff);
  }

  .ascii-lab-controls {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  /* ── Mode & Layer chips ── */

  .mode-chips,
  .layer-chips {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    justify-content: center;
  }

  /* ── Single mode nav ── */

  .nav-bar {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    justify-content: center;
  }

  .nav-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 50%;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-min, 14px);
    cursor: pointer;
    transition:
      border-color var(--duration-fast, 150ms) ease,
      color var(--duration-fast, 150ms) ease,
      transform var(--duration-fast, 150ms) ease;
  }

  @media (hover: hover) {
    .nav-btn:not(:disabled):hover {
      border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
      color: var(--theme-text, #fff);
    }
  }

  .nav-btn:not(:disabled):active {
    transform: scale(0.93);
  }

  .nav-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .nav-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #33ff33);
    outline-offset: 2px;
  }

  .nav-label {
    font-size: var(--font-size-min, 14px);
    font-weight: 500;
    color: var(--theme-text, #fff);
    font-family: "SF Mono", "Fira Code", "Courier New", monospace;
    min-width: 200px;
    text-align: center;
    letter-spacing: 0.5px;
  }

  /* ── Sequence mode input ── */

  .word-input-row {
    display: flex;
    gap: 8px;
    justify-content: center;
    align-items: center;
  }

  .word-input {
    padding: 8px 14px;
    min-height: 40px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 100px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text, #fff);
    font-size: var(--font-size-min, 14px);
    font-family: "SF Mono", "Fira Code", "Courier New", monospace;
    letter-spacing: 2px;
    text-transform: uppercase;
    text-align: center;
    width: 200px;
    transition: border-color var(--duration-fast, 150ms) ease;
  }

  .word-input::placeholder {
    text-transform: none;
    letter-spacing: normal;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.3));
  }

  .word-input:focus {
    outline: none;
    border-color: #33ff33;
  }

  .word-input:disabled {
    opacity: 0.4;
  }

  .generate-btn {
    padding: 8px 18px;
    min-height: 40px;
    border: 1px solid color-mix(in srgb, #33ff33 40%, transparent);
    border-radius: 100px;
    background: color-mix(in srgb, #33ff33 12%, transparent);
    color: #33ff33;
    font-size: var(--font-size-min, 14px);
    font-weight: 500;
    cursor: pointer;
    white-space: nowrap;
    transition:
      background var(--duration-fast, 150ms) ease,
      border-color var(--duration-fast, 150ms) ease,
      transform var(--duration-fast, 150ms) ease;
  }

  @media (hover: hover) {
    .generate-btn:not(:disabled):hover {
      background: color-mix(in srgb, #33ff33 20%, transparent);
      border-color: color-mix(in srgb, #33ff33 60%, transparent);
    }
  }

  .generate-btn:not(:disabled):active {
    transform: scale(0.97);
  }

  .generate-btn:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }

  .generate-btn:focus-visible {
    outline: 2px solid #33ff33;
    outline-offset: 2px;
  }

  .sequence-info {
    text-align: center;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-family: "SF Mono", "Fira Code", "Courier New", monospace;
  }

  /* ── Status ── */

  .lab-status {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 1;
    font-size: var(--font-size-min, 14px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
  }

  .lab-error {
    color: var(--semantic-error, #ef4444);
  }

  /* ── Preview ── */

  .ascii-lab-preview {
    flex: 1;
    min-height: 0;
    overflow-x: auto;
  }

  @media (prefers-reduced-motion: reduce) {
    .nav-btn,
    .generate-btn,
    .word-input {
      transition: none;
    }
  }
</style>
