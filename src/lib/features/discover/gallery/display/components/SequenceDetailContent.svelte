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
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import { tryResolve } from "$lib/shared/inversify/di";
  import { TYPES } from "$lib/shared/inversify/types";
  import { onMount } from "svelte";
  import AvatarImage from "../../../creators/components/profile/AvatarImage.svelte";
  import { discoverNavigationState } from "../../../shared/state/discover-navigation-state.svelte";
  import { galleryPanelManager } from "../../../shared/state/gallery-panel-state.svelte";
  import SequenceViewer from "$lib/shared/sequence-viewer/components/SequenceViewer.svelte";
  import SequenceVideosSection from "$lib/shared/video-collaboration/components/SequenceVideosSection.svelte";
  import VideoUploadSheet from "$lib/shared/video-collaboration/components/VideoUploadSheet.svelte";
  import type { CollaborativeVideo } from "$lib/shared/video-collaboration/domain/CollaborativeVideo";
  import { auth } from "$lib/shared/auth/firebase";
  import ShareHubDrawer from "$lib/shared/share-hub/components/ShareHubDrawer.svelte";

  let hapticService: IHapticFeedback | null = null;

  // Video state
  let showUploadSheet = $state(false);
  let videosKey = $state(0); // For refreshing videos section
  let selectedVideo = $state<CollaborativeVideo | null>(null);

  // Share Hub state
  let showShareHub = $state(false);

  const {
    sequence,
    onClose = () => {},
    onAction = () => {},
    onInviteCollaborators,
  } = $props<{
    sequence: SequenceData;
    onClose?: () => void;
    onAction?: (action: string, sequence: SequenceData) => void;
    onInviteCollaborators?: (video: CollaborativeVideo) => void;
  }>();

  onMount(() => {
    hapticService = tryResolve<IHapticFeedback>(TYPES.IHapticFeedback);
  });

  // Handlers
  function handleAction(action: string) {
    hapticService?.trigger("selection");

    // Handle local actions
    if (action === "upload-video") {
      showUploadSheet = true;
      return;
    }

    if (action === "share") {
      showShareHub = true;
      return;
    }

    onAction(action, sequence);
  }

  function handleVideoUploaded() {
    // Refresh the videos section
    videosKey++;
  }

  function handleVideoClick(video: CollaborativeVideo) {
    hapticService?.trigger("selection");
    selectedVideo = video;
  }

  function closeVideoPlayer() {
    selectedVideo = null;
  }

  function handleMaximize() {
    hapticService?.trigger("selection");
    onAction("fullscreen", sequence);
  }

  function handleCreatorClick() {
    if (!sequence.ownerId) return;
    hapticService?.trigger("selection");

    // Close the detail panel
    galleryPanelManager.close();

    // Navigate to creator profile using unified navigation state
    discoverNavigationState.viewCreatorProfile(
      sequence.ownerId,
      sequence.ownerDisplayName
    );
  }

  // Check if we have creator info to display
  const hasCreatorInfo = $derived(Boolean(sequence.ownerId));
  const currentUserId = $derived(auth.currentUser?.uid);
  const canInviteToVideo = $derived(
    Boolean(selectedVideo && currentUserId === selectedVideo.creatorId)
  );
</script>

<div class="detail-content">
  <!-- Header with close button -->
  <header class="detail-header">
    <span class="header-title">Sequence Details</span>
    <button class="close-button" onclick={onClose} aria-label="Close">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </button>
  </header>

  <!-- Media Viewer (Images, Animation, Video) -->
  <div class="media-container">
    <!-- Creator avatar badge (upper left) -->
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
      {sequence}
      initialMediaType="image"
      controlsLevel="standard"
    />
  </div>

  <!-- Metadata -->
  <div class="metadata">
    {#if hasCreatorInfo || sequence.author}
      <div class="metadata-row">
        {#if hasCreatorInfo}
          <button class="creator-link" onclick={handleCreatorClick}>
            <span class="creator-label"
              >By {sequence.ownerDisplayName ||
                sequence.author ||
                "Unknown"}</span
            >
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

  <!-- Videos Section -->
  {#key videosKey}
    <SequenceVideosSection
      sequenceId={sequence.id}
      onVideoClick={handleVideoClick}
      onUploadClick={() => handleAction("upload-video")}
    />
  {/key}

  <!-- Action Buttons -->
  <div class="action-buttons">
    <button
      class="action-btn action-btn-primary"
      class:favorited={sequence.isFavorite}
      onclick={() => handleAction("favorite")}
      aria-label={sequence.isFavorite
        ? "Remove from favorites"
        : "Add to favorites"}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill={sequence.isFavorite ? "currentColor" : "none"}
        stroke="currentColor"
        stroke-width="2"
      >
        <path
          d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
        />
      </svg>
      <span>{sequence.isFavorite ? "Saved" : "Save"}</span>
    </button>

    <button
      class="action-btn"
      onclick={() => handleAction("edit")}
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

    <button
      class="action-btn"
      onclick={() => handleAction("share")}
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

    <button
      class="action-btn"
      onclick={() => handleAction("delete")}
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

    <button
      class="action-btn action-btn-maximize"
      onclick={handleMaximize}
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
</div>

<!-- Video Upload Sheet -->
<VideoUploadSheet
  show={showUploadSheet}
  {sequence}
  onClose={() => (showUploadSheet = false)}
  onUploaded={handleVideoUploaded}
/>

<!-- Share Hub Drawer -->
<ShareHubDrawer
  bind:isOpen={showShareHub}
  {sequence}
  onClose={() => (showShareHub = false)}
/>

<!-- Video Player Modal -->
{#if selectedVideo}
  <div class="video-player-overlay" role="dialog" aria-label="Video player">
    <button
      class="video-player-backdrop"
      onclick={closeVideoPlayer}
      aria-label="Close video player"
    ></button>
    <div class="video-player-container">
      <header class="video-player-header">
        <div class="video-player-title">
          <i class="fas fa-video" aria-hidden="true"></i>
          <span>Performance Video</span>
        </div>
        <div class="video-player-actions">
          {#if canInviteToVideo && onInviteCollaborators}
            <button
              class="video-player-invite"
              onclick={() => {
                onInviteCollaborators(selectedVideo);
                closeVideoPlayer();
              }}
            >
              <i class="fas fa-user-plus" aria-hidden="true"></i>
              Invite
            </button>
          {/if}
          <button
            class="video-player-close"
            onclick={closeVideoPlayer}
            aria-label="Close video"
          >
            <i class="fas fa-times" aria-hidden="true"></i>
          </button>
        </div>
      </header>
      <div class="video-player-content">
        <video
          src={selectedVideo.videoUrl}
          controls
          autoplay
          muted
          playsinline
          class="video-player-video"
        >
          <track kind="captions" />
        </video>
      </div>
      {#if selectedVideo.description}
        <div class="video-player-description">
          {selectedVideo.description}
        </div>
      {/if}
    </div>
  </div>
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

  /* Header row with title and close button */
  .detail-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: clamp(8px, 2cqi, 12px);
    border-bottom: 1px solid var(--theme-stroke, var(--theme-stroke));
    flex-shrink: 0;
  }

  .header-title {
    font-size: clamp(14px, 4cqi, 18px);
    font-weight: 600;
    color: color-mix(in srgb, var(--theme-text, white) 90%, transparent);
  }

  /* Close button - uses global touch target token */
  .close-button {
    width: var(--touch-target-min);
    height: var(--touch-target-min);
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--theme-card-bg, var(--theme-card-bg));
    border: 1px solid var(--theme-stroke, var(--theme-stroke-strong));
    border-radius: 50%;
    color: var(--theme-text-dim);
    cursor: pointer;
    transition: all 0.2s ease;
    flex-shrink: 0;
  }

  .close-button svg {
    width: var(--icon-size-md);
    height: var(--icon-size-md);
  }

  .close-button:hover {
    background: var(--theme-card-hover-bg);
    border-color: var(--theme-stroke-strong);
    color: var(--theme-text, white);
  }

  .close-button:active {
    transform: scale(0.95);
  }

  /* Media Container - holds the unified media viewer */
  .media-container {
    flex: 1;
    min-height: clamp(200px, 45cqi, 350px);
    max-height: 70%;
    width: 100%;
    max-width: 100%;
    border-radius: clamp(8px, 2cqi, 12px);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    position: relative;
  }

  /* Creator avatar badge - clickable, upper left corner */
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
    transition: all 0.2s ease;
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

  /* Style the avatar inside the badge */
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
    transition: all 0.2s ease;
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
    transition: all 0.2s ease;
  }

  .creator-link:hover .creator-arrow {
    opacity: 1;
    transform: translateX(2px);
  }

  /* Action Buttons */
  .action-buttons {
    display: flex;
    gap: clamp(8px, 2cqi, 12px);
    flex-wrap: wrap;
    justify-content: center;
    margin-top: auto;
    padding-top: clamp(8px, 2cqi, 12px);
  }

  /* Action buttons - uses global touch target token */
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

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .close-button,
    .action-btn,
    .creator-badge {
      transition: none;
    }

    .close-button:active,
    .action-btn:active,
    .creator-badge:active {
      transform: none;
    }
  }

  /* Video Player Modal */
  .video-player-overlay {
    position: fixed;
    inset: 0;
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
  }

  .video-player-backdrop {
    position: absolute;
    inset: 0;
    background: color-mix(in srgb, var(--theme-shadow) 85%, transparent);
    border: none;
    cursor: pointer;
  }

  .video-player-container {
    position: relative;
    display: flex;
    flex-direction: column;
    width: 100%;
    max-width: 800px;
    max-height: 90vh;
    background: var(
      --theme-panel-bg,
      linear-gradient(
        135deg,
        rgba(20, 20, 30, 0.98) 0%,
        rgba(30, 30, 45, 0.98) 100%
      )
    );
    border: 1px solid var(--theme-stroke, var(--theme-stroke));
    border-radius: 16px;
    overflow: hidden;
    animation: videoPlayerIn 0.2s ease-out;
  }

  @keyframes videoPlayerIn {
    from {
      opacity: 0;
      transform: scale(0.95);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  .video-player-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.25rem;
    background: var(--theme-card-bg);
    border-bottom: 1px solid var(--theme-stroke);
  }

  .video-player-title {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    font-size: 1rem;
    font-weight: 600;
    color: var(--theme-text, white);
  }

  .video-player-title i {
    color: var(--semantic-info, var(--semantic-info));
  }

  .video-player-actions {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .video-player-invite {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.5rem 0.85rem;
    background: linear-gradient(135deg, var(--semantic-info) 0%, #2563eb 100%);
    border: none;
    border-radius: 8px;
    color: white;
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .video-player-invite:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
  }

  .video-player-close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    background: var(--theme-card-bg, var(--theme-card-bg));
    border: none;
    border-radius: 8px;
    color: var(--theme-text-dim, var(--theme-text-dim));
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .video-player-close:hover {
    background: var(--theme-card-hover-bg);
    color: var(--theme-text, white);
  }

  .video-player-content {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--theme-shadow, black);
  }

  .video-player-video {
    width: 100%;
    max-height: 70vh;
    object-fit: contain;
  }

  .video-player-description {
    padding: 1rem 1.25rem;
    font-size: 0.9rem;
    color: var(--theme-text-dim, var(--theme-text-dim));
    border-top: 1px solid var(--theme-stroke);
    background: var(--theme-card-bg);
  }
</style>
