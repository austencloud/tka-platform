<script lang="ts">
  import ViewerOverflowMenu from "./ViewerOverflowMenu.svelte";

  interface Props {
    practiceActive?: boolean;
    onSave: () => void;
    onEdit: () => void;
    onPracticeStart?: () => void;
    onPracticeStop?: () => void;
    isOwned?: boolean;
    onDeleteRequest?: () => void;
    onVideoUpload?: () => void;
    videoCount?: number;
    isSaved?: boolean;
    isPublished?: boolean;
    isFavorite?: boolean;
    onFavorite?: () => void;
    onPublish?: () => void;
    onUnpublish?: () => void;
    onCopyLink?: () => void;
    onPropsOpen?: () => void;
    linkCopied?: boolean;
  }

  let {
    practiceActive = false,
    onSave,
    onEdit,
    onPracticeStart,
    onPracticeStop,
    isOwned = false,
    onDeleteRequest,
    onVideoUpload,
    videoCount,
    isSaved = true,
    isPublished = true,
    isFavorite = false,
    onFavorite,
    onPublish,
    onUnpublish,
    onCopyLink,
    onPropsOpen,
    linkCopied = false,
  }: Props = $props();
</script>

<div class="mid-layout">
  <div class="mid-actions-row">
    {#if onFavorite}
      <button
        type="button"
        class="mid-action-btn"
        class:favorited={isFavorite}
        onclick={onFavorite}
        aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
      >
        <i class="fas fa-heart" aria-hidden="true"></i>
      </button>
    {/if}

    {#if !isSaved}
      <button
        type="button"
        class="mid-action-btn save"
        onclick={onSave}
        aria-label="Save sequence"
      >
        <i class="fas fa-floppy-disk" aria-hidden="true"></i>
      </button>
    {/if}

    <button
      type="button"
      class="mid-action-btn edit"
      onclick={onEdit}
      aria-label="Remix"
    >
      <i class="fas fa-pen-to-square" aria-hidden="true"></i>
    </button>

    {#if onVideoUpload}
      <button
        type="button"
        class="mid-action-btn video"
        onclick={onVideoUpload}
        aria-label="Upload video"
      >
        <i class="fas fa-video" aria-hidden="true"></i>
        {#if videoCount && videoCount > 0}
          <span class="video-badge video-badge-sm">{videoCount}</span>
        {/if}
      </button>
    {/if}

    {#if onPracticeStart || onPracticeStop}
      <button
        type="button"
        class="mid-action-btn"
        class:practice-active={practiceActive}
        onclick={() => practiceActive ? onPracticeStop?.() : onPracticeStart?.()}
        aria-label={practiceActive ? "Stop practice training" : "Start practice training"}
        aria-pressed={practiceActive}
      >
        <i class="fas {practiceActive ? 'fa-stop' : 'fa-signal'}" aria-hidden="true"></i>
      </button>
    {/if}

    <ViewerOverflowMenu
      {isPublished}
      {onCopyLink}
      {linkCopied}
      {onPropsOpen}
      onPublish={isOwned && isSaved ? onPublish : undefined}
      onUnpublish={isOwned && isSaved ? onUnpublish : undefined}
      onDeleteRequest={isOwned && isSaved ? onDeleteRequest : undefined}
    />
  </div>
</div>

<style>
  .mid-layout {
    display: flex;
    width: 100%;
  }

  .mid-actions-row {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    gap: 8px;
    flex-wrap: wrap;
  }

  .mid-action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: 16px;
    cursor: pointer;
    transition: all var(--duration-fast, 150ms) ease;
    -webkit-tap-highlight-color: transparent;
    position: relative;
  }

  @media (hover: hover) and (pointer: fine) {
    .mid-action-btn:hover {
      background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
      border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
      color: var(--theme-text, white);
    }
  }

  .mid-action-btn:active {
    transform: scale(0.9);
    transition-duration: 0ms;
  }

  .mid-action-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  .mid-action-btn.save {
    border-color: rgba(34, 197, 94, 0.25);
    color: #22c55e;
  }

  .mid-action-btn.edit {
    border-color: rgba(245, 158, 11, 0.25);
    color: #f59e0b;
  }

  .mid-action-btn.favorited {
    color: var(--semantic-error);
    border-color: color-mix(in srgb, var(--semantic-error) 30%, transparent);
  }

  .mid-action-btn.practice-active {
    background: rgba(239, 68, 68, 0.15);
    border-color: rgba(239, 68, 68, 0.4);
    color: #f87171;
    box-shadow: 0 0 12px rgba(239, 68, 68, 0.2);
  }

  .mid-action-btn.video {
    position: relative;
  }

  .video-badge-sm {
    position: absolute;
    top: -2px;
    right: -2px;
    min-width: 16px;
    height: 16px;
    padding: 0 4px;
    border-radius: 8px;
    background: var(--theme-accent, #6366f1);
    color: #fff;
    font-size: 10px;
    font-weight: 600;
    display: flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
  }

  @media (prefers-reduced-motion: reduce) {
    .mid-action-btn {
      transition: none;
    }

    .mid-action-btn:active {
      transform: none;
    }
  }
</style>
