<!--
  RailBentoSheet.svelte

  Slide-up sheet that opens from the bottom of the preview area when a
  primary bento tile is tapped. Shared chrome: backdrop, header with title
  + close, body slot.

  Caller is responsible for mounting this conditionally (so the transition
  fires on mount) and for providing the body content via the `children`
  snippet.
-->
<script lang="ts">
  import { fade, fly } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import type { Snippet } from "svelte";

  interface Props {
    title: string;
    onClose: () => void;
    children: Snippet;
  }

  let { title, onClose, children }: Props = $props();

  function onBackdropClick() {
    onClose();
  }

  function onSheetKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  }

  // Portal action: moves the element to document.body so the fixed-positioned
  // sheet isn't trapped inside a parent stacking context. The viewer wraps
  // this panel in containers that create stacking contexts (transforms, z-index,
  // flex layouts), which would otherwise clip the "fixed" sheet to a parent's
  // height instead of the viewport.
  function portal(node: HTMLElement) {
    document.body.appendChild(node);
    return {
      destroy() {
        node.remove();
      },
    };
  }
</script>

<div use:portal class="bento-portal">
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <button
    type="button"
    class="bento-backdrop"
    aria-label="Close {title}"
    tabindex="-1"
    onclick={onBackdropClick}
    transition:fade={{ duration: 180 }}
  ></button>

  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div
    class="bento-sheet"
    role="dialog"
    aria-modal="true"
    aria-label={title}
    tabindex="-1"
    onkeydown={onSheetKeydown}
    transition:fly={{ y: 80, duration: 240, easing: cubicOut }}
  >
    <div class="bento-sheet-head">
      <span class="bento-sheet-title">{title}</span>
      <button
        type="button"
        class="bento-sheet-close"
        onclick={onClose}
        aria-label="Close {title}"
      >
        <i class="fas fa-times" aria-hidden="true"></i>
      </button>
    </div>

    <div class="bento-sheet-body">
      {@render children()}
    </div>
  </div>
</div>

<style>
  .bento-portal {
    position: fixed;
    inset: 0;
    z-index: 2147483645;
    pointer-events: none;
  }

  .bento-portal > * {
    pointer-events: auto;
  }

  .bento-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.65);
    z-index: 2147483645;
    cursor: pointer;
    border: none;
    padding: 0;
    -webkit-tap-highlight-color: transparent;
  }

  .bento-sheet {
    position: fixed;
    left: 8px;
    right: 8px;
    bottom: 8px;
    max-height: 85vh;
    z-index: 2147483646;
    background: #0d1018;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 16px;
    box-shadow: 0 -8px 32px rgba(0, 0, 0, 0.6);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .bento-sheet-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 12px 8px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  .bento-sheet-title {
    font-size: 11px;
    font-weight: 700;
    color: rgba(255, 255, 255, 0.9);
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  .bento-sheet-close {
    width: 28px;
    height: 28px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.55);
    font-size: 11px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    -webkit-tap-highlight-color: transparent;
    transition: all 150ms ease;
  }

  .bento-sheet-close:hover {
    background: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.9);
  }

  .bento-sheet-body {
    padding: 12px;
    overflow-y: auto;
    overscroll-behavior: contain;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  /* The .rt-section / .rt-section-label / .rt-chip-row / .rt-chip / .rt-row /
     .rt-row-label primitives now live in rail-tile.css so they apply equally
     in the .bento-sheet-body and the desktop .pill-body-inline contexts. */

  @media (prefers-reduced-motion: reduce) {
    .bento-sheet-close {
      transition: none;
    }
  }
</style>
