<script lang="ts">
  import { fly, fade } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import type { Snippet } from "svelte";
  import { createSheetDismiss } from "./sheet-dismiss";

  interface Props {
    open: boolean;
    title: string;
    accentColor?: string;
    /** When true a dim backdrop is shown. Default false so the live 3D scene
     *  stays visible/interactive behind the sheet for prop/effort previews. */
    backdrop?: boolean;
    onClose: () => void;
    children: Snippet;
  }

  // open is parent-owned (one-way); the sheet signals dismissal via onClose, so
  // a plain prop is honest here — it never writes back.
  let {
    open,
    title,
    accentColor = "#4a9eff",
    backdrop = false,
    onClose,
    children,
  }: Props = $props();

  let panelEl = $state<HTMLElement | null>(null);
  const dismiss = createSheetDismiss(
    () => onClose(),
    () => panelEl
  );
</script>

<svelte:window
  onkeydown={(e) => {
    if (open) dismiss.onKeydown(e);
  }}
/>

{#if open}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="sheet-layer"
    class:has-backdrop={backdrop}
    onpointerdown={dismiss.onBackdropPointerDown}
    transition:fade={{ duration: 120 }}
  >
    <div
      bind:this={panelEl}
      class="sheet-panel"
      style:--sheet-accent={accentColor}
      role="dialog"
      aria-modal="false"
      aria-label={title}
      transition:fly={{ y: 320, duration: 260, easing: cubicOut }}
    >
      <div class="grab-handle" aria-hidden="true"></div>
      <header class="sheet-header">
        <span class="sheet-title">{title}</span>
        <button
          class="sheet-close"
          aria-label="Close {title}"
          onclick={onClose}
        >
          <i class="fas fa-chevron-down close-bottom" aria-hidden="true"></i>
          <i class="fas fa-xmark close-panel" aria-hidden="true"></i>
        </button>
      </header>
      <div class="sheet-body">
        {@render children()}
      </div>
    </div>
  </div>
{/if}

<style>
  /* Absolute, not fixed: the layer resolves against the positioned
     .compact-controls workspace layer, so the sheet stays inside the 3D
     pane and never slides under the app shell's side/bottom navigation. */
  .sheet-layer {
    position: absolute;
    top: 0;
    right: 0;
    bottom: max(6.875rem, calc(env(safe-area-inset-bottom) + 6.875rem));
    left: 0;
    z-index: 40;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    pointer-events: none; /* only the panel is interactive when no backdrop */
  }
  .sheet-layer.has-backdrop {
    background: rgba(0, 0, 0, 0.45);
    pointer-events: auto;
  }
  .sheet-panel {
    display: flex;
    flex-direction: column;
    pointer-events: auto;
    width: 100%;
    max-height: min(78dvh, 48rem, 100%);
    overflow: hidden;
    background: var(--theme-panel-bg, #0c0e16);
    border-top: 1px solid
      color-mix(in srgb, var(--sheet-accent) 30%, rgba(255, 255, 255, 0.12));
    border-radius: 18px 18px 0 0;
    box-shadow: 0 -12px 48px rgba(0, 0, 0, 0.7);
    padding-bottom: env(safe-area-inset-bottom, 0px);
  }
  .grab-handle {
    width: 40px;
    height: 4px;
    border-radius: 2px;
    background: rgba(255, 255, 255, 0.25);
    margin: 8px auto 4px;
  }
  .sheet-header {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 14px 10px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }
  .sheet-title {
    font-size: var(--font-size-compact, 12px);
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.55);
  }
  .sheet-close {
    width: 44px;
    height: 44px;
    border: none;
    background: transparent;
    color: rgba(255, 255, 255, 0.6);
    border-radius: 10px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .sheet-close:hover,
  .sheet-close:focus-visible,
  .sheet-close:active {
    background: rgba(255, 255, 255, 0.08);
    color: #fff;
  }
  .sheet-close:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--sheet-accent) 70%, #fff);
    outline-offset: 2px;
  }
  .close-panel {
    display: none;
  }
  .sheet-body {
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 12px 14px 18px;
  }

  @media (max-height: 34rem) {
    .sheet-layer {
      bottom: max(3.875rem, calc(env(safe-area-inset-bottom) + 3.875rem));
    }
  }

  /* On wider viewports the same control surface becomes a bounded panel. It
     stays above the dock, leaving the performance visible and interactive. */
  @media (min-width: 48rem) and (min-height: 34rem) {
    .sheet-layer {
      align-items: flex-end;
      padding: max(1rem, env(safe-area-inset-top))
        max(1rem, env(safe-area-inset-right))
        max(5.5rem, calc(env(safe-area-inset-bottom) + 5.5rem))
        max(1rem, env(safe-area-inset-left));
    }
    .sheet-panel {
      width: clamp(28rem, 34vw, 42rem);
      max-width: 100%;
      max-height: min(calc(100dvh - 7.5rem), 100%);
      padding-bottom: 0;
      border: 1px solid
        color-mix(in srgb, var(--sheet-accent) 30%, rgba(255, 255, 255, 0.12));
      border-radius: 18px;
      box-shadow: 0 18px 60px rgba(0, 0, 0, 0.62);
    }
    .grab-handle {
      display: none;
    }
    .sheet-header {
      padding: 8px 10px 8px 16px;
    }
    .close-bottom {
      display: none;
    }
    .close-panel {
      display: inline-block;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .sheet-panel {
      transition: none;
    }
  }
</style>
