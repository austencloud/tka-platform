<!--
  FloatingActionCluster.svelte

  Floating action buttons that appear over the media.
  Positioned in bottom-right corner, fades out when sheet expands.
-->
<script lang="ts">
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";

  const {
    sequence,
    onFavorite,
    onShare,
    visible = true,
  }: {
    sequence: SequenceData;
    onFavorite?: () => void;
    onShare?: () => void;
    visible?: boolean;
  } = $props();

  const isFavorite = $derived(sequence.isFavorite ?? false);
</script>

<div class="action-cluster" class:visible>
  <!-- Save/Favorite button -->
  <button
    class="fab fab-primary"
    class:favorited={isFavorite}
    onclick={onFavorite}
    aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
  >
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill={isFavorite ? "currentColor" : "none"}
      stroke="currentColor"
      stroke-width="2"
    >
      <path
        d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
      />
    </svg>
  </button>

  <!-- Share button (optional) -->
  {#if onShare}
    <button class="fab" onclick={onShare} aria-label="Share">
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <circle cx="18" cy="5" r="3" />
        <circle cx="6" cy="12" r="3" />
        <circle cx="18" cy="19" r="3" />
        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
      </svg>
    </button>
  {/if}
</div>

<style>
  .action-cluster {
    position: absolute;
    right: 16px;
    bottom: 140px; /* Above the sheet */
    display: flex;
    flex-direction: column;
    gap: 12px;
    z-index: 50;
    opacity: 1;
    transform: translateY(0);
    transition:
      opacity 0.25s ease,
      transform 0.25s ease;
  }

  .action-cluster:not(.visible) {
    opacity: 0;
    transform: translateY(20px);
    pointer-events: none;
  }

  .fab {
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid var(--theme-stroke, var(--theme-stroke-strong));
    border-radius: 50%;
    color: var(--theme-text, white);
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 0 4px 20px var(--theme-shadow);
  }

  .fab:hover {
    background: rgba(0, 0, 0, 0.8);
    transform: scale(1.05);
  }

  .fab:active {
    transform: scale(0.92);
  }

  /* Primary action (larger) */
  .fab-primary {
    width: 60px;
    height: 60px;
    background: linear-gradient(
      135deg,
      var(--semantic-info, var(--semantic-info)) 0%,
      color-mix(in srgb, var(--semantic-info, var(--semantic-info)) 80%, black)
        100%
    );
    border-color: transparent;
  }

  .fab-primary:hover {
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--semantic-info, var(--semantic-info)) 85%, black)
        0%,
      color-mix(in srgb, var(--semantic-info, var(--semantic-info)) 70%, black)
        100%
    );
    box-shadow: 0 4px 24px
      color-mix(
        in srgb,
        var(--semantic-info, var(--semantic-info)) 40%,
        transparent
      );
  }

  .fab-primary.favorited {
    background: linear-gradient(
      135deg,
      var(--semantic-error, var(--semantic-error)) 0%,
      color-mix(
          in srgb,
          var(--semantic-error, var(--semantic-error)) 100%,
          transparent
        )
        100%
    );
  }

  .fab-primary.favorited:hover {
    background: linear-gradient(
      135deg,
      var(--semantic-error, var(--semantic-error)) 0%,
      color-mix(
          in srgb,
          var(--semantic-error, var(--semantic-error)) 100%,
          transparent
        )
        100%
    );
    box-shadow: 0 4px 24px
      color-mix(
        in srgb,
        var(--semantic-error, var(--semantic-error)) 40%,
        transparent
      );
  }
</style>
