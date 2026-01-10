<!--
  SequencePreviewDialog.svelte

  A confirmation dialog that shows what sequence will be replaced and what it's being replaced with.
  Used when replacing an existing sequence in the Constructor tab.
-->
<script lang="ts">
  import { Dialog as DialogPrimitive } from "bits-ui";
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import { container } from "$lib/shared/di";
  import { onMount } from "svelte";
  import BeatGrid from "../../workspace-panel/sequence-display/components/BeatGrid.svelte";

  let {
    isOpen = $bindable(false),
    currentSequence,
    incomingSequence,
    onConfirm,
    onCancel,
  } = $props<{
    isOpen?: boolean;
    currentSequence: SequenceData | null | undefined;
    incomingSequence: SequenceData | null;
    onConfirm: () => void;
    onCancel: () => void;
  }>();

  // Services
  let hapticService: IHapticFeedback;

  onMount(() => {
    hapticService = container.items.hapticFeedback;
  });

  // Helper to get sequence display name
  function getSequenceName(seq: SequenceData | null | undefined): string {
    if (!seq) return "Unknown";
    if (seq.word) return seq.word;
    if (seq.name) return seq.name;
    const count = seq.beats?.length ?? 0;
    return count > 0 ? `${count}-beat sequence` : "Empty";
  }

  // Derive display info
  const currentName = $derived(getSequenceName(currentSequence));
  const currentBeatCount = $derived(currentSequence?.beats?.length ?? 0);
  const incomingName = $derived(getSequenceName(incomingSequence));
  const incomingBeatCount = $derived(incomingSequence?.beats?.length ?? 0);

  // Calculate dynamic preview height based on sequence size
  function calcPreviewHeight(beatCount: number): number {
    if (beatCount === 0) return 120;
    const columns = Math.min(beatCount, 4);
    const rows = Math.ceil(beatCount / columns);
    // Smaller per-row height since we're showing two grids
    return Math.max(120, Math.min(250, rows * 55 + 20));
  }

  const currentPreviewHeight = $derived(calcPreviewHeight(currentBeatCount));
  const incomingPreviewHeight = $derived(calcPreviewHeight(incomingBeatCount));

  // Handle confirm button
  function handleConfirm() {
    hapticService?.trigger("success");
    onConfirm();
    isOpen = false;
  }

  // Handle cancel button
  function handleCancel() {
    hapticService?.trigger("selection");
    onCancel();
    isOpen = false;
  }

  // Handle open change from Bits UI
  function handleOpenChange(open: boolean) {
    if (!open && isOpen) {
      handleCancel();
    }
    isOpen = open;
  }
</script>

<DialogPrimitive.Root open={isOpen} onOpenChange={handleOpenChange}>
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay class="preview-dialog-backdrop" />
    <DialogPrimitive.Content
      class="preview-dialog-container"
      data-testid="sequence-preview-dialog"
    >
      <!-- Header -->
      <div class="dialog-header">
        <span class="icon">⚠️</span>
        <DialogPrimitive.Title class="dialog-title">
          Replace Constructor Sequence?
        </DialogPrimitive.Title>
      </div>

      <!-- Two-column preview -->
      <div class="sequences-comparison">
        <!-- Current sequence (will be replaced) -->
        <div class="sequence-panel current" data-testid="current-sequence">
          <div class="panel-header">
            <span class="panel-label">Will be replaced</span>
            <span class="beat-count" data-testid="current-beat-count"
              >{currentBeatCount} beats</span
            >
          </div>
          <div class="sequence-name" data-testid="current-sequence-name">
            {currentName}
          </div>
          {#if currentSequence && (currentSequence.beats?.length > 0 || currentSequence.startPosition)}
            <div
              class="beat-grid-preview"
              style:height="{currentPreviewHeight}px"
              data-testid="current-beat-grid"
            >
              <BeatGrid
                beats={currentSequence.beats ?? []}
                startPosition={currentSequence.startPosition ??
                  currentSequence.startingPositionBeat ??
                  null}
              />
            </div>
          {/if}
        </div>

        <!-- Arrow indicator -->
        <div class="arrow-indicator">
          <i class="fas fa-arrow-right" aria-hidden="true"></i>
        </div>

        <!-- Incoming sequence (will replace) -->
        <div class="sequence-panel incoming" data-testid="incoming-sequence">
          <div class="panel-header">
            <span class="panel-label">New sequence</span>
            <span class="beat-count" data-testid="incoming-beat-count"
              >{incomingBeatCount} beats</span
            >
          </div>
          <div class="sequence-name" data-testid="incoming-sequence-name">
            {incomingName}
          </div>
          {#if incomingSequence && (incomingSequence.beats?.length > 0 || incomingSequence.startPosition)}
            <div
              class="beat-grid-preview"
              style:height="{incomingPreviewHeight}px"
              data-testid="incoming-beat-grid"
            >
              <BeatGrid
                beats={incomingSequence.beats ?? []}
                startPosition={incomingSequence.startPosition ??
                  incomingSequence.startingPositionBeat ??
                  null}
              />
            </div>
          {/if}
        </div>
      </div>

      <!-- Message -->
      <DialogPrimitive.Description class="dialog-message">
        This will overwrite your current work in the Constructor.
      </DialogPrimitive.Description>

      <!-- Actions -->
      <div class="dialog-actions">
        <button
          class="dialog-button cancel-button"
          onclick={handleCancel}
          data-testid="cancel-replace"
        >
          Keep Current
        </button>
        <button
          class="dialog-button confirm-button"
          onclick={handleConfirm}
          data-testid="confirm-replace"
        >
          Replace & Edit
        </button>
      </div>
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
</DialogPrimitive.Root>

<style>
  :global(.preview-dialog-backdrop) {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 20px;
  }

  :global(.preview-dialog-container) {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(30, 30, 35, 0.95);
    border: 1px solid rgba(255, 193, 7, 0.3);
    border-radius: 16px;
    padding: 24px;
    max-width: 700px;
    width: 95%;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    z-index: 1001;
  }

  .dialog-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 20px;
  }

  .icon {
    font-size: var(--font-size-3xl);
    line-height: 1;
  }

  :global(.dialog-title) {
    margin: 0;
    font-size: var(--font-size-xl);
    font-weight: 600;
    color: var(--text-color, #ffffff);
    font-family:
      system-ui,
      -apple-system,
      BlinkMacSystemFont,
      "Segoe UI",
      Roboto,
      sans-serif;
  }

  .sequences-comparison {
    display: flex;
    gap: 12px;
    align-items: center;
    margin-bottom: 16px;
  }

  .sequence-panel {
    flex: 1;
    background: rgba(0, 0, 0, 0.3);
    border-radius: 12px;
    padding: 12px;
    min-width: 0;
  }

  .sequence-panel.current {
    border: 1px solid rgba(239, 68, 68, 0.3);
  }

  .sequence-panel.incoming {
    border: 1px solid rgba(34, 197, 94, 0.3);
  }

  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 6px;
  }

  .panel-label {
    font-size: var(--font-size-compact);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .sequence-panel.current .panel-label {
    color: var(--semantic-error);
  }

  .sequence-panel.incoming .panel-label {
    color: var(--semantic-success);
  }

  .beat-count {
    font-size: var(--font-size-compact);
    color: var(--theme-text-dim);
  }

  .sequence-name {
    font-size: var(--font-size-compact);
    font-weight: 600;
    color: #fff;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    margin-bottom: 10px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .beat-grid-preview {
    min-height: 120px;
    max-height: 250px;
    overflow: hidden;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.02);
  }

  .arrow-indicator {
    flex-shrink: 0;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: rgba(255, 255, 255, 0.4);
    font-size: var(--font-size-base);
  }

  :global(.dialog-message) {
    margin: 0 0 20px 0;
    font-size: var(--font-size-sm);
    line-height: 1.5;
    color: var(--theme-text-dim);
    text-align: center;
  }

  .dialog-actions {
    display: flex;
    gap: 12px;
    justify-content: center;
  }

  .dialog-button {
    padding: 12px 24px;
    border-radius: 8px;
    font-size: var(--font-size-sm);
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    border: 2px solid transparent;
    min-width: 120px;
  }

  .cancel-button {
    background: rgba(255, 255, 255, 0.1);
    color: var(--theme-text);
    border-color: rgba(255, 255, 255, 0.2);
  }

  .cancel-button:hover {
    background: rgba(255, 255, 255, 0.15);
    border-color: rgba(255, 255, 255, 0.3);
    transform: translateY(-1px);
  }

  .confirm-button {
    background: linear-gradient(
      135deg,
      var(--semantic-warning) 0%,
      #d97706 100%
    );
    color: white;
    border-color: rgba(255, 255, 255, 0.2);
  }

  .confirm-button:hover {
    background: linear-gradient(
      135deg,
      var(--semantic-warning) 0%,
      var(--semantic-warning) 100%
    );
    border-color: rgba(255, 255, 255, 0.3);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(245, 158, 11, 0.4);
  }

  /* Mobile responsive - stack vertically */
  @media (max-width: 600px) {
    :global(.preview-dialog-container) {
      padding: 20px;
    }

    .sequences-comparison {
      flex-direction: column;
    }

    .arrow-indicator {
      transform: rotate(90deg);
      width: 24px;
      height: 24px;
    }

    .sequence-panel {
      width: 100%;
    }

    .beat-grid-preview {
      max-height: 180px;
    }

    :global(.dialog-title) {
      font-size: var(--font-size-lg);
    }

    .dialog-button {
      padding: 10px 20px;
      font-size: var(--font-size-compact);
      min-width: 100px;
    }
  }
</style>
