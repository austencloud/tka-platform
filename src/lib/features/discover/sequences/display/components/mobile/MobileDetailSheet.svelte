<!--
  MobileDetailSheet.svelte

  Swipe-able bottom sheet for sequence details.

  States:
  - peek: Shows word label + swipe indicator (~100px)
  - expanded: Shows all info, scrollable (~70% of screen)
-->
<script lang="ts">
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { CollaborativeVideo } from "$lib/shared/video-collaboration/domain/CollaborativeVideo";
  import { onMount } from "svelte";
  import AvatarImage from "../../../../creators/components/profile/AvatarImage.svelte";
  import SequenceVideosSection from "$lib/shared/video-collaboration/components/SequenceVideosSection.svelte";

  const {
    sequence,
    sheetState = "peek",
    onStateChange,
    onAction,
  }: {
    sequence: SequenceData;
    sheetState?: "peek" | "expanded";
    onStateChange?: (state: "peek" | "expanded") => void;
    onAction?: (action: string) => void;
  } = $props();

  // Touch tracking for swipe gestures
  let sheetEl: HTMLDivElement;
  let isDragging = $state(false);
  let dragStartY = 0;
  let dragDeltaY = $state(0);
  let currentTranslateY = $state(0);

  // Sheet heights
  const PEEK_HEIGHT = 120;
  const EXPANDED_HEIGHT_PERCENT = 80;

  // Derived heights based on viewport
  let viewportHeight = $state(0);

  onMount(() => {
    viewportHeight = window.innerHeight;
    const handleResize = () => {
      viewportHeight = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  });

  const expandedHeight = $derived(
    Math.round(viewportHeight * (EXPANDED_HEIGHT_PERCENT / 100))
  );
  const peekTranslateY = $derived(viewportHeight - PEEK_HEIGHT);
  const expandedTranslateY = $derived(viewportHeight - expandedHeight);

  // Current position based on state
  const targetTranslateY = $derived(
    sheetState === "peek" ? peekTranslateY : expandedTranslateY
  );

  // Handle touch start
  function handleTouchStart(e: TouchEvent) {
    const touch = e.touches[0];
    if (!touch) return;
    isDragging = true;
    dragStartY = touch.clientY;
    currentTranslateY = targetTranslateY;
  }

  // Handle touch move
  function handleTouchMove(e: TouchEvent) {
    if (!isDragging) return;
    const touch = e.touches[0];
    if (!touch) return;

    const currentY = touch.clientY;
    const deltaY = currentY - dragStartY;
    dragDeltaY = deltaY;

    // Prevent overscroll at top when expanded
    if (sheetState === "expanded" && sheetEl) {
      const scrollTop = sheetEl.scrollTop;
      if (scrollTop <= 0 && deltaY > 0) {
        // Allow dragging down when at top
        e.preventDefault();
      } else if (scrollTop > 0) {
        // Let sheet scroll normally
        isDragging = false;
        dragDeltaY = 0;
        return;
      }
    }
  }

  // Handle touch end
  function handleTouchEnd() {
    if (!isDragging) return;
    isDragging = false;

    const velocity = dragDeltaY;
    const threshold = 50;

    if (sheetState === "peek") {
      // Swipe up to expand
      if (velocity < -threshold) {
        onStateChange?.("expanded");
      }
    } else {
      // Swipe down to collapse
      if (velocity > threshold) {
        onStateChange?.("peek");
      }
    }

    dragDeltaY = 0;
  }

  // Click handler for drag handle area
  function handleDragHandleClick() {
    onStateChange?.(sheetState === "peek" ? "expanded" : "peek");
  }

  // Calculate transform
  const sheetTransform = $derived.by(() => {
    let y = targetTranslateY;
    if (isDragging) {
      y = Math.max(
        expandedTranslateY,
        Math.min(peekTranslateY + 50, currentTranslateY + dragDeltaY)
      );
    }
    return `translateY(${y}px)`;
  });

  // Check if creator info is available
  const hasCreatorInfo = $derived(Boolean(sequence.ownerId));

  // Video state
  let showVideoPlayer: CollaborativeVideo | null = $state(null);
  let videosKey = $state(0);

  function handleVideoClick(video: CollaborativeVideo) {
    showVideoPlayer = video;
  }

  function handleUploadClick() {
    onAction?.("upload-video");
  }
</script>

<div
  class="sheet"
  class:expanded={sheetState === "expanded"}
  class:dragging={isDragging}
  style:transform={sheetTransform}
  bind:this={sheetEl}
  ontouchstart={handleTouchStart}
  ontouchmove={handleTouchMove}
  ontouchend={handleTouchEnd}
  role="dialog"
  aria-label="Sequence details"
>
  <!-- Drag handle (always visible) -->
  <button
    class="drag-handle"
    onclick={handleDragHandleClick}
    aria-label="Expand details"
  >
    <div class="handle-bar"></div>
  </button>

  <!-- Peek content: Word label -->
  <div class="peek-content">
    <h2 class="word-label">{sequence.name || sequence.word}</h2>
    <div class="peek-meta">
      <span class="meta-item">{sequence.sequenceLength} beats</span>
      <span class="meta-separator">•</span>
      <span class="meta-item">{sequence.difficultyLevel}</span>
    </div>
  </div>

  <!-- Expanded content -->
  {#if sheetState === "expanded"}
    <div class="expanded-content">
      <!-- Creator section -->
      {#if hasCreatorInfo}
        <button class="creator-row" onclick={() => onAction?.("view-creator")}>
          <AvatarImage
            src={sequence.ownerAvatarUrl}
            alt={sequence.ownerDisplayName || "Creator"}
            size={40}
          />
          <div class="creator-info">
            <span class="creator-name">
              {sequence.ownerDisplayName || sequence.author || "Unknown"}
            </span>
            <span class="creator-label">Creator</span>
          </div>
          <svg
            class="creator-arrow"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      {/if}

      <!-- Videos section -->
      {#key videosKey}
        <SequenceVideosSection
          sequenceId={sequence.id}
          onVideoClick={handleVideoClick}
          onUploadClick={handleUploadClick}
        />
      {/key}

      <!-- Action buttons -->
      <div class="actions">
        <button class="action-btn" onclick={() => onAction?.("edit")}>
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path
              d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"
            />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
          <span>Edit</span>
        </button>
        <button class="action-btn" onclick={() => onAction?.("fullscreen")}>
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
          <span>Full View</span>
        </button>
        <button
          class="action-btn action-btn-danger"
          onclick={() => onAction?.("delete")}
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
          <span>Delete</span>
        </button>
      </div>
    </div>
  {/if}
</div>

<!-- Video Player Modal -->
{#if showVideoPlayer}
  <div class="video-modal" role="dialog" aria-label="Video player">
    <button
      class="video-backdrop"
      onclick={() => (showVideoPlayer = null)}
      aria-label="Close video player"
    ></button>
    <div class="video-container">
      <button
        class="video-close"
        onclick={() => (showVideoPlayer = null)}
        aria-label="Close video"
      >
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
      <video src={showVideoPlayer.videoUrl} controls autoplay muted playsinline>
        <track kind="captions" />
      </video>
    </div>
  </div>
{/if}

<style>
  .sheet {
    position: absolute;
    left: 0;
    right: 0;
    top: 0;
    height: 100%;
    background: linear-gradient(
      to bottom,
      rgba(15, 15, 20, 0.98) 0%,
      rgba(20, 20, 30, 0.99) 100%
    );
    border-radius: 24px 24px 0 0;
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    box-shadow: 0 -8px 40px rgba(0, 0, 0, 0.5);
    z-index: 60;
    display: flex;
    flex-direction: column;
    will-change: transform;
    transition: transform 0.35s cubic-bezier(0.32, 0.72, 0, 1);
  }

  .sheet.dragging {
    transition: none;
  }

  .sheet.expanded {
    overflow-y: auto;
    overscroll-behavior: contain;
  }

  /* Drag handle */
  .drag-handle {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 12px;
    background: none;
    border: none;
    cursor: grab;
    flex-shrink: 0;
  }

  .handle-bar {
    width: 36px;
    height: 4px;
    background: var(--theme-stroke-strong);
    border-radius: 2px;
  }

  /* Peek content */
  .peek-content {
    padding: 0 20px 16px;
    flex-shrink: 0;
  }

  .word-label {
    margin: 0 0 8px;
    font-size: 1.75rem;
    font-weight: 700;
    color: var(--theme-text, white);
    text-align: center;
    line-height: 1.25;
    letter-spacing: -0.01em;
  }

  .peek-meta {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    color: var(--theme-text-dim);
    font-size: 1rem;
    line-height: 1.4;
  }

  .meta-separator {
    opacity: 0.5;
  }

  /* Expanded content */
  .expanded-content {
    padding: 8px 20px 40px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  /* Creator row */
  .creator-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    background: var(--theme-card-bg, var(--theme-card-bg));
    border: 1px solid var(--theme-stroke, var(--theme-stroke));
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .creator-row:hover {
    background: var(--theme-card-hover-bg);
  }

  .creator-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
  }

  .creator-name {
    font-size: 1rem;
    font-weight: 600;
    color: var(--theme-text, white);
    line-height: 1.4;
  }

  .creator-label {
    font-size: 0.875rem;
    color: var(--theme-text-dim, var(--theme-text-dim));
    line-height: 1.3;
  }

  .creator-arrow {
    color: color-mix(in srgb, var(--theme-text, white) 40%, transparent);
    transition: transform 0.2s ease;
  }

  .creator-row:hover .creator-arrow {
    transform: translateX(2px);
    color: var(--theme-text-dim, var(--theme-text-dim));
  }

  /* Actions */
  .actions {
    display: flex;
    gap: 10px;
    margin-top: 8px;
  }

  .action-btn {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 14px 8px;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke, var(--theme-stroke));
    border-radius: 12px;
    color: color-mix(in srgb, var(--theme-text, white) 85%, transparent);
    font-size: 0.875rem;
    font-weight: 500;
    line-height: 1.3;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .action-btn:hover {
    background: var(--theme-card-hover-bg);
    color: var(--theme-text, white);
  }

  .action-btn:active {
    transform: scale(0.96);
  }

  .action-btn-danger {
    color: var(--semantic-error, var(--semantic-error));
    border-color: color-mix(
      in srgb,
      var(--semantic-error, var(--semantic-error)) 30%,
      transparent
    );
  }

  .action-btn-danger:hover {
    background: color-mix(
      in srgb,
      var(--semantic-error, var(--semantic-error)) 15%,
      transparent
    );
    color: var(--semantic-error);
  }

  /* Video Modal */
  .video-modal {
    position: fixed;
    inset: 0;
    z-index: 200;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .video-backdrop {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.9);
    border: none;
    cursor: pointer;
  }

  .video-container {
    position: relative;
    width: 100%;
    max-width: 100%;
    max-height: 100%;
  }

  .video-container video {
    width: 100%;
    max-height: 90vh;
    object-fit: contain;
  }

  .video-close {
    position: absolute;
    top: max(env(safe-area-inset-top, 12px), 12px);
    right: 12px;
    z-index: 10;
    width: 44px;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.6);
    border: none;
    border-radius: 50%;
    cursor: pointer;
  }

  .video-close svg {
    width: 24px;
    height: 24px;
    color: white;
  }
</style>
