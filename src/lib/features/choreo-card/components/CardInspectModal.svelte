<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { Snippet } from "svelte";
  import { getImageCompositionManager } from "$lib/shared/share/state/image-composition-state.svelte";
  import CardPreviewStack from "./designer/CardPreviewStack.svelte";
  import TKAWordGlyph from "$lib/shared/choreo-card/components/TKAWordGlyph.svelte";
  import { getCatalogLayoutPolicy } from "../domain/catalog-layout-policy";
  import { handleModuleChange } from "$lib/shared/navigation-coordinator/navigation-coordinator.svelte";
  import { toast } from "$lib/shared/toast/state/toast-state.svelte";

  interface Props {
    sequence: SequenceData;
    handPointsVisible?: boolean;
    showGrid?: boolean;
    showTKA?: boolean;
    showWord?: boolean;
    includeStartPosition?: boolean;
    onClose: () => void;
    onContextMenu?: (x: number, y: number, rerender: () => void) => void;
    frontImageUrl?: string | null;
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
  let copyImageState = $state<"idle" | "copying" | "success" | "error">("idle");

  let imageResetTimer: ReturnType<typeof setTimeout>;
  let imageErrorTimer: ReturnType<typeof setTimeout>;
  onDestroy(() => {
    clearTimeout(imageResetTimer);
    clearTimeout(imageErrorTimer);
  });

  const word = $derived(sequence.word ?? sequence.name ?? '');

  const imageComposition = getImageCompositionManager();
  let compositionVersion = $state(0);
  function onCompositionChanged(): void { compositionVersion++; }
  onMount(() => {
    imageComposition.registerObserver(onCompositionChanged);
  });
  onDestroy(() => imageComposition.unregisterObserver(onCompositionChanged));

  const showQRCode = $derived.by(() => { void compositionVersion; return imageComposition.showQRCode; });

  function editSequence() {
    localStorage.setItem("tka-pending-edit-sequence", JSON.stringify(sequence));
    onClose();
    toast.info("Opening for editing...", 2000);
    void handleModuleChange("create", "construct");
  }

  async function copyCardImage() {
    if (copyImageState === "copying" || !stackEl) return;
    copyImageState = "copying";
    try {
      const { domToBlob } = await import("modern-screenshot");
      const blob = await domToBlob(stackEl, { scale: 2 });
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

    <div class="stack-wrapper" bind:this={stackEl} role="group" aria-label="Card preview">
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

    <div class="bottom-bar">
      <div class="actions">
        <button class="action-btn edit-btn" onclick={editSequence} aria-label="Open sequence in construct for full editing">
          <i class="fas fa-pen-to-square"></i> Edit in Construct
        </button>
        <button class="action-btn copy-image-btn" onclick={copyCardImage} disabled={copyImageState === "copying"} aria-label="Copy image">
          {#if copyImageState === "copying"}
            <i class="fas fa-spinner fa-spin"></i> Capturing...
          {:else if copyImageState === "success"}
            <i class="fas fa-check"></i> Copied!
          {:else if copyImageState === "error"}
            <i class="fas fa-times"></i> Failed
          {:else}
            <i class="fas fa-image"></i> Copy Image
          {/if}
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

  .actions {
    display: flex;
    gap: 8px;
  }

  .action-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 18px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 6px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    font-size: 13px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .action-btn:hover {
    background: var(--theme-stroke, rgba(255, 255, 255, 0.1));
    color: var(--theme-text, rgba(255, 255, 255, 0.9));
    border-color: var(--theme-text-dim, rgba(255, 255, 255, 0.2));
  }

  .edit-btn {
    background: linear-gradient(135deg, rgba(124, 58, 237, 0.15), rgba(124, 58, 237, 0.05));
    border-color: rgba(124, 58, 237, 0.3);
    color: rgba(124, 58, 237, 0.9);
  }

  .edit-btn:hover {
    background: linear-gradient(135deg, rgba(124, 58, 237, 0.25), rgba(124, 58, 237, 0.1));
    border-color: rgba(124, 58, 237, 0.5);
    color: #fff;
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

  .copy-image-btn:hover {
    background: rgba(59, 130, 246, 0.15);
    border-color: rgba(59, 130, 246, 0.35);
    color: #fff;
  }

  @media (prefers-reduced-motion: reduce) {
    .modal-backdrop { animation: none; }
  }
</style>
