<!--
SequenceActionButtons - Context-aware action button row for sequence details

Shows different actions based on auth state and ownership:
- Not logged in: nothing (Get App is in the route viewer)
- Logged in, any user: Favorite + Share + Videos + Maximize
- Logged in, owner, unsaved: + Save button (primary)
- Logged in, owner, saved: + Edit + overflow menu (Publish/Unpublish + Delete)
-->
<script lang="ts">
  import { t } from "$lib/shared/i18n/i18n.svelte";
  import OverflowMenu from "$lib/shared/ui/components/OverflowMenu.svelte";

  interface Props {
    isLoggedIn?: boolean;
    isOwned?: boolean;
    isSaved?: boolean;
    isPublished?: boolean;
    isFavorite?: boolean;
    videoCount?: number;
    onFavorite?: () => void;
    onSave?: () => void;
    onEdit?: () => void;
    onShare?: () => void;
    onSendTo?: () => void;
    onVideos?: () => void;
    onDelete?: () => void;
    onMaximize?: () => void;
    onPublish?: () => void;
    onUnpublish?: () => void;
  }

  const {
    isLoggedIn = false,
    isOwned = false,
    isSaved = true,
    isPublished = true,
    isFavorite = false,
    videoCount = 0,
    onFavorite = () => {},
    onSave = () => {},
    onEdit = () => {},
    onShare = () => {},
    onSendTo,
    onVideos = () => {},
    onDelete = () => {},
    onMaximize = () => {},
    onPublish = () => {},
    onUnpublish = () => {},
  }: Props = $props();

  // Overflow menu items for owned sequences
  const overflowItems = $derived.by(() => {
    const items: { label: string; icon: string; action: () => void; variant?: "danger" }[] = [];

    if (isPublished) {
      items.push({ label: "Make Private", icon: "fas fa-eye-slash", action: onUnpublish });
    } else {
      items.push({ label: "Make Public", icon: "fas fa-eye", action: onPublish });
    }

    items.push({ label: "Delete", icon: "fas fa-trash", action: onDelete, variant: "danger" as const });

    return items;
  });
</script>

<div class="action-buttons">
  {#if !isLoggedIn}
    <!-- Not logged in: no actions in browse detail panel -->
    <!-- (Get App button is shown in the route viewer, not the browse detail) -->
  {:else}
    <!-- Favorite button (always shown for logged-in users) -->
    <button
      class="action-btn"
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
    </button>

    <!-- Save button (only when content is new/modified and unsaved) -->
    {#if isOwned && !isSaved}
      <button
        class="action-btn action-btn-primary"
        onclick={onSave}
        aria-label="Save sequence"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
          <polyline points="17 21 17 13 7 13 7 21" />
          <polyline points="7 3 7 8 15 8" />
        </svg>
        <span>{t('browse_save')}</span>
      </button>
    {/if}

    <!-- Edit button (owner only, when sequence is saved) -->
    {#if isOwned && isSaved}
      <button
        class="action-btn"
        onclick={onEdit}
        aria-label={t('browse_edit_sequence')}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
      </button>
    {/if}

    <!-- Share button -->
    <button
      class="action-btn"
      onclick={onShare}
      aria-label={t('browse_share_sequence')}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="18" cy="5" r="3" />
        <circle cx="6" cy="12" r="3" />
        <circle cx="18" cy="19" r="3" />
        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
      </svg>
    </button>

    <!-- Send to button -->
    {#if onSendTo}
      <button
        class="action-btn"
        onclick={onSendTo}
        aria-label="Send sequence to a friend"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="22" y1="2" x2="11" y2="13" />
          <polygon points="22 2 15 22 11 13 2 9 22 2" />
        </svg>
      </button>
    {/if}

    <!-- Videos button -->
    <button
      class="action-btn action-btn-videos"
      onclick={onVideos}
      aria-label={videoCount > 0 ? t('browse_view_videos', { count: String(videoCount) }) : t('browse_record_performance')}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polygon points="23 7 16 12 23 17 23 7" />
        <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
      </svg>
      {#if videoCount > 0}
        <span class="video-count">{videoCount}</span>
      {:else}
        <span>{t('browse_record')}</span>
      {/if}
    </button>

    <!-- Overflow menu (owner only, when saved) - contains Publish/Unpublish + Delete -->
    {#if isOwned && isSaved}
      <OverflowMenu items={overflowItems} />
    {/if}

    <!-- Maximize button -->
    <button
      class="action-btn action-btn-maximize"
      onclick={onMaximize}
      aria-label={t('browse_maximize_details')}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
      </svg>
      <span>{t('browse_maximize')}</span>
    </button>
  {/if}
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
    transition: all var(--duration-normal) ease;
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
