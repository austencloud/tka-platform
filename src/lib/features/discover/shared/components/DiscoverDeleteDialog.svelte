<!--
Delete Confirmation Dialog Component

A modal dialog for confirming sequence deletion with detailed information
about the sequence being deleted and potential consequences.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import { container } from "$lib/shared/di";
    import type { SequenceDeleteConfirmationData } from "../domain/models/discover-models";

  // ✅ PURE RUNES: Props using modern Svelte 5 runes
  const {
    confirmationData,
    show = false,
    onConfirm = () => {},
    onCancel = () => {},
  } = $props<{
    confirmationData: SequenceDeleteConfirmationData | null;
    show: boolean;
    onConfirm: () => void;
    onCancel: () => void;
  }>();

  // Services
  let hapticService: IHapticFeedback | null = $state(null);

  onMount(() => {
    hapticService = container.items.hapticFeedback;
  });

  // Handle keyboard events
  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      hapticService?.trigger("selection");
      onCancel();
    } else if (event.key === "Enter") {
      hapticService?.trigger("warning");
      onConfirm();
    }
  }

  // Handle backdrop click
  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      hapticService?.trigger("selection");
      onCancel();
    }
  }

  // Handle close button
  function handleClose() {
    hapticService?.trigger("selection");
    onCancel();
  }

  // Handle cancel button
  function handleCancel() {
    hapticService?.trigger("selection");
    onCancel();
  }

  // Handle delete confirmation
  function handleConfirm() {
    hapticService?.trigger("warning");
    onConfirm();
  }
</script>

<!-- Modal backdrop -->
{#if show && confirmationData}
  <div
    class="modal-backdrop"
    onclick={handleBackdropClick}
    onkeydown={handleKeydown}
    role="dialog"
    aria-modal="true"
    aria-labelledby="dialog-title"
    tabindex="-1"
  >
    <div class="modal-dialog">
      <div class="modal-header">
        <h2 id="dialog-title">Delete Sequence</h2>
        <button
          class="close-button"
          onclick={handleClose}
          aria-label="Close dialog"
        >
          ×
        </button>
      </div>

      <div class="modal-body">
        <div class="warning-icon">⚠️</div>

        <div class="confirmation-message">
          <p>Are you sure you want to delete this sequence?</p>

          <div class="sequence-info">
            <div class="sequence-name">{confirmationData.sequence.word}</div>
            {#if confirmationData.sequence.author}
              <div class="sequence-author">
                by {confirmationData.sequence.author}
              </div>
            {/if}
            {#if confirmationData.sequence.sequenceLength}
              <div class="sequence-length">
                {confirmationData.sequence.sequenceLength} steps
              </div>
            {/if}
          </div>

          {#if confirmationData.hasRelatedData}
            <div class="warning-details">
              <p><strong>Warning:</strong> This action will also delete:</p>
              <ul>
                {#if confirmationData.relatedDataCount.thumbnails > 0}
                  <li>
                    {confirmationData.relatedDataCount.thumbnails} thumbnail(s)
                  </li>
                {/if}
                {#if confirmationData.relatedDataCount.variations > 0}
                  <li>
                    {confirmationData.relatedDataCount.variations} variation(s)
                  </li>
                {/if}
                {#if confirmationData.relatedDataCount.metadata > 0}
                  <li>Associated metadata</li>
                {/if}
              </ul>
            </div>
          {/if}

          <p class="final-warning">
            <strong>This action cannot be undone.</strong>
          </p>
        </div>
      </div>

      <div class="modal-footer">
        <button class="cancel-button" onclick={handleCancel}> Cancel </button>
        <button class="delete-button" onclick={handleConfirm}>
          Delete Sequence
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: color-mix(in srgb, var(--theme-shadow) 50%, transparent);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .modal-dialog {
    background: var(--theme-panel-bg);
    border: 1px solid var(--theme-stroke, var(--theme-stroke));
    border-radius: 12px;
    box-shadow: 0 20px 40px var(--theme-shadow, var(--theme-shadow));
    max-width: 500px;
    width: 90%;
    max-height: 80vh;
    overflow: hidden;
    animation: modalSlideIn 0.3s ease-out;
  }

  @keyframes modalSlideIn {
    from {
      opacity: 0;
      transform: translateY(-20px) scale(0.95);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 24px;
    border-bottom: 1px solid var(--theme-stroke, var(--theme-stroke));
    background: var(--theme-card-bg);
  }

  .modal-header h2 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--theme-text, white);
  }

  .close-button {
    background: none;
    border: none;
    font-size: 1.5rem;
    color: var(--theme-text-dim, var(--theme-text-dim));
    cursor: pointer;
    padding: 4px;
    border-radius: 50%;
    transition: all 0.2s ease;
  }

  .close-button:hover {
    background: var(--theme-card-hover-bg);
    color: var(--theme-text, white);
  }

  .modal-body {
    padding: 24px;
    text-align: center;
  }

  .warning-icon {
    font-size: 3rem;
    margin-bottom: 16px;
  }

  .confirmation-message p {
    margin: 0 0 16px 0;
    font-size: 1.1rem;
    color: var(--theme-text, white);
  }

  .sequence-info {
    background: var(--theme-card-bg, var(--theme-card-bg));
    border: 1px solid var(--theme-stroke, var(--theme-stroke));
    border-radius: 8px;
    padding: 16px;
    margin: 16px 0;
    text-align: left;
  }

  .sequence-name {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--theme-text, white);
    margin-bottom: 4px;
  }

  .sequence-author {
    font-size: 0.9rem;
    color: var(--theme-text-dim, var(--theme-text-dim));
    margin-bottom: 4px;
  }

  .sequence-length {
    font-size: 0.9rem;
    color: var(--semantic-info, var(--semantic-info));
    font-weight: 600;
  }

  .warning-details {
    background: color-mix(
      in srgb,
      var(--semantic-warning, var(--semantic-warning)) 15%,
      transparent
    );
    border: 1px solid var(--semantic-warning, var(--semantic-warning));
    border-radius: 8px;
    padding: 16px;
    margin: 16px 0;
    text-align: left;
  }

  .warning-details p {
    margin: 0 0 8px 0;
    color: var(--semantic-warning, var(--semantic-warning));
    font-weight: 600;
  }

  .warning-details ul {
    margin: 0;
    padding-left: 20px;
    color: var(--semantic-warning, var(--semantic-warning));
  }

  .warning-details li {
    margin-bottom: 4px;
  }

  .final-warning {
    color: var(--semantic-error, var(--semantic-error)) !important;
    font-weight: 600 !important;
    margin-top: 16px !important;
  }

  .modal-footer {
    display: flex;
    gap: 12px;
    justify-content: flex-end;
    padding: 20px 24px;
    border-top: 1px solid var(--theme-stroke, var(--theme-stroke));
    background: var(--theme-card-bg);
  }

  .cancel-button {
    background: var(--theme-card-bg, var(--theme-card-bg));
    border: 1px solid var(--theme-stroke-strong);
    color: var(--theme-text, white);
    padding: 10px 20px;
    border-radius: 6px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .cancel-button:hover {
    background: var(--theme-card-hover-bg);
    border-color: var(--theme-stroke-strong);
  }

  .delete-button {
    background: var(--semantic-error, var(--semantic-error));
    border: 1px solid var(--semantic-error, var(--semantic-error));
    color: white;
    padding: 10px 20px;
    border-radius: 6px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .delete-button:hover {
    background: color-mix(
      in srgb,
      var(--semantic-error, var(--semantic-error)) 85%,
      #000
    );
    border-color: color-mix(
      in srgb,
      var(--semantic-error, var(--semantic-error)) 85%,
      #000
    );
  }

  .delete-button:focus,
  .cancel-button:focus {
    outline: 2px solid var(--semantic-info, var(--semantic-info));
    outline-offset: 2px;
  }

  /* Accessibility: Respect user's motion preferences (WCAG AAA) */
  @media (prefers-reduced-motion: reduce) {
    .modal-dialog {
      animation: none;
    }
    /* Disable local keyframe animations */
    [style*="modalSlideIn"] {
      animation: none;
    }
  }
</style>
