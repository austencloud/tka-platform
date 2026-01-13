<script lang="ts">
  /**
   * SequenceMessageCard
   *
   * Renders a sequence as a tappable card within a message.
   * Links directly to the sequence in Discover for viewing.
   * Shows deleted state if the sequence no longer exists.
   */

  import { onMount } from "svelte";
  import type { MessageAttachment } from "$lib/shared/messaging/domain/models/message-models";
  import { inboxState } from "../../state/inbox-state.svelte";
  import { handleModuleChange } from "$lib/shared/navigation-coordinator/navigation-coordinator.svelte";
  import { setPendingSequenceView } from "$lib/features/discover/state/pending-sequence.svelte";
  import { container } from "$lib/shared/di";
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";

  interface Props {
    attachment: MessageAttachment;
    isOwn: boolean;
  }

  let { attachment, isOwn }: Props = $props();

  // We don't pre-check if sequence exists - sequences can be in publicSequences OR user libraries
  // Instead we trust the attachment metadata and handle "not found" at navigation time
  let isDeleted = $state(false);
  let isChecking = $state(false);

  // Haptic feedback service
  let hapticService: IHapticFeedback | undefined;

  // Extract sequence metadata
  const sequenceId = $derived(attachment.metadata?.sequenceId);
  const sequenceWord = $derived(
    attachment.metadata?.sequenceWord || attachment.metadata?.title || "Sequence"
  );
  const sequenceName = $derived(attachment.metadata?.sequenceName);
  const thumbnailUrl = $derived(
    attachment.metadata?.sequenceThumbnail || attachment.thumbnailUrl
  );
  const authorName = $derived(attachment.metadata?.sequenceAuthor);
  const beatCount = $derived(attachment.metadata?.sequenceBeatCount);

  // Initialize haptic service
  onMount(() => {
    hapticService = container.items.hapticFeedback;
  });

  async function handleClick() {
    if (isDeleted || !sequenceId) return;

    hapticService?.trigger("selection");

    // Close the inbox drawer first
    inboxState.close();

    // Set the pending sequence to view
    setPendingSequenceView(sequenceId);

    // Navigate to Discover sequences tab
    await handleModuleChange("discover", "sequences");
  }
</script>

<div
  class="sequence-card"
  class:own={isOwn}
  class:deleted={isDeleted}
  class:clickable={!isDeleted && !isChecking}
>
  {#if isDeleted}
    <!-- Deleted state -->
    <div class="card-header">
      <div class="deleted-badge">
        <i class="fas fa-trash-alt" aria-hidden="true"></i>
        <span>Unavailable</span>
      </div>
    </div>
    <h4 class="sequence-title deleted-title">{sequenceWord}</h4>
    <p class="deleted-notice">This sequence is no longer available</p>
  {:else}
    <!-- Normal state -->
    <button
      class="card-content"
      onclick={handleClick}
      type="button"
      disabled={isChecking}
    >
      {#if thumbnailUrl}
        <div class="thumbnail-container">
          <img
            src={thumbnailUrl}
            alt={sequenceWord}
            class="thumbnail"
            loading="lazy"
          />
        </div>
      {/if}

      <div class="card-info">
        <h4 class="sequence-title">{sequenceWord}</h4>

        {#if sequenceName && sequenceName !== sequenceWord}
          <p class="sequence-name">{sequenceName}</p>
        {/if}

        <div class="meta-row">
          {#if authorName}
            <span class="author">
              <i class="fas fa-user" aria-hidden="true"></i>
              {authorName}
            </span>
          {/if}
          {#if beatCount}
            <span class="beats">
              <i class="fas fa-music" aria-hidden="true"></i>
              {beatCount} beats
            </span>
          {/if}
        </div>
      </div>

      <div class="card-footer">
        {#if isChecking}
          <span class="checking-hint">
            <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
            Loading...
          </span>
        {:else}
          <span class="tap-hint">
            <i class="fas fa-external-link-alt" aria-hidden="true"></i>
            Tap to view
          </span>
        {/if}
      </div>
    </button>
  {/if}
</div>

<style>
  .sequence-card {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px;
    border-radius: 12px;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    text-align: left;
    width: 100%;
    min-width: 200px;
    max-width: 280px;
    transition: all 0.2s ease;
  }

  .sequence-card.clickable:hover {
    background: var(--theme-card-hover-bg);
    border-color: var(--theme-accent, var(--semantic-info));
    transform: translateY(-1px);
  }

  .sequence-card.own {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.2);
  }

  .sequence-card.own.clickable:hover {
    background: rgba(255, 255, 255, 0.15);
  }

  /* Deleted state */
  .sequence-card.deleted {
    opacity: 0.6;
    border-style: dashed;
  }

  .deleted-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    border-radius: 12px;
    font-size: var(--font-size-compact);
    font-weight: 500;
    background: rgba(239, 68, 68, 0.15);
    color: var(--semantic-error);
  }

  .deleted-badge i {
    font-size: var(--font-size-compact);
  }

  .deleted-title {
    text-decoration: line-through;
    opacity: 0.7;
  }

  .deleted-notice {
    margin: 0;
    font-size: var(--font-size-compact);
    color: var(--theme-text-dim);
    font-style: italic;
  }

  /* Inner button for clickable state */
  .card-content {
    display: flex;
    flex-direction: column;
    gap: 8px;
    background: transparent;
    border: none;
    padding: 0;
    margin: 0;
    cursor: pointer;
    text-align: left;
    width: 100%;
    color: inherit;
  }

  .card-content:disabled {
    cursor: default;
  }

  .card-header {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  /* Thumbnail */
  .thumbnail-container {
    width: 100%;
    aspect-ratio: 16 / 9;
    border-radius: 8px;
    overflow: hidden;
    background: rgba(0, 0, 0, 0.2);
  }

  .thumbnail {
    width: 100%;
    height: 100%;
    object-fit: contain;
    background: rgba(0, 0, 0, 0.1);
  }

  .card-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .sequence-title {
    margin: 0;
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--theme-text);
    line-height: 1.3;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .own .sequence-title {
    color: white;
  }

  .sequence-name {
    margin: 0;
    font-size: var(--font-size-compact);
    color: var(--theme-text-dim);
    line-height: 1.3;
  }

  .own .sequence-name {
    color: rgba(255, 255, 255, 0.8);
  }

  .meta-row {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-top: 4px;
  }

  .author,
  .beats {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: var(--font-size-compact);
    color: var(--theme-text-dim);
  }

  .own .author,
  .own .beats {
    color: rgba(255, 255, 255, 0.7);
  }

  .author i,
  .beats i {
    font-size: 10px;
    opacity: 0.8;
  }

  .card-footer {
    display: flex;
    justify-content: flex-end;
    padding-top: 8px;
    border-top: 1px solid var(--theme-stroke);
  }

  .tap-hint,
  .checking-hint {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: var(--font-size-compact);
    color: var(--theme-accent, var(--semantic-info));
    opacity: 0.8;
  }

  .checking-hint {
    color: var(--theme-text-dim);
  }

  .own .tap-hint {
    color: rgba(255, 255, 255, 0.8);
  }

  .tap-hint i,
  .checking-hint i {
    font-size: var(--font-size-compact);
  }
</style>
