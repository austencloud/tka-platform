<!--
  ViewerHeader.svelte

  The /sequence route header (back nav, engagement + management actions). The
  /q scan page renders SequenceViewerShell (the app drawer's chrome) instead —
  do NOT re-grow a scan variant here. Derives its ViewerOverflowMenu prop-set
  from buildHeaderActions so the action gating lives in exactly one place
  (viewer-actions.ts). Center title IS the menu trigger, matching the app.
-->
<script lang="ts">
  import type { OrchestratorContext } from "./SequenceViewerOrchestrator.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import { authState } from "$lib/shared/auth/state/auth-state.svelte";
  import { saveActionVerb } from "$lib/shared/mobile/share-action.svelte";
  import { getClaudeCodeCopier } from "$lib/shared/browse/get-claude-code-copier";
  import MotionVisibilityToggle from "./MotionVisibilityToggle.svelte";
  import ViewerOverflowMenu from "./ViewerOverflowMenu.svelte";
  import { buildHeaderActions, type ViewerHeaderProfile } from "../services/viewer-actions";

  interface Props {
    profile: ViewerHeaderProfile;
    ctx: OrchestratorContext;
    isMobile: boolean;
    isFullscreen?: boolean;
    sequence?: SequenceData | null;
    editingPane?: "animation" | "image" | "video-upload" | null;
    returnLabel?: string;
    homeHref?: string;
    onDeleteRequest?: () => void;
  }

  let {
    profile,
    ctx,
    isMobile,
    isFullscreen = false,
    sequence = null,
    editingPane = null,
    returnLabel = "Back",
    homeHref,
    onDeleteRequest,
  }: Props = $props();

  const actions = $derived(
    buildHeaderActions(ctx, profile, { onDeleteRequest }),
  );

  const practiceActive = $derived(ctx.practiceActive);

  let copyClaudeFeedback = $state(false);
  async function handleCopyForClaude() {
    if (!sequence) return;
    try {
      await getClaudeCodeCopier().copyForClaude(sequence);
      copyClaudeFeedback = true;
      setTimeout(() => { copyClaudeFeedback = false; }, 1500);
    } catch (error) {
      console.error("[ViewerHeader] Copy for Claude failed:", error);
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
    <button type="button" class="back-button" data-escape-shortcut
      data-escape-shortcut-label="Viewer" onclick={ctx.onClose}
      aria-label={editingPane ? "Close viewer" : `Back to ${returnLabel}`}>
      <i class="fas fa-arrow-left" aria-hidden="true"></i>
      {#if !isMobile && !editingPane}<span class="back-label">{returnLabel}</span>{/if}
    </button>
    {#if homeHref && !editingPane && !practiceActive}
      <a href={homeHref} class="header-action-btn explore" aria-label="Explore TKA" title="Explore TKA">
        <i class="fas fa-compass" aria-hidden="true"></i>
      </a>
    {/if}
    {#if practiceActive}
      <button type="button" class="header-action-btn practice-exit"
        onclick={actions.onPracticeToggle} aria-label="Exit practice mode">
        <i class="fas fa-arrow-left" aria-hidden="true"></i><span>Exit Practice</span>
      </button>
    {/if}
  </div>

  {#snippet titleTrigger({ isOpen, hasMenu }: { isOpen: boolean; hasMenu: boolean })}
    {#if editingPane}
      <span class="sequence-title">
        {#if editingPane === "animation"}{saveActionVerb()} Animation
        {:else if editingPane === "image"}{saveActionVerb()} Card
        {:else}Upload Video{/if}
      </span>
    {:else}
      <span class="title-group">
        <span class="sequence-title">Sequence Viewer</span>
      </span>
    {/if}
    {#if hasMenu}
      <i class="fas fa-chevron-down title-caret" class:open={isOpen} aria-hidden="true"></i>
    {/if}
  {/snippet}

  <div class="header-center">
    {#if practiceActive}
      <div class="title-group"><h2 class="sequence-title">Practice Mode</h2></div>
    {:else}
      <ViewerOverflowMenu
        trigger={titleTrigger}
        dropDown
        align="center"
        variant="header"
        sequenceId={sequence?.id}
        isFavorite={actions.isFavorite}
        onFavoriteToggle={isMobile ? actions.onFavoriteToggle : undefined}
        isSaved={actions.isSaved}
        onSave={isMobile ? actions.onSave : undefined}
        onRemix={actions.onRemix}
        onVideoUpload={actions.onVideoUpload}
        isPublished={actions.isPublished}
        onPublish={actions.onPublish}
        onUnpublish={actions.onUnpublish}
        onDeleteRequest={actions.onDeleteRequest}
      />
    {/if}
  </div>

  <div class="header-right">
    {#if !practiceActive}
      {#if !isMobile && actions.onFavoriteToggle}
        <button type="button" class="header-action-btn" class:favorited={actions.isFavorite}
          onclick={actions.onFavoriteToggle}
          aria-label={actions.isFavorite ? "Remove from favorites" : "Add to favorites"}>
          <i class="fas fa-heart" aria-hidden="true"></i>
        </button>
      {/if}
      {#if !isMobile && !actions.isSaved && actions.onSave}
        <button data-save-shortcut type="button" class="header-action-btn save" onclick={actions.onSave} aria-label="Save sequence">
          <i class="fas fa-floppy-disk" aria-hidden="true"></i>
        </button>
      {/if}
      {#if !isMobile && actions.onRemix}
        <button type="button" class="header-action-btn remix" onclick={actions.onRemix} aria-label="Remix">
          <i class="fas fa-pen-to-square" aria-hidden="true"></i>
        </button>
      {/if}
      {#if actions.showPractice && actions.onPracticeToggle}
        <button type="button" class="header-action-btn practice" class:icon-only={isMobile}
          onclick={actions.onPracticeToggle} aria-label="Practice">
          <i class="fas fa-dumbbell" aria-hidden="true"></i>{#if !isMobile}<span>Practice</span>{/if}
        </button>
      {/if}
      <span class="header-action-divider"></span>
      <MotionVisibilityToggle />
      {#if authState.isAdmin}
        <button type="button" class="header-action-btn" onclick={handleCopyForClaude}
          aria-label="Copy sequence data for Claude" title="Copy for Claude">
          <i class="fas {copyClaudeFeedback ? 'fa-check' : 'fa-terminal'}" aria-hidden="true"></i>
        </button>
      {/if}
    {/if}
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
    /* Lift the header so the title-trigger dropdown lands above the viewer body. */
    position: relative;
    z-index: 20;
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
    text-decoration: none;
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
    color: var(--semantic-success, #22c55e);
  }

  .header-action-btn.remix {
    color: var(--semantic-warning, #f59e0b);
  }

  /* Practice entry — labeled accent CTA. Tinted accent fill (no border, like
     .practice-exit) so it stands out from the utility icon buttons. */
  .header-action-btn.practice {
    gap: 8px;
    padding: 0 16px;
    font-size: var(--font-size-min, 14px);
    font-weight: 700;
    color: var(--theme-accent, #a78bfa);
    background: color-mix(in srgb, var(--theme-accent, #8b5cf6) 18%, transparent);
  }
  .header-action-btn.practice:hover {
    background: color-mix(in srgb, var(--theme-accent, #8b5cf6) 30%, transparent);
    color: #fff;
  }
  /* Icon-only variant (mobile): square accent button, no label padding. */
  .header-action-btn.practice.icon-only {
    gap: 0;
    padding: 0;
  }

  .header-action-btn.practice-exit {
    gap: 8px;
    padding: 0 16px;
    font-size: var(--font-size-min, 14px);
    font-weight: 700;
    color: #fff;
    background: var(--semantic-error, #ef4444);
  }

  .header-action-btn.practice-exit:hover {
    background: color-mix(in srgb, var(--semantic-error, #ef4444) 85%, white);
    color: #fff;
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
  .sequence-title {
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

  /* Chevron affordance beside the clickable title; rotates when the menu opens. */
  .title-caret {
    font-size: 11px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    transition: transform 180ms ease;
    flex-shrink: 0;
  }
  .title-caret.open {
    transform: rotate(180deg);
  }
  @media (prefers-reduced-motion: reduce) {
    .title-caret {
      transition: none;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .route-header,
    .back-button {
      transition: none !important;
    }
  }
</style>
