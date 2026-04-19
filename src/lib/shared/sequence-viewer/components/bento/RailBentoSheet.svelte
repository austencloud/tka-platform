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
    top: 60px;
    bottom: 8px;
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

  /* Common inner primitives used by sheet bodies */
  :global(.bento-sheet-body .rt-section) {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  :global(.bento-sheet-body .rt-section-label) {
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.45);
  }

  :global(.bento-sheet-body .rt-chip-row) {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }

  :global(.bento-sheet-body .rt-chip) {
    flex: 1;
    min-height: 38px;
    min-width: 44px;
    padding: 6px 12px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 10px;
    font-size: 12px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.65);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: all 150ms ease;
  }

  :global(.bento-sheet-body .rt-chip[aria-pressed="true"]) {
    background: color-mix(in srgb, #4a9eff 22%, rgba(20, 22, 32, 0.6));
    border-color: color-mix(in srgb, #4a9eff 55%, transparent);
    color: #c5ddff;
  }

  :global(.bento-sheet-body .rt-row) {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 12px;
    padding: 8px 12px;
    min-height: 48px;
  }

  :global(.bento-sheet-body .rt-row-label) {
    font-size: 10px;
    font-weight: 700;
    color: rgba(255, 255, 255, 0.7);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  @media (prefers-reduced-motion: reduce) {
    .bento-sheet-close,
    :global(.bento-sheet-body .rt-chip) {
      transition: none;
    }
  }
</style>
