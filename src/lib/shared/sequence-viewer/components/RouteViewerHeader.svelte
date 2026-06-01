<!--
  RouteViewerHeader.svelte

  Header bar for the /sequence/[id] route.
  Similar to ViewerHeader but with route-aware back navigation instead of modal close.
-->
<script lang="ts">
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import { getClaudeCodeCopier } from "$lib/shared/browse/get-claude-code-copier";
  import { authState } from "$lib/shared/auth/state/auth-state.svelte";
  import MotionVisibilityToggle from "./MotionVisibilityToggle.svelte";
  import ViewerOverflowMenu from "./ViewerOverflowMenu.svelte";

  interface Props {
    editingPane: 'animation' | 'image' | 'video-upload' | null;
    isFullscreen: boolean;
    isMobile: boolean;
    returnLabel: string;
    onClose: () => void;
    onExitEditMode: () => void;
    sequence?: SequenceData | null;
    isFavorite?: boolean;
    isSaved?: boolean;
    isPublished?: boolean;
    isOwned?: boolean;
    isLoggedIn?: boolean;
    practiceActive?: boolean;
    onFavorite?: () => void;
    onSave?: () => void;
    onEdit?: () => void;
    onPracticeToggle?: () => void;
    onVideoUpload?: () => void;
    onPublish?: () => void;
    onUnpublish?: () => void;
    onDeleteRequest?: () => void;
  }

  let {
    editingPane,
    isFullscreen,
    isMobile,
    returnLabel,
    onClose,
    onExitEditMode,
    sequence,
    isFavorite = false,
    isSaved = true,
    isPublished = false,
    isOwned = false,
    isLoggedIn = false,
    practiceActive = false,
    onFavorite,
    onSave,
    onEdit,
    onPracticeToggle,
    onVideoUpload,
    onPublish,
    onUnpublish,
    onDeleteRequest,
  }: Props = $props();

  let copyClaudeFeedback = $state(false);

  async function handleCopyForClaude() {
    if (!sequence) return;
    try {
      const copier = getClaudeCodeCopier();
      await copier.copyForClaude(sequence);
      copyClaudeFeedback = true;
      setTimeout(() => { copyClaudeFeedback = false; }, 1500);
    } catch (error) {
      console.error("[RouteViewerHeader] Copy for Claude failed:", error);
    }
  }


</script>

<header
  class="route-header"
  class:mobile={isMobile}
  class:export-header={!!editingPane}
  data-hidden={isFullscreen}
>
  {#if isMobile && !editingPane}
    <div class="swipe-handle" aria-hidden="true"></div>
  {/if}

  <div class="header-left">
    <button
      type="button"
      class="back-button"
      onclick={onClose}
      aria-label={editingPane ? "Close viewer" : `Back to ${returnLabel}`}
    >
      <i class="fas fa-arrow-left" aria-hidden="true"></i>
      {#if !isMobile && !editingPane}
        <span class="back-label">{returnLabel}</span>
      {/if}
    </button>
  </div>

  <div class="header-center">
    {#if editingPane}
      <h2 class="mode-title">
        {#if editingPane === "animation"}
          Download Animation
        {:else if editingPane === "image"}
          Download Card
        {:else}
          Upload Video
        {/if}
      </h2>
    {:else}
      <div class="title-group">
        <h2 class="sequence-title">Sequence Viewer</h2>
        {#if isMobile}
          <p class="export-hint">Tap to download</p>
        {/if}
      </div>
    {/if}
  </div>

  <div class="header-right">
    {#if onFavorite}
      <button
        type="button"
        class="header-action-btn"
        class:favorited={isFavorite}
        onclick={onFavorite}
        aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
      >
        <i class="fas fa-heart" aria-hidden="true"></i>
      </button>
    {/if}

    {#if !isSaved && onSave}
      <button
        type="button"
        class="header-action-btn save"
        onclick={onSave}
        aria-label="Save sequence"
      >
        <i class="fas fa-floppy-disk" aria-hidden="true"></i>
      </button>
    {/if}

    {#if onEdit}
      <button
        type="button"
        class="header-action-btn remix"
        onclick={onEdit}
        aria-label="Remix"
      >
        <i class="fas fa-pen-to-square" aria-hidden="true"></i>
      </button>
    {/if}

    <span class="header-action-divider"></span>

    <MotionVisibilityToggle />

    {#if authState.isAdmin}
      <button
        type="button"
        class="header-action-btn"
        onclick={handleCopyForClaude}
        aria-label="Copy sequence data for Claude"
        title="Copy for Claude"
      >
        <i class="fas {copyClaudeFeedback ? 'fa-check' : 'fa-terminal'}" aria-hidden="true"></i>
      </button>
    {/if}

    <ViewerOverflowMenu
      variant="header"
      sequenceId={sequence?.id}
      onVideoUpload={isLoggedIn ? onVideoUpload : undefined}
      {isPublished}
      onPublish={isOwned && isSaved ? onPublish : undefined}
      onUnpublish={isOwned && isSaved ? onUnpublish : undefined}
      onDeleteRequest={isOwned && isSaved ? onDeleteRequest : undefined}
    />
  </div>
</header>

<style>
  /* Header - CSS Grid for true center */
  .route-header {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    padding: 12px 16px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    flex-shrink: 0;
  }

  .route-header[data-hidden="true"] {
    display: none;
  }

  /* Swipe handle - visual affordance for swipe-to-dismiss */
  .swipe-handle {
    position: absolute;
    top: 6px;
    left: 50%;
    transform: translateX(-50%);
    width: 40px;
    height: 4px;
    background: rgba(255, 255, 255, 0.3);
    border-radius: 2px;
  }

  /* Mobile header - minimal, with swipe affordance */
  .route-header.mobile {
    padding-top: 16px;
    touch-action: pan-y;
  }

  .route-header.mobile .sequence-title {
    max-width: 150px;
    font-size: var(--font-size-min, 14px);
  }

  .header-left {
    justify-self: start;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .header-right {
    justify-self: end;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .header-center {
    display: flex;
    justify-content: center;
  }

  .back-button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-width: var(--min-touch-target);
    height: var(--min-touch-target);
    padding: 0 12px;
    background: transparent;
    border: none;
    border-radius: 8px;
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.6));
    font-size: 16px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .back-button:hover {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text, white);
  }

  .back-button:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  .back-label {
    font-size: var(--font-size-sm, 14px);
    font-weight: 500;
  }

  .header-action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: var(--min-touch-target);
    min-height: var(--min-touch-target);
    background: none;
    border: none;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    cursor: pointer;
    border-radius: 8px;
    transition: background 150ms ease, color 150ms ease;
  }

  .header-action-btn:hover {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text, #ffffff);
  }

  .header-action-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  .header-action-btn.favorited {
    color: var(--semantic-error, #ef4444);
  }

  .header-action-btn.save {
    color: #22c55e;
  }

  .header-action-btn.remix {
    color: #f59e0b;
  }

  .header-action-divider {
    width: 1px;
    height: 20px;
    background: var(--theme-stroke, rgba(255, 255, 255, 0.1));
    margin: 0 2px;
    flex-shrink: 0;
  }

  .title-group {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }

  /* Sequence title in header */
  .sequence-title,
  .mode-title {
    margin: 0;
    font-size: var(--font-size-lg, 18px);
    font-weight: 600;
    color: var(--theme-text, white);
    text-align: center;
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .export-hint {
    margin: 0;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.45));
    font-weight: 400;
  }

  @media (prefers-reduced-motion: reduce) {
    .route-header,
    .back-button {
      transition: none !important;
    }
  }
</style>
