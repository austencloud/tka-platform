<!--
  CardInspectModal — Full-screen modal for inspecting a card's front and back.
  Uses CardPreviewStack from the card designer for the focus/toggle interaction.
-->
<script lang="ts">
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import { container as di } from "$lib/shared/di";
  import CardPreviewStack from "./designer/CardPreviewStack.svelte";

  interface Props {
    sequence: SequenceData;
    handPointsVisible?: boolean;
    showGrid?: boolean;
    showTKA?: boolean;
    showWord?: boolean;
    includeStartPosition?: boolean;
    onClose: () => void;
    onContextMenu?: (x: number, y: number, rerender: () => void) => void;
    /** Pre-rendered front image URL from the grid card — shows this instead of re-rendering */
    frontImageUrl?: string | null;
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
  }: Props = $props();

  let focusedCard = $state<"front" | "back" | null>(null);
  let stackEl: HTMLDivElement | undefined = $state();

  // Copy state
  let copyDataState = $state<"idle" | "success" | "error">("idle");
  let copyImageState = $state<"idle" | "copying" | "success" | "error">("idle");

  const word = $derived(sequence.word ?? sequence.name ?? '');

  /** Copy sequence data in Claude-optimized compact format */
  async function copySequenceData() {
    try {
      const copier = di.items.claudeCodeCopier;
      const result = await copier.copyForClaude(sequence);
      copyDataState = result.success ? "success" : "error";
      setTimeout(() => { copyDataState = "idle"; }, 2000);
    } catch {
      copyDataState = "error";
      setTimeout(() => { copyDataState = "idle"; }, 2000);
    }
  }

  /** Capture the card stack as a PNG image and copy to clipboard */
  async function copyCardImage() {
    if (copyImageState === "copying" || !stackEl) return;
    copyImageState = "copying";
    try {
      // html2canvas is lazy-loaded — eagerly importing it violates CSP
      // (uses new Function for CSS parsing) and adds 200KB to the main chunk.
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(stackEl, {
        backgroundColor: null,
        scale: 2,
        useCORS: true,
      });
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => b ? resolve(b) : reject(new Error("toBlob returned null")),
          "image/png",
        );
      });
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);
      copyImageState = "success";
      setTimeout(() => { copyImageState = "idle"; }, 2000);
    } catch {
      copyImageState = "error";
      setTimeout(() => { copyImageState = "idle"; }, 2000);
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onClose();
    if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') focusedCard = 'front';
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') focusedCard = 'back';
    if (e.key === ' ') {
      e.preventDefault();
      focusedCard = focusedCard === null ? 'front' : focusedCard === 'front' ? 'back' : null;
    }
  }

  function handleBackdropClick(e: MouseEvent) {
    if ((e.target as HTMLElement).classList.contains('modal-backdrop')) {
      onClose();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="modal-backdrop" onclick={handleBackdropClick}>
  <div class="modal-container">
    <!-- Header -->
    <div class="modal-header">
      <h2 class="modal-title">{word}</h2>
      <p class="modal-hint">Click a card to focus it. Click again to reset.</p>
    </div>

    <!-- Card stack — reuses the designer's CardPreviewStack -->
    <div class="stack-wrapper" bind:this={stackEl}>
      <CardPreviewStack
        {sequence}
        {focusedCard}
        onFocusChange={(f) => { focusedCard = f; }}
        {handPointsVisible}
        {showGrid}
        {showTKA}
        {showWord}
        {includeStartPosition}
        startPositionLayout="row"
        showBirthday={true}
        showQRCode={true}
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
      </div>
      <div class="hints">
        <span><kbd>Esc</kbd> close</span>
        <span><kbd>Space</kbd> cycle focus</span>
        <span><kbd>&uarr;</kbd> front</span>
        <span><kbd>&darr;</kbd> back</span>
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
    z-index: 1000;
    background: rgba(0, 0, 0, 0.88);
    backdrop-filter: blur(12px);
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
    color: rgba(255, 255, 255, 0.8);
    letter-spacing: 1.5px;
    margin: 0 0 4px 0;
  }

  .modal-hint {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.2);
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
    background: rgba(255, 255, 255, 0.06);
    color: rgba(255, 255, 255, 0.5);
    font-size: 20px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
    z-index: 1001;
  }

  .close-btn:hover {
    background: rgba(255, 255, 255, 0.12);
    color: #fff;
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
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.04);
    color: rgba(255, 255, 255, 0.5);
    font-size: 12px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .copy-btn:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.8);
    border-color: rgba(255, 255, 255, 0.2);
  }

  .copy-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .hints {
    display: flex;
    gap: 16px;
    font-size: 11px;
    color: rgba(255, 255, 255, 0.12);
    flex-shrink: 0;
  }

  .hints kbd {
    display: inline-block;
    padding: 1px 5px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 3px;
    font-family: inherit;
    font-size: 10px;
    color: rgba(255, 255, 255, 0.25);
    margin-right: 4px;
  }

  @media (prefers-reduced-motion: reduce) {
    .modal-backdrop { animation: none; }
  }
</style>
