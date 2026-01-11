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
  import type { ICollaborativeVideoManager } from "$lib/shared/video-collaboration/services/contracts/ICollaborativeVideoManager";
  import type { IDiscoverLoader } from "../services/contracts/IDiscoverLoader";
  import { container } from "$lib/shared/di";
  import { onMount } from "svelte";
  import AvatarImage from "../../../creators/components/profile/AvatarImage.svelte";
  import { discoverNavigationState } from "../../../shared/state/discover-navigation-state.svelte";
  import { sequencePanelManager } from "../../../shared/state/sequence-panel-state.svelte";
  import SequenceViewer from "$lib/shared/sequence-viewer/components/SequenceViewer.svelte";
  import VideosPanel from "$lib/shared/video-collaboration/components/VideosPanel.svelte";
  import type { CollaborativeVideo } from "$lib/shared/video-collaboration/domain/CollaborativeVideo";
  import { getAuthSync } from "$lib/shared/auth/firebase";
  import ShareHubDrawer from "$lib/shared/share-hub/components/ShareHubDrawer.svelte";
  import VariationStrip from "./VariationStrip.svelte";
  import { settingsService } from "$lib/shared/settings/state/SettingsState.svelte";
  import { getAnimationVisibilityManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";

  let hapticService: IHapticFeedback | null = null;
  let videoService: ICollaborativeVideoManager | null = null;
  let loaderService: IDiscoverLoader | null = null;

  // Video state - now just tracking count and panel visibility
  let videoCount = $state(0);
  let showVideosPanel = $state(false);

  // Share Hub state
  let showShareHub = $state(false);

  // Copy for Claude state
  let justCopied = $state(false);
  let isCopyLoading = $state(false);

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

  // Get light mode from visibility state
  const visibilityManager = getAnimationVisibilityManager();
  const lightMode = $derived(!visibilityManager.isDarkMode());

  // Get prop settings for variation thumbnails
  const propSettings = $derived({
    bluePropType: settingsService.settings.bluePropType as PropType | undefined,
    redPropType: settingsService.settings.redPropType as PropType | undefined,
    catDogMode: settingsService.settings.catDogMode,
  });

  // Check if cat-dog mode is enabled
  const isCatDog = $derived(
    propSettings.bluePropType !== propSettings.redPropType ||
      propSettings.catDogMode
  );

  // Handle variation selection
  function handleVariationSelect(index: number, selectedSequence: SequenceData) {
    hapticService?.trigger("selection");
    onVariationSelect(index, selectedSequence);
  }

  onMount(async () => {
    hapticService = container.items.hapticFeedback;
    loaderService = container.items.discoverLoader;

    // Load video count for the compact button
    try {
      videoService = container.items.collaborativeVideoManager;
      if (videoService) {
        const videos = await videoService.getVideosForSequence(sequence.id);
        videoCount = videos.length;
      }
    } catch (e) {
      console.warn("[SequenceDetailContent] Failed to load video count:", e);
    }
  });

  // Handlers
  function handleAction(action: string) {
    hapticService?.trigger("selection");

    if (action === "share") {
      showShareHub = true;
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
    // Refresh video count when panel closes
    refreshVideoCount();
  }

  async function refreshVideoCount() {
    if (videoService) {
      try {
        const videos = await videoService.getVideosForSequence(sequence.id);
        videoCount = videos.length;
      } catch (e) {
        console.warn("[SequenceDetailContent] Failed to refresh video count:", e);
      }
    }
  }

  function handleMaximize() {
    hapticService?.trigger("selection");
    onAction("fullscreen", sequence);
  }

  /**
   * Copy sequence data as a prompt for Claude Code agents
   * Fetches full sequence data (including beats) if not already loaded
   */
  async function copyForClaudeCode() {
    hapticService?.trigger("selection");
    isCopyLoading = true;

    // Start with the current sequence, but fetch full data if beats are missing
    let fullSequence = sequence;

    // Gallery sequences have empty beats - load full data for comprehensive copy
    if ((!sequence.beats || sequence.beats.length === 0) && loaderService) {
      const sequenceName = sequence.word || sequence.id;
      try {
        const loaded = await loaderService.loadFullSequenceData(sequenceName);
        if (loaded) {
          fullSequence = loaded;
        }
      } catch (err) {
        console.warn("[SequenceDetailContent] Failed to load full sequence data:", err);
      }
    }

    isCopyLoading = false;

    // Build comprehensive sequence context
    const beatCount = fullSequence.beats?.length ?? 0;
    const difficultyText = fullSequence.difficultyLevel || fullSequence.level?.toString() || "Unknown";
    const tagsText = fullSequence.tags?.length ? fullSequence.tags.join(", ") : "None";

    // Format beat data compactly (just the essential motion info)
    // Motion data lives in beat.motions.blue/red (from PictographData)
    const beatSummary = fullSequence.beats?.length
      ? fullSequence.beats.map((beat: (typeof fullSequence.beats)[number], i: number) => {
          const blueMotion = beat.motions?.blue;
          const redMotion = beat.motions?.red;
          const blueInfo = blueMotion
            ? `${blueMotion.motionType} ${blueMotion.startLocation}->${blueMotion.endLocation}`
            : "none";
          const redInfo = redMotion
            ? `${redMotion.motionType} ${redMotion.startLocation}->${redMotion.endLocation}`
            : "none";
          return `  Beat ${i + 1}: Blue(${blueInfo}) Red(${redInfo})`;
        }).join("\n")
      : "  No beat data available";

    // Derive starting position from first beat's motion data
    // Starting position = startLocation + startOrientation of each prop at beat 1
    const firstBeat = fullSequence.beats?.[0];
    const blueStart = firstBeat?.motions?.blue;
    const redStart = firstBeat?.motions?.red;
    const startPosText = firstBeat
      ? `Blue: ${blueStart?.startLocation || "?"} (${blueStart?.startOrientation || "?"}), Red: ${redStart?.startLocation || "?"} (${redStart?.startOrientation || "?"})`
      : "No beats to derive from";

    // Build the prompt
    const text = `Analyze sequence ID: ${fullSequence.id}

**${fullSequence.word || fullSequence.name || "Untitled"}**
Difficulty: ${difficultyText} | Length: ${beatCount} beats | LOOP Type: ${fullSequence.loopType || "Unknown"}
Tags: ${tagsText}
Owner: ${fullSequence.ownerDisplayName || fullSequence.author || "Unknown"} (${fullSequence.ownerId || "no-id"})

---
**Database Location:**
- Collection: \`sequences\` (public) or \`users/{ownerId}/library\` (private)
- Document ID: \`${fullSequence.id}\`
- Owner ID: \`${fullSequence.ownerId || "unknown"}\`

**Starting Position (derived from beat 1):**
${startPosText}

**Beat Sequence:**
${beatSummary}

---
**Full Sequence JSON:**
\`\`\`json
${JSON.stringify(fullSequence, null, 2)}
\`\`\`

---
Use this data to investigate issues, analyze the sequence structure, or make modifications. The sequence is stored in Firebase Firestore.`;

    try {
      await navigator.clipboard.writeText(text);
      justCopied = true;
      setTimeout(() => {
        justCopied = false;
      }, 2000);
    } catch (err) {
      console.error("Failed to copy sequence for Claude:", err);
    }
  }

  function handleCreatorClick() {
    if (!sequence.ownerId) return;
    hapticService?.trigger("selection");

    // Close the detail panel
    sequencePanelManager.close();

    // Navigate to creator profile using unified navigation state
    discoverNavigationState.viewCreatorProfile(
      sequence.ownerId,
      sequence.ownerDisplayName
    );
  }

  // Check if we have creator info to display
  const hasCreatorInfo = $derived(Boolean(sequence.ownerId));
  const currentUserId = $derived(getAuthSync().currentUser?.uid);

  // Check if current user owns this sequence (for ownership-aware edit controls)
  const isOwned = $derived(
    Boolean(currentUserId && sequence.ownerId === currentUserId)
  );
</script>

<div class="detail-content">
  <!-- Header with collapse/close buttons -->
  <header class="detail-header">
    <span class="header-title">Sequence Details</span>
    <div class="header-buttons">
      <!-- Copy for Claude Code button -->
      <button
        class="header-btn copy-btn"
        class:copied={justCopied}
        class:loading={isCopyLoading}
        onclick={copyForClaudeCode}
        disabled={isCopyLoading}
        aria-label="Copy for Claude Code"
        title="Copy sequence data for AI analysis"
      >
        {#if isCopyLoading}
          <svg class="spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10" stroke-dasharray="32" stroke-dashoffset="12"></circle>
          </svg>
        {:else if justCopied}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        {:else}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="4 17 10 11 4 5"></polyline>
            <line x1="12" y1="19" x2="20" y2="19"></line>
          </svg>
        {/if}
      </button>

      {#if sequencePanelManager.isDetailExpanded}
        <button
          class="collapse-button"
          onclick={() => sequencePanelManager.setDetailExpanded(false)}
          aria-label="Collapse panel"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <polyline points="11 17 6 12 11 7"></polyline>
            <polyline points="18 17 13 12 18 7"></polyline>
          </svg>
        </button>
      {/if}
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
    </div>
  </header>

  <!-- Variation Strip (when sequence has variations) -->
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
      showVisibilitySettings={false}
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

    {#if isOwned}
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
    {:else}
      <!-- Fork button for non-owned sequences -->
      <button
        class="action-btn"
        onclick={() => handleAction("fork")}
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

    <!-- Videos Button -->
    <button
      class="action-btn action-btn-videos"
      onclick={handleVideosClick}
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

    {#if isOwned}
      <button
        class="action-btn action-btn-danger"
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
    {/if}

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

<!-- Videos Panel (full overlay) -->
{#if showVideosPanel}
  <VideosPanel
    {sequence}
    onClose={handleVideosPanelClose}
    {onInviteCollaborators}
  />
{/if}

<!-- Share Hub Drawer -->
<ShareHubDrawer
  bind:isOpen={showShareHub}
  {sequence}
  mode="discover"
  {isOwned}
  creatorInfo={hasCreatorInfo
    ? {
        ownerId: sequence.ownerId ?? "",
        displayName: sequence.ownerDisplayName ?? "Unknown",
        avatarUrl: sequence.ownerAvatarUrl,
      }
    : null}
  isFavorite={sequence.isFavorite ?? false}
  onFavoriteToggle={() => handleAction("favorite")}
  onFork={() => handleAction("fork")}
  onDelete={isOwned ? () => handleAction("delete") : undefined}
  onClose={() => (showShareHub = false)}
/>

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

  /* Header buttons container */
  .header-buttons {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  /* Collapse button - shrinks panel back to normal width */
  .collapse-button {
    width: var(--touch-target-min);
    height: var(--touch-target-min);
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--theme-accent, #3b82f6);
    border: 1px solid var(--theme-accent, #3b82f6);
    border-radius: 50%;
    color: white;
    cursor: pointer;
    transition: all 0.2s ease;
    flex-shrink: 0;
  }

  .collapse-button svg {
    width: var(--icon-size-md);
    height: var(--icon-size-md);
  }

  .collapse-button:hover {
    background: color-mix(in srgb, var(--theme-accent, #3b82f6) 85%, black);
    border-color: color-mix(in srgb, var(--theme-accent, #3b82f6) 85%, black);
    transform: scale(1.05);
  }

  .collapse-button:active {
    transform: scale(0.95);
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

  /* Header button base style */
  .header-btn {
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

  .header-btn svg {
    width: var(--icon-size-md);
    height: var(--icon-size-md);
  }

  .header-btn:hover {
    background: var(--theme-card-hover-bg);
    border-color: var(--theme-stroke-strong);
    color: var(--theme-text, white);
  }

  .header-btn:active {
    transform: scale(0.95);
  }

  /* Copy button - terminal/code icon style */
  .copy-btn:hover {
    border-color: var(--semantic-info, #3b82f6);
    color: var(--semantic-info, #3b82f6);
  }

  .copy-btn.copied {
    background: var(--semantic-success, #22c55e);
    border-color: var(--semantic-success, #22c55e);
    color: white;
  }

  .copy-btn.loading {
    border-color: var(--semantic-info, #3b82f6);
    color: var(--semantic-info, #3b82f6);
    cursor: wait;
  }

  .copy-btn .spinner {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  /* Media Container - holds the unified media viewer */
  /* flex: 1 lets it grow to fill available space between header and buttons */
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
    .close-button,
    .collapse-button,
    .header-btn,
    .action-btn,
    .creator-badge {
      transition: none;
    }

    .close-button:active,
    .collapse-button:active,
    .header-btn:active,
    .action-btn:active,
    .creator-badge:active {
      transform: none;
    }
  }
</style>
