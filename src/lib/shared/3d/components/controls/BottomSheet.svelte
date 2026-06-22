<script module lang="ts">
  /**
   * Dismiss contract for the bottom sheet, extracted so it's unit-testable
   * without mounting Svelte. Escape closes; a pointerdown outside the panel
   * closes; pointerdown inside is ignored.
   */
  export function createSheetDismiss(
    onClose: () => void,
    getPanel: () => HTMLElement | null = () => null,
  ) {
    return {
      onKeydown(e: KeyboardEvent) {
        if (e.key === "Escape") onClose();
      },
      onBackdropPointerDown(e: PointerEvent) {
        const panel = getPanel();
        if (panel && e.target instanceof Node && panel.contains(e.target)) return;
        onClose();
      },
    };
  }
</script>

<script lang="ts">
  import { fly, fade } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import type { Snippet } from "svelte";

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

  let { open = $bindable(), title, accentColor = "#4a9eff", backdrop = false, onClose, children }: Props = $props();

  let panelEl = $state<HTMLElement | null>(null);
  const dismiss = createSheetDismiss(onClose, () => panelEl);
</script>

<svelte:window onkeydown={(e) => { if (open) dismiss.onKeydown(e); }} />

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
        <button class="sheet-close" aria-label="Close {title}" onclick={onClose}>
          <i class="fas fa-chevron-down"></i>
        </button>
      </header>
      <div class="sheet-body">
        {@render children()}
      </div>
    </div>
  </div>
{/if}

<style>
  .sheet-layer {
    position: absolute;
    inset: 0;
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
    pointer-events: auto;
    width: 100%;
    max-height: 70vh;
    overflow-y: auto;
    background: #0c0e16;
    border-top: 1px solid color-mix(in srgb, var(--sheet-accent) 30%, rgba(255, 255, 255, 0.12));
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
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 14px 10px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }
  .sheet-title {
    font-size: 11px;
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
  .sheet-close:active { background: rgba(255, 255, 255, 0.08); }
  .sheet-body { padding: 12px 14px 18px; }

  @media (prefers-reduced-motion: reduce) {
    .sheet-panel { transition: none; }
  }
</style>
