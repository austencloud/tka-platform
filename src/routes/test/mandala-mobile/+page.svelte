<script lang="ts">
  import { onMount } from "svelte";
  import { slide, fade } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import SequenceMandala from "$lib/shared/mandala/components/SequenceMandala.svelte";
  import ViewerModeBottomBar from "$lib/shared/sequence-viewer/components/ViewerModeBottomBar.svelte";
  import type { ContentType, ViewerMode } from "$lib/shared/sequence-viewer/state/viewer-state.svelte";
  import { MandalaViewerController } from "$lib/shared/sequence-viewer/state/mandala-viewer-controller.svelte";
  import type { MandalaPathShape } from "$lib/shared/mandala/domain/mandala-types";
  import { loadCatalogs, loadCatalogSequences } from "$lib/features/choreo-card/services/catalog-loader";
  import { mandalaCollectionState } from "$lib/features/mandala/tabs/collection/state/mandala-collection-state.svelte";
  import type { Catalog } from "$lib/features/choreo-card/domain/models/Catalog";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";

  // ── Sequence sourcing (same approach as /test/mandala-paths) ──────
  let decks: Catalog[] = $state([]);
  let selectedDeckId = $state("");
  let deckSequences: any[] = $state([]);
  let loading = $state(false);
  let error = $state("");
  let currentIndex = $state(0);

  type DataSource = "collection" | "decks";
  let dataSource = $state<DataSource>("collection");

  const collectionSequences = $derived(
    mandalaCollectionState.collection.map((m) => ({
      id: m.id, word: m.name, steps: m.steps,
      bluePropType: m.bluePropType, redPropType: m.redPropType,
    })),
  );

  const sequences = $derived(dataSource === "collection" ? collectionSequences : deckSequences);
  const currentSeq = $derived(sequences[currentIndex] ?? null);
  const blueProp = $derived(currentSeq?.bluePropType ?? "staff");
  const redProp = $derived(currentSeq?.redPropType ?? "staff");

  // ── Shared controller (same logic as the real desktop MandalaPane) ─
  const ctrl = new MandalaViewerController({
    getSequence: () => currentSeq as SequenceData,
    getBluePropType: () => blueProp,
    getRedPropType: () => redProp,
  });

  // ── Mobile shell state ────────────────────────────────────────────
  let viewerMode = $state<ViewerMode>("mandala");

  // Honor prefers-reduced-motion for JS (Svelte) transitions — CSS @media
  // covers keyframes, but transition durations must be zeroed manually.
  let reduceMotion = $state(false);
  $effect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reduceMotion = mq.matches;
    const onChange = () => (reduceMotion = mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  });
  const dur = (ms: number) => (reduceMotion ? 0 : ms);

  // Device presets — iPhone SE is the tight-screen stress test (default).
  type Device = { id: string; label: string; w: number; h: number };
  const DEVICES: Device[] = [
    { id: "se", label: "iPhone SE", w: 375, h: 667 },
    { id: "i15", label: "iPhone 15", w: 393, h: 852 },
    { id: "pixel", label: "Pixel 7", w: 412, h: 915 },
  ];
  let deviceId = $state("se");
  const device = $derived(DEVICES.find((d) => d.id === deviceId) ?? DEVICES[0]!);

  // Drill-down: one setting visible at a time, mandala always in view.
  type CatId = "speed" | "shape" | "spin" | "colors" | "weight" | "depth";
  const CATS: { id: CatId; icon: string; label: string }[] = [
    { id: "speed", icon: "fa-gauge-high", label: "Speed" },
    { id: "shape", icon: "fa-bezier-curve", label: "Shape" },
    { id: "spin", icon: "fa-arrows-rotate", label: "Spin" },
    { id: "colors", icon: "fa-palette", label: "Colors" },
    { id: "weight", icon: "fa-grip-lines", label: "Weight" },
    { id: "depth", icon: "fa-wave-square", label: "Depth" },
  ];
  let activeCat = $state<CatId | null>(null);
  function toggleCat(id: CatId) {
    activeCat = activeCat === id ? null : id;
  }

  // Hidden native <input type="color"> refs — styled chips trigger them via
  // .click() so the OS picker opens without showing the dated browser box
  // (same technique as ProfileColorPicker).
  let blueInputEl: HTMLInputElement | undefined = $state();
  let redInputEl: HTMLInputElement | undefined = $state();

  // Presets live behind a palette drill-down so the colors tray stays compact.
  let presetsOpen = $state(false);

  // Measure the dock (cat-bar + active tray) so the mandala stage reserves exactly
  // that much room and stays fully visible no matter how tall the tray grows.
  let dockEl: HTMLDivElement | undefined = $state();
  let dockHeight = $state(76);
  $effect(() => {
    if (!dockEl) return;
    const ro = new ResizeObserver((entries) => {
      const e = entries[0];
      if (e) dockHeight = Math.ceil(e.contentRect.height);
    });
    ro.observe(dockEl);
    return () => ro.disconnect();
  });

  // Tap the mandala to play/pause (mirrors the 2D animation canvas). Flash the
  // action icon briefly for feedback.
  let playFlash = $state(false);
  let playFlashTimer: ReturnType<typeof setTimeout> | undefined;
  function togglePlay() {
    ctrl.paused = !ctrl.paused;
    playFlash = true;
    clearTimeout(playFlashTimer);
    playFlashTimer = setTimeout(() => (playFlash = false), 520);
  }

  const PATH_SHAPES: { id: MandalaPathShape; label: string }[] = [
    { id: "arc", label: "Arc" },
    { id: "linear", label: "Linear" },
    { id: "concave", label: "Concave" },
    { id: "hybrid", label: "Hybrid" },
  ];
  const STROKE_WIDTHS: { value: number; label: string }[] = [
    { value: 1, label: "Thin" },
    { value: 2.5, label: "Normal" },
    { value: 4, label: "Thick" },
  ];
  // Trimmed to 4 so the row fits with no horizontal scroll; "Custom" opens pickers.
  const PRESETS: { id: typeof ctrl.preset; label: string }[] = [
    { id: "aurora", label: "Aurora" },
    { id: "neon", label: "Neon" },
    { id: "ember", label: "Ember" },
    { id: "ice", label: "Ice" },
  ];
  const presetLabel = $derived(PRESETS.find((p) => p.id === ctrl.preset)?.label ?? "Custom");

  let stageEl: HTMLButtonElement | undefined = $state();
  let stageSize = $state(320);

  $effect(() => {
    if (!stageEl) return;
    const ro = new ResizeObserver((entries) => {
      const e = entries[0];
      if (!e) return;
      const { width, height } = e.contentRect;
      stageSize = Math.floor(Math.min(width, height));
    });
    ro.observe(stageEl);
    return () => ro.disconnect();
  });

  onMount(async () => {
    try {
      decks = await loadCatalogs();
      const first = decks[0];
      if (first) selectedDeckId = first.id;
      if (mandalaCollectionState.count === 0) dataSource = "decks";
    } catch (e: any) {
      error = e.message ?? "Failed to load decks";
    }
  });

  $effect(() => {
    if (dataSource !== "decks" || !selectedDeckId) return;
    loading = true;
    error = "";
    currentIndex = 0;
    loadCatalogSequences(selectedDeckId)
      .then((seqs) => { deckSequences = seqs; })
      .catch((e: any) => { error = e.message ?? "Failed to load sequences"; })
      .finally(() => { loading = false; });
  });

  function prev() {
    if (sequences.length) currentIndex = (currentIndex - 1 + sequences.length) % sequences.length;
  }
  function next() {
    if (sequences.length) currentIndex = (currentIndex + 1) % sequences.length;
  }
</script>

<div class="page">
  <!-- Out-of-frame harness: pick a real sequence to preview -->
  <header class="harness">
    <div class="seg">
      <button class:active={dataSource === "collection"} onclick={() => { dataSource = "collection"; currentIndex = 0; }}>
        Collection{#if mandalaCollectionState.count > 0}<span class="badge">{mandalaCollectionState.count}</span>{/if}
      </button>
      <button class:active={dataSource === "decks"} onclick={() => { dataSource = "decks"; currentIndex = 0; }}>Decks</button>
    </div>
    {#if dataSource === "decks"}
      <select bind:value={selectedDeckId} class="deck-select" transition:fade={{ duration: dur(180) }}>
        {#each decks as deck}<option value={deck.id}>{deck.name} ({deck.totalSequences})</option>{/each}
      </select>
    {/if}
    <div class="picker">
      <button onclick={prev} aria-label="Previous"><i class="fas fa-chevron-left" aria-hidden="true"></i></button>
      {#key currentSeq?.word ?? "—"}
        <span class="picker-word" in:fade={{ duration: dur(160) }}>{currentSeq?.word ?? "—"}</span>
      {/key}
      <button onclick={next} aria-label="Next"><i class="fas fa-chevron-right" aria-hidden="true"></i></button>
    </div>
    {#if sequences.length}<span class="count" transition:fade={{ duration: dur(180) }}>{currentIndex + 1}/{sequences.length}</span>{/if}
    <div class="seg device-seg">
      {#each DEVICES as d}
        <button class:active={deviceId === d.id} onclick={() => (deviceId = d.id)}>{d.label}</button>
      {/each}
    </div>
  </header>

  <!-- Phone frame: portrait mobile preview at the selected device size -->
  <div
    class="phone"
    style:width="{device.w + 24}px"
    style:height="min({device.h + 24}px, calc(100vh - 6rem))"
  >
    <div class="screen" style:background={ctrl.bgColor}>
      <!-- Real viewer header chrome (mirrors SequenceViewerDrawerHost .drawer-header):
           left overflow menu · centered title · right close. -->
      <header class="vp-header">
        <div class="vp-header-actions left">
          <button class="vp-hbtn" aria-label="More options"><i class="fas fa-ellipsis-vertical" aria-hidden="true"></i></button>
        </div>
        <div class="vp-header-title">Sequence Viewer</div>
        <div class="vp-header-actions right">
          <button class="vp-hbtn close" aria-label="Close viewer"><i class="fas fa-times" aria-hidden="true"></i></button>
        </div>
      </header>

      <!-- Viewer region — sits above the real ViewerModeBottomBar, exactly like
           drawer-main in SequenceViewerDrawerHost. -->
      <div class="viewer">
      {#if loading}
        <div class="state"><i class="fas fa-spinner fa-spin" aria-hidden="true"></i></div>
      {:else if error}
        <div class="state error"><i class="fas fa-triangle-exclamation" aria-hidden="true"></i><p>{error}</p></div>
      {:else if !currentSeq}
        <div class="state"><i class="fas fa-atom" aria-hidden="true"></i><p>No sequences</p></div>
      {:else}
        <!-- Mandala stays fully visible; reserves exactly the dock's height so it's
             never covered. Tap toggles play/pause like the 2D animation canvas. -->
        <button
          type="button"
          class="stage"
          bind:this={stageEl}
          style:padding-bottom="{dockHeight + 14}px"
          onclick={togglePlay}
          aria-label={ctrl.paused ? "Play animation" : "Pause animation"}
        >
          <div class="stage-inner">
            <SequenceMandala
              sequence={currentSeq}
              animate={!ctrl.paused}
              animateMin={0}
              animateMax={ctrl.rangeMax}
              animatePeriod={ctrl.period}
              animateEasing="breathe"
              animateRotation={ctrl.rotation}
              pathShape={ctrl.pathShape}
              size={stageSize}
              bluePropType={blueProp}
              redPropType={redProp}
              mode="card-back"
              style="stroke"
              show="both"
              palette={ctrl.palette}
              strokeWidth={ctrl.lineWeight}
              gradient={ctrl.gradientColors}
            />
            <span class="play-flash" class:show={playFlash} aria-hidden="true">
              <i class="fas {ctrl.paused ? 'fa-pause' : 'fa-play'}"></i>
            </span>
          </div>
        </button>

        <!-- Drill-down dock: each setting is its own button; tapping reveals
             only that setting's options in a short tray. -->
        <div class="dock" data-swipe-block bind:this={dockEl}>
          {#if activeCat}
            <div class="tray" transition:slide={{ duration: dur(260), easing: cubicOut }}>
              {#if activeCat === "speed"}
                <div class="tray-slider" transition:slide|local={{ duration: dur(220), easing: cubicOut }}>
                  <input type="range" min="0.25" max="3" step="0.05" value={ctrl.speed} oninput={(e) => (ctrl.speed = Number((e.target as HTMLInputElement).value))} class="slider" aria-label="Undulation speed" />
                  <span class="slider-value">{ctrl.speed.toFixed(2)}x</span>
                </div>
              {/if}
              {#if activeCat === "shape"}
                <div class="tray-chips" transition:slide|local={{ duration: dur(220), easing: cubicOut }}>
                  {#each PATH_SHAPES as sh}
                    <button class="chip" class:active={ctrl.pathShape === sh.id} onclick={() => (ctrl.pathShape = sh.id)} aria-pressed={ctrl.pathShape === sh.id}>{sh.label}</button>
                  {/each}
                </div>
              {/if}
              {#if activeCat === "spin"}
                <div class="tray-slider" transition:slide|local={{ duration: dur(220), easing: cubicOut }}>
                  <input type="range" min="0" max="360" step="15" value={ctrl.rotation} oninput={(e) => (ctrl.rotation = Number((e.target as HTMLInputElement).value))} class="slider" aria-label="Spin" />
                  <span class="slider-value">{ctrl.rotation}°</span>
                </div>
              {/if}
              {#if activeCat === "colors"}
                <div class="tray-colors" transition:slide|local={{ duration: dur(220), easing: cubicOut }}>
                  <div class="colors-head">
                    <div class="mode-toggle">
                      <button class="chip mini" class:active={ctrl.colorMode === "solid"} onclick={() => (ctrl.colorMode = "solid")} aria-pressed={ctrl.colorMode === "solid"}>Solid</button>
                      <button class="chip mini" class:active={ctrl.colorMode === "flow"} onclick={() => (ctrl.colorMode = "flow")} aria-pressed={ctrl.colorMode === "flow"}>Flow</button>
                    </div>
                    <button class="palette-toggle" onclick={() => (presetsOpen = !presetsOpen)} aria-expanded={presetsOpen} aria-label="Choose palette">
                      <span class="palette-chip" style:background={ctrl.previewGradient(ctrl.preset)}></span>
                      <span class="palette-name">{presetLabel}</span>
                      <i class="fas fa-chevron-{presetsOpen ? 'up' : 'down'}" aria-hidden="true"></i>
                    </button>
                  </div>
                  {#if presetsOpen}
                    <div class="preset-row" transition:slide|local={{ duration: dur(240), easing: cubicOut }}>
                      {#each PRESETS as p}
                        <button class="swatch" class:active={ctrl.preset === p.id} onclick={() => { ctrl.preset = p.id; presetsOpen = false; }} aria-label={p.label} aria-pressed={ctrl.preset === p.id}>
                          <span class="swatch-fill" style:background={ctrl.previewGradient(p.id)}></span>
                          <span class="swatch-label">{p.label}</span>
                        </button>
                      {/each}
                      <button class="swatch custom" class:active={ctrl.preset === "custom"} onclick={() => { ctrl.preset = "custom"; presetsOpen = false; }} aria-label="Custom colors" aria-pressed={ctrl.preset === "custom"}>
                        <span class="swatch-fill" style:background={ctrl.previewGradient("custom")}>
                          <i class="fas fa-eye-dropper" aria-hidden="true"></i>
                        </span>
                        <span class="swatch-label">Custom</span>
                      </button>
                    </div>
                  {/if}
                  {#if ctrl.preset === "custom"}
                    <div class="custom-flow" transition:slide|local={{ duration: dur(240), easing: cubicOut }}>
                      <span class="flow-preview" style:background={ctrl.previewGradient("custom")} aria-hidden="true"></span>
                      <div class="flow-stops">
                        <button class="color-chip" style:--c={ctrl.customBlue} onclick={() => blueInputEl?.click()} aria-label="Edit first color {ctrl.customBlue}">
                          <span class="chip-swatch"><i class="fas fa-eye-dropper" aria-hidden="true"></i></span>
                          <span class="chip-meta">
                            <span class="chip-name">Color A</span>
                            <span class="chip-hex">{ctrl.customBlue.toUpperCase()}</span>
                          </span>
                          <input bind:this={blueInputEl} type="color" value={ctrl.customBlue} oninput={(e) => (ctrl.customBlue = (e.target as HTMLInputElement).value)} class="native-color" tabindex="-1" aria-hidden="true" />
                        </button>
                        <button class="color-chip" style:--c={ctrl.customRed} onclick={() => redInputEl?.click()} aria-label="Edit second color {ctrl.customRed}">
                          <span class="chip-swatch"><i class="fas fa-eye-dropper" aria-hidden="true"></i></span>
                          <span class="chip-meta">
                            <span class="chip-name">Color B</span>
                            <span class="chip-hex">{ctrl.customRed.toUpperCase()}</span>
                          </span>
                          <input bind:this={redInputEl} type="color" value={ctrl.customRed} oninput={(e) => (ctrl.customRed = (e.target as HTMLInputElement).value)} class="native-color" tabindex="-1" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  {/if}
                </div>
              {/if}
              {#if activeCat === "weight"}
                <div class="tray-chips" transition:slide|local={{ duration: dur(220), easing: cubicOut }}>
                  {#each STROKE_WIDTHS as sw}
                    <button class="chip" class:active={ctrl.lineWeight === sw.value} onclick={() => (ctrl.lineWeight = sw.value)} aria-pressed={ctrl.lineWeight === sw.value}>{sw.label}</button>
                  {/each}
                </div>
              {/if}
              {#if activeCat === "depth"}
                <div class="tray-slider" transition:slide|local={{ duration: dur(220), easing: cubicOut }}>
                  <input type="range" min="0" max="100" step="1" value={ctrl.depth} oninput={(e) => (ctrl.depth = Number((e.target as HTMLInputElement).value))} class="slider" aria-label="Depth" />
                  <span class="slider-value">{ctrl.depth}%</span>
                </div>
              {/if}
            </div>
          {/if}

          <div class="cat-bar">
            <div class="cat-scroll">
              {#each CATS as c}
                <button class="dock-btn cat" class:active={activeCat === c.id} onclick={() => toggleCat(c.id)} aria-pressed={activeCat === c.id}>
                  {#if c.id === "colors"}
                    <span class="cat-dots">
                      <span class="dot" style:background={ctrl.accentPair[0]}></span>
                      <span class="dot" style:background={ctrl.accentPair[1]}></span>
                    </span>
                  {:else}
                    <i class="fas {c.icon}" aria-hidden="true"></i>
                  {/if}
                  <span class="cat-label">{c.label}</span>
                </button>
              {/each}
            </div>

            <button
              class="dock-btn download"
              onclick={() => !ctrl.exporting && ctrl.handleDownload()}
              disabled={ctrl.exporting}
              aria-label="Download animation"
            >
              <i class="fas {ctrl.exporting ? 'fa-spinner fa-spin' : 'fa-download'}" aria-hidden="true"></i>
            </button>
          </div>
        </div>
      {/if}
      </div>

      <!-- Real viewer mode switcher — the actual bottom bar in the mobile viewer -->
      <ViewerModeBottomBar
        activeMode={viewerMode}
        onSelectMode={(m: ContentType) => { viewerMode = m; }}
        onSelectSplit={() => { viewerMode = "split"; }}
      />
    </div>
  </div>
</div>

<style>
  .page {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
    background: #07070f;
    color: #e2e8f0;
  }

  /* ── Out-of-frame harness ───────────────────────────────────────── */
  .harness {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    font-size: 0.8rem;
  }
  .seg {
    display: flex;
    gap: 1px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 8px;
    padding: 3px;
  }
  .seg button {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 0.35rem 0.7rem;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: inherit;
    cursor: pointer;
    opacity: 0.55;
    font-size: 0.75rem;
  }
  .seg button.active {
    background: rgba(167, 139, 250, 0.2);
    opacity: 1;
  }
  .badge {
    font-size: 0.6rem;
    padding: 0 5px;
    border-radius: 8px;
    background: rgba(167, 139, 250, 0.3);
    color: #c4b5fd;
  }
  .deck-select {
    padding: 0.4rem 0.6rem;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(0, 0, 0, 0.3);
    color: inherit;
    font-size: 0.75rem;
    max-width: 220px;
  }
  .picker {
    display: flex;
    align-items: center;
    gap: 0.6rem;
  }
  .picker button {
    width: 34px;
    height: 34px;
    border-radius: 50%;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.04);
    color: inherit;
    cursor: pointer;
  }
  .picker-word {
    min-width: 90px;
    text-align: center;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    font-size: 0.85rem;
  }
  .count {
    opacity: 0.4;
    font-variant-numeric: tabular-nums;
    font-size: 0.72rem;
  }

  .device-seg button { font-size: 0.7rem; }

  /* ── Phone frame (sized to the selected device) ─────────────────── */
  .phone {
    max-width: 100%;
    border-radius: 44px;
    padding: 12px;
    background: #15151f;
    box-shadow:
      0 0 0 2px rgba(255, 255, 255, 0.06),
      0 30px 80px rgba(0, 0, 0, 0.6);
    transition: width 320ms cubic-bezier(0.2, 0.8, 0.2, 1), height 320ms cubic-bezier(0.2, 0.8, 0.2, 1);
  }
  .screen {
    position: relative;
    width: 100%;
    height: 100%;
    border-radius: 32px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  /* ── Viewer header chrome (mirrors .drawer-header) ──────────────── */
  .vp-header {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 2px 8px;
    min-height: 44px;
    flex-shrink: 0;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    z-index: 6;
  }
  .vp-header-actions {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .vp-header-title {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    font-size: 14px;
    font-weight: 600;
    color: var(--theme-text, #fff);
    white-space: nowrap;
    pointer-events: none;
  }
  .vp-hbtn {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 40px;
    min-height: 40px;
    background: none;
    border: none;
    border-radius: 9px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    cursor: pointer;
    font-size: 16px;
    transition: background 150ms ease, color 150ms ease, transform 120ms ease;
  }
  .vp-hbtn:hover { background: var(--theme-card-bg, rgba(255, 255, 255, 0.06)); color: #fff; }
  .vp-hbtn:active { transform: scale(0.9); }

  /* Viewer region — above the real ViewerModeBottomBar. */
  .viewer {
    position: relative;
    flex: 1;
    min-height: 0;
    overflow: hidden;
    display: flex;
  }

  /* ── Mandala stage (tap to play/pause) ──────────────────────────── */
  .stage {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 12px;
    /* padding-bottom is set inline = dock height, so the mandala always fits
       above the dock and animates up smoothly as the tray grows. */
    transition: padding-bottom 300ms cubic-bezier(0.2, 0.8, 0.2, 1);
    appearance: none;
    border: none;
    background: transparent;
    color: inherit;
    font: inherit;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  .stage-inner {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .stage :global(svg) {
    width: 100%;
    height: 100%;
  }

  /* Center play/pause flash — fades + scales out after a tap. */
  .play-flash {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
    opacity: 0;
  }
  .play-flash i {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 64px;
    height: 64px;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.45);
    backdrop-filter: blur(6px);
    color: #fff;
    font-size: 24px;
    box-shadow: 0 4px 18px rgba(0, 0, 0, 0.5);
  }
  .play-flash.show {
    animation: flashPop 520ms cubic-bezier(0.2, 0.8, 0.2, 1);
  }
  @keyframes flashPop {
    0% { opacity: 0; transform: scale(0.7); }
    25% { opacity: 1; transform: scale(1); }
    100% { opacity: 0; transform: scale(1.25); }
  }

  /* ── Drill-down dock ────────────────────────────────────────────── */
  .dock {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 5;
    display: flex;
    flex-direction: column;
  }

  /* Contextual tray — short, holds only the active setting's options. */
  .tray {
    padding: 12px 12px 8px;
    background: color-mix(in srgb, var(--theme-panel-bg, rgba(18, 18, 28, 0.96)) 92%, transparent);
    backdrop-filter: blur(16px);
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .tray-chips {
    display: flex;
    gap: 6px;
  }
  .tray-slider {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .tray-colors {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .colors-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }
  .mode-toggle {
    display: flex;
    gap: 6px;
  }
  .palette-toggle {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    min-height: 36px;
    border-radius: 10px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    background: color-mix(in srgb, var(--theme-card-bg, rgba(255, 255, 255, 0.04)) 70%, transparent);
    color: var(--theme-text, #fff);
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: border-color 180ms ease, background 180ms ease, transform 140ms cubic-bezier(0.2, 0.8, 0.2, 1);
  }
  .palette-toggle:active { transform: scale(0.95); }
  .palette-chip {
    width: 28px;
    height: 18px;
    border-radius: 6px;
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.25);
  }
  .palette-name {
    font-size: 12px;
    font-weight: 600;
  }
  .palette-toggle i {
    font-size: 10px;
    opacity: 0.55;
  }
  .preset-row {
    display: flex;
    gap: 8px;
  }
  /* Modern custom flow editor — live gradient + two styled color chips that
     trigger the hidden OS picker (no dated native box). */
  .custom-flow {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .flow-preview {
    display: block;
    width: 100%;
    height: 14px;
    border-radius: 999px;
    box-shadow:
      inset 0 0 0 1px rgba(255, 255, 255, 0.12),
      0 2px 8px rgba(0, 0, 0, 0.35);
  }
  .flow-stops {
    display: flex;
    gap: 10px;
  }
  .color-chip {
    position: relative;
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 52px;
    padding: 8px 10px;
    border-radius: 12px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    background: color-mix(in srgb, var(--theme-card-bg, rgba(255, 255, 255, 0.04)) 70%, transparent);
    cursor: pointer;
    overflow: hidden;
    -webkit-tap-highlight-color: transparent;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
  }
  .color-chip:hover {
    border-color: color-mix(in srgb, var(--c) 50%, var(--theme-stroke, rgba(255, 255, 255, 0.2)));
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--c) 40%, transparent);
  }
  .color-chip:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--c) 70%, white);
    outline-offset: 2px;
  }
  .chip-swatch {
    flex: 0 0 auto;
    width: 34px;
    height: 34px;
    border-radius: 9px;
    background: var(--c);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow:
      inset 0 0 0 1px rgba(255, 255, 255, 0.25),
      0 2px 6px color-mix(in srgb, var(--c) 45%, transparent);
    color: rgba(255, 255, 255, 0.95);
    font-size: 12px;
  }
  .chip-swatch i {
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.6));
  }
  .chip-meta {
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
    text-align: left;
  }
  .chip-name {
    font-size: 11px;
    font-weight: 600;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
  }
  .chip-hex {
    font-size: 12px;
    font-weight: 600;
    font-family: ui-monospace, "SF Mono", monospace;
    color: var(--theme-text, #ffffff);
    letter-spacing: 0.02em;
  }
  /* Hidden native input — only triggers the OS picker dialog. */
  .native-color {
    position: absolute;
    left: 12px;
    bottom: 4px;
    width: 1px;
    height: 1px;
    padding: 0;
    border: none;
    opacity: 0;
    pointer-events: none;
  }

  .chip {
    flex: 1;
    min-width: 0;
    min-height: 44px;
    padding: 8px 6px;
    border-radius: 10px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    background: color-mix(in srgb, var(--theme-card-bg, rgba(255, 255, 255, 0.04)) 70%, transparent);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition:
      background 200ms ease,
      border-color 200ms ease,
      color 200ms ease,
      transform 140ms cubic-bezier(0.2, 0.8, 0.2, 1);
  }
  .chip:active { transform: scale(0.94); }
  .chip.mini {
    flex: 0 0 auto;
    min-height: 36px;
    padding: 6px 14px;
    font-size: 12px;
  }
  .chip.active {
    background: color-mix(in srgb, var(--theme-accent, #6366f1) 35%, var(--theme-card-bg, rgba(0, 0, 0, 0.4)));
    border-color: color-mix(in srgb, var(--theme-accent, #6366f1) 60%, transparent);
    color: white;
  }

  .swatch {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 5px;
    padding: 0;
    border: none;
    background: none;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  .swatch-fill {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 40px;
    border-radius: 10px;
    border: 2px solid transparent;
    color: rgba(255, 255, 255, 0.85);
    font-size: 14px;
    transition:
      border-color 200ms ease,
      box-shadow 200ms ease,
      transform 200ms cubic-bezier(0.2, 0.8, 0.2, 1);
  }
  .swatch:active .swatch-fill { transform: scale(0.93); }
  .swatch.active .swatch-fill {
    border-color: white;
    transform: translateY(-2px);
    box-shadow:
      0 0 0 2px color-mix(in srgb, var(--theme-accent, #6366f1) 60%, transparent),
      0 6px 16px rgba(0, 0, 0, 0.4);
  }
  .swatch-label {
    font-size: 10px;
    font-weight: 600;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.55));
  }
  .swatch.active .swatch-label {
    color: var(--theme-text, white);
  }
  .dot {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    border: 1px solid rgba(255, 255, 255, 0.2);
  }

  .slider {
    flex: 1;
    height: 6px;
    appearance: none;
    background: var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 3px;
    cursor: pointer;
  }
  .slider::-webkit-slider-thumb {
    appearance: none;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: var(--theme-accent, #6366f1);
    border: 2px solid var(--theme-panel-bg, rgba(10, 10, 26, 0.9));
    cursor: pointer;
  }
  .slider-value {
    font-size: 13px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-variant-numeric: tabular-nums;
    min-width: 44px;
    text-align: right;
  }

  /* Category bar — the persistent row of per-setting buttons. */
  .cat-bar {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 6px;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.96));
    backdrop-filter: blur(16px);
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }
  .cat-scroll {
    display: flex;
    flex: 1;
    min-width: 0;
    gap: 4px;
  }

  .dock-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    min-height: 52px;
    border-radius: 12px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    background: color-mix(in srgb, var(--theme-card-bg, rgba(255, 255, 255, 0.04)) 70%, transparent);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition:
      background 220ms ease,
      border-color 220ms ease,
      color 220ms ease,
      transform 150ms cubic-bezier(0.2, 0.8, 0.2, 1),
      box-shadow 220ms ease;
  }
  .dock-btn:active { transform: scale(0.92); }
  .dock-btn i { font-size: 16px; transition: transform 200ms cubic-bezier(0.2, 0.8, 0.2, 1); }
  .dock-btn.cat.active i { transform: translateY(-1px) scale(1.08); }
  .dock-btn.cat {
    flex: 1 1 0;
    min-width: 0;
    padding: 6px 2px;
  }
  .cat-label {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.02em;
    white-space: nowrap;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .cat-dots {
    display: flex;
    gap: 2px;
  }
  .dock-btn.cat.active {
    background: color-mix(in srgb, var(--theme-accent, #6366f1) 35%, var(--theme-card-bg, rgba(0, 0, 0, 0.4)));
    border-color: color-mix(in srgb, var(--theme-accent, #6366f1) 60%, transparent);
    color: white;
  }

  .dock-btn.download {
    flex: 0 0 auto;
    width: 46px;
    border-color: color-mix(in srgb, var(--theme-accent, #6366f1) 50%, transparent);
    background: color-mix(in srgb, var(--theme-accent, #6366f1) 25%, var(--theme-card-bg, rgba(0, 0, 0, 0.4)));
    color: white;
  }
  .dock-btn.download:disabled { opacity: 0.6; cursor: default; }

  /* ── States ─────────────────────────────────────────────────────── */
  .state {
    margin: auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    opacity: 0.5;
  }
  .state i { font-size: 1.8rem; }
  .state.error { color: #f87171; opacity: 1; }

  .dock-btn.cat.active {
    transform: translateY(-1px);
  }

  /* Staggered entrance for the active tray's controls — feels alive in 2026. */
  .tray-chips > *,
  .preset-row > *,
  .mode-toggle > *,
  .custom-flow > * {
    animation: popIn 340ms cubic-bezier(0.2, 0.8, 0.2, 1) backwards;
  }
  .tray-chips > *:nth-child(2),
  .preset-row > *:nth-child(2) { animation-delay: 45ms; }
  .tray-chips > *:nth-child(3),
  .preset-row > *:nth-child(3) { animation-delay: 90ms; }
  .tray-chips > *:nth-child(4),
  .preset-row > *:nth-child(4) { animation-delay: 135ms; }
  .preset-row > *:nth-child(5) { animation-delay: 180ms; }
  .custom-flow > *:nth-child(2) { animation-delay: 60ms; }
  @keyframes popIn {
    from { opacity: 0; transform: translateY(10px) scale(0.96); }
    to { opacity: 1; transform: none; }
  }

  /* Desktop hover affordances — mirrors the bottom bar. Gated to true-hover
     pointers so touch devices never get sticky hover states. */
  @media (hover: hover) {
    .dock-btn.cat:hover {
      background: color-mix(in srgb, var(--theme-card-bg, rgba(255, 255, 255, 0.04)) 88%, white 8%);
      border-color: color-mix(in srgb, var(--theme-accent, #6366f1) 35%, var(--theme-stroke, rgba(255, 255, 255, 0.12)));
      color: var(--theme-text, #fff);
      transform: translateY(-2px);
    }
    .dock-btn.cat.active:hover {
      background: color-mix(in srgb, var(--theme-accent, #6366f1) 45%, var(--theme-card-bg, rgba(0, 0, 0, 0.4)));
      transform: translateY(-2px);
    }
    .dock-btn.cat:hover i { transform: translateY(-1px) scale(1.08); }
    .dock-btn.download:hover:not(:disabled) {
      background: color-mix(in srgb, var(--theme-accent, #6366f1) 42%, var(--theme-card-bg, rgba(0, 0, 0, 0.4)));
      border-color: color-mix(in srgb, var(--theme-accent, #6366f1) 75%, transparent);
      transform: translateY(-2px);
      box-shadow: 0 6px 18px color-mix(in srgb, var(--theme-accent, #6366f1) 35%, transparent);
    }
    .chip:hover:not(.active) {
      background: color-mix(in srgb, var(--theme-card-bg, rgba(255, 255, 255, 0.04)) 88%, white 8%);
      border-color: color-mix(in srgb, var(--theme-accent, #6366f1) 35%, var(--theme-stroke, rgba(255, 255, 255, 0.12)));
      color: var(--theme-text, #fff);
    }
    .swatch:hover .swatch-fill { transform: translateY(-2px); }
    .palette-toggle:hover {
      border-color: color-mix(in srgb, var(--theme-accent, #6366f1) 45%, var(--theme-stroke, rgba(255, 255, 255, 0.12)));
      background: color-mix(in srgb, var(--theme-card-bg, rgba(255, 255, 255, 0.04)) 85%, white 6%);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .stage, .tray, .phone { transition: none !important; }
    .tray-chips > *,
    .preset-row > *,
    .mode-toggle > *,
    .custom-flow > *,
    .play-flash.show,
    .tray { animation: none !important; }
    .chip:active, .swatch:active .swatch-fill, .dock-btn:active, .vp-hbtn:active { transform: none; }
  }
</style>
