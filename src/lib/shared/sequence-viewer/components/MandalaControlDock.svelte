<script lang="ts">
  import { slide } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import type { MandalaViewerController } from "../state/mandala-viewer-controller.svelte";
  import type { MandalaPathShape, MandalaPresetId } from "$lib/shared/mandala/domain/mandala-types";

  interface Props {
    ctrl: MandalaViewerController;
    /** Reports the dock's measured height so the consumer can reserve stage room. */
    onHeightChange?: (px: number) => void;
  }
  let { ctrl, onHeightChange }: Props = $props();

  // Reduced-motion gate for JS (Svelte) transitions.
  let reduceMotion = $state(false);
  $effect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reduceMotion = mq.matches;
    const onChange = () => (reduceMotion = mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  });
  const dur = (ms: number) => (reduceMotion ? 0 : ms);

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
  let downloadOpen = $state(false);
  function toggleCat(id: CatId) {
    activeCat = activeCat === id ? null : id;
    if (activeCat) downloadOpen = false;
  }
  function toggleDownload() {
    downloadOpen = !downloadOpen;
    if (downloadOpen) activeCat = null;
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
  const PRESETS: { id: MandalaPresetId; label: string }[] = [
    { id: "aurora", label: "Aurora" },
    { id: "neon", label: "Neon" },
    { id: "ember", label: "Ember" },
    { id: "ice", label: "Ice" },
  ];
  const presetLabel = $derived(PRESETS.find((p) => p.id === ctrl.preset)?.label ?? "Custom");

  const FIDELITIES: { value: 720 | 1080 | 2160; label: string }[] = [
    { value: 720, label: "HD" },
    { value: 1080, label: "Full HD" },
    { value: 2160, label: "4K" },
  ];
  const EXPORT_FPS: (30 | 60)[] = [30, 60];

  function formatEstimate(seconds: number): string {
    const s = Math.max(0, Math.round(seconds));
    if (s < 60) return `${s}s`;
    return `${Math.floor(s / 60)}m ${s % 60}s`;
  }
  const estimateLabel = $derived(`${ctrl.hasMetrics ? "~" : "≈"}${formatEstimate(ctrl.estimateSeconds)}`);

  // Hidden native color inputs (styled chips trigger the OS picker).
  let blueInputEl: HTMLInputElement | undefined = $state();
  let redInputEl: HTMLInputElement | undefined = $state();
  let presetsOpen = $state(false);

  // Measure: own height (→ consumer stage padding); parent width (→ desktop
  // floating layout). Measuring the parent for width avoids a feedback loop with
  // the dock's own width changing under .wide.
  let dockEl: HTMLDivElement | undefined = $state();
  let wide = $state(false);
  $effect(() => {
    if (!dockEl) return;
    const parent = dockEl.parentElement;
    const hRo = new ResizeObserver((entries) => {
      const e = entries[0];
      if (e) onHeightChange?.(Math.ceil(e.contentRect.height));
    });
    hRo.observe(dockEl);
    let wRo: ResizeObserver | undefined;
    if (parent) {
      wRo = new ResizeObserver((entries) => {
        const e = entries[0];
        if (e) wide = e.contentRect.width >= 700;
      });
      wRo.observe(parent);
    }
    return () => {
      hRo.disconnect();
      wRo?.disconnect();
    };
  });
</script>

<div class="dock" class:wide data-swipe-block bind:this={dockEl}>
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

  {#if downloadOpen}
    <div class="tray download-tray" transition:slide={{ duration: dur(260), easing: cubicOut }}>
      <div class="dl-row">
        <span class="dl-label">Loops</span>
        <input type="range" min="1" max="10" step="1" value={ctrl.exportReps} oninput={(e) => (ctrl.exportReps = Number((e.target as HTMLInputElement).value))} class="slider" aria-label="Repetitions" />
        <span class="slider-value">{ctrl.exportReps}×</span>
      </div>
      <div class="dl-row">
        <span class="dl-label">Fidelity</span>
        <div class="tray-chips">
          {#each FIDELITIES as f}
            <button class="chip" class:active={ctrl.exportResolution === f.value} onclick={() => (ctrl.exportResolution = f.value)} aria-pressed={ctrl.exportResolution === f.value}>{f.label}</button>
          {/each}
        </div>
      </div>
      <div class="dl-row">
        <span class="dl-label">FPS</span>
        <div class="tray-chips">
          {#each EXPORT_FPS as f}
            <button class="chip" class:active={ctrl.exportFps === f} onclick={() => (ctrl.exportFps = f)} aria-pressed={ctrl.exportFps === f}>{f}</button>
          {/each}
        </div>
      </div>
      <div class="dl-foot">
        <span class="dl-estimate"><i class="fas fa-clock" aria-hidden="true"></i> {estimateLabel} · {ctrl.exportFrameCount} frames</span>
        <button class="dl-export" onclick={() => { downloadOpen = false; ctrl.startExport(); }}>
          <i class="fas fa-film" aria-hidden="true"></i> Export MP4
        </button>
      </div>
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
      class:active={downloadOpen}
      onclick={toggleDownload}
      aria-pressed={downloadOpen}
      aria-label="Download options"
    >
      <i class="fas fa-download" aria-hidden="true"></i>
    </button>
  </div>
</div>

<style>
  .dock {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 5;
    display: flex;
    flex-direction: column;
  }
  /* Desktop: centered floating bar instead of a full-width sheet. */
  .dock.wide {
    left: 50%;
    right: auto;
    transform: translateX(-50%);
    width: min(640px, calc(100% - 32px));
    bottom: 16px;
    border-radius: 18px;
    overflow: hidden;
    box-shadow: 0 18px 50px rgba(0, 0, 0, 0.45);
  }
  .dock.wide .cat-bar { border-top: none; }

  .tray {
    padding: 12px 12px 8px;
    background: color-mix(in srgb, var(--theme-panel-bg, rgba(18, 18, 28, 0.96)) 92%, transparent);
    backdrop-filter: blur(16px);
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .tray-chips { display: flex; gap: 6px; }
  .tray-slider { display: flex; align-items: center; gap: 12px; }
  .tray-colors { display: flex; flex-direction: column; gap: 10px; }
  .colors-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
  .mode-toggle { display: flex; gap: 6px; }
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
  .palette-chip { width: 28px; height: 18px; border-radius: 6px; box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.25); }
  .palette-name { font-size: 12px; font-weight: 600; }
  .palette-toggle i { font-size: 10px; opacity: 0.55; }
  .preset-row { display: flex; gap: 8px; }
  .custom-flow { display: flex; flex-direction: column; gap: 10px; }
  .flow-preview {
    display: block;
    width: 100%;
    height: 14px;
    border-radius: 999px;
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.12), 0 2px 8px rgba(0, 0, 0, 0.35);
  }
  .flow-stops { display: flex; gap: 10px; }
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
  .color-chip:focus-visible { outline: 2px solid color-mix(in srgb, var(--c) 70%, white); outline-offset: 2px; }
  .chip-swatch {
    flex: 0 0 auto;
    width: 34px;
    height: 34px;
    border-radius: 9px;
    background: var(--c);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.25), 0 2px 6px color-mix(in srgb, var(--c) 45%, transparent);
    color: rgba(255, 255, 255, 0.95);
    font-size: 12px;
  }
  .chip-swatch i { filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.6)); }
  .chip-meta { display: flex; flex-direction: column; gap: 1px; min-width: 0; text-align: left; }
  .chip-name { font-size: 11px; font-weight: 600; color: var(--theme-text-dim, rgba(255, 255, 255, 0.6)); }
  .chip-hex {
    font-size: 12px;
    font-weight: 600;
    font-family: ui-monospace, "SF Mono", monospace;
    color: var(--theme-text, #ffffff);
    letter-spacing: 0.02em;
  }
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
    transition: background 200ms ease, border-color 200ms ease, color 200ms ease, transform 140ms cubic-bezier(0.2, 0.8, 0.2, 1);
  }
  .chip:active { transform: scale(0.94); }
  .chip.mini { flex: 0 0 auto; min-height: 36px; padding: 6px 14px; font-size: 12px; }
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
    transition: border-color 200ms ease, box-shadow 200ms ease, transform 200ms cubic-bezier(0.2, 0.8, 0.2, 1);
  }
  .swatch:active .swatch-fill { transform: scale(0.93); }
  .swatch.active .swatch-fill {
    border-color: white;
    transform: translateY(-2px);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--theme-accent, #6366f1) 60%, transparent), 0 6px 16px rgba(0, 0, 0, 0.4);
  }
  .swatch-label { font-size: 10px; font-weight: 600; color: var(--theme-text-dim, rgba(255, 255, 255, 0.55)); }
  .swatch.active .swatch-label { color: var(--theme-text, white); }
  .dot { width: 14px; height: 14px; border-radius: 50%; border: 1px solid rgba(255, 255, 255, 0.2); }

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

  .cat-bar {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 6px;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.96));
    backdrop-filter: blur(16px);
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }
  .cat-scroll { display: flex; flex: 1; min-width: 0; gap: 4px; }

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
    transition: background 220ms ease, border-color 220ms ease, color 220ms ease, transform 150ms cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 220ms ease;
  }
  .dock-btn:active { transform: scale(0.92); }
  .dock-btn i { font-size: 16px; transition: transform 200ms cubic-bezier(0.2, 0.8, 0.2, 1); }
  .dock-btn.cat.active i { transform: translateY(-1px) scale(1.08); }
  .dock-btn.cat { flex: 1 1 0; min-width: 0; padding: 6px 2px; }
  .cat-label {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.02em;
    white-space: nowrap;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .cat-dots { display: flex; gap: 2px; }
  .dock-btn.cat.active {
    background: color-mix(in srgb, var(--theme-accent, #6366f1) 35%, var(--theme-card-bg, rgba(0, 0, 0, 0.4)));
    border-color: color-mix(in srgb, var(--theme-accent, #6366f1) 60%, transparent);
    color: white;
    transform: translateY(-1px);
  }
  .dock-btn.download {
    flex: 0 0 auto;
    width: 46px;
    border-color: color-mix(in srgb, var(--theme-accent, #6366f1) 50%, transparent);
    background: color-mix(in srgb, var(--theme-accent, #6366f1) 25%, var(--theme-card-bg, rgba(0, 0, 0, 0.4)));
    color: white;
  }
  .dock-btn.download.active {
    background: color-mix(in srgb, var(--theme-accent, #6366f1) 45%, var(--theme-card-bg, rgba(0, 0, 0, 0.4)));
    border-color: color-mix(in srgb, var(--theme-accent, #6366f1) 75%, transparent);
  }

  /* Download config tray */
  .download-tray { display: flex; flex-direction: column; gap: 10px; }
  .dl-row { display: flex; align-items: center; gap: 12px; }
  .dl-label { flex: 0 0 64px; font-size: 12px; font-weight: 600; color: var(--theme-text-dim, rgba(255, 255, 255, 0.6)); }
  .dl-row .tray-chips { flex: 1; }
  .dl-foot { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 2px; }
  .dl-estimate {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-variant-numeric: tabular-nums;
  }
  .dl-estimate i { font-size: 11px; opacity: 0.7; }
  .dl-export {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 44px;
    padding: 8px 18px;
    border-radius: 12px;
    border: 1px solid color-mix(in srgb, var(--theme-accent, #6366f1) 70%, transparent);
    background: color-mix(in srgb, var(--theme-accent, #6366f1) 35%, var(--theme-card-bg, rgba(0, 0, 0, 0.4)));
    color: white;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: transform 140ms cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 200ms ease, background 200ms ease;
  }
  .dl-export:active { transform: scale(0.95); }

  /* Staggered entrance for tray controls. */
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
    .dock-btn.download:hover {
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
    .dl-export:hover { transform: translateY(-2px); box-shadow: 0 6px 18px color-mix(in srgb, var(--theme-accent, #6366f1) 35%, transparent); }
  }

  @media (prefers-reduced-motion: reduce) {
    .tray { animation: none !important; }
    .tray-chips > *,
    .preset-row > *,
    .mode-toggle > *,
    .custom-flow > * { animation: none !important; }
    .chip:active, .swatch:active .swatch-fill, .dock-btn:active { transform: none; }
    .dl-export:active { transform: none; }
  }
</style>
