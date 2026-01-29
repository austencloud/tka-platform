<!--
SequenceDetailContent - Shared content for sequence detail view

Displays:
- Media viewer (images, animation, videos)
- Sequence metadata (word, difficulty, length, author)
- Action buttons (Favorite, Edit, Delete, Maximize)

Used by both desktop side panel and mobile slide-up overlay.
-->
<script lang="ts">
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import type { ISequenceDetailLoader } from "../services/contracts/ISequenceDetailLoader";
  import type { IVideoCountManager } from "../services/contracts/IVideoCountManager";
  import type { ISequenceImageSharer } from "$lib/shared/share/services/contracts/ISequenceImageSharer";
  import type { IClaudeCodeCopier } from "../services/contracts/IClaudeCodeCopier";
  import type { MediaType } from "$lib/shared/sequence-viewer/domain/types";
  import type { CollaborativeVideo } from "$lib/shared/video-collaboration/domain/CollaborativeVideo";

  import { container } from "$lib/shared/di";
  import { onMount } from "svelte";
  import { untrack } from "svelte";
  import { getAuthSync } from "$lib/shared/auth/firebase";

  // Child components
  import AvatarImage from "../../../creators/components/profile/AvatarImage.svelte";
  import SequenceViewer from "$lib/shared/sequence-viewer/components/SequenceViewer.svelte";
  import VideosPanel from "$lib/shared/video-collaboration/components/VideosPanel.svelte";
  import VariationStrip from "./VariationStrip.svelte";
  import DetailHeader from "./DetailHeader.svelte";
  import ShareOptionsRow from "./ShareOptionsRow.svelte";
  import SequenceActionButtons from "./SequenceActionButtons.svelte";

  // State imports
  import { browseNavigationState } from "../../../shared/state/browse-navigation-state.svelte";
  import { sequencePanelManager } from "../../../shared/state/sequence-panel-state.svelte";
  import { openSpotlightWithAnimation } from "$lib/shared/application/state/ui/ui-state.svelte";
  import { settingsService } from "$lib/shared/settings/state/SettingsState.svelte";
  import { getAnimationVisibilityManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
  import { authState } from "$lib/shared/auth/state/authState.svelte";

  // Services (resolved in onMount)
  let hapticService: IHapticFeedback | null = null;
  let detailLoader = $state<ISequenceDetailLoader | null>(null);
  let videoCountManager = $state<IVideoCountManager | null>(null);
  let imageSharer = $state<ISequenceImageSharer | null>(null);
  let claudeCopier = $state<IClaudeCodeCopier | null>(null);

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
  } = $props<{
    sequence: SequenceData;
    variations?: SequenceData[];
    variationIndex?: number;
    onClose?: () => void;
    onAction?: (action: string, sequence: SequenceData) => void;
    onInviteCollaborators?: (video: CollaborativeVideo) => void;
    onVariationSelect?: (index: number, sequence: SequenceData) => void;
  }>();

  // Light mode from visibility state
  const visibilityManager = getAnimationVisibilityManager();
  const lightMode = $derived(!visibilityManager.isDarkMode());

  // Prop settings for variation thumbnails
  const propSettings = $derived({
    bluePropType: settingsService.settings.bluePropType as PropType | undefined,
    redPropType: settingsService.settings.redPropType as PropType | undefined,
    catDogMode: settingsService.settings.catDogMode,
  });

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
    hapticService = container.items.hapticFeedback;
    detailLoader = container.items.sequenceDetailLoader;
    videoCountManager = container.items.videoCountManager;
    imageSharer = container.items.sequenceImageSharer;
    claudeCopier = container.items.claudeCodeCopier;
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
            fullSequence = loaded;
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
    if (currentMediaType === "animation") {
      openSpotlightWithAnimation(seq);
    } else {
      onAction("fullscreen", seq);
    }
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
    title="Sequence Details"
    isExpanded={sequencePanelManager.isDetailExpanded}
    getCopyData={getCopyDataForClaude}
    onCopyActivate={handleCopyActivate}
    onCollapse={() => sequencePanelManager.setDetailExpanded(false)}
    {onClose}
  />

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
        aria-label={`View ${sequence.ownerDisplayName || "creator"}'s profile`}
      >
        <AvatarImage
          src={sequence.ownerAvatarUrl}
          alt={sequence.ownerDisplayName || "Creator"}
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
              By {sequence.ownerDisplayName || sequence.author || "Unknown"}
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
          <span class="metadata-item">By {sequence.author}</span>
        {/if}
      </div>
    {/if}
  </div>

  <!-- Action Buttons -->
  <SequenceActionButtons
    isFavorite={sequence.isFavorite}
    {isOwned}
    {videoCount}
    onFavorite={() => handleAction("favorite")}
    onEdit={() => handleAction("edit")}
    onFork={() => handleAction("fork")}
    onShare={() => handleAction("share")}
    onVideos={handleVideosClick}
    onDelete={() => handleAction("delete")}
    onMaximize={handleMaximize}
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
</style>
