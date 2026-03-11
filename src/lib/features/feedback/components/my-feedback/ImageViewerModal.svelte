<!-- ImageViewerModal - Full-screen image viewer for feedback screenshots -->
<script lang="ts">
  import { onMount } from "svelte";
  import { t } from "$lib/shared/i18n/i18n.svelte.js";

  let {
    images = [],
    initialIndex = 0,
    isOpen = false,
    onClose,
  }: {
    images: string[];
    initialIndex?: number;
    isOpen?: boolean;
    onClose: () => void;
  } = $props();

  let currentIndex = $state(0);
  let dialogRef = $state<HTMLDialogElement | null>(null);

  // Sync initial index when opening
  $effect(() => {
    if (isOpen) {
      currentIndex = initialIndex;
      dialogRef?.showModal();
    } else {
      dialogRef?.close();
    }
  });

  function handlePrev() {
    currentIndex = currentIndex > 0 ? currentIndex - 1 : images.length - 1;
  }

  function handleNext() {
    currentIndex = currentIndex < images.length - 1 ? currentIndex + 1 : 0;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (!isOpen) return;
    if (e.key === "ArrowLeft") handlePrev();
    if (e.key === "ArrowRight") handleNext();
    if (e.key === "Escape") onClose();
  }

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<dialog
  bind:this={dialogRef}
  class="image-viewer-modal"
  onclose={onClose}
  onclick={handleBackdropClick}
>
  {#if images.length > 0}
    <div
      class="viewer-container"
      role="dialog"
      aria-modal="true"
      aria-label={t("feedback_image_viewer")}
    >
      <!-- Close button -->
      <button
        class="close-btn"
        onclick={onClose}
        type="button"
        aria-label={t("feedback_close")}
      >
        <i class="fas fa-times" aria-hidden="true"></i>
      </button>

      <!-- Image counter -->
      {#if images.length > 1}
        <div class="counter">
          {currentIndex + 1} / {images.length}
        </div>
      {/if}

      <!-- Main image -->
      <div class="image-wrapper">
        <img
          src={images[currentIndex]}
          alt="Screenshot {currentIndex + 1}"
          class="full-image"
        />
      </div>

      <!-- Navigation arrows -->
      {#if images.length > 1}
        <button
          class="nav-btn prev"
          onclick={handlePrev}
          type="button"
          aria-label={t("feedback_previous")}
        >
          <i class="fas fa-chevron-left" aria-hidden="true"></i>
        </button>
        <button
          class="nav-btn next"
          onclick={handleNext}
          type="button"
          aria-label={t("feedback_next")}
        >
          <i class="fas fa-chevron-right" aria-hidden="true"></i>
        </button>
      {/if}

      <!-- Thumbnail strip -->
      {#if images.length > 1}
        <div class="thumbnail-strip">
          {#each images as img, i}
            <button
              class="thumbnail"
              class:active={i === currentIndex}
              onclick={() => (currentIndex = i)}
              type="button"
              aria-label="View image {i + 1}"
            >
              <img src={img} alt="Thumbnail {i + 1}" />
            </button>
          {/each}
        </div>
      {/if}
    </div>
  {/if}
</dialog>

<style>
  .image-viewer-modal {
    padding: 0;
    border: none;
    background: transparent;
    max-width: 100vw;
    max-height: 100vh;
    width: 100vw;
    height: 100vh;
  }

  .image-viewer-modal::backdrop {
    background: rgba(0, 0, 0, 0.95);
  }

  .viewer-container {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 100vw;
    height: 100vh;
    padding: 16px;
    box-sizing: border-box;
  }

  .close-btn {
    position: absolute;
    top: 16px;
    right: 16px;
    width: var(--min-touch-target); /* WCAG AAA touch target */
    height: var(--min-touch-target);
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 50%;
    color: white;
    font-size: 1.25rem;
    cursor: pointer;
    z-index: 10;
    transition: all var(--duration-normal) ease;
  }

  .close-btn:hover {
    background: rgba(0, 0, 0, 0.8);
    border-color: rgba(255, 255, 255, 0.4);
  }

  .counter {
    position: absolute;
    top: 16px;
    left: 50%;
    transform: translateX(-50%);
    padding: 8px 16px;
    background: rgba(0, 0, 0, 0.6);
    border-radius: 20px;
    color: white;
    font-size: 0.875rem;
    font-weight: 500;
    z-index: 10;
  }

  .image-wrapper {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    max-height: calc(100vh - 120px);
    overflow: hidden;
  }

  .full-image {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    border-radius: 8px;
  }

  .nav-btn {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 50%;
    color: white;
    font-size: 1.25rem;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
    z-index: 5;
  }

  .nav-btn:hover {
    background: rgba(0, 0, 0, 0.8);
    border-color: rgba(255, 255, 255, 0.4);
  }

  .nav-btn.prev {
    left: 16px;
  }

  .nav-btn.next {
    right: 16px;
  }

  .thumbnail-strip {
    display: flex;
    gap: 8px;
    padding: 12px;
    background: rgba(0, 0, 0, 0.6);
    border-radius: 12px;
    margin-top: 16px;
    overflow-x: auto;
    max-width: 100%;
  }

  .thumbnail {
    flex-shrink: 0;
    width: 56px;
    height: 56px;
    padding: 0;
    border: 2px solid transparent;
    border-radius: 8px;
    overflow: hidden;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
    background: transparent;
  }

  .thumbnail.active {
    border-color: var(--theme-accent, var(--semantic-info));
  }

  .thumbnail:hover:not(.active) {
    border-color: rgba(255, 255, 255, 0.4);
  }

  .thumbnail img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  /* Mobile optimizations */
  @media (max-width: 768px) {
    .nav-btn.prev {
      left: 8px;
    }

    .nav-btn.next {
      right: 8px;
    }

    .thumbnail {
      width: var(--min-touch-target);
      height: var(--min-touch-target);
    }
  }
</style>
