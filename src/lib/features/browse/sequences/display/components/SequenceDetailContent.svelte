<!--
SequenceDetailContent - Shared content for sequence detail view

Displays:
- Media viewer (images, animation, videos)
- Sequence metadata (word, difficulty, length, author)
- Action buttons (Favorite, Edit, Delete, Maximize)

Used by both desktop side panel and mobile slide-up overlay.
-->
<script lang="ts">

import { isFavorite as checkIsFavorite, toggleFavorite as doToggleFavorite } from "$lib/shared/library/services/collection-manager";
import { getLibraryRepository } from "$lib/shared/library/getLibraryRepository";
  import { getHapticFeedback } from "$lib/shared/application/getHapticFeedback";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
  import type { HapticFeedback } from "$lib/shared/application/services/implementations/HapticFeedback";
  import type { SequenceDetailLoader } from "$lib/shared/browse/services/SequenceDetailLoader";
  import type { VideoCountManager } from "$lib/shared/browse/services/VideoCountManager";
  import type { SequenceImageSharer } from "$lib/shared/share/services/sequence-image-sharer";
  import { getSequenceImageSharer } from "$lib/shared/share/get-sequence-image-sharer";
  import type { ClaudeCodeCopier } from "$lib/shared/browse/services/ClaudeCodeCopier";
  import type { MediaType } from "$lib/shared/sequence-viewer/domain/types";
  import type { CollaborativeVideo } from "$lib/shared/video-collaboration/domain/CollaborativeVideo";
  import PropContextChip from "$lib/shared/sequence-viewer/components/PropContextChip.svelte";
  import { resolvePresentation } from "$lib/shared/sequence-viewer/services/presentation-resolver";
import type { ViewingContext } from "$lib/shared/sequence-viewer/services/presentation-resolver";
  import type { LibraryRepository } from "$lib/shared/library/services/LibraryRepository";
  import { getSequenceDetailLoader } from "$lib/shared/browse/getSequenceDetailLoader";
  import { getVideoCountManager } from "$lib/shared/browse/getVideoCountManager";
  import { getClaudeCodeCopier } from "$lib/shared/browse/getClaudeCodeCopier";
  import { onMount } from "svelte";
  import { untrack } from "svelte";
  import { getAuthSync } from "$lib/shared/auth/firebase";

  // Child components
  import AvatarImage from "$lib/shared/browse/components/AvatarImage.svelte";
  import SequenceViewer from "$lib/shared/sequence-viewer/components/SequenceViewer.svelte";
  import VideosPanel from "$lib/shared/video-collaboration/components/VideosPanel.svelte";
  import VariationStrip from "./VariationStrip.svelte";
  import DetailHeader from "./DetailHeader.svelte";
  import ShareOptionsRow from "./ShareOptionsRow.svelte";
  import SequenceActionButtons from "./SequenceActionButtons.svelte";
  import CompositionBreakdown from "../../../shared/components/CompositionBreakdown.svelte";
  import {
    openSendSequenceSheet,
    buildSequenceSharePayload,
    buildThumbnailUrl,
  } from "$lib/shared/inbox/state/send-sequence-state.svelte";

  // State imports
  import { browseNavigationState } from "$lib/shared/browse/state/browse-navigation-state.svelte";
  import { sequencePanelManager } from "$lib/shared/browse/state/sequence-panel-state.svelte";
  import { settingsService } from "$lib/shared/settings/state/SettingsState.svelte";
  import { getAnimationVisibilityManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
  import { authState } from "$lib/shared/auth/state/authState.svelte";
  import { t } from "$lib/shared/i18n/i18n.svelte";

  // Services (resolved in onMount)
  let hapticService: HapticFeedback | null = null;
  let detailLoader = $state<SequenceDetailLoader | null>(null);
  let videoCountManager = $state<VideoCountManager | null>(null);
  let imageSharer = $state<SequenceImageSharer | null>(null);
  let claudeCopier = $state<ClaudeCodeCopier | null>(null);

  // Save state detection
  let isSaved = $state(true); // Default: assume saved (hide Save button while checking)
  let isFavorite = $state(false);
  let libraryRepo = $state<LibraryRepository | null>(null);

  // Content hash cache (avoids re-querying Firestore for same hash)
  const savedHashCache = new Map<string, boolean>();

  // Video state
  let videoCount = $state(0);
  let showVideosPanel = $state(false);

  // Share options state
  let showShareOptions = $state(false);
  let isShareCopying = $state(false);
  let shareSuccess = $state(false);

  // Current media type (tracked for maximize behavior)
  let currentMediaType = $state<MediaType>("image");

  // Full sequence with steps loaded
  let fullSequence = $state<SequenceData | null>(null);
  let isLoadingFullSequence = $state(false);

  // User name for sharing
  const userName = $derived(authState.user?.displayName ?? "");

  const {
    sequence,
    variations = [],
    variationIndex = 0,
    onClose = () => {},
    onAction = () => {},
    onInviteCollaborators,
    onVariationSelect = () => {},
    onNavigateToView,
    viewingContext = "notation",
  } = $props<{
    sequence: SequenceData;
    variations?: SequenceData[];
    variationIndex?: number;
    onClose?: () => void;
    onAction?: (action: string, sequence: SequenceData) => void;
    onInviteCollaborators?: (video: CollaborativeVideo) => void;
    onVariationSelect?: (index: number, sequence: SequenceData) => void;
    /** Navigate to a specific composition view (e.g. solo blue hand path) */
    onNavigateToView?: (subject: "props" | "hands", granularity: "combined" | "solo", color: "blue" | "red") => void;
    viewingContext?: ViewingContext;
  }>();

  // Light mode from visibility state
  const visibilityManager = getAnimationVisibilityManager();
  const lightMode = $derived(!visibilityManager.isDarkMode());

  // Ephemeral override: user toggled the chip
  let contextOverride = $state<ViewingContext | null>(null);
  const activeContext = $derived(contextOverride ?? viewingContext);

  const presentation = $derived.by(() => {
    const viewerBlue = settingsService.settings.bluePropType as PropType;
    const viewerRed = settingsService.settings.redPropType as PropType;
    const viewerCatDog = settingsService.settings.catDogMode ?? false;

    return resolvePresentation(
      sequence,
      activeContext,
      viewerBlue,
      viewerRed,
      viewerCatDog
    );
  });

  const propSettings = $derived({
    bluePropType: presentation.bluePropType,
    redPropType: presentation.redPropType,
    catDogMode: presentation.catDogMode,
  });

  function togglePropContext() {
    contextOverride = activeContext === "creator-expression"
      ? "notation"
      : "creator-expression";
  }

  const isCatDog = $derived(
    propSettings.bluePropType !== propSettings.redPropType ||
      propSettings.catDogMode
  );

  // Creator info
  const hasCreatorInfo = $derived(Boolean(sequence.ownerId));
  const currentUserId = $derived(getAuthSync().currentUser?.uid);
  const isOwned = $derived(
    Boolean(currentUserId && sequence.ownerId === currentUserId)
  );

  onMount(() => {
    hapticService = getHapticFeedback();
    detailLoader = getSequenceDetailLoader();
    videoCountManager = getVideoCountManager();
    imageSharer = getSequenceImageSharer();
    claudeCopier = getClaudeCodeCopier();
    libraryRepo = getLibraryRepository();
  });

  // Load full sequence data when sequence changes
  $effect(() => {
    const currentSequence = sequence;
    const loader = detailLoader;

    fullSequence = null;
    isLoadingFullSequence = false;

    if (!currentSequence || !loader) return;

    if (currentSequence.steps && currentSequence.steps.length > 0) {
      fullSequence = currentSequence;
      return;
    }

    untrack(() => {
      isLoadingFullSequence = true;
      loader.loadFullSequence(currentSequence)
        .then((loaded) => {
          if (sequence.id === currentSequence.id && loaded) {
            // Preserve metadata from public index that the user's source doc may lack
            fullSequence = loaded.loopType
              ? loaded
              : { ...loaded, loopType: currentSequence.loopType };
          }
        })
        .catch((err) => {
          console.warn("[SequenceDetailContent] Failed to load full sequence:", err);
        })
        .finally(() => {
          if (sequence.id === currentSequence.id) {
            isLoadingFullSequence = false;
          }
        });
    });
  });

  // Load video count when sequence changes
  $effect(() => {
    const currentSequence = sequence;
    const manager = videoCountManager;

    videoCount = 0;
    if (!manager || !currentSequence) return;

    untrack(() => {
      manager.getVideoCount(currentSequence.id)
        .then((count) => {
          if (sequence.id === currentSequence.id) {
            videoCount = count;
          }
        })
        .catch((e) => {
          console.warn("[SequenceDetailContent] Failed to load video count:", e);
        });
    });
  });

  // Check if sequence is already saved in user's library (by content hash)
  $effect(() => {
    const currentSequence = sequence;
    const repo = libraryRepo;

    isSaved = true; // Optimistic: hide Save while loading

    if (!repo || !currentSequence?.contentHash || !currentUserId) return;

    const hash = currentSequence.contentHash;

    // Check cache first
    if (savedHashCache.has(hash)) {
      isSaved = savedHashCache.get(hash)!;
      return;
    }

    untrack(() => {
      repo.hasMatchingContent(hash)
        .then((found) => {
          savedHashCache.set(hash, found);
          if (sequence.id === currentSequence.id) {
            isSaved = found;
          }
        })
        .catch(() => {
          // On error, keep Save hidden (safe default)
        });
    });
  });

  // Check if sequence is favorited
  $effect(() => {
    const currentSequence = sequence;

    isFavorite = false;

    if (!currentSequence) return;

    untrack(() => {
      checkIsFavorite(currentSequence.id)
        .then((fav) => {
          if (sequence.id === currentSequence.id) {
            isFavorite = fav;
          }
        })
        .catch(() => {});
    });
  });

  // Event handlers
  function handleVariationSelect(index: number, selectedSequence: SequenceData) {
    hapticService?.trigger("selection");
    onVariationSelect(index, selectedSequence);
  }

  function handleAction(action: string) {
    hapticService?.trigger("selection");
    if (action === "share") {
      showShareOptions = !showShareOptions;
      return;
    }
    onAction(action, sequence);
  }

  async function handleFavoriteToggle() {
    hapticService?.trigger("selection");
    // Optimistic update
    isFavorite = !isFavorite;
    try {
      await doToggleFavorite(sequence.id);
    } catch {
      // Revert on error
      isFavorite = !isFavorite;
    }
  }

  function handlePublish() {
    hapticService?.trigger("selection");
    onAction("publish", sequence);
  }

  let unpublishConfirmOpen = $state(false);

  function handleUnpublishRequest() {
    hapticService?.trigger("selection");
    unpublishConfirmOpen = true;
  }

  function handleUnpublishConfirm() {
    unpublishConfirmOpen = false;
    onAction("unpublish", sequence);
  }

  function handleVideosClick() {
    hapticService?.trigger("selection");
    showVideosPanel = true;
  }

  function handleVideosPanelClose() {
    showVideosPanel = false;
    videoCountManager?.refreshCount(sequence.id).then((count) => {
      videoCount = count;
    });
  }

  function handleMaximize() {
    hapticService?.trigger("selection");
    const seq = fullSequence ?? sequence;
    // Always delegate to parent via onAction - parent can decide to open the sequence viewer
    onAction("fullscreen", seq);
  }

  function handleSendTo() {
    hapticService?.trigger("selection");
    const propType = propSettings.bluePropType ?? "staff";
    const thumbnailUrl = buildThumbnailUrl(sequence.word || sequence.name, String(propType), false);
    openSendSequenceSheet(buildSequenceSharePayload({ ...sequence, thumbnailUrl }));
  }

  function handleCreatorClick() {
    if (!sequence.ownerId) return;
    hapticService?.trigger("selection");
    sequencePanelManager.close();
    browseNavigationState.viewCreatorProfile(
      sequence.ownerId,
      sequence.ownerDisplayName
    );
  }

  // Get copy data for Claude (async because it uses the service)
  async function getCopyDataForClaude(): Promise<string> {
    if (!claudeCopier) return "";
    return await claudeCopier.generatePrompt(sequence);
  }

  // Haptic feedback on copy activation
  function handleCopyActivate() {
    hapticService?.trigger("selection");
  }

  // Share handlers
  async function handleCopyImage() {
    if (isShareCopying || !imageSharer) return;
    isShareCopying = true;
    shareSuccess = false;

    const seq = fullSequence ?? sequence;
    const result = await imageSharer.copyToClipboard(seq, userName);
    isShareCopying = false;

    if (result.success) {
      shareSuccess = true;
      hapticService?.trigger("success");
      setTimeout(() => { shareSuccess = false; }, 2000);
    } else {
      hapticService?.trigger("error");
    }
  }

  async function handleDownloadImage() {
    if (!imageSharer) return;
    hapticService?.trigger("selection");
    const seq = fullSequence ?? sequence;
    const result = await imageSharer.downloadImage(seq, userName);
    if (result.success) {
      hapticService?.trigger("success");
    } else {
      hapticService?.trigger("error");
    }
  }

  async function handleNativeShare() {
    if (!imageSharer) return;
    hapticService?.trigger("selection");
    const seq = fullSequence ?? sequence;
    const result = await imageSharer.nativeShare(seq, userName);
    if (result.success) {
      hapticService?.trigger("success");
    } else if (result.error) {
      hapticService?.trigger("error");
    }
  }
</script>

<div class="detail-content">
  <!-- Header -->
  <DetailHeader
    title={t('browse_sequence_details')}
    isExpanded={sequencePanelManager.isDetailExpanded}
    getCopyData={getCopyDataForClaude}
    onCopyActivate={handleCopyActivate}
    onCollapse={() => sequencePanelManager.setDetailExpanded(false)}
    {onClose}
  />

  <!-- Prop context chip: shown when creator saved with different props than the viewer uses -->
  {#if sequence.creatorIntent?.propConfig || sequence.intendedProp}
    <PropContextChip
      creatorDisplayName={sequence.ownerDisplayName ?? "Creator"}
      creatorBlueProp={sequence.creatorIntent?.propConfig?.bluePropType ?? sequence.intendedProp?.bluePropType ?? ("staff" as PropType)}
      creatorRedProp={sequence.creatorIntent?.propConfig?.redPropType ?? sequence.intendedProp?.redPropType ?? ("staff" as PropType)}
      viewerBlueProp={settingsService.settings.bluePropType as PropType}
      viewerRedProp={settingsService.settings.redPropType as PropType}
      source={presentation.source}
      onSwitch={togglePropContext}
    />
  {/if}

  <!-- Variation Strip -->
  {#if variations.length > 1}
    <VariationStrip
      {variations}
      currentIndex={variationIndex}
      onSelect={handleVariationSelect}
      bluePropType={propSettings.bluePropType}
      redPropType={propSettings.redPropType}
      catDogModeEnabled={isCatDog}
      {lightMode}
    />
  {/if}

  <!-- Media Viewer -->
  <div class="media-container">
    {#if hasCreatorInfo}
      <button
        class="creator-badge"
        onclick={handleCreatorClick}
        aria-label={t('browse_view_creator_profile', { name: sequence.ownerDisplayName || t('browse_creator_default') })}
      >
        <AvatarImage
          src={sequence.ownerAvatarUrl}
          alt={sequence.ownerDisplayName || t('browse_creator_default')}
          name={sequence.ownerDisplayName}
          size={48}
        />
      </button>
    {/if}

    <SequenceViewer
      sequence={fullSequence ?? sequence}
      initialMediaType="image"
      controlsLevel="standard"
      showVisibilitySettings={true}
      onMediaTypeChange={(type) => currentMediaType = type}
    />
  </div>

  <!-- Metadata -->
  <div class="metadata">
    {#if hasCreatorInfo || sequence.author}
      <div class="metadata-row">
        {#if hasCreatorInfo}
          <button class="creator-link" onclick={handleCreatorClick}>
            <span class="creator-label">
              {t('browse_by_creator', { name: sequence.ownerDisplayName || sequence.author || t('browse_unknown') })}
            </span>
            <svg
              class="creator-arrow"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        {:else}
          <span class="metadata-item">{t('browse_by_creator', { name: sequence.author })}</span>
        {/if}
      </div>
    {/if}
  </div>

  <!-- Composition Breakdown: navigate to solo/hand views -->
  {#if onNavigateToView}
    <CompositionBreakdown
      {sequence}
      {onNavigateToView}
    />
  {/if}

  <!-- Action Buttons -->
  <SequenceActionButtons
    isLoggedIn={!!currentUserId}
    {isOwned}
    {isSaved}
    isPublished={sequence.visibility === "public"}
    {isFavorite}
    {videoCount}
    onFavorite={handleFavoriteToggle}
    onSave={() => handleAction("save")}
    onEdit={() => handleAction("edit")}
    onShare={() => handleAction("share")}
    onSendTo={handleSendTo}
    onVideos={handleVideosClick}
    onDelete={() => handleAction("delete")}
    onMaximize={handleMaximize}
    onPublish={handlePublish}
    onUnpublish={handleUnpublishRequest}
  />

  <!-- Share Options Row -->
  {#if showShareOptions}
    <ShareOptionsRow
      isCopying={isShareCopying}
      copySuccess={shareSuccess}
      canNativeShare={imageSharer?.canNativeShare() ?? false}
      onCopy={handleCopyImage}
      onDownload={handleDownloadImage}
      onNativeShare={handleNativeShare}
    />
  {/if}
</div>

{#if unpublishConfirmOpen}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="confirm-backdrop"
    onclick={() => (unpublishConfirmOpen = false)}
    onkeydown={(e) => { if (e.key === "Escape") unpublishConfirmOpen = false; }}
  >
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div class="confirm-dialog" role="alertdialog" aria-label="Confirm unpublish" tabindex="-1" onclick={(e) => e.stopPropagation()}>
      <p>Remove from community gallery? This sequence will still be in your library but won't appear in Browse.</p>
      <div class="confirm-actions">
        <button type="button" class="confirm-btn" onclick={() => (unpublishConfirmOpen = false)}>Cancel</button>
        <button type="button" class="confirm-btn confirm-danger" onclick={handleUnpublishConfirm}>Make Private</button>
      </div>
    </div>
  </div>
{/if}

<!-- Videos Panel -->
{#if showVideosPanel}
  <VideosPanel
    {sequence}
    onClose={handleVideosPanelClose}
    {onInviteCollaborators}
  />
{/if}

<style>
  .detail-content {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: clamp(12px, 4cqi, 24px);
    gap: clamp(12px, 3cqi, 20px);
    overflow-y: auto;
    container-type: inline-size;
    container-name: detail-panel;
  }

  /* Media Container */
  .media-container {
    flex: 1;
    min-height: clamp(200px, 45cqi, 350px);
    width: 100%;
    max-width: 100%;
    border-radius: clamp(8px, 2cqi, 12px);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    position: relative;
  }

  /* Creator avatar badge */
  .creator-badge {
    position: absolute;
    top: 8px;
    left: 8px;
    z-index: 10;
    padding: 0;
    margin: 0;
    background: color-mix(in srgb, var(--theme-shadow) 50%, transparent);
    border: 2px solid var(--theme-stroke-strong);
    border-radius: 50%;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
    box-shadow: 0 2px 8px var(--theme-shadow);
  }

  .creator-badge:hover {
    transform: scale(1.05);
    border-color: color-mix(in srgb, var(--theme-text, white) 60%, transparent);
    box-shadow: 0 4px 12px var(--theme-shadow);
  }

  .creator-badge:active {
    transform: scale(0.95);
  }

  .creator-badge :global(.avatar-image) {
    display: block;
  }

  /* Metadata */
  .metadata {
    display: flex;
    flex-direction: column;
    gap: clamp(6px, 2cqi, 10px);
  }

  .metadata-row {
    display: flex;
    gap: clamp(10px, 3cqi, 16px);
    justify-content: center;
    flex-wrap: wrap;
  }

  .metadata-item {
    font-size: clamp(12px, 3cqi, 14px);
    color: var(--theme-text-dim, var(--theme-text-dim));
  }

  .creator-link {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: var(--theme-card-bg, var(--theme-card-bg));
    border: 1px solid var(--theme-stroke-strong);
    padding: 8px 14px;
    border-radius: 20px;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
  }

  .creator-link:hover {
    background: var(--theme-card-hover-bg);
    border-color: var(--theme-stroke-strong);
  }

  .creator-link:active {
    transform: scale(0.97);
  }

  .creator-label {
    font-size: clamp(12px, 3cqi, 14px);
    color: color-mix(in srgb, var(--theme-text, white) 85%, transparent);
    font-weight: 500;
  }

  .creator-link:hover .creator-label {
    color: var(--theme-text, white);
  }

  .creator-arrow {
    opacity: 0.6;
    transition: all var(--duration-normal) ease;
  }

  .creator-link:hover .creator-arrow {
    opacity: 1;
    transform: translateX(2px);
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .creator-badge,
    .creator-link {
      transition: none;
    }

    .creator-badge:active,
    .creator-link:active {
      transform: none;
    }
  }

  /* Unpublish confirmation dialog */
  .confirm-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
  }

  .confirm-dialog {
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 16px;
    padding: 24px;
    max-width: 360px;
    width: calc(100% - 48px);
  }

  .confirm-dialog p {
    color: var(--theme-text, white);
    font-size: var(--font-size-min, 14px);
    line-height: 1.5;
    margin: 0 0 20px;
  }

  .confirm-actions {
    display: flex;
    gap: 12px;
    justify-content: flex-end;
  }

  .confirm-btn {
    padding: 10px 20px;
    border-radius: 10px;
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    cursor: pointer;
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text, white);
    transition: all var(--duration-fast, 150ms) ease;
  }

  .confirm-btn:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
  }

  .confirm-danger {
    background: color-mix(in srgb, var(--semantic-error) 15%, transparent);
    border-color: color-mix(in srgb, var(--semantic-error) 30%, transparent);
    color: var(--semantic-error);
  }

  .confirm-danger:hover {
    background: color-mix(in srgb, var(--semantic-error) 25%, transparent);
  }
</style>
