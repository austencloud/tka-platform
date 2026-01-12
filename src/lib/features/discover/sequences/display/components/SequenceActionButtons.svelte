<!--
SequenceActionButtons - Action button row for sequence details

Displays:
- Save/Favorite button (primary)
- Edit or Fork button (ownership-aware)
- Share button
- Videos button with count badge
- Delete button (owner only)
- Maximize button
-->
<script lang="ts">
  interface Props {
    isFavorite?: boolean;
    isOwned?: boolean;
    videoCount?: number;
    onFavorite?: () => void;
    onEdit?: () => void;
    onFork?: () => void;
    onShare?: () => void;
    onVideos?: () => void;
    onDelete?: () => void;
    onMaximize?: () => void;
  }

  const {
    isFavorite = false,
    isOwned = false,
    videoCount = 0,
    onFavorite = () => {},
    onEdit = () => {},
    onFork = () => {},
    onShare = () => {},
    onVideos = () => {},
    onDelete = () => {},
    onMaximize = () => {},
  }: Props = $props();
</script>

<div class="action-buttons">
  <!-- Favorite/Save button -->
  <button
    class="action-btn action-btn-primary"
    class:favorited={isFavorite}
    onclick={onFavorite}
    aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
  >
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill={isFavorite ? "currentColor" : "none"}
      stroke="currentColor"
      stroke-width="2"
    >
      <path
        d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
      />
    </svg>
    <span>{isFavorite ? "Saved" : "Save"}</span>
  </button>

  <!-- Edit or Fork button -->
  {#if isOwned}
    <button
      class="action-btn"
      onclick={onEdit}
      aria-label="Edit sequence"
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
      </svg>
    </button>
  {:else}
    <button
      class="action-btn"
      onclick={onFork}
      aria-label="Fork sequence"
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <circle cx="12" cy="18" r="3" />
        <circle cx="6" cy="6" r="3" />
        <circle cx="18" cy="6" r="3" />
        <path d="M18 9a9 9 0 0 1-9 9" />
        <path d="M6 9a9 9 0 0 0 9 9" />
      </svg>
    </button>
  {/if}

  <!-- Share button -->
  <button
    class="action-btn"
    onclick={onShare}
    aria-label="Share sequence"
  >
    <svg
      width="20"
      height="20"
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

  <!-- Videos button -->
  <button
    class="action-btn action-btn-videos"
    onclick={onVideos}
    aria-label={videoCount > 0 ? `View ${videoCount} videos` : "Record performance"}
  >
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
    >
      <polygon points="23 7 16 12 23 17 23 7" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
    {#if videoCount > 0}
      <span class="video-count">{videoCount}</span>
    {:else}
      <span>Record</span>
    {/if}
  </button>

  <!-- Delete button (owner only) -->
  {#if isOwned}
    <button
      class="action-btn action-btn-danger"
      onclick={onDelete}
      aria-label="Delete sequence"
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <polyline points="3 6 5 6 21 6" />
        <path
          d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
        />
      </svg>
    </button>
  {/if}

  <!-- Maximize button -->
  <button
    class="action-btn action-btn-maximize"
    onclick={onMaximize}
    aria-label="Maximize details"
  >
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
    >
      <path
        d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"
      />
    </svg>
    <span>Maximize</span>
  </button>
</div>

<style>
  .action-buttons {
    display: flex;
    gap: clamp(8px, 2cqi, 12px);
    flex-wrap: wrap;
    justify-content: center;
    margin-top: auto;
    padding-top: clamp(8px, 2cqi, 12px);
  }

  .action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: clamp(6px, 2cqi, 10px);
    padding: clamp(10px, 2.5cqi, 14px) clamp(12px, 3cqi, 18px);
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke-strong);
    border-radius: clamp(6px, 2cqi, 10px);
    color: var(--theme-text, white);
    font-size: clamp(12px, 3cqi, 14px);
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    min-height: var(--touch-target-min);
    min-width: var(--touch-target-min);
  }

  .action-btn svg {
    width: var(--icon-size-md);
    height: var(--icon-size-md);
    flex-shrink: 0;
  }

  .action-btn:hover {
    background: var(--theme-card-hover-bg);
  }

  .action-btn:active {
    transform: scale(0.97);
  }

  .action-btn-primary {
    background: linear-gradient(
      135deg,
      var(--semantic-info, var(--semantic-info)) 0%,
      var(--semantic-info) 100%
    );
    border-color: transparent;
    flex: 1;
    min-width: clamp(100px, 30cqi, 140px);
  }

  .action-btn-primary:hover {
    background: linear-gradient(
      135deg,
      var(--semantic-info) 0%,
      color-mix(in srgb, var(--semantic-info) 90%, #000) 100%
    );
  }

  .action-btn-maximize {
    flex: 1;
    min-width: clamp(100px, 30cqi, 140px);
  }

  .action-btn.favorited {
    color: var(--semantic-error, var(--semantic-error));
    border-color: var(--semantic-error, var(--semantic-error));
  }

  /* Primary button favorited state - pink/red gradient */
  .action-btn-primary.favorited {
    background: linear-gradient(
      135deg,
      color-mix(
          in srgb,
          var(--semantic-error, var(--semantic-error)) 90%,
          var(--semantic-error)
        )
        0%,
      var(--semantic-error, var(--semantic-error)) 100%
    );
    border-color: transparent;
    color: var(--theme-text, white);
  }

  .action-btn-primary.favorited:hover {
    background: linear-gradient(
      135deg,
      var(--semantic-error, var(--semantic-error)) 0%,
      color-mix(in srgb, var(--semantic-error, var(--semantic-error)) 90%, #000)
        100%
    );
  }

  /* Danger button style for delete */
  .action-btn-danger {
    color: var(--semantic-error);
    border-color: color-mix(in srgb, var(--semantic-error) 30%, transparent);
  }

  .action-btn-danger:hover {
    background: color-mix(in srgb, var(--semantic-error) 15%, transparent);
    border-color: var(--semantic-error);
  }

  /* Compact layout for smaller containers */
  @container detail-panel (max-width: 320px) {
    .action-btn span {
      display: none;
    }

    .action-btn-primary,
    .action-btn-maximize {
      flex: 0;
      min-width: var(--touch-target-min);
    }
  }

  /* Videos button style */
  .action-btn-videos {
    position: relative;
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--semantic-info) 20%, transparent) 0%,
      color-mix(in srgb, var(--semantic-info) 10%, transparent) 100%
    );
    border-color: color-mix(in srgb, var(--semantic-info) 40%, transparent);
  }

  .action-btn-videos:hover {
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--semantic-info) 30%, transparent) 0%,
      color-mix(in srgb, var(--semantic-info) 20%, transparent) 100%
    );
    border-color: var(--semantic-info);
  }

  .action-btn-videos svg {
    color: var(--semantic-info);
  }

  .video-count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 20px;
    height: 20px;
    padding: 0 6px;
    background: var(--semantic-info);
    border-radius: 10px;
    font-size: 11px;
    font-weight: 700;
    color: white;
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .action-btn {
      transition: none;
    }

    .action-btn:active {
      transform: none;
    }
  }
</style>
