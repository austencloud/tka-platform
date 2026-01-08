<!-- SpotlightActionButtons.svelte - Action buttons for fullscreen viewer (Refactored) -->
<script lang="ts">
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import { onMount } from "svelte";
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import { resolve } from "$lib/shared/inversify/di";
  import { TYPES } from "$lib/shared/inversify/types";
  import { SPOTLIGHT_CONSTANTS } from "../domain/constants/spotlight-constants";

  // ✅ PURE RUNES: Props using modern Svelte 5 runes
  const { sequence, onAction = () => {} } = $props<{
    sequence?: SequenceData;
    onAction?: (action: string, sequence: SequenceData) => void;
  }>();

  // Services
  let hapticService: IHapticFeedback | null = $state(null);

  onMount(() => {
    hapticService = resolve<IHapticFeedback>(TYPES.IHapticFeedback);
  });

  function handleAction(action: string) {
    if (sequence) {
      // Use appropriate haptic feedback based on action
      if (action === SPOTLIGHT_CONSTANTS.ACTIONS.DELETE) {
        hapticService?.trigger("warning");
      } else {
        hapticService?.trigger("selection");
      }
      console.log(`🎬 Fullscreen action: ${action} on sequence:`, sequence.id);
      onAction(action, sequence);
    }
  }
</script>

<div class="action-buttons">
  <div class="button-group">
    <button
      class="action-button edit"
      onclick={() => handleAction(SPOTLIGHT_CONSTANTS.ACTIONS.EDIT)}
      aria-label="Edit sequence"
    >
      <span class="button-icon">✏️</span>
      <span class="button-text">Edit</span>
    </button>

    <button
      class="action-button favorite"
      class:favorited={sequence?.isFavorite}
      onclick={() => handleAction(SPOTLIGHT_CONSTANTS.ACTIONS.SAVE)}
      aria-label={sequence?.isFavorite
        ? "Remove from favorites"
        : "Add to favorites"}
    >
      <span class="button-icon">{sequence?.isFavorite ? "❤️" : "🤍"}</span>
      <span class="button-text"
        >{sequence?.isFavorite ? "Favorited" : "Favorite"}</span
      >
    </button>

    <button
      class="action-button delete"
      onclick={() => handleAction(SPOTLIGHT_CONSTANTS.ACTIONS.DELETE)}
      aria-label="Delete sequence"
    >
      <span class="button-icon">🗑️</span>
      <span class="button-text">Delete</span>
    </button>
  </div>
</div>

<style>
  .action-buttons {
    width: 100%;
  }

  .button-group {
    display: flex;
    flex-direction: row;
    gap: 1rem;
    justify-content: center;
    background: rgba(0, 0, 0, 0.8);
    backdrop-filter: blur(10px);
    border: 1px solid var(--theme-stroke, var(--theme-stroke));
    border-radius: 12px;
    padding: 1.5rem;
    box-shadow: 0 8px 32px var(--theme-shadow, var(--theme-shadow));
  }

  .action-button {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke-strong);
    color: var(--theme-text, white);
    padding: 0.75rem 1.5rem;
    border-radius: 1.5rem;
    cursor: pointer;
    transition: all 0.2s ease;
    font-size: 0.875rem;
    font-weight: 500;
    min-width: 6rem;
    justify-content: center;
  }

  .action-button:hover {
    background: var(--theme-card-hover-bg);
    border-color: color-mix(in srgb, var(--theme-text, white) 30%, transparent);
    transform: translateY(-2px);
    box-shadow: 0 4px 16px var(--theme-shadow, var(--theme-shadow));
  }

  .action-button:active {
    transform: translateY(0);
  }

  .action-button.edit:hover {
    background: color-mix(
      in srgb,
      var(--semantic-info, var(--semantic-info)) 30%,
      transparent
    );
    border-color: color-mix(
      in srgb,
      var(--semantic-info, var(--semantic-info)) 50%,
      transparent
    );
    color: var(--semantic-info, var(--semantic-info));
  }

  .action-button.favorite:hover {
    background: color-mix(
      in srgb,
      var(--semantic-error, var(--semantic-error)) 30%,
      transparent
    );
    border-color: color-mix(
      in srgb,
      var(--semantic-error, var(--semantic-error)) 50%,
      transparent
    );
    color: var(--semantic-error, var(--semantic-error));
  }

  .action-button.favorite.favorited {
    background: color-mix(
      in srgb,
      var(--semantic-error, var(--semantic-error)) 20%,
      transparent
    );
    border-color: color-mix(
      in srgb,
      var(--semantic-error, var(--semantic-error)) 40%,
      transparent
    );
    color: var(--semantic-error, var(--semantic-error));
  }

  .action-button.delete:hover {
    background: color-mix(
      in srgb,
      var(--semantic-error, var(--semantic-error)) 30%,
      transparent
    );
    border-color: color-mix(
      in srgb,
      var(--semantic-error, var(--semantic-error)) 50%,
      transparent
    );
    color: #fca5a5;
  }

  .button-icon {
    font-size: 1rem;
    line-height: 1;
  }

  .button-text {
    font-size: 0.875rem;
    font-weight: 500;
  }

  /* Mobile adjustments */
  @media (max-width: 768px) {
    .action-buttons {
      bottom: 1rem;
      left: 1rem;
      right: 1rem;
      transform: none;
    }

    .button-group {
      justify-content: center;
      padding: 0.75rem;
      gap: 0.75rem;
    }

    .action-button {
      padding: 0.5rem 1rem;
      min-width: auto;
      flex: 1;
    }

    .button-text {
      display: none;
    }

    .button-icon {
      font-size: 1.25rem;
    }
  }

  @media (max-width: 480px) {
    .button-group {
      gap: 0.5rem;
      padding: 0.5rem;
    }

    .action-button {
      padding: 0.5rem;
      border-radius: 50%;
      width: 3rem;
      height: 3rem;
      min-width: auto;
    }
  }
</style>
