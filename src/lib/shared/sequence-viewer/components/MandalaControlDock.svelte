<script lang="ts">
  import { slide, fly } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import type { MandalaViewerController } from "../state/mandala-viewer-controller.svelte";
  import MandalaCategoryControl from "./mandala/MandalaCategoryControl.svelte";

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

<div
  class="dock"
  class:wide
  data-swipe-block
  bind:this={dockEl}
  in:fly={{ y: 80, duration: dur(250), easing: cubicOut }}
  out:fly={{ y: 80, duration: dur(200), easing: cubicOut }}
>
  {#if activeCat}
    <div class="tray" transition:slide={{ duration: dur(260), easing: cubicOut }}>
      <MandalaCategoryControl {ctrl} category={activeCat} />
    </div>
  {/if}

  {#if downloadOpen}
    <div class="tray" transition:slide={{ duration: dur(260), easing: cubicOut }}>
      <MandalaCategoryControl
        {ctrl}
        category="download"
        onExport={() => { downloadOpen = false; ctrl.startExport(); }}
      />
    </div>
  {/if}

  <div class="cat-bar">
    <div class="cat-scroll">
      {#each CATS as c, i}
        <button class="dock-btn cat" class:active={activeCat === c.id} style:--btn-i={i} onclick={() => toggleCat(c.id)} aria-pressed={activeCat === c.id}>
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
      style:--btn-i={CATS.length}
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

  .dot { width: 14px; height: 14px; border-radius: 50%; border: 1px solid rgba(255, 255, 255, 0.2); }

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
    /* Staggered entrance, matching the shared ControlDock. */
    animation: popIn 360ms cubic-bezier(0.2, 0.8, 0.2, 1) backwards;
    animation-delay: calc(var(--btn-i, 0) * 45ms + 90ms);
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
  }

  @media (prefers-reduced-motion: reduce) {
    .tray { animation: none !important; }
    .dock-btn:active { transform: none; }
    .dock-btn { animation: none !important; }
  }
</style>
