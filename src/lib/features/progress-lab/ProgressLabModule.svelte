<!--
  ProgressLabModule.svelte - Interactive comparison lab for loading indicator styles.

  5 demo sections, each with variant toggles and a play button to simulate loading.
  Global controls: speed multiplier and reduced-motion override.
-->
<script lang="ts">
  import IndeterminateBar from "$lib/shared/components/loading/IndeterminateBar.svelte";
  import ProgressBar from "$lib/shared/components/loading/ProgressBar.svelte";
  import ProgressRing from "$lib/shared/components/loading/ProgressRing.svelte";
  import ShimmerBlock from "$lib/shared/components/loading/ShimmerBlock.svelte";
  import StepProgress from "$lib/shared/components/loading/StepProgress.svelte";
  import LoadingGate from "$lib/shared/components/loading/LoadingGate.svelte";

  // ---------------------------------------------------------------------------
  // Global controls
  // ---------------------------------------------------------------------------

  let speed: number = $state(1);
  let reducedMotion: boolean = $state(false);

  // ---------------------------------------------------------------------------
  // Section 1 - Full-Page Gate
  // ---------------------------------------------------------------------------

  type GateVariant = "bar" | "card" | "skeleton";
  let gateVariant: GateVariant = $state("bar");
  let gateActive: boolean = $state(false);
  let gateTimer: ReturnType<typeof setTimeout> | null = $state(null);

  function playGate() {
    if (gateActive) return;
    gateActive = true;
    gateTimer = setTimeout(() => {
      gateActive = false;
      gateTimer = null;
    }, 3000 / speed);
  }

  // ---------------------------------------------------------------------------
  // Section 2 - Panel Loading
  // ---------------------------------------------------------------------------

  type PanelVariant = "skeleton" | "bar" | "dots";
  let panelVariant: PanelVariant = $state("skeleton");
  let panelActive: boolean = $state(false);
  let panelTimer: ReturnType<typeof setTimeout> | null = $state(null);

  function playPanel() {
    if (panelActive) return;
    panelActive = true;
    panelTimer = setTimeout(() => {
      panelActive = false;
      panelTimer = null;
    }, 3000 / speed);
  }

  // ---------------------------------------------------------------------------
  // Section 3 - Deterministic Progress
  // ---------------------------------------------------------------------------

  type ProgressVariant = "bar-count" | "ring-percent" | "steps-bar";
  let progressVariant: ProgressVariant = $state("bar-count");
  let progressPercent: number = $state(0);
  let progressActive: boolean = $state(false);
  let progressInterval: ReturnType<typeof setInterval> | null = $state(null);

  const demoSteps = [
    { label: "Rendering thumbnail" },
    { label: "Uploading image" },
    { label: "Tagging sequence" },
    { label: "Saving metadata" },
  ];

  const progressStep = $derived(Math.min(Math.ceil(progressPercent / 25), 4));

  function playProgress() {
    if (progressActive) return;
    progressActive = true;
    progressPercent = 0;
    progressInterval = setInterval(() => {
      progressPercent += 2;
      if (progressPercent >= 100) {
        progressPercent = 100;
        if (progressInterval) clearInterval(progressInterval);
        progressInterval = null;
        progressActive = false;
      }
    }, 60 / speed);
  }

  // ---------------------------------------------------------------------------
  // Section 4 - Grid Cells
  // ---------------------------------------------------------------------------

  type GridVariant = "shimmer" | "stagger" | "micro-ring";
  let gridVariant: GridVariant = $state("shimmer");
  let gridLoaded: boolean[] = $state(Array(8).fill(false));
  let gridActive: boolean = $state(false);
  let gridTimer: ReturnType<typeof setTimeout> | null = $state(null);

  function playGrid() {
    if (gridActive) return;
    gridActive = true;
    gridLoaded = Array(8).fill(false);

    for (let i = 0; i < 8; i++) {
      setTimeout(() => {
        gridLoaded[i] = true;
        if (i === 7) {
          gridActive = false;
          gridTimer = null;
        }
      }, (i + 1) * (400 / speed));
    }
  }

  // ---------------------------------------------------------------------------
  // Section 5 - Button Actions
  // ---------------------------------------------------------------------------

  type ButtonVariant = "spinner" | "morph" | "fill";
  let buttonVariant: ButtonVariant = $state("spinner");
  let buttonPercent: number = $state(0);
  let buttonActive: boolean = $state(false);
  let buttonInterval: ReturnType<typeof setInterval> | null = $state(null);

  function playButton() {
    if (buttonActive) return;
    buttonActive = true;
    buttonPercent = 0;
    buttonInterval = setInterval(() => {
      buttonPercent += 4;
      if (buttonPercent >= 100) {
        buttonPercent = 100;
        if (buttonInterval) clearInterval(buttonInterval);
        buttonInterval = null;
        buttonActive = false;
      }
    }, 80 / speed);
  }

  // ---------------------------------------------------------------------------
  // Cleanup on destroy
  // ---------------------------------------------------------------------------

  $effect(() => {
    return () => {
      if (gateTimer) clearTimeout(gateTimer);
      if (panelTimer) clearTimeout(panelTimer);
      if (progressInterval) clearInterval(progressInterval);
      if (buttonInterval) clearInterval(buttonInterval);
    };
  });
</script>

<div class="progress-lab" class:reduced-motion={reducedMotion}>
  <!-- Global controls -->
  <div class="global-controls">
    <div class="speed-selector">
      <span class="control-label">Speed</span>
      <button
        class="speed-btn"
        class:active={speed === 0.5}
        onclick={() => (speed = 0.5)}
      >0.5x</button>
      <button
        class="speed-btn"
        class:active={speed === 1}
        onclick={() => (speed = 1)}
      >1x</button>
      <button
        class="speed-btn"
        class:active={speed === 2}
        onclick={() => (speed = 2)}
      >2x</button>
    </div>

    <label class="motion-toggle">
      <input type="checkbox" bind:checked={reducedMotion} />
      <span class="control-label">Reduced motion</span>
    </label>
  </div>

  <!-- Section 1: Full-Page Gate -->
  <section class="demo-section">
    <div class="section-header">
      <div class="header-text">
        <h3>Full-Page Gate</h3>
        <p class="subtitle">Route loading screens (/p/[code], /sequence/[id], domain detection)</p>
      </div>
    </div>

    <div class="controls-row">
      <div class="variant-selector">
        <button class="variant-btn" class:active={gateVariant === "bar"} onclick={() => (gateVariant = "bar")}>A: Top Bar</button>
        <button class="variant-btn" class:active={gateVariant === "card"} onclick={() => (gateVariant = "card")}>B: Card + Ring</button>
        <button class="variant-btn" class:active={gateVariant === "skeleton"} onclick={() => (gateVariant = "skeleton")}>C: Skeleton</button>
      </div>
      <button class="play-btn" onclick={playGate} disabled={gateActive}>
        <i class="fas fa-play"></i> Play
      </button>
    </div>

    <div class="demo-viewport gate-viewport">
      {#if gateActive}
        <LoadingGate variant={gateVariant} message="Loading sequence..." />
      {:else}
        <div class="placeholder-content">
          <i class="fas fa-check-circle"></i>
          <span>Content loaded</span>
        </div>
      {/if}
    </div>
  </section>

  <!-- Section 2: Panel Loading -->
  <section class="demo-section">
    <div class="section-header">
      <div class="header-text">
        <h3>Panel Loading</h3>
        <p class="subtitle">Browse, collections, challenges panel content</p>
      </div>
    </div>

    <div class="controls-row">
      <div class="variant-selector">
        <button class="variant-btn" class:active={panelVariant === "skeleton"} onclick={() => (panelVariant = "skeleton")}>A: Skeleton</button>
        <button class="variant-btn" class:active={panelVariant === "bar"} onclick={() => (panelVariant = "bar")}>B: Bar + Text</button>
        <button class="variant-btn" class:active={panelVariant === "dots"} onclick={() => (panelVariant = "dots")}>C: Pulse Dots</button>
      </div>
      <button class="play-btn" onclick={playPanel} disabled={panelActive}>
        <i class="fas fa-play"></i> Play
      </button>
    </div>

    <div class="demo-viewport panel-viewport">
      {#if panelActive}
        {#if panelVariant === "skeleton"}
          <div class="skeleton-list">
            {#each [0, 1, 2, 3] as i}
              <div class="skeleton-list-item" style:animation-delay="{i * 100}ms">
                <ShimmerBlock circle height="40px" delay={i * 100} />
                <div class="skeleton-text-group">
                  <ShimmerBlock width="70%" height="14px" delay={i * 100 + 50} />
                  <ShimmerBlock width="45%" height="12px" delay={i * 100 + 100} />
                </div>
              </div>
            {/each}
          </div>
        {:else if panelVariant === "bar"}
          <div class="bar-text-layout">
            <IndeterminateBar />
            <span class="loading-label">Loading creators...</span>
          </div>
        {:else if panelVariant === "dots"}
          <div class="dots-layout">
            <div class="pulse-dots">
              <span class="dot" style:animation-delay="0ms"></span>
              <span class="dot" style:animation-delay="150ms"></span>
              <span class="dot" style:animation-delay="300ms"></span>
            </div>
            <span class="loading-label">Loading creators...</span>
          </div>
        {/if}
      {:else}
        <div class="placeholder-content">
          <i class="fas fa-check-circle"></i>
          <span>Panel loaded</span>
        </div>
      {/if}
    </div>
  </section>

  <!-- Section 3: Deterministic Progress -->
  <section class="demo-section">
    <div class="section-header">
      <div class="header-text">
        <h3>Deterministic Progress</h3>
        <p class="subtitle">Multi-step save, batch operations, thumbnail rendering</p>
      </div>
    </div>

    <div class="controls-row">
      <div class="variant-selector">
        <button class="variant-btn" class:active={progressVariant === "bar-count"} onclick={() => (progressVariant = "bar-count")}>A: Bar + Count</button>
        <button class="variant-btn" class:active={progressVariant === "ring-percent"} onclick={() => (progressVariant = "ring-percent")}>B: Ring + %</button>
        <button class="variant-btn" class:active={progressVariant === "steps-bar"} onclick={() => (progressVariant = "steps-bar")}>C: Steps + Bar</button>
      </div>
      <button class="play-btn" onclick={playProgress} disabled={progressActive}>
        <i class="fas fa-play"></i> Play
      </button>
    </div>

    <div class="demo-viewport progress-viewport">
      {#if progressActive || progressPercent > 0}
        <div class="progress-demo-content">
          {#if progressVariant === "bar-count"}
            <ProgressBar
              percent={progressPercent}
              showPercent
              label="{progressStep} / 4 steps"
              height={8}
            />
          {:else if progressVariant === "ring-percent"}
            <ProgressRing
              percent={progressPercent}
              size={80}
              strokeWidth={6}
              label="{Math.round(progressPercent)}%"
            />
          {:else if progressVariant === "steps-bar"}
            <StepProgress steps={demoSteps} currentStep={progressStep} />
            <div class="steps-bar-spacer"></div>
            <ProgressBar percent={progressPercent} height={4} />
          {/if}
        </div>
      {:else}
        <div class="placeholder-content">
          <i class="fas fa-check-circle"></i>
          <span>Operation complete</span>
        </div>
      {/if}
    </div>
  </section>

  <!-- Section 4: Grid Cells -->
  <section class="demo-section">
    <div class="section-header">
      <div class="header-text">
        <h3>Grid Cell Loading</h3>
        <p class="subtitle">LayeredSequencePreview pictograph cells loading one by one</p>
      </div>
    </div>

    <div class="controls-row">
      <div class="variant-selector">
        <button class="variant-btn" class:active={gridVariant === "shimmer"} onclick={() => (gridVariant = "shimmer")}>A: Shimmer</button>
        <button class="variant-btn" class:active={gridVariant === "stagger"} onclick={() => (gridVariant = "stagger")}>B: Stagger Fade</button>
        <button class="variant-btn" class:active={gridVariant === "micro-ring"} onclick={() => (gridVariant = "micro-ring")}>C: Micro Ring</button>
      </div>
      <button class="play-btn" onclick={playGrid} disabled={gridActive}>
        <i class="fas fa-play"></i> Play
      </button>
    </div>

    <div class="demo-viewport grid-viewport">
      <div class="cell-grid">
        {#each gridLoaded as loaded, i}
          <div class="grid-cell" class:loaded>
            {#if loaded}
              <span class="cell-number">{i + 1}</span>
            {:else if gridActive}
              {#if gridVariant === "shimmer"}
                <ShimmerBlock width="100%" height="100%" borderRadius="8px" />
              {:else if gridVariant === "stagger"}
                <div class="stagger-placeholder"></div>
              {:else if gridVariant === "micro-ring"}
                <ProgressRing percent={-1} size={20} strokeWidth={2} />
              {/if}
            {:else}
              <div class="cell-idle"></div>
            {/if}
          </div>
        {/each}
      </div>
    </div>
  </section>

  <!-- Section 5: Button Actions -->
  <section class="demo-section">
    <div class="section-header">
      <div class="header-text">
        <h3>Button Actions</h3>
        <p class="subtitle">Spell generation, export, async operations</p>
      </div>
    </div>

    <div class="controls-row">
      <div class="variant-selector">
        <button class="variant-btn" class:active={buttonVariant === "spinner"} onclick={() => (buttonVariant = "spinner")}>A: Spinner</button>
        <button class="variant-btn" class:active={buttonVariant === "morph"} onclick={() => (buttonVariant = "morph")}>B: Morph Bar</button>
        <button class="variant-btn" class:active={buttonVariant === "fill"} onclick={() => (buttonVariant = "fill")}>C: Fill Sweep</button>
      </div>
      <button class="play-btn" onclick={playButton} disabled={buttonActive}>
        <i class="fas fa-play"></i> Play
      </button>
    </div>

    <div class="demo-viewport button-viewport">
      {#if buttonVariant === "spinner"}
        <button class="action-btn" disabled={buttonActive}>
          {#if buttonActive}
            <i class="fas fa-circle-notch fa-spin"></i>
            <span>Generating...</span>
          {:else}
            <i class="fas fa-wand-magic-sparkles"></i>
            <span>Generate</span>
          {/if}
        </button>

      {:else if buttonVariant === "morph"}
        {#if buttonActive}
          <div class="morph-bar-wrapper">
            <ProgressBar percent={buttonPercent} height={40} showPercent />
          </div>
        {:else}
          <button class="action-btn">
            <i class="fas fa-wand-magic-sparkles"></i>
            <span>Generate</span>
          </button>
        {/if}

      {:else if buttonVariant === "fill"}
        <button class="action-btn fill-btn" disabled={buttonActive}>
          {#if buttonActive}
            <div class="fill-overlay" style:width="{buttonPercent}%"></div>
            <span class="fill-label">Generating...</span>
          {:else}
            <i class="fas fa-wand-magic-sparkles"></i>
            <span>Generate</span>
          {/if}
        </button>
      {/if}
    </div>
  </section>
</div>

<style>
  /* =========================================================================
     Layout
     ========================================================================= */

  .progress-lab {
    display: flex;
    flex-direction: column;
    gap: 24px;
    padding: 20px;
    overflow-y: auto;
    height: 100%;
  }

  /* Reduced motion override applied via parent class */
  .progress-lab.reduced-motion :global(*) {
    animation-duration: 0s !important;
    transition-duration: 0s !important;
  }

  /* =========================================================================
     Global Controls
     ========================================================================= */

  .global-controls {
    display: flex;
    align-items: center;
    gap: 20px;
    flex-wrap: wrap;
    padding: 12px 16px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 12px;
  }

  .speed-selector {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .control-label {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    margin-right: 4px;
  }

  .speed-btn {
    padding: 4px 10px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 999px;
    background: transparent;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-compact, 12px);
    cursor: pointer;
    transition: background var(--duration-fast, 150ms), color var(--duration-fast, 150ms);
  }

  .speed-btn.active {
    background: var(--theme-accent, #6366f1);
    color: #fff;
    border-color: var(--theme-accent, #6366f1);
  }

  .motion-toggle {
    display: flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    user-select: none;
  }

  .motion-toggle input {
    accent-color: var(--theme-accent, #6366f1);
  }

  /* =========================================================================
     Demo Sections
     ========================================================================= */

  .demo-section {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .section-header {
    display: flex;
    align-items: baseline;
    gap: 8px;
  }

  .header-text h3 {
    margin: 0;
    font-size: var(--font-size-lg, 18px);
    font-weight: 600;
    color: var(--theme-text, #ffffff);
  }

  .subtitle {
    margin: 2px 0 0;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
  }

  /* =========================================================================
     Controls Row (variant pills + play button)
     ========================================================================= */

  .controls-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .variant-selector {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
  }

  .variant-btn {
    padding: 4px 12px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 999px;
    background: transparent;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-compact, 12px);
    cursor: pointer;
    transition: background var(--duration-fast, 150ms), color var(--duration-fast, 150ms);
    white-space: nowrap;
  }

  .variant-btn.active {
    background: var(--theme-accent, #6366f1);
    color: #fff;
    border-color: var(--theme-accent, #6366f1);
  }

  .play-btn {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 14px;
    border: none;
    border-radius: 8px;
    background: var(--theme-accent, #6366f1);
    color: #fff;
    font-size: var(--font-size-sm, 14px);
    font-weight: 500;
    cursor: pointer;
    transition: opacity var(--duration-fast, 150ms);
  }

  .play-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* =========================================================================
     Demo Viewports
     ========================================================================= */

  .demo-viewport {
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 12px;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    overflow: hidden;
  }

  .gate-viewport {
    height: 240px;
    position: relative;
  }

  .panel-viewport {
    height: 200px;
    position: relative;
  }

  .progress-viewport {
    min-height: 120px;
    padding: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .grid-viewport {
    padding: 16px;
  }

  .button-viewport {
    padding: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* =========================================================================
     Placeholder (content loaded)
     ========================================================================= */

  .placeholder-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    height: 100%;
    color: var(--semantic-success, #22c55e);
    font-size: var(--font-size-sm, 14px);
    opacity: 0.7;
  }

  .placeholder-content i {
    font-size: 24px;
  }

  /* =========================================================================
     Section 2: Panel Loading variants
     ========================================================================= */

  /* Skeleton list */
  .skeleton-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
  }

  .skeleton-list-item {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .skeleton-text-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
    flex: 1;
  }

  /* Bar + text */
  .bar-text-layout {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    height: 100%;
    padding: 16px;
  }

  .loading-label {
    font-size: var(--font-size-sm, 14px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
  }

  /* Pulse dots */
  .dots-layout {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    height: 100%;
  }

  .pulse-dots {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--theme-accent, #6366f1);
    animation: dot-bounce 0.9s ease-in-out infinite;
  }

  @keyframes dot-bounce {
    0%, 100% {
      transform: translateY(0);
      opacity: 0.4;
    }
    50% {
      transform: translateY(-8px);
      opacity: 1;
    }
  }

  /* =========================================================================
     Section 3: Deterministic Progress
     ========================================================================= */

  .progress-demo-content {
    width: 100%;
    max-width: 360px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }

  .steps-bar-spacer {
    height: 12px;
  }

  /* =========================================================================
     Section 4: Grid Cells
     ========================================================================= */

  .cell-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
  }

  .grid-cell {
    aspect-ratio: 1;
    border-radius: 8px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    position: relative;
  }

  .grid-cell.loaded {
    animation: cell-pop 0.25s ease-out;
    border-color: var(--theme-accent, #6366f1);
  }

  .cell-number {
    font-size: var(--font-size-lg, 18px);
    font-weight: 700;
    color: var(--theme-accent, #6366f1);
    font-variant-numeric: tabular-nums;
  }

  .stagger-placeholder {
    width: 100%;
    height: 100%;
    background: rgba(255, 255, 255, 0.03);
  }

  .cell-idle {
    width: 100%;
    height: 100%;
    background: transparent;
  }

  @keyframes cell-pop {
    0% {
      transform: scale(0.85);
      opacity: 0;
    }
    100% {
      transform: scale(1);
      opacity: 1;
    }
  }

  /* =========================================================================
     Section 5: Button Actions
     ========================================================================= */

  .action-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 24px;
    border: none;
    border-radius: 10px;
    background: var(--theme-accent, #6366f1);
    color: #fff;
    font-size: var(--font-size-sm, 14px);
    font-weight: 500;
    cursor: pointer;
    position: relative;
    overflow: hidden;
    transition: opacity var(--duration-fast, 150ms);
  }

  .action-btn:disabled {
    cursor: not-allowed;
  }

  .morph-bar-wrapper {
    width: 200px;
    height: 40px;
    border-radius: 10px;
    overflow: hidden;
  }

  .fill-btn {
    min-width: 160px;
    justify-content: center;
  }

  .fill-overlay {
    position: absolute;
    top: 0;
    left: 0;
    bottom: 0;
    background: rgba(255, 255, 255, 0.2);
    transition: width 80ms linear;
    pointer-events: none;
  }

  .fill-label {
    position: relative;
    z-index: 1;
  }

  /* =========================================================================
     Reduced motion (system-level)
     ========================================================================= */

  @media (prefers-reduced-motion: reduce) {
    .dot {
      animation: none;
      opacity: 0.7;
    }

    .grid-cell.loaded {
      animation: none;
    }
  }
</style>
