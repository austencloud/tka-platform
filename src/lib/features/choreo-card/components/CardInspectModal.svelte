<!--
  CardInspectModal - Full-screen modal for inspecting a card's front and back.
  Uses CardPreviewStack from the card designer for side-by-side display.
-->
<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { Snippet } from "svelte";
  import { getClaudeCodeCopier } from "$lib/shared/browse/getClaudeCodeCopier";
  import { getImageCompositionManager } from "$lib/shared/share/state/image-composition-state.svelte";
  import CardPreviewStack from "./designer/CardPreviewStack.svelte";
  import TKAWordGlyph from "$lib/shared/choreo-card/components/TKAWordGlyph.svelte";
  import { getCatalogLayoutPolicy } from "../domain/catalog-layout-policy";

  interface Props {
    sequence: SequenceData;
    handPointsVisible?: boolean;
    showGrid?: boolean;
    showTKA?: boolean;
    showWord?: boolean;
    includeStartPosition?: boolean;
    onClose: () => void;
    onContextMenu?: (x: number, y: number, rerender: () => void) => void;
    /** Pre-rendered front image URL from the grid card - shows this instead of re-rendering */
    frontImageUrl?: string | null;
    /** Additional action buttons rendered in the bottom bar */
    extraActions?: Snippet;
  }

  let {
    sequence,
    handPointsVisible = true,
    showGrid = true,
    showTKA = true,
    showWord = true,
    includeStartPosition = true,
    onClose,
    onContextMenu,
    frontImageUrl,
    extraActions,
  }: Props = $props();

  let stackEl: HTMLDivElement | undefined = $state();

  // Copy state
  let copyDataState = $state<"idle" | "success" | "error">("idle");
  let copyImageState = $state<"idle" | "copying" | "success" | "error">("idle");

  let dataResetTimer: ReturnType<typeof setTimeout>;
  let dataErrorTimer: ReturnType<typeof setTimeout>;
  let imageResetTimer: ReturnType<typeof setTimeout>;
  let imageErrorTimer: ReturnType<typeof setTimeout>;
  onDestroy(() => {
    clearTimeout(dataResetTimer);
    clearTimeout(dataErrorTimer);
    clearTimeout(imageResetTimer);
    clearTimeout(imageErrorTimer);
  });

  const word = $derived(sequence.word ?? sequence.name ?? '');

  // QR code visibility - follows the user's global visibility setting so turning it off
  // in the settings panel removes it from the export modal too.
  const imageComposition = getImageCompositionManager();
  let compositionVersion = $state(0);
  function onCompositionChanged(): void { compositionVersion++; }
  onMount(() => {
    imageComposition.registerObserver(onCompositionChanged);
  });
  onDestroy(() => imageComposition.unregisterObserver(onCompositionChanged));

  const showQRCode = $derived.by(() => { void compositionVersion; return imageComposition.showQRCode; });
  function toggleQRCode() { imageComposition.setShowQRCode(!showQRCode); }

  /** Copy sequence data in Claude-optimized compact format */
  async function copySequenceData() {
    try {
      const copier = getClaudeCodeCopier();
      const result = await copier.copyForClaude(sequence);
      copyDataState = result.success ? "success" : "error";
      clearTimeout(dataResetTimer);
      dataResetTimer = setTimeout(() => { copyDataState = "idle"; }, 2000);
    } catch {
      copyDataState = "error";
      clearTimeout(dataErrorTimer);
      dataErrorTimer = setTimeout(() => { copyDataState = "idle"; }, 2000);
    }
  }

  /** Capture the card stack as a PNG image and copy to clipboard */
  async function copyCardImage() {
    if (copyImageState === "copying" || !stackEl) return;
    copyImageState = "copying";
    try {
      const { domToBlob } = await import("modern-screenshot");
      const blob = await domToBlob(stackEl, {
        scale: 2,
      });
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);
      copyImageState = "success";
      clearTimeout(imageResetTimer);
      imageResetTimer = setTimeout(() => { copyImageState = "idle"; }, 2000);
    } catch {
      copyImageState = "error";
      clearTimeout(imageErrorTimer);
      imageErrorTimer = setTimeout(() => { copyImageState = "idle"; }, 2000);
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onClose();
  }

  function handleBackdropClick(e: MouseEvent) {
    if ((e.target as HTMLElement).classList.contains('modal-backdrop')) {
      onClose();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="modal-backdrop" role="presentation" onclick={handleBackdropClick}>
  <div class="modal-container" role="dialog" aria-modal="true" aria-labelledby="inspect-modal-title">
    <!-- Header -->
    <div class="modal-header">
      <h2 class="modal-title" id="inspect-modal-title">
        <TKAWordGlyph {word} height={28} darkMode />
      </h2>
      <p class="modal-hint">Front and back side by side</p>
    </div>

    <!-- Card stack - reuses the designer's CardPreviewStack -->
    <div class="stack-wrapper" bind:this={stackEl}>
      <CardPreviewStack
        {sequence}
        {handPointsVisible}
        {showGrid}
        {showTKA}
        {showWord}
        {includeStartPosition}
        startPositionLayout={getCatalogLayoutPolicy(sequence.steps?.length ?? 0)}
        showBirthday={true}
        {showQRCode}
        showInfoCard={false}
        printMode={true}
        {frontImageUrl}
        onCardContextMenu={onContextMenu}
      />
    </div>

    <!-- Actions + keyboard hints -->
    <div class="bottom-bar">
      <div class="copy-actions">
        <button class="copy-btn" onclick={copySequenceData} aria-label="Copy sequence data">
          {#if copyDataState === "success"}
            <i class="fas fa-check"></i> Copied
          {:else if copyDataState === "error"}
            <i class="fas fa-times"></i> Failed
          {:else}
            <i class="fas fa-code"></i> Copy Data
          {/if}
        </button>
        <button
          class="copy-btn"
          onclick={copyCardImage}
          disabled={copyImageState === "copying"}
          aria-label="Copy card image"
        >
          {#if copyImageState === "copying"}
            <i class="fas fa-spinner fa-spin"></i> Capturing...
          {:else if copyImageState === "success"}
            <i class="fas fa-check"></i> Copied
          {:else if copyImageState === "error"}
            <i class="fas fa-times"></i> Failed
          {:else}
            <i class="fas fa-image"></i> Copy Image
          {/if}
        </button>
        <button
          class="copy-btn toggle-btn"
          class:on={showQRCode}
          onclick={toggleQRCode}
          aria-pressed={showQRCode}
          aria-label="Toggle QR code"
        >
          <i class="fas fa-qrcode"></i> QR {showQRCode ? "On" : "Off"}
        </button>
        {#if extraActions}
          {@render extraActions()}
        {/if}
      </div>
      <div class="hints">
        <span><kbd>Esc</kbd> close</span>
      </div>
    </div>
  </div>

  <!-- Close button -->
  <button class="close-btn" onclick={onClose} aria-label="Close">
    <i class="fas fa-times"></i>
  </button>
</div>

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: var(--z-modal);
    background: var(--theme-overlay-bg, rgba(0, 0, 0, 0.88));
    display: flex;
    align-items: center;
    justify-content: center;
    animation: fadeIn 200ms ease-out;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .modal-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px;
    width: 90vw;
    height: 90vh;
    max-width: 1600px;
  }

  .modal-header {
    text-align: center;
    flex-shrink: 0;
  }

  .modal-title {
    font-size: 28px;
    font-weight: 600;
    color: var(--theme-text, rgba(255, 255, 255, 0.8));
    letter-spacing: 1.5px;
    margin: 0 0 4px 0;
  }

  .modal-hint {
    font-size: 12px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.2));
    margin: 0;
  }

  .stack-wrapper {
    flex: 1;
    width: 100%;
    min-height: 0;
  }

  .close-btn {
    position: fixed;
    top: 20px;
    right: 20px;
    width: 44px;
    height: 44px;
    border: none;
    border-radius: 50%;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    font-size: 20px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
    z-index: calc(var(--z-modal) + 1);
  }

  .close-btn:hover {
    background: var(--theme-stroke, rgba(255, 255, 255, 0.12));
    color: var(--theme-text, #fff);
  }

  .bottom-bar {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
  }

  .copy-actions {
    display: flex;
    gap: 8px;
  }

  .copy-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 14px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 6px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    font-size: 12px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .copy-btn:hover:not(:disabled) {
    background: var(--theme-stroke, rgba(255, 255, 255, 0.1));
    color: var(--theme-text, rgba(255, 255, 255, 0.8));
    border-color: var(--theme-text-dim, rgba(255, 255, 255, 0.2));
  }

  .copy-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .toggle-btn.on {
    background: var(--theme-accent-bg, rgba(110, 180, 255, 0.14));
    border-color: var(--theme-accent, rgba(110, 180, 255, 0.35));
    color: var(--theme-text, rgba(200, 225, 255, 0.9));
  }

  .toggle-btn.on:hover {
    background: var(--theme-accent-glow, rgba(110, 180, 255, 0.22));
    border-color: var(--theme-accent-strong, rgba(110, 180, 255, 0.55));
    color: var(--theme-text, #fff);
  }

  .hints {
    display: flex;
    gap: 16px;
    font-size: 12px;
    color: var(--theme-stroke, rgba(255, 255, 255, 0.12));
    flex-shrink: 0;
  }

  .hints kbd {
    display: inline-block;
    padding: 1px 5px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    border-radius: 3px;
    font-family: inherit;
    font-size: 12px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.25));
    margin-right: 4px;
  }

  @media (prefers-reduced-motion: reduce) {
    .modal-backdrop { animation: none; }
  }
</style>
